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
      port: 3000,
    },
    resolve: {
      tsconfigPaths: true,
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
