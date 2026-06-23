import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";

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
