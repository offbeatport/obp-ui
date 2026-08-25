// A small deterministic palette set so branding always has sane gradients (AI may override).
//
// NOTE: this is a VERBATIM copy of the table + hash in the cslopslop app's `src/config/spin.ts`.
// It is duplicated on purpose: the app's spin engine imports those helpers from a plain Node
// process (`tsx src/engine/index.ts`), which must never pull React in through this package.
// The palette values and the hash arithmetic must stay byte-identical in both places - an
// existing entity's avatar colour is derived from them, so any drift repaints live companies.
export const PALETTES: [string, string][] = [
    ["#e0794c", "#c05a2f"], // terracotta
    ["#4f8a52", "#356b39"], // green
    ["#5b6ee0", "#3a4bc0"], // indigo
    ["#8b5cf6", "#6d3ecc"], // violet
    ["#c08a2e", "#9a6a1e"], // amber
    ["#2f9c9c", "#1f7c7c"], // teal
];
export function paletteFor(seed: string): [string, string] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return PALETTES[h % PALETTES.length];
}
