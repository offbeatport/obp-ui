import { createDb } from "@offbeatport/db";
import * as appSchema from "./schema";

const APP_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY NOT NULL,
  owner_token TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  decision_detail TEXT,
  cv_filename TEXT,
  cv_text TEXT NOT NULL,
  profile TEXT,
  gap_analysis TEXT,
  gap_jd_title TEXT,
  fast_debate TEXT,
  top_debate TEXT,
  gated_email TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
`;

const { db, sqlite, runMigrations } = createDb({
  schema: appSchema,
  extraMigrations: APP_TABLES_SQL,
});

export { db, sqlite, runMigrations };
