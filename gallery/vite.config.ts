import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The kitchen sink. `pnpm ui` runs `vite gallery`, so this file is both the gallery's
// config and its root - every path below resolves against packages/ui/gallery.
//
// The sections import the kit BY NAME ("@paperkit/ui", "@paperkit/ui/canvas") rather than
// by relative path: the package self-references through its own `exports` map, so what the
// gallery writes is exactly what a consumer writes. dedupe keeps one React in the graph
// (two copies is the classic "invalid hook call" the moment a Radix primitive mounts).
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ["react", "react-dom"] },
    server: { port: 5180, strictPort: true },
});
