import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Tailwind preset - apps extend this in their tailwind.config.ts.
 *
 * Usage:
 *   import preset from "@offbeatport/microsaas-core/theme/preset";
 *   export default {
 *     presets: [preset],
 *     content: ["./src/**\/*.{ts,tsx}"], // app-local content
 *   } satisfies Config;
 *
 * Theming model: colors are stored as space-separated RGB triplets in CSS
 * vars (`--bg: 250 250 247`) and exposed here as `rgb(var(--X) / <alpha-value>)`,
 * which lets every Tailwind color utility apply opacity natively
 * (`bg-success/30`, `text-fg-muted/60`, `border-primary/40`, etc.).
 * Light/dark swap is automatic via `prefers-color-scheme` and `[data-theme]`.
 *
 * The `tailwindcss-animate` plugin is included so apps and core components
 * can use the standard shadcn animation utilities (`animate-in`, `fade-in-0`,
 * `slide-in-from-top-2`, etc.) without re-declaring keyframes.
 */
const rgb = (cssVar: string) => `rgb(var(${cssVar}) / <alpha-value>)`;

const preset: Partial<Config> = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./node_modules/@offbeatport/microsaas-core/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        primary: rgb("--primary"),
        "primary-fg": rgb("--primary-fg"),
        bg: rgb("--bg"),
        fg: rgb("--fg"),
        "fg-muted": rgb("--fg-muted"),
        "fg-subtle": rgb("--fg-subtle"),
        border: rgb("--border"),
        "border-strong": rgb("--border-strong"),
        hover: rgb("--hover"),
        field: rgb("--field"),
        success: rgb("--success"),
        warning: rgb("--warning"),
        danger: rgb("--danger"),
      },
      borderRadius: {
        DEFAULT: "var(--r-sm)",
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        full: "var(--r-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [animate],
};

export default preset;
