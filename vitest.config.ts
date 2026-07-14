import { defineConfig } from "vitest/config";

// Node engine tests. `forks` gives each test file its own process, so the better-sqlite3
// singleton (globalThis in src/db/index.ts) and its per-file DATABASE_URL temp DB stay
// isolated between files.
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        pool: "forks",
        // Runs before each test file's imports → sets a unique temp DATABASE_URL so the
        // better-sqlite3 singleton in src/db/index.ts opens an isolated DB, never the real one.
        setupFiles: ["src/test/setup.ts"],
    },
});
