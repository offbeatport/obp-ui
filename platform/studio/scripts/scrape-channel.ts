/**
 * Project-scoped channel scraper.
 * Reads CHANNEL_ID from env, loads channel config from DB, scrapes using
 * the project's configured keywords and subreddits.
 *
 * Triggered by /api/run-channel?channelId=X
 */
import dotenv from "dotenv";
import { resolve } from "path";
import { createHash } from "crypto";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { db } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import { eq } from "drizzle-orm";
import { isSolutionSignal } from "../src/lib/signal-filter.js";

// ── Rate limit handling ───────────────────────────────────────────────────────

class RateLimitError extends Error {
  constructor() { super("429 rate limited"); this.name = "RateLimitError"; }
}

// Max wait before giving up and stopping the channel.
// Short limits (Reddit ~10-60s, GitHub ~60s) → wait and continue.
// Long limits (ProductHunt 900s, Twitter) → stop.
const MAX_WAIT_SEC = 180;

async function fetchRetry(
  url: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  log: (s: string) => void = () => { },
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status !== 429) return res;

  // Work out how long to wait from response headers
  const rlReset = res.headers.get("x-ratelimit-reset");   // Reddit/GitHub: seconds until reset
  const retryAfter = res.headers.get("Retry-After");         // standard header: seconds or date

  let waitSec: number;
  if (rlReset && !isNaN(parseFloat(rlReset))) {
    waitSec = Math.ceil(parseFloat(rlReset)) + 2; // +2s buffer
  } else if (retryAfter && !isNaN(parseInt(retryAfter, 10))) {
    waitSec = parseInt(retryAfter, 10) + 2;
  } else {
    waitSec = 60; // safe default
  }

  if (waitSec > MAX_WAIT_SEC) {
    log(`  ⛔ 429 - reset in ${waitSec}s (>${MAX_WAIT_SEC}s limit). Stopping channel; signals collected so far are saved.`);
    throw new RateLimitError();
  }

  log(`  ⏳ 429 - rate limit hit, waiting ${waitSec}s then continuing…`);
  await new Promise(r => setTimeout(r, waitSec * 1_000));

  // One retry after the window resets
  const retry = await fetch(url, init);
  if (retry.status === 429) {
    log(`  ⛔ Still rate limited after ${waitSec}s - stopping channel.`);
    throw new RateLimitError();
  }
  return retry;
}

// ── Lookback helpers ──────────────────────────────────────────────────────────

function lookbackDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function lookbackUnix(days: number): number {
  return Math.floor(lookbackDate(days).getTime() / 1000);
}

function lookbackISO(days: number): string {
  return lookbackDate(days).toISOString();
}

function lookbackYMD(days: number): string {
  return lookbackDate(days).toISOString().slice(0, 10);
}

function redditT(days: number): string {
  if (days <= 1) return "day";
  if (days <= 7) return "week";
  if (days <= 31) return "month";
  if (days <= 365) return "year";
  return "all";
}

// ── Source enum mapping ───────────────────────────────────────────────────────

type SignalSource = typeof schema.signals.$inferInsert["source"];

const CHANNEL_TYPE_TO_SOURCE: Record<string, SignalSource | null> = {
  reddit: "reddit",
  hn: "hn",
  github: "github",
  stackoverflow: "stackoverflow",
  g2: "g2",
  trustpilot: "trustpilot",
  devto: "devto",
  youtube: "youtube",

  lobsters: "lobsters",
  twitter: "twitter",
  bluesky: "bluesky",
  mastodon: "mastodon",
  indie_hackers: "ih",
  community: "community",
  upwork: "upwork",
  jobs: "jobs",
  firefox: "firefox",
  edgar: "edgar",
  regulatory: "regulatory",
  producthunt: "ph",
  podcast: "podcast",
  google_trends: "google_trends",
};

// ── Pain signal heuristic ─────────────────────────────────────────────────────

const PAIN_PHRASES = [
  // Formal / forum style
  "manual", "workaround", "pain", "frustrat", "annoying", "nightmare",
  "tedious", "no solution", "no tool", "no good", "doesn't exist",
  "wish there was", "built my own", "wrote my own", "had to build",
  "cobbled together", "too expensive", "cancel", "switch", "overpriced",
  "paying $", "spending hours", "waste hours", "manually", "spreadsheet",
  "no api", "broken", "terrible", "awful", "hate that", "missing feature",
  "feature request", "can't believe", "still no way", "anyone solved",
  "looking for a tool", "is there something", "alternatives to",
  // Casual / social style (bluesky, mastodon, twitter)
  "this sucks", "ugh", "so annoying", "so frustrating", "drives me crazy",
  "killing me", "fed up", "sick of", "tired of", "can't stand",
  "why is it so hard", "why doesn't", "why can't", "why isn't there",
  "hate when", "hate that", "hate this", "so bad", "so broken",
  "really wish", "would love a", "need something that", "anyone know a",
  "does anyone have", "recommend a tool", "recommend something",
  "charged me", "billed me", "overcharged", "cancelled my", "lost my",
  "hours just to", "took me forever", "wasted my", "still not fixed",
  "bug for years", "open issue", "years and still", "please just",
];

function hasPain(text: string): boolean {
  const t = text.toLowerCase();
  return PAIN_PHRASES.some((p) => t.includes(p));
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function signalExists(url: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(eq(schema.signals.url, url));
  return !!row;
}

type ChannelRow = typeof schema.channels.$inferSelect;

async function saveSignal(ch: ChannelRow, source: SignalSource, rawText: string, url: string): Promise<boolean> {
  if (!rawText || rawText.length < 40) return false;
  if (await signalExists(url)) return false;
  if (isSolutionSignal(rawText)) return false;
  try {
    await db.insert(schema.signals).values({
      source,
      rawText: rawText.slice(0, 2000),
      url,
      category: "discovery",
      projectId: ch.projectId,
      channelId: ch.id,
      scrapedAt: new Date(),
      market: "saas",
    });
    return true;
  } catch {
    return false;
  }
}

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Sliding-window rate limiters - proactively throttle before hitting API limits.
// Each limiter is shared within a single scraper process run.

class RateLimiter {
  private window: number[] = []; // request timestamps within the window
  private backoffUntil = 0;      // if set, acquire() waits until this timestamp
  totalRequests = 0;             // cumulative count for the current scraper run

  constructor(
    readonly name: string,
    readonly maxReqs: number,
    readonly windowMs: number,
    readonly fillFraction = 0.9, // throttle at this fraction to leave headroom
  ) { }

  async acquire(log?: (s: string) => void): Promise<void> {
    // Honour header-driven backoff first (e.g. API said "reset in 45s")
    const now = Date.now();
    if (this.backoffUntil > now) {
      const waitMs = this.backoffUntil - now;
      log?.(`  ⏱ ${this.name} backoff - waiting ${Math.ceil(waitMs / 1000)}s…`);
      await new Promise(r => setTimeout(r, waitMs));
      this.window = [];
      this.backoffUntil = 0;
    }

    // Proactive sliding-window throttle
    const t = Date.now();
    this.window = this.window.filter(ts => t - ts < this.windowMs);
    const limit = Math.floor(this.maxReqs * this.fillFraction);
    if (this.window.length >= limit) {
      const oldest = this.window[0];
      const waitMs = this.windowMs - (t - oldest) + 100;
      if (waitMs > 500) {
        log?.(`  ⏱ ${this.name} throttle (${this.window.length}/${this.maxReqs}) - waiting ${Math.ceil(waitMs / 1000)}s…`);
      }
      await new Promise(r => setTimeout(r, waitMs));
      this.window = this.window.filter(ts => Date.now() - ts < this.windowMs);
    }
    this.window.push(Date.now());
    this.totalRequests++;
    _processRequests++;
    // Emit a structured tag every request so the UI can show a live count
    log?.(`[reqs:${_processRequests}]`);
  }

  // Called after each response to sync with what the API actually reports.
  // If nearly exhausted, pre-schedule a backoff so the next acquire() waits.
  consumeHeaders(remaining: number | null, resetSec: number | null, log?: (s: string) => void) {
    if (remaining === null) return;
    if (remaining <= 2 && resetSec !== null && resetSec > 0) {
      // Pre-arm backoff so the NEXT acquire() waits until the window resets
      this.backoffUntil = Date.now() + (resetSec + 2) * 1_000;
      log?.(`  ⚠ ${this.name}: ${remaining} requests left - will wait ${Math.ceil(resetSec)}s before next request`);
    }
  }
}

// One limiter per API - shared across all keywords within a scrape run.
// Reddit: 60/min authenticated, 10-min sliding window enforced server-side.
// We use a 1-minute window and let Reddit's own headers guide us precisely.
const redditLimiter = new RateLimiter("Reddit", 55, 60_000);
const githubLimiter = new RateLimiter("GitHub", 28, 60_000);  // Search API: 30/min
const soLimiter = new RateLimiter("StackOverflow", 25, 60_000);
const phLimiter = new RateLimiter("ProductHunt", 400, 900_000); // 450/15min
const blueskyLimiter = new RateLimiter("Bluesky", 2500, 300_000); // 3000/5min
const devtoLimiter = new RateLimiter("dev.to", 25, 60_000);  // 30/min
const edgarLimiter = new RateLimiter("EDGAR", 8, 1_000);   // 10/sec
const firefoxLimiter = new RateLimiter("Firefox AMO", 4, 1_000);   // 5/sec
const mastodonLimiter = new RateLimiter("Mastodon", 250, 300_000); // 300/5min
const lemmyLimiter = new RateLimiter("Lemmy", 50, 60_000);
const genericLimiter = new RateLimiter("API", 25, 60_000);

// Process-level request counter - sum across all rate limiters, emitted live
let _processRequests = 0;

// ── OR-query batching ─────────────────────────────────────────────────────────
// Combine multiple keywords into one request using API-native OR operators.
// Reduces API calls by ~KW_BATCH_SIZE× at the cost of a slightly larger result set.

const KW_BATCH = 5; // keywords per OR query - sweet spot before queries get unwieldy

function orQuery(keywords: string[]): string {
  // Wrap multi-word keywords in quotes for exact-phrase matching
  return keywords.map(k => (k.includes(" ") ? `"${k}"` : k)).join(" OR ");
}

function batchKeywords(keywords: string[], size = KW_BATCH): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < keywords.length; i += size) batches.push(keywords.slice(i, i + size));
  return batches;
}

// ── Reddit ────────────────────────────────────────────────────────────────────

const REDDIT_UA = "BurningDemand/1.0 personal-tool (offline-research)";

interface RedditPost { title: string; selftext: string; url: string; permalink: string; score: number; }

async function redditSearch(subreddit: string, query: string, days: number, log?: (s: string) => void): Promise<RedditPost[]> {
  await redditLimiter.acquire(log);
  const p = new URLSearchParams({ q: query, restrict_sr: "1", sort: "top", t: redditT(days), limit: "25" });
  try {
    const r = await fetchRetry(`https://www.reddit.com/r/${subreddit}/search.json?${p}`, { headers: { "User-Agent": REDDIT_UA } });
    // Use Reddit's own headers for precise throttle feedback
    const remaining = parseFloat(r.headers.get("x-ratelimit-remaining") ?? "NaN");
    const reset = parseFloat(r.headers.get("x-ratelimit-reset") ?? "NaN");
    if (!isNaN(remaining)) redditLimiter.consumeHeaders(remaining, isNaN(reset) ? null : reset, log);
    if (!r.ok) return [];
    const j = await r.json() as any;
    return j.data?.children?.map((c: any) => c.data) ?? [];
  } catch (err) { if (err instanceof RateLimitError) throw err; return []; }
}

async function redditBrowse(subreddit: string, log?: (s: string) => void): Promise<RedditPost[]> {
  await redditLimiter.acquire(log);
  try {
    const r = await fetchRetry(`https://www.reddit.com/r/${subreddit}/new.json?limit=100`, { headers: { "User-Agent": REDDIT_UA } });
    const remaining = parseFloat(r.headers.get("x-ratelimit-remaining") ?? "NaN");
    const reset = parseFloat(r.headers.get("x-ratelimit-reset") ?? "NaN");
    if (!isNaN(remaining)) redditLimiter.consumeHeaders(remaining, isNaN(reset) ? null : reset, log);
    if (!r.ok) return [];
    const j = await r.json() as any;
    return j.data?.children?.map((c: any) => c.data) ?? [];
  } catch (err) { if (err instanceof RateLimitError) throw err; return []; }
}

async function fetchRedditComments(ch: ChannelRow, permalink: string, log: (line: string) => void): Promise<number> {
  await redditLimiter.acquire(log);
  try {
    const r = await fetchRetry(`https://www.reddit.com${permalink}.json?limit=50`, { headers: { "User-Agent": REDDIT_UA } }, log);
    if (!r.ok) return 0;
    const j = await r.json() as any;
    const comments = j[1]?.data?.children ?? [];
    let saved = 0;
    for (const c of comments) {
      const body = c.data?.body ?? "";
      if (!body || !hasPain(body)) continue;
      if (await saveSignal(ch, "reddit", body, `https://reddit.com${permalink}${c.data?.id ?? ""}`)) saved++;
    }
    return saved;
  } catch (err) { if (err instanceof RateLimitError) throw err; return 0; }
}

async function scrapeReddit(ch: ChannelRow, keywords: string[], subreddits: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  if (subreddits.length === 0) {
    log("  ⚠ No communities configured - add subreddits in the channel editor");
    return 0;
  }
  const batches = batchKeywords(keywords);
  log(`  ${keywords.length} keywords → ${batches.length} OR-batch${batches.length !== 1 ? "es" : ""} × ${subreddits.length} subreddit${subreddits.length !== 1 ? "s" : ""}`);
  let total = 0;

  for (const sub of subreddits) {
    const seen = new Set<string>();
    let subTotal = 0;

    for (const batch of batches) {
      const q = orQuery(batch);
      const posts = await redditSearch(sub, q, days, log);
      for (const post of posts) {
        if (seen.has(post.permalink)) continue;
        seen.add(post.permalink);
        const text = [post.title, post.selftext].filter(Boolean).join("\n\n");
        if (!hasPain(text)) continue;
        if (await saveSignal(ch, "reddit", text, `https://reddit.com${post.permalink}`)) subTotal++;
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    const recent = await redditBrowse(sub, log);
    for (const post of recent) {
      if (seen.has(post.permalink)) continue;
      seen.add(post.permalink);
      const text = [post.title, post.selftext].filter(Boolean).join("\n\n");
      if (!hasPain(text)) continue;
      if (await saveSignal(ch, "reddit", text, `https://reddit.com${post.permalink}`)) subTotal++;
    }

    log(`  r/${sub}... ${subTotal} new`);
    total += subTotal;
    await new Promise((r) => setTimeout(r, 800));
  }

  // Competitor gap: one OR batch per competitor across alternative/vs/name queries
  if (competitors.length > 0) {
    const cappedCompetitors = competitors.slice(0, 5);
    log(`  [competitors] Searching for gaps vs ${cappedCompetitors.join(", ")}…`);
    for (const sub of subreddits.slice(0, 3)) {
      const compQuery = orQuery(cappedCompetitors.flatMap(c => [`${c} alternative`, c]));
      const posts = await redditSearch(sub, compQuery, days, log);
      for (const post of posts) {
        const text = [post.title, post.selftext].filter(Boolean).join("\n\n");
        if (await saveSignal(ch, "reddit", text, `https://reddit.com${post.permalink}`)) total++;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  return total;
}

// ── Hacker News (Algolia) ─────────────────────────────────────────────────────

interface HNHit { objectID: string; title?: string; comment_text?: string; story_text?: string; url?: string; }

async function scrapeHN(ch: ChannelRow, keywords: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  const batches = batchKeywords(keywords);
  log(`  ${keywords.length} keywords → ${batches.length} OR-batch${batches.length !== 1 ? "es" : ""}`);
  let total = 0;

  for (const batch of batches) {
    const q = orQuery(batch);
    try {
      const p = new URLSearchParams({ query: q, tags: "story,comment", hitsPerPage: "50" });
      const r = await fetchRetry(`https://hn.algolia.com/api/v1/search?${p}`, undefined, log);
      if (!r.ok) { log(`  HN batch... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let bTotal = 0;
      for (const hit of (j.hits ?? []) as HNHit[]) {
        const text = [hit.title, hit.comment_text ?? hit.story_text].filter(Boolean).join("\n\n");
        if (!text || !hasPain(text)) continue;
        const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (await saveSignal(ch, "hn", text, url)) bTotal++;
      }
      log(`  HN [${batch.slice(0, 2).join(", ")}${batch.length > 2 ? "…" : ""}]... ${bTotal} new`);
      total += bTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  HN batch... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 300));
  }

  // Competitor gaps - one OR query covering all competitor alternatives
  if (competitors.length > 0) {
    const cappedCompetitors = competitors.slice(0, 5);
    log(`  [competitors] Searching for gaps vs ${cappedCompetitors.join(", ")}…`);
    const compQ = orQuery(cappedCompetitors.flatMap(c => [`${c} alternative`, c]));
    try {
      const p = new URLSearchParams({ query: compQ, tags: "story,comment", hitsPerPage: "30" });
      const r = await fetchRetry(`https://hn.algolia.com/api/v1/search?${p}`, undefined, log);
      if (r.ok) {
        const j = await r.json() as any;
        for (const hit of (j.hits ?? []) as HNHit[]) {
          const text = [hit.title, hit.comment_text ?? hit.story_text].filter(Boolean).join("\n\n");
          if (!text) continue;
          const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
          if (await saveSignal(ch, "hn", text, url)) total++;
        }
      }
    } catch (err) { if (err instanceof RateLimitError) throw err; }
  }

  return total;
}

// ── GitHub Issues ─────────────────────────────────────────────────────────────

async function scrapeGitHub(ch: ChannelRow, keywords: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { log("  ⚠ GITHUB_TOKEN not set - skipping GitHub"); return 0; }
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "BurningDemand/1.0" };
  const batches = batchKeywords(keywords);
  log(`  ${keywords.length} keywords → ${batches.length} OR-batch${batches.length !== 1 ? "es" : ""}`);
  let total = 0;

  for (const batch of batches) {
    const q = `(${orQuery(batch)}) is:issue`;
    try {
      await githubLimiter.acquire(log);
      const p = new URLSearchParams({ q, sort: "reactions", per_page: "100" });
      const r = await fetchRetry(`https://api.github.com/search/issues?${p}`, { headers }, log);
      const remaining = parseInt(r.headers.get("x-ratelimit-remaining") ?? "NaN");
      const resetEpoch = parseInt(r.headers.get("x-ratelimit-reset") ?? "0");
      if (!isNaN(remaining)) githubLimiter.consumeHeaders(remaining, resetEpoch ? (resetEpoch - Date.now() / 1000) : null, log);
      if (!r.ok) { log(`  GitHub batch... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let bTotal = 0;
      for (const item of (j.items ?? [])) {
        const text = [item.title, item.body ?? ""].join("\n\n");
        if (!hasPain(text)) continue;
        if (await saveSignal(ch, "github", text, item.html_url)) bTotal++;
      }
      log(`  GitHub [${batch.slice(0, 2).join(", ")}${batch.length > 2 ? "…" : ""}]... ${bTotal} new`);
      total += bTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  GitHub batch... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Competitor gaps - single OR query across all competitors
  if (competitors.length > 0) {
    const cappedCompetitors = competitors.slice(0, 5);
    log(`  [competitors] Searching for gaps vs ${cappedCompetitors.join(", ")}…`);
    const compQ = `(${orQuery(cappedCompetitors)}) is:issue label:enhancement`;
    try {
      await githubLimiter.acquire(log);
      const p = new URLSearchParams({ q: compQ, sort: "reactions", per_page: "25" });
      const r = await fetchRetry(`https://api.github.com/search/issues?${p}`, { headers }, log);
      if (r.ok) {
        const j = await r.json() as any;
        for (const item of (j.items ?? [])) {
          const text = [item.title, item.body ?? ""].join("\n\n");
          if (await saveSignal(ch, "github", text, item.html_url)) total++;
        }
      }
    } catch (err) { if (err instanceof RateLimitError) throw err; }
  }

  return total;
}

// ── Stack Overflow ────────────────────────────────────────────────────────────

async function scrapeStackOverflow(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    try {
      await soLimiter.acquire(log);
      const p = new URLSearchParams({ q: kw, sort: "votes", order: "desc", pagesize: "25", site: "stackoverflow" });
      const r = await fetchRetry(`https://api.stackexchange.com/2.3/questions?${p}`, undefined, log);
      if (!r.ok) { log(`  SO "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const q of (j.items ?? [])) {
        const text = [q.title, q.body_markdown ?? ""].join("\n\n");
        if (!hasPain(text)) continue;
        if (await saveSignal(ch, "stackoverflow", text, `https://stackoverflow.com/questions/${q.question_id}`)) kwTotal++;
      }
      log(`  SO "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  SO "${kw}"... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 400));
  }
  return total;
}

// ── Lobsters ──────────────────────────────────────────────────────────────────

async function scrapeLobsters(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    try {
      const url = `https://lobste.rs/search?q=${encodeURIComponent(kw)}&what=stories&order=relevance`;
      const r = await fetchRetry(url, { headers: { "User-Agent": "BurningDemand/1.0 research-tool" } }, log);
      if (!r.ok) { log(`  Lobste.rs "${kw}"... skip (${r.status})`); continue; }
      const html = await r.text();
      let kwTotal = 0;
      // Extract story titles and lobste.rs discussion URLs
      const storyBlocks = html.split('<div class="details">');
      for (const block of storyBlocks.slice(1)) {
        const titleMatch = block.match(/<a[^>]+class="u-url"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/);
        const discussMatch = block.match(/<a[^>]+href="(\/s\/[a-z0-9]+\/[^"]+)"[^>]*>\d+\s*comment/);
        if (!titleMatch) continue;
        const title = titleMatch[2].trim();
        const discussUrl = discussMatch ? `https://lobste.rs${discussMatch[1]}` : titleMatch[1];
        if (title.length < 20) continue;
        if (await saveSignal(ch, "lobsters", title, discussUrl)) kwTotal++;
      }
      log(`  Lobste.rs "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Lobste.rs "${kw}"... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 600));
  }
  return total;
}

// ── Bluesky ───────────────────────────────────────────────────────────────────

async function scrapeBluesky(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    await blueskyLimiter.acquire(log);
    try {
      const p = new URLSearchParams({ q: kw, limit: "50" });
      const r = await fetchRetry(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?${p}`, undefined, log);
      if (!r.ok) { log(`  Bluesky "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const post of (j.posts ?? [])) {
        const text = post.record?.text ?? "";
        if (!text || !hasPain(text)) continue;
        const handle = post.author?.handle ?? "unknown";
        const rkey = post.uri?.split("/").pop() ?? "";
        const url = `https://bsky.app/profile/${handle}/post/${rkey}`;
        if (await saveSignal(ch, "bluesky", text, url)) kwTotal++;
      }
      log(`  Bluesky "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Bluesky "${kw}"... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 350));
  }
  return total;
}

// ── Mastodon ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const MASTODON_INSTANCES = [
  "mastodon.social",
  "hachyderm.io",       // tech / devs
  "fosstodon.org",      // open source / devs
  "infosec.exchange",   // security
  "mas.to",             // general but large
];

async function scrapeMastodon(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  // Allow config override, otherwise rotate through tech instances
  const configInstance = (ch.config as any)?.mastodon_instance as string | undefined;
  const instances = configInstance ? [configInstance] : MASTODON_INSTANCES;
  let total = 0;

  for (const kw of keywords) {
    let kwTotal = 0;
    for (const instance of instances) {
      await mastodonLimiter.acquire(log);
      try {
        const p = new URLSearchParams({ q: kw, type: "statuses", limit: "40", resolve: "false" });
        const r = await fetchRetry(`https://${instance}/api/v2/search?${p}`, {
          headers: { "User-Agent": "BurningDemand/1.0 research-tool" },
        }, log);
        if (!r.ok) continue;
        const j = await r.json() as any;
        for (const status of (j.statuses ?? [])) {
          const text = stripHtml(status.content ?? "");
          if (!text || !hasPain(text)) continue;
          const url = status.url ?? "";
          if (!url) continue;
          if (await saveSignal(ch, "mastodon", text, url)) kwTotal++;
        }
      } catch (err) { if (err instanceof RateLimitError) throw err; }
      await new Promise((r) => setTimeout(r, 300));
    }
    log(`  Mastodon "${kw}"... ${kwTotal} new (across ${instances.length} instances)`);
    total += kwTotal;
  }
  return total;
}

// ── Product Hunt ──────────────────────────────────────────────────────────────

async function scrapeProductHunt(ch: ChannelRow, keywords: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (!token) {
    log("  ⚠ PRODUCTHUNT_TOKEN not set - skipping Product Hunt");
    log("    Get a token at https://www.producthunt.com/v2/oauth/applications");
    return 0;
  }
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    await phLimiter.acquire(log);
    try {
      const query = `
        query {
          posts(query: ${JSON.stringify(kw)}, first: 20) {
            edges {
              node {
                id name tagline description
                url
                comments(first: 10, order: VOTES_COUNT) {
                  edges { node { id body } }
                }
              }
            }
          }
        }`;
      const r = await fetchRetry("https://api.producthunt.com/v2/api/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "BurningDemand/1.0 research-tool",
        },
        body: JSON.stringify({ query }),
      }, log);
      if (!r.ok) { log(`  ProductHunt "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const edge of (j.data?.posts?.edges ?? [])) {
        const post = edge.node;
        const postText = [post.name, post.tagline, post.description].filter(Boolean).join("\n\n");
        if (hasPain(postText)) {
          if (await saveSignal(ch, "ph", postText, post.url)) kwTotal++;
        }
        for (const commentEdge of (post.comments?.edges ?? [])) {
          const cBody = commentEdge.node?.body ?? "";
          if (!hasPain(cBody)) continue;
          const commentUrl = `${post.url}#comment-${commentEdge.node.id}`;
          if (await saveSignal(ch, "ph", cBody, commentUrl)) kwTotal++;
        }
      }
      log(`  ProductHunt "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  ProductHunt "${kw}"... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Competitor gap searches
  if (competitors.length > 0) {
    const cappedCompetitors = competitors.slice(0, 5);
    log(`  [competitors] Searching for gaps vs ${cappedCompetitors.join(", ")}…`);
    for (const competitor of cappedCompetitors) {
      await phLimiter.acquire(log);
      try {
        const query = `
          query {
            posts(query: ${JSON.stringify(competitor + " alternative")}, first: 10) {
              edges {
                node {
                  id name tagline description url
                  comments(first: 5, order: VOTES_COUNT) {
                    edges { node { id body } }
                  }
                }
              }
            }
          }`;
        const r = await fetchRetry("https://api.producthunt.com/v2/api/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "BurningDemand/1.0 research-tool",
          },
          body: JSON.stringify({ query }),
        }, log);
        if (r.ok) {
          const j = await r.json() as any;
          for (const edge of (j.data?.posts?.edges ?? [])) {
            const post = edge.node;
            const postText = [post.name, post.tagline, post.description].filter(Boolean).join("\n\n");
            if (postText && await saveSignal(ch, "ph", postText, post.url)) total++;
            for (const commentEdge of (post.comments?.edges ?? [])) {
              const cBody = commentEdge.node?.body ?? "";
              if (!cBody) continue;
              const commentUrl = `${post.url}#comment-${commentEdge.node.id}`;
              if (await saveSignal(ch, "ph", cBody, commentUrl)) total++;
            }
          }
        }
      } catch (err) { if (err instanceof RateLimitError) throw err; }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return total;
}

// ── Trustpilot (via DataForSEO) ───────────────────────────────────────────────

async function scrapeTrustpilot(ch: ChannelRow, keywords: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  const LOGIN = process.env.DATAFORSEO_LOGIN;
  const PASSWORD = process.env.DATAFORSEO_PASSWORD;
  if (!LOGIN || !PASSWORD) {
    log("  ⚠ Trustpilot requires DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env");
    return 0;
  }
  const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

  // competitors = domain list (e.g. ["hubspot.com", "mailchimp.com"])
  // fall back to keyword-based search if none configured
  const domains: string[] = competitors.length > 0 ? competitors : [];

  if (domains.length === 0 && keywords.length > 0) {
    try {
      const res = await fetchRetry("https://api.dataforseo.com/v3/business_data/trustpilot/search/live", {
        method: "POST",
        headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ keyword: keywords[0], depth: 10 }]),
        signal: AbortSignal.timeout(20_000),
      }, log);
      if (res.ok) {
        const json = await res.json() as { tasks?: Array<{ result?: Array<{ items?: Array<{ domain: string }> }> }> };
        const found = (json.tasks?.[0]?.result?.[0]?.items ?? []).slice(0, 5).map((i) => i.domain).filter(Boolean);
        domains.push(...found);
      }
      log(`  Trustpilot: searching by keyword via DataForSEO... found ${domains.length} companies`);
    } catch (err) { if (err instanceof RateLimitError) throw err; log("  Trustpilot: search failed"); }
  }

  if (domains.length === 0) {
    log("  ⚠ No competitors configured - add company domains in channel config (e.g. hubspot.com)");
    return 0;
  }

  let total = 0;
  for (const domain of domains) {
    try {
      const res = await fetchRetry("https://api.dataforseo.com/v3/business_data/trustpilot/reviews/live", {
        method: "POST",
        headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ domain, depth: 50, ratings: [1, 2, 3] }]),
        signal: AbortSignal.timeout(30_000),
      }, log);
      if (!res.ok) { log(`  Trustpilot ${domain}... skip (${res.status})`); continue; }
      const json = await res.json() as { tasks?: Array<{ result?: Array<{ items?: Array<{ title?: string; review_text?: string; rating?: number; url?: string }> }> }> };
      const reviews = json.tasks?.[0]?.result?.[0]?.items ?? [];
      let domainTotal = 0;
      for (const review of reviews) {
        const text = [review.title ?? "", review.review_text ?? ""].join("\n").trim();
        if (text.length < 30) continue;
        if (!hasPain(text)) continue;
        const url = review.url ?? `https://www.trustpilot.com/review/${domain}`;
        if (await saveSignal(ch, "trustpilot", text, url)) domainTotal++;
      }
      log(`  Trustpilot ${domain}... ${domainTotal} new (${reviews.length} fetched)`);
      total += domainTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Trustpilot ${domain}... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return total;
}

// ── Dev.to ────────────────────────────────────────────────────────────────────

async function scrapeDevto(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    await devtoLimiter.acquire(log);
    try {
      const p = new URLSearchParams({ q: kw, per_page: "20" });
      const r = await fetchRetry(`https://dev.to/search/feed_content?${p}`, undefined, log);
      if (!r.ok) { log(`  Dev.to "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const article of (j.result ?? [])) {
        const text = [article.title, article.description ?? ""].join("\n\n");
        if (!hasPain(text)) continue;
        const url = `https://dev.to${article.path}`;
        if (await saveSignal(ch, "devto", text, url)) kwTotal++;
      }
      log(`  Dev.to "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Dev.to "${kw}"... error: ${err}`); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return total;
}

// ── Firefox Add-ons ──────────────────────────────────────────────────────────

async function scrapeFirefox(ch: ChannelRow, addons: string[], days: number, log: (line: string) => void): Promise<number> {
  if (addons.length === 0) {
    log("  ⚠ No add-ons configured - set cfg.addons to Mozilla slug names");
    log('    e.g. ["ublock-origin", "bitwarden-password-manager"]');
    return 0;
  }
  let total = 0;
  for (const addon of addons) {
    let addonTotal = 0;
    try {
      for (const score of [1, 2, 3]) {
        await firefoxLimiter.acquire(log);
        const p = new URLSearchParams({ addon, score: String(score), lang: "en-US", page_size: "25" });
        const r = await fetchRetry(`https://addons.mozilla.org/api/v5/reviews/?${p}`, {
          headers: { "User-Agent": "BurningDemand/1.0 research-tool" },
        }, log);
        if (!r.ok) continue;
        const j = await r.json() as any;
        for (const review of (j.results ?? [])) {
          const text = [review.title, review.body].filter(Boolean).join("\n\n");
          if (!text) continue;
          const url = `https://addons.mozilla.org/en-US/firefox/addon/${addon}/#review-${review.id}`;
          if (await saveSignal(ch, "firefox", text, url)) addonTotal++;
        }
        await new Promise((res) => setTimeout(res, 250));
      }
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Firefox "${addon}"... error: ${err}`); }
    log(`  Firefox "${addon}"... ${addonTotal} new`);
    total += addonTotal;
    await new Promise((res) => setTimeout(res, 600));
  }
  return total;
}

// ── SEC EDGAR ─────────────────────────────────────────────────────────────────

async function scrapeEdgar(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  const startdt = new Date();
  startdt.setFullYear(startdt.getFullYear() - 2);
  const startStr = startdt.toISOString().slice(0, 10);
  let total = 0;
  for (const kw of keywords) {
    await edgarLimiter.acquire(log);
    try {
      const p = new URLSearchParams({ q: kw, dateRange: "custom", startdt: startStr, forms: "8-K,10-K,S-1" });
      const r = await fetchRetry(`https://efts.sec.gov/LATEST/search-index?${p}`, {
        headers: { "User-Agent": "BurningDemand/1.0 research-tool", Accept: "application/json" },
      }, log);
      if (!r.ok) { log(`  EDGAR "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const hit of (j.hits?.hits ?? []).slice(0, 20)) {
        const src = hit._source ?? {};
        const highlights = hit.highlight ?? {};
        const excerpts: string[] = [];
        for (const vals of Object.values(highlights) as string[][]) {
          excerpts.push(...vals.map((s) => s.replace(/<[^>]+>/g, "").trim()));
        }
        const excerpt = excerpts.slice(0, 3).join(" … ");
        const text = `${src.entity_name ?? "Company"} - ${src.form_type ?? ""} (${src.file_date ?? ""}): ${excerpt || src.description || ""}`.trim();
        if (text.length < 60) continue;
        const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(kw)}#${hit._id}`;
        if (await saveSignal(ch, "edgar", text, url)) kwTotal++;
      }
      log(`  EDGAR "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  EDGAR "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 400));
  }
  return total;
}

// ── YouTube ───────────────────────────────────────────────────────────────────

async function scrapeYoutube(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    log("  ⚠ YOUTUBE_API_KEY not set - skipping YouTube");
    log("    Enable YouTube Data API v3 at https://console.cloud.google.com/");
    return 0;
  }
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    try {
      const sp = new URLSearchParams({ part: "snippet", q: kw, type: "video", maxResults: "10", key });
      const sr = await fetchRetry(`https://www.googleapis.com/youtube/v3/search?${sp}`, undefined, log);
      if (!sr.ok) { log(`  YouTube "${kw}"... skip (${sr.status})`); continue; }
      const sj = await sr.json() as any;
      const videoIds = (sj.items ?? []).map((v: any) => v.id?.videoId).filter(Boolean) as string[];
      let kwTotal = 0;
      for (const videoId of videoIds) {
        const cp = new URLSearchParams({ part: "snippet", videoId, maxResults: "50", key, order: "relevance", textFormat: "plainText" });
        const cr = await fetchRetry(`https://www.googleapis.com/youtube/v3/commentThreads?${cp}`, undefined, log);
        if (!cr.ok) continue;
        const cj = await cr.json() as any;
        for (const item of (cj.items ?? [])) {
          const text = item.snippet?.topLevelComment?.snippet?.textDisplay ?? "";
          if (!text || !hasPain(text)) continue;
          const url = `https://www.youtube.com/watch?v=${videoId}&lc=${item.id}`;
          if (await saveSignal(ch, "youtube", text, url)) kwTotal++;
        }
        await new Promise((res) => setTimeout(res, 250));
      }
      log(`  YouTube "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  YouTube "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 600));
  }
  return total;
}

// ── Indie Hackers ─────────────────────────────────────────────────────────────

async function scrapeIndieHackers(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;
  for (const kw of keywords) {
    try {
      const url = `https://www.indiehackers.com/search?query=${encodeURIComponent(kw)}&type=post`;
      const r = await fetchRetry(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
          Accept: "text/html,application/xhtml+xml",
        },
      }, log);
      if (!r.ok) { log(`  IndieHackers "${kw}"... skip (${r.status})`); continue; }
      const html = await r.text();
      let kwTotal = 0;
      const ndMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (ndMatch) {
        try {
          const nd = JSON.parse(ndMatch[1]);
          const posts =
            nd?.props?.pageProps?.searchResults?.posts ??
            nd?.props?.pageProps?.results?.posts ??
            nd?.props?.pageProps?.posts ?? [];
          for (const post of (Array.isArray(posts) ? posts : [])) {
            const text = [post.title, post.rawBody ?? post.body ?? post.excerpt].filter(Boolean).join("\n\n");
            if (!text || !hasPain(text)) continue;
            const postUrl = `https://www.indiehackers.com/post/${post.slug ?? post.id ?? ""}`;
            if (await saveSignal(ch, "ih", text, postUrl)) kwTotal++;
          }
        } catch { /* fallthrough */ }
      }
      if (kwTotal === 0) {
        const titleRe = /<a[^>]+href="(\/post\/[^"]+)"[^>]*>\s*<[^>]+>([^<]{20,})<\//g;
        let m;
        while ((m = titleRe.exec(html)) !== null) {
          const [, path, title] = m;
          if (!hasPain(title)) continue;
          if (await saveSignal(ch, "ih", title.trim(), `https://www.indiehackers.com${path}`)) kwTotal++;
        }
      }
      log(`  IndieHackers "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  IndieHackers "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 700));
  }
  return total;
}

// ── G2 (via DataForSEO) ───────────────────────────────────────────────────────

async function scrapeG2(ch: ChannelRow, keywords: string[], competitors: string[], days: number, log: (line: string) => void): Promise<number> {
  const LOGIN = process.env.DATAFORSEO_LOGIN;
  const PASSWORD = process.env.DATAFORSEO_PASSWORD;
  if (!LOGIN || !PASSWORD) {
    log("  ⚠ G2 requires DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env");
    return 0;
  }
  const AUTH = Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

  // Use configured competitors as product slugs; fall back to generic search
  const slugs = competitors.length > 0 ? competitors : keywords.slice(0, 5);
  if (slugs.length === 0) {
    log("  ⚠ No product slugs configured - add G2 product slugs in cfg.competitors");
    return 0;
  }

  let total = 0;
  for (const slug of slugs) {
    try {
      const res = await fetchRetry("https://api.dataforseo.com/v3/business_data/g2/reviews/live", {
        method: "POST",
        headers: { Authorization: `Basic ${AUTH}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ asin: slug, depth: 50, ratings: [1, 2, 3] }]),
        signal: AbortSignal.timeout(30_000),
      }, log);
      if (!res.ok) { log(`  G2 "${slug}"... skip (${res.status})`); continue; }
      const json = await res.json() as { tasks?: Array<{ result?: Array<{ items?: Array<{ title?: string; review_text?: string; rating?: number; review_datetime?: string; url?: string }> }> }> };
      const reviews = json.tasks?.[0]?.result?.[0]?.items ?? [];
      let slugTotal = 0;
      for (const review of reviews) {
        const text = [review.title ?? "", review.review_text ?? ""].join("\n").trim();
        if (text.length < 40) continue;
        if (!hasPain(text)) continue;
        const url = review.url ?? `https://www.g2.com/products/${slug}/reviews`;
        if (await saveSignal(ch, "g2", text, url)) slugTotal++;
      }
      log(`  G2 "${slug}"... ${slugTotal} new (${reviews.length} fetched)`);
      total += slugTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  G2 "${slug}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 1500));
  }
  return total;
}

// ── Community (Discourse) ─────────────────────────────────────────────────────

async function scrapeCommunity(ch: ChannelRow, keywords: string[], communityUrls: string[], days: number, log: (line: string) => void): Promise<number> {
  if (communityUrls.length === 0) {
    log("  ⚠ No community URLs configured - set cfg.community_urls to Discourse forum base URLs");
    log('    e.g. ["https://community.shopify.com", "https://discuss.python.org"]');
    return 0;
  }
  let total = 0;
  for (const baseUrl of communityUrls) {
    const base = baseUrl.replace(/\/$/, "");
    for (const kw of keywords) {
      try {
        const r = await fetchRetry(`${base}/search.json?q=${encodeURIComponent(kw)}&page=1`, {
          headers: { "User-Agent": "BurningDemand/1.0 research-tool", Accept: "application/json" },
        }, log);
        if (!r.ok) { log(`  ${base} "${kw}"... skip (${r.status})`); continue; }
        const j = await r.json() as any;
        let kwTotal = 0;
        for (const post of (j.posts ?? []).slice(0, 30)) {
          const text = [post.blurb, post.raw].filter(Boolean).join("\n\n");
          if (!text || !hasPain(text)) continue;
          const topicId = post.topic_id ?? post.id ?? "";
          const topicSlug = post.topic_slug ?? "";
          const url = topicSlug ? `${base}/t/${topicSlug}/${topicId}` : `${base}/t/${topicId}`;
          if (await saveSignal(ch, "community", text, url)) kwTotal++;
        }
        log(`  ${base} "${kw}"... ${kwTotal} new`);
        total += kwTotal;
      } catch (err) { if (err instanceof RateLimitError) throw err; log(`  ${base} "${kw}"... error: ${err}`); }
      await new Promise((res) => setTimeout(res, 600));
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  return total;
}

// ── SAP Community ─────────────────────────────────────────────────────────────

async function scrapeSAPCommunity(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords for SAP Community"); return 0; }
  let total = 0;
  for (const kw of keywords.slice(0, 5)) {
    try {
      const r = await fetchRetry(`https://community.sap.com/t5/forums/searchpage/tab/message?q=${encodeURIComponent(kw)}&search_type=thread`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      }, log);
      if (!r.ok) { log(`  SAP Community "${kw}"... skip (${r.status})`); continue; }
      const html = await r.text();
      let kwTotal = 0;
      const re = /<a[^>]+href="(https:\/\/community\.sap\.com\/t5\/[^"]+)"[^>]*>\s*([^<]{20,})\s*<\/a>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const [, url, title] = m;
        if (!hasPain(title)) continue;
        if (await saveSignal(ch, "community", title.trim(), url)) kwTotal++;
      }
      log(`  SAP Community "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  SAP Community "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 700));
  }
  return total;
}

// ── Podcast (Podcast Index API) ───────────────────────────────────────────────
// Uses the free Podcast Index API (podcastindex.org) to search episode descriptions
// for pain signals. Requires PODCAST_INDEX_KEY + PODCAST_INDEX_SECRET in .env.
// API docs: https://podcastindex-org.github.io/docs-api/

async function scrapePodcast(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  const KEY = process.env.PODCAST_INDEX_KEY;
  const SECRET = process.env.PODCAST_INDEX_SECRET;
  if (!KEY || !SECRET) {
    log("  ⚠ Podcast Index requires PODCAST_INDEX_KEY and PODCAST_INDEX_SECRET in .env");
    log("  ⚠ Get a free API key at: https://api.podcastindex.org/");
    return 0;
  }
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }

  let total = 0;

  for (const kw of keywords.slice(0, 8)) {
    try {
      // Podcast Index requires a time-based HMAC-SHA1 Authorization header
      const ts = Math.floor(Date.now() / 1000).toString();
      const hash = createHash("sha1").update(KEY + SECRET + ts).digest("hex");

      // Search episodes for the keyword
      const r = await fetchRetry(
        `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(kw)}&max=25`,
        {
          headers: {
            "X-Auth-Key": KEY,
            "X-Auth-Date": ts,
            Authorization: hash,
            "User-Agent": "BurningDemand/1.0 research-tool",
          },
          signal: AbortSignal.timeout(15_000),
        },
        log,
      );
      if (!r.ok) { log(`  Podcast Index "${kw}"... skip (${r.status})`); continue; }
      const json = await r.json() as { feeds?: Array<{ title?: string; description?: string; url?: string; link?: string }> };
      const feeds = json.feeds ?? [];
      let kwTotal = 0;
      for (const feed of feeds.slice(0, 25)) {
        const text = [feed.title ?? "", feed.description ?? ""].filter(Boolean).join("\n\n");
        if (!text || text.length < 40) continue;
        if (!hasPain(text)) continue;
        const url = feed.link ?? feed.url ?? "";
        if (!url) continue;
        if (await saveSignal(ch, "podcast", text, url)) kwTotal++;
      }

      // Also search episode transcripts / descriptions
      const er = await fetchRetry(
        `https://api.podcastindex.org/api/1.0/episodes/search?q=${encodeURIComponent(kw)}&max=30`,
        {
          headers: {
            "X-Auth-Key": KEY,
            "X-Auth-Date": ts,
            Authorization: hash,
            "User-Agent": "BurningDemand/1.0 research-tool",
          },
          signal: AbortSignal.timeout(15_000),
        },
        log,
      );
      if (er.ok) {
        const ej = await er.json() as { items?: Array<{ title?: string; description?: string; enclosureUrl?: string; link?: string }> };
        for (const ep of (ej.items ?? []).slice(0, 30)) {
          const text = [ep.title ?? "", ep.description ?? ""].filter(Boolean).join("\n\n");
          if (!text || text.length < 40) continue;
          if (!hasPain(text)) continue;
          const url = ep.link ?? ep.enclosureUrl ?? "";
          if (!url) continue;
          if (await saveSignal(ch, "podcast", text, url)) kwTotal++;
        }
      }

      log(`  Podcast Index "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Podcast Index "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 1000));
  }

  return total;
}

// ── Lemmy ─────────────────────────────────────────────────────────────────────

async function scrapeLemmy(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  const instance = (ch.config as any)?.lemmy_instance ?? "lemmy.world";
  let total = 0;
  for (const kw of keywords.slice(0, 8)) {
    await lemmyLimiter.acquire(log);
    try {
      const p = new URLSearchParams({ q: kw, type_: "Posts", sort: "TopYear", limit: "25" });
      const r = await fetchRetry(`https://${instance}/api/v3/search?${p}`, {
        headers: { "User-Agent": "BurningDemand/1.0 research-tool" },
      }, log);
      if (!r.ok) { log(`  Lemmy [${instance}] "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const item of (j.posts ?? [])) {
        const post = item.post ?? {};
        const text = [post.name, post.body ?? ""].join("\n\n");
        if (!text || !hasPain(text)) continue;
        const url = post.ap_id ?? `https://${instance}/post/${post.id}`;
        if (await saveSignal(ch, "community", text, url)) kwTotal++;
      }
      log(`  Lemmy [${instance}] "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  Lemmy [${instance}] "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 500));
  }
  return total;
}

// ── YC Hiring ─────────────────────────────────────────────────────────────────

async function scrapeYCHiring(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords for YC Hiring"); return 0; }
  let total = 0;
  try {
    // Fetch latest "Who is Hiring?" thread from HN
    const r = await fetchRetry("https://hacker-news.firebaseio.com/v0/user/whoishiring/submitted.json", undefined, log);
    if (!r.ok) { log("  YC Hiring... skip (could not fetch thread list)"); return 0; }
    const ids = await r.json() as number[];
    const hiringId = ids[0]; // most recent
    if (!hiringId) return 0;

    const tr = await fetchRetry(`https://hacker-news.firebaseio.com/v0/item/${hiringId}.json`, undefined, log);
    if (!tr.ok) return 0;
    const thread = await tr.json() as any;
    const commentIds: number[] = (thread.kids ?? []).slice(0, 200);

    let kwTotal = 0;
    for (const commentId of commentIds) {
      try {
        const cr = await fetchRetry(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json`, undefined, log);
        if (!cr.ok) continue;
        const comment = await cr.json() as any;
        const text = comment.text ?? "";
        const stripped = stripHtml(text);
        if (!stripped || stripped.length < 60) continue;
        const matches = keywords.some((kw) => stripped.toLowerCase().includes(kw.toLowerCase()));
        if (!matches) continue;
        const url = `https://news.ycombinator.com/item?id=${commentId}`;
        if (await saveSignal(ch, "hn", stripped, url)) kwTotal++;
      } catch (err) { if (err instanceof RateLimitError) throw err; }
      await new Promise((res) => setTimeout(res, 50));
    }
    log(`  YC Hiring... ${kwTotal} new`);
    total += kwTotal;
  } catch (err) { if (err instanceof RateLimitError) throw err; log(`  YC Hiring... error: ${err}`); }
  return total;
}

// ── Arctic Shift (Reddit historical) ─────────────────────────────────────────

async function scrapeArcticShift(ch: ChannelRow, keywords: string[], subreddits: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords for Arctic Shift"); return 0; }
  const after = lookbackUnix(days);
  let total = 0;
  const subsToSearch = subreddits.length > 0 ? subreddits.slice(0, 3) : [];
  for (const kw of keywords.slice(0, 5)) {
    try {
      const subParam = subsToSearch.length > 0 ? `&subreddit=${subsToSearch.join(",")}` : "";
      const r = await fetchRetry(
        `https://arctic-shift.photon-reddit.com/api/posts/search?q=${encodeURIComponent(kw)}&after=${after}&limit=25${subParam}`,
        { headers: { "User-Agent": "BurningDemand/1.0 research-tool" } },
        log,
      );
      if (!r.ok) { log(`  ArcticShift "${kw}"... skip (${r.status})`); continue; }
      const j = await r.json() as any;
      let kwTotal = 0;
      for (const post of (j.data ?? [])) {
        const text = [post.title, post.selftext ?? ""].join("\n\n");
        if (!text || !hasPain(text)) continue;
        const url = `https://reddit.com${post.permalink}`;
        if (await saveSignal(ch, "reddit", text, url)) kwTotal++;
      }
      log(`  ArcticShift "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  ArcticShift "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 400));
  }
  return total;
}

// ── Jobs (RemoteOK + We Work Remotely) ───────────────────────────────────────

async function scrapeJobs(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;

  for (const kw of keywords) {
    try {
      const r = await fetchRetry(`https://remoteok.com/api?tag=${encodeURIComponent(kw)}`, {
        headers: { "User-Agent": "BurningDemand/1.0 research-tool", Accept: "application/json" },
      }, log);
      if (!r.ok) { log(`  RemoteOK "${kw}"... skip (${r.status})`); continue; }
      const jobs = ((await r.json() as any[]) ?? []).slice(1); // first element is metadata
      let kwTotal = 0;
      for (const job of jobs.slice(0, 30)) {
        const text = [job.position, job.company, (job.description ?? "").slice(0, 800)].filter(Boolean).join("\n\n");
        if (!text || text.length < 60) continue;
        const url = job.url ?? `https://remoteok.com/remote-jobs/${job.id}`;
        if (await saveSignal(ch, "jobs", text, url)) kwTotal++;
      }
      log(`  RemoteOK "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  RemoteOK "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 1200));
  }

  for (const kw of keywords.slice(0, 2)) {
    try {
      const r = await fetchRetry(`https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(kw)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      }, log);
      if (!r.ok) { log(`  WeWorkRemotely "${kw}"... skip (${r.status})`); continue; }
      const html = await r.text();
      let kwTotal = 0;
      const re = /<span class="title">([^<]{10,})<\/span>/g;
      let m;
      while ((m = re.exec(html)) !== null) {
        const title = m[1].trim();
        if (await saveSignal(ch, "jobs", title, `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(kw)}`)) kwTotal++;
      }
      log(`  WeWorkRemotely "${kw}"... ${kwTotal} new`);
      total += kwTotal;
    } catch (err) { if (err instanceof RateLimitError) throw err; log(`  WeWorkRemotely "${kw}"... error: ${err}`); }
    await new Promise((res) => setTimeout(res, 800));
  }

  return total;
}

// ── runChannel (exported) ─────────────────────────────────────────────────────

export async function runChannel(
  channelId: number,
  logger: (line: string) => void,
  opts?: { lookbackDays?: number; signal?: AbortSignal }
): Promise<void> {
  const log = logger;
  const days = opts?.lookbackDays ?? 30;
  const signal = opts?.signal;

  // DB lookup
  const [ch] = await db.select().from(schema.channels).where(eq(schema.channels.id, channelId));
  if (!ch) { log(`Channel ${channelId} not found`); return; }
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, ch.projectId!));
  if (!project) { log(`Project not found`); return; }

  const cfg = (ch.config ?? {}) as { keywords?: string[]; subreddits?: string[]; competitors?: string[]; expandedKeywords?: string[] };
  const keywords: string[] = cfg.keywords ?? [];
  const subreddits = cfg.subreddits ?? [];
  const competitors = cfg.competitors ?? [];
  let allKeywords = keywords;

  // Keyword expansion using AI
  if (keywords.length > 0 && !cfg.expandedKeywords) {
    try {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (apiKey) {
        const model = process.env.OPENROUTER_MODEL ?? "google/gemini-flash-lite";
        const expansionPrompt = `You are helping with market research signal discovery for a solo founder.

Keywords to expand: ${keywords.map(k => `"${k}"`).join(", ")}

For each keyword, generate 3-5 additional search query variants that would find DIFFERENT posts about the same pain:
- Vary the phrasing (active/passive, problem/solution framing)
- Include question forms people ask: "how do you X", "is there a tool for X"
- Include informal expressions: "manually doing X", "X by hand"
- Keep them short (2-6 words), as they're used as search queries
- Do NOT include synonyms of individual words, stay in the same domain

Return ONLY a flat JSON array of all variants (do not repeat the original keywords):
["variant 1", "variant 2", ...]`;

        log(`\nExpanding ${keywords.length} keyword(s) into search variants...`);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": "https://burningdemand.com" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: expansionPrompt }], temperature: 0.3, max_tokens: 500 }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          const text = data.choices?.[0]?.message?.content ?? "[]";
          const variants = JSON.parse(text.replace(/```json|```/g, "").trim()) as string[];
          if (Array.isArray(variants) && variants.length > 0) {
            await db.update(schema.channels).set({ config: { ...cfg, expandedKeywords: variants } as any }).where(eq(schema.channels.id, channelId));
            allKeywords = [...new Set([...keywords, ...variants])];
            log(`${variants.length} variants added (${allKeywords.length} total)`);
          }
        }
      }
    } catch (err) { if (err instanceof RateLimitError) throw err; log("expansion failed, using original keywords"); }
  } else if (cfg.expandedKeywords) {
    allKeywords = [...new Set([...keywords, ...cfg.expandedKeywords])];
    log(`\nUsing ${allKeywords.length} keywords (${keywords.length} original + ${cfg.expandedKeywords.length} expanded)`);
  }

  log(`> ${ch.type} - ${project.name}`);
  if (allKeywords.length) log(`> keywords (${allKeywords.length}): ${allKeywords.slice(0, 5).join(", ")}${allKeywords.length > 5 ? "…" : ""}`);
  if (subreddits.length) log(`> communities (${subreddits.length}): ${subreddits.join(", ")}`);
  if (competitors.length) log(`> competitors (${competitors.length}): ${competitors.join(", ")}`);
  log("");

  if (signal?.aborted) { log("Stopped."); return; }

  let total = 0;

  try {
    switch (ch.type) {
      case "reddit": total = await scrapeReddit(ch, allKeywords, subreddits, competitors, days, log); total += await scrapeArcticShift(ch, allKeywords, subreddits, days, log); break;
      case "hn": total = await scrapeHN(ch, allKeywords, competitors, days, log); total += await scrapeYCHiring(ch, allKeywords, days, log); break;
      case "github": total = await scrapeGitHub(ch, allKeywords, competitors, days, log); break;
      case "stackoverflow": total = await scrapeStackOverflow(ch, allKeywords, days, log); break;
      case "devto": total = await scrapeDevto(ch, allKeywords, days, log); break;
      case "lobsters": total = await scrapeLobsters(ch, allKeywords, days, log); break;
      case "bluesky": total = await scrapeBluesky(ch, allKeywords, days, log); break;
      case "mastodon": total = await scrapeMastodon(ch, allKeywords, days, log); break;
      case "producthunt": total = await scrapeProductHunt(ch, allKeywords, competitors, days, log); break;
      case "trustpilot": total = await scrapeTrustpilot(ch, allKeywords, competitors, days, log); break;
      case "firefox": total = await scrapeFirefox(ch, (cfg as any).addons ?? [], days, log); break;
      case "edgar": total = await scrapeEdgar(ch, allKeywords, days, log); break;
      case "youtube": total = await scrapeYoutube(ch, allKeywords, days, log); break;
      case "indie_hackers": total = await scrapeIndieHackers(ch, allKeywords, days, log); break;

      case "community": total = await scrapeCommunity(ch, allKeywords, (cfg as any).community_urls ?? [], days, log); total += await scrapeSAPCommunity(ch, allKeywords, days, log); break;
      case "lemmy": total = await scrapeLemmy(ch, allKeywords, days, log); break;
      case "jobs": total = await scrapeJobs(ch, allKeywords, days, log); break;
      case "podcast": total = await scrapePodcast(ch, allKeywords, days, log); break;
      case "google_trends": total = await scrapeGoogleTrends(ch, allKeywords, days, log); break;
      case "twitter":
        log("⚠ Twitter/X: set TWITTER_BEARER_TOKEN (paid) or XAI_API_KEY (Grok) to use this channel");
        return;
      case "upwork":
        log("⚠ Upwork has no public search API.");
        return;
      case "regulatory":
        log("⚠ 'regulatory' has no single source - use edgar for SEC filings or community for forum scraping.");
        return;
      default:
        log(`⚠ "${ch.type}" is not a recognized channel type.`);
        return;
    }
  } catch (err) {
    if (err instanceof RateLimitError) {
      log(`\n⛔ Rate limited - ${total} signals saved. Re-run this channel once the limit resets.`);
      return;
    }
    throw err;
  }

  // Tally total API requests across all limiters for this run
  const totalReqs = [redditLimiter, githubLimiter, soLimiter, phLimiter, blueskyLimiter,
    devtoLimiter, edgarLimiter, firefoxLimiter, mastodonLimiter, lemmyLimiter, genericLimiter]
    .reduce((sum, l) => sum + l.totalRequests, 0);
  log(`\n✓ ${total} new signals saved for "${project.name}" (${totalReqs} API requests)`);
}

// ── Google Trends ─────────────────────────────────────────────────────────────
// Uses the unofficial Google Trends explore API (no key required).
// For each keyword: fetches related/rising queries - these often surface pain
// signals like "X alternative", "X not working", "why is X so expensive".

async function scrapeGoogleTrends(ch: ChannelRow, keywords: string[], days: number, log: (line: string) => void): Promise<number> {
  if (keywords.length === 0) { log("  ⚠ No keywords configured"); return 0; }
  let total = 0;

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
  const HEADERS = { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" };

  // Time window mapped from lookback days
  const timeParam = days <= 7 ? "now 7-d" : days <= 30 ? "today 1-m" : days <= 90 ? "today 3-m" : "today 12-m";

  for (const kw of keywords.slice(0, 10)) {
    try {
      log(`  Google Trends "${kw}"...`);

      // Step 1: explore endpoint → get widget tokens
      const exploreReq = JSON.stringify({
        comparisonItem: [{ keyword: kw, geo: "", time: timeParam }],
        category: 0,
        property: "",
      });

      const exploreUrl = `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(exploreReq)}&hl=en-US`;
      const exploreRes = await fetchRetry(exploreUrl, { headers: HEADERS }, log);

      if (!exploreRes.ok) { log(`  Google Trends "${kw}"... skip (${exploreRes.status})`); continue; }

      const raw = await exploreRes.text();
      // Response starts with ")]}'\n" - strip it
      const json = JSON.parse(raw.replace(/^\)\]\}'\s*/, "")) as any;
      const widgets: any[] = json.widgets ?? [];

      // Step 2: grab RELATED_QUERIES widget
      const rqWidget = widgets.find((w: any) => w.id === "RELATED_QUERIES");
      if (!rqWidget) { log(`  Google Trends "${kw}"... no related queries`); continue; }

      const { token, request: rqReq } = rqWidget;
      await new Promise(r => setTimeout(r, 1500)); // be gentle

      const rqUrl = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(rqReq))}&token=${encodeURIComponent(token)}`;
      const rqRes = await fetchRetry(rqUrl, { headers: HEADERS }, log);

      if (!rqRes.ok) { log(`  Google Trends related "${kw}"... skip (${rqRes.status})`); continue; }

      const rqRaw = await rqRes.text();
      const rqJson = JSON.parse(rqRaw.replace(/^\)\]\}'\s*/, "")) as any;
      const rankedLists: any[] = rqJson?.default?.rankedList ?? [];

      let kwTotal = 0;
      // rankedLists[0] = TOP queries, rankedLists[1] = RISING queries
      for (let listIdx = 0; listIdx < rankedLists.length; listIdx++) {
        const label = listIdx === 0 ? "Top search" : "Rising search";
        for (const item of rankedLists[listIdx]?.rankedKeyword ?? []) {
          const query: string = item.query ?? "";
          if (!query || query.length < 8) continue;

          const isBreakout = item.formattedValue === "Breakout";
          const rawText = [
            `${label} on Google Trends: "${query}"`,
            `Related to keyword: "${kw}"`,
            isBreakout ? "Breakout query - trending sharply upward." : `Trend value: ${item.formattedValue ?? item.value}`,
          ].join("\n");

          const url = `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}&date=${encodeURIComponent(timeParam)}&hl=en-US`;
          if (await saveSignal(ch, "google_trends", rawText, url)) kwTotal++;
        }
      }

      log(`  Google Trends "${kw}"... ${kwTotal} new`);
      total += kwTotal;

    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      log(`  Google Trends "${kw}"... error: ${err}`);
    }

    await new Promise(r => setTimeout(r, 2500)); // 2.5s between keywords to stay safe
  }

  return total;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main() {
  const channelId = process.env.CHANNEL_ID ? parseInt(process.env.CHANNEL_ID, 10) : null;
  if (!channelId) { console.error("CHANNEL_ID env var required"); process.exit(1); }
  const lookbackDays = process.env.LOOKBACK_DAYS ? parseInt(process.env.LOOKBACK_DAYS, 10) : 30;
  await runChannel(channelId, console.log, { lookbackDays });
}

if (process.argv[1]?.endsWith("scrape-channel.ts") || process.argv[1]?.endsWith("scrape-channel.js")) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
