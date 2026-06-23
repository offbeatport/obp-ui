import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

// app.config.ts is the TanStack Start config file.
// It wraps Vite and provides TanStack Router integration.
// For advanced Vite config (custom plugins, middleware), extend `vite` below.

export default defineConfig({
  tsr: {
    appDirectory: "src",
    autoCodeSplitting: true,
  },
  vite: {
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
    // PostCSS handles Tailwind v3 - configured in postcss.config.js
    // No need for @tailwindcss/vite here since we're using Tailwind v3
    define: {
      // Expose server-only env vars by name (never secrets)
      // Client env vars must use VITE_ prefix
    },
  },
});
