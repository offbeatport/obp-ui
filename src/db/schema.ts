// C Slop Slop — data model.
// Clean slate. The model (opportunities · companies · features · runs · messages)
// gets built here next, per SPEC.
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Placeholder so the drizzle client + migrations have something to bind to.
// Replace with the real entities when we build the model.
export const _meta = sqliteTable("_meta", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value"),
});
