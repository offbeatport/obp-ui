import preset from "@offbeatport/core/theme/preset";
import type { Config } from "tailwindcss";

export default {
  presets: [preset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@offbeatport/microsaas-core/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
