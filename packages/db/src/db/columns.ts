import { integer, text } from "drizzle-orm/sqlite-core";

export const idCol = () => text("id").primaryKey();

export const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
};

export const softDelete = {
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
};
