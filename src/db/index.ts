import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { resolve } from "path";
import * as schema from "./schema.js";

const dbPath = process.env.DATABASE_URL || resolve(process.cwd(), "cslopslop.db");
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export * from "./schema.js";
