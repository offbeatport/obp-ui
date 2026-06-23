import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";

/**
 * Layered env loading:
 *   1. monorepo `.env.shared` - provider keys (Resend, OpenRouter, Polar token)
 *   2. app-local `.env`       - per-app secrets (auth, DB, Sentry, PostHog)
 *
 * Per-app values override shared when keys collide. process.env keeps the
 * unioned result so server-side code (`import.meta.env.PROD` excluded) can
 * read either layer transparently.
 */
export default defineConfig(({ mode }) => {
  const monorepoRoot = resolve(__dirname, "../..");
  const shared = loadEnv(mode, monorepoRoot, "");
  const local = loadEnv(mode, __dirname, "");
  Object.assign(process.env, shared, local);

  return {
    server: {
      port: 3002,
    },
    resolve: {
      tsconfigPaths: true,
    },
    ssr: {
      // Prevent better-sqlite3 (and its bindings dep) from being bundled into
      // the SSR output. bindings.js uses __filename which doesn't exist in ESM,
      // so it must stay as a real node_modules require at runtime.
      external: ["better-sqlite3"],
    },
    environments: {
      client: {
        build: {
          rollupOptions: {
            // Server-only native modules leak into Vite's client environment module
            // graph via TanStack Start's server function analysis. Mark them external
            // so rollup doesn't fail resolving them - they never actually run in the
            // browser (TanStack Start strips the server function bodies from client output).
            external: (id: string) =>
              /^node:/.test(id) ||
              id === "better-sqlite3" ||
              id === "hono" ||
              id.startsWith("hono/") ||
              id === "@hono/node-server" ||
              id.startsWith("@hono/node-server/"),
          },
        },
      },
    },
    plugins: [
      tanstackStart({
        tsr: {
          appDirectory: "src",
          autoCodeSplitting: true,
        },
      }),
      viteReact(),
    ],
  };
});
