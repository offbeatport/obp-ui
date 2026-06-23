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
      port: 3005,
      headers: {
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com",
      },
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
        server: {
          experimental: {
            asyncContext: true,
          },
        },
      }),
      viteReact(),
    ],
  };
});
