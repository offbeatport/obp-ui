import { createServerFn } from "@tanstack/react-start";
import type { Feature } from "../db/schema.js";

export type { Feature };

export interface FeatureWithStatus extends Feature { }

// ── Features ──────────────────────────────────────────────────────────────────

export const getProjectFeatures = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<Feature[]> => {
    const { db, features } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");
    return db.select().from(features).where(eq(features.productId, data.productId)).orderBy(desc(features.createdAt));
  });

export const createFeature = createServerFn({ method: "POST" })
  .inputValidator((d: {
    productId: number;
    title: string;
    buildSpec?: string;
    techStack?: string;
    estimatedHours?: number;
    opportunityId?: number;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, features } = await import("../db/index.js");
    const [row] = await db.insert(features).values({
      productId: data.productId,
      title: data.title,
      buildSpec: data.buildSpec,
      techStack: data.techStack,
      estimatedHours: data.estimatedHours,
      opportunityId: data.opportunityId ?? null,
      status: "idea",
    }).returning({ id: features.id });
    return { id: row.id };
  });

export const updateFeature = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id: number;
    title?: string;
    buildSpec?: string;
    techStack?: string;
    status?: "idea" | "specced" | "building" | "built" | "launched";
    estimatedHours?: number;
    actualHours?: number;
    buildSessionRef?: string;
  }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, features } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.buildSpec !== undefined) patch.buildSpec = data.buildSpec;
    if (data.techStack !== undefined) patch.techStack = data.techStack;
    if (data.status !== undefined) patch.status = data.status;
    if (data.estimatedHours !== undefined) patch.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) patch.actualHours = data.actualHours;
    if (data.buildSessionRef !== undefined) patch.buildSessionRef = data.buildSessionRef;
    await db.update(features).set(patch).where(eq(features.id, data.id));
  });

export const deleteFeature = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, features } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(features).where(eq(features.id, data.id));
  });

// ── Deploy config ─────────────────────────────────────────────────────────────

export const updateDeployConfig = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id: number;
    domain?: string;
    handle?: string;
    twitterHandle?: string;
    repoUrl?: string;
    coolifyAppId?: string;
    deployStatus?: "draft" | "deploying" | "deployed" | "failed";
    techStackId?: number | null;
    designDirection?: string | null;
  }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.domain !== undefined) patch.domain = data.domain;
    if (data.handle !== undefined) patch.handle = data.handle;
    if (data.twitterHandle !== undefined) patch.twitterHandle = data.twitterHandle;
    if (data.repoUrl !== undefined) patch.repoUrl = data.repoUrl;
    if (data.coolifyAppId !== undefined) patch.coolifyAppId = data.coolifyAppId;
    if (data.deployStatus !== undefined) patch.deployStatus = data.deployStatus;
    if (data.techStackId !== undefined) patch.techStackId = data.techStackId;
    if (data.designDirection !== undefined) patch.designDirection = data.designDirection;
    await db.update(products).set(patch).where(eq(products.id, data.id));
  });

export const updateMonetizeConfig = createServerFn({ method: "POST" })
  .inputValidator((d: {
    id: number;
    paymentProcessor?: string;
    pricingModel?: string;
    pricePointCents?: number | null;
    trialDays?: number | null;
    hasFree?: boolean;
    checkoutUrl?: string;
  }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, products } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.paymentProcessor !== undefined) patch.paymentProcessor = data.paymentProcessor;
    if (data.pricingModel !== undefined) patch.pricingModel = data.pricingModel;
    if (data.pricePointCents !== undefined) patch.pricePointCents = data.pricePointCents;
    if (data.trialDays !== undefined) patch.trialDays = data.trialDays;
    if (data.hasFree !== undefined) patch.hasFree = data.hasFree;
    if (data.checkoutUrl !== undefined) patch.checkoutUrl = data.checkoutUrl;
    await db.update(products).set(patch).where(eq(products.id, data.id));
  });

// ── Build prompt generator ────────────────────────────────────────────────────

export const generateBuildPrompt = createServerFn({ method: "POST" })
  .inputValidator((d: {
    productId: number;
    opportunityId?: number;
    designDirection?: string;
    domain?: string;
    appType?: string;
    designSystemId?: number;
    accentColor?: string;
    radius?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ prompt: string }> => {
    const { db, products, opportunities } = await import("../db/index.js");
    const { designSystems } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const [product] = await db.select().from(products).where(eq(products.id, data.productId));
    if (!product) throw new Error("Product not found");

    // Load full opportunity (including briefMd)
    let opp: any | null = null;
    if (data.opportunityId) {
      const [row] = await db.select().from(opportunities).where(eq(opportunities.id, data.opportunityId));
      if (row) opp = row;
    }

    // Load design system content if selected
    let ds: { name: string; content: string } | null = null;
    if (data.designSystemId) {
      const [row] = await db.select().from(designSystems).where(eq(designSystems.id, data.designSystemId));
      if (row) ds = row;
    }

    const productName = opp?.title ?? product.name;
    const ins = opp?.insightsJson ?? null;
    const domain = (data.domain ?? product.domain ?? "").trim() || "YOUR_DOMAIN";
    const accentColor = data.accentColor ?? "#6366f1";
    const radius = data.radius ?? "6px";

    // ── Opportunity sections ──────────────────────────────────────────────────

    const briefSection = opp?.briefMd?.trim()
      ? `## OPPORTUNITY BRIEF\n\n${opp.briefMd.trim()}`
      : "";

    const v1Features: string[] = ins?.v1_features ?? [];
    const mrrLow: number | null = ins?.mrr_low ?? null;
    const mrrHigh: number | null = ins?.mrr_high ?? null;
    const buyer: string = ins?.buyer_persona ?? "solopreneurs and small teams";
    const hiddenNeed: string = ins?.hidden_need ?? "";
    const selfGrowth: string = ins?.self_growth ?? "";
    const priceAnchor: string = ins?.price_anchor ?? "";
    const distributionPrimary: string = ins?.distribution_primary ?? "";
    const competitors: string[] = ins?.competitors ?? [];
    const risks: string[] = ins?.risks ?? [];
    const niché: string = ins?.niche_signal ?? "";
    const wtpEvidence: any[] = ins?.wtp_evidence ?? [];

    const analysisLines: string[] = [];
    if (opp?.painSummary) analysisLines.push(`Pain: ${opp.painSummary}`);
    if (buyer) analysisLines.push(`Target buyer: ${buyer}`);
    if (mrrLow && mrrHigh) analysisLines.push(`Revenue potential: $${(mrrLow / 1000).toFixed(0)}k–$${(mrrHigh / 1000).toFixed(0)}k/mo MRR`);
    if (priceAnchor) analysisLines.push(`Price anchor: ${priceAnchor}`);
    if (wtpEvidence.length) analysisLines.push(`WTP signals: ${wtpEvidence.length} confirmed - ${wtpEvidence.slice(0, 2).map((w: any) => w.quote ?? w.source ?? "").filter(Boolean).join("; ")}`);
    if (hiddenNeed) analysisLines.push(`Hidden need: ${hiddenNeed}`);
    if (selfGrowth) analysisLines.push(`Self-growth mechanism: ${selfGrowth}`);
    if (distributionPrimary) analysisLines.push(`Primary distribution: ${distributionPrimary}`);
    if (niché) analysisLines.push(`Niche signal: ${niché}`);
    if (competitors.length) analysisLines.push(`Competitors:\n${competitors.map((c: string) => `  - ${c}`).join("\n")}`);
    if (risks.length) analysisLines.push(`Risks:\n${risks.map((r: string) => `  - ${r}`).join("\n")}`);

    const analysisSection = analysisLines.length
      ? `## OPPORTUNITY ANALYSIS\n\n${analysisLines.join("\n")}`
      : "";

    const featureLines = v1Features.length
      ? v1Features.slice(0, 10).map((f: string) => `  - ${f}`).join("\n")
      : `  - Core feature\n  - User authentication\n  - Dashboard`;

    // ── Design system reference ───────────────────────────────────────────────

    const dsStyles = ds
      ? (ds.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1]?.trim() ?? ds.content)
      : null;
    const dsSection = dsStyles
      ? `## DESIGN SYSTEM CSS (${ds!.name})\n\nUse these CSS classes and tokens exactly - do not rename them.\n\n\`\`\`css\n${dsStyles}\n\`\`\``
      : "";

    // ── Build parameters ──────────────────────────────────────────────────────

    const paramsLines = [
      `App type:     ${data.appType ?? "Tool"}`,
      `Domain:       ${domain}`,
      `Accent color: ${accentColor}`,
      `Border radius: ${radius}`,
      ds ? `Design system: ${ds.name}` : null,
    ].filter(Boolean).join("\n");

    // ── Master prompt ─────────────────────────────────────────────────────────

    // Derive routes and happy path from V1 features + app type
    const appTypeStr = data.appType ?? "Tool";
    const baseRoutes = [`/  (landing page)`, `/auth/login`, `/auth/signup`, `/dashboard  (main app view)`, `/settings`, `/pricing`, `/admin  (ADMIN_EMAILS only)`];
    const routeLines = baseRoutes.map(r => `  ${r}`).join("\n");

    const happyPath = `User lands on / → signs up at /auth/signup → completes the core action in /dashboard → sees the value → upgrades at /pricing`;

    // Pricing line - pull from project or use placeholder
    const pricingModel = product.pricingModel ?? "subscription";
    const priceCents = product.pricePointCents;
    const priceStr = priceCents
      ? (pricingModel === "subscription" ? `$${(priceCents / 100).toFixed(0)}/month subscription` : pricingModel === "one_time" ? `$${(priceCents / 100).toFixed(0)} one-time` : pricingModel === "freemium" ? `Freemium - free tier + $${(priceCents / 100).toFixed(0)}/month paid` : `$${(priceCents / 100).toFixed(0)}`)
      : `[DEFINE PRICING - choose: free trial, subscription, one-time, or freemium]`;

    const prompt = `# BUILD: ${productName}

${briefSection}

${analysisSection}

## BUILD PARAMETERS

${paramsLines}

## PRICING

${priceStr}

## V1 FEATURES

${featureLines}

## KEY ROUTES

${routeLines}

## HAPPY PATH

${happyPath}

## TECH STACK

- TanStack Start, React.js, SQLite, Drizzle ORM, TailwindCSS, shadcn/ui, base-ui-components
- Polar.sh (payments), Sentry (errors), PostHog (analytics), better-auth (auth)
- lucide-react, recharts, remark, rehype, @tanstack/react-table, Vite, Vitest, pnpm, OpenRouter
- Single repo - no monorepo
- Deployable via Coolify (include Dockerfile)
- Zero setup beyond: pnpm install && pnpm dev
- .env and .env.example with all required values

## DESIGN RULES

- global.css defines all CSS variables: primary, secondary, accent (${accentColor}), error, bg, border, etc.
- Border radius: ${radius} - apply consistently via CSS variable
- Define h1, h2, h3, h4, body, small in global.css - use those everywhere
- Typography: "Space Grotesk", Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
- Large, light Space Grotesk for titles. Minimal text shades - differentiation via size, not color
- Flat design - no background panels. Design relies on typography and spacing
- Simple, premium, professional - not overwhelming

${dsSection}

## AUTH

- Google OAuth + email/password registration via better-auth
- Admin page at /admin - only accessible to emails listed in ADMIN_EMAILS env var

${data.appType === "API" || (opp?.title ?? "").toLowerCase().includes("ai") || (opp?.painSummary ?? "").toLowerCase().includes("ai") ? `## AI USAGE\n\n- Model: google/gemini-3.1-flash-lite-preview via OpenRouter\n- Key: OPENROUTER_API_KEY from environment (never hardcode)\n` : ""}
## BUILD ORDER

### Step 1 - Frontend first (complete this before any backend)

Build all routes listed above with hardcoded mock data.
No database, no auth, no real API calls yet.
Every page must be navigable and the full happy path demonstrable with mocks.

Deliver: \`pnpm dev\` → click through the entire happy path with mock data.
Output: list of pages built and what remains mocked.

### Step 2 - Backend + full functionality

After Step 1 is approved:
- SQLite schema with Drizzle ORM inline migrations
- Authentication: Google OAuth + email/password (better-auth)
- Replace all mocks with real server functions (createServerFn pattern)
- Polar.sh payment integration for the /pricing route
- /admin gated by ADMIN_EMAILS env var
- Sentry + PostHog
- Dockerfile for Coolify
- Complete .env and .env.example

Output: what was implemented and any remaining gaps.

## INSTRUCTIONS

1. Follow TanStack Start server function conventions (createServerFn) exactly
2. Keep it simple - shipping working code beats perfect code
3. The goal is something real users will pay for within a week`.trim()
      .replace(/\n{3,}/g, "\n\n"); // collapse excessive blank lines

    return { prompt };
  });

// ── Measure data ──────────────────────────────────────────────────────────────

export interface MeasureData {
  totalApiCostUsd: number;
  featureStatusCounts: Record<string, number>;
  feedbackItems: {
    id: number;
    source: string;
    rawText: string;
    url: string | null;
    sentiment: string | null;
    category: string | null;
    collectedAt: Date;
  }[];
  recentRuns: {
    id: number;
    channelId: number | null;
    status: string;
    signalCount: number;
    costCents: number;
    startedAt: Date;
    completedAt: Date | null;
  }[];
}

export const getProjectMeasureData = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<MeasureData> => {
    const { db, products, seoRuns, discoveryRuns, features, userFeedback } = await import("../db/index.js");
    const { eq, sum, desc } = await import("drizzle-orm");

    // Product-scoped page; discovery costs/runs belong to the parent idea.
    const [product] = await db.select({ ideaId: products.ideaId }).from(products).where(eq(products.id, data.productId));
    const ideaId = product?.ideaId ?? -1;

    const [seoCosts, drCosts, featureRows, feedback, runs] = await Promise.all([
      db.select({ total: sum(seoRuns.totalCost) }).from(seoRuns).where(eq(seoRuns.projectId, ideaId)),
      db.select({ total: sum(discoveryRuns.costCents) }).from(discoveryRuns).where(eq(discoveryRuns.projectId, ideaId)),
      db.select({ status: features.status }).from(features).where(eq(features.productId, data.productId)),
      db.select({
        id: userFeedback.id,
        source: userFeedback.source,
        rawText: userFeedback.rawText,
        url: userFeedback.url,
        sentiment: userFeedback.sentiment,
        category: userFeedback.category,
        collectedAt: userFeedback.collectedAt,
      }).from(userFeedback).where(eq(userFeedback.productId, data.productId)).orderBy(desc(userFeedback.collectedAt)).limit(50),
      db.select({
        id: discoveryRuns.id,
        channelId: discoveryRuns.channelId,
        status: discoveryRuns.status,
        signalCount: discoveryRuns.signalCount,
        costCents: discoveryRuns.costCents,
        startedAt: discoveryRuns.startedAt,
        completedAt: discoveryRuns.completedAt,
      }).from(discoveryRuns).where(eq(discoveryRuns.projectId, ideaId)).orderBy(desc(discoveryRuns.startedAt)).limit(20),
    ]);

    const seoUsd = Number(seoCosts[0]?.total ?? 0);
    const drUsd = Number(drCosts[0]?.total ?? 0) / 100;

    const featureStatusCounts: Record<string, number> = {};
    for (const { status } of featureRows) {
      featureStatusCounts[status] = (featureStatusCounts[status] ?? 0) + 1;
    }

    return {
      totalApiCostUsd: seoUsd + drUsd,
      featureStatusCounts,
      feedbackItems: feedback,
      recentRuns: runs,
    };
  });

// ── Monitor: MRR ──────────────────────────────────────────────────────────────

export const saveMrrSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; mrrCents: number }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, mrrSnapshots } = await import("../db/index.js");
    const [row] = await db.insert(mrrSnapshots).values({
      productId: data.productId,
      mrrCents: data.mrrCents,
    }).returning({ id: mrrSnapshots.id });
    return { id: row.id };
  });

// ── Monitor: CAC ──────────────────────────────────────────────────────────────

export const getCacEntries = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db, cacEntries } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");
    return db.select().from(cacEntries)
      .where(eq(cacEntries.productId, data.productId))
      .orderBy(desc(cacEntries.createdAt));
  });

export const saveCacEntry = createServerFn({ method: "POST" })
  .inputValidator((d: {
    productId: number;
    channel: string;
    spendCents: number;
    conversions: number;
    periodStart?: number;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, cacEntries } = await import("../db/index.js");
    const [row] = await db.insert(cacEntries).values({
      productId: data.productId,
      channel: data.channel,
      spendCents: data.spendCents,
      conversions: data.conversions,
      periodStart: data.periodStart ? new Date(data.periodStart) : undefined,
    }).returning({ id: cacEntries.id });
    return { id: row.id };
  });

export const deleteCacEntry = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, cacEntries } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.delete(cacEntries).where(eq(cacEntries.id, data.id));
  });

// ── Monitor: Traffic ──────────────────────────────────────────────────────────

export const saveTrafficSnapshot = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; sourcesJson: Record<string, number> }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, trafficSnapshots } = await import("../db/index.js");
    const [row] = await db.insert(trafficSnapshots).values({
      productId: data.productId,
      sourcesJson: data.sourcesJson,
    }).returning({ id: trafficSnapshots.id });
    return { id: row.id };
  });

// ── Monitor: Combined loader ───────────────────────────────────────────────────

export interface MonitorData {
  mrrSnapshots: { id: number; mrrCents: number; createdAt: Date }[];
  cacEntries: { id: number; channel: string; spendCents: number; conversions: number; periodStart: Date | null; createdAt: Date }[];
  trafficSnapshots: { id: number; sourcesJson: Record<string, number>; createdAt: Date }[];
}

export const getMonitorData = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }): Promise<MonitorData> => {
    const { db, mrrSnapshots, cacEntries, trafficSnapshots } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    const [mrr, cac, traffic] = await Promise.all([
      db.select({
        id: mrrSnapshots.id,
        mrrCents: mrrSnapshots.mrrCents,
        createdAt: mrrSnapshots.createdAt,
      }).from(mrrSnapshots)
        .where(eq(mrrSnapshots.productId, data.productId))
        .orderBy(desc(mrrSnapshots.createdAt)),

      db.select({
        id: cacEntries.id,
        channel: cacEntries.channel,
        spendCents: cacEntries.spendCents,
        conversions: cacEntries.conversions,
        periodStart: cacEntries.periodStart,
        createdAt: cacEntries.createdAt,
      }).from(cacEntries)
        .where(eq(cacEntries.productId, data.productId))
        .orderBy(desc(cacEntries.createdAt)),

      db.select({
        id: trafficSnapshots.id,
        sourcesJson: trafficSnapshots.sourcesJson,
        createdAt: trafficSnapshots.createdAt,
      }).from(trafficSnapshots)
        .where(eq(trafficSnapshots.productId, data.productId))
        .orderBy(desc(trafficSnapshots.createdAt)),
    ]);

    return { mrrSnapshots: mrr, cacEntries: cac, trafficSnapshots: traffic };
  });
