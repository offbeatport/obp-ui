import { idCol, timestamps } from "@offbeatport/db/columns";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const categories = sqliteTable("categories", {
  id: idCol(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ...timestamps,
});

export const queries = sqliteTable("queries", {
  id: idCol(),
  categoryId: text("category_id")
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),
  text: text("text").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const runs = sqliteTable("runs", {
  id: idCol(),
  status: text("status", {
    enum: ["pending", "running", "done", "error", "cancelled"],
  })
    .notNull()
    .default("pending"),
  model: text("model").notNull(),
  totalQueries: integer("total_queries").notNull().default(0),
  completedQueries: integer("completed_queries").notNull().default(0),
  ...timestamps,
});

export const queryResults = sqliteTable("query_results", {
  id: idCol(),
  runId: text("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  queryId: text("query_id")
    .references(() => queries.id)
    .notNull(),
  queryText: text("query_text").notNull(),
  response: text("response"),
  extractedDomains: text("extracted_domains", { mode: "json" }).$type<
    string[]
  >(),
  status: text("status", { enum: ["pending", "done", "error"] })
    .notNull()
    .default("pending"),
  error: text("error"),
  ...timestamps,
});

export const rankings = sqliteTable("rankings", {
  id: idCol(),
  domain: text("domain").notNull(),
  categoryId: text("category_id")
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),
  mentionCount: integer("mention_count").notNull().default(0),
  lastSeen: text("last_seen"),
  ...timestamps,
});

// Per-run snapshot for trend tracking
export const domainSnapshots = sqliteTable("domain_snapshots", {
  id: idCol(),
  runId: text("run_id")
    .references(() => runs.id, { onDelete: "cascade" })
    .notNull(),
  domain: text("domain").notNull(),
  categoryId: text("category_id")
    .references(() => categories.id, { onDelete: "cascade" })
    .notNull(),
  mentionCount: integer("mention_count").notNull().default(0),
  ...timestamps,
});

// App-level key/value settings
export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Email alert subscriptions
export const emailAlerts = sqliteTable("email_alerts", {
  id: idCol(),
  email: text("email").notNull(),
  domain: text("domain"), // null = any new store alert
  ...timestamps,
});

export const domainNames = sqliteTable("domain_names", {
  domain: text("domain").primaryKey(),
  brandName: text("brand_name").notNull(),
});

export const brandMonitors = sqliteTable("brand_monitors", {
  id: idCol(),
  email: text("email").notNull(),
  domain: text("domain").notNull(),
  tier: text("tier", { enum: ["free", "paid"] }).notNull().default("free"),
  polarSubscriptionId: text("polar_subscription_id"),
  status: text("status", { enum: ["active", "cancelled", "pending"] }).notNull().default("active"),
  ...timestamps,
});
