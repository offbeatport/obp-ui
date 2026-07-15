import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

dotenv.config();

export default defineConfig({
    server: {
        port: 3000,
        // Don't reload the app when non-source files change: the design prototypes + docs, and -
        // importantly - the paths the executor writes to on every build (per-company git repos, run
        // logs, and the SQLite WAL). Without this, one build/prototype edit triggers a reload storm.
        watch: {
            ignored: [
                "**/design/**",
                "**/docs/**",
                "**/companies/**",
                "**/.runs/**",
                "**/*.db",
                "**/*.db-*",
            ],
        },
    },
    // better-sqlite3 is a native CJS addon (.node binding). Keep it out of the Vite
    // SSR transform / dep-optimizer so server fns + the SSE route can `import { db }`
    // without Vite trying to bundle the native binding.
    ssr: { external: ["better-sqlite3"] },
    optimizeDeps: { exclude: ["better-sqlite3"] },
    plugins: [tsconfigPaths(), tailwindcss(), tanstackStart(), viteReact()],
});
