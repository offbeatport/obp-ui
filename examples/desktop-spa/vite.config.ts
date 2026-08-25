import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A Tauri frontend is a plain Vite SPA: no SSR, no TanStack Start, no server functions.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ["react", "react-dom"] },
    build: { target: "safari16" },
});
