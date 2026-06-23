export type ChannelType =
  | "reddit" | "hn" | "twitter" | "bluesky"
  | "youtube" | "podcast" | "trustpilot" | "producthunt"
  | "stackoverflow" | "github" | "devto" | "mastodon" | "indie_hackers"
  | "lobsters" | "community" | "jobs"
  | "firefox" | "edgar" | "regulatory" | "lemmy" | "google_trends";

export type ChannelConfig = {
  keywords?: string[];
  subreddits?: string[];
};

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  reddit: "Reddit",
  hn: "Hacker News",
  twitter: "Twitter / X",
  bluesky: "Bluesky",
  youtube: "YouTube",
  podcast: "Podcasts",
  trustpilot: "Trustpilot",
  producthunt: "Product Hunt",
  stackoverflow: "Stack Overflow",
  github: "GitHub",
  devto: "dev.to",
  mastodon: "Mastodon",
  indie_hackers: "Indie Hackers",
  lobsters: "Lobsters",

  community: "Forums",
  jobs: "Job Boards",
  firefox: "Firefox Add-ons",
  edgar: "SEC Edgar",
  regulatory: "Regulatory",
  lemmy: "Lemmy",
  google_trends: "Google Trends",
};

// "free" = no key needed | "key" = free API key required | "paid" = pay-per-use
export type ChannelCost = "free" | "key" | "paid";

export const CHANNEL_COST: Record<ChannelType, ChannelCost> = {
  reddit: "free",
  hn: "free",
  twitter: "key",      // TWITTER_BEARER_TOKEN (paid tier)
  bluesky: "key",      // BSKY_IDENTIFIER + BSKY_APP_PASSWORD
  youtube: "key",      // YOUTUBE_API_KEY (free quota)
  podcast: "key",      // PODCAST_INDEX_KEY + PODCAST_INDEX_SECRET
  trustpilot: "paid",     // DataForSEO pay-per-request
  producthunt: "key",      // PH_API_TOKEN (free)
  stackoverflow: "free",
  github: "free",     // GITHUB_TOKEN optional
  devto: "free",
  mastodon: "free",
  indie_hackers: "free",
  lobsters: "free",

  community: "free",
  jobs: "free",
  firefox: "free",
  edgar: "free",
  regulatory: "free",
  lemmy: "free",
  google_trends: "free",
};

export const CHANNEL_COST_LABEL: Record<ChannelCost, string> = {
  free: "free",
  key: "API key",
  paid: "paid$",
};

export type RateLimit = {
  label: string;       // short display string e.g. "60/min · 10-min window"
  maxReqs: number;     // requests allowed
  windowMs: number;    // window in milliseconds
  note?: string;       // extra context shown in tooltip
};

export const CHANNEL_RATE_LIMITS: Partial<Record<ChannelType, RateLimit>> = {
  reddit: { label: "60/min · 10-min window", maxReqs: 60, windowMs: 60_000, note: "Authenticated. Reddit tracks a sliding 10-min window. Headers: x-ratelimit-remaining / x-ratelimit-reset." },
  github: { label: "5,000/hr (auth)", maxReqs: 5000, windowMs: 3_600_000, note: "With GITHUB_TOKEN. 60/hr unauthenticated. Search API: 30/min." },
  stackoverflow: { label: "300/day (no key)", maxReqs: 300, windowMs: 86_400_000, note: "10,000/day with registered API key." },
  producthunt: { label: "450/15 min", maxReqs: 450, windowMs: 900_000, note: "GraphQL API. Resets every 15 minutes." },
  bluesky: { label: "3,000/5 min", maxReqs: 3000, windowMs: 300_000, note: "AT Protocol public API. Per-IP." },
  devto: { label: "30/min", maxReqs: 30, windowMs: 60_000, note: "Unauthenticated. Higher with API key." },
  firefox: { label: "5/sec", maxReqs: 5, windowMs: 1_000, note: "Mozilla Add-ons API." },
  edgar: { label: "10/sec", maxReqs: 10, windowMs: 1_000, note: "SEC EDGAR full-text search. FIFO queue." },
  youtube: { label: "10,000 units/day", maxReqs: 10000, windowMs: 86_400_000, note: "Quota-based: search=100 units, videos=1 unit. Resets midnight Pacific." },
  mastodon: { label: "300/5 min", maxReqs: 300, windowMs: 300_000, note: "Per-instance. Varies - some instances stricter." },
  hn: { label: "~600/min", maxReqs: 600, windowMs: 60_000, note: "Algolia HN Search API - generous, no documented hard limit." },
  lobsters: { label: "polite", maxReqs: 30, windowMs: 60_000, note: "No official limit. Keep it slow and respectful." },
  indie_hackers: { label: "polite", maxReqs: 20, windowMs: 60_000, note: "No official API. Scraping - be conservative." },
  lemmy: { label: "60/min (varies)", maxReqs: 60, windowMs: 60_000, note: "Per-instance. Defaults: 60 req/min for read operations." },
  trustpilot: { label: "pay-per-request", maxReqs: 100, windowMs: 60_000, note: "DataForSEO billing. No hard rate limit but each call costs $." },
  jobs: { label: "varies", maxReqs: 30, windowMs: 60_000, note: "Remotive / WWR / Adzuna - each has own limits. Adzuna: 1/sec." },
  community: { label: "varies by forum", maxReqs: 30, windowMs: 60_000, note: "Discourse default: 60 req/min unauthenticated." },
  google_trends: { label: "~1 req/2s (informal)", maxReqs: 30, windowMs: 60_000, note: "Unofficial API - no documented limit. Be slow: 1 req per 2–3s. Too many fast requests triggers 429 or CAPTCHA." },
};

// Channels with no working backend implementation - shown grayed out in picker
export const CHANNEL_DISABLED = new Set<ChannelType>(["twitter", "regulatory"]);

export const CHANNEL_GROUPS: { label: string; channels: ChannelType[] }[] = [
  { label: "Communities", channels: ["reddit", "hn", "indie_hackers", "lobsters", "community", "lemmy"] },
  { label: "Reviews", channels: ["trustpilot", "producthunt", "firefox"] },
  { label: "Social", channels: ["twitter", "bluesky", "mastodon"] },
  { label: "Dev", channels: ["stackoverflow", "github", "devto"] },
  { label: "Content", channels: ["youtube", "podcast"] },
  { label: "Jobs & Markets", channels: ["jobs"] },
  { label: "Regulatory", channels: ["edgar"] },
];
