import { createDb } from "@offbeatport/db";
import * as appSchema from "./schema";

const APP_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS queries (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  model TEXT NOT NULL,
  total_queries INTEGER NOT NULL DEFAULT 0,
  completed_queries INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS query_results (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL REFERENCES queries(id),
  query_text TEXT NOT NULL,
  response TEXT,
  extracted_domains TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY NOT NULL,
  domain TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  mention_count INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS domain_snapshots (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  mention_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS email_alerts (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  domain TEXT,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brand_monitors (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',
  polar_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER,
  updated_at INTEGER,
  UNIQUE(email, domain)
);

CREATE TABLE IF NOT EXISTS domain_names (
  domain TEXT PRIMARY KEY NOT NULL,
  brand_name TEXT NOT NULL
);
`;

const { db, sqlite, runMigrations } = createDb({
  schema: appSchema,
  extraMigrations: APP_TABLES_SQL,
});

export { db, sqlite, runMigrations };
