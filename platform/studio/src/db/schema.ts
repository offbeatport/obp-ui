import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import type { OpportunityInsights, ValidationChecklist } from "../lib/types.js";

// ── Founder / Company ─────────────────────────────────────────────────────────

export const founderProfile = sqliteTable("founder_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  handle: text("handle"),               // e.g. @vladpalos
  companyName: text("company_name"),
  domain: text("domain"),               // e.g. burningdemand.com
  cvRaw: text("cv_raw"),
  skills: text("skills", { mode: "json" }).$type<string[]>(),
  domainExpertise: text("domain_expertise", { mode: "json" }).$type<string[]>(),
  unfairAdvantages: text("unfair_advantages", { mode: "json" }).$type<string[]>(),
  channelsReach: text("channels_reach", { mode: "json" }).$type<Record<string, number>>(),
  gitOrg: text("git_org"),
  gitToken: text("git_token"),
  // DNS
  dnsProvider: text("dns_provider").default("cloudflare"),
  cloudflareToken: text("cloudflare_token"),
  cloudflareAccountId: text("cloudflare_account_id"),
  // Domain registrar
  registrarProvider: text("registrar_provider").default("namecheap"),
  namecheapUser: text("namecheap_user"),
  namecheapKey: text("namecheap_key"),
  // Deployment
  deploymentProvider: text("deployment_provider").default("coolify"),
  coolifyApiKey: text("coolify_api_key"),
  coolifyServerUrl: text("coolify_server_url"),
  localReposDir: text("local_repos_dir"),
  // Integrations
  openRouterKey: text("openrouter_key"),
  globalVpsIp: text("global_vps_ip"),
  stripeWebhookSecret: text("stripe_webhook_secret"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Project ───────────────────────────────────────────────────────────────────

// `projects` is the IDEA: the discovery workspace. All build/deploy/monetize
// concerns live on `products` (created explicitly when an idea is built).
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["active", "paused", "archived"],
  })
    .notNull()
    .default("active"),
  hypothesis: text("hypothesis"),
  sortOrder: integer("sort_order"),
  scanSchedule: text("scan_schedule", { enum: ["manual", "daily", "weekly"] }).notNull().default("manual"),
  scanNextRunAt: integer("scan_next_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Product ───────────────────────────────────────────────────────────────────
// A buildable/shippable product, promoted EXPLICITLY from an Idea (projects).
// One Idea may have many Products. Owns all build/deploy/monetize state and the
// build/launch/monitor child tables.

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),  // source opportunity the build reads
  name: text("name").notNull(),               // copied from idea at promotion, editable
  handle: text("handle"),                     // build/repo slug -> bd-{handle}
  domain: text("domain"),                     // product URL / subdomain
  status: text("status", { enum: ["active", "paused", "archived"] }).notNull().default("active"),
  deployStatus: text("deploy_status", { enum: ["draft", "deploying", "deployed", "failed"] }).default("draft"),
  repoUrl: text("repo_url"),
  coolifyAppId: text("coolify_app_id"),
  cloudflareZoneId: text("cloudflare_zone_id"),
  vpsIp: text("vps_ip"),
  techStackId: integer("tech_stack_id").references(() => techStacks.id, { onDelete: "set null" }),
  designDirection: text("design_direction"),
  twitterHandle: text("twitter_handle"),
  paymentProcessor: text("payment_processor"),   // polar | stripe | lemonsqueezy | gumroad
  pricingModel: text("pricing_model"),           // subscription | one_time | usage | freemium
  pricePointCents: integer("price_point_cents"),
  trialDays: integer("trial_days"),
  hasFree: integer("has_free", { mode: "boolean" }).default(false),
  checkoutUrl: text("checkout_url"),
  targetMrrCents: integer("target_mrr_cents"),
  sortOrder: integer("sort_order"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// ── ICP ───────────────────────────────────────────────────────────────────────

export const icps = sqliteTable("icps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  role: text("role"),
  companySize: text("company_size"),
  painUrgency: integer("pain_urgency"),  // 1–10
  wtpLowCents: integer("wtp_low_cents"),
  wtpHighCents: integer("wtp_high_cents"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Competitor ────────────────────────────────────────────────────────────────

export const competitors = sqliteTable("competitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url"),
  pricingDescription: text("pricing_description"),
  keyWeaknesses: text("key_weaknesses"),
  signalIds: text("signal_ids", { mode: "json" }).$type<number[]>(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Channel ───────────────────────────────────────────────────────────────────

export const channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),   // idea (discovery scanning)
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" }),   // product (distribution channels)
  type: text("type", {
    enum: [
      "reddit", "hn", "twitter", "bluesky",
      "youtube", "podcast", "trustpilot", "producthunt",
      "stackoverflow", "github", "devto", "mastodon", "indie_hackers",
      "lobsters", "community", "upwork", "jobs",
      "firefox", "edgar", "regulatory", "lemmy", "google_trends",
    ],
  }).notNull(),
  mode: text("mode", { enum: ["discovery", "distribution", "both"] })
    .notNull()
    .default("discovery"),
  config: text("config", { mode: "json" }).$type<{ keywords?: string[]; subreddits?: string[] }>(),
  reach: integer("reach"),
  status: text("status", { enum: ["active", "paused"] }).notNull().default("active"),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  scanSchedule: text("scan_schedule", { enum: ["manual", "daily", "weekly"] }).notNull().default("manual"),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  deepScanStatus: text("deep_scan_status", { enum: ["idle", "running", "done", "failed"] }).default("idle"),
  lastDeepScanAt: integer("last_deep_scan_at", { mode: "timestamp" }),
  deepScanProgress: integer("deep_scan_progress").default(0), // 0-100
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── DiscoveryRun ──────────────────────────────────────────────────────────────

export const discoveryRuns = sqliteTable("discovery_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  channelId: integer("channel_id")
    .references(() => channels.id, { onDelete: "set null" }),
  status: text("status", { enum: ["running", "completed", "failed"] })
    .notNull()
    .default("running"),
  configSnapshot: text("config_snapshot", { mode: "json" }).$type<Record<string, unknown>>(),
  signalCount: integer("signal_count").notNull().default(0),
  opportunityCount: integer("opportunity_count").notNull().default(0),
  costCents: integer("cost_cents").notNull().default(0),
  startedAt: integer("started_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// ── Signal ────────────────────────────────────────────────────────────────────

export const signals = sqliteTable("signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  channelId: integer("channel_id")
    .references(() => channels.id, { onDelete: "set null" }),
  source: text("source", {
    enum: [
      "g2", "capterra", "trustpilot", "reddit", "hn", "twitter",
      "jobs", "bluesky", "ph", "lobsters", "devto",
      "stackoverflow", "github", "mastodon", "ih", "community",
      "upwork", "youtube", "firefox", "podcast",
      "edgar", "regulatory", "lemmy", "google_trends",
    ],
  }).notNull(),
  rawText: text("raw_text").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  toolName: text("tool_name"),
  market: text("market").notNull().default("saas"),
  postedAt: integer("posted_at", { mode: "timestamp" }),
  scrapedAt: integer("scraped_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }),
  // Signal quality scoring
  authenticityScore: integer("authenticity_score"),   // 1-10: genuine buyer pain vs builder market research
  posterIntent: text("poster_intent", { enum: ["buyer", "seller", "unclear"] }),
  intentSignals: text("intent_signals", { mode: "json" }).$type<string[]>(), // reasons for the score
  recurring: integer("recurring", { mode: "boolean" }).default(false), // same user, same pain pattern
  clusterId: integer("cluster_id"),                   // FK to pain_clusters (added after table creation)
  subreddit: text("subreddit"),
  authorName: text("author_name"),
  authorExpandedAt: integer("author_expanded_at", { mode: "timestamp" }),
  repliedAt: integer("replied_at", { mode: "timestamp" }),
  replyDraft: text("reply_draft"),
});

// ── Opportunity ───────────────────────────────────────────────────────────────

export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),                      // markdown
  painSummary: text("pain_summary").notNull(),
  sector: text("sector").notNull(),
  community: text("community").notNull(),
  communityUrl: text("community_url"),
  scoreTotal: real("score_total").notNull(),
  scoresJson: text("scores_json", { mode: "json" })
    .$type<Record<string, number>>()
    .notNull(),
  briefMd: text("brief_md").notNull(),
  insightsJson: text("insights_json", { mode: "json" }).$type<OpportunityInsights>(),
  painIntensity: integer("pain_intensity"),              // 1–10
  wtpEvidence: text("wtp_evidence"),
  wtpLowCents: integer("wtp_low_cents"),
  wtpHighCents: integer("wtp_high_cents"),
  expectedMrrCents: integer("expected_mrr_cents"),
  fitScore: integer("fit_score"),                        // 1–10
  pass: integer("pass", { mode: "boolean" }).notNull().default(false),
  status: text("status", {
    enum: ["discovered", "validated", "building", "built", "launched", "measuring", "killed", "parked", "new", "interesting", "pass"],
  })
    .notNull()
    .default("new"),
  killReason: text("kill_reason"),
  notes: text("notes"),
  validateJson: text("validate_json", { mode: "json" }).$type<ValidationChecklist>(),
  signalCount: integer("signal_count").notNull().default(0),
  market: text("market").notNull().default("saas"),
  // SEO enrichment - populated when a discovery SEO run is linked to this opportunity
  seoRunId: integer("seo_run_id"),  // FK to seo_runs (no .references() to avoid circular at table level)
  topKeyword: text("top_keyword"),
  seoVolume: integer("seo_volume"),
  seoCpc: real("seo_cpc"),
  seoKeywordCount: integer("seo_keyword_count"),
  demandScore: real("demand_score"),  // 0–10: composite of volume × cpc × signal count
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── TechStacks ────────────────────────────────────────────────────────────────

export const techStacks = sqliteTable("tech_stacks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()).notNull(),
});
export type TechStack = typeof techStacks.$inferSelect;
export type NewTechStack = typeof techStacks.$inferInsert;

// ── DesignTemplates (Guidelines) ─────────────────────────────────────────────

export const designTemplates = sqliteTable("design_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type DesignTemplate = typeof designTemplates.$inferSelect;

// ── DesignSystems (HTML component references) ─────────────────────────────────

export const designSystems = sqliteTable("design_systems", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  content: text("content").notNull(),   // full HTML design system file
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type DesignSystem = typeof designSystems.$inferSelect;

// ── ProjectVersion ────────────────────────────────────────────────────────────

export const projectVersions = sqliteTable("project_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  versionNumber: integer("version_number").notNull(),
  status: text("status", { enum: ["building", "shipped"] }).notNull().default("building"),
  startedAt: integer("started_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  shippedAt: integer("shipped_at", { mode: "timestamp" }),
});

export type ProjectVersion = typeof projectVersions.$inferSelect;
export type NewProjectVersion = typeof projectVersions.$inferInsert;

// ── OpportunitySignal (join) ──────────────────────────────────────────────────

export const opportunitySignals = sqliteTable("opportunity_signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  signalId: integer("signal_id")
    .notNull()
    .references(() => signals.id, { onDelete: "cascade" }),
});

// ── OpportunityCompetitor (join) ──────────────────────────────────────────────

export const opportunityCompetitors = sqliteTable("opportunity_competitors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  competitorId: integer("competitor_id")
    .notNull()
    .references(() => competitors.id, { onDelete: "cascade" }),
  positioningAngle: text("positioning_angle"),
});

// ── Validation ────────────────────────────────────────────────────────────────

export const validations = sqliteTable("validations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .notNull()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  confidenceScore: integer("confidence_score"),           // 1–10
  pricingModel: text("pricing_model", {
    enum: ["subscription", "one_time", "usage", "freemium"],
  }),
  pricePointCents: integer("price_point_cents"),
  landingPageUrl: text("landing_page_url"),
  emailSignups: integer("email_signups").notNull().default(0),
  decision: text("decision", { enum: ["build", "skip", "park"] }),
  decisionNotes: text("decision_notes"),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Feature ───────────────────────────────────────────────────────────────────

export const features = sqliteTable("features", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  buildSpec: text("build_spec"),                          // markdown
  techStack: text("tech_stack"),
  removedInVersionId: integer("removed_in_version_id").references(() => projectVersions.id, { onDelete: "set null" }),
  status: text("status", {
    enum: ["idea", "specced", "building", "built", "launched"],
  })
    .notNull()
    .default("idea"),
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  buildSessionRef: text("build_session_ref"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── DistributionItem (content calendar) ──────────────────────────────────────

export const distributionItems = sqliteTable("distribution_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  title: text("title"),
  content: text("content").notNull().default(""),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  postUrl: text("post_url"),
  status: text("status", {
    enum: ["draft", "scheduled", "published"],
  })
    .notNull()
    .default("draft"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── DistributionPost (legacy log - kept for DB compat) ────────────────────────

export const distributionPosts = sqliteTable("distribution_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),
  content: text("content").notNull(),
  postUrl: text("post_url"),
  notes: text("notes"),
  postedAt: integer("posted_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── LaunchPlan ────────────────────────────────────────────────────────────────

export const launchPlans = sqliteTable("launch_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  featureId: integer("feature_id")
    .references(() => features.id, { onDelete: "set null" }),
  channelId: integer("channel_id")
    .references(() => channels.id, { onDelete: "set null" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  positioning: text("positioning"),
  content: text("content"),
  status: text("status", { enum: ["draft", "scheduled", "launched"] })
    .notNull()
    .default("draft"),
  launchedAt: integer("launched_at", { mode: "timestamp" }),
  postUrl: text("post_url"),
  responseNotes: text("response_notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── UserFeedback ──────────────────────────────────────────────────────────────

export const userFeedback = sqliteTable("user_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "set null" }),
  featureId: integer("feature_id")
    .references(() => features.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  rawText: text("raw_text").notNull(),
  url: text("url"),
  sentiment: text("sentiment", { enum: ["positive", "negative", "neutral"] }),
  category: text("category", {
    enum: ["bug", "feature_request", "pricing", "churn", "praise"],
  }),
  reprocessed: integer("reprocessed", { mode: "boolean" }).notNull().default(false),
  collectedAt: integer("collected_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── SEO Discovery ─────────────────────────────────────────────────────────────

export const seoRuns = sqliteTable("seo_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),   // idea (discovery runs)
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }),   // product (distribution runs)
  market: text("market").notNull().default("saas"),
  seedKeyword: text("seed_keyword").notNull(),
  totalKeywords: integer("total_keywords").notNull().default(0),
  totalCost: real("total_cost").notNull().default(0),
  maxVolume: integer("max_volume").notNull().default(1000),
  minCpc: real("min_cpc").notNull().default(1.0),
  // Purpose: "discovery" = feed into opportunities; "distribution" = generate static pages post-build
  purpose: text("purpose", { enum: ["discovery", "distribution"] }).notNull().default("discovery"),
  // Links this run to the opportunity it was run for (discovery)
  opportunityId: integer("opportunity_id")
    .references(() => opportunities.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const seoPages = sqliteTable("seo_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  seoRunId: integer("seo_run_id")
    .references(() => seoRuns.id, { onDelete: "set null" }),
  keywordId: integer("keyword_id"),  // FK to keyword_opportunities
  targetKeyword: text("target_keyword").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  metaDescription: text("meta_description"),
  content: text("content"),  // MDX
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const keywordOpportunities = sqliteTable("keyword_opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id")
    .notNull()
    .references(() => seoRuns.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  searchVolume: integer("search_volume").notNull().default(0),
  cpc: real("cpc").notNull().default(0),
  competition: real("competition").notNull().default(0),
  competitionLevel: text("competition_level"),
  opportunityScore: real("opportunity_score").notNull().default(0),
  isAiPrompt: integer("is_ai_prompt", { mode: "boolean" }).notNull().default(false),
  impressionsPerDay: real("impressions_per_day"),
  searchIntent: text("search_intent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type { OpportunityInsights, ValidationChecklist };

export type FounderProfile = typeof founderProfile.$inferSelect;
export type NewFounderProfile = typeof founderProfile.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ICP = typeof icps.$inferSelect;
export type NewICP = typeof icps.$inferInsert;

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;

export type DiscoveryRun = typeof discoveryRuns.$inferSelect;
export type NewDiscoveryRun = typeof discoveryRuns.$inferInsert;

export type Signal = typeof signals.$inferSelect;
export type NewSignal = typeof signals.$inferInsert;

export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;

export type OpportunitySignal = typeof opportunitySignals.$inferSelect;
export type OpportunityCompetitor = typeof opportunityCompetitors.$inferSelect;

export type Validation = typeof validations.$inferSelect;
export type NewValidation = typeof validations.$inferInsert;

export type Feature = typeof features.$inferSelect;
export type NewFeature = typeof features.$inferInsert;

export type LaunchPlan = typeof launchPlans.$inferSelect;
export type NewLaunchPlan = typeof launchPlans.$inferInsert;

export type DistributionPost = typeof distributionPosts.$inferSelect;
export type NewDistributionPost = typeof distributionPosts.$inferInsert;

export type DistributionItem = typeof distributionItems.$inferSelect;
export type NewDistributionItem = typeof distributionItems.$inferInsert;

export type UserFeedback = typeof userFeedback.$inferSelect;
export type NewUserFeedback = typeof userFeedback.$inferInsert;

// ── AI cost entries ───────────────────────────────────────────────────────────

export const aiCostEntries = sqliteTable("ai_cost_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  model: text("model").notNull(),
  callType: text("call_type").notNull().default("unknown"),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  promptText: text("prompt_text"),
  responseText: text("response_text"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type AiCostEntry = typeof aiCostEntries.$inferSelect;

// ── AI task config (per-task provider/model routing — the "AI proxy") ──────────
// One row per coarse task category. tool = local CLI ("claude -p" / codex) or OpenRouter.

export const aiTaskConfig = sqliteTable("ai_task_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskKey: text("task_key").notNull().unique(),   // build | opportunity | scoring | summaries | channels | distribution | discovery
  tool: text("tool", { enum: ["cli", "openrouter"] }).notNull().default("cli"),
  cliBin: text("cli_bin"),                          // e.g. "claude" | "codex" (null → claude)
  model: text("model"),                             // provider/model id or CLI --model (null → task default)
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type AiTaskConfig = typeof aiTaskConfig.$inferSelect;
export type NewAiTaskConfig = typeof aiTaskConfig.$inferInsert;

// ── Product build chat (conversation with the build agent) ────────────────────

export const productMessages = sqliteTable("product_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type ProductMessage = typeof productMessages.$inferSelect;
export type NewProductMessage = typeof productMessages.$inferInsert;

// ── DistributionPlaybooks (global strategy templates) ─────────────────────────

export const distributionPlaybooks = sqliteTable("distribution_playbooks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),   // e.g. "programmatic-seo"
  name: text("name").notNull(),
  description: text("description").notNull(),
  whyItWorks: text("why_it_works").notNull(),
  timeHorizon: text("time_horizon").notNull(), // "day1" | "week1" | "month1" | "month3" | "month6"
  effort: text("effort").notNull(),            // "one-time" | "ongoing"
  appliesTo: text("applies_to").notNull().default("all"), // "all" | "dev-tools" | "consumer" | "b2b"
  checklistTemplate: text("checklist_template").notNull().default("[]"), // JSON string[]
  sortOrder: integer("sort_order").notNull().default(99),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type DistributionPlaybook = typeof distributionPlaybooks.$inferSelect;

// ── ContentItems (distribution pipeline queue) ────────────────────────────────

export const contentItems = sqliteTable("content_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  playbookId: integer("playbook_id").references(() => distributionPlaybooks.id, { onDelete: "set null" }),
  opportunityId: integer("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
  platform: text("platform").notNull(),        // "reddit" | "twitter" | "newsletter" | "hn" | etc.
  platformMeta: text("platform_meta").notNull().default("{}"), // JSON: { subreddit, threadType, etc. }
  status: text("status").notNull().default("pending_review"), // "pending_review" | "approved" | "scheduled" | "published" | "rejected"
  title: text("title"),
  content: text("content").notNull().default(""),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  postUrl: text("post_url"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type ContentItem = typeof contentItems.$inferSelect;

// ── ProjectPlaybookInstances (per-project execution) ─────────────────────────

export const projectPlaybookInstances = sqliteTable("project_playbook_instances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  playbookId: integer("playbook_id").notNull().references(() => distributionPlaybooks.id, { onDelete: "cascade" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("not_started"), // "not_started" | "in_progress" | "done"
  checklistProgress: text("checklist_progress").notNull().default("[]"), // JSON boolean[]
  notes: text("notes"),
  config: text("config").notNull().default("{}"), // JSON project-specific content
  sortOrder: integer("sort_order").notNull().default(99),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type ProjectPlaybookInstance = typeof projectPlaybookInstances.$inferSelect;

export type SeoRun = typeof seoRuns.$inferSelect;
export type NewSeoRun = typeof seoRuns.$inferInsert;

export type KeywordOpportunity = typeof keywordOpportunities.$inferSelect;
export type NewKeywordOpportunity = typeof keywordOpportunities.$inferInsert;

export type SeoPage = typeof seoPages.$inferSelect;
export type NewSeoPage = typeof seoPages.$inferInsert;

// ── Monitor: MRR Snapshots ────────────────────────────────────────────────────

export const mrrSnapshots = sqliteTable("mrr_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  mrrCents: integer("mrr_cents").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type MrrSnapshot = typeof mrrSnapshots.$inferSelect;
export type NewMrrSnapshot = typeof mrrSnapshots.$inferInsert;

// ── Monitor: CAC Entries per Channel ─────────────────────────────────────────

export const cacEntries = sqliteTable("cac_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // "reddit" | "hn" | "seo" | "content" | "email" | "ph" | "twitter" | "bluesky" | "other"
  spendCents: integer("spend_cents").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  periodStart: integer("period_start", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type CacEntry = typeof cacEntries.$inferSelect;
export type NewCacEntry = typeof cacEntries.$inferInsert;

// ── Monitor: Traffic Snapshots ────────────────────────────────────────────────

export const trafficSnapshots = sqliteTable("traffic_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sourcesJson: text("sources_json", { mode: "json" }).$type<Record<string, number>>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type TrafficSnapshot = typeof trafficSnapshots.$inferSelect;
export type NewTrafficSnapshot = typeof trafficSnapshots.$inferInsert;

// ── Domain Searches ───────────────────────────────────────────────────────────

export type DomainResult = {
  domain: string;
  available: boolean;
  price: string | null;
  isPremium: boolean;
};

export const domainSearches = sqliteTable("domain_searches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  query: text("query").notNull(),
  resultsJson: text("results_json", { mode: "json" }).$type<DomainResult[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type DomainSearch = typeof domainSearches.$inferSelect;
export type NewDomainSearch = typeof domainSearches.$inferInsert;

// ── Pain Clusters ─────────────────────────────────────────────────────────────
// Cross-community patterns: same underlying pain appearing in multiple communities

export interface PainClusterTheme {
  title: string;
  description: string;
  exampleQuotes: string[];
  userPersona: string;
  urgencyReason: string;
  revenueSignals: string[];
}

export const painClusters = sqliteTable("pain_clusters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  theme: text("theme").notNull(),                      // one-line description
  description: text("description").notNull(),
  communities: text("communities", { mode: "json" }).$type<string[]>().notNull().default([]),
  signalIds: text("signal_ids", { mode: "json" }).$type<number[]>().notNull().default([]),
  signalCount: integer("signal_count").notNull().default(0),
  avgAuthenticityScore: real("avg_authenticity_score").notNull().default(0),
  status: text("status", { enum: ["open", "building", "built", "killed"] }).notNull().default("open"),
  themeJson: text("theme_json", { mode: "json" }).$type<PainClusterTheme>(),
  firstSeenAt: integer("first_seen_at", { mode: "timestamp" }),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type PainCluster = typeof painClusters.$inferSelect;

// ── Channel Profiles ──────────────────────────────────────────────────────────
// AI-generated understanding of a community from deep scan

export interface ChannelProfileData {
  communityCharacter: string;
  whoPostsHere: string;
  opennessScore: number;          // 1-10: how welcoming to new product pitches
  painDensityScore: number;       // 1-10: how often genuine pain is expressed
  purchaseIntentScore: number;    // 1-10: how often purchase intent signals appear
  topPainThemes: { theme: string; frequency: number; avgAuthenticity: number }[];
  whatGetsTraction: string;       // post formats, title patterns, tones that work
  whatFails: string;              // what gets ignored or downvoted
  distributionPlaybook: string;   // specific, actionable posting strategy
  bestPostingTimes: string;
  postLengthGuidance: string;
  avoidList: string[];            // specific things that don't work here
  generatedAt: string;
}

export const channelProfiles = sqliteTable("channel_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  subreddit: text("subreddit"),                        // for reddit channels
  profileJson: text("profile_json", { mode: "json" }).$type<ChannelProfileData>().notNull(),
  postsAnalyzed: integer("posts_analyzed").notNull().default(0),
  lookbackDays: integer("lookback_days").notNull().default(365),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type ChannelProfile = typeof channelProfiles.$inferSelect;

// ── Ideas ─────────────────────────────────────────────────────────────────────
// Pre-project hypotheses driven by pain cluster analysis

export interface IdeaAnalysisData {
  verdict: "go" | "maybe" | "kill";
  verdictReason: string;
  confidence: number;              // 1-10
  topOpportunity: string;
  userPersona: string;
  distributionStrategy: string;
  messagingThatWorks: string;
  messagingToAvoid: string;
  estimatedMrrRange: string;
  buildComplexity: "low" | "medium" | "high";
  timeToFirstRevenue: string;
  communityInsights: {
    subreddit: string;
    urgencyScore: number;
    painScore: number;
    purchaseIntentScore: number;
    topInsights: string[];
  }[];
}

export const ideas = sqliteTable("ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  hypothesis: text("hypothesis"),
  directionType: text("direction_type"),
  status: text("status", {
    enum: ["setup", "communities", "analyzing", "ready", "killed", "promoted"],
  }).notNull().default("setup"),
  selectedCommunities: text("selected_communities", { mode: "json" }).$type<string[]>(),
  painClusterId: integer("pain_cluster_id").references(() => painClusters.id, { onDelete: "set null" }),
  lookbackDays: integer("lookback_days").notNull().default(90),
  analysisJson: text("analysis_json", { mode: "json" }).$type<IdeaAnalysisData>(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type Idea = typeof ideas.$inferSelect;
export type NewIdea = typeof ideas.$inferInsert;

// ── Discovery Profile ─────────────────────────────────────────────────────────

export const discoveryProfiles = sqliteTable("discovery_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  prompt: text("prompt").notNull(),
  extractedKeywords: text("extracted_keywords", { mode: "json" }).$type<string[]>(),
  minSubscribers: integer("min_subscribers").notNull().default(1000),
  maxSubscribers: integer("max_subscribers").notNull().default(30000),
  minEngagementRatio: real("min_engagement_ratio").notNull().default(0.005),
  lookbackDays: integer("lookback_days").notNull().default(60),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type DiscoveryProfile = typeof discoveryProfiles.$inferSelect;

// ── Discovered Communities ────────────────────────────────────────────────────

export interface CFFData {
  score: number;       // 1-10
  reason: string;      // one-line summary
  dimensions: {
    relevance: number;       // do their pains match your domain knowledge?
    credibility: number;     // can you post without being an outsider?
    buildability: number;    // can you realistically build what they need?
    distributionFit: number; // does how they engage match how you operate?
  };
}

export interface DiscoveredCommunityProfile {
  communityCharacter: string;
  whoPostsHere: string;
  opennessScore: number;         // 1-10: welcoming to new product pitches
  painDensityScore: number;      // 1-10: genuine pain expressed
  purchaseIntentScore: number;   // 1-10: purchase intent signals
  topPainThemes: { theme: string; frequency: number }[];
  whatGetsTraction: string;
  whatFails: string;
  distributionPlaybook: string;
  avoidList: string[];
  tractionPosts: { title: string; score: number; comments: number; url: string; why: string }[];
  buyerRatio: number;  // 0-1, fraction of posts with genuine buyer intent
  generatedAt: string;
}

export const discoveredCommunities = sqliteTable("discovered_communities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  subreddit: text("subreddit").notNull().unique(),
  subscriberCount: integer("subscriber_count"),
  activeUserCount: integer("active_user_count"),
  engagementRatio: real("engagement_ratio"),
  description: text("description"),
  discoveryAngle: text("discovery_angle"),  // direct | symptom | profession | adjacent | contrast | tool
  discoveryReason: text("discovery_reason"), // one-line why the LLM suggested this
  tracked: integer("tracked", { mode: "boolean" }).notNull().default(false),
  profileJson: text("profile_json", { mode: "json" }).$type<DiscoveredCommunityProfile>(),
  cffJson: text("cff_json", { mode: "json" }).$type<CFFData>(),
  postsAnalyzed: integer("posts_analyzed").notNull().default(0),
  scanStatus: text("scan_status", { enum: ["idle", "running", "done", "failed"] }).notNull().default("idle"),
  lastScannedAt: integer("last_scanned_at", { mode: "timestamp" }),
  lastPostCursor: text("last_post_cursor"),
  discoveryProfileId: integer("discovery_profile_id").references(() => discoveryProfiles.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type DiscoveredCommunity = typeof discoveredCommunities.$inferSelect;

// ── Search Sessions ───────────────────────────────────────────────────────────

export const searchSessions = sqliteTable("search_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keywords: text("keywords", { mode: "json" }).$type<string[]>().notNull(),
  mode: text("mode", { enum: ["manual", "ai"] }).notNull(),
  resultCount: integer("result_count").notNull().default(0),
  resultsJson: text("results_json"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

// ── Market Scan Runs ──────────────────────────────────────────────────────────

export const marketScanRuns = sqliteTable("market_scan_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  verticalSlug: text("vertical_slug").notNull(),
  verticalName: text("vertical_name").notNull(),
  status: text("status").notNull().default("pending"),
  expansionJson: text("expansion_json"),
  communitiesJson: text("communities_json"),
  signalCount: integer("signal_count").notNull().default(0),
  error: text("error"),
  startedAt: integer("started_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});
export type MarketScanRunRow = typeof marketScanRuns.$inferSelect;

// ── Problem Shapes ─────────────────────────────────────────────────────────────

export const problemShapes = sqliteTable("problem_shapes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shape: text("shape").notNull(),
  description: text("description").notNull(),
  verticals: text("verticals").notNull().default("[]"),
  signalIds: text("signal_ids").notNull().default("[]"),
  signalCount: integer("signal_count").notNull().default(0),
  severity: integer("severity"),
  mrrCeiling: text("mrr_ceiling"),
  mrrScore: real("mrr_score"),
  wedgeRecommendation: text("wedge_recommendation"),
  status: text("status").notNull().default("active"),
  lastDetectedAt: integer("last_detected_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
export type ProblemShapeRow = typeof problemShapes.$inferSelect;

// ── Pain Search Sessions ──────────────────────────────────────────────────────

export interface PainSignalPost {
  id: string;           // Reddit post fullname e.g. "t3_abc123"
  title: string;
  body: string;         // selftext snippet (first 300 chars)
  subreddit: string;
  score: number;
  numComments: number;
  permalink: string;
  createdUtc: number;
  upvoteRatio: number;
  searchQuery: string;  // which query surfaced this
  painScore: number;    // 1-10 heuristic: score * log(comments+1) normalized
}

export interface CommunityDistribution {
  subreddit: string;
  subscribers: number;
  submissionType: string;   // "any" | "link" | "self"
  over18: boolean;
  subredditType: string;
  distributionScore: number; // 1-10 computed from metadata
  distributionLabel: string; // "Open" | "Restricted" | "Links only" | "Too large" | "Too small"
  signalCount: number;        // how many pain posts came from here
}

export const painSearchSessions = sqliteTable("pain_search_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  domain: text("domain").notNull(),
  keywords: text("keywords", { mode: "json" }).$type<string[]>(),
  searchQueries: text("search_queries", { mode: "json" }).$type<string[]>(),
  signalsJson: text("signals_json"),   // JSON string of PainSignalPost[]
  communitiesJson: text("communities_json"), // JSON string of CommunityDistribution[]
  signalCount: integer("signal_count").notNull().default(0),
  communityCount: integer("community_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type PainSearchSession = typeof painSearchSessions.$inferSelect;

export type SearchSession = typeof searchSessions.$inferSelect;

// ── Pipeline Ideas ────────────────────────────────────────────────────────────
// Manual idea capture → scoring → validation → execution workflow

export const pipelineIdeas = sqliteTable("pipeline_ideas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  summary: text("summary"),
  sourceLinks: text("source_links", { mode: "json" }).$type<string[]>(),
  domain: text("domain"),
  targetUser: text("target_user"),
  painDescription: text("pain_description"),

  painScore: integer("pain_score").notNull().default(0),
  frequencyScore: integer("frequency_score").notNull().default(0),
  monetizationScore: integer("monetization_score").notNull().default(0),
  reachabilityScore: integer("reachability_score").notNull().default(0),
  buildEffortScore: integer("build_effort_score").notNull().default(0),
  totalScore: integer("total_score").notNull().default(0),

  status: text("status", {
    enum: ["CAPTURED", "SCORED", "SELECTED", "VALIDATING", "LANDING", "TOOL", "MVP", "KILLED", "ACTIVE"],
  }).notNull().default("CAPTURED"),

  notes: text("notes"),
  nextAction: text("next_action"),

  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type PipelineIdea = typeof pipelineIdeas.$inferSelect;
export type NewPipelineIdea = typeof pipelineIdeas.$inferInsert;

// ── Experiments ───────────────────────────────────────────────────────────────

export const experiments = sqliteTable("experiments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ideaId: integer("idea_id").notNull().references(() => pipelineIdeas.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["X_POST", "REPLY", "DM", "REDDIT", "LANDING", "TOOL"],
  }).notNull(),
  count: integer("count").notNull().default(0),
  resultMetrics: text("result_metrics", { mode: "json" }).$type<Record<string, unknown>>(),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
