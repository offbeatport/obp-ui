import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  server: { port: 3000 },
  // better-sqlite3 is a native CJS addon (.node binding). Keep it out of the Vite
  // SSR transform / dep-optimizer so server fns + the SSE route can `import { db }`
  // without Vite trying to bundle the native binding.
  ssr: { external: ["better-sqlite3"] },
  optimizeDeps: { exclude: ["better-sqlite3"] },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});
