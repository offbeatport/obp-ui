/**
 * Clusters raw signals into opportunities and scores them.
 * Run: pnpm process
 */
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { clusterSignals, preScoreSignals } from "../src/lib/ai.js";
import type { Signal } from "../src/db/schema.js";
import { getMarket } from "../src/lib/markets/index.js";

const SCORE_THRESHOLD = 2.0;
const MIN_SOURCES = 1;
const MAX_SIGNALS_PER_CALL = 150;
const CLUSTER_CONCURRENCY = 5;
const BRIEF_CONCURRENCY = 4;

// Simple worker-pool concurrency limiter
async function runConcurrent<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: (T | undefined)[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results as T[];
}

async function getUnprocessedSignals(marketSlug: string | undefined, projectId: number | undefined): Promise<Signal[]> {
  const { isNull, eq, and } = await import("drizzle-orm");
  const conditions: ReturnType<typeof eq>[] = [isNull(schema.signals.processedAt) as ReturnType<typeof eq>];
  if (marketSlug) conditions.push(eq(schema.signals.market, marketSlug));
  if (projectId) conditions.push(eq(schema.signals.projectId, projectId));
  return db.select().from(schema.signals).where(and(...conditions));
}

function groupByCategory(signals: Signal[]): Record<string, Signal[]> {
  const groups: Record<string, Signal[]> = {};
  for (const sig of signals) {
    if (!groups[sig.category]) groups[sig.category] = [];
    groups[sig.category].push(sig);
  }
  return groups;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textFingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 120);
}

function deduplicateByText(signals: Signal[]): Signal[] {
  const seen = new Map<string, boolean>();
  return signals.filter((s) => {
    const fp = textFingerprint(s.rawText);
    if (seen.has(fp)) return false;
    seen.set(fp, true);
    return true;
  });
}

// LLM-based dedup: returns a map from task index → existing opportunity ID to merge into (or null = create new)
async function llmMatchOpportunities(
  oppTasks: Array<{ cluster: any; signals: any[]; batch: any[] }>,
  existingOpps: Array<{ id: number; title: string; painSummary: string }>,
  log: (line: string) => void
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  // Default: all tasks create new opportunities
  for (let i = 0; i < oppTasks.length; i++) result.set(i, null);

  if (existingOpps.length === 0 || oppTasks.length === 0) return result;

  if (oppTasks.length > 26) {
    log(`  Too many clusters (${oppTasks.length}) for single LLM call - splitting into batches of 26`);
    // Track clusters the LLM marks as "new" in earlier batches so subsequent
    // batches can recognise them as existing and avoid within-run duplicates.
    const runningExisting = [...existingOpps];

    for (let start = 0; start < oppTasks.length; start += 26) {
      const batch = oppTasks.slice(start, start + 26);
      const batchResult = await llmMatchOpportunities(batch, runningExisting, log);
      for (const [i, match] of batchResult.entries()) {
        result.set(start + i, match);
        // Clusters with no match will become new opportunities - add them to
        // runningExisting with a sentinel id of -(globalIdx+1) so the next
        // batch can match against them. id < 0 means "pending creation".
        if (match === null) {
          runningExisting.push({
            id: -(start + i + 1),
            title: batch[i].cluster.title,
            painSummary: batch[i].cluster.pain_summary,
          });
        }
      }
    }
    return result;
  }

  const existingList = existingOpps
    .map((o, i) => `[${o.id}] "${o.title}" - ${o.painSummary.slice(0, 120)}`)
    .join("\n");

  const newList = oppTasks
    .map((t, i) => `[${String.fromCharCode(65 + i)}] "${t.cluster.title}" - ${t.cluster.pain_summary.slice(0, 120)}`)
    .join("\n");

  const prompt = `You are deduplicating product opportunity records for a solo founder's demand discovery tool.

Existing opportunities:
${existingList}

New clusters to evaluate:
${newList}

For each new cluster (A, B, C...), decide if it describes the SAME problem as an existing opportunity.
SAME = same market segment AND same core pain, even if phrased differently.
DIFFERENT = different market OR different core problem. When in doubt: DIFFERENT.

Examples of SAME: "Manual invoice sending" and "Automate invoicing for freelancers" - same pain, same buyer.
Examples of DIFFERENT: "Better Jira for startups" and "Better Microsoft Teams for enterprise" - different products and segments.

Return ONLY valid JSON mapping each letter to the existing opportunity ID it matches, or null if new:
{"A": 12, "B": null, "C": 7}`;

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return result;

    const model = process.env.OPENROUTER_MODEL ?? "google/gemini-flash-lite";
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://burningdemand.com",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) return result;
    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim()) as Record<string, number | null>;

    for (let i = 0; i < oppTasks.length; i++) {
      const letter = String.fromCharCode(65 + i);
      const match = parsed[letter];
      if (typeof match === "number") {
        const exists = existingOpps.find((o) => o.id === match);
        if (exists) {
          result.set(i, match);
          log(`  ~ "${oppTasks[i].cluster.title}" → merge into existing #${match} "${exists.title}"`);
        }
      }
    }
  } catch (err) {
    log(`  ⚠ LLM dedup error: ${(err as Error).message ?? err}`);
    log("  Proceeding with all clusters as new opportunities");
  }

  return result;
}

async function createOpportunity(
  cluster: Awaited<ReturnType<typeof clusterSignals>>[number],
  signals: Signal[],
  batch: Signal[],
  projectId: number | undefined,
  marketSlug: string,
  log: (line: string) => void
) {
  const scoreTotal =
    Object.values(cluster.scores).reduce((a, b) => a + b, 0) /
    Object.values(cluster.scores).length;

  log(`\n  "${cluster.title}"`);
  log(`  Score: ${scoreTotal.toFixed(1)} | Signals: ${signals.length} | ${cluster.pain_summary}`);

  if (scoreTotal < SCORE_THRESHOLD) {
    log(`  → Below threshold (${SCORE_THRESHOLD}), skipping`);
    return false;
  }

  const wtp_evidence = (cluster.wtp_signals ?? [])
    .filter((w) => w.index >= 0 && w.index < batch.length)
    .map((w) => ({ source: batch[w.index].source, type: w.type, excerpt: w.excerpt, url: batch[w.index].url ?? null }));

  const source_platforms = [...new Set(signals.map((s) => s.source))].sort();
  const enrichedInsights = {
    wtp_evidence,
    source_platforms,
    ...(cluster.score_reasoning ? { score_reasoning: cluster.score_reasoning } : {}),
  };

  // Dedup by normalized title - merge signals into existing opportunity if found
  const { sql } = await import("drizzle-orm");
  const normalizedNew = normalizeTitle(cluster.title);
  const allOpps = await db.select({ id: schema.opportunities.id, title: schema.opportunities.title }).from(schema.opportunities);
  const existing = allOpps.find((o) => normalizeTitle(o.title) === normalizedNew);

  if (existing) {
    // Add only signals not already linked
    const { eq, inArray } = await import("drizzle-orm");
    const linked = await db
      .select({ signalId: schema.opportunitySignals.signalId })
      .from(schema.opportunitySignals)
      .where(eq(schema.opportunitySignals.opportunityId, existing.id));
    const linkedIds = new Set(linked.map((r) => r.signalId));
    const newSignals = signals.filter((s) => !linkedIds.has(s.id));

    if (newSignals.length > 0) {
      for (const sig of newSignals) {
        await db.insert(schema.opportunitySignals).values({ opportunityId: existing.id, signalId: sig.id });
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.opportunitySignals)
        .where(eq(schema.opportunitySignals.opportunityId, existing.id));
      await db.update(schema.opportunities)
        .set({ signalCount: Number(count), scoreTotal, updatedAt: new Date() })
        .where(eq(schema.opportunities.id, existing.id));
      log(`  ↺ Merged into existing #${existing.id} (+${newSignals.length} signals, now ${count})`);
    } else {
      log(`  ↺ Duplicate of #${existing.id}, no new signals - skipped`);
    }
    return true;
  }

  log(`  → Sources: ${source_platforms.join(", ")} | ${wtp_evidence.length} WTP signals`);

  // Derive projectId: use projectId if set, otherwise infer from signals if they all share one
  const inferredProjectId = projectId
    ?? (signals.every((s) => s.projectId === signals[0].projectId) ? signals[0].projectId : undefined);

  const [opp] = await db
    .insert(schema.opportunities)
    .values({
      title: cluster.title,
      painSummary: cluster.pain_summary,
      sector: cluster.sector,
      community: cluster.community,
      communityUrl: cluster.community_url,
      scoreTotal,
      scoresJson: cluster.scores,
      briefMd: "",
      insightsJson: enrichedInsights,
      status: "new",
      signalCount: signals.length,
      market: marketSlug,
      projectId: inferredProjectId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: schema.opportunities.id });

  for (const sig of signals) {
    await db.insert(schema.opportunitySignals).values({
      opportunityId: opp.id,
      signalId: sig.id,
    });
  }

  log(`  ✓ Created opportunity #${opp.id}`);
  return true;
}

export async function runProcess(opts: {
  projectId?: number;
  marketSlug?: string;
  reprocess?: boolean;
  logger?: (line: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const log = opts.logger ?? console.log;
  const signal = opts.signal;
  const projectId = opts.projectId;
  const marketSlug = opts.marketSlug;
  const reprocess = opts.reprocess ?? false;
  const market = getMarket(marketSlug);

  log("Processing signals into opportunities...\n");

  if (reprocess) {
    log("--reprocess: clearing processedAt on signals...");
    const { eq } = await import("drizzle-orm");
    if (projectId) {
      await db.update(schema.signals).set({ processedAt: null }).where(eq(schema.signals.projectId, projectId));
    } else {
      await db.update(schema.signals).set({ processedAt: null });
    }
    log("Done. Re-processing signals.\n");
  }

  const unprocessed = await getUnprocessedSignals(marketSlug, projectId);
  log(`Found ${unprocessed.length} unprocessed signals`);

  if (unprocessed.length === 0) {
    log("Nothing to process. Run scrapers first.");
    return;
  }

  // Filter 2: text fingerprint dedup - remove near-identical signals
  const deduplicated = deduplicateByText(unprocessed);
  const textDupes = deduplicated.length > 0 ? unprocessed.length - deduplicated.length : 0;
  if (textDupes > 0) log(`  ↓ Dropped ${textDupes} near-duplicate signals`);

  // Filter 3: drop stale signals (scraped more than 365 days ago)
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const fresh = deduplicated.filter((s) => s.scrapedAt >= oneYearAgo);
  const stale = deduplicated.length - fresh.length;
  if (stale > 0) log(`  ↓ Dropped ${stale} stale signals (> 365 days old)`);

  // Skip pre-scoring - let the clustering model decide quality directly
  const prescored = fresh;
  log(`  ✓ ${prescored.length} signals proceeding to clustering\n`);
  if (signal?.aborted) { log("Stopped."); return; }

  // Build blocklist from titles of opportunities the user marked "pass"
  const { eq } = await import("drizzle-orm");
  const passOpps = await db
    .select({ title: schema.opportunities.title })
    .from(schema.opportunities)
    .where(eq(schema.opportunities.status, "pass"));

  const passBlocklist = passOpps
    .map((o) => o.title.toLowerCase().replace(/[^a-z0-9 ]+/g, "").trim())
    .filter((t) => t.length > 3);
  if (passBlocklist.length > 0) {
    log(`Loaded ${passBlocklist.length} excluded topics from "pass" opportunities\n`);
  }

  const grouped = groupByCategory(prescored);

  // Build all clustering tasks across every category at once
  type ClusterTask = { category: string; batch: Signal[]; chunkIdx: number; totalChunks: number };
  const clusterTasks: ClusterTask[] = [];

  for (const [category, signals] of Object.entries(grouped)) {
    const chunks = chunk(signals, MAX_SIGNALS_PER_CALL);
    log(`── ${category.toUpperCase()} (${signals.length} signals, ${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`);
    for (let i = 0; i < chunks.length; i++) {
      clusterTasks.push({ category, batch: chunks[i], chunkIdx: i, totalChunks: chunks.length });
    }
  }

  log(`\nPhase 1: clustering ${clusterTasks.length} chunk(s) - ${CLUSTER_CONCURRENCY} at a time\n`);

  // Phase 1: cluster all chunks in parallel
  const clusterResults = await runConcurrent(
    clusterTasks.map((task) => async () => {
      const label = `[${task.category} ${task.chunkIdx + 1}/${task.totalChunks}]`;
      log(`${label} Clustering ${task.batch.length} signals...`);
      const clusters = await clusterSignals(task.batch, { passBlocklist, clusterSectors: market.clusterSectors, sourceQualityNote: market.sourceQualityNote });
      log(`${label} → ${clusters.length} cluster(s)`);

      // Mark every signal in this batch as processed so they're never re-evaluated
      const { inArray } = await import("drizzle-orm");
      const ids = task.batch.map((s) => s.id);
      await db.update(schema.signals)
        .set({ processedAt: new Date() })
        .where(inArray(schema.signals.id, ids));

      return { ...task, clusters };
    }),
    CLUSTER_CONCURRENCY
  );

  // Collect all above-threshold opportunities
  type OppTask = { cluster: Awaited<ReturnType<typeof clusterSignals>>[number]; signals: Signal[]; batch: Signal[] };
  const oppTasks: OppTask[] = [];

  for (const { batch, clusters } of clusterResults) {
    for (const cluster of clusters) {
      const signals = cluster.signal_indices
        .filter((idx) => idx >= 0 && idx < batch.length)
        .map((idx) => batch[idx]);
      if (signals.length === 0) continue;

      const scoreTotal = Object.values(cluster.scores).reduce((a, b) => a + b, 0) / Object.values(cluster.scores).length;
      if (scoreTotal < SCORE_THRESHOLD) continue;

      const distinctSources = new Set(signals.map((s) => s.source)).size;
      if (distinctSources < MIN_SOURCES) {
        log(`  ⚠ "${cluster.title}" - only ${distinctSources} source(s), needs ${MIN_SOURCES}+, skipping`);
        continue;
      }

      oppTasks.push({ cluster, signals, batch });
    }
  }

  const existingOpps = await db
    .select({ id: schema.opportunities.id, title: schema.opportunities.title, painSummary: schema.opportunities.painSummary })
    .from(schema.opportunities);

  log(`\nLLM dedup: matching ${oppTasks.length} new cluster(s) against ${existingOpps.length} existing opportunities...`);
  const matchMap = await llmMatchOpportunities(oppTasks, existingOpps, log);

  // Split: real DB merges (id > 0) | within-run sibling merges (id < 0) | genuinely new (null)
  const mergeTasks: Array<{ cluster: any; signals: any[]; batch: any[]; existingId: number }> = [];
  const siblingMergeMap = new Map<number, number[]>(); // primaryTaskIdx → [siblingTaskIdx]
  const newTasks: Array<{ cluster: any; signals: any[]; batch: any[] }> = [];

  for (let i = 0; i < oppTasks.length; i++) {
    const existingId = matchMap.get(i);
    if (existingId == null) {
      newTasks.push(oppTasks[i]);
    } else if (existingId > 0) {
      // Real existing DB opportunity - merge into it
      mergeTasks.push({ ...oppTasks[i], existingId });
    } else {
      // Negative sentinel: -(primaryTaskIdx + 1) → within-run sibling
      const primaryIdx = (-existingId) - 1;
      if (!siblingMergeMap.has(primaryIdx)) siblingMergeMap.set(primaryIdx, []);
      siblingMergeMap.get(primaryIdx)!.push(i);
      log(`  ~ "${oppTasks[i].cluster.title}" is a within-run duplicate of cluster #${primaryIdx} - signals will be merged`);
    }
  }

  // Fold sibling signals into their primary cluster before creation
  for (const [primaryIdx, siblingIdxs] of siblingMergeMap.entries()) {
    const primary = newTasks.find((t) => t === oppTasks[primaryIdx]);
    if (!primary) continue;
    for (const sibIdx of siblingIdxs) {
      primary.signals.push(...oppTasks[sibIdx].signals);
    }
  }

  // Merge signals into existing opportunities
  if (mergeTasks.length > 0) {
    log(`\nMerging signals into ${mergeTasks.length} existing opportunit${mergeTasks.length === 1 ? "y" : "ies"}...`);
    for (const { cluster, signals, existingId } of mergeTasks) {
      const { eq, inArray } = await import("drizzle-orm");
      const { sql } = await import("drizzle-orm");
      const linked = await db
        .select({ signalId: schema.opportunitySignals.signalId })
        .from(schema.opportunitySignals)
        .where(eq(schema.opportunitySignals.opportunityId, existingId));
      const linkedIds = new Set(linked.map((r) => r.signalId));
      const newSignals = signals.filter((s) => !linkedIds.has(s.id));
      if (newSignals.length > 0) {
        for (const sig of newSignals) {
          await db.insert(schema.opportunitySignals).values({ opportunityId: existingId, signalId: sig.id });
        }
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(schema.opportunitySignals)
          .where(eq(schema.opportunitySignals.opportunityId, existingId));
        const scoreTotal = Object.values(cluster.scores).reduce((a: number, b: unknown) => a + (b as number), 0) / Object.values(cluster.scores).length;
        await db.update(schema.opportunities)
          .set({ signalCount: Number(count), scoreTotal, updatedAt: new Date() })
          .where(eq(schema.opportunities.id, existingId));
        log(`  ↺ #${existingId} "+${newSignals.length} signals (${count} total)`);
      } else {
        log(`  ↺ #${existingId} - no new signals to add`);
      }
    }
  }

  if (signal?.aborted) { log("Stopped."); return; }
  log(`\nPhase 2: creating ${newTasks.length} new opportunit${newTasks.length === 1 ? "y" : "ies"} - ${BRIEF_CONCURRENCY} at a time\n`);

  // Phase 2: generate briefs + insights in parallel for genuinely new opportunities
  const outcomes = await runConcurrent(
    newTasks.map(({ cluster, signals, batch }) => () => createOpportunity(cluster, signals, batch, projectId, market.slug, log)),
    BRIEF_CONCURRENCY
  );

  const created = outcomes.filter(Boolean).length;
  const skipped = outcomes.length - created;

  log(`\n${"─".repeat(50)}`);
  log(`Done. Created: ${created} opportunities | Skipped: ${skipped}`);

  // Prune processed signals not linked to any opportunity.
  // Only touch signals where processedAt IS NOT NULL - unprocessed signals are
  // in-flight from other channels running in parallel and must not be deleted.
  const { notInArray, isNotNull, and: andFn, sql: sqlExpr, count: countFn } = await import("drizzle-orm");
  const linked = await db
    .selectDistinct({ id: schema.opportunitySignals.signalId })
    .from(schema.opportunitySignals);
  const linkedIds = linked.map((r) => r.id);
  const [{ total: totalBefore }] = await db
    .select({ total: countFn() })
    .from(schema.signals)
    .where(isNotNull(schema.signals.processedAt));
  if (linkedIds.length === 0) {
    await db.delete(schema.signals).where(isNotNull(schema.signals.processedAt));
  } else {
    await db.delete(schema.signals).where(
      andFn(isNotNull(schema.signals.processedAt), notInArray(schema.signals.id, linkedIds))
    );
  }
  const [{ total: totalAfter }] = await db
    .select({ total: countFn() })
    .from(schema.signals)
    .where(isNotNull(schema.signals.processedAt));
  const pruned = Number(totalBefore) - Number(totalAfter);
  if (pruned > 0) {
    log(`  Pruned ${pruned} orphaned signals`);
    // Recalculate signalCount for all opportunities after pruning
    const opps = await db.select({ id: schema.opportunities.id }).from(schema.opportunities);
    const { eq, count: countFn2 } = await import("drizzle-orm");
    for (const opp of opps) {
      const [{ c }] = await db
        .select({ c: countFn2() })
        .from(schema.opportunitySignals)
        .where(eq(schema.opportunitySignals.opportunityId, opp.id));
      await db
        .update(schema.opportunities)
        .set({ signalCount: Number(c) })
        .where(eq(schema.opportunities.id, opp.id));
    }
    log(`  ✓  Recalculated signalCount for all opportunities`);
  }
}

async function main() {
  await runProcess({
    projectId: process.env.PROJECT_ID ? parseInt(process.env.PROJECT_ID, 10) : undefined,
    marketSlug: process.env.MARKET_SLUG,
    reprocess: process.argv.includes("--reprocess"),
    logger: console.log,
  });
}
// Only execute when run directly as a script, not when imported as a module
if (process.argv[1]?.endsWith("process.ts") || process.argv[1]?.endsWith("process.js")) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
