import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { resolve } from "path";
import * as schema from "./schema.js";

const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), "burningdemand.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Products: build/deploy/monetize entity promoted from an Idea (projects).
sqlite.exec(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  handle TEXT,
  domain TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  deploy_status TEXT DEFAULT 'draft',
  repo_url TEXT,
  coolify_app_id TEXT,
  cloudflare_zone_id TEXT,
  vps_ip TEXT,
  tech_stack_id INTEGER REFERENCES tech_stacks(id) ON DELETE SET NULL,
  design_direction TEXT,
  twitter_handle TEXT,
  payment_processor TEXT,
  pricing_model TEXT,
  price_point_cents INTEGER,
  trial_days INTEGER,
  has_free INTEGER DEFAULT 0,
  checkout_url TEXT,
  target_mrr_cents INTEGER,
  sort_order INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS project_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'building',
  started_at INTEGER NOT NULL,
  shipped_at INTEGER
)`);

const DEFAULT_STACK_CONTENT = `- Stack: TanStack Start, React.js, SQLite, Drizzle ORM, TailwindCSS, shadcn/ui, base-ui-components, Polar.sh, Sentry, PostHog, better-auth, lucide-react, mailchecker, recharts, remark, rehype, @tanstack/react-table, Vite, Vitest, pnpm, OpenRouter\n- Deployable via Coolify`;

sqlite.exec(`CREATE TABLE IF NOT EXISTS tech_stacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Add integration columns to founder_profile if missing
const founderCols = sqlite.prepare("PRAGMA table_info(founder_profile)").all() as { name: string }[];
const founderMigrations: [string, string][] = [
  ["git_org", "TEXT"],
  ["git_token", "TEXT"],
  ["dns_provider", "TEXT DEFAULT 'cloudflare'"],
  ["cloudflare_token", "TEXT"],
  ["cloudflare_account_id", "TEXT"],
  ["registrar_provider", "TEXT DEFAULT 'namecheap'"],
  ["namecheap_user", "TEXT"],
  ["namecheap_key", "TEXT"],
  ["deployment_provider", "TEXT DEFAULT 'coolify'"],
  ["coolify_api_key", "TEXT"],
  ["coolify_server_url", "TEXT"],
  ["local_repos_dir", "TEXT"],
  ["openrouter_key", "TEXT"],
  ["global_vps_ip", "TEXT"],
  ["stripe_webhook_secret", "TEXT"],
];
for (const [col, def] of founderMigrations) {
  if (!founderCols.find(c => c.name === col)) {
    sqlite.exec(`ALTER TABLE founder_profile ADD COLUMN ${col} ${def}`);
  }
}

// Add version_type to project_versions if missing
const pvCols = sqlite.prepare("PRAGMA table_info(project_versions)").all() as { name: string }[];
if (!pvCols.find(c => c.name === "version_type")) {
  sqlite.exec("ALTER TABLE project_versions ADD COLUMN version_type TEXT NOT NULL DEFAULT 'major'");
}

// Add removed_in_version_id to features if missing
const featureCols = sqlite.prepare("PRAGMA table_info(features)").all() as { name: string }[];
if (!featureCols.find(c => c.name === "removed_in_version_id")) {
  sqlite.exec("ALTER TABLE features ADD COLUMN removed_in_version_id INTEGER REFERENCES project_versions(id) ON DELETE SET NULL");
}

// Idea (projects) discovery columns — product columns now live on `products`.
const projectsCols = sqlite.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
if (!projectsCols.find(c => c.name === "sort_order")) {
  sqlite.exec("ALTER TABLE projects ADD COLUMN sort_order INTEGER");
}
if (!projectsCols.find(c => c.name === "scan_schedule")) {
  sqlite.exec("ALTER TABLE projects ADD COLUMN scan_schedule TEXT NOT NULL DEFAULT 'manual'");
}
if (!projectsCols.find(c => c.name === "scan_next_run_at")) {
  sqlite.exec("ALTER TABLE projects ADD COLUMN scan_next_run_at INTEGER");
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS design_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS design_systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

const existing = sqlite.prepare("SELECT COUNT(*) as n FROM tech_stacks").get() as { n: number };
if (existing.n === 0) {
  const now = Math.floor(Date.now() / 1000);
  sqlite.prepare("INSERT INTO tech_stacks (name, content, is_default, created_at, updated_at) VALUES (?, ?, 1, ?, ?)")
    .run("Default", DEFAULT_STACK_CONTENT, now, now);
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  playbook_id INTEGER REFERENCES distribution_playbooks(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  platform_meta TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_review',
  title TEXT,
  content TEXT NOT NULL DEFAULT '',
  scheduled_at INTEGER,
  published_at INTEGER,
  post_url TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS product_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_task_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_key TEXT NOT NULL UNIQUE,
  tool TEXT NOT NULL DEFAULT 'cli',
  cli_bin TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Seed default AI task config (all default to local claude -p; user overrides in Settings)
{
  const AI_TASKS = ["build", "opportunity", "scoring", "summaries", "channels", "distribution", "discovery"];
  const now = Math.floor(Date.now() / 1000);
  const insTask = sqlite.prepare("INSERT OR IGNORE INTO ai_task_config (task_key, tool, cli_bin, model, created_at, updated_at) VALUES (?, 'cli', NULL, NULL, ?, ?)");
  for (const k of AI_TASKS) insTask.run(k, now, now);
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS distribution_playbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  why_it_works TEXT NOT NULL,
  time_horizon TEXT NOT NULL,
  effort TEXT NOT NULL,
  applies_to TEXT NOT NULL DEFAULT 'all',
  checklist_template TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 99,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS project_playbook_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  playbook_id INTEGER NOT NULL REFERENCES distribution_playbooks(id) ON DELETE CASCADE,
  is_active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'not_started',
  checklist_progress TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  config TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS ai_cost_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  model TEXT NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'unknown',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  prompt_text TEXT,
  response_text TEXT,
  created_at INTEGER NOT NULL
)`);

// Add prompt_text / response_text to ai_cost_entries if missing (migration for existing DBs)
const aiCostCols = sqlite.prepare("PRAGMA table_info(ai_cost_entries)").all() as { name: string }[];
if (!aiCostCols.find(c => c.name === "prompt_text")) {
  sqlite.exec("ALTER TABLE ai_cost_entries ADD COLUMN prompt_text TEXT");
}
if (!aiCostCols.find(c => c.name === "response_text")) {
  sqlite.exec("ALTER TABLE ai_cost_entries ADD COLUMN response_text TEXT");
}

// Add sort_order to project_playbook_instances if missing
const ppiCols = sqlite.prepare("PRAGMA table_info(project_playbook_instances)").all() as { name: string }[];
if (!ppiCols.find(c => c.name === "sort_order")) {
  sqlite.exec("ALTER TABLE project_playbook_instances ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 99");
}

// Add scan_schedule / next_run_at to channels if missing
const channelCols = sqlite.prepare("PRAGMA table_info(channels)").all() as { name: string }[];
if (!channelCols.find(c => c.name === "scan_schedule")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN scan_schedule TEXT NOT NULL DEFAULT 'manual'");
}
if (!channelCols.find(c => c.name === "next_run_at")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN next_run_at INTEGER");
}
// Dual-ownership: distribution channels reference a product
if (!channelCols.find(c => c.name === "product_id")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE CASCADE");
}
// Dual-ownership: distribution seo_runs reference a product
const seoRunCols = sqlite.prepare("PRAGMA table_info(seo_runs)").all() as { name: string }[];
if (seoRunCols.length > 0 && !seoRunCols.find(c => c.name === "product_id")) {
  sqlite.exec("ALTER TABLE seo_runs ADD COLUMN product_id INTEGER REFERENCES products(id) ON DELETE CASCADE");
}

const existingPlaybooks = sqlite.prepare("SELECT COUNT(*) as n FROM distribution_playbooks").get() as { n: number };
if (existingPlaybooks.n === 0) {
  const now = Math.floor(Date.now() / 1000);
  const insertPlaybook = sqlite.prepare(`INSERT INTO distribution_playbooks
    (slug, name, description, why_it_works, time_horizon, effort, applies_to, checklist_template, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const playbooks = [
    {
      slug: "community-posts",
      name: "Community Posts",
      description: "Post authentically in the exact community where your buyer lives.",
      whyItWorks: "One post in the right community reaches thousands of qualified buyers instantly. No algorithm, no ad budget - just relevance. It's the fastest path to first users.",
      timeHorizon: "day1",
      effort: "one-time",
      appliesTo: "all",
      sortOrder: 1,
      checklist: ["Find 3 specific communities (subreddits, Slack groups, Discord servers) where your buyer posts daily", "Write an authentic 'I built this because I had this pain' post - no marketing language", "Post during peak hours (9am Tue–Thu)", "Respond to every comment in the first 2 hours", "Cross-post to HN (Show HN), Indie Hackers, Bluesky"],
    },
    {
      slug: "free-tool",
      name: "Free Tool",
      description: "Ship one feature of your product as a standalone free tool.",
      whyItWorks: "Free tools rank on Google, get shared, and convert visitors into paid users. Every use of the free tool is exposure to your brand. The best ones spread without you doing anything.",
      timeHorizon: "week1",
      effort: "one-time",
      appliesTo: "all",
      sortOrder: 2,
      checklist: ["Identify the single feature with the broadest appeal that works standalone", "Build it at /tools/[name] with no login required", "Add 'Powered by [Product]' footer with link", "Submit to free tool directories (There's An AI, Futurepedia, Product Hunt)", "Add email capture before showing full result"],
    },
    {
      slug: "viral-artifact",
      name: "Viral Artifact",
      description: "Make the output your users create shareable by design.",
      whyItWorks: "Every time a user shares their output, it's an ad for your product. The best SaaS products create artifacts users want to brag about - reports, badges, scores, certificates. Each share is a conversion opportunity.",
      timeHorizon: "week1",
      effort: "one-time",
      appliesTo: "all",
      sortOrder: 3,
      checklist: ["Define what your users want to brag about (score, report, achievement, comparison)", "Design a shareable card/image/page with product branding", "Add 1-click share to Twitter, LinkedIn, WhatsApp", "Create a public URL for each artifact (no login to view)", "Track shares and conversions from shared links"],
    },
    {
      slug: "programmatic-seo",
      name: "Programmatic SEO",
      description: "Generate thousands of pages targeting long-tail search queries.",
      whyItWorks: "10,000 pages targeting 'best [X] for [Y]' and '[tool] alternative' queries can drive millions of monthly visitors on autopilot. Google brings the audience - you just need to be indexed.",
      timeHorizon: "month1",
      effort: "one-time",
      appliesTo: "all",
      sortOrder: 4,
      checklist: ["Research keyword patterns (Best X for Y, X alternative, How to X without Y)", "Build a dynamic page template that renders well for each keyword", "Generate first 100 pages with AI content, review quality", "Submit sitemap to Google Search Console", "Monitor rankings and scale to 1k then 10k pages"],
    },
    {
      slug: "aeo",
      name: "Answer Engine Optimization",
      description: "Get cited by ChatGPT, Perplexity, and AI search engines.",
      whyItWorks: "AI assistants are becoming the first stop for product research. When someone asks ChatGPT 'what's the best tool for X?' you want to be in the answer. Structured, direct content gets cited. Vague marketing copy does not.",
      timeHorizon: "month1",
      effort: "one-time",
      appliesTo: "all",
      sortOrder: 5,
      checklist: ["Add FAQ section with schema markup to home and key pages", "Write direct-answer pages: 'What is X?', 'How does X work?', 'X vs Y'", "Build comparison tables that AI can parse (structured HTML, not images)", "Add JSON-LD structured data to all pages", "Monitor Perplexity and ChatGPT citations for your category keywords"],
    },
    {
      slug: "mcp-server",
      name: "MCP Server",
      description: "Expose your product as an MCP server so AI agents use it natively.",
      whyItWorks: "As AI agents become how people work, products that are MCP-compatible get used by agents automatically. Build once, get distributed through every AI client that supports MCP (Claude, Cursor, etc.).",
      timeHorizon: "month1",
      effort: "one-time",
      appliesTo: "dev-tools",
      sortOrder: 6,
      checklist: ["Identify 3-5 questions your product can answer via API", "Build MCP server exposing those endpoints as tools", "Publish on GitHub with MCP badge and clear README", "Submit to awesome-mcp-servers and MCP directories", "Write 'How to use [Product] with Claude' blog post"],
    },
    {
      slug: "newsletter",
      name: "Newsletter",
      description: "Build a niche newsletter that attracts your exact buyer.",
      whyItWorks: "A focused newsletter on the exact problem you solve attracts the exact buyer who will pay for the solution. Subscribers convert at 5-10x the rate of cold traffic. The newsletter IS the distribution channel.",
      timeHorizon: "month1",
      effort: "ongoing",
      appliesTo: "all",
      sortOrder: 7,
      checklist: ["Pick a tight niche angle (not product updates - a perspective your buyer cares about)", "Choose platform: Beehiiv (growth tools), Substack (discovery), ConvertKit (automation)", "Write first 3 issues before launching", "Add subscribe CTA inside your product and free tool", "Cross-promote in community posts"],
    },
    {
      slug: "content-repurposing",
      name: "AI Content Repurposing Engine",
      description: "Turn one pillar piece into 7 content formats automatically.",
      whyItWorks: "One podcast episode, YouTube video, or long blog post contains enough material for weeks of content. AI can repurpose it into tweets, clips, LinkedIn posts, and email sequences in minutes. One recording session → months of distribution.",
      timeHorizon: "month2",
      effort: "ongoing",
      appliesTo: "all",
      sortOrder: 8,
      checklist: ["Record or write one pillar piece (podcast ep / YouTube video / long-form post)", "Extract 10 tweet-worthy insights with AI", "Cut 5 short-form video clips (30-90 seconds)", "Generate newsletter edition from pillar transcript", "Create 5 LinkedIn posts from key points", "Generate quote graphics for strongest lines", "Build 5-email onboarding sequence from pillar content"],
    },
  ];

  for (const p of playbooks) {
    insertPlaybook.run(
      p.slug, p.name, p.description, p.whyItWorks,
      p.timeHorizon, p.effort, p.appliesTo,
      JSON.stringify(p.checklist), p.sortOrder, now, now
    );
  }
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  mrr_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS cac_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  spend_cents INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  period_start INTEGER,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS traffic_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sources_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS domain_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  results_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`);

// ── Phase 1-3: Signal quality + channel deep scan + pain clusters + ideas ─────

// Signal quality columns
const signalCols = sqlite.prepare("PRAGMA table_info(signals)").all() as { name: string }[];
if (!signalCols.find(c => c.name === "authenticity_score")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN authenticity_score INTEGER");
}
if (!signalCols.find(c => c.name === "poster_intent")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN poster_intent TEXT");
}
if (!signalCols.find(c => c.name === "intent_signals")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN intent_signals TEXT");
}
if (!signalCols.find(c => c.name === "recurring")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN recurring INTEGER DEFAULT 0");
}
if (!signalCols.find(c => c.name === "cluster_id")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN cluster_id INTEGER");
}
if (!signalCols.find(c => c.name === "subreddit")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN subreddit TEXT");
}
if (!signalCols.find(c => c.name === "author_name")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN author_name TEXT");
}
if (!signalCols.find(c => c.name === "author_expanded_at")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN author_expanded_at INTEGER");
}

// Channel deep scan columns
if (!channelCols.find(c => c.name === "deep_scan_status")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN deep_scan_status TEXT DEFAULT 'idle'");
}
if (!channelCols.find(c => c.name === "last_deep_scan_at")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN last_deep_scan_at INTEGER");
}
if (!channelCols.find(c => c.name === "deep_scan_progress")) {
  sqlite.exec("ALTER TABLE channels ADD COLUMN deep_scan_progress INTEGER DEFAULT 0");
}

// Pain clusters table
sqlite.exec(`CREATE TABLE IF NOT EXISTS pain_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme TEXT NOT NULL,
  description TEXT NOT NULL,
  communities TEXT NOT NULL DEFAULT '[]',
  signal_ids TEXT NOT NULL DEFAULT '[]',
  signal_count INTEGER NOT NULL DEFAULT 0,
  avg_authenticity_score REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  theme_json TEXT,
  first_seen_at INTEGER,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Channel profiles table
sqlite.exec(`CREATE TABLE IF NOT EXISTS channel_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  subreddit TEXT,
  profile_json TEXT NOT NULL,
  posts_analyzed INTEGER NOT NULL DEFAULT 0,
  lookback_days INTEGER NOT NULL DEFAULT 365,
  created_at INTEGER NOT NULL
)`);

// Ideas table
sqlite.exec(`CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hypothesis TEXT,
  direction_type TEXT,
  status TEXT NOT NULL DEFAULT 'setup',
  selected_communities TEXT,
  pain_cluster_id INTEGER REFERENCES pain_clusters(id) ON DELETE SET NULL,
  lookback_days INTEGER NOT NULL DEFAULT 90,
  analysis_json TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS discovery_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  extracted_keywords TEXT,
  min_subscribers INTEGER NOT NULL DEFAULT 1000,
  max_subscribers INTEGER NOT NULL DEFAULT 30000,
  min_engagement_ratio REAL NOT NULL DEFAULT 0.005,
  lookback_days INTEGER NOT NULL DEFAULT 60,
  last_run_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Add min_subscribers to discovery_profiles if missing (existing DBs)
const dpCols = sqlite.prepare("PRAGMA table_info(discovery_profiles)").all() as { name: string }[];
if (!dpCols.find(c => c.name === "min_subscribers")) {
  sqlite.exec("ALTER TABLE discovery_profiles ADD COLUMN min_subscribers INTEGER NOT NULL DEFAULT 1000");
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS discovered_communities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subreddit TEXT NOT NULL UNIQUE,
  subscriber_count INTEGER,
  active_user_count INTEGER,
  engagement_ratio REAL,
  description TEXT,
  discovery_angle TEXT,
  discovery_reason TEXT,
  tracked INTEGER NOT NULL DEFAULT 0,
  profile_json TEXT,
  cff_json TEXT,
  posts_analyzed INTEGER NOT NULL DEFAULT 0,
  scan_status TEXT NOT NULL DEFAULT 'idle',
  last_scanned_at INTEGER,
  discovery_profile_id INTEGER REFERENCES discovery_profiles(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Add discovery_angle / discovery_reason to discovered_communities if missing
const dcCols = sqlite.prepare("PRAGMA table_info(discovered_communities)").all() as { name: string }[];
if (!dcCols.find(c => c.name === "discovery_angle")) {
  sqlite.exec("ALTER TABLE discovered_communities ADD COLUMN discovery_angle TEXT");
}
if (!dcCols.find(c => c.name === "discovery_reason")) {
  sqlite.exec("ALTER TABLE discovered_communities ADD COLUMN discovery_reason TEXT");
}
if (!dcCols.find(c => c.name === "last_post_cursor")) {
  sqlite.exec("ALTER TABLE discovered_communities ADD COLUMN last_post_cursor TEXT");
}

sqlite.exec(`CREATE TABLE IF NOT EXISTS search_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keywords TEXT NOT NULL,
  mode TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  results_json TEXT,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS pain_search_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL,
  keywords TEXT,
  search_queries TEXT,
  signals_json TEXT,
  communities_json TEXT,
  signal_count INTEGER NOT NULL DEFAULT 0,
  community_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS market_scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vertical_slug TEXT NOT NULL,
  vertical_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  expansion_json TEXT,
  communities_json TEXT,
  signal_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS problem_shapes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shape TEXT NOT NULL,
  description TEXT NOT NULL,
  verticals TEXT NOT NULL DEFAULT '[]',
  signal_ids TEXT NOT NULL DEFAULT '[]',
  signal_count INTEGER NOT NULL DEFAULT 0,
  severity INTEGER,
  mrr_ceiling TEXT,
  mrr_score REAL,
  wedge_recommendation TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  last_detected_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

// Reply tracking on signals
const _signalColsReply = sqlite.prepare("PRAGMA table_info(signals)").all() as { name: string }[];
if (!_signalColsReply.find(c => c.name === "replied_at")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN replied_at INTEGER");
}
if (!_signalColsReply.find(c => c.name === "reply_draft")) {
  sqlite.exec("ALTER TABLE signals ADD COLUMN reply_draft TEXT");
}

// ── Pipeline Ideas ────────────────────────────────────────────────────────────

sqlite.exec(`CREATE TABLE IF NOT EXISTS pipeline_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  source_links TEXT,
  domain TEXT,
  target_user TEXT,
  pain_description TEXT,
  pain_score INTEGER NOT NULL DEFAULT 0,
  frequency_score INTEGER NOT NULL DEFAULT 0,
  monetization_score INTEGER NOT NULL DEFAULT 0,
  reachability_score INTEGER NOT NULL DEFAULT 0,
  build_effort_score INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CAPTURED',
  notes TEXT,
  next_action TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`);

sqlite.exec(`CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id INTEGER NOT NULL REFERENCES pipeline_ideas(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  result_metrics TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL
)`);

export const db = drizzle(sqlite, { schema });
export * from "./schema.js";
