import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL || resolve(process.cwd(), "burningdemand.db"),
  },
});
