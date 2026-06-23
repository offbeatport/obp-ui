import preset from "@offbeatport/core/theme/preset";
import type { Config } from "tailwindcss";

export default {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    // core's UI components - preset already includes this path,
    // but listing here too makes it visible in this file.
    "./node_modules/@offbeatport/microsaas-core/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // app-specific brand overrides go here. Or override CSS vars in
      // src/styles/app.css after the @import - e.g. `--primary: #E0653A`.
    },
  },
  plugins: [],
} satisfies Config;
