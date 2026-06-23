import { PAIN_PATTERNS, scorePainSignal } from "./reddit-patterns.js";

const UA = "web:burningdemand:0.1.0 (research tool)";

interface RedditPost {
  data: {
    id: string;
    name: string;
    title: string;
    selftext: string;
    subreddit: string;
    author: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
    upvote_ratio: number;
  };
}

interface RedditListingResponse {
  data: {
    children: RedditPost[];
    after: string | null;
    before: string | null;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type FeedSignal = {
  title: string; body: string; subreddit: string; author: string;
  permalink: string; createdUtc: number; matchedPattern: string; authenticityScore: number;
};

function matchPost(post: RedditPost): FeedSignal | null {
  const { title, selftext, subreddit: sub, author, permalink, created_utc } = post.data;
  const combined = title + " " + selftext;
  for (const pattern of PAIN_PATTERNS) {
    const stripped = pattern.replace(/^"|"$/g, "").toLowerCase();
    if (combined.toLowerCase().includes(stripped)) {
      return {
        title, body: selftext.slice(0, 500), subreddit: sub, author,
        permalink: `https://www.reddit.com${permalink}`,
        createdUtc: created_utc, matchedPattern: pattern,
        authenticityScore: scorePainSignal(title, selftext, sub, pattern),
      };
    }
  }
  return null;
}

/**
 * Fetch ALL new posts for a subreddit since `cursor`, paginating until
 * Reddit returns no more results. Uses `before=cursor` so we only fetch
 * posts the cursor hasn't seen, then paginates with `after` until empty.
 *
 * cursor = fullname of the newest post from the last scan (e.g. "t3_abc123").
 * Returns matched pain signals + updated cursor (newest post seen this run).
 */
export async function scanSubredditFeed(
  subreddit: string,
  cursor: string | null,
): Promise<{ signals: FeedSignal[]; newCursor: string | null }> {
  const allSignals: FeedSignal[] = [];
  let newCursor: string | null = null;
  let afterToken: string | null = null;
  const MAX_PAGES = 10; // safety cap: 10 × 100 = 1000 posts max per scan

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ limit: "100", raw_json: "1" });
    if (cursor) params.set("before", cursor);
    if (afterToken) params.set("after", afterToken);

    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?${params.toString()}`;
    let json: RedditListingResponse;

    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) break;
      json = await res.json() as RedditListingResponse;
    } catch {
      break;
    }

    const posts = json.data?.children ?? [];
    if (posts.length === 0) break;

    // Track the newest post seen (first post on first page)
    if (page === 0 && posts[0]) newCursor = posts[0].data.name;

    for (const post of posts) {
      const sig = matchPost(post);
      if (sig) allSignals.push(sig);
    }

    // Only paginate when catching up from a known cursor.
    // On first scan (no cursor), one page is enough - we just want recent posts.
    if (!cursor) break;
    afterToken = json.data.after ?? null;
    if (!afterToken) break;

    await sleep(300); // be polite between pages
  }

  return { signals: allSignals, newCursor };
}

/**
 * Loop all tracked communities, scan their feeds, and insert new signals.
 */
export async function runFeedScans(): Promise<{
  scannedCommunities: number;
  newSignals: number;
  skippedDuplicates: number;
}> {
  const { db, discoveredCommunities, signals } = await import("../db/index.js");
  const { eq, isNull, and } = await import("drizzle-orm");

  const communities = await db
    .select()
    .from(discoveredCommunities)
    .where(eq(discoveredCommunities.tracked, true));

  const fiftyFiveMinutesAgo = new Date(Date.now() - 55 * 60 * 1000);

  let scannedCommunities = 0;
  let newSignals = 0;
  let skippedDuplicates = 0;

  for (const community of communities) {
    // Skip communities scanned in the last 55 minutes
    if (community.lastScannedAt && community.lastScannedAt > fiftyFiveMinutesAgo) {
      continue;
    }

    const { signals: matched, newCursor } = await scanSubredditFeed(
      community.subreddit,
      (community as typeof community & { lastPostCursor?: string | null }).lastPostCursor ?? null,
    );

    scannedCommunities++;

    for (const signal of matched) {
      const permalink = signal.permalink;

      // Duplicate check
      const existing = await db
        .select({ id: signals.id })
        .from(signals)
        .where(eq(signals.url, permalink))
        .limit(1);

      if (existing.length > 0) {
        skippedDuplicates++;
        continue;
      }

      await db.insert(signals).values({
        projectId: null,
        channelId: null,
        source: "reddit",
        rawText: signal.title + (signal.body ? "\n\n" + signal.body : ""),
        url: permalink,
        category: "pain",
        market: "saas",
        postedAt: new Date(signal.createdUtc * 1000),
        authenticityScore: signal.authenticityScore,
        subreddit: signal.subreddit,
        authorName: signal.author,
      } as Parameters<typeof db.insert>[0] extends infer T ? Record<string, unknown> : never as any);

      newSignals++;
    }

    // Update cursor + lastScannedAt
    await db
      .update(discoveredCommunities)
      .set({
        lastScannedAt: new Date(),
        ...(newCursor ? { lastPostCursor: newCursor } : {}),
        updatedAt: new Date(),
      } as any)
      .where(eq(discoveredCommunities.id, community.id));

    // Rate limit: 300ms between subreddits
    await sleep(300);
  }

  return { scannedCommunities, newSignals, skippedDuplicates };
}

/**
 * For each signal author not yet expanded, fetch their submissions and discover new subreddits.
 */
export async function expandFromCoAuthors(limit = 10): Promise<{
  authorsExpanded: number;
  communitiesFound: number;
}> {
  const { db, signals, discoveredCommunities } = await import("../db/index.js");
  const { isNull, gte, and, eq } = await import("drizzle-orm");

  const rows = await db
    .select()
    .from(signals)
    .where(
      and(
        isNull((signals as any).authorExpandedAt),
        gte(signals.authenticityScore, 7),
        // authorName IS NOT NULL - we filter in JS since isNotNull may not be imported
      ),
    )
    .limit(limit);

  // Filter only rows that have authorName
  const eligible = rows.filter((r) => (r as any).authorName);

  let authorsExpanded = 0;
  let communitiesFound = 0;

  for (const row of eligible) {
    const author = (row as any).authorName as string;

    try {
      const res = await fetch(
        `https://www.reddit.com/user/${encodeURIComponent(author)}/submitted.json?limit=25&raw_json=1`,
        { headers: { "User-Agent": UA } },
      );

      if (res.ok) {
        const json = (await res.json()) as RedditListingResponse;
        const posts = json.data?.children ?? [];

        const subs = [...new Set(posts.map((p) => p.data.subreddit))];

        for (const sub of subs) {
          // Upsert: insert only if not already known
          const existing = await db
            .select({ id: discoveredCommunities.id })
            .from(discoveredCommunities)
            .where(eq(discoveredCommunities.subreddit, sub))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(discoveredCommunities).values({
              subreddit: sub,
              discoveryAngle: "co_author",
              tracked: false,
              scanStatus: "idle",
              postsAnalyzed: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            communitiesFound++;
          }
        }
      }
    } catch {
      // Ignore per-author errors
    }

    // Mark signal as expanded
    await db
      .update(signals)
      .set({ authorExpandedAt: new Date() } as any)
      .where(eq(signals.id, row.id));

    authorsExpanded++;

    // Rate limit: 200ms between authors
    await sleep(200);
  }

  return { authorsExpanded, communitiesFound };
}
