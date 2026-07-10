import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), "cslopslop.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Boot-time CREATE TABLE — greenfield, no migrations yet (SPEC). Idempotent.
createTables(sqlite);

export const db = drizzle(sqlite, { schema });
export * from "./schema.js";

function createTables(s: Database.Database) {
  s.exec(`
    CREATE TABLE IF NOT EXISTS opportunity (
      id          text PRIMARY KEY NOT NULL,
      thought     text NOT NULL,
      title       text NOT NULL,
      thesis      text NOT NULL,
      score       real,
      status      text NOT NULL DEFAULT 'candidate',
      created_at  integer NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS company (
      id                text PRIMARY KEY NOT NULL,
      name              text NOT NULL,
      git_remote        text,
      thesis            text NOT NULL,
      status            text NOT NULL DEFAULT 'active',
      domain            text,
      pricing           text,
      channels          text NOT NULL DEFAULT '[]',
      metrics           text,
      autopilot         text NOT NULL DEFAULT 'off',
      budget_cap_usd    real,
      locked_by_run_id  text,
      created_at        integer NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS action (
      id          text PRIMARY KEY NOT NULL,
      company_id  text NOT NULL REFERENCES company(id),
      type        text NOT NULL,
      title       text NOT NULL,
      evidence    text,
      reversible  integer NOT NULL DEFAULT 0,
      status      text NOT NULL DEFAULT 'queued',
      priority    real NOT NULL DEFAULT 0,
      depends_on  text,
      payload     text NOT NULL,
      created_at  integer NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS run (
      id                text PRIMARY KEY NOT NULL,
      action_id         text NOT NULL REFERENCES action(id),
      company_id        text NOT NULL REFERENCES company(id),
      status            text NOT NULL DEFAULT 'queued',
      attempt           integer NOT NULL DEFAULT 0,
      checkpoint        text,
      cost_usd          real NOT NULL DEFAULT 0,
      agent_kind        text,
      lease_expires_at  integer,
      error             text,
      created_at        integer NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS message (
      id          text PRIMARY KEY NOT NULL,
      company_id  text REFERENCES company(id),
      role        text NOT NULL,
      content     text NOT NULL,
      created_at  integer NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE INDEX IF NOT EXISTS action_company_status ON action(company_id, status);
    CREATE INDEX IF NOT EXISTS run_action            ON run(action_id);
    CREATE INDEX IF NOT EXISTS run_company_status     ON run(company_id, status);
    CREATE INDEX IF NOT EXISTS message_company        ON message(company_id);
  `);
}
