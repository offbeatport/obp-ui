import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { resolve } from "path";
import * as schema from "./schema.js";

// ── Connection ────────────────────────────────────────────────────────────────

const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), "app.db");
const sqlite = new Database(dbPath);

// WAL mode for concurrent reads - essential for production
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

// ── Drizzle instance ──────────────────────────────────────────────────────────

export const db = drizzle(sqlite, { schema });

// ── Inline migrations for auth tables ────────────────────────────────────────
// These are created on startup so the app works without running drizzle-kit
// for the core auth schema. Product tables should still use drizzle-kit migrations.

export function runMigrations() {
  sqlite.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS "user" (
      "id"             TEXT PRIMARY KEY NOT NULL,
      "name"           TEXT NOT NULL,
      "email"          TEXT NOT NULL UNIQUE,
      "email_verified" INTEGER NOT NULL DEFAULT 0,
      "image"          TEXT,
      "created_at"     INTEGER NOT NULL,
      "updated_at"     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "id"          TEXT PRIMARY KEY NOT NULL,
      "expires_at"  INTEGER NOT NULL,
      "token"       TEXT NOT NULL UNIQUE,
      "created_at"  INTEGER NOT NULL,
      "updated_at"  INTEGER NOT NULL,
      "ip_address"  TEXT,
      "user_agent"  TEXT,
      "user_id"     TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS "account" (
      "id"                        TEXT PRIMARY KEY NOT NULL,
      "account_id"                TEXT NOT NULL,
      "provider_id"               TEXT NOT NULL,
      "user_id"                   TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "access_token"              TEXT,
      "refresh_token"             TEXT,
      "id_token"                  TEXT,
      "access_token_expires_at"   INTEGER,
      "refresh_token_expires_at"  INTEGER,
      "scope"                     TEXT,
      "password"                  TEXT,
      "created_at"                INTEGER NOT NULL,
      "updated_at"                INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "verification" (
      "id"          TEXT PRIMARY KEY NOT NULL,
      "identifier"  TEXT NOT NULL,
      "value"       TEXT NOT NULL,
      "expires_at"  INTEGER NOT NULL,
      "created_at"  INTEGER,
      "updated_at"  INTEGER
    );

    CREATE TABLE IF NOT EXISTS "config" (
      "id"          INTEGER PRIMARY KEY AUTOINCREMENT,
      "key"         TEXT NOT NULL UNIQUE,
      "value"       TEXT NOT NULL,
      "description" TEXT,
      "updated_at"  INTEGER NOT NULL
    );
  `);
}

// Run on module load (server-side only)
runMigrations();
