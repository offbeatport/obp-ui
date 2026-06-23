// ── Opportunity Radar - server functions ──────────────────────────────────────
// Pattern follows project-fns.ts: createServerFn, dynamic db imports, Drizzle ORM.

import { createServerFn } from "@tanstack/react-start";
import OpenAI from "openai";
import { PAIN_PATTERNS } from "./reddit-patterns.js";
import { VERTICALS } from "./verticals.js";
import type { VerticalDef, VerticalExpansion, ScoredCommunity } from "./verticals.js";

// ── Re-export types so the route can import from one place ────────────────────

export type { VerticalDef, VerticalExpansion, ScoredCommunity };

// ── Additional interfaces ─────────────────────────────────────────────────────

export interface OpportunityLead {
  id: number;
  theme: string;
  description: string;
  communities: string[];
  signalCount: number;
  avgAuthScore: number;
  mrrScore: number;      // 0-10
  mrrEstimate: string;   // "$2k–15k/mo"
  problemShape: string | null;
  status: string;
}

export interface ProblemShape {
  id: number;
  shape: string;
  description: string;
  verticals: string[];
  signalCount: number;
  severity: number | null;
  mrrCeiling: string | null;
  mrrScore: number | null;
  wedgeRecommendation: string | null;
  status: string;
  lastDetectedAt: Date | null;
}

export interface MarketScanRun {
  id: number;
  verticalSlug: string;
  verticalName: string;
  status: string;
  signalCount: number;
  startedAt: Date;
  completedAt: Date | null;
}

// ── LLM helpers ───────────────────────────────────────────────────────────────

const PRESCORE_MODEL = process.env.OPENROUTER_PRESCORE_MODEL || "google/gemini-2.0-flash-lite-001";

function openRouterClient() {
  return new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "BurningDemand",
    },
  });
}

function extractJson(s: string): string {
  const m = s.match(/```json\n?([\s\S]*?)\n?```/) || s.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return m ? (m[1] || m[0]) : s;
}

function mrrEstimate(score: number): string {
  if (score >= 9) return "$20k–100k/mo";
  if (score >= 7) return "$5k–20k/mo";
  if (score >= 5) return "$1k–5k/mo";
  if (score >= 3) return "$200–1k/mo";
  return "<$200/mo";
}

const BUYER_SIGNALS = [
  "pay", "paid", "paying", "subscription", "license", "contract",
  "pricing", "worth it", "cost", "budget", "per seat", "per user",
  "per month", "/mo", "/month", "annually", "invoice", "renewal",
  "already using", "we use", "our stack", "tool for",
];

// Broad local patterns for community feed scoring.
// These intentionally differ from PAIN_PATTERNS (which are exact phrases for Reddit's
// search API). Here we want high recall - any post expressing frustration or workflow pain.
const LOCAL_PAIN_SIGNALS: RegExp[] = [
  // Manual work
  /\bmanual(ly)?\b/i,
  /\bby hand\b/i,
  /\bcopy.?paste\b/i,
  /\bspreadsheet\b/i,
  /\bexcel\b/i,
  /\bgoogle sheets?\b/i,
  /\bairtable\b.*\bmanual\b|\bmanual\b.*\bairtable\b/i,

  // Workarounds
  /\bworkaround\b/i,
  /\bhack(ish|y)?\b/i,
  /\bduct.?tape\b/i,
  /\bkludge\b/i,
  /\bbodge\b/i,
  /\bhacky\b/i,

  // Time pain
  /\btedious\b/i,
  /\btime.consuming\b/i,
  /\bhours? (every|a|per) (week|month|day)\b/i,
  /\bevery (monday|friday|week|month|morning|night)\b/i,
  /\btakes? (forever|too long|ages)\b/i,
  /\bwaste[sd]? (hours?|time|days?)\b/i,
  /\bhours? of (work|effort|my time)\b/i,
  /\brepetitive\b/i,

  // Frustration language
  /\bfrustrat(ed|ing|ion)\b/i,
  /\bannoying\b/i,
  /\bnightmare\b/i,
  /\bpain (in|point)\b/i,
  /\bhate (doing|having|this)\b/i,
  /\bsick of\b/i,
  /\btired of\b/i,
  /\bdriving me (crazy|nuts|mad)\b/i,

  // Tool gaps / demand signals
  /\bwish (there was|i had|we had|it could)\b/i,
  /\bno (good |decent |proper )?(tool|app|software|solution|way)\b/i,
  /\bis there (a |an )?(tool|app|way|solution|software)\b/i,
  /\bany(one know|thing that|tool that)\b/i,
  /\blooking for (a |an )?(tool|way|solution|software)\b/i,
  /\balternative(s)? to\b/i,
  /\bcan't believe there('s| is) no\b/i,
  /\bwhy (isn't|is there no|don't they)\b/i,
  /\bhas (anyone|to be) a better way\b/i,
  /\bnothing (works|good) for\b/i,

  // Integration / automation pain
  /\bdoesn't integrate\b/i,
  /\bno integration\b/i,
  /\bautomat(e|ion|ing)\b/i,
  /\bscript(ing|ed)?\b.*\bmanual\b|\bmanual\b.*\bscript/i,
  /\bexport(ing)?\b/i,
  /\bimport(ing)?\b/i,

  // Scale problems
  /\boutgrew?\b/i,
  /\bdoesn't scale\b/i,
  /\btoo (many|much) to (track|manage|handle)\b/i,
  /\b(can't|cannot) keep up\b/i,
];

function wait(ms: number): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ── 1. listVerticals ──────────────────────────────────────────────────────────

export const listVerticals = createServerFn({ method: "GET" })
  .handler(async (): Promise<VerticalDef[]> => VERTICALS);

// ── 2. expandVertical ─────────────────────────────────────────────────────────

export const expandVertical = createServerFn({ method: "POST" })
  .inputValidator((d: { verticalSlug?: string; customDescription?: string }) => d)
  .handler(async ({ data }): Promise<{ runId: number; expansion: VerticalExpansion }> => {
    const { db, marketScanRuns } = await import("../db/index.js");

    let name = "Custom Vertical";
    let tagline = data.customDescription ?? "A custom B2B vertical";
    let slug = "custom";

    if (data.verticalSlug) {
      const v = VERTICALS.find((x) => x.slug === data.verticalSlug);
      if (v) {
        name = v.name;
        tagline = v.tagline;
        slug = v.slug;
      }
    }

    // Insert run record
    const [runRow] = await db
      .insert(marketScanRuns)
      .values({
        verticalSlug: slug,
        verticalName: name,
        status: "running",
        signalCount: 0,
      })
      .returning({ id: marketScanRuns.id });
    const runId = runRow.id;

    const fallback: VerticalExpansion = {
      jobTitles: [],
      tools: [],
      communities: [],
      painVocabulary: [],
      budgetSignals: [],
    };

    if (!process.env.OPENROUTER_API_KEY) {
      const { eq } = await import("drizzle-orm");
      await db
        .update(marketScanRuns)
        .set({ status: "completed", expansionJson: JSON.stringify(fallback) })
        .where(eq(marketScanRuns.id, runId));
      return { runId, expansion: fallback };
    }

    const prompt = `You are a B2B market research expert. Given a vertical, return a JSON object to help discover where buyers hang out online and what language they use.

Vertical: ${name}
Description: ${tagline}

Return ONLY valid JSON (no markdown, no explanation):
{
  "jobTitles": ["10 specific job titles of people with this pain"],
  "tools": ["12 software tools they currently use - specific product names"],
  "communities": ["20 subreddit names WITHOUT r/ prefix - where these people actually post"],
  "painVocabulary": ["15 phrases people use when frustrated with manual work in this vertical"],
  "budgetSignals": ["10 phrases that indicate existing software spend - e.g. 'paying for', 'our Salesforce', 'per seat'"]
}`;

    try {
      const { eq } = await import("drizzle-orm");
      const client = openRouterClient();
      const resp = await client.chat.completions.create({
        model: PRESCORE_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      });
      const raw = resp.choices[0].message.content || "{}";
      const parsed = JSON.parse(extractJson(raw)) as Partial<VerticalExpansion>;
      const expansion: VerticalExpansion = {
        jobTitles: Array.isArray(parsed.jobTitles) ? parsed.jobTitles : [],
        tools: Array.isArray(parsed.tools) ? parsed.tools : [],
        communities: Array.isArray(parsed.communities) ? parsed.communities : [],
        painVocabulary: Array.isArray(parsed.painVocabulary) ? parsed.painVocabulary : [],
        budgetSignals: Array.isArray(parsed.budgetSignals) ? parsed.budgetSignals : [],
      };

      await db
        .update(marketScanRuns)
        .set({ status: "completed", expansionJson: JSON.stringify(expansion) })
        .where(eq(marketScanRuns.id, runId));

      return { runId, expansion };
    } catch (err) {
      console.error("[expandVertical] error:", err);
      const { eq } = await import("drizzle-orm");
      await db
        .update(marketScanRuns)
        .set({ status: "failed", error: String(err) })
        .where(eq(marketScanRuns.id, runId));
      return { runId, expansion: fallback };
    }
  });

// ── 3. scoreCommunities ───────────────────────────────────────────────────────

type AboutJson = {
  data?: {
    subscribers?: number;
    active_user_count?: number;
    accounts_active?: number;      // older Reddit field name - still returned by some subs
    accounts_active_fuzz?: number; // another variant seen in the wild
    submission_type?: string;
    over18?: boolean;
    subreddit_type?: string;
  };
};

async function fetchAbout(subreddit: string): Promise<{ subscribers: number; activeUsers: number; engagementRatio: number; submissionType: string } | null> {
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/about.json`,
      { headers: { "User-Agent": "web:burningdemand:0.1.0 (research tool)" }, signal: AbortSignal.timeout(6_000) },
    );
    if (!res.ok) return null;
    const j = await res.json() as AboutJson;
    const d = j.data;
    if (!d || d.over18) return null;
    const subs = d.subscribers ?? 0;
    // Reddit renamed accounts_active → active_user_count but some responses still use the old name
    const active = d.active_user_count ?? d.accounts_active ?? d.accounts_active_fuzz ?? 0;
    return {
      subscribers: subs,
      activeUsers: active,
      engagementRatio: subs > 0 ? active / subs : 0,
      submissionType: d.submission_type ?? "any",
    };
  } catch { return null; }
}

export const scoreCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: { subreddits: string[] }) => d)
  .handler(async ({ data }): Promise<ScoredCommunity[]> => {
    const { communitySize, solopreneurFit } = await import("./verticals.js");
    const results: ScoredCommunity[] = [];

    for (const subreddit of data.subreddits) {
      try {
        // Fetch /new.json and /about.json in parallel
        const [newRes, about] = await Promise.all([
          fetch(
            `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=50`,
            { headers: { "User-Agent": "web:burningdemand:0.1.0 (research tool)" }, signal: AbortSignal.timeout(8_000) },
          ),
          fetchAbout(subreddit),
        ]);

        const subs = about?.subscribers ?? 0;
        const active = about?.activeUsers ?? 0;
        const engRatio = about?.engagementRatio ?? 0;
        const subType = about?.submissionType ?? "any";

        if (!newRes.ok) {
          results.push({
            subreddit, painDensity: 0, buyerDensity: 0, sampleSize: 0, topPatterns: [],
            subscribers: subs, activeUsers: active, engagementRatio: engRatio,
            submissionType: subType, size: communitySize(subs), fit: 0,
            error: `HTTP ${newRes.status}`,
          });
          await wait(600);
          continue;
        }

        type RedditPost = { data: { title: string; selftext: string; created_utc?: number; score?: number } };
        const json = await newRes.json() as { data: { children: RedditPost[] } };
        const posts = json.data?.children ?? [];
        const total = posts.length;

        const matchCounts: Record<string, number> = {};
        let painMatches = 0, buyerMatches = 0;

        for (const post of posts) {
          const text = (post.data.title ?? "") + " " + (post.data.selftext ?? "");
          let hasPain = false;
          for (const re of LOCAL_PAIN_SIGNALS) {
            const m = text.match(re);
            if (m) {
              hasPain = true;
              const key = (m[0] ?? "").toLowerCase().slice(0, 30);
              matchCounts[key] = (matchCounts[key] ?? 0) + 1;
            }
          }
          if (hasPain) painMatches++;
          if (BUYER_SIGNALS.some(sig => text.toLowerCase().includes(sig))) buyerMatches++;
        }

        const topPatterns = Object.entries(matchCounts)
          .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p);

        const painDensity = total > 0 ? painMatches / total : 0;
        const buyerDensity = total > 0 ? buyerMatches / total : 0;

        // Derive activity from post timestamps.
        // Reddit doesn't expose active_user_count to unauthenticated callers,
        // so we estimate posts/day from the time span of fetched posts.
        let postsPerDay = 0;
        if (posts.length >= 2) {
          const timestamps = posts.map(p => p.data.created_utc ?? 0).filter(t => t > 0);
          if (timestamps.length >= 2) {
            const oldest = Math.min(...timestamps);
            const newest = Math.max(...timestamps);
            const spanDays = Math.max(1 / 24, (newest - oldest) / 86_400);
            postsPerDay = Math.round((timestamps.length / spanDays) * 10) / 10;
          }
        } else if (posts.length === 1) {
          postsPerDay = 1;
        }

        // engagementRatio = posts per 1k subscribers per day
        const derivedEngRatio = subs > 0 ? Math.round((postsPerDay / (subs / 1000)) * 100) / 100 : 0;

        results.push({
          subreddit,
          painDensity, buyerDensity, sampleSize: total, topPatterns,
          subscribers: subs,
          activeUsers: postsPerDay,
          engagementRatio: derivedEngRatio,
          submissionType: subType,
          size: communitySize(subs),
          fit: solopreneurFit(subs, derivedEngRatio, painDensity),
        });
      } catch (e) {
        results.push({
          subreddit, painDensity: 0, buyerDensity: 0, sampleSize: 0, topPatterns: [],
          subscribers: 0, activeUsers: 0, engagementRatio: 0,
          submissionType: "any", size: communitySize(0), fit: 0,
          error: (e as Error).message,
        });
      }
      await wait(600);
    }

    // Sort by solopreneur fit desc
    return results.sort((a, b) => b.fit - a.fit);
  });

// ── 4. trackScannedCommunities ────────────────────────────────────────────────

export const trackScannedCommunities = createServerFn({ method: "POST" })
  .inputValidator((d: {
    /** Pass full scored community objects to persist metadata; or plain slugs */
    communities?: ScoredCommunity[];
    subreddits?: string[];
    verticalSlug?: string;
  }) => d)
  .handler(async ({ data }): Promise<{ tracked: number }> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq } = await import("drizzle-orm");

    const items: { subreddit: string; meta?: ScoredCommunity }[] =
      data.communities?.map(c => ({ subreddit: c.subreddit, meta: c })) ??
      (data.subreddits ?? []).map(s => ({ subreddit: s }));

    let tracked = 0;
    for (const { subreddit, meta } of items) {
      try {
        const [existing] = await db
          .select({ id: discoveredCommunities.id })
          .from(discoveredCommunities)
          .where(eq(discoveredCommunities.subreddit, subreddit));

        const fields = {
          tracked: true as const,
          discoveryAngle: "vertical",
          discoveryReason: data.verticalSlug ?? null,
          ...(meta && {
            subscriberCount: meta.subscribers,
            activeUserCount: meta.activeUsers,
            engagementRatio: meta.engagementRatio,
          }),
          updatedAt: new Date(),
        };

        if (existing) {
          await db.update(discoveredCommunities).set(fields).where(eq(discoveredCommunities.id, existing.id));
        } else {
          await db.insert(discoveredCommunities).values({ subreddit, scanStatus: "idle", postsAnalyzed: 0, ...fields });
        }
        tracked++;
      } catch (err) {
        console.error(`[trackScannedCommunities] ${subreddit}:`, err);
      }
    }
    return { tracked };
  });

// ── 4b. getTrackedCommunities ─────────────────────────────────────────────────

export interface TrackedCommunity {
  id: number;
  subreddit: string;
  subscribers: number | null;
  activeUsers: number | null;
  engagementRatio: number | null;
  size: string;
  fit: number;
  lastScannedAt: Date | null;
  scanStatus: string;
  discoveryReason: string | null;
}

export const getTrackedCommunities = createServerFn({ method: "GET" })
  .handler(async (): Promise<TrackedCommunity[]> => {
    const { db, discoveredCommunities } = await import("../db/index.js");
    const { eq, desc, isNull } = await import("drizzle-orm");
    const { communitySize, solopreneurFit } = await import("./verticals.js");

    const rows = await db.select()
      .from(discoveredCommunities)
      .where(eq(discoveredCommunities.tracked, true))
      .orderBy(desc(discoveredCommunities.updatedAt));

    // Backfill subscriber count only - Reddit no longer returns active_user_count
    // to unauthenticated callers, so we only re-fetch when subscriberCount is missing.
    const missing = rows.filter(r => r.subscriberCount == null);
    if (missing.length > 0) {
      // Sequential with delay - parallel bursts trigger Reddit 429s
      for (const r of missing) {
        try {
          const res = await fetch(
            `https://www.reddit.com/r/${encodeURIComponent(r.subreddit)}/about.json`,
            { headers: { "User-Agent": "web:burningdemand:0.1.0 (research tool)" }, signal: AbortSignal.timeout(6_000) },
          );
          if (!res.ok) { await wait(1_000); continue; }
          const json = await res.json() as { data?: { subscribers?: number; active_user_count?: number; over18?: boolean; subreddit_type?: string } };
          const d = json.data;
          if (!d || d.over18) { await wait(600); continue; }
          const subs = d.subscribers ?? 0;
          const active = d.active_user_count ?? 0;
          const eng = subs > 0 ? active / subs : 0;
          // Persist so subsequent calls don't need to re-fetch
          await db.update(discoveredCommunities).set({
            subscriberCount: subs,
            activeUserCount: active,
            engagementRatio: eng,
            updatedAt: new Date(),
          }).where(eq(discoveredCommunities.id, r.id));
          // Mutate in-place so the return below sees fresh data
          r.subscriberCount = subs;
          r.activeUserCount = active;
          r.engagementRatio = eng;
        } catch { /* skip on error */ }
        await wait(700); // ~1 req/sec to stay under Reddit's unauthenticated limit
      }
    }

    return rows.map(r => {
      const subs = r.subscriberCount ?? 0;
      const active = r.activeUserCount ?? 0;
      const eng = r.engagementRatio ?? (subs > 0 ? active / subs : 0);
      return {
        id: r.id,
        subreddit: r.subreddit,
        subscribers: r.subscriberCount,
        activeUsers: r.activeUserCount,
        engagementRatio: eng,
        size: communitySize(subs),
        fit: solopreneurFit(subs, eng, 0),
        lastScannedAt: r.lastScannedAt,
        scanStatus: r.scanStatus ?? "idle",
        discoveryReason: r.discoveryReason,
      };
    });
  });

// ── 5. getOpportunityLeads ────────────────────────────────────────────────────

export const getOpportunityLeads = createServerFn({ method: "POST" })
  .inputValidator((d: { verticalSlug?: string; limit?: number }) => d)
  .handler(async ({ data }): Promise<OpportunityLead[]> => {
    const { db, painClusters } = await import("../db/index.js");
    const { gte, eq, desc, and, sql } = await import("drizzle-orm");
    const limit = data.limit ?? 20;

    const rows = await db
      .select()
      .from(painClusters)
      .where(and(gte(painClusters.signalCount, 2), eq(painClusters.status, "open")))
      .orderBy(desc(painClusters.signalCount))
      .limit(limit);

    return rows.map((row) => {
      const signalCount = row.signalCount ?? 0;
      const avgAuth = row.avgAuthenticityScore ?? 0;
      const clusterSize = Math.min(signalCount, 20) / 20;
      const mrrScore = Math.min(10, signalCount * 0.3 + avgAuth * 0.4 + clusterSize * 10 * 0.3);

      let communities: string[] = [];
      try {
        communities = Array.isArray(row.communities) ? row.communities : JSON.parse(row.communities as unknown as string ?? "[]");
      } catch { communities = []; }

      return {
        id: row.id,
        theme: row.theme,
        description: row.description,
        communities,
        signalCount,
        avgAuthScore: avgAuth,
        mrrScore: Math.round(mrrScore * 10) / 10,
        mrrEstimate: mrrEstimate(mrrScore),
        problemShape: null,
        status: row.status,
      };
    });
  });

// ── 6. detectProblemShapes ────────────────────────────────────────────────────

export const detectProblemShapes = createServerFn({ method: "POST" })
  .inputValidator((d: { limit?: number }) => d)
  .handler(async ({ data }): Promise<ProblemShape[]> => {
    const { db, signals, problemShapes } = await import("../db/index.js");
    const { desc, eq } = await import("drizzle-orm");

    if (!process.env.OPENROUTER_API_KEY) {
      return loadProblemShapes();
    }

    const signalRows = await db
      .select({ id: signals.id, rawText: signals.rawText, subreddit: signals.subreddit })
      .from(signals)
      .orderBy(desc(signals.scrapedAt))
      .limit(200);

    if (signalRows.length === 0) return loadProblemShapes();

    const BATCH = 50;
    const batches: typeof signalRows[] = [];
    for (let i = 0; i < signalRows.length; i += BATCH) {
      batches.push(signalRows.slice(i, i + BATCH));
    }

    type RawShape = {
      shape: string;
      description: string;
      verticals: string[];
      severity: number;
      mrrCeiling: string;
      wedgeRecommendation: string;
      signalIndices: number[];
    };

    const allShapes: RawShape[] = [];
    const client = openRouterClient();

    for (const batch of batches) {
      const signalsText = batch
        .map((s, i) => `[${i}] ${s.rawText.slice(0, 250)}`)
        .join("\n\n");

      const prompt = `Analyze these B2B operational pain signals. Identify 4-6 abstract PROBLEM SHAPES.

A problem shape is the STRUCTURAL workflow pattern, NOT the domain or tool.
Good: "periodic manual extract-transform-report between two systems"
Bad: "agency reporting problem" (too domain-specific)

Signals:
${signalsText}

Return ONLY valid JSON array:
[{
  "shape": "8 words max, workflow-focused description",
  "description": "2 sentences explaining the workflow structure",
  "verticals": ["business types where this appears"],
  "severity": 7,
  "mrrCeiling": "$5k-50k/mo",
  "wedgeRecommendation": "Start in [specific vertical] because [one reason]",
  "signalIndices": [0, 3, 7]
}]`;

      try {
        const resp = await client.chat.completions.create({
          model: PRESCORE_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 2048,
        });
        const raw = resp.choices[0].message.content || "[]";
        const parsed = JSON.parse(extractJson(raw));
        if (Array.isArray(parsed)) {
          allShapes.push(...(parsed as RawShape[]));
        }
      } catch (err) {
        console.error("[detectProblemShapes] batch error:", err);
      }
    }

    // Upsert shapes into DB
    const now = new Date();
    for (const s of allShapes) {
      if (!s.shape) continue;
      const [existing] = await db
        .select({ id: problemShapes.id })
        .from(problemShapes)
        .where(eq(problemShapes.shape, s.shape));

      const verticals = Array.isArray(s.verticals) ? s.verticals : [];
      const signalCount = Array.isArray(s.signalIndices) ? s.signalIndices.length : 0;
      const signalIds = Array.isArray(s.signalIndices)
        ? s.signalIndices.map((idx) => signalRows[idx]?.id).filter((id): id is number => id != null)
        : [];

      if (existing) {
        await db
          .update(problemShapes)
          .set({
            description: s.description ?? "",
            verticals: JSON.stringify(verticals),
            signalIds: JSON.stringify(signalIds),
            signalCount,
            severity: s.severity ?? null,
            mrrCeiling: s.mrrCeiling ?? null,
            wedgeRecommendation: s.wedgeRecommendation ?? null,
            lastDetectedAt: now,
            updatedAt: now,
          })
          .where(eq(problemShapes.id, existing.id));
      } else {
        await db.insert(problemShapes).values({
          shape: s.shape,
          description: s.description ?? "",
          verticals: JSON.stringify(verticals),
          signalIds: JSON.stringify(signalIds),
          signalCount,
          severity: s.severity ?? null,
          mrrCeiling: s.mrrCeiling ?? null,
          wedgeRecommendation: s.wedgeRecommendation ?? null,
          status: "active",
          lastDetectedAt: now,
        });
      }
    }

    return loadProblemShapes();
  });

// ── 7. getProblemShapes ───────────────────────────────────────────────────────

export const getProblemShapes = createServerFn({ method: "GET" })
  .handler(async (): Promise<ProblemShape[]> => loadProblemShapes());

async function loadProblemShapes(): Promise<ProblemShape[]> {
  const { db, problemShapes } = await import("../db/index.js");
  const { eq, desc } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(problemShapes)
    .where(eq(problemShapes.status, "active"))
    .orderBy(desc(problemShapes.signalCount));

  return rows.map((row) => {
    let verticals: string[] = [];
    try {
      const v = row.verticals;
      verticals = Array.isArray(v) ? v : (typeof v === "string" ? JSON.parse(v) : []);
    } catch { verticals = []; }

    return {
      id: row.id,
      shape: row.shape,
      description: row.description,
      verticals,
      signalCount: row.signalCount,
      severity: row.severity,
      mrrCeiling: row.mrrCeiling,
      mrrScore: row.mrrScore,
      wedgeRecommendation: row.wedgeRecommendation,
      status: row.status,
      lastDetectedAt: row.lastDetectedAt,
    };
  });
}

// ── 8. getMarketScanRuns ──────────────────────────────────────────────────────

export const getMarketScanRuns = createServerFn({ method: "GET" })
  .handler(async (): Promise<MarketScanRun[]> => {
    const { db, marketScanRuns } = await import("../db/index.js");
    const { desc } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(marketScanRuns)
      .orderBy(desc(marketScanRuns.startedAt))
      .limit(50);

    return rows.map((row) => ({
      id: row.id,
      verticalSlug: row.verticalSlug,
      verticalName: row.verticalName,
      status: row.status,
      signalCount: row.signalCount,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    }));
  });
