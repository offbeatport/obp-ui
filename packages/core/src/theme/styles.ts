/**
 * Canonical Style + Radius preset lists. Single source of truth - the
 * playground imports them, the build-microsaas skill reads from them when
 * scaffolding new apps. Edit here, both update.
 *
 * Hex values are the user-facing readable form. Apps that consume them
 * should convert to RGB triplets at apply time (see `hexToTriplet` in
 * the playground for the canonical helper).
 *
 * Style ordering is by **conversion likelihood** for a generic micro-SaaS
 * buy flow. Top of list = safe defaults; bottom = niche. Don't reorder
 * without thinking through the UX implications (the picker shows them in
 * this order; first chips get clicked most).
 */

export type StyleVariant = {
  primary: string;
  primaryFg: string;
  bg: string;
};

export type Style = {
  name: string;
  light: StyleVariant;
  dark: StyleVariant;
};

export const STYLE_PRESETS: ReadonlyArray<Style> = [
  {
    name: "Cobalt",
    light: { primary: "#3B5BDB", primaryFg: "#FFFFFF", bg: "#FAFAF7" },
    dark: { primary: "#6B86FF", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Emerald",
    light: { primary: "#047857", primaryFg: "#FFFFFF", bg: "#FAFAF7" },
    dark: { primary: "#34D399", primaryFg: "#0E0E0F", bg: "#0B1020" },
  },
  {
    name: "Tangerine",
    light: { primary: "#FF6B00", primaryFg: "#0E0E0F", bg: "#FFFBF5" },
    dark: { primary: "#FF9447", primaryFg: "#0E0E0F", bg: "#15110D" },
  },
  {
    name: "Azure",
    light: { primary: "#0369A1", primaryFg: "#FFFFFF", bg: "#EEF2FB" },
    dark: { primary: "#38BDF8", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Royal",
    light: { primary: "#4338CA", primaryFg: "#FFFFFF", bg: "#F5F1E8" },
    dark: { primary: "#818CF8", primaryFg: "#0E0E0F", bg: "#0B1020" },
  },
  {
    name: "Editorial",
    light: { primary: "#3B4A6B", primaryFg: "#FFFFFF", bg: "#F5F2EC" },
    dark: { primary: "#7C8DAE", primaryFg: "#0E0E0F", bg: "#0A0E14" },
  },
  {
    name: "Mono",
    light: { primary: "#475569", primaryFg: "#FFFFFF", bg: "#FAFAF7" },
    dark: { primary: "#94A3B8", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Pine",
    light: { primary: "#166534", primaryFg: "#FFFFFF", bg: "#EEF6EC" },
    dark: { primary: "#4ADE80", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Teal",
    light: { primary: "#0D9488", primaryFg: "#FFFFFF", bg: "#FAFAF7" },
    dark: { primary: "#2DD4BF", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Iris",
    light: { primary: "#6750A4", primaryFg: "#FFFFFF", bg: "#F2EBFA" },
    dark: { primary: "#9C8AE8", primaryFg: "#0E0E0F", bg: "#0E0E0F" },
  },
  {
    name: "Plum",
    light: { primary: "#7C2D8C", primaryFg: "#FFFFFF", bg: "#FAFAF7" },
    dark: { primary: "#BC6BC9", primaryFg: "#0E0E0F", bg: "#0B1020" },
  },
  {
    name: "Scarlet",
    light: { primary: "#FF0000", primaryFg: "#FFFFFF", bg: "#FFFFFF" },
    dark: { primary: "#FF0000", primaryFg: "#FFFFFF", bg: "#0F0F0F" },
  },
  {
    name: "Dusk",
    light: { primary: "#6E2470", primaryFg: "#FFFFFF", bg: "#EFE9D9" },
    dark: { primary: "#B077B3", primaryFg: "#0E0E0F", bg: "#1A0D1B" },
  },
  {
    name: "Moss",
    light: { primary: "#55624C", primaryFg: "#FFFFFF", bg: "#F2F0EB" },
    dark: { primary: "#9CAF88", primaryFg: "#0E0E0F", bg: "#0F1410" },
  },
];

export type RadiusPreset = { name: string; sm: number; md: number };

export const RADIUS_PRESETS: ReadonlyArray<RadiusPreset> = [
  { name: "Sharp", sm: 0, md: 0 },
  { name: "Subtle", sm: 4, md: 8 },
  { name: "Round", sm: 8, md: 12 },
  { name: "Plump", sm: 12, md: 16 },
  // Pill caps card radius at 24px - 999px on a wide card just looks
  // chunky-rectangular, not pill. Buttons + inputs still go full-pill.
  { name: "Pill", sm: 999, md: 24 },
];

/* Convert "#3B5BDB" → "59 91 219" so a hex preset can be written into a
 * CSS var that the Tailwind preset reads as `rgb(var(--X) / <alpha-value>)`. */
export function hexToTriplet(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}
