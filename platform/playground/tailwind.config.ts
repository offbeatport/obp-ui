import preset from "@offbeatport/core/theme/preset";
import type { Config } from "tailwindcss";

export default {
  presets: [preset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    // Scan core's components directly via the workspace path. The preset's
    // `./node_modules/@offbeatport/microsaas-core/...` entry also covers
    // this, but listing the source path makes Tailwind react instantly to
    // edits in core without waiting for the symlinked node_modules entry.
    "../../packages/core/src/**/*.{ts,tsx}",
  ],
} satisfies Config;
