import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Per-owner, per-day usage counter. Used by `checkRateLimit` for
 * tier-based daily quotas (anon / free / paid).
 *
 * Owner key shape: `u:<userId>` for logged-in users, `a:<anonId>` for
 * anon-cookie holders, `ip:<ip>` as last-resort fallback. See
 * `resolveOwnerKey`.
 */
export const usageDay = sqliteTable(
  "usage_day",
  {
    id: text("id").primaryKey(),
    ownerKey: text("owner_key").notNull(),
    day: text("day").notNull(), // YYYY-MM-DD UTC
    count: integer("count").notNull().default(0),
  },
  (t) => ({
    ownerDayIdx: uniqueIndex("usage_day_owner_day_idx").on(t.ownerKey, t.day),
  }),
);

export const USAGE_DAY_SQL = /* sql */ `
  CREATE TABLE IF NOT EXISTS "usage_day" (
    "id"        TEXT PRIMARY KEY NOT NULL,
    "owner_key" TEXT NOT NULL,
    "day"       TEXT NOT NULL,
    "count"     INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "usage_day_owner_day_idx"
    ON "usage_day" ("owner_key", "day");
`;

export const usageSchema = { usageDay };
