/**
 * Fetches keyword opportunities from DataForSEO Google Ads API.
 * Discovers related keywords for a seed keyword, filtered by volume/CPC thresholds.
 * Stores results in keyword_opportunities table, grouped by seo_runs.
 *
 * Usage: pnpm tsx scripts/scrape-dataforseo.ts "seed keyword" [maxVolume] [minCpc]
 * Example: pnpm tsx scripts/scrape-dataforseo.ts "portfolio attribution" 2000 0.5
 *
 * Requires in .env:
 *   DATAFORSEO_LOGIN=your@email.com
 *   DATAFORSEO_PASSWORD=your_api_password
 */
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env") });

import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error("DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD must be set in .env");
  process.exit(1);
}

const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

// Question/prompt-style indicators - these signal "AI prompt search" queries
const AI_PROMPT_PATTERNS = [
  "how to", "how do", "what is", "what are", "what's", "why is", "why does",
  "best way to", "best tool", "best software", "best platform", "best app",
  "alternative to", "alternatives to", "vs ", " vs ", "compare ", "comparison",
  "instead of", "replace ", "without ", "tool for ", "software for ", "app for ",
  "solution for ", "can i ", "should i ", "is there a ", "is there an ",
  "free ", "open source", "affordable", "cheap", "pricing", "cost of",
];

function isAiPrompt(keyword: string): boolean {
  const lower = keyword.toLowerCase();
  return AI_PROMPT_PATTERNS.some((p) => lower.includes(p));
}

function calcOpportunityScore(volume: number, cpc: number, competition: number): number {
  return (volume * cpc) / (competition + 0.01);
}

interface DataForSEOKeyword {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  competition_level: string | null;
  impressions_per_day: number | null;
}

interface DataForSEOResult {
  items?: DataForSEOKeyword[];
}

interface DataForSEOTask {
  cost?: number;
  result?: DataForSEOResult[];
}

interface DataForSEOResponse {
  tasks?: DataForSEOTask[];
}

async function fetchKeywords(
  seedKeyword: string
): Promise<{ keywords: DataForSEOKeyword[]; cost: number }> {
  const body = JSON.stringify([
    {
      keywords: [seedKeyword],
      location_name: "United States",
      language_name: "English",
    },
  ]);

  const res = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = (await res.json()) as DataForSEOResponse;
  const task = json.tasks?.[0];
  const cost = task?.cost ?? 0;
  const items = task?.result?.[0]?.items ?? [];

  return { keywords: items, cost };
}

async function main() {
  const [, , seedArg, maxVolArg, minCpcArg] = process.argv;

  if (!seedArg) {
    console.error("Usage: pnpm tsx scripts/scrape-dataforseo.ts <seed_keyword> [maxVolume] [minCpc]");
    process.exit(1);
  }

  const seedKeyword = seedArg.trim();
  const maxVolume = parseInt(maxVolArg ?? "1000", 10);
  const minCpc = parseFloat(minCpcArg ?? "1.0");
  const marketSlug = process.env.MARKET_SLUG ?? "saas";

  console.log(`\n[DataForSEO] Seed: "${seedKeyword}" | maxVol: ${maxVolume} | minCPC: $${minCpc} | market: ${marketSlug}\n`);

  let keywords: DataForSEOKeyword[];
  let apiCost: number;

  try {
    ({ keywords, cost: apiCost } = await fetchKeywords(seedKeyword));
  } catch (err) {
    console.error(`[error] ${String(err)}`);
    process.exit(1);
  }

  console.log(`  Raw keywords returned: ${keywords.length}`);
  console.log(`  API cost: $${apiCost.toFixed(4)}`);

  // Apply filters
  const filtered = keywords.filter(
    (k) => k.search_volume <= maxVolume && k.cpc >= minCpc
  );

  console.log(`  After filter (vol ≤${maxVolume}, CPC ≥$${minCpc}): ${filtered.length}`);

  if (filtered.length === 0) {
    console.log("  No keywords matched thresholds - done.");
    process.exit(0);
  }

  // Score and sort
  const scored = filtered
    .map((k) => ({
      ...k,
      opportunityScore: calcOpportunityScore(k.search_volume, k.cpc, k.competition ?? 0),
      isAiPrompt: isAiPrompt(k.keyword),
    }))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Insert seo_run record
  const [run] = await db
    .insert(schema.seoRuns)
    .values({
      market: marketSlug,
      seedKeyword,
      totalKeywords: scored.length,
      totalCost: apiCost,
      maxVolume,
      minCpc,
    })
    .returning({ id: schema.seoRuns.id });

  // Insert keywords
  for (const kw of scored) {
    await db.insert(schema.keywordOpportunities).values({
      runId: run.id,
      keyword: kw.keyword,
      searchVolume: kw.search_volume,
      cpc: kw.cpc,
      competition: kw.competition ?? 0,
      competitionLevel: kw.competition_level ?? null,
      opportunityScore: kw.opportunityScore,
      isAiPrompt: kw.isAiPrompt,
      impressionsPerDay: kw.impressions_per_day ?? null,
    });
  }

  console.log(`\n  Inserted ${scored.length} keywords (run #${run.id})`);
  console.log(`  API cost for this run: $${apiCost.toFixed(4)}`);

  // Print top 10
  console.log("\n  Top 10 by opportunity score:");
  console.log("  " + ["Keyword", "Vol", "CPC", "Comp", "Score", "AI?"].join(" | "));
  for (const kw of scored.slice(0, 10)) {
    console.log(
      `  ${kw.keyword.padEnd(40)} | ${String(kw.search_volume).padStart(6)} | $${kw.cpc.toFixed(2)} | ${(kw.competition ?? 0).toFixed(2)} | ${kw.opportunityScore.toFixed(0).padStart(8)} | ${kw.isAiPrompt ? "Y" : " "}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[error]", err);
  process.exit(1);
});
