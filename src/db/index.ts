import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

// Two OS processes (web + executor) each open their OWN connection over the same
// WAL file and coordinate only through rows. Everything a connection needs
// (WAL, foreign_keys, busy_timeout) is set here so BOTH processes get it.
//
// busy_timeout MUST be set before the boot DDL and before the first cross-process
// write: better-sqlite3 is synchronous, so a SQLITE_BUSY without a timeout throws
// immediately instead of serializing. We keep it modest - it's a synchronous
// busy-wait, so a long value would freeze the web/SSR event loop under contention.
const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), "cslopslop.db");

// Singleton on globalThis so Vite dev HMR (which re-evaluates this module) can't
// leak file descriptors / duplicate connections in the web process.
const g = globalThis as typeof globalThis & { __cslopslop_sqlite?: Database.Database };

export const sqlite: Database.Database = g.__cslopslop_sqlite ?? openDatabase();
if (!g.__cslopslop_sqlite) g.__cslopslop_sqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export * from "./schema.js";

function openDatabase(): Database.Database {
    const s = new Database(dbPath);
    s.pragma("journal_mode = WAL");
    s.pragma("foreign_keys = ON");
    s.pragma("busy_timeout = 2000");
    createTables(s);
    return s;
}

// Boot-time CREATE TABLE - greenfield, no migrations yet (SPEC). Idempotent, so it
// running in both processes is fine.
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

    -- config: non-secret key-value (agent/guardrail/account/onboarding settings)
    CREATE TABLE IF NOT EXISTS app_config (
      scope       text NOT NULL DEFAULT 'global',
      key         text NOT NULL,
      value       text NOT NULL,
      updated_at  integer NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (scope, key)
    );

    -- secret: server-only key store (client only ever sees last4)
    CREATE TABLE IF NOT EXISTS secret (
      scope       text NOT NULL DEFAULT 'global',
      key         text NOT NULL,
      value       text NOT NULL,
      last4       text,
      updated_at  integer NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY (scope, key)
    );

    CREATE INDEX IF NOT EXISTS action_company_status ON action(company_id, status);
    CREATE INDEX IF NOT EXISTS action_status_priority ON action(status, priority);
    CREATE INDEX IF NOT EXISTS run_action            ON run(action_id);
    CREATE INDEX IF NOT EXISTS run_company_status     ON run(company_id, status);
    CREATE INDEX IF NOT EXISTS run_status             ON run(status);
    CREATE INDEX IF NOT EXISTS message_company        ON message(company_id);
  `);
}
