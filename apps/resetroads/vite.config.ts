import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const monorepoRoot = resolve(__dirname, "../..");
  const shared = loadEnv(mode, monorepoRoot, "");
  const local = loadEnv(mode, __dirname, "");
  Object.assign(process.env, shared, local);

  return {
    server: {
      port: 3003,
    },
    resolve: {
      tsconfigPaths: true,
    },
    ssr: {
      external: ["better-sqlite3", "pdf-parse", "mammoth"],
    },
    environments: {
      client: {
        build: {
          rollupOptions: {
            external: (id: string) =>
              /^node:/.test(id) ||
              id === "better-sqlite3" ||
              id === "pdf-parse" ||
              id === "mammoth" ||
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
