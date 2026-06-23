import { createDb } from "@offbeatport/db";
import * as appSchema from "./schema";

const { db, sqlite, runMigrations } = createDb({
  schema: appSchema,
  extraMigrations: `
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES user(id) ON DELETE CASCADE,
      anon_id TEXT,
      input_file_names TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      prev_row_count INTEGER,
      platforms_detected TEXT NOT NULL DEFAULT '[]',
      column_fingerprints TEXT NOT NULL DEFAULT '{}',
      schema_changes TEXT NOT NULL DEFAULT '[]',
      output_rows TEXT NOT NULL DEFAULT '[]',
      warnings TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_day (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_mappings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      overrides TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, platform)
    );
  `,
});

export { db, sqlite, runMigrations };
