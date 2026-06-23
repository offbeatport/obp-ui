import { resolve } from "node:path";
import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import { AUTH_TABLES_SQL, authSchema } from "./schema/auth";

export interface CreateDbOptions<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Path to the SQLite file. Defaults to `process.env.DATABASE_URL` or `./app.db`. */
  url?: string;
  /** App-level schema to merge with auth schema. */
  schema?: TSchema;
  /** Run inline auth-table migrations on startup. Default: true. */
  autoMigrate?: boolean;
  /** Extra SQL to run after auth tables (e.g. app-specific CREATE TABLE IF NOT EXISTS). */
  extraMigrations?: string;
}

export interface CoreDb<TSchema extends Record<string, unknown> = Record<string, unknown>> {
  db: BetterSQLite3Database<TSchema & typeof authSchema>;
  sqlite: Database.Database;
  runMigrations: () => void;
}

export function createDb<TSchema extends Record<string, unknown>>(
  opts: CreateDbOptions<TSchema> = {},
): CoreDb<TSchema> {
  const url = opts.url ?? process.env.DATABASE_URL ?? resolve(process.cwd(), "app.db");
  const sqlite = new Database(url);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const mergedSchema = { ...authSchema, ...(opts.schema ?? {}) } as TSchema & typeof authSchema;
  const db = drizzle(sqlite, { schema: mergedSchema });

  function runMigrations() {
    sqlite.exec(AUTH_TABLES_SQL);
    if (opts.extraMigrations) {
      sqlite.exec(opts.extraMigrations);
    }
  }

  if (opts.autoMigrate !== false) {
    runMigrations();
  }

  return { db, sqlite, runMigrations };
}

export { authSchema };
export type { User, Session, Account, Verification } from "./schema/auth";
