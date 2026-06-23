import { createServerFn } from "@tanstack/react-start";
import type { Project, Product, ICP, Competitor, FounderProfile, Channel, PainSignalPost, CommunityDistribution, PainSearchSession } from "../db/schema.js";
import type { ChannelType, ChannelConfig } from "./channels.js";
import { BUILDER_SUBS, NOISE_SUBS, PAIN_PATTERNS, scorePainSignal, scoreConsumerSignal, VALIDATION_PHRASES, SOLUTION_PHRASES } from "./reddit-patterns.js";

export type { ChannelType, ChannelConfig };
export type { PainSignalPost, CommunityDistribution, PainSearchSession };

export type ProjectWithCounts = Project & {
  opportunityCount: number;
  signalCount: number;
  // Derived product roll-up (an Idea may have 0..N products)
  productCount: number;
  primaryProductId: number | null;
  isLive: boolean;          // has at least one deployed product
};

export const getProjects = createServerFn({ method: "GET" })
  .handler(async (): Promise<ProjectWithCounts[]> => {
    const { db, projects, products, opportunities, signals } = await import("../db/index.js");
    const { eq, count, desc, asc, sql } = await import("drizzle-orm");

    const rows = await db.select().from(projects).orderBy(
      sql`CASE WHEN ${projects.sortOrder} IS NULL THEN 1 ELSE 0 END`,
      asc(projects.sortOrder),
      desc(projects.createdAt),
    );

    const results = await Promise.all(
      rows.map(async (project) => {
        const [{ oppCount }] = await db
          .select({ oppCount: count() })
          .from(opportunities)
          .where(eq(opportunities.projectId, project.id));

        const [{ sigCount }] = await db
          .select({ sigCount: count() })
          .from(signals)
          .where(eq(signals.projectId, project.id));

        const prods = await db
          .select({ id: products.id, deployStatus: products.deployStatus })
          .from(products)
          .where(eq(products.ideaId, project.id));

        return {
          ...project,
          opportunityCount: Number(oppCount),
          signalCount: Number(sigCount),
          productCount: prods.length,
          primaryProductId: prods[0]?.id ?? null,
          isLive: prods.some((p) => p.deployStatus === "deployed"),
        };
      })
    );

    return results;
  });

// Products with their idea name, for the sidebar "Products" section.
export type ProductWithIdea = Product & { ideaName: string };

export const getProductsList = createServerFn({ method: "GET" })
  .handler(async (): Promise<ProductWithIdea[]> => {
    const { db, products, projects } = await import("../db/index.js");
    const { eq, desc, asc, sql } = await import("drizzle-orm");
    const rows = await db
      .select({ product: products, ideaName: projects.name })
      .from(products)
      .leftJoin(projects, eq(products.ideaId, projects.id))
      .orderBy(
        sql`CASE WHEN ${products.sortOrder} IS NULL THEN 1 ELSE 0 END`,
        asc(products.sortOrder),
        desc(products.createdAt),
      );
    return rows.map((r) => ({ ...r.product, ideaName: r.ideaName ?? "" }));
  });

// createProject creates an IDEA (discovery workspace). Build/deploy/monetize
// fields (domain, handle, targetMrr, …) live on products, created later via
// the explicit New Product flow (see product-fns.createProduct).
export const createProject = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      name: string;
      description?: string;
      hypothesis?: string;
      directionType?: "domain" | "platform" | "space" | "hunch";
      channelTypes?: ChannelType[];
    }) => d
  )
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, projects, channels } = await import("../db/index.js");

    const [row] = await db
      .insert(projects)
      .values({
        name: data.name,
        description: data.description,
        hypothesis: data.hypothesis,
      })
      .returning({ id: projects.id });

    if (data.channelTypes && data.channelTypes.length > 0) {
      const { generateChannelConfigs } = await import("./ai.js");
      const configs = await generateChannelConfigs(
        data.name,
        data.hypothesis ?? "",
        data.channelTypes,
        data.directionType ?? "hunch"
      );

      // For the Reddit channel, enhance subreddits using real Reddit search + LLM ranking
      if (data.channelTypes.includes("reddit")) {
        const redditCfg = (configs["reddit"] ?? {}) as { keywords?: string[]; subreddits?: string[] };
        const initialSubreddits = redditCfg.subreddits ?? [];

        // Fallback: if LLM config produced no keywords, derive from hypothesis/name.
        // Trim to 4 words so Reddit subreddit search gets a focused query.
        const fallbackQuery = (data.hypothesis ?? data.name ?? "")
          .split(/\s+/).slice(0, 4).join(" ");
        const searchKeywords = (redditCfg.keywords ?? []).length > 0
          ? redditCfg.keywords!
          : fallbackQuery ? [fallbackQuery] : [];

        const discovered = await runDiscoverSubreddits({
          keywords: searchKeywords,
          projectName: data.name,
          existingSubreddits: [],
        });
        const merged = [
          ...initialSubreddits,
          ...discovered.map(s => s.name).filter(n => !initialSubreddits.map(s => s.toLowerCase()).includes(n.toLowerCase())),
        ];
        configs["reddit"] = { ...redditCfg, subreddits: merged };
      }

      await db.insert(channels).values(
        data.channelTypes.map((type) => ({
          projectId: row.id,
          type,
          mode: "discovery" as const,
          status: "active" as const,
          config: (configs[type] ?? {}) as { keywords?: string[]; subreddits?: string[] },
        }))
      );
    }

    return { id: row.id };
  });

export const getProject = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<Project | null> => {
    const { db, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [row] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.id));

    return row ?? null;
  });

export type ProjectStats = {
  signalCount: number;
  opportunityCount: number;
  featureCount: number;
  discoveryRunCount: number;
};

export const getProjectStats = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<ProjectStats> => {
    const { db, signals, opportunities, features, discoveryRuns, products } = await import("../db/index.js");
    const { eq, count, inArray } = await import("drizzle-orm");

    const prodIds = (await db.select({ id: products.id }).from(products).where(eq(products.ideaId, data.id))).map(p => p.id);

    const [[s], [o], [d]] = await Promise.all([
      db.select({ n: count() }).from(signals).where(eq(signals.projectId, data.id)),
      db.select({ n: count() }).from(opportunities).where(eq(opportunities.projectId, data.id)),
      db.select({ n: count() }).from(discoveryRuns).where(eq(discoveryRuns.projectId, data.id)),
    ]);
    // features are product-scoped → count across the idea's products
    const [f] = prodIds.length
      ? await db.select({ n: count() }).from(features).where(inArray(features.productId, prodIds))
      : [{ n: 0 }];

    return {
      signalCount: Number(s.n),
      opportunityCount: Number(o.n),
      featureCount: Number(f.n),
      discoveryRunCount: Number(d.n),
    };
  });

export type ScoreBucket = { range: string; count: number };
export type FunnelStage = { stage: string; count: number };

export const getProjectScoreDistribution = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<ScoreBucket[]> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({ score: opportunities.scoreTotal })
      .from(opportunities)
      .where(eq(opportunities.projectId, data.id));

    const buckets: Record<string, number> = {
      "0–2": 0, "3–4": 0, "5–6": 0, "7–8": 0, "9–10": 0,
    };
    for (const { score } of rows) {
      if (score <= 2) buckets["0–2"]++;
      else if (score <= 4) buckets["3–4"]++;
      else if (score <= 6) buckets["5–6"]++;
      else if (score <= 8) buckets["7–8"]++;
      else buckets["9–10"]++;
    }
    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  });

export const getProjectFunnel = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<FunnelStage[]> => {
    const { db, signals, opportunities } = await import("../db/index.js");
    const { eq, count, inArray } = await import("drizzle-orm");

    const [[sigs], [opps], [interesting], [building]] = await Promise.all([
      db.select({ n: count() }).from(signals).where(eq(signals.projectId, data.id)),
      db.select({ n: count() }).from(opportunities).where(eq(opportunities.projectId, data.id)),
      db.select({ n: count() }).from(opportunities).where(
        inArray(opportunities.status, ["interesting", "validated"])
      ),
      db.select({ n: count() }).from(opportunities).where(
        inArray(opportunities.status, ["building", "built", "launched", "measuring"])
      ),
    ]);

    return [
      { stage: "Signals", count: Number(sigs.n) },
      { stage: "Opportunities", count: Number(opps.n) },
      { stage: "Interesting", count: Number(interesting.n) },
      { stage: "Building", count: Number(building.n) },
    ];
  });

export const updateProject = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: number;
      name?: string;
      description?: string;
      handle?: string;
      domain?: string;
      hypothesis?: string;
      targetMrrCents?: number;
      status?: string;
      twitterHandle?: string;
      deployStatus?: string;
      repoUrl?: string;
      coolifyAppId?: string;
    }) => d
  )
  .handler(async ({ data }): Promise<void> => {
    const { db, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.handle !== undefined) updates.handle = data.handle;
    if (data.domain !== undefined) updates.domain = data.domain;
    if (data.hypothesis !== undefined) updates.hypothesis = data.hypothesis;
    if (data.targetMrrCents !== undefined) updates.targetMrrCents = data.targetMrrCents;
    if (data.status !== undefined) updates.status = data.status;
    if (data.twitterHandle !== undefined) updates.twitterHandle = data.twitterHandle;
    if (data.deployStatus !== undefined) updates.deployStatus = data.deployStatus;
    if (data.repoUrl !== undefined) updates.repoUrl = data.repoUrl;
    if (data.coolifyAppId !== undefined) updates.coolifyAppId = data.coolifyAppId;

    await db.update(projects).set(updates).where(eq(projects.id, data.id));
  });

export const reorderProjects = createServerFn({ method: "POST" })
  .inputValidator((d: { orderedIds: number[] }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await Promise.all(
      data.orderedIds.map((id, index) =>
        db.update(projects).set({ sortOrder: index }).where(eq(projects.id, id))
      )
    );
  });

export const deleteProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db } = await import("../db/index.js");
    const {
      signals, opportunities, discoveryRuns,
      seoRuns, icps, competitors, channels, projects,
    } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { deleteProductsForIdea } = await import("./product-fns.js");
    const pid = data.id;

    // products + their build/launch/monitor children (hand-rolled cascade)
    await deleteProductsForIdea(pid);
    // idea (discovery) children
    await db.delete(signals).where(eq(signals.projectId, pid));
    await db.delete(opportunities).where(eq(opportunities.projectId, pid));
    await db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, pid));
    await db.delete(seoRuns).where(eq(seoRuns.projectId, pid));   // discovery seo runs
    await db.delete(icps).where(eq(icps.projectId, pid));
    await db.delete(competitors).where(eq(competitors.projectId, pid));
    await db.delete(channels).where(eq(channels.projectId, pid)); // discovery channels
    await db.delete(projects).where(eq(projects.id, pid));
  });

export const purgeProjectData = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db } = await import("../db/index.js");
    const {
      signals, opportunities, discoveryRuns, seoRuns, icps, competitors, channels,
    } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const { deleteProductsForIdea } = await import("./product-fns.js");
    const pid = data.id;

    // Remove built products (and their children); keeps the idea row itself.
    await deleteProductsForIdea(pid);

    // Delete idea discovery data
    await db.delete(signals).where(eq(signals.projectId, pid));
    await db.delete(opportunities).where(eq(opportunities.projectId, pid));  // cascades opportunitySignals, opportunityCompetitors, validations
    await db.delete(discoveryRuns).where(eq(discoveryRuns.projectId, pid));
    await db.delete(seoRuns).where(eq(seoRuns.projectId, pid));   // discovery seo runs (cascades keywordOpportunities)
    await db.delete(icps).where(eq(icps.projectId, pid));
    await db.delete(competitors).where(eq(competitors.projectId, pid));

    // Reset channel last-run timestamps so they re-run fresh
    await db.update(channels)
      .set({ lastRunAt: null as any })
      .where(eq(channels.projectId, pid));
  });

export type GlobalStats = {
  totalTargetMrrCents: number;
  totalEmailSignups: number;
  totalOpportunities: number;
  totalSignals: number;
  totalProjects: number;
  activeProjects: number;
};

export const getGlobalStats = createServerFn({ method: "GET" })
  .handler(async (): Promise<GlobalStats> => {
    const { db, projects, products, signals, opportunities, validations } = await import("../db/index.js");
    const { count, sum, eq } = await import("drizzle-orm");

    const [[projRow], [prodRow], [sigRow], [oppRow], [validRow], [activeRow]] = await Promise.all([
      db.select({ total: count() }).from(projects),
      db.select({ totalMrr: sum(products.targetMrrCents) }).from(products),  // MRR target lives on products
      db.select({ total: count() }).from(signals),
      db.select({ total: count() }).from(opportunities),
      db.select({ totalSignups: sum(validations.emailSignups) }).from(validations),
      db.select({ n: count() }).from(projects).where(eq(projects.status, "active")),
    ]);

    return {
      totalTargetMrrCents: Number(prodRow.totalMrr ?? 0),
      totalEmailSignups: Number(validRow.totalSignups ?? 0),
      totalOpportunities: Number(oppRow.total),
      totalSignals: Number(sigRow.total),
      totalProjects: Number(projRow.total),
      activeProjects: Number(activeRow.n),
    };
  });

export const getFounderProfile = createServerFn({ method: "GET" })
  .handler(async (): Promise<FounderProfile | null> => {
    const { db, founderProfile } = await import("../db/index.js");

    const [row] = await db.select().from(founderProfile);
    return row ?? null;
  });

export const upsertFounderProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      handle?: string;
      companyName?: string;
      domain?: string;
      cvRaw?: string;
      skills?: string[];
      domainExpertise?: string[];
      unfairAdvantages?: string[];
      channelsReach?: Record<string, number>;
      gitOrg?: string;
      gitToken?: string;
      dnsProvider?: string;
      cloudflareToken?: string;
      cloudflareAccountId?: string;
      registrarProvider?: string;
      namecheapUser?: string;
      namecheapKey?: string;
      deploymentProvider?: string;
      coolifyApiKey?: string;
      coolifyServerUrl?: string;
      localReposDir?: string;
      openRouterKey?: string;
      globalVpsIp?: string;
      stripeWebhookSecret?: string;
    }) => d
  )
  .handler(async ({ data }): Promise<void> => {
    const { db, founderProfile } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [existing] = await db
      .select({ id: founderProfile.id })
      .from(founderProfile)
      .where(eq(founderProfile.id, 1));

    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.handle !== undefined) updates.handle = data.handle;
      if (data.companyName !== undefined) updates.companyName = data.companyName;
      if (data.domain !== undefined) updates.domain = data.domain;
      if (data.cvRaw !== undefined) updates.cvRaw = data.cvRaw;
      if (data.skills !== undefined) updates.skills = data.skills;
      if (data.domainExpertise !== undefined) updates.domainExpertise = data.domainExpertise;
      if (data.unfairAdvantages !== undefined) updates.unfairAdvantages = data.unfairAdvantages;
      if (data.channelsReach !== undefined) updates.channelsReach = data.channelsReach;
      if (data.gitOrg !== undefined) updates.gitOrg = data.gitOrg;
      if (data.gitToken !== undefined) updates.gitToken = data.gitToken;
      if (data.dnsProvider !== undefined) updates.dnsProvider = data.dnsProvider;
      if (data.cloudflareToken !== undefined) updates.cloudflareToken = data.cloudflareToken;
      if (data.cloudflareAccountId !== undefined) updates.cloudflareAccountId = data.cloudflareAccountId;
      if (data.registrarProvider !== undefined) updates.registrarProvider = data.registrarProvider;
      if (data.namecheapUser !== undefined) updates.namecheapUser = data.namecheapUser;
      if (data.namecheapKey !== undefined) updates.namecheapKey = data.namecheapKey;
      if (data.deploymentProvider !== undefined) updates.deploymentProvider = data.deploymentProvider;
      if (data.coolifyApiKey !== undefined) updates.coolifyApiKey = data.coolifyApiKey;
      if (data.coolifyServerUrl !== undefined) updates.coolifyServerUrl = data.coolifyServerUrl;
      if (data.localReposDir !== undefined) updates.localReposDir = data.localReposDir;
      if (data.openRouterKey !== undefined) updates.openRouterKey = data.openRouterKey;
      if (data.globalVpsIp !== undefined) updates.globalVpsIp = data.globalVpsIp;
      if (data.stripeWebhookSecret !== undefined) updates.stripeWebhookSecret = data.stripeWebhookSecret;

      await db.update(founderProfile).set(updates).where(eq(founderProfile.id, 1));
    } else {
      await db.insert(founderProfile).values({
        id: 1,
        handle: data.handle,
        companyName: data.companyName,
        domain: data.domain,
        cvRaw: data.cvRaw,
        skills: data.skills,
        domainExpertise: data.domainExpertise,
        unfairAdvantages: data.unfairAdvantages,
        channelsReach: data.channelsReach,
        gitOrg: data.gitOrg,
        gitToken: data.gitToken,
        dnsProvider: data.dnsProvider,
        cloudflareToken: data.cloudflareToken,
        cloudflareAccountId: data.cloudflareAccountId,
        registrarProvider: data.registrarProvider,
        namecheapUser: data.namecheapUser,
        namecheapKey: data.namecheapKey,
        deploymentProvider: data.deploymentProvider,
        coolifyApiKey: data.coolifyApiKey,
        coolifyServerUrl: data.coolifyServerUrl,
        openRouterKey: data.openRouterKey,
        globalVpsIp: data.globalVpsIp,
        stripeWebhookSecret: data.stripeWebhookSecret,
      });
    }
  });

export const getProjectICPs = createServerFn({ method: "GET" })
  .inputValidator((d: { projectId: number }) => d)
  .handler(async ({ data }): Promise<ICP[]> => {
    const { db, icps } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    return db.select().from(icps).where(eq(icps.projectId, data.projectId));
  });

export const createICP = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      projectId: number;
      description: string;
      role?: string;
      companySize?: string;
      painUrgency?: number;
      wtpLowCents?: number;
      wtpHighCents?: number;
      isPrimary?: boolean;
    }) => d
  )
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, icps } = await import("../db/index.js");

    const [row] = await db
      .insert(icps)
      .values({
        projectId: data.projectId,
        description: data.description,
        role: data.role,
        companySize: data.companySize,
        painUrgency: data.painUrgency,
        wtpLowCents: data.wtpLowCents,
        wtpHighCents: data.wtpHighCents,
        isPrimary: data.isPrimary ?? false,
      })
      .returning({ id: icps.id });

    return { id: row.id };
  });

export const deleteICP = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, icps } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    await db.delete(icps).where(eq(icps.id, data.id));
  });

export const getProjectCompetitors = createServerFn({ method: "GET" })
  .inputValidator((d: { projectId: number }) => d)
  .handler(async ({ data }): Promise<Competitor[]> => {
    const { db, competitors } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    return db
      .select()
      .from(competitors)
      .where(eq(competitors.projectId, data.projectId));
  });

export const createCompetitor = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      projectId: number;
      name: string;
      url?: string;
      pricingDescription?: string;
      keyWeaknesses?: string;
    }) => d
  )
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, competitors } = await import("../db/index.js");

    const [row] = await db
      .insert(competitors)
      .values({
        projectId: data.projectId,
        name: data.name,
        url: data.url,
        pricingDescription: data.pricingDescription,
        keyWeaknesses: data.keyWeaknesses,
      })
      .returning({ id: competitors.id });

    return { id: row.id };
  });

export const deleteCompetitor = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, competitors } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    await db.delete(competitors).where(eq(competitors.id, data.id));
  });

export const getChannelSignalCounts = createServerFn({ method: "GET" })
  .inputValidator((d: { channelIds: number[] }) => d)
  .handler(async ({ data }): Promise<Record<number, { total: number; lastRun: number }>> => {
    if (data.channelIds.length === 0) return {};
    const { db, signals, channels } = await import("../db/index.js");
    const { count, eq, gte, and, inArray } = await import("drizzle-orm");

    const totals = await db
      .select({ channelId: signals.channelId, n: count() })
      .from(signals)
      .where(inArray(signals.channelId, data.channelIds))
      .groupBy(signals.channelId);

    const result: Record<number, { total: number; lastRun: number }> = {};
    for (const r of totals) {
      if (r.channelId != null) result[r.channelId] = { total: Number(r.n), lastRun: 0 };
    }

    const channelRows = await db
      .select({ id: channels.id, lastRunAt: channels.lastRunAt })
      .from(channels)
      .where(inArray(channels.id, data.channelIds));

    await Promise.all(channelRows.map(async (ch) => {
      if (!ch.lastRunAt) return;
      const [row] = await db
        .select({ n: count() })
        .from(signals)
        .where(and(eq(signals.channelId, ch.id), gte(signals.scrapedAt, ch.lastRunAt)));
      const lastRun = Number(row?.n ?? 0);
      if (result[ch.id]) result[ch.id].lastRun = lastRun;
      else result[ch.id] = { total: 0, lastRun };
    }));

    return result;
  });

// Single round-trip loader - replaces 5 separate server fn calls on project navigation
export const getProjectData = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<{
    project: Project;
    stats: ProjectStats;
    scores: ScoreBucket[];
    funnel: FunnelStage[];
    activeChannels: Channel[];
  } | null> => {
    const { db, projects, products, signals, opportunities, features, discoveryRuns, channels } = await import("../db/index.js");
    const { eq, count, inArray, and } = await import("drizzle-orm");

    const [projectRow] = await db.select().from(projects).where(eq(projects.id, data.id));
    if (!projectRow) return null;

    const [
      [s], [o], [f], [dr],
      oppScores,
      [interesting], [building],
      chans,
    ] = await Promise.all([
      db.select({ n: count() }).from(signals).where(eq(signals.projectId, data.id)),
      db.select({ n: count() }).from(opportunities).where(eq(opportunities.projectId, data.id)),
      // features are product-scoped → count across this idea's products
      db.select({ n: count() }).from(features).where(inArray(features.productId, db.select({ id: products.id }).from(products).where(eq(products.ideaId, data.id)))),
      db.select({ n: count() }).from(discoveryRuns).where(eq(discoveryRuns.projectId, data.id)),
      db.select({ score: opportunities.scoreTotal }).from(opportunities).where(eq(opportunities.projectId, data.id)),
      db.select({ n: count() }).from(opportunities).where(inArray(opportunities.status, ["interesting", "validated"])),
      db.select({ n: count() }).from(opportunities).where(inArray(opportunities.status, ["building", "built", "launched", "measuring"])),
      db.select().from(channels).where(and(eq(channels.projectId, data.id), eq(channels.status, "active"))),
    ]);

    const buckets: Record<string, number> = { "0–2": 0, "3–4": 0, "5–6": 0, "7–8": 0, "9–10": 0 };
    for (const { score } of oppScores) {
      if (score <= 2) buckets["0–2"]++;
      else if (score <= 4) buckets["3–4"]++;
      else if (score <= 6) buckets["5–6"]++;
      else if (score <= 8) buckets["7–8"]++;
      else buckets["9–10"]++;
    }

    return {
      project: projectRow,
      stats: {
        signalCount: Number(s.n),
        opportunityCount: Number(o.n),
        featureCount: Number(f.n),
        discoveryRunCount: Number(dr.n),
      },
      scores: Object.entries(buckets).map(([range, count]) => ({ range, count })),
      funnel: [
        { stage: "Signals", count: Number(s.n) },
        { stage: "Opportunities", count: Number(o.n) },
        { stage: "Interesting", count: Number(interesting.n) },
        { stage: "Building", count: Number(building.n) },
      ],
      activeChannels: chans,
    };
  });

export const getProjectChannels = createServerFn({ method: "GET" })
  .inputValidator((d: { projectId: number }) => d)
  .handler(async ({ data }): Promise<Channel[]> => {
    const { db, channels } = await import("../db/index.js");
    const { eq, and } = await import("drizzle-orm");

    return db
      .select()
      .from(channels)
      .where(and(eq(channels.projectId, data.projectId), eq(channels.status, "active")));
  });

export const updateProjectChannels = createServerFn({ method: "POST" })
  .inputValidator((d: { projectId: number; channelTypes: ChannelType[]; name: string; hypothesis?: string }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, channels } = await import("../db/index.js");
    const { eq, inArray } = await import("drizzle-orm");

    const existing = await db.select().from(channels).where(eq(channels.projectId, data.projectId));
    const existingTypes = new Set(existing.map((c) => c.type as ChannelType));
    const desiredTypes = new Set(data.channelTypes);

    // Remove channels that are no longer desired
    const toRemove = existing.filter((c) => !desiredTypes.has(c.type as ChannelType));
    if (toRemove.length > 0) {
      await db.delete(channels).where(inArray(channels.id, toRemove.map((c) => c.id)));
    }

    // Generate configs only for brand-new channel types
    const toAdd = data.channelTypes.filter((t) => !existingTypes.has(t));
    if (toAdd.length === 0) return;

    const { generateChannelConfigs } = await import("./ai.js");
    const configs = await generateChannelConfigs(data.name, data.hypothesis ?? "", toAdd);

    // Enhance Reddit subreddits with real Reddit search + LLM ranking
    if (toAdd.includes("reddit")) {
      const redditCfg = (configs["reddit"] ?? {}) as { keywords?: string[]; subreddits?: string[] };
      const keywords = redditCfg.keywords ?? [];
      const initialSubreddits = redditCfg.subreddits ?? [];
      const discovered = await runDiscoverSubreddits({
        keywords,
        projectName: data.name,
        existingSubreddits: [],
      });
      const merged = [
        ...initialSubreddits,
        ...discovered.map(s => s.name).filter(n => !initialSubreddits.map(s => s.toLowerCase()).includes(n.toLowerCase())),
      ];
      configs["reddit"] = { ...redditCfg, subreddits: merged };
    }

    await db.insert(channels).values(
      toAdd.map((type) => ({
        projectId: data.projectId,
        type,
        mode: "discovery" as const,
        status: "active" as const,
        config: (configs[type] ?? {}) as Record<string, unknown>,
      }))
    );
  });

export const toggleChannelStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { channelId: number; status: "active" | "paused" }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, channels } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(channels)
      .set({ status: data.status })
      .where(eq(channels.id, data.channelId));
  });

export const generateFromCustomPrompt = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string }) => d)
  .handler(async ({ data }): Promise<{ keywords: string[]; subreddits: string[] }> => {
    const { generateFromPrompt } = await import("./ai.js");
    return generateFromPrompt(data.prompt);
  });

export const updateChannelConfig = createServerFn({ method: "POST" })
  .inputValidator((d: { channelId: number; keywords: string[]; subreddits: string[]; competitors?: string[] }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, channels } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const config: Record<string, unknown> = { keywords: data.keywords, subreddits: data.subreddits };
    if (data.competitors !== undefined) config.competitors = data.competitors;
    await db.update(channels)
      .set({ config })
      .where(eq(channels.id, data.channelId));
  });

export type SubredditResult = { name: string; subscribers: number; description: string };

// ── Core discovery logic (used by both the server fn and channel creation) ─────

async function runDiscoverSubreddits(params: {
  keywords: string[];
  extraKeywords?: string[];
  projectName: string;
  existingSubreddits: string[];
}): Promise<SubredditResult[]> {
  const query = params.keywords.join(" ").trim();
  if (!query) return [];

  const seen = new Set<string>(params.existingSubreddits.map(s => s.toLowerCase()));
  const candidates: SubredditResult[] = [];

  // Reddit requires a descriptive user-agent — generic "Mozilla/5.0" gets 429'd server-side
  const UA = "BurningDemand:subreddit-discovery:1.0 (internal tool)";

  async function fetchSubreddits(q: string): Promise<void> {
    const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(q)}&limit=25&include_over_18=0&sort=relevance`;
    let res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });

    // Single retry on 429
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("retry-after") ?? "3", 10) * 1000;
      await new Promise(r => setTimeout(r, Math.min(wait, 5_000)));
      res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
    }

    if (!res.ok) {
      console.warn(`[discoverSubreddits] Reddit returned ${res.status} for query="${q}"`);
      return;
    }

    const json = await res.json() as { data: { children: Array<{ data: { display_name: string; subscribers: number; over18: boolean; public_description: string } }> } };
    for (const child of json.data.children) {
      const { display_name, subscribers, over18, public_description } = child.data;
      if (over18 || subscribers < 500) continue;
      const key = display_name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ name: display_name, subscribers, description: public_description ?? "" });
    }
  }

  try {
    await fetchSubreddits(query);

    // If the multi-word query returned nothing, retry with just the first keyword
    if (candidates.length === 0 && params.keywords.length > 1) {
      await fetchSubreddits(params.keywords[0]);
    }
  } catch (err) {
    console.warn("[discoverSubreddits] fetch failed:", err);
  }

  return candidates.sort((a, b) => b.subscribers - a.subscribers).slice(0, 10);
}

export const discoverSubreddits = createServerFn({ method: "POST" })
  .inputValidator((d: { keywords: string[]; extraKeywords?: string[]; projectName: string; existingSubreddits: string[] }) => d)
  .handler(async ({ data }): Promise<SubredditResult[]> => {
    return runDiscoverSubreddits(data);
  });

export const generateChannelSuggestionsForProject = createServerFn({ method: "POST" })
  .inputValidator((d: { channelId: number }) => d)
  .handler(async ({ data }): Promise<{ keywords: string[]; subreddits: string[] }> => {
    const { db, channels, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [ch] = await db.select().from(channels).where(eq(channels.id, data.channelId));
    if (!ch) return { keywords: [], subreddits: [] };

    const [project] = await db.select().from(projects).where(eq(projects.id, ch.projectId));
    if (!project) return { keywords: [], subreddits: [] };

    const cfg = (ch.config ?? {}) as { keywords?: string[]; subreddits?: string[] };
    const { generateChannelSuggestions } = await import("./ai.js");
    return generateChannelSuggestions(
      project.name,
      project.hypothesis ?? "",
      ch.type,
      cfg.keywords ?? [],
      cfg.subreddits ?? []
    );
  });

export const runChannelScout = createServerFn({ method: "POST" })
  .inputValidator((d: { channelId: number }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { db, channels } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [ch] = await db.select().from(channels).where(eq(channels.id, data.channelId));
    if (!ch) return { ok: false, message: "Channel not found" };
    // TODO: wire to Signal Scout pipeline
    return { ok: true, message: `Scout queued for channel: ${ch.type}` };
  });

// ── Tech Stacks ───────────────────────────────────────────────────────────────

export const getTechStacks = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db/index.js");
    const { techStacks } = await import("../db/schema.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(techStacks).orderBy(desc(techStacks.isDefault), techStacks.createdAt);
  });

export const createTechStack = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; content: string }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { techStacks } = await import("../db/schema.js");
    const now = new Date();
    const [row] = await db.insert(techStacks).values({
      name: data.name.trim(), content: data.content.trim(), isDefault: false, createdAt: now, updatedAt: now,
    }).returning({ id: techStacks.id });
    return row;
  });

export const updateTechStack = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; name?: string; content?: string; isDefault?: boolean }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { techStacks } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    if (data.isDefault) {
      await db.update(techStacks).set({ isDefault: false, updatedAt: new Date() });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.content !== undefined) patch.content = data.content.trim();
    if (data.isDefault !== undefined) patch.isDefault = data.isDefault;
    await db.update(techStacks).set(patch as any).where(eq(techStacks.id, data.id));
    return { ok: true };
  });

export const deleteTechStack = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { techStacks } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(techStacks).where(eq(techStacks.id, data.id));
    return { ok: true };
  });

// ── Design Templates ──────────────────────────────────────────────────────────

export const getDesignTemplates = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db/index.js");
    const { designTemplates } = await import("../db/schema.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(designTemplates).orderBy(desc(designTemplates.isDefault), designTemplates.createdAt);
  });

export const createDesignTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; content: string }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designTemplates } = await import("../db/schema.js");
    const now = new Date();
    const [row] = await db.insert(designTemplates).values({
      name: data.name.trim(), content: data.content.trim(), isDefault: false, createdAt: now, updatedAt: now,
    }).returning({ id: designTemplates.id });
    return row;
  });

export const updateDesignTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; name?: string; content?: string; isDefault?: boolean }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designTemplates } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    if (data.isDefault) {
      await db.update(designTemplates).set({ isDefault: false, updatedAt: new Date() });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.content !== undefined) patch.content = data.content.trim();
    if (data.isDefault !== undefined) patch.isDefault = data.isDefault;
    await db.update(designTemplates).set(patch as any).where(eq(designTemplates.id, data.id));
    return { ok: true };
  });

export const deleteDesignTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designTemplates } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(designTemplates).where(eq(designTemplates.id, data.id));
    return { ok: true };
  });

// ── Design Systems (HTML reference files) ─────────────────────────────────────

export const getDesignSystems = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db/index.js");
    const { designSystems } = await import("../db/schema.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(designSystems).orderBy(desc(designSystems.isDefault), designSystems.createdAt);
  });

export const createDesignSystem = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; content: string }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designSystems } = await import("../db/schema.js");
    const now = new Date();
    const [row] = await db.insert(designSystems).values({
      name: data.name.trim(), content: data.content.trim(), isDefault: false, createdAt: now, updatedAt: now,
    }).returning({ id: designSystems.id });
    return row;
  });

export const updateDesignSystem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; name?: string; content?: string; isDefault?: boolean }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designSystems } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    if (data.isDefault) {
      await db.update(designSystems).set({ isDefault: false, updatedAt: new Date() });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.content !== undefined) patch.content = data.content.trim();
    if (data.isDefault !== undefined) patch.isDefault = data.isDefault;
    await db.update(designSystems).set(patch as any).where(eq(designSystems.id, data.id));
    return { ok: true };
  });

export const deleteDesignSystem = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { designSystems } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(designSystems).where(eq(designSystems.id, data.id));
    return { ok: true };
  });


// ── Distribution Playbooks (global templates) ─────────────────────────────────

export const getDistributionPlaybooks = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db } = await import("../db/index.js");
    const { distributionPlaybooks } = await import("../db/schema.js");
    const { asc } = await import("drizzle-orm");
    return db.select().from(distributionPlaybooks).orderBy(asc(distributionPlaybooks.sortOrder));
  });

export const updateDistributionPlaybook = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; name?: string; description?: string; whyItWorks?: string; checklistTemplate?: string[] }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { distributionPlaybooks } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.whyItWorks !== undefined) patch.whyItWorks = data.whyItWorks;
    if (data.checklistTemplate !== undefined) patch.checklistTemplate = JSON.stringify(data.checklistTemplate);
    await db.update(distributionPlaybooks).set(patch as any).where(eq(distributionPlaybooks.id, data.id));
    return { ok: true };
  });

// ── Project Playbook Instances ────────────────────────────────────────────────

export const getProjectPlaybookInstances = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { distributionPlaybooks, projectPlaybookInstances } = await import("../db/schema.js");
    const { eq, asc } = await import("drizzle-orm");
    const playbooks = await db.select().from(distributionPlaybooks).orderBy(asc(distributionPlaybooks.sortOrder));
    const instances = await db.select().from(projectPlaybookInstances)
      .where(eq(projectPlaybookInstances.productId, data.productId));
    const instanceMap = Object.fromEntries(instances.map(i => [i.playbookId, i]));
    // auto-create missing instances
    const now = new Date();
    for (const p of playbooks) {
      if (!instanceMap[p.id]) {
        const [row] = await db.insert(projectPlaybookInstances).values({
          productId: data.productId, playbookId: p.id,
          isActive: true, status: "not_started",
          checklistProgress: "[]", config: "{}", sortOrder: p.sortOrder, createdAt: now, updatedAt: now,
        }).returning();
        instanceMap[p.id] = row;
      }
    }
    const rows = playbooks.map(p => ({ playbook: p, instance: instanceMap[p.id] }));
    // sort active rows by instance sort_order; inactive by playbook sort_order
    rows.sort((a, b) => {
      if (a.instance.isActive && !b.instance.isActive) return -1;
      if (!a.instance.isActive && b.instance.isActive) return 1;
      if (a.instance.isActive && b.instance.isActive) return a.instance.sortOrder - b.instance.sortOrder;
      return a.playbook.sortOrder - b.playbook.sortOrder;
    });
    return rows;
  });

export const updateProjectPlaybookInstance = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; isActive?: boolean; status?: string; checklistProgress?: boolean[]; notes?: string; config?: Record<string, unknown>; sortOrder?: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectPlaybookInstances } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.status !== undefined) patch.status = data.status;
    if (data.checklistProgress !== undefined) patch.checklistProgress = JSON.stringify(data.checklistProgress);
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.config !== undefined) patch.config = JSON.stringify(data.config);
    if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
    await db.update(projectPlaybookInstances).set(patch as any).where(eq(projectPlaybookInstances.id, data.id));
    return { ok: true };
  });

// ── AI cost stats ─────────────────────────────────────────────────────────────

export interface AiCostStats {
  last7DaysUsd: number;
  last30DaysUsd: number;
  byModel: { model: string; totalUsd: number; calls: number; promptTokens: number; completionTokens: number }[];
  recentEntries: { id: number; model: string; callType: string; costUsd: number; promptTokens: number; completionTokens: number; promptText: string | null; responseText: string | null; createdAt: Date }[];
}

export const getAiCostStats = createServerFn({ method: "GET" })
  .handler(async (): Promise<AiCostStats> => {
    const { db } = await import("../db/index.js");
    const { aiCostEntries } = await import("../db/schema.js");
    const { gte, desc, sql } = await import("drizzle-orm");

    const now = new Date();
    const ago7 = new Date(now.getTime() - 7 * 86400000);
    const ago30 = new Date(now.getTime() - 30 * 86400000);

    const [all7, all30, byModel, recent] = await Promise.all([
      db.select({ total: sql<number>`sum(cost_usd)` }).from(aiCostEntries).where(gte(aiCostEntries.createdAt, ago7)),
      db.select({ total: sql<number>`sum(cost_usd)` }).from(aiCostEntries).where(gte(aiCostEntries.createdAt, ago30)),
      db.select({
        model: aiCostEntries.model,
        totalUsd: sql<number>`sum(cost_usd)`,
        calls: sql<number>`count(*)`,
        promptTokens: sql<number>`sum(prompt_tokens)`,
        completionTokens: sql<number>`sum(completion_tokens)`,
      }).from(aiCostEntries).where(gte(aiCostEntries.createdAt, ago30))
        .groupBy(aiCostEntries.model)
        .orderBy(sql`sum(cost_usd) desc`),
      db.select().from(aiCostEntries).orderBy(desc(aiCostEntries.createdAt)).limit(50),
    ]);

    return {
      last7DaysUsd: Number(all7[0]?.total ?? 0),
      last30DaysUsd: Number(all30[0]?.total ?? 0),
      byModel: byModel.map(r => ({
        model: r.model,
        totalUsd: Number(r.totalUsd ?? 0),
        calls: Number(r.calls ?? 0),
        promptTokens: Number(r.promptTokens ?? 0),
        completionTokens: Number(r.completionTokens ?? 0),
      })),
      recentEntries: recent.map(r => ({
        id: r.id,
        model: r.model,
        callType: r.callType,
        costUsd: r.costUsd,
        promptTokens: r.promptTokens,
        completionTokens: r.completionTokens,
        promptText: r.promptText ?? null,
        responseText: r.responseText ?? null,
        createdAt: r.createdAt,
      })),
    };
  });

// ── Gap Analysis ──────────────────────────────────────────────────────────────

export const analyzeProjectGaps = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<{ created: number }> => {
    const { db, projects, products, signals, opportunities } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    // 1. Load product (for domain) + its idea (for context + signals/opps)
    const [product] = await db.select().from(products).where(eq(products.id, data.productId));
    if (!product || !product.domain) throw new Error("Product not found or has no domain");
    const [project] = await db.select().from(projects).where(eq(projects.id, product.ideaId));
    if (!project) throw new Error("Idea not found for product");
    const ideaId = product.ideaId;

    // 2. Crawl the domain landing page
    let crawledText = "";
    try {
      const res = await fetch(`https://${product.domain}`, {
        headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const html = await res.text();
        crawledText = html
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 3000);
      }
    } catch {
      crawledText = "(Could not fetch landing page)";
    }

    // 3. Load last 20 signals for the project
    const recentSignals = await db
      .select({ title: signals.category, summary: signals.rawText })
      .from(signals)
      .where(eq(signals.projectId, ideaId))
      .orderBy(desc(signals.scrapedAt))
      .limit(20);

    // 4. Load existing opportunity titles to avoid duplicates
    const existingOpps = await db
      .select({ title: opportunities.title })
      .from(opportunities)
      .where(eq(opportunities.projectId, ideaId));
    const existingTitles = existingOpps.map((o) => o.title);

    // 5. Build the AI prompt
    const signalLines = recentSignals
      .map((s) => `- ${s.title}: ${s.summary.slice(0, 150)}`)
      .join("\n");
    const existingLines = existingTitles.join("\n");

    const prompt = `You are analysing a live SaaS product to find gap opportunities.

PRODUCT:
Name: ${project.name}
Domain: ${product.domain}
Description: ${project.description ?? "(none)"}
Hypothesis: ${project.hypothesis ?? "(none)"}

WHAT THE PRODUCT CURRENTLY DOES (from landing page):
${crawledText || "(no content fetched)"}

RECENT MARKET SIGNALS (pain points users are expressing):
${signalLines || "(no signals yet)"}

EXISTING OPPORTUNITIES (avoid duplicates):
${existingLines || "(none)"}

Generate 6 specific gap opportunities - things this product could add or pivot to based on the signals and what's missing from the current product. Each gap should be:
- A specific, buildable feature or expansion
- Grounded in a real signal from the list above
- Different from what the product already does

Return JSON array:
[
  {
    "title": "Short feature/opportunity name",
    "painSummary": "One sentence: what user pain this addresses and why now",
    "sector": "saas",
    "community": "gap_analysis",
    "scoreTotal": 7.5
  }
]
Only return the JSON array, nothing else.`;

    // 6. Call OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "BurningDemand",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2000,
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => "");
      throw new Error(`OpenRouter error ${aiRes.status}: ${errText}`);
    }

    const aiJson = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
    const rawContent = aiJson.choices[0]?.message?.content ?? "[]";

    // 7. Parse AI response
    let gaps: Array<{
      title: string;
      painSummary: string;
      sector?: string;
      community?: string;
      scoreTotal?: number;
    }> = [];

    try {
      // Strip markdown fences if present
      const cleaned = rawContent
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start !== -1 && end !== -1) {
        gaps = JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch {
      console.error("[analyzeProjectGaps] Failed to parse AI response:", rawContent);
    }

    if (!Array.isArray(gaps) || gaps.length === 0) {
      return { created: 0 };
    }

    // 8. Deduplicate against existing titles (case-insensitive)
    const existingLower = new Set(existingTitles.map((t) => t.toLowerCase()));
    const newGaps = gaps.filter(
      (g) => g.title && !existingLower.has(g.title.toLowerCase())
    );

    // 9. Insert opportunity records
    const now = new Date();
    for (const gap of newGaps) {
      await db.insert(opportunities).values({
        projectId: ideaId,
        title: gap.title,
        painSummary: gap.painSummary ?? gap.title,
        sector: gap.sector ?? "saas",
        community: "gap_analysis",
        communityUrl: `https://${product.domain}`,
        scoreTotal: gap.scoreTotal ?? 7,
        scoresJson: {
          pain_urgency: 7,
          willingness_to_pay: 7,
          distribution_ready: 6,
          build_simplicity: 7,
          timing_signal: 7,
          pricing_ceiling: 6,
        } as any,
        briefMd: gap.painSummary ?? gap.title,
        status: "new",
        pass: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { created: newGaps.length };
  });

// ── Domain Tools ─────────────────────────────────────────────────────────────

export const generateDomainIdeas = createServerFn({ method: "POST" })
  .inputValidator((d: { topic: string }) => d)
  .handler(async ({ data }): Promise<string[]> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    const prompt = `Generate 20 creative, available-sounding .com domain names for a SaaS product about: "${data.topic}"

Rules:
- Only .com domains
- Max 3 words combined, ideally 1-2
- No hyphens
- Memorable, brandable, not generic
- Mix: compound words, portmanteau, verbs, made-up words
- Return ONLY a JSON array of strings like: ["example", "anothertool", ...] (without .com)
- No explanations, just the JSON array`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "BurningDemand",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter error ${res.status}: ${errText}`);
    }

    const json = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = json.choices[0]?.message?.content ?? "[]";

    try {
      const cleaned = raw
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end === -1) return [];
      const names: string[] = JSON.parse(cleaned.slice(start, end + 1));
      return names
        .filter((n) => typeof n === "string" && n.length > 0)
        .map((n) => n.replace(/\.com$/i, "").toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter((n) => n.length > 0)
        .slice(0, 20)
        .map((n) => `${n}.com`);
    } catch {
      return [];
    }
  });

export type DomainAvailabilityResult = {
  domain: string;
  available: boolean;
  price: string | null;
  isPremium: boolean;
  unknown?: boolean;
};

export const checkDomainAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: { domains: string[] }) => d)
  .handler(async ({ data }): Promise<DomainAvailabilityResult[]> => {
    const results = await Promise.allSettled(
      data.domains.map(async (domain): Promise<DomainAvailabilityResult> => {
        try {
          const res = await fetch(`https://rdap.org/domain/${domain}`, {
            signal: AbortSignal.timeout(4000),
            headers: { "Accept": "application/json" },
          });
          if (res.status === 404) {
            return { domain, available: true, price: "$12.98", isPremium: false };
          }
          if (res.ok) {
            return { domain, available: false, price: null, isPremium: false };
          }
          // other HTTP errors - unknown
          return { domain, available: false, price: null, isPremium: false, unknown: true };
        } catch {
          return { domain, available: false, price: null, isPremium: false, unknown: true };
        }
      })
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { domain: data.domains[i], available: false, price: null, isPremium: false, unknown: true };
    });
  });

export const saveDomainSearch = createServerFn({ method: "POST" })
  .inputValidator((d: { query: string; resultsJson: import("../db/schema.js").DomainResult[] }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, domainSearches } = await import("../db/index.js");
    const [row] = await db
      .insert(domainSearches)
      .values({
        query: data.query,
        resultsJson: data.resultsJson,
      })
      .returning({ id: domainSearches.id });
    return { id: row.id };
  });

export const getDomainSearches = createServerFn({ method: "GET" })
  .handler(async (): Promise<import("../db/schema.js").DomainSearch[]> => {
    const { db, domainSearches } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(domainSearches).orderBy(desc(domainSearches.createdAt));
  });

export const updateProjectScanSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: { projectId: number; schedule: "manual" | "daily" | "weekly" }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { db, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    let scanNextRunAt: Date | null = null;
    if (data.schedule !== "manual") {
      const intervalMs = data.schedule === "daily" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
      scanNextRunAt = new Date(Date.now() + intervalMs);
    }

    await db.update(projects).set({ scanSchedule: data.schedule, scanNextRunAt }).where(eq(projects.id, data.projectId));

    return { ok: true };
  });

// ── Deep Scan ─────────────────────────────────────────────────────────────────

export const triggerDeepScan = createServerFn({ method: "POST" })
  .inputValidator((d: { channelId: number; lookbackDays?: number }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { db, channels } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    // Mark as running
    await db.update(channels)
      .set({ deepScanStatus: "running", deepScanProgress: 0 })
      .where(eq(channels.id, data.channelId));

    // Fire-and-forget: kick off the actual scan in the background via internal API
    const lookbackDays = data.lookbackDays ?? 365;
    // The actual work is done by POST /api/deep-scan (Vite plugin, runs server-side)
    fetch(`http://localhost:${process.env.PORT ?? 3000}/api/deep-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: data.channelId, lookbackDays }),
    }).catch(() => {
      // Ignore - the Vite plugin will handle errors and set status to "failed"
    });

    return { ok: true };
  });

export const getChannelProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { channelId: number }) => d)
  .handler(async ({ data }) => {
    const { db, channelProfiles, channels } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    const [profile] = await db
      .select()
      .from(channelProfiles)
      .where(eq(channelProfiles.channelId, data.channelId))
      .orderBy(desc(channelProfiles.createdAt))
      .limit(1);

    if (!profile) return null;

    // Also get current channel status
    const [channel] = await db
      .select({
        deepScanStatus: channels.deepScanStatus,
        deepScanProgress: channels.deepScanProgress,
        lastDeepScanAt: channels.lastDeepScanAt,
      })
      .from(channels)
      .where(eq(channels.id, data.channelId));

    return { profile, channel: channel ?? null };
  });

export const getChannelScanStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { channelId: number }) => d)
  .handler(async ({ data }) => {
    const { db, channels } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [channel] = await db
      .select({
        deepScanStatus: channels.deepScanStatus,
        deepScanProgress: channels.deepScanProgress,
        lastDeepScanAt: channels.lastDeepScanAt,
      })
      .from(channels)
      .where(eq(channels.id, data.channelId));

    return channel ?? null;
  });

// ── Signal Quality Scoring ────────────────────────────────────────────────────

export type SignalQualityResult = {
  authenticityScore: number;
  posterIntent: "buyer" | "seller" | "unclear";
  intentSignals: string[];
};

export const scoreSignalQuality = createServerFn({ method: "POST" })
  .inputValidator((d: { signalId: number }) => d)
  .handler(async ({ data }): Promise<SignalQualityResult> => {
    const { db, signals } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [signal] = await db.select().from(signals).where(eq(signals.id, data.signalId));
    if (!signal) throw new Error(`Signal ${data.signalId} not found`);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

    const prompt = `You are a signal quality analyst for a market research tool. Your job is to determine whether a forum post represents a GENUINE BUYER experiencing real pain, or a SELLER/BUILDER doing market research.

Analyze this post:
---
${signal.rawText.slice(0, 2000)}
---

BUYER signals (high authenticity 7-10):
- Names specific tools they tried and why they failed
- Quantifies cost: time lost, money spent, frustration with numbers
- Has tried workarounds or alternatives
- Professional context with specifics ("as a DevOps engineer at a 50-person company")
- Asks for recommendations, not opinions
- Uses phrases like "anyone else", "same here" suggesting shared pain
- No mention of building or creating a product

SELLER signals (low authenticity 1-4):
- "I would pay X for Y" - this is ALMOST ALWAYS market research, score 1-3
- "Does anyone else struggle with X?" - fishing for validation
- "I just discovered I need X" - testing market
- "What would you pay for a tool that..."
- Abstract pain with no specifics, no tools named, no cost quantified
- "I'm building X, would you use it?"
- Cross-posted feel - generic, not community-specific
- No tools mentioned, no actual cost quantified

IMPORTANT RULE: "I would pay X" is almost always a SELLER/BUILDER doing market research, NOT a buyer. Score it 1-3.

Return ONLY valid JSON (no markdown fences, no explanation):
{
  "authenticityScore": <integer 1-10>,
  "posterIntent": <"buyer" | "seller" | "unclear">,
  "intentSignals": [<up to 4 specific reasons from the text>]
}`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "BurningDemand",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-3.1-flash-lite-preview",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`OpenRouter error ${res.status}: ${errText}`);
    }

    const json = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = json.choices[0]?.message?.content ?? "{}";

    let parsed: SignalQualityResult;
    try {
      const cleaned = raw
        .replace(/```(?:json)?\s*/gi, "")
        .replace(/```/g, "")
        .trim();
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object found");
      const obj = JSON.parse(cleaned.slice(start, end + 1));

      const score = Math.max(1, Math.min(10, Math.round(Number(obj.authenticityScore))));
      const intent = ["buyer", "seller", "unclear"].includes(obj.posterIntent) ? obj.posterIntent : "unclear";
      const intentSignalsList = Array.isArray(obj.intentSignals)
        ? (obj.intentSignals as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 4)
        : [];

      parsed = {
        authenticityScore: score,
        posterIntent: intent as "buyer" | "seller" | "unclear",
        intentSignals: intentSignalsList,
      };
    } catch {
      parsed = { authenticityScore: 5, posterIntent: "unclear", intentSignals: ["Failed to parse AI response"] };
    }

    await db.update(signals)
      .set({
        authenticityScore: parsed.authenticityScore,
        posterIntent: parsed.posterIntent,
        intentSignals: parsed.intentSignals,
      })
      .where(eq(signals.id, data.signalId));

    return parsed;
  });

export const scoreAllUnscoredSignals = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ processed: number; errors: number }> => {
    const { db, signals } = await import("../db/index.js");
    const { isNull } = await import("drizzle-orm");

    const unscored = await db
      .select({ id: signals.id })
      .from(signals)
      .where(isNull(signals.authenticityScore))
      .limit(500);

    let processed = 0;
    let errors = 0;
    const batchSize = 20;

    for (let i = 0; i < unscored.length; i += batchSize) {
      const batch = unscored.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(({ id }) => scoreSignalQuality({ data: { signalId: id } }))
      );
      for (const r of results) {
        if (r.status === "fulfilled") processed++;
        else errors++;
      }
    }

    return { processed, errors };
  });

export type SignalWithQuality = {
  id: number;
  source: string;
  rawText: string;
  url: string;
  scrapedAt: Date;
  postedAt: Date | null;
  projectId: number | null;
  projectName: string | null;
  authenticityScore: number | null;
  posterIntent: "buyer" | "seller" | "unclear" | null;
  intentSignals: string[] | null;
};

export const getSignalsWithQuality = createServerFn({ method: "POST" })
  .inputValidator((d: {
    projectId?: number;
    minAuthenticityScore?: number;
    posterIntent?: "buyer" | "seller" | "unclear";
    limit?: number;
  }) => d)
  .handler(async ({ data }): Promise<SignalWithQuality[]> => {
    const { db } = await import("../db/index.js");
    const schema = await import("../db/schema.js");
    const { eq, gte, and, desc } = await import("drizzle-orm");

    type SqlCondition = ReturnType<typeof eq>;
    const conditions: SqlCondition[] = [];

    if (data.projectId !== undefined) {
      conditions.push(eq(schema.signals.projectId, data.projectId));
    }
    if (data.minAuthenticityScore !== undefined) {
      conditions.push(gte(schema.signals.authenticityScore, data.minAuthenticityScore) as SqlCondition);
    }
    if (data.posterIntent !== undefined) {
      conditions.push(eq(schema.signals.posterIntent, data.posterIntent));
    }

    const rows = await db
      .select({
        id: schema.signals.id,
        source: schema.signals.source,
        rawText: schema.signals.rawText,
        url: schema.signals.url,
        scrapedAt: schema.signals.scrapedAt,
        postedAt: schema.signals.postedAt,
        projectId: schema.signals.projectId,
        projectName: schema.projects.name,
        authenticityScore: schema.signals.authenticityScore,
        posterIntent: schema.signals.posterIntent,
        intentSignals: schema.signals.intentSignals,
      })
      .from(schema.signals)
      .leftJoin(schema.projects, eq(schema.projects.id, schema.signals.projectId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.signals.scrapedAt))
      .limit(data.limit ?? 2000);

    return rows.map(r => ({
      ...r,
      posterIntent: r.posterIntent as "buyer" | "seller" | "unclear" | null,
      intentSignals: r.intentSignals as string[] | null,
    }));
  });

// ── Workspace Channels ────────────────────────────────────────────────────────

export const getAllChannels = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db, channels, projects } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: channels.id,
        type: channels.type,
        mode: channels.mode,
        config: channels.config,
        status: channels.status,
        deepScanStatus: channels.deepScanStatus,
        lastDeepScanAt: channels.lastDeepScanAt,
        lastRunAt: channels.lastRunAt,
        createdAt: channels.createdAt,
        projectId: channels.projectId,
        projectName: projects.name,
      })
      .from(channels)
      .leftJoin(projects, eq(projects.id, channels.projectId))
      .orderBy(desc(channels.createdAt));
    return rows;
  });

// ── Ideas ─────────────────────────────────────────────────────────────────────

import type { Idea, IdeaAnalysisData } from "../db/schema.js";
export type { Idea, IdeaAnalysisData };

export const createIdea = createServerFn({ method: "POST" })
  .inputValidator((d: {
    name: string;
    hypothesis?: string;
    directionType?: string;
    painClusterId?: number;
    lookbackDays?: number;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, ideas } = await import("../db/index.js");
    const [row] = await db.insert(ideas).values({
      name: data.name,
      hypothesis: data.hypothesis,
      directionType: data.directionType,
      painClusterId: data.painClusterId,
      lookbackDays: data.lookbackDays ?? 90,
      status: "setup",
    }).returning({ id: ideas.id });
    return { id: row.id };
  });

export const updateIdea = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id: number;
    name?: string;
    hypothesis?: string;
    directionType?: string;
    status?: "setup" | "communities" | "analyzing" | "ready" | "killed" | "promoted";
    selectedCommunities?: string[];
    lookbackDays?: number;
    analysisJson?: IdeaAnalysisData;
    projectId?: number;
  }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, ideas } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const { id, ...fields } = data;
    await db.update(ideas).set({ ...fields, updatedAt: new Date() }).where(eq(ideas.id, id));
  });

export const getIdeas = createServerFn({ method: "GET" })
  .handler(async (): Promise<Idea[]> => {
    const { db, ideas } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(ideas).orderBy(desc(ideas.createdAt));
  });

export const getIdea = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<Idea | null> => {
    const { db, ideas } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(ideas).where(eq(ideas.id, data.id));
    return rows[0] ?? null;
  });

export const deleteIdea = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, ideas } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(ideas).where(eq(ideas.id, data.id));
  });

export const analyzeIdea = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<IdeaAnalysisData> => {
    const schema = await import("../db/index.js");
    const { db, ideas, signals, painClusters, channelProfiles, channels } = schema;
    const { eq, inArray, desc, and } = await import("drizzle-orm");
    const OpenAI = (await import("openai")).default;
    const { trackCost } = await import("./cost-tracker.js");

    const rows = await db.select().from(ideas).where(eq(ideas.id, data.id));
    const idea = rows[0];
    if (!idea) throw new Error("Idea not found");

    const communities = idea.selectedCommunities ?? [];

    // Mark as analyzing
    await db.update(ideas).set({ status: "analyzing", updatedAt: new Date() }).where(eq(ideas.id, data.id));

    // Load signals per community
    const communitySignals: Record<string, Array<{ rawText: string; authenticityScore: number | null; posterIntent: string | null; intentSignals: string[] | null }>> = {};

    for (const subreddit of communities) {
      const communityRows = await db.select({
        rawText: signals.rawText,
        authenticityScore: signals.authenticityScore,
        posterIntent: signals.posterIntent,
        intentSignals: signals.intentSignals,
      })
        .from(signals)
        .where(eq(signals.source, "reddit"))
        .orderBy(desc(signals.authenticityScore))
        .limit(40);

      // Filter roughly by community name appearing in text or url (best-effort without a community column)
      const filtered = communityRows
        .filter(r => r.rawText.toLowerCase().includes(subreddit.toLowerCase()) || Math.random() < 0.3)
        .slice(0, 20);

      communitySignals[subreddit] = filtered;
    }

    // Load pain cluster signals if set
    let clusterSignalTexts: string[] = [];
    if (idea.painClusterId) {
      const cluster = await db.select().from(painClusters).where(eq(painClusters.id, idea.painClusterId));
      if (cluster[0]?.signalIds && cluster[0].signalIds.length > 0) {
        const clusterSigs = await db.select({ rawText: signals.rawText })
          .from(signals)
          .where(inArray(signals.id, cluster[0].signalIds.slice(0, 20)));
        clusterSignalTexts = clusterSigs.map(s => s.rawText);
      }
    }

    // Load channel profiles for communities
    const profileRows = await db.select({
      subreddit: channelProfiles.subreddit,
      profileJson: channelProfiles.profileJson,
    })
      .from(channelProfiles)
      .where(
        communities.length > 0
          ? inArray(channelProfiles.subreddit, communities)
          : eq(channelProfiles.id, -1)
      );

    const profileMap: Record<string, typeof profileRows[0]["profileJson"]> = {};
    for (const p of profileRows) {
      if (p.subreddit) profileMap[p.subreddit] = p.profileJson;
    }

    // Build prompt
    const communitySection = communities.map(sub => {
      const sigs = communitySignals[sub] ?? [];
      const buyerSigs = sigs.filter(s => s.posterIntent === "buyer").slice(0, 10);
      const otherSigs = sigs.filter(s => s.posterIntent !== "buyer").slice(0, 10);
      const allSigs = [...buyerSigs, ...otherSigs].slice(0, 20);
      return `
r/${sub}:
${allSigs.map((s, i) => `  ${i + 1}. [auth:${s.authenticityScore ?? "?"}] [intent:${s.posterIntent ?? "?"}] ${s.rawText.slice(0, 200)}`).join("\n")}`;
    }).join("\n\n");

    const profileSection = Object.entries(profileMap).map(([sub, p]) => `
r/${sub} channel profile:
  - Openness score: ${p.opennessScore}/10
  - Distribution playbook: ${p.distributionPlaybook}
  - What gets traction: ${p.whatGetsTraction}
`).join("\n");

    const clusterSection = clusterSignalTexts.length > 0
      ? `\nPAIN CLUSTER SIGNALS:\n${clusterSignalTexts.map((t, i) => `  ${i + 1}. ${t.slice(0, 200)}`).join("\n")}`
      : "";

    const prompt = `You are evaluating a product idea based on real community signals.

IDEA: ${idea.hypothesis ?? idea.name}
LOOKBACK: ${idea.lookbackDays} days

COMMUNITY SIGNALS:
${communitySection}
${clusterSection}

CHANNEL PROFILES (if available):
${profileSection || "No channel profiles available."}

Evaluate this idea and return JSON matching this exact TypeScript type:
{
  verdict: "go" | "maybe" | "kill",
  verdictReason: string,
  confidence: number, // 1-10
  topOpportunity: string,
  userPersona: string,
  distributionStrategy: string,
  messagingThatWorks: string,
  messagingToAvoid: string,
  estimatedMrrRange: string,
  buildComplexity: "low" | "medium" | "high",
  timeToFirstRevenue: string,
  communityInsights: Array<{
    subreddit: string,
    urgencyScore: number, // 1-10
    painScore: number, // 1-10
    purchaseIntentScore: number, // 1-10
    topInsights: string[]
  }>
}

Be honest about verdict. Return "kill" if pain is weak or market is saturated. Return "go" only if you see strong buyer signals AND a clear distribution path. Return "maybe" for uncertain cases.
Penalize heavily if signals look like market research (builders asking "would you pay for this?").
Return only valid JSON, no markdown.`;

    let analysisJson: IdeaAnalysisData;
    try {
      const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
      });
      const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";
      const resp = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });
      if (resp.usage) {
        trackCost(model, resp.usage.prompt_tokens, resp.usage.completion_tokens, "idea-analysis", resp.id, prompt, resp.choices[0].message.content ?? undefined);
      }
      const raw = resp.choices[0].message.content || "{}";
      // Strip markdown fences if present
      const jsonStr = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? raw.trim();
      analysisJson = JSON.parse(jsonStr) as IdeaAnalysisData;
    } catch (err) {
      console.error("analyzeIdea AI error:", err);
      // Fallback so we don't get stuck in "analyzing"
      analysisJson = {
        verdict: "maybe",
        verdictReason: "Analysis failed - insufficient signal data or AI error.",
        confidence: 1,
        topOpportunity: idea.hypothesis ?? idea.name,
        userPersona: "Unknown",
        distributionStrategy: "Manual research required",
        messagingThatWorks: "",
        messagingToAvoid: "",
        estimatedMrrRange: "Unknown",
        buildComplexity: "medium",
        timeToFirstRevenue: "Unknown",
        communityInsights: communities.map(sub => ({
          subreddit: sub,
          urgencyScore: 0,
          painScore: 0,
          purchaseIntentScore: 0,
          topInsights: [],
        })),
      };
    }

    await db.update(ideas).set({
      analysisJson,
      status: "ready",
      updatedAt: new Date(),
    }).where(eq(ideas.id, data.id));

    return analysisJson;
  });

export const promoteIdeaToProject = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<{ projectId: number }> => {
    const { db, ideas, projects, channels, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const rows = await db.select().from(ideas).where(eq(ideas.id, data.id));
    const idea = rows[0];
    if (!idea) throw new Error("Idea not found");

    // Create project
    const [proj] = await db.insert(projects).values({
      name: idea.name,
      hypothesis: idea.hypothesis ?? undefined,
    }).returning({ id: projects.id });

    // Create reddit channels for selected communities
    if (idea.selectedCommunities && idea.selectedCommunities.length > 0) {
      for (const sub of idea.selectedCommunities) {
        await db.insert(channels).values({
          projectId: proj.id,
          type: "reddit",
          mode: "discovery",
          config: { keywords: [], subreddits: [sub] },
          status: "active",
        });
      }
    }

    // Update idea
    await db.update(ideas).set({
      status: "promoted",
      projectId: proj.id,
      updatedAt: new Date(),
    }).where(eq(ideas.id, data.id));

    // Link the opportunity created during Brief generation to this project
    const oppId = (idea.analysisJson as any)?.opportunityId;
    if (oppId) {
      await db.update(opportunities).set({
        projectId: proj.id,
        status: "building",
      } as any).where(eq(opportunities.id, oppId));
    }

    return { projectId: proj.id };
  });

// ── Build full project from opportunity (scan or global opportunities page) ───
//
// Creates a project + Reddit channels, then calls generateFullOpportunityFromDescription
// to produce a rich opportunity record matching the /p/$id/opportunities quality:
// - Full scoring (pain_urgency, willingness_to_pay, buyer_quality, etc.)
// - Rich brief (competitors table, V1 features, distribution, risks)
// - Full insightsJson (mrr ranges, buyer_persona, price_anchor, v1_features, etc.)

export const buildFullProjectFromOp = createServerFn({ method: "POST" })
  .inputValidator((d: {
    title: string;
    description: string;  // rich description built client-side from all available signal data
    communities: string[];
    hypothesis?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ projectId: number; opportunityId: number }> => {
    const { db, projects, channels, opportunities } = await import("../db/index.js");
    const { generateFullOpportunityFromDescription } = await import("./ai.js");

    // 1. Create project
    const [proj] = await db.insert(projects).values({
      name: data.title,
      hypothesis: data.hypothesis ?? data.description.slice(0, 400),
    }).returning({ id: projects.id });

    // 2. Create one Reddit channel per community
    for (const sub of data.communities) {
      await db.insert(channels).values({
        projectId: proj.id,
        type: "reddit",
        mode: "discovery",
        config: { keywords: [], subreddits: [sub] },
        status: "active",
      });
    }

    // 3. Generate full opportunity (scores + rich brief) - same pipeline as /p/$id/opportunities
    const fields = await generateFullOpportunityFromDescription(data.description);

    // 4. Insert opportunity linked to project
    const [opp] = await db.insert(opportunities).values({
      projectId: proj.id,
      title: fields.title || data.title,
      painSummary: fields.painSummary || data.description.slice(0, 400),
      sector: fields.sector,
      community: data.communities[0] ? `r/${data.communities[0]}` : fields.community,
      communityUrl: data.communities[0] ? `https://reddit.com/r/${data.communities[0]}` : null,
      scoreTotal: fields.scoreTotal,
      scoresJson: fields.scoresJson,
      insightsJson: fields.insightsJson,
      briefMd: fields.briefMd,
      description: data.description,
      status: "building",
      pass: false,
      signalCount: data.communities.length,
    }).returning({ id: opportunities.id });

    return { projectId: proj.id, opportunityId: opp.id };
  });

// ── Pain Clustering ───────────────────────────────────────────────────────────

export type PainClusterResult = import("../db/schema.js").PainCluster;

export type PainClusterWithSignals = PainClusterResult & {
  signals: import("../db/schema.js").Signal[];
};

export const runPainClustering = createServerFn({ method: "POST" })
  .inputValidator((d: { projectId?: number; minAuthenticityScore?: number }) => d)
  .handler(async ({ data }): Promise<{ clustersCreated: number; clustersUpdated: number; signalsAssigned: number }> => {
    const { db, signals, painClusters } = await import("../db/index.js");
    const { and, or, gte, isNull, eq, inArray } = await import("drizzle-orm");

    const minScore = data.minAuthenticityScore ?? 6;

    // Build conditions
    type DrizzleWhere = Parameters<typeof and>[0];
    const conditions: DrizzleWhere[] = [];
    conditions.push(
      or(eq(signals.posterIntent, "buyer"), isNull(signals.posterIntent))
    );
    if (minScore > 0) {
      conditions.push(or(gte(signals.authenticityScore, minScore), isNull(signals.authenticityScore)));
    }
    if (data.projectId) {
      conditions.push(eq(signals.projectId, data.projectId));
    }

    const qualifying = await db.select().from(signals).where(and(...conditions)).limit(500);
    if (qualifying.length === 0) return { clustersCreated: 0, clustersUpdated: 0, signalsAssigned: 0 };

    const BATCH_SIZE = 50;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    const model = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-3.1-flash-lite-preview";

    type AICluster = {
      theme: string;
      description: string;
      signalIndices: number[];
      communities: string[];
      userPersona: string;
      urgencyReason: string;
      revenueSignals: string[];
    };

    const allAIClusters: { cluster: AICluster; batchSignals: typeof qualifying }[] = [];

    for (let i = 0; i < qualifying.length; i += BATCH_SIZE) {
      const batch = qualifying.slice(i, i + BATCH_SIZE);
      const signalList = batch.map((s, idx) => {
        const community = s.source === "reddit"
          ? (s.url.match(/\/r\/([^/]+)/)?.[1] ?? s.source)
          : s.source;
        return `${idx + 1}. [${community}] ${s.rawText.slice(0, 200)}`;
      }).join("\n");

      const prompt = `Here are ${batch.length} Reddit/forum signals expressing user pain. Group them into underlying pain themes.
A "theme" is the same root problem expressed in different ways across different posts.

Signals:
${signalList}

Rules:
- Create 3-8 clusters maximum
- Each cluster needs a clear one-line theme (the underlying problem, not the surface complaint)
- Only group signals that share the same ROOT cause
- Ignore duplicates from the same post
- Note which communities each cluster appears in

Return JSON array:
[{
  "theme": "one-line problem statement",
  "description": "2-3 sentence explanation of the underlying need",
  "signalIndices": [1, 5, 12, 23],
  "communities": ["webdev", "sideprojects"],
  "userPersona": "who experiences this",
  "urgencyReason": "why this is urgent for them",
  "revenueSignals": ["specific quote suggesting WTP"]
}]

Return ONLY the JSON array, no markdown fences.`;

      try {
        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "BurningDemand",
          },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 3000, temperature: 0.3 }),
        });
        if (!aiRes.ok) { console.error(`[runPainClustering] AI error ${aiRes.status}`); continue; }

        const aiJson = await aiRes.json() as { choices: Array<{ message: { content: string } }> };
        const raw = aiJson.choices[0]?.message?.content ?? "[]";
        const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");
        if (start === -1 || end === -1) continue;

        const clusters: AICluster[] = JSON.parse(cleaned.slice(start, end + 1));
        if (!Array.isArray(clusters)) continue;
        for (const c of clusters) allAIClusters.push({ cluster: c, batchSignals: batch });
      } catch (err) {
        console.error("[runPainClustering] batch error:", err);
      }
    }

    const existing = await db.select().from(painClusters);
    let clustersCreated = 0;
    let clustersUpdated = 0;
    let signalsAssigned = 0;
    const now = new Date();

    for (const { cluster, batchSignals } of allAIClusters) {
      if (!cluster.theme || !Array.isArray(cluster.signalIndices)) continue;

      const resolvedSignalIds = cluster.signalIndices
        .map((idx: number) => batchSignals[idx - 1]?.id)
        .filter((id): id is number => id !== undefined);
      if (resolvedSignalIds.length === 0) continue;

      const clusterSignals = batchSignals.filter(s => resolvedSignalIds.includes(s.id));
      const scoredSignals = clusterSignals.filter(s => s.authenticityScore != null);
      const avgScore = scoredSignals.length > 0
        ? scoredSignals.reduce((sum, s) => sum + (s.authenticityScore ?? 0), 0) / scoredSignals.length
        : 0;

      const communities = (cluster.communities?.length)
        ? cluster.communities
        : [...new Set(clusterSignals.map(s =>
          s.source === "reddit" ? (s.url.match(/\/r\/([^/]+)/)?.[1] ?? s.source) : s.source
        ))];

      const themeJson: import("../db/schema.js").PainClusterTheme = {
        title: cluster.theme,
        description: cluster.description,
        exampleQuotes: (cluster.revenueSignals ?? []).slice(0, 3),
        userPersona: cluster.userPersona ?? "",
        urgencyReason: cluster.urgencyReason ?? "",
        revenueSignals: cluster.revenueSignals ?? [],
      };

      const themeWords = new Set(cluster.theme.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3));
      const similar = existing.find(ex => {
        const exWords = ex.theme.toLowerCase().split(/\W+/).filter((w: string) => w.length > 3);
        return exWords.filter((w: string) => themeWords.has(w)).length >= 2
          || exWords.some((w: string) => cluster.theme.toLowerCase().includes(w));
      });

      if (similar) {
        const mergedIds = [...new Set([...(similar.signalIds ?? []), ...resolvedSignalIds])];
        const mergedCommunities = [...new Set([...(similar.communities ?? []), ...communities])];
        await db.update(painClusters).set({
          signalIds: mergedIds,
          signalCount: mergedIds.length,
          communities: mergedCommunities,
          avgAuthenticityScore: avgScore > 0 ? avgScore : similar.avgAuthenticityScore,
          themeJson,
          lastSeenAt: now,
          updatedAt: now,
        }).where(eq(painClusters.id, similar.id));

        similar.signalIds = mergedIds;
        similar.communities = mergedCommunities;
        similar.signalCount = mergedIds.length;

        if (resolvedSignalIds.length > 0) {
          await db.update(signals).set({ clusterId: similar.id }).where(inArray(signals.id, resolvedSignalIds));
        }
        clustersUpdated++;
        signalsAssigned += resolvedSignalIds.length;
      } else {
        const [inserted] = await db.insert(painClusters).values({
          theme: cluster.theme,
          description: cluster.description,
          communities,
          signalIds: resolvedSignalIds,
          signalCount: resolvedSignalIds.length,
          avgAuthenticityScore: avgScore,
          status: "open",
          themeJson,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        }).returning();

        if (resolvedSignalIds.length > 0) {
          await db.update(signals).set({ clusterId: inserted.id }).where(inArray(signals.id, resolvedSignalIds));
        }
        existing.push(inserted);
        clustersCreated++;
        signalsAssigned += resolvedSignalIds.length;
      }
    }

    return { clustersCreated, clustersUpdated, signalsAssigned };
  });

export const getPainClusters = createServerFn({ method: "GET" })
  .inputValidator((d: { status?: string; minSignals?: number; crossCommunityOnly?: boolean }) => d)
  .handler(async ({ data }): Promise<PainClusterResult[]> => {
    const { db, painClusters } = await import("../db/index.js");
    const { desc, sql } = await import("drizzle-orm");

    let rows = await db.select().from(painClusters).orderBy(
      sql`json_array_length(${painClusters.communities}) DESC`,
      desc(painClusters.signalCount),
      desc(painClusters.avgAuthenticityScore),
    );

    if (data.status) rows = rows.filter(r => r.status === data.status);
    if (data.minSignals) rows = rows.filter(r => r.signalCount >= (data.minSignals ?? 0));
    if (data.crossCommunityOnly) rows = rows.filter(r => (r.communities?.length ?? 0) > 1);

    return rows;
  });

// ── Three-dimension opportunity scoring ───────────────────────────────────────
// Detects: Existing Spend · Validated Pain · Recurring Workflow · Active Demand

const SPEND_RE = /\b(pay\w*|paid|subscription|licen\w+|contract|per[- ]seat|per[- ]user|annual\w*|budget|invoice|billing|cost[s]?[- ](us|me)|\$\d+[k]?\/?(mo|month|yr|year)|charged|renewal|pricing|already.{0,12}(using|paying)|salary|hire[sd]?|full[- ]time.{0,20}(job|role|position|person)|dedicated.{0,15}(person|employee|staff|role))\b/i;
const WORKFLOW_RE = /\b(every (monday|tuesday|wednesday|thursday|friday|week|month|day|quarter|morning)|weekly|monthly|daily|quarterly|each (week|month|day)|(hours?|minutes?) (a|per|every) (week|month|day)|end[- ]of[- ](month|quarter|week)|once (a|per) (week|month|day)|recurring|again and again|every time|each time|whenever i|by hand|manually|export.*import|copy.{0,5}paste|step \d|our (workflow|process)|spreadsheet)\b/i;
const DEMAND_RE = /\b(is there (a |an )?(tool|app|software|way)|looking for (a |an )?(tool|solution|software)|alternatives? to|better way to|wish (there was|i had|we had)|anyone (know|use|found|tried)|how do you (all |guys )?(handle|manage|deal with)|no good (tool|solution|way)|migrating from|switching from|would (you |anyone )?pay for|is there (an?|nothing) (better|good)\b)\b/i;

export interface ClusterDimensions {
  spendScore: number;      // 0–1: evidence of existing software/human spend
  painScore: number;       // 0–1: signal count × auth score × cross-community bonus
  workflowScore: number;   // 0–1: recurring / time-based workflow language
  demandScore: number;     // 0–1: active search for alternatives / explicit demand
  confidenceScore: number; // harmonic mean - requires all four to be non-zero
  hitAll: boolean;         // all four dimensions above threshold
  spendSamples: string[];  // up to 2 raw text snippets with spend signals
  workflowSamples: string[]; // up to 2 raw text snippets with workflow signals
}

export type ScoredCluster = PainClusterResult & { dims: ClusterDimensions };

export const getScoredClusters = createServerFn({ method: "GET" })
  .handler(async (): Promise<ScoredCluster[]> => {
    const { db, painClusters, signals } = await import("../db/index.js");
    const { desc, inArray, sql } = await import("drizzle-orm");

    const clusters = await db.select().from(painClusters).orderBy(
      sql`json_array_length(${painClusters.communities}) DESC`,
      desc(painClusters.signalCount),
    );
    if (clusters.length === 0) return [];

    // One query for all signal data across all clusters
    const allIds = [...new Set(clusters.flatMap(c => c.signalIds ?? []))];
    const sigRows = allIds.length > 0
      ? await db.select({
        id: signals.id,
        rawText: signals.rawText,
        posterIntent: signals.posterIntent,
        recurring: signals.recurring,
        authenticityScore: signals.authenticityScore,
      }).from(signals).where(inArray(signals.id, allIds))
      : [];
    const sigMap = new Map(sigRows.map(s => [s.id, s]));

    const scored = clusters.map((cluster): ScoredCluster => {
      const sigs = (cluster.signalIds ?? []).map(id => sigMap.get(id)).filter(Boolean) as typeof sigRows;
      const n = sigs.length;

      if (n === 0) {
        const dims: ClusterDimensions = {
          spendScore: 0, painScore: 0, workflowScore: 0, demandScore: 0,
          confidenceScore: 0, hitAll: false, spendSamples: [], workflowSamples: [],
        };
        return { ...cluster, dims };
      }

      let spendHits = 0, workflowHits = 0, demandHits = 0, buyerCount = 0;
      const spendSamples: string[] = [], workflowSamples: string[] = [];

      for (const s of sigs) {
        const t = s.rawText ?? "";
        if (SPEND_RE.test(t)) {
          spendHits++;
          if (spendSamples.length < 2) spendSamples.push(t.slice(0, 140).replace(/\n/g, " ").trim());
        }
        if (WORKFLOW_RE.test(t)) {
          workflowHits++;
          if (workflowSamples.length < 2) workflowSamples.push(t.slice(0, 140).replace(/\n/g, " ").trim());
        }
        if (DEMAND_RE.test(t)) demandHits++;
        if (s.posterIntent === "buyer") buyerCount++;
      }

      const spendScore = Math.min(1, (spendHits / n) * 1.8 + (buyerCount / n) * 0.6);
      const workflowScore = Math.min(1, (workflowHits / n) * 1.5);
      const demandScore = Math.min(1, (demandHits / n) * 2.0);
      const painScore = Math.min(1,
        ((cluster.avgAuthenticityScore ?? 0) / 10) * 0.5 +
        (Math.min(cluster.signalCount, 20) / 20) * 0.3 +
        ((cluster.communities?.length ?? 1) > 1 ? 0.2 : 0),
      );

      // Harmonic mean: rewards clusters that hit every dimension, penalises gaps
      const parts = [spendScore, painScore, workflowScore, demandScore];
      const confidenceScore = parts.every(p => p > 0)
        ? parts.length / parts.reduce((sum, p) => sum + 1 / (p + 0.001), 0)
        : 0;

      const dims: ClusterDimensions = {
        spendScore, painScore, workflowScore, demandScore,
        confidenceScore,
        hitAll: spendScore >= 0.25 && painScore >= 0.35 && workflowScore >= 0.25 && demandScore >= 0.25,
        spendSamples,
        workflowSamples,
      };
      return { ...cluster, dims };
    });

    return scored.sort((a, b) => b.dims.confidenceScore - a.dims.confidenceScore);
  });

// ── Unified Opportunities ─────────────────────────────────────────────────────

export type OpStatus = "signal" | "analyzing" | "ready" | "building" | "dead";

export interface UnifiedOp {
  key: string;
  status: OpStatus;
  title: string;
  description: string;
  communities: string[];
  signalCount: number;
  dims: ClusterDimensions | null;
  clusterId: number | null;
  ideaId: number | null;
  verdict: "go" | "maybe" | "kill" | null;
  confidence: number | null;
  mrrEstimate: string | null;
  analysisJson: IdeaAnalysisData | null;
  projectId: number | null;
  confidenceScore: number;
  createdAt: Date;
}

function ideaStatusToOpStatus(status: string): OpStatus {
  if (status === "setup" || status === "communities" || status === "analyzing") return "analyzing";
  if (status === "ready") return "ready";
  if (status === "promoted") return "building";
  if (status === "killed") return "dead";
  return "analyzing";
}

export const getUnifiedOpportunities = createServerFn({ method: "GET" })
  .handler(async (): Promise<UnifiedOp[]> => {
    const { db, painClusters, ideas, signals } = await import("../db/index.js");
    const { desc, inArray, sql } = await import("drizzle-orm");

    // --- Fetch clusters (same query as getScoredClusters) ---
    const clusters = await db.select().from(painClusters).orderBy(
      sql`json_array_length(${painClusters.communities}) DESC`,
      desc(painClusters.signalCount),
    );

    let scoredClusters: ScoredCluster[] = [];
    if (clusters.length > 0) {
      const allIds = [...new Set(clusters.flatMap(c => c.signalIds ?? []))];
      const sigRows = allIds.length > 0
        ? await db.select({
          id: signals.id,
          rawText: signals.rawText,
          posterIntent: signals.posterIntent,
          recurring: signals.recurring,
          authenticityScore: signals.authenticityScore,
        }).from(signals).where(inArray(signals.id, allIds))
        : [];
      const sigMap = new Map(sigRows.map(s => [s.id, s]));

      scoredClusters = clusters.map((cluster): ScoredCluster => {
        const sigs = (cluster.signalIds ?? []).map(id => sigMap.get(id)).filter(Boolean) as typeof sigRows;
        const n = sigs.length;
        if (n === 0) {
          const dims: ClusterDimensions = {
            spendScore: 0, painScore: 0, workflowScore: 0, demandScore: 0,
            confidenceScore: 0, hitAll: false, spendSamples: [], workflowSamples: [],
          };
          return { ...cluster, dims };
        }
        let spendHits = 0, workflowHits = 0, demandHits = 0, buyerCount = 0;
        const spendSamples: string[] = [], workflowSamples: string[] = [];
        for (const s of sigs) {
          const t = s.rawText ?? "";
          if (SPEND_RE.test(t)) { spendHits++; if (spendSamples.length < 2) spendSamples.push(t.slice(0, 140).replace(/\n/g, " ").trim()); }
          if (WORKFLOW_RE.test(t)) { workflowHits++; if (workflowSamples.length < 2) workflowSamples.push(t.slice(0, 140).replace(/\n/g, " ").trim()); }
          if (DEMAND_RE.test(t)) demandHits++;
          if (s.posterIntent === "buyer") buyerCount++;
        }
        const spendScore = Math.min(1, (spendHits / n) * 1.8 + (buyerCount / n) * 0.6);
        const workflowScore = Math.min(1, (workflowHits / n) * 1.5);
        const demandScore = Math.min(1, (demandHits / n) * 2.0);
        const painScore = Math.min(1,
          ((cluster.avgAuthenticityScore ?? 0) / 10) * 0.5 +
          (Math.min(cluster.signalCount, 20) / 20) * 0.3 +
          ((cluster.communities?.length ?? 1) > 1 ? 0.2 : 0),
        );
        const parts = [spendScore, painScore, workflowScore, demandScore];
        const confidenceScore = parts.every(p => p > 0)
          ? parts.length / parts.reduce((sum, p) => sum + 1 / (p + 0.001), 0)
          : 0;
        const dims: ClusterDimensions = {
          spendScore, painScore, workflowScore, demandScore, confidenceScore,
          hitAll: spendScore >= 0.25 && painScore >= 0.35 && workflowScore >= 0.25 && demandScore >= 0.25,
          spendSamples, workflowSamples,
        };
        return { ...cluster, dims };
      });
    }

    // --- Fetch all ideas ---
    const allIdeas = await db.select().from(ideas).orderBy(desc(ideas.createdAt));

    // --- Build cluster → idea map ---
    const clusterIdToIdea = new Map<number, typeof allIdeas[0]>();
    for (const idea of allIdeas) {
      if (idea.painClusterId != null) {
        // Last-write wins (ordered by desc createdAt so first is newest)
        if (!clusterIdToIdea.has(idea.painClusterId)) {
          clusterIdToIdea.set(idea.painClusterId, idea);
        }
      }
    }

    const result: UnifiedOp[] = [];

    // --- Clusters ---
    for (const cluster of scoredClusters) {
      const linkedIdea = clusterIdToIdea.get(cluster.id);
      if (linkedIdea) {
        const opStatus = ideaStatusToOpStatus(linkedIdea.status);
        result.push({
          key: `idea-${linkedIdea.id}`,
          status: opStatus,
          title: linkedIdea.name,
          description: linkedIdea.hypothesis ?? cluster.description ?? "",
          communities: linkedIdea.selectedCommunities ?? cluster.communities ?? [],
          signalCount: cluster.signalCount,
          dims: cluster.dims,
          clusterId: cluster.id,
          ideaId: linkedIdea.id,
          verdict: linkedIdea.analysisJson?.verdict ?? null,
          confidence: linkedIdea.analysisJson?.confidence ?? null,
          mrrEstimate: linkedIdea.analysisJson?.estimatedMrrRange ?? null,
          analysisJson: linkedIdea.analysisJson ?? null,
          projectId: linkedIdea.projectId ?? null,
          confidenceScore: cluster.dims.confidenceScore,
          createdAt: linkedIdea.createdAt,
        });
      } else {
        result.push({
          key: `cluster-${cluster.id}`,
          status: "signal",
          title: cluster.theme,
          description: cluster.description ?? "",
          communities: cluster.communities ?? [],
          signalCount: cluster.signalCount,
          dims: cluster.dims,
          clusterId: cluster.id,
          ideaId: null,
          verdict: null,
          confidence: null,
          mrrEstimate: null,
          analysisJson: null,
          projectId: null,
          confidenceScore: cluster.dims.confidenceScore,
          createdAt: cluster.createdAt ?? new Date(),
        });
      }
    }

    // --- Ideas with no cluster link ---
    for (const idea of allIdeas) {
      if (idea.painClusterId == null) {
        const opStatus = ideaStatusToOpStatus(idea.status);
        result.push({
          key: `idea-${idea.id}`,
          status: opStatus,
          title: idea.name,
          description: idea.hypothesis ?? "",
          communities: idea.selectedCommunities ?? [],
          signalCount: 0,
          dims: null,
          clusterId: null,
          ideaId: idea.id,
          verdict: idea.analysisJson?.verdict ?? null,
          confidence: idea.analysisJson?.confidence ?? null,
          mrrEstimate: idea.analysisJson?.estimatedMrrRange ?? null,
          analysisJson: idea.analysisJson ?? null,
          projectId: idea.projectId ?? null,
          confidenceScore: idea.analysisJson?.confidence != null ? idea.analysisJson.confidence / 10 : 0,
          createdAt: idea.createdAt,
        });
      }
    }

    // --- Sort ---
    const VERDICT_ORDER: Record<string, number> = { go: 0, maybe: 1, kill: 2 };
    const STATUS_ORDER: Record<OpStatus, number> = { ready: 0, analyzing: 1, signal: 2, building: 3, dead: 4 };

    return result.sort((a, b) => {
      const sa = STATUS_ORDER[a.status];
      const sb = STATUS_ORDER[b.status];
      if (sa !== sb) return sa - sb;
      // Within "ready", sort by verdict
      if (a.status === "ready" && b.status === "ready") {
        const va = VERDICT_ORDER[a.verdict ?? "kill"] ?? 2;
        const vb = VERDICT_ORDER[b.verdict ?? "kill"] ?? 2;
        if (va !== vb) return va - vb;
      }
      // Within "signal", sort by confidenceScore desc
      if (a.status === "signal" && b.status === "signal") {
        return b.confidenceScore - a.confidenceScore;
      }
      return 0;
    });
  });

export const getPainCluster = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<PainClusterWithSignals | null> => {
    const { db, painClusters, signals } = await import("../db/index.js");
    const { eq, inArray } = await import("drizzle-orm");

    const [cluster] = await db.select().from(painClusters).where(eq(painClusters.id, data.id));
    if (!cluster) return null;

    const signalIds = cluster.signalIds ?? [];
    const clusterSignals = signalIds.length > 0
      ? await db.select().from(signals).where(inArray(signals.id, signalIds))
      : [];

    return { ...cluster, signals: clusterSignals };
  });

// ── Discovery Profile server functions ────────────────────────────────────────

import type { DiscoveryProfile, DiscoveredCommunity } from "../db/schema.js";
export type { DiscoveryProfile, DiscoveredCommunity };

export const getDiscoveryProfile = createServerFn({ method: "GET" })
  .handler(async (): Promise<DiscoveryProfile | null> => {
    const { db, discoveryProfiles } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select().from(discoveryProfiles).orderBy(desc(discoveryProfiles.createdAt)).limit(1);
    return rows[0] ?? null;
  });

export const saveDiscoveryProfile = createServerFn({ method: "POST" })
  .inputValidator((d: {
    prompt: string;
    minSubscribers?: number;
    maxSubscribers?: number;
    minEngagementRatio?: number;
    lookbackDays?: number;
  }) => d)
  .handler(async ({ data }): Promise<DiscoveryProfile> => {
    const { db, discoveryProfiles } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    const { extractDiscoveryKeywords } = await import("./ai.js");

    const keywords = await extractDiscoveryKeywords(data.prompt);

    const [existing] = await db.select().from(discoveryProfiles).orderBy(desc(discoveryProfiles.createdAt)).limit(1);

    if (existing) {
      const updates: Record<string, unknown> = {
        prompt: data.prompt,
        extractedKeywords: keywords,
        updatedAt: new Date(),
      };
      if (data.minSubscribers !== undefined) updates.minSubscribers = data.minSubscribers;
      if (data.maxSubscribers !== undefined) updates.maxSubscribers = data.maxSubscribers;
      if (data.minEngagementRatio !== undefined) updates.minEngagementRatio = data.minEngagementRatio;
      if (data.lookbackDays !== undefined) updates.lookbackDays = data.lookbackDays;

      const { eq } = await import("drizzle-orm");
      await db.update(discoveryProfiles).set(updates).where(eq(discoveryProfiles.id, existing.id));
      const [updated] = await db.select().from(discoveryProfiles).where(eq(discoveryProfiles.id, existing.id));
      return updated;
    } else {
      const [inserted] = await db.insert(discoveryProfiles).values({
        prompt: data.prompt,
        extractedKeywords: keywords,
        minSubscribers: data.minSubscribers ?? 1000,
        maxSubscribers: data.maxSubscribers ?? 30000,
        minEngagementRatio: data.minEngagementRatio ?? 0.005,
        lookbackDays: data.lookbackDays ?? 60,
      }).returning();
      return inserted;
    }
  });

export interface DiscoveryRunLog {
  communities: DiscoveredCommunity[];
  keywordSearches: { keyword: string; found: number; names: string[] }[];
  aiCandidates: {
    name: string; angle: string; reason: string;
    status: "found" | "not_found" | "private" | "nsfw";
    subscribers?: number;
  }[];
}

interface RedditSearchChild {
  display_name: string; title: string; subscribers: number;
  active_user_count: number; over18: boolean; public_description: string;
  subreddit_type: string; created_utc: number; submission_type: string; lang: string;
}

export const runDiscovery = createServerFn({ method: "POST" })
  .inputValidator((d: { profileId: number }) => d)
  .handler(async ({ data }): Promise<DiscoveryRunLog> => {
    const { db, discoveryProfiles, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const { extractDiscoveryKeywords, generateSubredditCandidates } = await import("./ai.js");

    const [profile] = await db.select().from(discoveryProfiles).where(eq(discoveryProfiles.id, data.profileId));
    if (!profile) throw new Error("Profile not found");

    let keywords: string[] = profile.extractedKeywords ?? [];
    if (keywords.length === 0) {
      keywords = await extractDiscoveryKeywords(profile.prompt);
      await db.update(discoveryProfiles).set({ extractedKeywords: keywords, updatedAt: new Date() }).where(eq(discoveryProfiles.id, data.profileId));
    }
    if (keywords.length === 0) return { communities: [], keywordSearches: [], aiCandidates: [] };

    const seen = new Set<string>();
    const allSubs = new Map<string, {
      display_name: string; subscribers: number; active_user_count: number;
      description: string; engagementRatio: number;
      angle?: string; reason?: string; sourceKeyword?: string;
    }>();

    // ── Step 1: Reddit keyword searches (all keywords in parallel) ──────────
    console.log(`[runDiscovery] searching Reddit for ${keywords.length} keywords...`);
    const keywordSearches: DiscoveryRunLog["keywordSearches"] = [];

    await Promise.allSettled(keywords.map(async (kw) => {
      try {
        const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(kw)}&limit=100&include_over_18=0&sort=relevance`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const json = await res.json() as { data: { children: Array<{ data: RedditSearchChild }> } };
        const children = json.data?.children ?? [];
        const names: string[] = [];
        for (const { data: d } of children) {
          if (d.over18 || d.subreddit_type !== "public") continue;
          const key = d.display_name.toLowerCase();
          names.push(d.display_name);
          if (!seen.has(key)) {
            seen.add(key);
            const engagementRatio = d.subscribers > 0 && d.active_user_count > 0
              ? d.active_user_count / d.subscribers : 0;
            allSubs.set(key, {
              display_name: d.display_name,
              subscribers: d.subscribers,
              active_user_count: d.active_user_count ?? 0,
              description: d.public_description ?? "",
              engagementRatio,
              sourceKeyword: kw,
            });
          }
        }
        keywordSearches.push({ keyword: kw, found: children.length, names });
      } catch { keywordSearches.push({ keyword: kw, found: 0, names: [] }); }
    }));

    // ── Step 2: AI generates additional candidate names → validate via about.json ──
    console.log("[runDiscovery] generating AI candidates...");
    const aiRaw = await generateSubredditCandidates(profile.prompt, keywords);
    const aiCandidates: DiscoveryRunLog["aiCandidates"] = [];
    const BATCH = 15;

    for (let i = 0; i < aiRaw.length; i += BATCH) {
      const batch = aiRaw.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(async (c) => {
        const name = c.name.replace(/^r\//i, "").trim();
        if (!name) return { c, status: "not_found" as const };
        const key = name.toLowerCase();
        if (seen.has(key)) return { c, status: "found" as const }; // already from search
        try {
          const res = await fetch(
            `https://www.reddit.com/r/${encodeURIComponent(name)}/about.json`,
            { headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" }, signal: AbortSignal.timeout(6_000) }
          );
          if (!res.ok) return { c, status: "not_found" as const };
          const json = await res.json() as { data?: RedditSearchChild };
          const d = json.data;
          if (!d) return { c, status: "not_found" as const };
          if (d.over18) return { c, status: "nsfw" as const };
          if (d.subreddit_type !== "public") return { c, status: "private" as const };
          seen.add(key);
          const engagementRatio = d.subscribers > 0 && d.active_user_count > 0
            ? d.active_user_count / d.subscribers : 0;
          allSubs.set(key, {
            display_name: d.display_name, subscribers: d.subscribers,
            active_user_count: d.active_user_count ?? 0, description: d.public_description ?? "",
            engagementRatio, angle: c.angle, reason: c.reason,
          });
          return { c, status: "found" as const, subscribers: d.subscribers };
        } catch { return { c, status: "not_found" as const }; }
      }));
      for (const r of results) {
        if (r.status === "fulfilled") {
          aiCandidates.push({ name: r.value.c.name, angle: r.value.c.angle, reason: r.value.c.reason, status: r.value.status, subscribers: (r.value as any).subscribers });
        }
      }
      if (i + BATCH < aiRaw.length) await new Promise(r => setTimeout(r, 200));
    }

    console.log(`[runDiscovery] ${allSubs.size} unique communities from both sources`);

    // ── Step 3: Upsert ALL results - no size filtering, frontend handles it ──
    const upserted: DiscoveredCommunity[] = [];
    for (const sub of allSubs.values()) {
      try {
        const [existing] = await db.select().from(discoveredCommunities)
          .where(eq(discoveredCommunities.subreddit, sub.display_name));
        const patch = {
          subscriberCount: sub.subscribers, activeUserCount: sub.active_user_count,
          engagementRatio: sub.engagementRatio, description: sub.description,
          discoveryAngle: sub.angle ?? null, discoveryReason: sub.reason ?? null,
          discoveryProfileId: data.profileId, updatedAt: new Date(),
        };
        if (existing) {
          await db.update(discoveredCommunities).set(patch).where(eq(discoveredCommunities.id, existing.id));
          const [updated] = await db.select().from(discoveredCommunities).where(eq(discoveredCommunities.id, existing.id));
          upserted.push(updated);
        } else {
          const [inserted] = await db.insert(discoveredCommunities).values({
            subreddit: sub.display_name, ...patch,
          }).returning();
          upserted.push(inserted);
        }
      } catch { /* skip duplicate key errors */ }
    }

    await db.update(discoveryProfiles).set({ lastRunAt: new Date(), updatedAt: new Date() }).where(eq(discoveryProfiles.id, data.profileId));

    return { communities: upserted, keywordSearches, aiCandidates };
  });

export interface CommunitySearchResult {
  name: string;
  title: string;
  description: string;
  subscribers: number;
  activeUserCount: number;
  engagementRatio: number;
  submissionType: string;
  lang: string;
  createdUtc: number;
  sourceKeyword: string;
  angle?: string;
  reason?: string;
}

// ── Quick Peek ────────────────────────────────────────────────────────────────

export interface PeekPost {
  title: string;
  score: number;
  numComments: number;
  createdUtc: number;
  permalink: string;
}

export const peekCommunity = createServerFn({ method: "POST" })
  .inputValidator((d: { subreddit: string }) => d)
  .handler(async ({ data }): Promise<PeekPost[]> => {
    try {
      const url = `https://www.reddit.com/r/${encodeURIComponent(data.subreddit)}/new.json?limit=10`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return [];
      const json = await res.json() as { data: { children: Array<{ data: { title: string; score: number; num_comments: number; created_utc: number; permalink: string } }> } };
      return json.data.children.map(c => ({
        title: c.data.title,
        score: c.data.score,
        numComments: c.data.num_comments,
        createdUtc: c.data.created_utc,
        permalink: `https://reddit.com${c.data.permalink}`,
      }));
    } catch { return []; }
  });

// ── Related Community Expansion ───────────────────────────────────────────────

export const getRelatedCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: { subreddit: string; description: string }) => d)
  .handler(async ({ data }): Promise<CommunitySearchResult[]> => {
    if (!process.env.OPENROUTER_API_KEY) return [];
    try {
      const { extractDiscoveryKeywords } = await import("./ai.js");
      const prompt = `Subreddit: r/${data.subreddit}\nDescription: ${data.description?.slice(0, 300) ?? ""}`;
      const keywords = await extractDiscoveryKeywords(prompt);
      const topKeywords = keywords.slice(0, 4);
      if (!topKeywords.length) return [];

      const seen = new Set<string>([data.subreddit.toLowerCase()]);
      const results: CommunitySearchResult[] = [];

      await Promise.allSettled(topKeywords.map(async (kw) => {
        try {
          const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(kw)}&limit=25&include_over_18=0&sort=relevance`;
          const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" }, signal: AbortSignal.timeout(8_000) });
          if (!res.ok) return;
          const json = await res.json() as { data: { children: Array<{ data: { display_name: string; title: string; public_description: string; subscribers: number; active_user_count: number; over18: boolean; subreddit_type: string; submission_type: string; lang: string; created_utc: number } }> } };
          for (const { data: d } of json.data?.children ?? []) {
            if (d.over18 || d.subreddit_type !== "public") continue;
            const key = d.display_name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            const eng = d.subscribers > 0 && d.active_user_count > 0 ? d.active_user_count / d.subscribers : 0;
            results.push({ name: d.display_name, title: d.title ?? d.display_name, description: d.public_description ?? "", subscribers: d.subscribers, activeUserCount: d.active_user_count ?? 0, engagementRatio: eng, submissionType: d.submission_type ?? "any", lang: d.lang ?? "en", createdUtc: d.created_utc ?? 0, sourceKeyword: kw });
          }
        } catch { }
      }));

      return results.sort((a, b) => b.subscribers - a.subscribers).slice(0, 20);
    } catch { return []; }
  });

// ── Search Sessions ───────────────────────────────────────────────────────────

export const saveSearchSession = createServerFn({ method: "POST" })
  .inputValidator((d: { keywords: string[]; mode: string; results: CommunitySearchResult[] }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, searchSessions } = await import("../db/index.js");
    const [row] = await db.insert(searchSessions).values({
      keywords: data.keywords,
      mode: data.mode as "manual" | "ai",
      resultCount: data.results.length,
      resultsJson: JSON.stringify(data.results),
    }).returning({ id: searchSessions.id });
    return row;
  });

export const getRecentSearchSessions = createServerFn({ method: "GET" })
  .handler(async () => {
    const { db, searchSessions } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    return db.select().from(searchSessions).orderBy(desc(searchSessions.createdAt)).limit(8);
  });

type RedditSearchResponse = { data: { children: Array<{ data: { display_name: string; title: string; public_description: string; subscribers: number; active_user_count: number; over18: boolean; subreddit_type: string; submission_type: string; lang: string; created_utc: number } }>; after: string | null } };

async function fetchSubredditSearch(kw: string, after?: string | null): Promise<{ results: CommunitySearchResult[]; after: string | null; count: number }> {
  const afterParam = after ? `&after=${encodeURIComponent(after)}` : "";
  const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(kw)}&limit=100&include_over_18=0&sort=relevance${afterParam}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 BurningDemand/1.0" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return { results: [], after: null, count: 0 };
  const json = await res.json() as RedditSearchResponse;
  const children = json.data?.children ?? [];
  const results: CommunitySearchResult[] = [];
  for (const { data: d } of children) {
    if (d.over18 || d.subreddit_type !== "public") continue;
    const eng = d.subscribers > 0 && d.active_user_count > 0 ? d.active_user_count / d.subscribers : 0;
    results.push({ name: d.display_name, title: d.title ?? d.display_name, description: d.public_description ?? "", subscribers: d.subscribers, activeUserCount: d.active_user_count ?? 0, engagementRatio: eng, submissionType: d.submission_type ?? "any", lang: d.lang ?? "en", createdUtc: d.created_utc ?? 0, sourceKeyword: kw });
  }
  return { results, after: json.data?.after ?? null, count: children.length };
}

export interface SearchCommunitiesResult {
  results: CommunitySearchResult[];
  keywordCounts: Record<string, number>;
  cursors: Record<string, string | null>;
  hasMore: boolean;
}

export const searchCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: { keywords: string[] }) => d)
  .handler(async ({ data }): Promise<SearchCommunitiesResult> => {
    if (!data.keywords.length) return { results: [], keywordCounts: {}, cursors: {}, hasMore: false };
    const seen = new Set<string>();
    const allResults: CommunitySearchResult[] = [];
    const keywordCounts: Record<string, number> = {};
    const cursors: Record<string, string | null> = {};

    await Promise.allSettled(data.keywords.map(async (kw) => {
      try {
        const { results, after, count } = await fetchSubredditSearch(kw);
        keywordCounts[kw] = count;
        cursors[kw] = after;
        for (const r of results) {
          if (seen.has(r.name.toLowerCase())) continue;
          seen.add(r.name.toLowerCase());
          allResults.push(r);
        }
      } catch { keywordCounts[kw] = 0; cursors[kw] = null; }
    }));

    allResults.sort((a, b) => b.subscribers - a.subscribers);
    return { results: allResults, keywordCounts, cursors, hasMore: Object.values(cursors).some(c => c !== null) };
  });

export const loadMoreCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: { cursors: Record<string, string | null>; existingNames: string[] }) => d)
  .handler(async ({ data }): Promise<SearchCommunitiesResult> => {
    const activeCursors = Object.entries(data.cursors).filter(([, v]) => v !== null);
    if (!activeCursors.length) return { results: [], keywordCounts: {}, cursors: {}, hasMore: false };

    const seen = new Set<string>(data.existingNames.map(n => n.toLowerCase()));
    const allResults: CommunitySearchResult[] = [];
    const keywordCounts: Record<string, number> = {};
    const cursors: Record<string, string | null> = {};

    await Promise.allSettled(activeCursors.map(async ([kw, after]) => {
      try {
        const { results, after: nextAfter, count } = await fetchSubredditSearch(kw, after);
        keywordCounts[kw] = count;
        cursors[kw] = nextAfter;
        for (const r of results) {
          if (seen.has(r.name.toLowerCase())) continue;
          seen.add(r.name.toLowerCase());
          allResults.push(r);
        }
      } catch { keywordCounts[kw] = 0; cursors[kw] = null; }
    }));

    return { results: allResults, keywordCounts, cursors, hasMore: Object.values(cursors).some(c => c !== null) };
  });

export const addCommunityToQueue = createServerFn({ method: "POST" })
  .inputValidator((d: { name: string; subscribers: number; activeUserCount: number; description: string; engagementRatio: number; angle?: string; reason?: string }) => d)
  .handler(async ({ data }): Promise<DiscoveredCommunity> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [existing] = await db.select().from(discoveredCommunities).where(eq(discoveredCommunities.subreddit, data.name));
    if (existing) {
      await db.update(discoveredCommunities).set({ tracked: true, subscriberCount: data.subscribers, activeUserCount: data.activeUserCount, description: data.description, engagementRatio: data.engagementRatio, discoveryAngle: data.angle ?? null, discoveryReason: data.reason ?? null, updatedAt: new Date() }).where(eq(discoveredCommunities.id, existing.id));
      const [updated] = await db.select().from(discoveredCommunities).where(eq(discoveredCommunities.id, existing.id));
      return updated;
    }
    const [inserted] = await db.insert(discoveredCommunities).values({ subreddit: data.name, subscriberCount: data.subscribers, activeUserCount: data.activeUserCount, description: data.description, engagementRatio: data.engagementRatio, tracked: true, discoveryAngle: data.angle ?? null, discoveryReason: data.reason ?? null }).returning();
    return inserted;
  });

// ── Pain Search ───────────────────────────────────────────────────────────────

export interface PainSearchResult {
  signals: import("../db/schema.js").PainSignalPost[];
  communities: import("../db/schema.js").CommunityDistribution[];
  searchQueries: string[];
  sessionId: number;
}

export const searchForPain = createServerFn({ method: "POST" })
  .inputValidator((d: { domain: string; keywords: string[] }) => d)
  .handler(async ({ data }): Promise<PainSearchResult> => {
    const { generatePainSearchQueries } = await import("./ai.js");
    const { db, painSearchSessions } = await import("../db/index.js");

    // Generate search queries
    const queries = await generatePainSearchQueries(data.domain, data.keywords);
    if (!queries.length) return { signals: [], communities: [], searchQueries: [], sessionId: 0 };

    // Search Reddit posts for each query in parallel
    const allPosts: import("../db/schema.js").PainSignalPost[] = [];
    const seenIds = new Set<string>();

    await Promise.allSettled(queries.map(async (q) => {
      try {
        const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&type=link&sort=top&t=year&limit=25`;
        const res = await fetch(url, {
          headers: { "User-Agent": "BurningDemand:pain-search:1.0 (internal tool)" },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return;
        const json = await res.json() as {
          data: {
            children: Array<{
              data: {
                name: string; title: string; selftext: string;
                subreddit: string; score: number; num_comments: number;
                permalink: string; created_utc: number; upvote_ratio: number;
                over_18: boolean; subreddit_type: string;
              }
            }>
          }
        };
        for (const { data: p } of json.data?.children ?? []) {
          if (p.over_18 || p.subreddit_type !== "public") continue;
          if (seenIds.has(p.name)) continue;
          seenIds.add(p.name);
          // Heuristic pain score: high score + many comments = real engagement
          const painScore = Math.min(10, Math.round(
            (Math.log10(p.score + 1) * 3 + Math.log10(p.num_comments + 1) * 2) * (p.upvote_ratio ?? 0.5) * 1.5
          ));
          allPosts.push({
            id: p.name,
            title: p.title,
            body: (p.selftext ?? "").slice(0, 300),
            subreddit: p.subreddit,
            score: p.score,
            numComments: p.num_comments,
            permalink: `https://reddit.com${p.permalink}`,
            createdUtc: p.created_utc,
            upvoteRatio: p.upvote_ratio ?? 0.5,
            searchQuery: q,
            painScore,
          });
        }
      } catch { }
    }));

    // Sort by pain score desc
    allPosts.sort((a, b) => b.painScore - a.painScore);

    // Count how many pain posts came from each subreddit
    const subredditCounts = new Map<string, number>();
    for (const p of allPosts) {
      subredditCounts.set(p.subreddit, (subredditCounts.get(p.subreddit) ?? 0) + 1);
    }

    // Also run a direct subreddit search for the domain — finds niche communities
    // whose *identity* matches the buyer, not just where a pain post happened to land.
    const directSearchTerms = [
      data.domain.split(/\s+/).slice(0, 3).join(" "),
      ...(data.keywords ?? []).slice(0, 2),
    ].filter(Boolean);

    const UA = "BurningDemand:community-discovery:1.0 (internal tool)";
    const directlyFound = new Map<string, number>(); // subreddit → relevance rank bonus

    await Promise.allSettled(directSearchTerms.map(async (term, termIdx) => {
      try {
        const url = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(term)}&limit=15&include_over_18=0&sort=relevance`;
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
        if (!res.ok) return;
        const json = await res.json() as { data: { children: Array<{ data: { display_name: string } }> } };
        json.data.children.forEach(({ data: sr }, rank) => {
          const key = sr.display_name;
          // Earlier terms and higher ranks give bigger bonus; cap at 3
          const bonus = Math.max(0, 3 - termIdx - Math.floor(rank / 5));
          directlyFound.set(key, (directlyFound.get(key) ?? 0) + bonus);
        });
      } catch { }
    }));

    // Union: all subreddits from pain posts + all directly found subreddits
    const allSubs = new Set([...subredditCounts.keys(), ...directlyFound.keys()]);

    const communities: import("../db/schema.js").CommunityDistribution[] = [];

    // Fetch about.json for each candidate subreddit
    for (const sub of [...allSubs].slice(0, 30)) {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${encodeURIComponent(sub)}/about.json`,
          { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6_000) }
        );
        if (!res.ok) continue;
        const json = await res.json() as { data?: { subscribers: number; submission_type: string; over18: boolean; subreddit_type: string } };
        const d = json.data;
        if (!d || d.subreddit_type !== "public" || d.over18) continue;

        // Base score from submission type
        let score = 5;
        let label = "Open";
        if (d.submission_type === "link") { score = 2; label = "Links only"; }
        else if (d.submission_type === "self") { score = 7; label = "Text posts"; }

        // Size: sweet spot 5k–200k. Too small = no reach. Too large = noise.
        if (d.subscribers < 500) { score = Math.min(score, 2); label = "Too small"; }
        else if (d.subscribers < 2_000) score = Math.min(score, 4);
        else if (d.subscribers >= 5_000 && d.subscribers <= 200_000) score = Math.min(10, score + 1); // sweet spot
        else if (d.subscribers > 1_000_000) { score = Math.min(score, 2); label += " (too large)"; }
        else if (d.subscribers > 200_000) score = Math.min(score, 5);

        // Boost for communities found via direct subreddit search (their identity matches the domain)
        const directBonus = directlyFound.get(sub) ?? 0;
        score = Math.min(10, score + directBonus);
        if (directBonus > 0 && label === "Open") label = "Targeted";

        const signalCount = subredditCounts.get(sub) ?? 0;

        communities.push({
          subreddit: sub,
          subscribers: d.subscribers,
          submissionType: d.submission_type ?? "any",
          over18: d.over18,
          subredditType: d.subreddit_type,
          distributionScore: score,
          distributionLabel: label,
          signalCount,
        });
        await new Promise(r => setTimeout(r, 80));
      } catch { }
    }

    // Sort: direct-match communities first, then by score × engagement
    communities.sort((a, b) => {
      const aBonus = directlyFound.get(a.subreddit) ?? 0;
      const bBonus = directlyFound.get(b.subreddit) ?? 0;
      if (bBonus !== aBonus) return bBonus - aBonus;
      return (b.distributionScore * Math.max(b.signalCount, 1)) - (a.distributionScore * Math.max(a.signalCount, 1));
    });

    // Persist session
    const [session] = await db.insert(painSearchSessions).values({
      domain: data.domain,
      keywords: data.keywords,
      searchQueries: queries,
      signalsJson: JSON.stringify(allPosts),
      communitiesJson: JSON.stringify(communities),
      signalCount: allPosts.length,
      communityCount: communities.length,
    }).returning({ id: painSearchSessions.id });

    return { signals: allPosts, communities, searchQueries: queries, sessionId: session.id };
  });

export const getRecentPainSessions = createServerFn({ method: "GET" })
  .handler(async (): Promise<import("../db/schema.js").PainSearchSession[]> => {
    const { db, painSearchSessions } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");
    return db.select({
      id: painSearchSessions.id,
      domain: painSearchSessions.domain,
      keywords: painSearchSessions.keywords,
      searchQueries: painSearchSessions.searchQueries,
      signalsJson: painSearchSessions.signalsJson,
      communitiesJson: painSearchSessions.communitiesJson,
      signalCount: painSearchSessions.signalCount,
      communityCount: painSearchSessions.communityCount,
      createdAt: painSearchSessions.createdAt,
    }).from(painSearchSessions).orderBy(desc(painSearchSessions.createdAt)).limit(6);
  });

// ── Pain Pattern Scanner ──────────────────────────────────────────────────────

export interface PainSignal {
  id: string;
  title: string;
  body: string;
  subreddit: string;
  score: number;
  numComments: number;
  permalink: string;
  createdUtc: number;
  upvoteRatio: number;
  matchedPattern: string;
  authenticityScore: number;
  isBuyerCommunity: boolean;
  hasManualMention: boolean;
  hasSpreadsheetMention: boolean;
  type: 'post' | 'comment';
  subredditSubscribers?: number;
  postTitle?: string;           // for comments: title of the parent post
  postPermalink?: string;       // for comments: link to the parent post
  validationComments?: string[]; // top comments confirming the pain (no solution)
  existingSolutions?: string[];  // top comments recommending existing tools (opportunity risk)
}

export const scanForPain = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number; timeRange?: 'day' | 'week' | 'month' | 'year'; includeComments?: boolean; skipPosts?: boolean; subreddits?: string[]; patterns?: string[]; consumerMode?: boolean }) => d)
  .handler(async ({ data }): Promise<{ signals: PainSignal[]; patternsSearched: string[]; totalFound: number }> => {
    const seen = new Set<string>();
    const allSignals: PainSignal[] = [];

    // For 1d: sort=new, exact phrase quotes, age-filter client-side.
    //         Quoted phrases work on sort=new because Reddit returns recent matches loosely.
    // For longer ranges: sort=relevance&t=X, quotes STRIPPED.
    //   Quoted phrases + time filter returns near-zero results from Reddit API.
    //   Keyword (unquoted) search + scoring function filters noise instead.
    //   MAX_PAGES per pattern for longer ranges to get more coverage.
    const timeRange = data.timeRange ?? 'month';
    const isShortRange = timeRange === 'day';
    const redditSort = isShortRange ? 'new' : 'relevance';
    const redditT = isShortRange ? '' : timeRange;
    const maxAgeSecs = isShortRange ? 86_400 : null;
    const MAX_PAGES = isShortRange ? 1 : 3; // fetch up to 3 pages (300 results) for longer ranges

    // When subreddits are provided, append "subreddit:X OR subreddit:Y" to each
    // query so Reddit scopes results server-side - no wasted quota on noise.
    // Reddit supports up to ~20 OR clauses reliably; chunk if needed.
    const subredditFilter = (data.subreddits && data.subreddits.length > 0)
      ? ' ' + data.subreddits.slice(0, 20).map(s => `subreddit:${s}`).join(' OR ')
      : '';

    type RedditPostData = {
      name: string; title: string; selftext: string;
      subreddit: string; score: number; num_comments: number;
      permalink: string; created_utc: number; upvote_ratio: number;
      over_18: boolean; subreddit_type: string; subreddit_subscribers: number;
    };
    type RedditCommentData = {
      name: string; body: string; link_title: string; link_permalink: string;
      subreddit: string; score: number; permalink: string;
      created_utc: number; over_18: boolean; subreddit_type: string;
    };

    console.log(`[scanForPain] timeRange=${data.timeRange} t=${redditT} isShortRange=${isShortRange}`);
    let postsAttempted = 0, postsSucceeded = 0, postsParsedAll = 0;

    // Shared rate-limit state across all concurrent workers.
    // Workers optimistically decrement before firing, then correct from response headers.
    const rl = { remaining: 8, resetAt: Date.now() + 60_000 };

    async function waitForBudget() {
      while (rl.remaining <= 0) {
        const wait = Math.max(500, rl.resetAt - Date.now() + 200);
        console.log(`[rl] budget exhausted - waiting ${Math.round(wait / 1000)}s for reset`);
        await new Promise(r => setTimeout(r, wait));
        // Window has reset - allow one request through to get fresh headers
        if (Date.now() >= rl.resetAt) {
          rl.remaining = 1;
          break;
        }
      }
      rl.remaining--;
    }

    function updateRl(res: Response, label: string) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      const reset = res.headers.get('x-ratelimit-reset');
      const used = res.headers.get('x-ratelimit-used');
      const retryAfter = res.headers.get('retry-after');
      const remainingN = parseFloat(remaining ?? 'NaN');
      const resetN = parseFloat(reset ?? 'NaN');
      const retryAfterN = parseFloat(retryAfter ?? 'NaN');
      if (!isNaN(remainingN)) rl.remaining = remainingN;
      if (!isNaN(resetN)) rl.resetAt = Date.now() + resetN * 1_000;
      if (res.status === 429 && !isNaN(retryAfterN)) {
        rl.remaining = 0;
        rl.resetAt = Date.now() + retryAfterN * 1_000;
      }
      console.log(
        `[reddit] ${res.status} ${label}` +
        ` | remaining=${remaining ?? '-'}` +
        ` used=${used ?? '-'}` +
        ` reset=${reset ?? '-'}s` +
        ` retry-after=${retryAfter ?? '-'}` +
        ` | local: remaining=${rl.remaining} resetIn=${Math.round((rl.resetAt - Date.now()) / 1000)}s`
      );
    }

    // Run tasks with CONCURRENCY parallel workers, all sharing the rl budget.
    const CONCURRENCY = 3;
    async function runTasks(tasks: (() => Promise<void>)[]) {
      const queue = [...tasks];
      async function worker() {
        while (queue.length > 0) {
          const task = queue.shift()!;
          await task();
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }

    // ── Post search ───────────────────────────────────────────────────────────
    const activePatterns = data.patterns ?? PAIN_PATTERNS;
    const scoreSignal = data.consumerMode
      ? (title: string, body: string, sub: string) => scoreConsumerSignal(title, body, sub)
      : (title: string, body: string, sub: string, pattern: string) => scorePainSignal(title, body, sub, pattern);
    if (data.skipPosts) { postsAttempted = 0; }
    await runTasks(data.skipPosts ? [] : activePatterns.map(pattern => async () => {
      const q = pattern;
      const tParam = redditT ? `&t=${redditT}` : '';
      let after = '';
      let patternHits = 0;
      let patternRaw = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        await waitForBudget();
        try {
          const afterParam = after ? `&after=${after}` : '';
          const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q + subredditFilter)}&type=link&sort=${redditSort}${tParam}&limit=100${afterParam}`;
          postsAttempted++;
          console.log(`[reddit:fetch] p${page + 1} ${url}`);
          const res = await fetch(url, { headers: { 'User-Agent': 'web:burningdemand:0.1.0 (research tool)' }, signal: AbortSignal.timeout(10_000) });
          updateRl(res, `POST "${q}" p${page + 1}`);
          if (!res.ok) break;
          postsSucceeded++;
          const json = await res.json() as { data: { after: string | null; children: Array<{ data: RedditPostData }> } };
          const children = json.data?.children ?? [];
          postsParsedAll += children.length;
          patternRaw += children.length;
          for (const { data: p } of children) {
            if (p.over_18) continue;
            if (NOISE_SUBS.has(p.subreddit)) continue;
            if (seen.has(p.name)) continue;
            seen.add(p.name);
            const title = p.title ?? '';
            const body = (p.selftext ?? '').slice(0, 400);
            const text = (title + ' ' + body).toLowerCase();
            const authScore = scoreSignal(title, body, p.subreddit, pattern);
            if (authScore === 0) continue;
            patternHits++;
            allSignals.push({
              id: p.name, title, body, type: 'post',
              subreddit: p.subreddit, score: p.score, numComments: p.num_comments,
              permalink: `https://reddit.com${p.permalink}`,
              createdUtc: p.created_utc, upvoteRatio: p.upvote_ratio ?? 0.5,
              matchedPattern: pattern.replace(/"/g, ''),
              authenticityScore: authScore,
              isBuyerCommunity: !BUILDER_SUBS.has(p.subreddit),
              hasManualMention: /manual(ly)?/.test(text),
              hasSpreadsheetMention: /spread\s*sheet/.test(text),
              subredditSubscribers: p.subreddit_subscribers ?? undefined,
            });
          }
          // Stop paginating if: no more pages, or last page was partial (< 100 = no more data)
          after = json.data?.after ?? '';
          if (!after || children.length < 100) break;
        } catch { rl.remaining++; break; }
      }
      console.log(`[reddit:pattern] "${q.replace(/"/g, '')}" → ${patternRaw} raw, ${patternHits} kept`);
    }));

    // ── Comment search ────────────────────────────────────────────────────────
    if (data.includeComments === true) {
      await runTasks(activePatterns.map(pattern => async () => {
        const q = pattern; // keep quotes for exact phrase matching
        await waitForBudget();
        try {
          const tParam = redditT ? `&t=${redditT}` : '';
          const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q + subredditFilter)}&type=comment&sort=${redditSort}${tParam}&limit=100`;
          console.log(`[reddit:fetch] ${url}`);
          const res = await fetch(url, { headers: { 'User-Agent': 'web:burningdemand:0.1.0 (research tool)' }, signal: AbortSignal.timeout(10_000) });
          updateRl(res, `CMT "${q}"`);
          if (!res.ok) return;
          const json = await res.json() as { data: { children: Array<{ data: RedditCommentData }> } };
          for (const { data: c } of json.data?.children ?? []) {
            if (c.over_18) continue;
            if (NOISE_SUBS.has(c.subreddit)) continue;
            if (seen.has(c.name)) continue;
            seen.add(c.name);
            const body = (c.body ?? '').slice(0, 400);
            const text = body.toLowerCase();
            const authScore = scoreSignal('', body, c.subreddit, pattern);
            if (authScore < 4) continue;
            allSignals.push({
              id: c.name,
              title: body.slice(0, 120),
              body,
              type: 'comment',
              postTitle: c.link_title,
              postPermalink: c.link_permalink ? `https://reddit.com${c.link_permalink}` : undefined,
              subreddit: c.subreddit,
              score: c.score, numComments: 0,
              permalink: `https://reddit.com${c.permalink}`,
              createdUtc: c.created_utc, upvoteRatio: 0.5,
              matchedPattern: pattern.replace(/"/g, ''),
              authenticityScore: authScore,
              isBuyerCommunity: !BUILDER_SUBS.has(c.subreddit),
              hasManualMention: /manual(ly)?/.test(text),
              hasSpreadsheetMention: /spread\s*sheet/.test(text),
            });
          }
        } catch { rl.remaining++; }
      }));
    }

    console.log(`[scanForPain] post fetch: attempted=${postsAttempted} ok=${postsSucceeded} reddit_returned=${postsParsedAll} signals_collected=${allSignals.length}`);

    // Age filter for short ranges - always create a new array to avoid reference aliasing
    const nowSecs = Date.now() / 1000;
    const filtered = maxAgeSecs
      ? allSignals.filter(s => (nowSecs - s.createdUtc) <= maxAgeSecs)
      : [...allSignals];
    console.log(`[scanForPain] after age filter (maxAge=${maxAgeSecs}s): ${filtered.length} of ${allSignals.length}`);
    allSignals.length = 0;
    allSignals.push(...filtered);

    // Deduplicate cross-posted content: same normalised title across multiple subreddits
    // → keep only the highest-scored copy so one viral post doesn't flood results
    const normalise = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const titleBest = new Map<string, typeof allSignals[0]>();
    for (const s of allSignals) {
      const key = normalise(s.title);
      const existing = titleBest.get(key);
      if (!existing || s.authenticityScore > existing.authenticityScore) titleBest.set(key, s);
    }
    const deduped = [...titleBest.values()];
    const removedByDedup = allSignals.length - deduped.length;
    if (removedByDedup > 0) console.log(`[scanForPain] dedup: removed ${removedByDedup} cross-posted duplicates`);
    allSignals.length = 0;
    allSignals.push(...deduped);

    // Sort: buyer-first → authenticity desc → engagement desc
    allSignals.sort((a, b) => {
      if (a.isBuyerCommunity !== b.isBuyerCommunity) return a.isBuyerCommunity ? -1 : 1;
      if (b.authenticityScore !== a.authenticityScore) return b.authenticityScore - a.authenticityScore;
      return (b.score * Math.log(b.numComments + 1)) - (a.score * Math.log(a.numComments + 1));
    });

    const limited = allSignals.slice(0, data.limit ?? 300);

    // ── Fetch validation comments - skipped to avoid extra Reddit requests ─────
    const toValidate: typeof limited = [];
    await Promise.allSettled(toValidate.map(async (signal, i) => {
      try {
        await new Promise(r => setTimeout(r, i * 150));
        const postId = signal.id.replace('t3_', '');
        const url = `https://www.reddit.com/r/${signal.subreddit}/comments/${postId}.json?limit=15&sort=top&depth=1`;
        const res = await fetch(url, { headers: { 'User-Agent': 'web:burningdemand:0.1.0 (research tool)' }, signal: AbortSignal.timeout(6_000) });
        if (!res.ok) return;
        const json = await res.json() as Array<{ data: { children: Array<{ data: { body?: string; score: number } }> } }>;
        const comments = (json[1]?.data?.children ?? [])
          .filter(c => c.data.body && c.data.score > 0 && !c.data.body.startsWith('[deleted]'));

        // Separate: pure pain validation vs solution recommendations
        const validating = comments
          .filter(c => VALIDATION_PHRASES.test(c.data.body!) && !SOLUTION_PHRASES.test(c.data.body!))
          .slice(0, 3)
          .map(c => c.data.body!.slice(0, 150));

        const solutions = comments
          .filter(c => SOLUTION_PHRASES.test(c.data.body!))
          .slice(0, 3)
          .map(c => c.data.body!.slice(0, 150));

        if (validating.length > 0) signal.validationComments = validating;
        if (solutions.length > 0) {
          signal.existingSolutions = solutions;
          // Penalise auth score when solutions exist - reduces opportunity rank
          signal.authenticityScore = Math.max(1, signal.authenticityScore - solutions.length);
        }
      } catch { }
    }));

    const result = {
      signals: limited,
      patternsSearched: activePatterns.map(p => p.replace(/"/g, '')),
      totalFound: allSignals.length,
    };

    // Persist scan so history dropdown can restore it
    try {
      const { db, painSearchSessions } = await import("../db/index.js");
      const uniqueSubs = new Set(limited.map(s => s.subreddit));
      await db.insert(painSearchSessions).values({
        domain: 'find-scan',
        keywords: [data.timeRange ?? 'month'],
        signalsJson: JSON.stringify(limited),
        signalCount: limited.length,
        communityCount: uniqueSubs.size,
      });
    } catch { }

    return result;
  });

export const getRecentFindScans = createServerFn({ method: "GET" })
  .handler(async (): Promise<Array<{ id: number; timeRange: string; signalCount: number; communityCount: number; createdAt: Date; signalsJson: string | null; classificationsJson: string | null; analysisJson: string | null }>> => {
    const { db, painSearchSessions } = await import("../db/index.js");
    const { desc, eq } = await import("drizzle-orm");
    const rows = await db.select({
      id: painSearchSessions.id,
      keywords: painSearchSessions.keywords,
      signalCount: painSearchSessions.signalCount,
      communityCount: painSearchSessions.communityCount,
      createdAt: painSearchSessions.createdAt,
      signalsJson: painSearchSessions.signalsJson,
      communitiesJson: painSearchSessions.communitiesJson,
    }).from(painSearchSessions)
      .where(eq(painSearchSessions.domain, 'find-scan'))
      .orderBy(desc(painSearchSessions.createdAt))
      .limit(8);
    return rows.map(r => {
      let classificationsJson: string | null = null;
      let analysisJson: string | null = null;
      if (r.communitiesJson) {
        try {
          const parsed = JSON.parse(r.communitiesJson);
          if (parsed?.v === 2) analysisJson = r.communitiesJson;
          else classificationsJson = r.communitiesJson;
        } catch { }
      }
      return {
        id: r.id,
        timeRange: (r.keywords as string[] | null)?.[0] ?? 'month',
        signalCount: r.signalCount,
        communityCount: r.communityCount,
        createdAt: r.createdAt,
        signalsJson: r.signalsJson,
        classificationsJson,
        analysisJson,
      };
    });
  });

export const saveScanClassifications = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: number; classificationsJson: string }) => d)
  .handler(async ({ data }) => {
    const { db, painSearchSessions } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(painSearchSessions)
      .set({ communitiesJson: data.classificationsJson })
      .where(eq(painSearchSessions.id, data.sessionId));
  });

export const saveScanAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: number; playbooks: SignalPlaybook[]; seoAngles: CrossMarketSeo[] }) => d)
  .handler(async ({ data }) => {
    const { db, painSearchSessions } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(painSearchSessions)
      .set({ communitiesJson: JSON.stringify({ v: 2, playbooks: data.playbooks, seoAngles: data.seoAngles }) })
      .where(eq(painSearchSessions.id, data.sessionId));
  });

export const getDiscoveredCommunities = createServerFn({ method: "GET" })
  .handler(async (): Promise<DiscoveredCommunity[]> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { desc, sql } = await import("drizzle-orm");
    return db.select().from(discoveredCommunities).orderBy(
      sql`${discoveredCommunities.tracked} DESC`,
      desc(discoveredCommunities.engagementRatio),
    );
  });

export const trackCommunity = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; tracked: boolean }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(discoveredCommunities)
      .set({ tracked: data.tracked, updatedAt: new Date() })
      .where(eq(discoveredCommunities.id, data.id));
    return { ok: true };
  });

export const getDiscoveredCommunity = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<DiscoveredCommunity | null> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(discoveredCommunities).where(eq(discoveredCommunities.id, data.id));
    return row ?? null;
  });

export const deleteDiscoveredCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: number[] }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; deleted: number }> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { inArray } = await import("drizzle-orm");
    if (data.ids.length === 0) return { ok: true, deleted: 0 };
    await db.delete(discoveredCommunities).where(inArray(discoveredCommunities.id, data.ids));
    return { ok: true, deleted: data.ids.length };
  });

export const triggerDiscoveredCommunityAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(discoveredCommunities)
      .set({ scanStatus: "running", updatedAt: new Date() })
      .where(eq(discoveredCommunities.id, data.id));

    // Fire-and-forget
    fetch("http://localhost:3000/api/analyze-community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discoveredCommunityId: data.id }),
    }).catch(() => { });

    return { ok: true };
  });

// ── Feed-based ingestion ──────────────────────────────────────────────────────

export const runFeedScansFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ scannedCommunities: number; newSignals: number; skippedDuplicates: number }> => {
    const { runFeedScans } = await import("./reddit-feed.js");
    return runFeedScans();
  },
);

export const expandCoAuthorsFn = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number }) => d)
  .handler(async ({ data }): Promise<{ authorsExpanded: number; communitiesFound: number }> => {
    const { expandFromCoAuthors } = await import("./reddit-feed.js");
    return expandFromCoAuthors(data.limit ?? 10);
  });

// ── Reply Queue + Community Intelligence ─────────────────────────────────────

export interface ReplyQueueSignal {
  id: number;
  url: string;
  rawText: string;
  subreddit: string | null;
  authenticityScore: number | null;
  posterIntent: string | null;
  postedAt: Date | null;
  repliedAt: Date | null;
  replyDraft: string | null;
  /** engagement proxy: score * log(comments+1) */
  engagementScore: number;
}

export interface CommunityProfileSummary {
  subreddit: string;
  opennessScore: number | null;
  painDensityScore: number | null;
  purchaseIntentScore: number | null;
  whatGetsTraction: string | null;
  whatFails: string | null;
  distributionPlaybook: string | null;
  avoidList: string[];
  bestPostingTimes: string | null;
  hasProfile: boolean;
}

export const getClusterReplyQueue = createServerFn({ method: "POST" })
  .inputValidator((d: { clusterId: number }) => d)
  .handler(async ({ data }): Promise<ReplyQueueSignal[]> => {
    const { db, painClusters, signals } = await import("../db/index.js");
    const { eq, inArray } = await import("drizzle-orm");

    const [cluster] = await db.select().from(painClusters).where(eq(painClusters.id, data.clusterId));
    if (!cluster) return [];

    const ids = cluster.signalIds ?? [];
    if (ids.length === 0) return [];

    const rows = await db.select({
      id: signals.id,
      url: signals.url,
      rawText: signals.rawText,
      subreddit: signals.subreddit,
      authenticityScore: signals.authenticityScore,
      posterIntent: signals.posterIntent,
      postedAt: signals.postedAt,
      repliedAt: signals.repliedAt,
      replyDraft: signals.replyDraft,
    }).from(signals).where(inArray(signals.id, ids));

    return rows
      .filter(r => r.url && r.url.includes("reddit.com"))
      .map(r => ({
        ...r,
        engagementScore: (r.authenticityScore ?? 0) * 2,
      }))
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, 30);
  });

export const getCommunityProfiles = createServerFn({ method: "POST" })
  .inputValidator((d: { subreddits: string[] }) => d)
  .handler(async ({ data }): Promise<CommunityProfileSummary[]> => {
    const { db, channelProfiles, discoveredCommunities } = await import("../db/index.js");
    const { inArray, eq } = await import("drizzle-orm");

    // Try channelProfiles first (deep scan results), then discoveredCommunities
    const cpRows = await db.select().from(channelProfiles)
      .where(inArray(channelProfiles.subreddit as any, data.subreddits));

    const dcRows = await db.select().from(discoveredCommunities)
      .where(inArray(discoveredCommunities.subreddit, data.subreddits));

    return data.subreddits.map(sub => {
      const cp = cpRows.find(r => r.subreddit?.toLowerCase() === sub.toLowerCase());
      const dc = dcRows.find(r => r.subreddit.toLowerCase() === sub.toLowerCase());
      const profile = cp?.profileJson ?? dc?.profileJson as any ?? null;

      if (!profile) return { subreddit: sub, opennessScore: null, painDensityScore: null, purchaseIntentScore: null, whatGetsTraction: null, whatFails: null, distributionPlaybook: null, avoidList: [], bestPostingTimes: null, hasProfile: false };

      return {
        subreddit: sub,
        opennessScore: profile.opennessScore ?? null,
        painDensityScore: profile.painDensityScore ?? null,
        purchaseIntentScore: profile.purchaseIntentScore ?? null,
        whatGetsTraction: profile.whatGetsTraction ?? null,
        whatFails: profile.whatFails ?? null,
        distributionPlaybook: profile.distributionPlaybook ?? null,
        avoidList: Array.isArray(profile.avoidList) ? profile.avoidList : [],
        bestPostingTimes: profile.bestPostingTimes ?? null,
        hasProfile: true,
      };
    });
  });

export const draftSignalReply = createServerFn({ method: "POST" })
  .inputValidator((d: { signalId: number; productName: string; productPitch: string; communityPlaybook?: string }) => d)
  .handler(async ({ data }): Promise<{ draft: string }> => {
    const { db, signals } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const OpenAI = (await import("openai")).default;

    const [sig] = await db.select().from(signals).where(eq(signals.id, data.signalId));
    if (!sig) throw new Error("Signal not found");

    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: { "HTTP-Referer": "http://localhost:3000", "X-Title": "BurningDemand" },
    });

    const communityContext = data.communityPlaybook
      ? `\nCommunity strategy: ${data.communityPlaybook}`
      : "";

    const prompt = `You are a founder who just shipped a product that solves this exact problem. Write a genuine Reddit reply.

Original post:
"""
${sig.rawText.slice(0, 600)}
"""

Your product: ${data.productName}
What it does: ${data.productPitch}${communityContext}

Rules:
- DO NOT start with "Hey", "Great post", or "I feel your pain"
- Lead by acknowledging the SPECIFIC pain they described (reference their exact situation)
- Mention your product naturally in 1 sentence: "I had this exact problem and built [name] - it does [specific thing]"
- Add 1-2 sentences of genuine value even if they don't use your product
- End with a soft, low-pressure CTA: "Happy to give you free access if you want to try it"
- Sound like a human, not a marketer
- Max 120 words
- No bullet points, no headers

Return ONLY the reply text, nothing else.`;

    const resp = await client.chat.completions.create({
      model: process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const draft = resp.choices[0].message.content?.trim() ?? "";

    // Persist the draft
    await db.update(signals).set({ replyDraft: draft }).where(eq(signals.id, data.signalId));

    return { draft };
  });

export const markSignalReplied = createServerFn({ method: "POST" })
  .inputValidator((d: { signalId: number; replied: boolean }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, signals } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(signals)
      .set({ repliedAt: data.replied ? new Date() : null })
      .where(eq(signals.id, data.signalId));
  });

// ── Opportunity Classifier ────────────────────────────────────────────────────

export interface OpportunityClassification {
  postId: string;
  accept: boolean;
  rejectReason?: string;

  // Workflow intelligence
  workflowGraph: string;           // "Shopify → Ads → Spreadsheet → Reconciliation"
  workflowType: string;
  isRecurring: boolean;
  recurringFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'unknown';
  manualSteps: string[];
  currentWorkaround: string;

  // Economic inefficiency
  timeWastedPerWeek: string;
  scalingBreakpoint: boolean;      // "works early, breaks at scale"
  marginLeakage: boolean;
  revenueAtRisk: boolean;

  // Buyer signals
  buyerSophistication: 'individual' | 'small-team' | 'ops-team' | 'enterprise';
  buyingStage: 'unaware' | 'workaround' | 'searching' | 'evaluating' | 'replacing';
  existingTools: string[];
  hasExistingSpend: boolean;
  switchingIntent: 'low' | 'medium' | 'high';
  failedIncumbentSignals: string[];

  // Market intelligence
  marketMaturity: 'new-category' | 'crowded' | 'wedge' | 'infrastructure' | 'overlay' | 'integration-layer';
  crossVerticalPotential: boolean;

  // Opportunity scoring - solopreneurViability is the primary metric
  solopreneurViability: number;    // 0-10
  opportunityScore: number;        // 0-10
  gtmDifficulty: number;           // 0-10 (10 = very hard)
  distributionEase: number;        // 0-10 (10 = very easy)
  marketSaturation: number;        // 0-10

  // Build + GTM
  implementationComplexity: 'hours' | 'days' | 'weeks';
  wedgeOpportunity: string;
  hiddenRisk: string;
  estimatedMrr: string;
  timeToFirstMrr: 'days' | 'weeks' | 'months';
}

export const classifyOpportunities = createServerFn({ method: "POST" })
  .inputValidator((d: { signals: Array<{ id: string; title: string; body: string; subreddit: string; matchedPattern: string }> }) => d)
  .handler(async ({ data }): Promise<OpportunityClassification[]> => {
    if (!process.env.OPENROUTER_API_KEY) return [];

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-2.0-flash-lite-001";
    const BATCH_SIZE = 5;
    const results: OpportunityClassification[] = [];

    function makeFallback(id: string, reason = "error"): OpportunityClassification {
      return {
        postId: id, accept: false, rejectReason: reason,
        workflowGraph: "", workflowType: "", isRecurring: false,
        recurringFrequency: "unknown", manualSteps: [], currentWorkaround: "none visible",
        timeWastedPerWeek: "unknown", scalingBreakpoint: false, marginLeakage: false, revenueAtRisk: false,
        buyerSophistication: "individual", buyingStage: "unaware",
        existingTools: [], hasExistingSpend: false, switchingIntent: "low", failedIncumbentSignals: [],
        marketMaturity: "new-category", crossVerticalPotential: false,
        solopreneurViability: 0, opportunityScore: 0, gtmDifficulty: 10,
        distributionEase: 0, marketSaturation: 5, implementationComplexity: "weeks",
        wedgeOpportunity: "", hiddenRisk: "", estimatedMrr: "$0/mo", timeToFirstMrr: "months",
      };
    }

    function extractJsonArray(raw: string): unknown[] {
      const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end === -1) return [];
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    const PROMPT_SYSTEM = `You are an economic inefficiency analyst specializing in solopreneur SaaS opportunities.

Your job: identify durable, recurring operational workflow pain that a solo developer can monetize quickly - NOT emotional frustration or one-off complaints.

## What makes a STRONG opportunity (solopreneurViability 8-10)
- Recurring business workflow (daily/weekly/monthly) managed manually
- Users already spending money on adjacent tools
- Incumbent tool weak or absent for this specific sub-workflow
- Narrow enough to build in hours/days
- Easy distribution: active subreddit, SEO-friendly, tool-recommendation culture
- Obvious ROI for buyer (saves time = saves money)
- Replacement wedge: does one thing the existing tool does badly

## Especially valuable signals
- "spreadsheet reconciliation" - existing SaaS + spreadsheet = wedge opportunity
- "works early, breaks at scale" - scalingBreakpoint = true, very high value
- "still exporting to spreadsheet" despite having paid tools - failedIncumbentSignals
- Manual reporting across multiple paid tools - integration gap
- Finance/ops/admin recurring workflows - budget-adjacent buyers

## Hard reject (accept: false)
- Gaming friction, fiction, personal relationships, emotional venting
- Hobby complaints with no business context
- One-time consumer annoyances
- Posts requiring heavy market education

## IMPORTANT nuances

### OP is the builder (post is self-promotion)
If the OP says "I built a tool", "looking for testers", "DM me to try it" → this is a BUILDER post.
- The underlying workflow pain is still real and worth extracting
- BUT: set marketSaturation higher (someone already built this), gtmDifficulty higher, solopreneurViability lower
- Set buyingStage to "evaluating" or "replacing" (market is active)
- The wedgeOpportunity should note "validated market, existing player"

### Commenters accuse OP of promotion (but OP is a buyer)
If commenters call spam but OP is genuinely describing their own workflow pain:
- Do NOT lower opportunityScore - this signals active buying category and real demand

## solopreneurViability rubric
10: recurring, existing spend, weak incumbent, hours to build, obvious distribution
8-9: recurring, likely budget, buildable in days, SEO-friendly market
6-7: recurring but unclear budget OR buildable but harder to reach buyers
4-5: real pain but requires weeks to build OR hard to monetize quickly
0-3: consumer, hobby, unclear buyer, requires behavior change`;

    const batches: Array<typeof data.signals> = [];
    for (let i = 0; i < data.signals.length; i += BATCH_SIZE) {
      batches.push(data.signals.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const postsText = batch
        .map((p, i) => `[${i}] id=${p.id} r/${p.subreddit}\nTitle: ${p.title}\nBody: ${p.body.slice(0, 350)}`)
        .join('\n\n---\n\n');

      const prompt = `${PROMPT_SYSTEM}

Analyze these posts and return a JSON array - one object per post:

\`\`\`json
[{
  "postId": "...",
  "accept": true|false,
  "rejectReason": null|"gaming"|"personal"|"hobby"|"emotional"|"one-time"|"consumer",

  "workflowGraph": "System A → Manual Step → System B → Spreadsheet → Output (or 'N/A')",
  "workflowType": "3-5 word label e.g. 'invoice field extraction'",
  "isRecurring": true|false,
  "recurringFrequency": "daily"|"weekly"|"monthly"|"quarterly"|"unknown",
  "manualSteps": ["step1", "step2"],
  "currentWorkaround": "spreadsheet"|"copy-paste"|"internal script"|"email"|"none visible",

  "timeWastedPerWeek": "X-Y hours/week or 'unknown'",
  "scalingBreakpoint": true|false,
  "marginLeakage": true|false,
  "revenueAtRisk": true|false,

  "buyerSophistication": "individual"|"small-team"|"ops-team"|"enterprise",
  "buyingStage": "unaware"|"workaround"|"searching"|"evaluating"|"replacing",
  "existingTools": ["tools mentioned"],
  "hasExistingSpend": true|false,
  "switchingIntent": "low"|"medium"|"high",
  "failedIncumbentSignals": ["what the current tool fails at"],

  "marketMaturity": "new-category"|"crowded"|"wedge"|"infrastructure"|"overlay"|"integration-layer",
  "crossVerticalPotential": true|false,

  "solopreneurViability": 0-10,
  "opportunityScore": 0-10,
  "gtmDifficulty": 0-10,
  "distributionEase": 0-10,
  "marketSaturation": 0-10,
  "implementationComplexity": "hours"|"days"|"weeks",

  "wedgeOpportunity": "Build [specific tool] for [narrow ICP] that [specific workflow automation]",
  "hiddenRisk": "one sentence: the specific financial or operational risk this workflow creates",
  "estimatedMrr": "$X-Y/mo per customer",
  "timeToFirstMrr": "days"|"weeks"|"months"
}]
\`\`\`

Posts:
${postsText}`;

      try {
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "BurningDemand",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 3000,
            temperature: 0.1,
          }),
          signal: AbortSignal.timeout(40_000),
        });

        if (!res.ok) { for (const sig of batch) results.push(makeFallback(sig.id)); continue; }

        const json = await res.json() as { choices: Array<{ message: { content: string } }> };
        const raw = json.choices[0]?.message?.content ?? "[]";
        let parsed: unknown[];
        try { parsed = extractJsonArray(raw); }
        catch { for (const sig of batch) results.push(makeFallback(sig.id)); continue; }

        const FREQ = ["daily", "weekly", "monthly", "quarterly", "unknown"] as const;
        const STAGE = ["unaware", "workaround", "searching", "evaluating", "replacing"] as const;
        const MATURITY = ["new-category", "crowded", "wedge", "infrastructure", "overlay", "integration-layer"] as const;
        const INTENT = ["low", "medium", "high"] as const;
        const BUYER = ["individual", "small-team", "ops-team", "enterprise"] as const;
        const COMPLEXITY = ["hours", "days", "weeks"] as const;
        const T2MRR = ["days", "weeks", "months"] as const;

        function guard<T extends string>(val: unknown, allowed: readonly T[], fallback: T): T {
          return allowed.includes(val as T) ? val as T : fallback;
        }

        for (const sig of batch) {
          const item = (parsed as Array<Record<string, unknown>>).find(r => r.postId === sig.id);
          if (!item) { results.push(makeFallback(sig.id)); continue; }
          results.push({
            postId: String(item.postId ?? sig.id),
            accept: Boolean(item.accept),
            rejectReason: item.rejectReason != null ? String(item.rejectReason) : undefined,
            workflowGraph: String(item.workflowGraph ?? ""),
            workflowType: String(item.workflowType ?? ""),
            isRecurring: Boolean(item.isRecurring),
            recurringFrequency: guard(item.recurringFrequency, FREQ, "unknown"),
            manualSteps: Array.isArray(item.manualSteps) ? (item.manualSteps as unknown[]).map(String) : [],
            currentWorkaround: String(item.currentWorkaround ?? "none visible"),
            timeWastedPerWeek: String(item.timeWastedPerWeek ?? "unknown"),
            scalingBreakpoint: Boolean(item.scalingBreakpoint),
            marginLeakage: Boolean(item.marginLeakage),
            revenueAtRisk: Boolean(item.revenueAtRisk),
            buyerSophistication: guard(item.buyerSophistication, BUYER, "individual"),
            buyingStage: guard(item.buyingStage, STAGE, "unaware"),
            existingTools: Array.isArray(item.existingTools) ? (item.existingTools as unknown[]).map(String) : [],
            hasExistingSpend: Boolean(item.hasExistingSpend),
            switchingIntent: guard(item.switchingIntent, INTENT, "low"),
            failedIncumbentSignals: Array.isArray(item.failedIncumbentSignals) ? (item.failedIncumbentSignals as unknown[]).map(String) : [],
            marketMaturity: guard(item.marketMaturity, MATURITY, "new-category"),
            crossVerticalPotential: Boolean(item.crossVerticalPotential),
            solopreneurViability: Math.min(10, Math.max(0, Number(item.solopreneurViability ?? 0))),
            opportunityScore: Math.min(10, Math.max(0, Number(item.opportunityScore ?? 0))),
            gtmDifficulty: Math.min(10, Math.max(0, Number(item.gtmDifficulty ?? 5))),
            distributionEase: Math.min(10, Math.max(0, Number(item.distributionEase ?? 5))),
            marketSaturation: Math.min(10, Math.max(0, Number(item.marketSaturation ?? 5))),
            implementationComplexity: guard(item.implementationComplexity, COMPLEXITY, "weeks"),
            wedgeOpportunity: String(item.wedgeOpportunity ?? ""),
            hiddenRisk: String(item.hiddenRisk ?? ""),
            estimatedMrr: String(item.estimatedMrr ?? "$0/mo"),
            timeToFirstMrr: guard(item.timeToFirstMrr, T2MRR, "months"),
          });
        }
      } catch {
        for (const sig of batch) results.push(makeFallback(sig.id));
      }
    }

    return results;
  });

// ── saveOpportunityFromSignal ─────────────────────────────────────────────────

export const saveOpportunityFromSignal = createServerFn({ method: "POST" })
  .inputValidator((d: {
    signal: { title: string; body: string; subreddit: string; permalink: string; authenticityScore: number };
    classification: OpportunityClassification;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, opportunities } = await import("../db/index.js");
    const { signal: s, classification: c } = data;

    const briefMd = [
      `## Workflow\n${c.workflowGraph || c.workflowType}`,
      c.wedgeOpportunity ? `## Wedge\n${c.wedgeOpportunity}` : null,
      c.hiddenRisk ? `## Risk\n${c.hiddenRisk}` : null,
      `## Economics\n${c.estimatedMrr}/customer · first MRR in ${c.timeToFirstMrr}`,
      c.existingTools.length > 0 ? `## Existing tools\n${c.existingTools.join(', ')}` : null,
      `## Source\n[${s.title}](${s.permalink})`,
    ].filter(Boolean).join('\n\n');

    const [row] = await db.insert(opportunities).values({
      title: s.title.slice(0, 200),
      painSummary: `${c.workflowType}${c.isRecurring ? ` (${c.recurringFrequency})` : ''}. ${c.currentWorkaround !== 'none visible' ? `Workaround: ${c.currentWorkaround}.` : ''} ${c.wedgeOpportunity}`.trim(),
      sector: c.buyerSophistication,
      community: `r/${s.subreddit}`,
      communityUrl: `https://reddit.com/r/${s.subreddit}`,
      scoreTotal: c.solopreneurViability,
      scoresJson: {
        solopreneurViability: c.solopreneurViability,
        opportunityScore: c.opportunityScore,
        gtmDifficulty: c.gtmDifficulty,
        distributionEase: c.distributionEase,
        marketSaturation: c.marketSaturation,
      },
      briefMd,
      market: "saas",
      status: "discovered",
      signalCount: 1,
    } as any).returning({ id: opportunities.id });

    return { id: row.id };
  });

// ── draftReplyForSignal ───────────────────────────────────────────────────────

export const draftReplyForSignal = createServerFn({ method: "POST" })
  .inputValidator((d: {
    signal: { title: string; body: string; subreddit: string };
    classification?: { workflowType?: string; wedgeOpportunity?: string; currentWorkaround?: string } | null;
  }) => d)
  .handler(async ({ data }): Promise<{ draft: string }> => {
    if (!process.env.OPENROUTER_API_KEY) return { draft: "" };

    const { signal: s, classification: c } = data;
    const model = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-2.0-flash-lite-001";

    const context = c
      ? `Workflow identified: ${c.workflowType || '(unknown)'}. Current workaround: ${c.currentWorkaround || 'unknown'}. Opportunity: ${c.wedgeOpportunity || ''}.`
      : '';

    const prompt = `You are helping a solopreneur reply to a Reddit post where someone is describing a business workflow pain.

Write a genuinely helpful reply. Lead with empathy and a practical insight. DO NOT pitch a product or mention building anything. Write as a peer who understands the problem deeply.

Post title: ${s.title}
Post body: ${s.body.slice(0, 500)}
Community: r/${s.subreddit}
${context}

Rules:
- 3-5 sentences max
- Sound human, not like an AI
- Acknowledge the specific pain from the post
- Share a concrete insight, approach, or question that adds value
- No promotional language whatsoever
- Do not mention tools you're building

Reply:`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "BurningDemand",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 300, temperature: 0.7 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) return { draft: "" };
      const json = await res.json() as { choices: Array<{ message: { content: string } }> };
      return { draft: (json.choices[0]?.message?.content ?? "").trim() };
    } catch {
      return { draft: "" };
    }
  });

// ── analyzeSignal ─────────────────────────────────────────────────────────────
// Deep analysis of a single Reddit post: fetches its comments live, combines
// with related signals from the current scan, and generates a full playbook.

export interface SignalPlaybook {
  postId: string;
  verdict: 'go' | 'maybe' | 'kill';
  verdictReason: string;
  confidence: number;
  solopreneurViability: number;
  workflowType: string;
  workflowGraph: string;
  isRecurring: boolean;
  recurringFrequency: string;
  commentEvidence: string[];     // direct quotes from comments validating pain
  fetchedComments: string[];     // all raw comments fetched from Reddit
  failedSolutions: string[];     // tools/approaches people tried that didn't work
  recurrenceNote: string;        // "seen in X other posts in this scan"
  userPersona: string;
  wedgeOpportunity: string;
  buildComplexity: 'hours' | 'days' | 'weeks';
  distributionStrategy: string;
  messagingThatWorks: string;
  messagingToAvoid: string;
  estimatedMrr: string;
  timeToFirstRevenue: string;
}

export const analyzeSignal = createServerFn({ method: "POST" })
  .inputValidator((d: {
    signal: { id: string; title: string; body: string; subreddit: string; permalink: string; matchedPattern: string };
    relatedSignals: Array<{ title: string; subreddit: string; matchedPattern: string }>;
  }) => d)
  .handler(async ({ data }): Promise<SignalPlaybook> => {
    const { signal: s, relatedSignals } = data;
    const UA = "web:burningdemand:0.1.0 (research tool)";

    const fallback = (reason: string): SignalPlaybook => ({
      postId: s.id, verdict: 'maybe', verdictReason: reason, confidence: 0,
      solopreneurViability: 0, workflowType: "", workflowGraph: "",
      isRecurring: false, recurringFrequency: "unknown",
      commentEvidence: [], fetchedComments: [], failedSolutions: [], recurrenceNote: "",
      userPersona: "", wedgeOpportunity: "", buildComplexity: "weeks",
      distributionStrategy: "", messagingThatWorks: "", messagingToAvoid: "",
      estimatedMrr: "unknown", timeToFirstRevenue: "unknown",
    });

    if (!process.env.OPENROUTER_API_KEY) return fallback("No API key");

    // ── 1. Fetch top comments from Reddit ─────────────────────────────────────
    const postId = s.id.replace(/^t3_/, '');
    let comments: string[] = [];
    try {
      const res = await fetch(
        `https://www.reddit.com/r/${encodeURIComponent(s.subreddit)}/comments/${postId}.json?limit=30&sort=top&depth=1`,
        { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) },
      );
      if (res.ok) {
        const json = await res.json() as Array<{ data: { children: Array<{ data: { body?: string; score?: number; author?: string } }> } }>;
        comments = (json[1]?.data?.children ?? [])
          .filter(c => c.data.body && !c.data.body.startsWith('[deleted]') && (c.data.score ?? 0) >= 0)
          .sort((a, b) => (b.data.score ?? 0) - (a.data.score ?? 0))
          .slice(0, 20)
          .map(c => c.data.body!.slice(0, 300).trim());
      }
    } catch { /* proceed without comments */ }

    // ── 2. Build recurrence context from scan ────────────────────────────────
    const sameSub = relatedSignals.filter(r => r.subreddit === s.subreddit);
    const samePattern = relatedSignals.filter(r => r.matchedPattern === s.matchedPattern && r.subreddit !== s.subreddit);
    const recurrenceNote = [
      sameSub.length > 0 ? `${sameSub.length} other posts in r/${s.subreddit} this scan` : null,
      samePattern.length > 0 ? `${samePattern.length} posts matching same pattern in other communities` : null,
    ].filter(Boolean).join('; ') || 'no other matching posts in this scan';

    // ── 3. LLM analysis ───────────────────────────────────────────────────────
    const commentBlock = comments.length > 0
      ? comments.map((c, i) => `  ${i + 1}. "${c}"`).join('\n')
      : '  (no comments fetched)';

    const relatedBlock = relatedSignals.slice(0, 8).map(r =>
      `  - r/${r.subreddit}: "${r.title.slice(0, 80)}"`
    ).join('\n') || '  none';

    const prompt = `You are a solopreneur SaaS analyst. Evaluate this Reddit post as a product opportunity.

POST: "${s.title}"
Community: r/${s.subreddit}
Matched pattern: "${s.matchedPattern}"
Body: ${s.body.slice(0, 500)}

TOP COMMENTS (${comments.length} fetched, sorted by upvotes):
${commentBlock}

RECURRENCE - related posts in the same scan:
${relatedBlock}
Summary: ${recurrenceNote}

---
Rules:
- Verdict "go" requires: clear recurring B2B workflow pain + evidence of existing spend + simple to build wedge
- Verdict "kill" if: hobby/personal/gaming context, one-off issue, consumer-only, or no real budget signal
- Verdict "maybe" for everything in between
- Be harsh. Most posts are noise.
- commentEvidence must be direct quotes from the comments above that confirm real pain
- failedSolutions = tools/workarounds people mention that don't fully solve it
- Bias toward solopreneur-viable ($10-500/mo per customer, buildable in days)

Return only valid JSON:
{
  "verdict": "go"|"maybe"|"kill",
  "verdictReason": "one sentence",
  "confidence": 1-10,
  "solopreneurViability": 1-10,
  "workflowType": "3-5 word label",
  "workflowGraph": "System A → Manual Step → System B → Output",
  "isRecurring": true|false,
  "recurringFrequency": "daily"|"weekly"|"monthly"|"unknown",
  "commentEvidence": ["quote1", "quote2"],
  "failedSolutions": ["tool or approach that failed"],
  "recurrenceNote": "${recurrenceNote}",
  "userPersona": "who specifically has this pain",
  "wedgeOpportunity": "Build [specific tool] for [ICP] that [specific action]",
  "buildComplexity": "hours"|"days"|"weeks",
  "distributionStrategy": "how to reach these buyers in 1-2 sentences",
  "messagingThatWorks": "language that resonates based on comments",
  "messagingToAvoid": "language that won't land",
  "estimatedMrr": "$X-Y/mo per customer",
  "timeToFirstRevenue": "days"|"weeks"|"months"
}`;

    const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "BurningDemand",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.15 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[analyzeSignal] LLM error ${res.status} model=${model}:`, errBody.slice(0, 300));
        return fallback(`LLM error ${res.status}`);
      }
      const json = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = (json.choices[0]?.message?.content ?? "").trim();
      const cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const p = JSON.parse(cleaned) as Partial<SignalPlaybook>;

      const BC = ["hours", "days", "weeks"] as const;
      const RF = ["daily", "weekly", "monthly", "unknown"] as const;
      const VD = ["go", "maybe", "kill"] as const;

      return {
        postId: s.id,
        verdict: VD.includes(p.verdict as any) ? p.verdict as any : "maybe",
        verdictReason: String(p.verdictReason ?? ""),
        confidence: Math.min(10, Math.max(0, Number(p.confidence ?? 5))),
        solopreneurViability: Math.min(10, Math.max(0, Number(p.solopreneurViability ?? 5))),
        workflowType: String(p.workflowType ?? ""),
        workflowGraph: String(p.workflowGraph ?? ""),
        isRecurring: Boolean(p.isRecurring),
        recurringFrequency: RF.includes(p.recurringFrequency as any) ? p.recurringFrequency as any : "unknown",
        commentEvidence: Array.isArray(p.commentEvidence) ? p.commentEvidence.map(String).slice(0, 4) : [],
        fetchedComments: comments,
        failedSolutions: Array.isArray(p.failedSolutions) ? p.failedSolutions.map(String).slice(0, 3) : [],
        recurrenceNote: String(p.recurrenceNote ?? recurrenceNote),
        userPersona: String(p.userPersona ?? ""),
        wedgeOpportunity: String(p.wedgeOpportunity ?? ""),
        buildComplexity: BC.includes(p.buildComplexity as any) ? p.buildComplexity as any : "days",
        distributionStrategy: String(p.distributionStrategy ?? ""),
        messagingThatWorks: String(p.messagingThatWorks ?? ""),
        messagingToAvoid: String(p.messagingToAvoid ?? ""),
        estimatedMrr: String(p.estimatedMrr ?? "unknown"),
        timeToFirstRevenue: String(p.timeToFirstRevenue ?? "unknown"),
      };
    } catch (e) {
      return fallback(String(e));
    }
  });

// ── getCrossMarketSeo ─────────────────────────────────────────────────────────

export interface CrossMarketSeo {
  pattern: string;
  seoKeywords: string[];
  searchIntent: string;
  toolType: string;
  landingPageAngle: string;
}

export const getCrossMarketSeo = createServerFn({ method: "POST" })
  .inputValidator((d: {
    clusters: Array<{
      pattern: string;
      communityCount: number;
      signalCount: number;
      subreddits: string[];
      sampleTitles: string[];
    }>;
  }) => d)
  .handler(async ({ data }): Promise<CrossMarketSeo[]> => {
    if (!process.env.OPENROUTER_API_KEY) return [];
    const model = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-2.0-flash-lite-001";

    const clusterBlock = data.clusters.map(c =>
      `Pattern: "${c.pattern}" · ${c.communityCount} communities (${c.subreddits.join(', ')}) · ${c.signalCount} signals\n` +
      `Sample titles: ${c.sampleTitles.slice(0, 3).join(' | ')}`
    ).join('\n\n');

    const prompt = `You are an SEO strategist for solopreneur SaaS micro-tools.

Each cluster below is a workflow pain appearing across multiple Reddit communities - proof of cross-market demand. For each, identify the best SEO opportunity: what would someone Google when they need a tool to solve this?

Focus on:
- Transactional keywords ("X tool", "free X generator", "X calculator", "X template")
- High-intent queries from people who have the problem RIGHT NOW
- Simple free-tool angles that rank (generators, calculators, converters, checkers)
- Keywords that attract users who'd pay $10-50/mo for more features

Clusters:
${clusterBlock}

Return only valid JSON array:
[{
  "pattern": "exact pattern string from input",
  "seoKeywords": ["keyword 1", "keyword 2", "keyword 3"],
  "searchIntent": "what the user is trying to accomplish",
  "toolType": "generator|calculator|template|tracker|converter|checker|formatter|analyzer",
  "landingPageAngle": "Free [specific tool name] for [ICP] - [one-line benefit]"
}]`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "BurningDemand",
        },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 1500, temperature: 0.2 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return [];
      const json = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = (json.choices[0]?.message?.content ?? "").trim()
        .replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(raw) as CrossMarketSeo[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

// ── deepAnalyzeSignals ────────────────────────────────────────────────────────
// Single Claude Sonnet call: fetches comments for all signals in parallel,
// then produces playbooks + SEO angles for cross-market clusters in one pass.

export const deepAnalyzeSignals = createServerFn({ method: "POST" })
  .inputValidator((d: {
    signals: Array<{ id: string; title: string; body: string; subreddit: string; permalink: string; matchedPattern: string }>;
    clusters: Array<{ pattern: string; subreddits: string[]; signalCount: number; sampleTitles: string[] }>;
  }) => d)
  .handler(async ({ data }): Promise<{ playbooks: SignalPlaybook[]; seoAngles: CrossMarketSeo[] }> => {
    if (!process.env.OPENROUTER_API_KEY) return { playbooks: [], seoAngles: [] };

    const UA = "web:burningdemand:0.1.0 (research tool)";
    const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4-5";

    // 1. Fetch comments for all signals in parallel (fire and collect)
    const withComments = await Promise.all(data.signals.map(async sig => {
      const postId = sig.id.replace(/^t3_/, '');
      let comments: string[] = [];
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${encodeURIComponent(sig.subreddit)}/comments/${postId}.json?limit=25&sort=top&depth=1`,
          { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) },
        );
        if (res.ok) {
          const json = await res.json() as Array<{ data: { children: Array<{ data: { body?: string; score?: number } }> } }>;
          comments = (json[1]?.data?.children ?? [])
            .filter(c => c.data.body && !c.data.body.startsWith('[deleted]') && (c.data.score ?? 0) >= 0)
            .sort((a, b) => (b.data.score ?? 0) - (a.data.score ?? 0))
            .slice(0, 20)
            .map(c => c.data.body!.slice(0, 250).trim());
        }
      } catch { }
      return { ...sig, comments };
    }));

    // 2. Build prompt
    const signalBlock = withComments.map((s, i) => `
### [${i}] r/${s.subreddit} - "${s.title}"
Pattern matched: "${s.matchedPattern}"
Body: ${s.body.slice(0, 400)}
Top comments (${s.comments.length}):
${s.comments.length > 0 ? s.comments.map((c, j) => `  ${j + 1}. "${c}"`).join('\n') : '  (none)'}
`).join('\n---\n');

    const clusterBlock = data.clusters.length > 0
      ? data.clusters.map(c =>
        `"${c.pattern}" - ${c.subreddits.length} communities (${c.subreddits.slice(0, 5).join(', ')}) - ${c.signalCount} signals\nSample: ${c.sampleTitles.slice(0, 2).join(' | ')}`
      ).join('\n\n')
      : 'None identified.';

    const prompt = `You are a solopreneur SaaS opportunity analyst. Be harsh - most signals are noise.

## ${withComments.length} SIGNALS WITH LIVE COMMENTS

${signalBlock}

## CROSS-MARKET CLUSTERS (same pain across multiple communities)

${clusterBlock}

---

Return ONE JSON object:

{
  "playbooks": [/* one per signal, in order */],
  "seoAngles": [/* one per cluster */]
}

### Playbook schema:
{
  "postId": "signal id",
  "verdict": "go"|"maybe"|"kill",
  "verdictReason": "one sentence, be blunt",
  "confidence": 0-10,
  "solopreneurViability": 0-10,
  "workflowType": "3-5 word label",
  "workflowGraph": "System A → Manual Step → Output",
  "isRecurring": true|false,
  "recurringFrequency": "daily"|"weekly"|"monthly"|"unknown",
  "commentEvidence": ["exact quote from comments above that confirms real pain"],
  "failedSolutions": ["specific tool or approach that failed"],
  "recurrenceNote": "summarise how many similar posts appear in this scan",
  "userPersona": "exact role + company context + current tool",
  "wedgeOpportunity": "Build [specific tool] for [exact ICP] that [specific workflow action]",
  "buildComplexity": "hours"|"days"|"weeks",
  "distributionStrategy": "exact subreddit + first two sentences of your post",
  "messagingThatWorks": "language from comments that resonates",
  "messagingToAvoid": "language that will sound like spam",
  "estimatedMrr": "$X-Y/mo per customer",
  "timeToFirstRevenue": "days"|"weeks"|"months"
}

### SEO angle schema:
{
  "pattern": "exact pattern string",
  "seoKeywords": ["transactional keyword 1", "keyword 2", "keyword 3"],
  "searchIntent": "what they're trying to do",
  "toolType": "generator|calculator|template|tracker|converter|checker|formatter|analyzer",
  "landingPageAngle": "Free [Tool Name] for [ICP] - [specific benefit]"
}

Scoring rules:
- "go" + viability 8-10: recurring B2B workflow + evidence of existing spend + buildable in hours + clear community distribution
- "kill": hobby, gaming, personal life, emotional venting, one-time consumer issue
- commentEvidence MUST be direct quotes from the comments listed above
- If comments are empty, lower confidence by 2 points
- Cross-market clusters with 3+ communities = higher SEO confidence`;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "BurningDemand",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: Math.min(32000, 4000 + data.signals.length * 800),
          temperature: 0.15,
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!res.ok) return { playbooks: [], seoAngles: [] };
      const json = await res.json() as { choices: Array<{ message: { content: string } }> };
      const raw = (json.choices[0]?.message?.content ?? "").trim()
        .replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

      const parsed = JSON.parse(raw) as { playbooks: Partial<SignalPlaybook>[]; seoAngles: Partial<CrossMarketSeo>[] };

      const BC = ["hours", "days", "weeks"] as const;
      const RF = ["daily", "weekly", "monthly", "unknown"] as const;
      const VD = ["go", "maybe", "kill"] as const;
      const T2 = ["days", "weeks", "months"] as const;
      function g<T extends string>(v: unknown, a: readonly T[], f: T): T { return a.includes(v as T) ? v as T : f; }

      const playbooks: SignalPlaybook[] = (parsed.playbooks ?? []).map((p, i) => ({
        postId: String(p.postId ?? data.signals[i]?.id ?? ""),
        verdict: g(p.verdict, VD, "maybe"),
        verdictReason: String(p.verdictReason ?? ""),
        confidence: Math.min(10, Math.max(0, Number(p.confidence ?? 5))),
        solopreneurViability: Math.min(10, Math.max(0, Number(p.solopreneurViability ?? 5))),
        workflowType: String(p.workflowType ?? ""),
        workflowGraph: String(p.workflowGraph ?? ""),
        isRecurring: Boolean(p.isRecurring),
        recurringFrequency: g(p.recurringFrequency, RF, "unknown"),
        commentEvidence: Array.isArray(p.commentEvidence) ? p.commentEvidence.map(String).slice(0, 4) : [],
        fetchedComments: [],
        failedSolutions: Array.isArray(p.failedSolutions) ? p.failedSolutions.map(String).slice(0, 3) : [],
        recurrenceNote: String(p.recurrenceNote ?? ""),
        userPersona: String(p.userPersona ?? ""),
        wedgeOpportunity: String(p.wedgeOpportunity ?? ""),
        buildComplexity: g(p.buildComplexity, BC, "days"),
        distributionStrategy: String(p.distributionStrategy ?? ""),
        messagingThatWorks: String(p.messagingThatWorks ?? ""),
        messagingToAvoid: String(p.messagingToAvoid ?? ""),
        estimatedMrr: String(p.estimatedMrr ?? ""),
        timeToFirstRevenue: g(p.timeToFirstRevenue, T2, "weeks"),
      }));

      const seoAngles: CrossMarketSeo[] = (parsed.seoAngles ?? []).map(s => ({
        pattern: String(s.pattern ?? ""),
        seoKeywords: Array.isArray(s.seoKeywords) ? s.seoKeywords.map(String) : [],
        searchIntent: String(s.searchIntent ?? ""),
        toolType: String(s.toolType ?? ""),
        landingPageAngle: String(s.landingPageAngle ?? ""),
      }));

      return { playbooks, seoAngles };
    } catch { return { playbooks: [], seoAngles: [] }; }
  });

// ── SEO Discovery ─────────────────────────────────────────────────────────────

export interface SeoKeyword {
  keyword: string;
  volume: number;       // monthly searches
  cpc: number;          // USD cost-per-click
  competition: number;  // 0–1
  competitionLevel: string; // LOW / MEDIUM / HIGH
  opportunityScore: number; // volume × cpc / (competition + 0.01)
  intent: "transactional" | "commercial" | "informational" | "navigational";
  isAiPrompt: boolean;  // question/comparison phrasing - good for AI-first content
}

function classifyIntent(kw: string): SeoKeyword["intent"] {
  const k = kw.toLowerCase();
  if (/\b(buy|price|cost|pricing|hire|download|get |sign up|subscribe|free trial)\b/.test(k)) return "transactional";
  if (/\b(best|top|review|vs |versus|alternative|compare|recommend)\b/.test(k)) return "commercial";
  if (/^(how|what|why|when|where|who|can i|is there|should i|does)\b/.test(k)) return "informational";
  if (/\b(login|sign in|dashboard|account|app\.)\b/.test(k)) return "navigational";
  return "commercial"; // default for tool/software keywords
}

function isAiPromptKw(kw: string): boolean {
  return /\b(how to|how do|what is|best way|best tool|best software|alternative|vs |free |open source|affordable|tool for|software for|app for|solution for|can i|is there)\b/i.test(kw);
}

export const discoverSeoKeywords = createServerFn({ method: "POST" })
  .inputValidator((d: {
    seeds: string[];
    maxVolume?: number;
    minCpc?: number;
    location?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ keywords: SeoKeyword[]; cost: number; error?: string }> => {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) return { keywords: [], cost: 0, error: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD not set in .env" };

    const auth = Buffer.from(`${login}:${password}`).toString("base64");
    const maxVolume = data.maxVolume ?? 10_000;
    const minCpc = data.minCpc ?? 0.3;
    const location = data.location ?? "United States";

    const seeds = data.seeds.map(s => s.trim()).filter(Boolean).slice(0, 5); // max 5 seeds per call
    if (!seeds.length) return { keywords: [], cost: 0 };

    try {
      const body = JSON.stringify(seeds.map(kw => ({
        keywords: [kw],
        location_name: location,
        language_name: "English",
      })));

      const res = await fetch(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
        {
          method: "POST",
          headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
          body,
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        return { keywords: [], cost: 0, error: `DataForSEO ${res.status}: ${txt.slice(0, 200)}` };
      }

      const json = await res.json() as { tasks?: Array<{ cost?: number; result?: Array<{ items?: Array<{ keyword: string; search_volume: number; cpc: number; competition: number; competition_level: string }> }> }> };
      let totalCost = 0;
      const seen = new Set<string>();
      const all: SeoKeyword[] = [];

      for (const task of json.tasks ?? []) {
        totalCost += task.cost ?? 0;
        for (const item of task.result?.[0]?.items ?? []) {
          if (seen.has(item.keyword)) continue;
          seen.add(item.keyword);
          const vol = item.search_volume ?? 0;
          const cpc = item.cpc ?? 0;
          const comp = item.competition ?? 0;
          if (vol > maxVolume || cpc < minCpc) continue;
          all.push({
            keyword: item.keyword,
            volume: vol,
            cpc,
            competition: comp,
            competitionLevel: item.competition_level ?? "UNKNOWN",
            opportunityScore: Math.round((vol * cpc) / (comp + 0.01)),
            intent: classifyIntent(item.keyword),
            isAiPrompt: isAiPromptKw(item.keyword),
          });
        }
      }

      all.sort((a, b) => b.opportunityScore - a.opportunityScore);
      return { keywords: all, cost: totalCost };
    } catch (e) {
      return { keywords: [], cost: 0, error: String(e) };
    }
  });
