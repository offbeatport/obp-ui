import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate every test file onto its own throwaway SQLite file BEFORE any module (db/index.ts)
// opens a connection. With pool:forks this runs once per file in its own process.
process.env.DATABASE_URL = join(tmpdir(), `csstest-${process.pid}-${randomUUID()}.db`);
