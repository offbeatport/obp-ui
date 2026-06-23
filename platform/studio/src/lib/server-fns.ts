import { createServerFn } from "@tanstack/react-start";
import type { OpportunityStatus, OpportunityWithSignals, OpportunityInsights, ValidationChecklist } from "./types.js";

export type SignalRow = {
  id: number;
  source: string;
  rawText: string;
  url: string;
  toolName: string | null;
  scrapedAt: Date;
  postedAt: Date | null;
  processedAt: Date | null;
  projectId: number | null;
  channelId: number | null;
  projectName: string | null;
  channelType: string | null;
  opportunityId: number | null;
  opportunityTitle: string | null;
  // quality scoring
  authenticityScore: number | null;
  posterIntent: "buyer" | "seller" | "unclear" | null;
  intentSignals: string[] | null;
  // derived
  status: "selected" | "filtered" | "pending";
  filterStep: string | null;
};

export const getAllSignals = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number; projectId?: number }) => d)
  .handler(async ({ data }): Promise<SignalRow[]> => {
    const { db } = await import("../db/index.js");
    const schema = await import("../db/schema.js");
    const { eq, desc } = await import("drizzle-orm");

    const limit = data.limit ?? 5000;

    const rows = await db
      .select({
        id: schema.signals.id,
        source: schema.signals.source,
        rawText: schema.signals.rawText,
        url: schema.signals.url,
        toolName: schema.signals.toolName,
        scrapedAt: schema.signals.scrapedAt,
        postedAt: schema.signals.postedAt,
        processedAt: schema.signals.processedAt,
        projectId: schema.signals.projectId,
        channelId: schema.signals.channelId,
        projectName: schema.projects.name,
        channelType: schema.channels.type,
        opportunityId: schema.opportunitySignals.opportunityId,
        opportunityTitle: schema.opportunities.title,
        authenticityScore: schema.signals.authenticityScore,
        posterIntent: schema.signals.posterIntent,
        intentSignals: schema.signals.intentSignals,
      })
      .from(schema.signals)
      .leftJoin(schema.opportunitySignals, eq(schema.opportunitySignals.signalId, schema.signals.id))
      .leftJoin(schema.opportunities, eq(schema.opportunities.id, schema.opportunitySignals.opportunityId))
      .leftJoin(schema.projects, eq(schema.projects.id, schema.signals.projectId))
      .leftJoin(schema.channels, eq(schema.channels.id, schema.signals.channelId))
      .orderBy(desc(schema.signals.scrapedAt))
      .limit(limit);

    const now = Date.now();
    const oneYear = 365 * 86_400_000;

    return rows.map((r) => {
      let status: SignalRow["status"];
      let filterStep: string | null = null;

      if (!r.processedAt) {
        status = "pending";
      } else if (r.opportunityId) {
        status = "selected";
      } else {
        status = "filtered";
        if (r.rawText.length < 80) filterStep = "too short (<80 chars)";
        else if (now - new Date(r.scrapedAt).getTime() > oneYear) filterStep = "stale (>1 year)";
        else filterStep = "AI pre-score or clustering";
      }

      return {
        ...r,
        status,
        filterStep,
        authenticityScore: r.authenticityScore ?? null,
        posterIntent: (r.posterIntent ?? null) as "buyer" | "seller" | "unclear" | null,
        intentSignals: (r.intentSignals ?? null) as string[] | null,
      };
    });
  });

export const getOpportunityById = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<{ id: number; title: string; painSummary: string; sector: string; scoreTotal: number } | null> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        painSummary: opportunities.painSummary,
        sector: opportunities.sector,
        scoreTotal: opportunities.scoreTotal,
      })
      .from(opportunities)
      .where(eq(opportunities.id, data.id));
    return row ?? null;
  });

export const getOpportunities = createServerFn({ method: "GET" })
  .inputValidator(
    (d: { projectId?: number; sector?: string; status?: string; minScore?: number }) => d
  )
  .handler(async ({ data }): Promise<OpportunityWithSignals[]> => {
    const { db, opportunities } = await import("../db/index.js");
    const { gte, eq, and } = await import("drizzle-orm");

    const conditions = [];
    if (data.projectId !== undefined) {
      conditions.push(eq(opportunities.projectId, data.projectId));
    }
    if (data.sector && data.sector !== "all") {
      conditions.push(eq(opportunities.sector, data.sector));
    }
    if (data.status && data.status !== "all") {
      conditions.push(eq(opportunities.status, data.status as OpportunityStatus));
    }
    if (data.minScore !== undefined && data.minScore > 0) {
      conditions.push(gte(opportunities.scoreTotal, data.minScore));
    }

    const rows = await db
      .select()
      .from(opportunities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy();

    return rows.map((r) => ({
      ...r,
      status: r.status as OpportunityStatus,
      scoresJson: r.scoresJson as Record<string, number>,
      insightsJson: (r.insightsJson as OpportunityInsights) ?? null,
    }));
  });

export type TopOpportunityRow = {
  id: number;
  title: string;
  projectId: number | null;
  projectName: string | null;
  scoreTotal: number;
  signalCount: number;
  wtpCount: number;
};

export const getTopOpportunities = createServerFn({ method: "GET" })
  .handler(async (): Promise<TopOpportunityRow[]> => {
    const { db, opportunities, projects } = await import("../db/index.js");
    const { desc, eq } = await import("drizzle-orm");

    const rows = await db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        projectId: opportunities.projectId,
        projectName: projects.name,
        scoreTotal: opportunities.scoreTotal,
        signalCount: opportunities.signalCount,
        insightsJson: opportunities.insightsJson,
      })
      .from(opportunities)
      .leftJoin(projects, eq(projects.id, opportunities.projectId))
      .where(eq(opportunities.pass, false))
      .orderBy(desc(opportunities.scoreTotal))
      .limit(10);

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      projectId: r.projectId,
      projectName: r.projectName ?? null,
      scoreTotal: r.scoreTotal,
      signalCount: r.signalCount,
      wtpCount: ((r.insightsJson as { wtp_evidence?: unknown[] } | null)?.wtp_evidence?.length) ?? 0,
    }));
  });

export const getAllOpportunitiesWithProjects = createServerFn({ method: "GET" })
  .handler(async (): Promise<(OpportunityWithSignals & { projectName: string | null })[]> => {
    const { db, opportunities, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select({ opp: opportunities, projectName: projects.name })
      .from(opportunities)
      .leftJoin(projects, eq(projects.id, opportunities.projectId));

    return rows.map(({ opp, projectName }) => ({
      ...opp,
      projectName: projectName ?? null,
      status: opp.status as OpportunityStatus,
      scoresJson: opp.scoresJson as Record<string, number>,
      insightsJson: (opp.insightsJson as OpportunityInsights) ?? null,
    }));
  });

export const getOpportunity = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<(OpportunityWithSignals & { projectName: string | null }) | null> => {
    const { db, opportunities, opportunitySignals, signals, projects } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const [row] = await db
      .select({ opp: opportunities, projectName: projects.name })
      .from(opportunities)
      .leftJoin(projects, eq(projects.id, opportunities.projectId))
      .where(eq(opportunities.id, data.id));

    if (!row) return null;
    const { opp, projectName } = row;

    const linkedSignals = await db
      .select({ signal: signals })
      .from(opportunitySignals)
      .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
      .where(eq(opportunitySignals.opportunityId, data.id));

    return {
      ...opp,
      projectName: projectName ?? null,
      status: opp.status as OpportunityStatus,
      scoresJson: opp.scoresJson as Record<string, number>,
      insightsJson: (opp.insightsJson as OpportunityInsights) ?? null,
      notes: opp.notes ?? null,
      validateJson: (opp.validateJson as ValidationChecklist) ?? null,
      signals: linkedSignals.map((r) => r.signal),
    };
  });

export const updateStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; status: OpportunityStatus }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    await db
      .update(opportunities)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(opportunities.id, data.id));
  });

export const updateNotes = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; notes: string }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(opportunities)
      .set({ notes: data.notes, updatedAt: new Date() })
      .where(eq(opportunities.id, data.id));
  });

export const updateValidation = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; validate: ValidationChecklist }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(opportunities)
      .set({ validateJson: data.validate, updatedAt: new Date() })
      .where(eq(opportunities.id, data.id));
  });

export const getConfig = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ model: string }> => {
    return {
      model: process.env.OPENROUTER_MODEL ?? "",
    };
  });

export const bulkUpdateStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: number[]; status: OpportunityStatus }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { inArray } = await import("drizzle-orm");
    if (data.ids.length === 0) return;
    await db
      .update(opportunities)
      .set({ status: data.status, updatedAt: new Date() })
      .where(inArray(opportunities.id, data.ids));
  });

export const togglePass = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; pass: boolean }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(opportunities).set({ pass: data.pass, updatedAt: new Date() }).where(eq(opportunities.id, data.id));
  });

export const setOpportunityStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; status: string }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    await db.update(opportunities).set({ status: data.status as never, updatedAt: new Date() }).where(eq(opportunities.id, data.id));
  });

export const bulkSetPass = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: number[]; pass: boolean }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { inArray } = await import("drizzle-orm");
    if (data.ids.length === 0) return;
    await db.update(opportunities).set({ pass: data.pass, updatedAt: new Date() }).where(inArray(opportunities.id, data.ids));
  });

export const bulkDelete = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: number[] }) => d)
  .handler(async ({ data }): Promise<void> => {
    const { db, opportunities } = await import("../db/index.js");
    const { inArray } = await import("drizzle-orm");
    if (data.ids.length === 0) return;
    await db.delete(opportunities).where(inArray(opportunities.id, data.ids));
  });

export const generateBriefForOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<{ briefHtml: string; briefMd: string; insightsJson: OpportunityInsights; scoresJson: Record<string, number> }> => {
    const { db, opportunities, opportunitySignals, signals } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const { generateBrief, extractInsights } = await import("./ai.js");
    const { SCORE_CRITERIA } = await import("./types.js");

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, data.id));
    if (!opp) throw new Error("Opportunity not found");

    const linkedSignals = await db
      .select({ signal: signals })
      .from(opportunitySignals)
      .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
      .where(eq(opportunitySignals.opportunityId, data.id));

    const sigList = linkedSignals.map((r) => r.signal);
    let briefMd: string;
    try {
      briefMd = await generateBrief(opp.title, opp.painSummary, sigList);
    } catch (err: any) {
      throw new Error(`Brief generation failed: ${err.message}`);
    }
    const insights = await extractInsights(opp.title, briefMd);

    const existingInsights = (opp.insightsJson as OpportunityInsights) ?? {};
    const mergedInsights = { ...existingInsights, ...insights };

    // Back-fill any missing score criteria with safe defaults
    const SCORE_DEFAULTS: Record<string, number> = {
      buyer_quality: 5, pain_urgency: 5, willingness_to_pay: 5,
      viral_potential: 5, build_simplicity: 5, distribution_ready: 5,
      revenue_potential: 5, competitor_gap: 5,
      legal_safety: 8,
    };
    const existingScores = (opp.scoresJson as Record<string, number>) ?? {};
    const patchedScores: Record<string, number> = { ...existingScores };
    let scorePatched = false;
    for (const { key } of SCORE_CRITERIA) {
      if (patchedScores[key] === undefined || patchedScores[key] === 0) {
        patchedScores[key] = SCORE_DEFAULTS[key] ?? 5;
        scorePatched = true;
      }
    }

    const updatePayload: Record<string, unknown> = { briefMd, insightsJson: mergedInsights, updatedAt: new Date() };
    if (scorePatched) updatePayload.scoresJson = patchedScores;

    await db.update(opportunities)
      .set(updatePayload as Parameters<ReturnType<typeof db.update>["set"]>[0])
      .where(eq(opportunities.id, data.id));

    const { remark } = await import("remark");
    const html = await import("remark-html");
    const gfm = await import("remark-gfm");
    const file = await remark().use(gfm.default).use(html.default).process(briefMd);

    return { briefHtml: String(file), briefMd, insightsJson: mergedInsights, scoresJson: patchedScores };
  });

export const getStats = createServerFn({ method: "GET" })
  .handler(async (): Promise<{
    total: number;
    signalsScraped: number;
    signalsLinked: number;
    byStatus: Record<string, number>;
    bySource: Record<string, { total: number; linked: number }>;
  }> => {
    const { db, opportunities, signals, opportunitySignals } = await import("../db/index.js");
    const { count, eq } = await import("drizzle-orm");

    const [{ total }] = await db.select({ total: count() }).from(opportunities);
    const [{ sigTotal }] = await db.select({ sigTotal: count() }).from(signals);
    const [{ linked }] = await db.select({ linked: count() }).from(opportunitySignals);

    const allOpps = await db.select({ status: opportunities.status }).from(opportunities);
    const byStatus: Record<string, number> = { new: 0, interesting: 0, building: 0, pass: 0 };
    for (const o of allOpps) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

    // Per-source: total signals and how many ended up in an opportunity
    const sourceTotals = await db
      .select({ source: signals.source, n: count() })
      .from(signals)
      .groupBy(signals.source);

    const sourceLinked = await db
      .select({ source: signals.source, n: count() })
      .from(opportunitySignals)
      .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
      .groupBy(signals.source);

    const bySource: Record<string, { total: number; linked: number }> = {};
    for (const r of sourceTotals) bySource[r.source] = { total: Number(r.n), linked: 0 };
    for (const r of sourceLinked) {
      if (bySource[r.source]) bySource[r.source].linked = Number(r.n);
    }

    return {
      total: Number(total),
      signalsScraped: Number(sigTotal),
      signalsLinked: Number(linked),
      byStatus,
      bySource,
    };
  });

export type TrendData = { recent: number; previous: number; trend: "new" | "up" | "stable" | "fading" };

export const getOpportunityTrends = createServerFn({ method: "POST" })
  .inputValidator((data: { opportunityIds: number[] }) => data)
  .handler(async ({ data }): Promise<Record<number, TrendData>> => {
    const { db } = await import("../db/index.js");
    const schema = await import("../db/schema.js");
    const { gte, lt, and, inArray, eq, count } = await import("drizzle-orm");

    const now = Date.now();
    const t30 = new Date(now - 30 * 86_400_000);
    const t60 = new Date(now - 60 * 86_400_000);

    if (data.opportunityIds.length === 0) return {} as Record<number, TrendData>;

    const [recent, previous] = await Promise.all([
      db.select({ oppId: schema.opportunitySignals.opportunityId, cnt: count() })
        .from(schema.opportunitySignals)
        .innerJoin(schema.signals, eq(schema.signals.id, schema.opportunitySignals.signalId))
        .where(and(inArray(schema.opportunitySignals.opportunityId, data.opportunityIds), gte(schema.signals.scrapedAt, t30)))
        .groupBy(schema.opportunitySignals.opportunityId),
      db.select({ oppId: schema.opportunitySignals.opportunityId, cnt: count() })
        .from(schema.opportunitySignals)
        .innerJoin(schema.signals, eq(schema.signals.id, schema.opportunitySignals.signalId))
        .where(and(inArray(schema.opportunitySignals.opportunityId, data.opportunityIds), gte(schema.signals.scrapedAt, t60), lt(schema.signals.scrapedAt, t30)))
        .groupBy(schema.opportunitySignals.opportunityId),
    ]);

    const recentMap = Object.fromEntries(recent.map((r) => [r.oppId, Number(r.cnt)]));
    const prevMap = Object.fromEntries(previous.map((r) => [r.oppId, Number(r.cnt)]));

    const result: Record<number, TrendData> = {};
    for (const id of data.opportunityIds) {
      const r = recentMap[id] ?? 0;
      const p = prevMap[id] ?? 0;
      let trend: TrendData["trend"];
      if (p === 0 && r > 0) trend = "new";
      else if (r >= p * 1.5 && r > 1) trend = "up";
      else if (p > 1 && r < p * 0.5) trend = "fading";
      else trend = "stable";
      result[id] = { recent: r, previous: p, trend };
    }
    return result;
  });

export const getOpportunitySignals = createServerFn({ method: "GET" })
  .inputValidator((d: { opportunityId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { signals, opportunitySignals } = await import("../db/index.js");
    const { eq, desc } = await import("drizzle-orm");

    const rows = await db
      .select({ signal: signals })
      .from(opportunitySignals)
      .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
      .where(eq(opportunitySignals.opportunityId, data.opportunityId))
      .orderBy(desc(signals.scrapedAt))
      .limit(50);

    return rows.map(r => ({
      id: r.signal.id,
      source: r.signal.source,
      rawText: r.signal.rawText,
      url: r.signal.url,
      toolName: r.signal.toolName,
      scrapedAt: r.signal.scrapedAt,
      postedAt: r.signal.postedAt,
    }));
  });

export const createOpportunityFromKeyword = createServerFn({ method: "POST" })
  .inputValidator((d: {
    projectId?: number;
    keyword: string;
    searchVolume: number;
    cpc: number;
    competitionLevel: string | null;
    opportunityScore: number;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db } = await import("../db/index.js");
    const { opportunities } = await import("../db/index.js");

    const scoreTotal = Math.min(10, Math.max(0, data.opportunityScore / 10));
    const cpcSignal = data.cpc >= 5 ? 8 : data.cpc >= 2 ? 6 : data.cpc >= 0.5 ? 4 : 2;
    const volSignal = data.searchVolume >= 10000 ? 7 : data.searchVolume >= 1000 ? 5 : 3;

    const [opp] = await db.insert(opportunities).values({
      title: data.keyword,
      painSummary: `High-intent keyword: "${data.keyword}" - ${data.searchVolume.toLocaleString()} monthly searches, $${data.cpc.toFixed(2)} CPC${data.competitionLevel ? `, ${data.competitionLevel} competition` : ""}.`,
      sector: "saas",
      community: "SEO",
      communityUrl: `https://www.google.com/search?q=${encodeURIComponent(data.keyword)}`,
      scoreTotal,
      scoresJson: {
        pain_urgency: volSignal,
        willingness_to_pay: cpcSignal,
        distribution_ready: 7,
        viral_potential: 4,
        build_simplicity: 6,

        legal_safety: 9,
        demand_signal: Math.round((volSignal + cpcSignal) / 2),
      },
      insightsJson: {
        source_platforms: ["seo"],
        mrr_avg: Math.round(data.searchVolume * data.cpc * 0.01),
      },
      briefMd: "",
      status: "new",
      signalCount: 0,
      market: "saas",
      projectId: data.projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: opportunities.id });

    return { id: opp.id };
  });

export const generateAndCreateOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: { projectId: number; description: string }) => d)
  .handler(async ({ data }): Promise<{ id: number; title: string; painSummary: string; sector: string; community: string; scoreTotal: number; scoresJson: Record<string, number>; insightsJson: Record<string, any>; briefMd: string }> => {
    const { generateFullOpportunityFromDescription } = await import("./ai.js");
    const { db, opportunities } = await import("../db/index.js");

    const fields = await generateFullOpportunityFromDescription(data.description);

    const [opp] = await db.insert(opportunities).values({
      projectId: data.projectId,
      title: fields.title,
      painSummary: fields.painSummary,
      sector: fields.sector,
      community: fields.community,
      scoreTotal: fields.scoreTotal,
      scoresJson: fields.scoresJson,
      insightsJson: fields.insightsJson,
      briefMd: fields.briefMd,
      description: data.description,
      status: "new",
      pass: false,
      signalCount: 0,
    }).returning({ id: opportunities.id });

    return { id: opp.id, ...fields };
  });

export const createOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: {
    projectId: number;
    title: string;
    painSummary: string;
    sector: string;
    community: string;
  }) => d)
  .handler(async ({ data }): Promise<{ id: number }> => {
    const { db, opportunities } = await import("../db/index.js");
    const [opp] = await db.insert(opportunities).values({
      projectId: data.projectId,
      title: data.title.trim(),
      painSummary: data.painSummary.trim(),
      sector: data.sector.trim() || "saas",
      community: data.community.trim() || "general",
      scoreTotal: 0,
      scoresJson: {},
      insightsJson: {},
      briefMd: "",
      status: "new",
      pass: false,
      signalCount: 0,
    }).returning({ id: opportunities.id });
    return { id: opp.id };
  });

export const pruneOrphanedSignals = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ pruned: number }> => {
    const { db, signals, opportunitySignals } = await import("../db/index.js");
    const { notInArray, sql } = await import("drizzle-orm");

    const linked = await db
      .selectDistinct({ id: opportunitySignals.signalId })
      .from(opportunitySignals);

    const linkedIds = linked.map((r) => r.id);

    let pruned = 0;
    if (linkedIds.length === 0) {
      // No linked signals at all - delete everything
      const result = await db.delete(signals);
      pruned = (result as any).changes ?? 0;
    } else {
      const before = await db.select({ n: sql<number>`count(*)` }).from(signals);
      await db.delete(signals).where(notInArray(signals.id, linkedIds));
      const after = await db.select({ n: sql<number>`count(*)` }).from(signals);
      pruned = Number(before[0].n) - Number(after[0].n);
    }

    return { pruned };
  });

// ── Market Intelligence ────────────────────────────────────────────────────────

export type MarketProduct = {
  id: string;
  name: string;
  tagline: string;
  url: string;
  logoUrl?: string | null;
  category: string;
  mrr?: number | null;
  revenueLabel?: string | null;
  growth?: string | null;
  traction: number;
  tractionLabel: string;
  source: "ph" | "ih";
  launchedAt?: string | null;
  tags: string[];
  // Solopreneur signals
  teamSize: "solo" | "small" | "medium" | "large" | "unknown";
  funding: "bootstrapped" | "vc" | "other" | "unknown";
  isSideProject: boolean;
  cloneViable: boolean; // true = solo/small + bootstrapped + MRR $1k-$50k
};

export const getMarketProducts = createServerFn({ method: "GET" })
  .handler(async (): Promise<MarketProduct[]> => {
    const results: MarketProduct[] = [];
    const fmtMrr = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}k` : `$${n}`;

    function parseIhTags(tags: string[]): { teamSize: MarketProduct["teamSize"]; funding: MarketProduct["funding"]; isSideProject: boolean } {
      const t = new Set(tags);
      const teamSize: MarketProduct["teamSize"] =
        t.has("employees-0") ? "solo" :
          t.has("employees-under-10") ? "small" :
            t.has("employees-10-plus") ? "medium" :
              t.has("employees-50-plus") ? "large" :
                t.has("employees-200-plus") ? "large" :
                  t.has("employees-1k-plus") ? "large" : "unknown";
      const funding: MarketProduct["funding"] =
        t.has("funding-bootstrapped") || t.has("funding-self") ? "bootstrapped" :
          t.has("funding-vc") ? "vc" : "unknown";
      const isSideProject = t.has("commitment-side-project");
      return { teamSize, funding, isSideProject };
    }

    // ── 1. Indie Hackers - Algolia (public read-only key in IH page) ───────
    try {
      const ihRes = await fetch("https://N86T1R3OWZ-dsn.algolia.net/1/indexes/*/queries", {
        method: "POST",
        headers: {
          "X-Algolia-Application-Id": "N86T1R3OWZ",
          "X-Algolia-API-Key": "5140dac5e87f47346abbda1a34ee70c3",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            indexName: "products",
            // Fetch broadly, filter client-side so user can toggle sweet-spot filter
            params: "hitsPerPage=200&numericFilters=revenue>500",
          }],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (ihRes.ok) {
        const json = await ihRes.json() as any;
        const hits: any[] = json.results?.[0]?.hits ?? [];
        hits.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));

        for (const p of hits) {
          const mrr = typeof p.revenue === "number" && p.revenue > 0 ? p.revenue : null;
          const allTags: string[] = p._tags ?? [];
          const { teamSize, funding, isSideProject } = parseIhTags(allTags);
          const verticals = allTags.filter(t => t.startsWith("vertical-")).map(t => t.replace("vertical-", "").replace(/-/g, " "));
          const category = verticals[0] ?? "SaaS";
          const cloneViable = (teamSize === "solo" || teamSize === "small") &&
            funding === "bootstrapped" &&
            mrr !== null && mrr >= 1_000 && mrr <= 50_000;

          results.push({
            id: `ih-${p.productId ?? p.objectID}`,
            name: p.name ?? "",
            tagline: p.tagline ?? p.description?.slice(0, 120) ?? "",
            url: p.websiteUrl ?? `https://www.indiehackers.com/product/${p.productId ?? ""}`,
            logoUrl: p.avatarUrl ?? null,
            category,
            mrr,
            revenueLabel: mrr ? `${fmtMrr(mrr)} MRR` : null,
            growth: null,
            traction: mrr ?? 0,
            tractionLabel: mrr ? `${fmtMrr(mrr)} MRR` : "-",
            source: "ih",
            launchedAt: p.startDateStr ?? null,
            tags: verticals.slice(0, 3),
            teamSize, funding, isSideProject, cloneViable,
          });
        }
      }
    } catch { /* skip */ }

    // ── 2. Product Hunt - trending this week ───────────────────────────────
    const phToken = process.env.PRODUCTHUNT_TOKEN ?? process.env.PH_API_TOKEN;
    if (phToken) {
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
        const query = `query {
          posts(order: VOTES, postedAfter: "${sevenDaysAgo}", first: 50) {
            edges {
              node {
                id name tagline url votesCount
                thumbnail { url }
                topics { edges { node { name } } }
                createdAt
              }
            }
          }
        }`;
        const r = await fetch("https://api.producthunt.com/v2/api/graphql", {
          method: "POST",
          headers: { Authorization: `Bearer ${phToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(10_000),
        });
        if (r.ok) {
          const json = await r.json() as any;
          for (const edge of (json.data?.posts?.edges ?? [])) {
            const p = edge.node;
            const topics: string[] = (p.topics?.edges ?? []).map((e: any) => e.node?.name).filter(Boolean);
            results.push({
              id: `ph-${p.id}`,
              name: p.name,
              tagline: p.tagline ?? "",
              url: p.url,
              logoUrl: p.thumbnail?.url ?? null,
              category: topics[0] ?? "Product",
              mrr: null,
              revenueLabel: null,
              growth: null,
              traction: p.votesCount ?? 0,
              tractionLabel: `${(p.votesCount ?? 0).toLocaleString()} votes`,
              source: "ph",
              launchedAt: p.createdAt ?? null,
              tags: topics.slice(0, 4),
              teamSize: "unknown", funding: "unknown", isSideProject: false, cloneViable: false,
            });
          }
        }
      } catch { /* skip */ }
    }

    return results.sort((a, b) => {
      if (a.mrr != null && b.mrr != null) return b.mrr - a.mrr;
      if (a.mrr != null) return -1;
      if (b.mrr != null) return 1;
      return b.traction - a.traction;
    });
  });

export const selectOpportunityToBuild = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; opportunityId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, opportunities } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");
    const { productId, opportunityId } = data;

    const existing = await db.select().from(projectVersions)
      .where(and(eq(projectVersions.productId, productId), eq(projectVersions.status, "building")))
      .limit(1);
    if (existing.length > 0) {
      throw new Error(`Already building: opportunityId ${existing[0].opportunityId}`);
    }

    const allVersions = await db.select({ vn: projectVersions.versionNumber })
      .from(projectVersions).where(eq(projectVersions.productId, productId));
    const nextVersion = allVersions.length > 0 ? Math.max(...allVersions.map(v => v.vn)) + 1 : 1;

    await db.insert(projectVersions).values({
      productId, opportunityId, versionNumber: nextVersion, status: "building", startedAt: new Date(),
    });

    await db.update(opportunities).set({ status: "building", updatedAt: new Date() }).where(eq(opportunities.id, opportunityId));

    return { versionNumber: nextVersion };
  });

export const getProjectVersions = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, opportunities } = await import("../db/schema.js");
    const { eq, desc } = await import("drizzle-orm");

    const versions = await db.select({
      id: projectVersions.id,
      versionNumber: projectVersions.versionNumber,
      status: projectVersions.status,
      startedAt: projectVersions.startedAt,
      shippedAt: projectVersions.shippedAt,
      opportunityId: projectVersions.opportunityId,
      opportunityTitle: opportunities.title,
      opportunityPainSummary: opportunities.painSummary,
    })
      .from(projectVersions)
      .leftJoin(opportunities, eq(projectVersions.opportunityId, opportunities.id))
      .where(eq(projectVersions.productId, data.productId))
      .orderBy(desc(projectVersions.versionNumber));

    return versions;
  });

export const markVersionShipped = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, opportunities } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const building = await db.select().from(projectVersions)
      .where(and(eq(projectVersions.productId, data.productId), eq(projectVersions.status, "building")))
      .limit(1);

    if (building.length === 0) return { ok: true };

    const version = building[0];

    await db.update(projectVersions)
      .set({ status: "shipped", shippedAt: new Date() })
      .where(eq(projectVersions.id, version.id));

    if (version.opportunityId) {
      await db.update(opportunities)
        .set({ status: "built", updatedAt: new Date() })
        .where(eq(opportunities.id, version.opportunityId));
    }

    return { ok: true };
  });

export const createProjectVersion = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; opportunityId?: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, opportunities } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const existing = await db.select().from(projectVersions)
      .where(and(eq(projectVersions.productId, data.productId), eq(projectVersions.status, "building")))
      .limit(1);
    if (existing.length > 0) throw new Error("Already building a version.");

    const allVersions = await db.select({ vn: projectVersions.versionNumber })
      .from(projectVersions).where(eq(projectVersions.productId, data.productId));
    const nextNumber = allVersions.length > 0 ? Math.max(...allVersions.map(v => v.vn)) + 1 : 1;

    const [inserted] = await db.insert(projectVersions).values({
      productId: data.productId,
      opportunityId: data.opportunityId ?? null,
      versionNumber: nextNumber,
      status: "building",
      startedAt: new Date(),
    }).returning();

    if (data.opportunityId) {
      await db.update(opportunities)
        .set({ status: "building", updatedAt: new Date() })
        .where(eq(opportunities.id, data.opportunityId));
    }

    return { id: inserted.id, versionNumber: nextNumber };
  });

export const cancelProjectVersion = createServerFn({ method: "POST" })
  .inputValidator((d: { versionId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, opportunities } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const [version] = await db.select().from(projectVersions).where(eq(projectVersions.id, data.versionId)).limit(1);
    if (!version) return;

    await db.delete(projectVersions).where(eq(projectVersions.id, data.versionId));

    if (version.opportunityId) {
      await db.update(opportunities)
        .set({ status: "validated", updatedAt: new Date() })
        .where(eq(opportunities.id, version.opportunityId));
    }
  });

export const getDeployedFeatures = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { features, projectVersions } = await import("../db/schema.js");
    const { eq, isNull, inArray, and } = await import("drizzle-orm");

    const rows = await db.select({
      id: features.id,
      title: features.title,
      status: features.status,
      opportunityId: features.opportunityId,
      versionId: projectVersions.id,
      versionNumber: projectVersions.versionNumber,
    })
      .from(features)
      .leftJoin(projectVersions, eq(features.opportunityId, projectVersions.opportunityId))
      .where(and(
        eq(features.productId, data.productId),
        isNull(features.removedInVersionId),
        inArray(features.status, ["built", "launched"]),
      ));

    // Deduplicate - a feature may match multiple versions if opportunityId appears in multiple
    const seen = new Set<number>();
    return rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  });

export const resetV0Init = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; slug: string }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, products } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");
    const { rmSync, existsSync } = await import("fs");
    const { resolve } = await import("path");

    // Delete v0 version record
    await db.delete(projectVersions).where(
      and(eq(projectVersions.productId, data.productId), eq(projectVersions.versionNumber, 0))
    );

    // Clear repoUrl
    await db.update(products).set({ repoUrl: null as any, updatedAt: new Date() }).where(eq(products.id, data.productId));

    // Remove build dir if it exists (matches bd- prefix used by init script)
    const buildDir = resolve(process.cwd(), ".builds", `bd-${data.slug}`);
    if (existsSync(buildDir)) {
      rmSync(buildDir, { recursive: true, force: true });
    }
  });

export const resetProject = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number; slug: string }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions, products, features, opportunities } = await import("../db/schema.js");
    const { eq, inArray } = await import("drizzle-orm");
    const { rmSync, existsSync } = await import("fs");
    const { resolve } = await import("path");

    // Collect opportunity IDs linked to this product's versions so we can reset their status
    const versions = await db.select({ opportunityId: projectVersions.opportunityId })
      .from(projectVersions).where(eq(projectVersions.productId, data.productId));
    const oppIds = versions.map(v => v.opportunityId).filter(Boolean) as number[];

    // Delete all version records for this product
    await db.delete(projectVersions).where(eq(projectVersions.productId, data.productId));

    // Reset linked opportunity statuses back to "validated"
    if (oppIds.length > 0) {
      await db.update(opportunities).set({ status: "validated" }).where(inArray(opportunities.id, oppIds));
    }

    // Reset features back to "specced" and clear version linkage
    await db.update(features)
      .set({ status: "specced", removedInVersionId: null as any })
      .where(eq(features.productId, data.productId));

    // Clear all product infra fields
    await db.update(products).set({
      repoUrl: null as any,
      domain: null as any,
      cloudflareZoneId: null as any,
      vpsIp: null as any,
      designDirection: null as any,
      coolifyAppId: null as any,
      updatedAt: new Date(),
    }).where(eq(products.id, data.productId));

    // Remove build dirs (.builds/bd-{slug} and builds/opp-*)
    const buildDir = resolve(process.cwd(), ".builds", `bd-${data.slug}`);
    if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true });
  });

export const markProjectInitialized = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { projectVersions } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");
    // Upsert: if v0 already exists, just mark shipped; else insert
    const existing = await db.select().from(projectVersions)
      .where(and(eq(projectVersions.productId, data.productId), eq(projectVersions.versionNumber, 0)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(projectVersions).set({ status: "shipped", shippedAt: new Date() })
        .where(and(eq(projectVersions.productId, data.productId), eq(projectVersions.versionNumber, 0)));
    } else {
      await db.insert(projectVersions).values({ productId: data.productId, versionNumber: 0, status: "shipped", shippedAt: new Date() });
    }
  });

export const markFeatureRemoved = createServerFn({ method: "POST" })
  .inputValidator((d: { featureId: number; versionId: number }) => d)
  .handler(async ({ data }) => {
    const { db } = await import("../db/index.js");
    const { features } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");
    await db.update(features).set({ removedInVersionId: data.versionId }).where(eq(features.id, data.featureId));
  });

export const refineOpportunity = createServerFn({ method: "POST" })
  .inputValidator((d: { id: number; changeRequest: string }) => d)
  .handler(async ({ data }) => {
    const { db, opportunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");
    const { refineOpportunityWithAI, summariseRefinementChanges } = await import("./ai.js");

    const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, data.id));
    if (!opp) throw new Error("Opportunity not found");

    const oldScores = (opp.scoresJson as Record<string, number>) ?? {};
    const oldIns = (opp.insightsJson as Record<string, any>) ?? {};

    const updated = await refineOpportunityWithAI(
      {
        title: opp.title,
        painSummary: opp.painSummary,
        sector: opp.sector,
        community: opp.community,
        communityUrl: opp.communityUrl,
        scoresJson: oldScores,
        insightsJson: (opp.insightsJson as Record<string, unknown>) ?? {},
        briefMd: opp.briefMd,
      },
      data.changeRequest,
    );

    // Compute diff
    const diffs: Array<{ key: string; label: string; before: string; after: string; type: "text" | "score" }> = [];
    const addDiff = (key: string, label: string, before: string, after: string, type: "text" | "score" = "text") => {
      const b = (before ?? "").toString().trim();
      const a = (after ?? "").toString().trim();
      if (b !== a) diffs.push({ key, label, before: b, after: a, type });
    };

    addDiff("title", "Title", opp.title, updated.title);
    addDiff("painSummary", "Pain Summary", opp.painSummary, updated.painSummary);
    addDiff("sector", "Sector", opp.sector, updated.sector);
    addDiff("community", "Community", opp.community, updated.community);

    const newScores = updated.scoresJson;
    const scoreLabels: Record<string, string> = {
      pain_urgency: "Pain Urgency", willingness_to_pay: "WTP", buyer_quality: "Buyer Quality",
      viral_potential: "Viral", build_simplicity: "Build Simplicity", distribution_ready: "Distribution",
      revenue_potential: "Revenue", competitor_gap: "Competitor Gap", legal_safety: "Legal Safety",
    };
    for (const [k, label] of Object.entries(scoreLabels)) {
      if (oldScores[k] !== undefined && newScores[k] !== undefined && oldScores[k] !== newScores[k]) {
        diffs.push({ key: k, label, before: String(oldScores[k]), after: String(newScores[k]), type: "score" });
      }
    }

    const newIns = (updated.insightsJson as Record<string, any>) ?? {};
    const insLabels: Record<string, string> = {
      buyer_persona: "Buyer", price_anchor: "Price Signal", hidden_need: "Hidden Need",
      self_growth: "Self-Growth", distribution_primary: "Distribution", niche_signal: "Niche",
    };
    for (const [k, label] of Object.entries(insLabels)) {
      addDiff(k, label, String(oldIns[k] ?? ""), String(newIns[k] ?? ""));
    }
    // V1 features
    const oldFeats = (oldIns.v1_features ?? []).join(" | ");
    const newFeats = (newIns.v1_features ?? []).join(" | ");
    if (oldFeats !== newFeats) diffs.push({ key: "v1_features", label: "V1 Features", before: oldFeats, after: newFeats, type: "text" });

    // Brief
    const briefChanged = (opp.briefMd ?? "").trim() !== (updated.briefMd ?? "").trim();
    if (briefChanged) diffs.push({ key: "briefMd", label: "Playbook", before: "(previous)", after: "(regenerated)", type: "text" });

    // Ask AI to summarise changes in parallel with DB write
    const [changeSummary] = await Promise.all([
      summariseRefinementChanges(data.changeRequest, diffs.slice(0, 10)),
      db.update(opportunities).set({
        title: updated.title,
        painSummary: updated.painSummary,
        sector: updated.sector,
        community: updated.community,
        scoreTotal: updated.scoreTotal,
        scoresJson: updated.scoresJson,
        insightsJson: updated.insightsJson as any,
        briefMd: updated.briefMd,
        updatedAt: new Date(),
      }).where(eq(opportunities.id, data.id)),
    ]);

    return {
      title: updated.title,
      painSummary: updated.painSummary,
      sector: updated.sector,
      community: updated.community,
      scoreTotal: updated.scoreTotal,
      scoresJson: updated.scoresJson,
      insightsJson: updated.insightsJson as Record<string, any>,
      briefMd: updated.briefMd,
      changeSummary,
      diffs,
    };
  });

// ── generatePlaybookForIdea ───────────────────────────────────────────────────
// Creates an opportunity record from an analyzed idea, links the cluster's
// signals, then generates the full brief - reusing generateBriefForOpportunity.

export const generatePlaybookForIdea = createServerFn({ method: "POST" })
  .inputValidator((d: {
    ideaId?: number;
    // If ideaId not provided, create idea from cluster on-the-fly
    clusterId?: number;
    clusterTitle?: string;
    clusterHypothesis?: string;
    communities?: string[];
    angle?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ ideaId: number; opportunityId: number; briefHtml: string; briefMd: string }> => {
    const schema = await import("../db/index.js");
    const { db, ideas, opportunities, opportunitySignals, painClusters } = schema;
    const { eq } = await import("drizzle-orm");
    const { generateBrief, extractInsights } = await import("./ai.js");

    // Create idea on the fly if not provided
    let ideaId = data.ideaId;
    if (!ideaId) {
      const hypothesis = data.angle?.trim() || data.clusterHypothesis || data.clusterTitle || "";
      const [newIdea] = await db.insert(ideas).values({
        name: data.clusterTitle ?? "Opportunity",
        hypothesis: hypothesis || undefined,
        painClusterId: data.clusterId ?? undefined,
        selectedCommunities: data.communities ?? [],
        status: "analyzing",
        lookbackDays: 90,
      }).returning({ id: ideas.id });
      ideaId = newIdea.id;
    }

    const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId));
    if (!idea) throw new Error("Idea not found");

    const a = idea.analysisJson;

    // 1. Create opportunity from idea
    const [opp] = await db.insert(opportunities).values({
      title: idea.name,
      painSummary: idea.hypothesis ?? a?.topOpportunity ?? idea.name,
      sector: a?.userPersona ?? "solopreneur",
      community: idea.selectedCommunities?.[0] ? `r/${idea.selectedCommunities[0]}` : "reddit",
      communityUrl: idea.selectedCommunities?.[0]
        ? `https://reddit.com/r/${idea.selectedCommunities[0]}`
        : null,
      scoreTotal: a?.confidence ?? 5,
      scoresJson: {
        confidence: a?.confidence ?? 5,
        build_simplicity: a?.buildComplexity === "low" ? 8 : a?.buildComplexity === "medium" ? 5 : 3,
      },
      briefMd: "",
      market: "saas",
      status: "discovered",
      signalCount: 0,
    } as any).returning({ id: opportunities.id });

    // 2. Link signals from the pain cluster
    if (idea.painClusterId) {
      const [cluster] = await db.select().from(painClusters)
        .where(eq(painClusters.id, idea.painClusterId));
      const signalIds = (cluster?.signalIds ?? []).slice(0, 30);
      if (signalIds.length > 0) {
        await db.insert(opportunitySignals)
          .values(signalIds.map(sid => ({ opportunityId: opp.id, signalId: sid })))
          .onConflictDoNothing();
        await db.update(opportunities)
          .set({ signalCount: signalIds.length })
          .where(eq(opportunities.id, opp.id));
      }
    }

    // 3. Generate brief - same logic as generateBriefForOpportunity
    const linkedSignals = await (async () => {
      const { signals } = schema;
      const rows = await db
        .select({ signal: signals })
        .from(opportunitySignals)
        .innerJoin(signals, eq(opportunitySignals.signalId, signals.id))
        .where(eq(opportunitySignals.opportunityId, opp.id));
      return rows.map(r => r.signal);
    })();

    const briefMd = await generateBrief(idea.name, idea.hypothesis ?? idea.name, linkedSignals);
    const insights = await extractInsights(idea.name, briefMd);

    await db.update(opportunities).set({
      briefMd,
      insightsJson: insights ?? undefined,
      updatedAt: new Date(),
    } as any).where(eq(opportunities.id, opp.id));

    // Mark idea as ready. Store opportunityId so promoteIdeaToProject can link it to a project.
    await db.update(ideas).set({
      status: "ready",
      analysisJson: {
        verdict: "go",
        verdictReason: idea.hypothesis ?? idea.name,
        confidence: 7,
        topOpportunity: idea.name,
        userPersona: insights?.buyer_persona ?? "",
        distributionStrategy: insights?.distribution_primary ?? "",
        messagingThatWorks: "",
        messagingToAvoid: "",
        estimatedMrrRange: insights?.mrr_avg ? `$${insights.mrr_avg.toLocaleString()}/mo` : "",
        buildComplexity: "medium",
        timeToFirstRevenue: "weeks",
        communityInsights: [],
        opportunityId: opp.id,
      } as any,
      updatedAt: new Date(),
    } as any).where(eq(ideas.id, ideaId!));

    // 4. Render to HTML
    const { remark } = await import("remark");
    const html = await import("remark-html");
    const gfm = await import("remark-gfm");
    const file = await remark().use(gfm.default).use(html.default).process(briefMd);

    return { ideaId: ideaId!, opportunityId: opp.id, briefHtml: String(file), briefMd };
  });
