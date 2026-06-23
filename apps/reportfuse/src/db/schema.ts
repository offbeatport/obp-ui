import { idCol, timestamps } from "@offbeatport/db/columns";
import { user } from "@offbeatport/db/schema/auth";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { CanonicalColumn, CanonicalRow } from "../features/normalizer";

export const runs = sqliteTable("runs", {
  id: idCol(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  anonId: text("anon_id"),
  inputFileNames: text("input_file_names", { mode: "json" }).$type<string[]>().notNull(),
  rowCount: integer("row_count").notNull().default(0),
  prevRowCount: integer("prev_row_count"),
  platformsDetected: text("platforms_detected", { mode: "json" }).$type<string[]>().notNull().default([]),
  columnFingerprints: text("column_fingerprints", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
  schemaChanges: text("schema_changes", { mode: "json" }).$type<Array<{ platform: string; message: string }>>().notNull().default([]),
  outputRows: text("output_rows", { mode: "json" }).$type<CanonicalRow[]>().notNull().default([]),
  warnings: text("warnings", { mode: "json" }).$type<string[]>().notNull().default([]),
  ...timestamps,
});

export const usageDay = sqliteTable("usage_day", {
  id: idCol(),
  ownerKey: text("owner_key").notNull(),
  date: text("date").notNull(),
  count: integer("count").notNull().default(0),
  ...timestamps,
});

export const platformMappings = sqliteTable("platform_mappings", {
  id: idCol(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform").notNull(),
  overrides: text("overrides", { mode: "json" })
    .$type<Record<string, CanonicalColumn | null>>()
    .notNull()
    .default({}),
  ...timestamps,
});
