// Palettes: the whole design system re-skinned by overriding token VALUES, which is exactly
// what DESIGN.md says branding a product means. No component knows this file exists.
//
// HOW THE TEN WERE BUILT, because it matters if you add an eleventh:
//
// Every palette reuses the authored Paper theme's own OKLCH ladder - the same lightness and
// chroma for every step of the surface, ink and line ramps - and changes only the HUE. That is
// why they all feel like the same design system in different clothes, and why the contrast
// relationships carry over for free: measured, each of the ten matches or beats Paper's own
// numbers (faint on card >= 4.55:1 in both modes, white on a primary button >= 3.93 light /
// 3.00 dark, which is what Paper itself scores).
//
// Two hues needed a correction. Green and teal read far lighter than orange at the same OKLCH
// lightness, so Moss and Tide would have put white-on-button below Paper's floor; their brand
// lightness is lowered just far enough to match it, and no further - in dark mode --primary is
// also body text, so it has to stay legible on the page.
//
// Carbon is the deliberate exception: no hue anywhere, and the brand colour IS the ink, so it
// inverts between modes (dark button in light, light button in dark).
//
// APPLYING one writes inline custom properties on <html>, which outrank both :root and .dark.
// They are mode-specific, so the controller re-applies on every theme change. Selecting Paper
// REMOVES them all rather than re-writing them, so the default is always byte-exact whatever
// tokens.css says today.

import { prefStorage } from "./storage";
import { onThemeChange } from "./theme";
import { DEFAULT_NAMESPACE } from "./theme";

export type ThemePaletteColors = {
    /** The page. */
    background: string;
    /** Paper: cards, popovers, panels. */
    card: string;
    /** Rails and subtle fills. */
    secondary: string;
    /** Ink. */
    foreground: string;
    mutedForeground: string;
    /** The faintest text that still passes AA on card. */
    faint: string;
    border: string;
    borderSoft: string;
    primary: string;
    primaryForeground: string;
    /** The soft brand fill - a hover surface, not a text colour. */
    accent: string;
    accentForeground: string;
    /** "r, g, b" for the light-mode elevation shadows. Dark mode always shadows with black. */
    shadowTint?: string;
};

export type ThemePalette = {
    id: string;
    name: string;
    /** One line on what it is for. Shown in the picker. */
    note: string;
    light: ThemePaletteColors;
    dark: ThemePaletteColors;
};

export const DEFAULT_PALETTE_ID = "paper";
export const CUSTOM_PALETTE_ID = "custom";

export const THEME_PALETTES: ThemePalette[] = [
    {
        id: "paper",
        name: "Paper",
        note: "The authored theme: cream, ink and terracotta. Selecting it removes every override rather than restating one.",
        light: {
            background: "#f7f3ec",
            card: "#fffdf8",
            secondary: "#f1ebe0",
            foreground: "#2c2926",
            mutedForeground: "#635c52",
            faint: "#7b7368",
            border: "#e6ddce",
            borderSoft: "#efe8da",
            primary: "#c8643c",
            primaryForeground: "#ffffff",
            accent: "#f4e0d6",
            accentForeground: "#a04a28",
            shadowTint: "60, 50, 38",
        },
        dark: {
            background: "#05060a",
            card: "#10131f",
            secondary: "#080d18",
            foreground: "#e6ebf5",
            mutedForeground: "#969fb0",
            faint: "#7c8499",
            border: "#1c2233",
            borderSoft: "#111726",
            primary: "#e0794c",
            primaryForeground: "#ffffff",
            accent: "rgba(224, 121, 78, 0.18)",
            accentForeground: "#f0a07e",
        },
    },
    {
        id: "graphite",
        name: "Graphite",
        note: "Warm neutral stone and burnt amber. The quietest paper here - it lets photography and code blocks carry the page.",
        light: {
            background: "#f6f3f0",
            card: "#fffdfb",
            secondary: "#efebe6",
            foreground: "#2b2928",
            mutedForeground: "#615c58",
            faint: "#78736e",
            border: "#e3ddd6",
            borderSoft: "#ede8e2",
            primary: "#b57000",
            primaryForeground: "#ffffff",
            accent: "#f0e2d1",
            accentForeground: "#905800",
            shadowTint: "49, 45, 41",
        },
        dark: {
            background: "#050608",
            card: "#11141a",
            secondary: "#0a0d13",
            foreground: "#e8ebf0",
            mutedForeground: "#9a9fa8",
            faint: "#7f8490",
            border: "#1e232c",
            borderSoft: "#141720",
            primary: "#ce8300",
            primaryForeground: "#ffffff",
            accent: "rgba(206, 131, 0, 0.18)",
            accentForeground: "#e4aa63",
        },
    },
    {
        id: "nordic",
        name: "Nordic",
        note: "Cold slate paper under steel blue. Reads as instrument panel rather than notebook.",
        light: {
            background: "#eef4fb",
            card: "#fcfdff",
            secondary: "#e3edf7",
            foreground: "#272a2d",
            mutedForeground: "#555e68",
            faint: "#6b7681",
            border: "#d2e0ee",
            borderSoft: "#deeaf7",
            primary: "#1e85cb",
            primaryForeground: "#ffffff",
            accent: "#d9e6f6",
            accentForeground: "#0e6ca9",
            shadowTint: "39, 47, 55",
        },
        dark: {
            background: "#04060a",
            card: "#0c141f",
            secondary: "#060e18",
            foreground: "#e5ecf5",
            mutedForeground: "#94a0b0",
            faint: "#778699",
            border: "#182333",
            borderSoft: "#0d1826",
            primary: "#3e99e4",
            primaryForeground: "#ffffff",
            accent: "rgba(62, 153, 228, 0.18)",
            accentForeground: "#7dbdf7",
        },
    },
    {
        id: "moss",
        name: "Moss",
        note: "Oat and sage with a deep forest brand. The most restful of the ten over long sessions.",
        light: {
            background: "#f3f4ee",
            card: "#fdfef9",
            secondary: "#ebede3",
            foreground: "#292a27",
            mutedForeground: "#5d5e55",
            faint: "#74766b",
            border: "#dde0d2",
            borderSoft: "#e8eade",
            primary: "#349150",
            primaryForeground: "#ffffff",
            accent: "#d8eade",
            accentForeground: "#287941",
            shadowTint: "45, 47, 38",
        },
        dark: {
            background: "#040705",
            card: "#0c1710",
            secondary: "#061009",
            foreground: "#e5ede7",
            mutedForeground: "#94a398",
            faint: "#788a7d",
            border: "#17271d",
            borderSoft: "#0d1b12",
            primary: "#44a766",
            primaryForeground: "#ffffff",
            accent: "rgba(68, 167, 102, 0.18)",
            accentForeground: "#84c996",
        },
    },
    {
        id: "plum",
        name: "Plum",
        note: "Lilac-tinted paper and a muted violet. Editorial without going anywhere near neon.",
        light: {
            background: "#f7f1f6",
            card: "#fffcff",
            secondary: "#f1e9f0",
            foreground: "#2b292b",
            mutedForeground: "#625a61",
            faint: "#7a7179",
            border: "#e6dae4",
            borderSoft: "#f0e5ee",
            primary: "#9d6cbf",
            primaryForeground: "#ffffff",
            accent: "#ebe0f0",
            accentForeground: "#7c5199",
            shadowTint: "50, 43, 49",
        },
        dark: {
            background: "#070509",
            card: "#16111c",
            secondary: "#0f0b15",
            foreground: "#ede9f2",
            mutedForeground: "#a29bab",
            faint: "#888093",
            border: "#261f2e",
            borderSoft: "#1a1422",
            primary: "#b57fd5",
            primaryForeground: "#ffffff",
            accent: "rgba(181, 127, 213, 0.18)",
            accentForeground: "#cca4e6",
        },
    },
    {
        id: "gold",
        name: "Ink & Gold",
        note: "Near-white cool paper, antique gold, black ink. The dress-shirt palette.",
        light: {
            background: "#f4f3f0",
            card: "#fefdfb",
            secondary: "#edece7",
            foreground: "#2a2a28",
            mutedForeground: "#5e5d59",
            faint: "#76746f",
            border: "#e0ded8",
            borderSoft: "#eae9e3",
            primary: "#a37a00",
            primaryForeground: "#ffffff",
            accent: "#ebe4d2",
            accentForeground: "#826100",
            shadowTint: "47, 46, 42",
        },
        dark: {
            background: "#050608",
            card: "#11141b",
            secondary: "#0b0d14",
            foreground: "#e8ebf1",
            mutedForeground: "#9b9ea9",
            faint: "#7f8491",
            border: "#1f222d",
            borderSoft: "#141720",
            primary: "#b98e00",
            primaryForeground: "#ffffff",
            accent: "rgba(185, 142, 0, 0.18)",
            accentForeground: "#d4b262",
        },
    },
    {
        id: "ember",
        name: "Ember",
        note: "Warm sand over a deep crimson. Loud where it counts and nowhere else.",
        light: {
            background: "#fcf1ea",
            card: "#fffdfb",
            secondary: "#f9e8dd",
            foreground: "#2e2825",
            mutedForeground: "#695a4f",
            faint: "#827065",
            border: "#f0d9ca",
            borderSoft: "#f9e4d7",
            primary: "#d0585a",
            primaryForeground: "#ffffff",
            accent: "#f7deda",
            accentForeground: "#a74042",
            shadowTint: "56, 43, 34",
        },
        dark: {
            background: "#090505",
            card: "#1d100e",
            secondary: "#160a08",
            foreground: "#f4e8e6",
            mutedForeground: "#ad9996",
            faint: "#967e7a",
            border: "#301d1a",
            borderSoft: "#231310",
            primary: "#ea6d69",
            primaryForeground: "#ffffff",
            accent: "rgba(234, 109, 105, 0.18)",
            accentForeground: "#f99892",
        },
    },
    {
        id: "tide",
        name: "Tide",
        note: "Pale aqua paper and a saturated teal. Cool, clinical, easy on tired eyes.",
        light: {
            background: "#edf6f5",
            card: "#f9fffe",
            secondary: "#e1efef",
            foreground: "#262b2b",
            mutedForeground: "#536060",
            faint: "#697877",
            border: "#d0e3e2",
            borderSoft: "#dcedec",
            primary: "#008f90",
            primaryForeground: "#ffffff",
            accent: "#d1eaec",
            accentForeground: "#007676",
            shadowTint: "37, 48, 48",
        },
        dark: {
            background: "#030708",
            card: "#06171a",
            secondary: "#021013",
            foreground: "#e1eef0",
            mutedForeground: "#8da3a7",
            faint: "#6f8a8f",
            border: "#0e272b",
            borderSoft: "#041b1f",
            primary: "#00a5a7",
            primaryForeground: "#ffffff",
            accent: "rgba(0, 165, 167, 0.18)",
            accentForeground: "#4acccf",
        },
    },
    {
        id: "dusk",
        name: "Dusk",
        note: "Mauve-grey paper under indigo. Closest to the default's mood, one hue family over.",
        light: {
            background: "#f5f2f8",
            card: "#fefcff",
            secondary: "#eee9f2",
            foreground: "#2a292c",
            mutedForeground: "#605b63",
            faint: "#77727b",
            border: "#e2dbe7",
            borderSoft: "#ece6f1",
            primary: "#7178d4",
            primaryForeground: "#ffffff",
            accent: "#e2e3f6",
            accentForeground: "#585dac",
            shadowTint: "48, 44, 51",
        },
        dark: {
            background: "#06060a",
            card: "#13121e",
            secondary: "#0c0c17",
            foreground: "#eaeaf4",
            mutedForeground: "#9d9dae",
            faint: "#828297",
            border: "#212132",
            borderSoft: "#161625",
            primary: "#868aeb",
            primaryForeground: "#ffffff",
            accent: "rgba(134, 138, 235, 0.18)",
            accentForeground: "#a9affa",
        },
    },
    {
        id: "carbon",
        name: "Carbon",
        note: "No hue at all. Ink on white, white on ink - the brand colour IS the ink.",
        light: {
            background: "#f3f3f3",
            card: "#fdfdfd",
            secondary: "#ececec",
            foreground: "#2a2a2a",
            mutedForeground: "#5d5d5d",
            faint: "#747474",
            border: "#dedede",
            borderSoft: "#e9e9e9",
            primary: "#333333",
            primaryForeground: "#ffffff",
            accent: "#e4e4e4",
            accentForeground: "#4d4d4d",
            shadowTint: "46, 46, 46",
        },
        dark: {
            background: "#060606",
            card: "#141414",
            secondary: "#0d0d0d",
            foreground: "#ebebeb",
            mutedForeground: "#9e9e9e",
            faint: "#848484",
            border: "#232323",
            borderSoft: "#171717",
            primary: "#e4e4e4",
            primaryForeground: "#0b0b0b",
            accent: "rgba(228, 228, 228, 0.18)",
            accentForeground: "#b7b7b7",
        },
    },
];

export const themePaletteFor = (id: string): ThemePalette | undefined =>
    THEME_PALETTES.find((p) => p.id === id);

/** The four colours that identify a palette at a glance - what the picker draws as a chip. */
export const themePaletteSwatch = (p: ThemePalette, mode: "light" | "dark"): string[] => [
    p[mode].background,
    p[mode].card,
    p[mode].border,
    p[mode].primary,
];

// The tokens a palette owns. Anything not listed here - the status hues, radius, type - is the
// same in every palette on purpose: they are the app's vocabulary, not its skin.
const VARS: [keyof ThemePaletteColors, string][] = [
    ["background", "--background"],
    ["card", "--card"],
    ["card", "--popover"],
    ["foreground", "--card-foreground"],
    ["foreground", "--popover-foreground"],
    ["foreground", "--foreground"],
    ["secondary", "--secondary"],
    ["secondary", "--muted"],
    ["foreground", "--secondary-foreground"],
    ["mutedForeground", "--muted-foreground"],
    ["faint", "--faint"],
    ["border", "--border"],
    ["border", "--input"],
    ["borderSoft", "--border-soft"],
    ["primary", "--primary"],
    ["primary", "--ring"],
    ["primaryForeground", "--primary-foreground"],
    ["accent", "--accent"],
    ["accentForeground", "--accent-foreground"],
];

// The status hues are the SAME in every palette - they are the app's vocabulary, not its skin -
// but they are not the same in every MODE, so they have to be restated here.
//
// The reason is that .dark is a class on <html>, and a preview that draws a palette's dark mode
// inside a light page is not inside that class. Without these it would take the surfaces from
// the palette and the status hues from whatever mode the page happens to be in - a dark card
// with light-mode chips on it. Writing them makes themePaletteStyle() a COMPLETE token set for
// one mode, which is exactly what both a preview and <html> want.
//
// Copied from tokens.css. If a status hue changes there, change it here too - the value is the
// same in both places on purpose, and the gallery draws both, so a drift is visible immediately.
const STATUS: Record<"light" | "dark", Record<string, string>> = {
    light: {
        "--success": "#4f8a52",
        "--warning": "#c08a2e",
        "--info": "#4a72b0",
        "--approval": "#7a5ea8",
        "--neutral": "#8a8579",
        "--destructive": "#b6483f",
        "--destructive-foreground": "#ffffff",
    },
    dark: {
        "--success": "#34d399",
        "--warning": "#fbbf24",
        "--info": "#60a5fa",
        "--approval": "#a78bfa",
        "--neutral": "#8a93a8",
        "--destructive": "#dd6b62",
        "--destructive-foreground": "#fbe9e6",
    },
};

// Their tinted fills ARE re-mixed per palette, against the page - so a chip on Nordic's cold
// paper is a cold chip, not the cream one tokens.css authored for Paper.
const SOFT = ["success", "warning", "info", "approval", "neutral", "destructive"];

const MANAGED = [
    ...VARS.map(([, v]) => v),
    ...Object.keys(STATUS.light),
    ...SOFT.map((s) => `--${s}-soft`),
    "--shadow-e1",
    "--shadow-e2",
];

/**
 * Every token value for one palette in one mode, as a style object.
 *
 * Complete on purpose: apply it to any element and that subtree is that palette in that mode,
 * whatever the page around it is doing. The controller writes it to <html>; the gallery writes
 * it to a card to show ten palettes' dark modes on a light page.
 */
export function themePaletteStyle(
    colors: ThemePaletteColors,
    mode: "light" | "dark",
): Record<string, string> {
    const out: Record<string, string> = { ...STATUS[mode] };
    for (const [key, cssVar] of VARS) {
        const value = colors[key];
        if (value) out[cssVar] = value;
    }
    for (const s of SOFT) {
        out[`--${s}-soft`] =
            `color-mix(in srgb, var(--${s}) ${mode === "dark" ? 20 : 14}%, var(--background))`;
    }
    if (mode === "dark") {
        out["--shadow-e1"] = "0 1px 2px rgba(0, 0, 0, 0.45), 0 8px 28px rgba(0, 0, 0, 0.55)";
        out["--shadow-e2"] = "0 2px 6px rgba(0, 0, 0, 0.5), 0 22px 60px rgba(0, 0, 0, 0.65)";
    } else if (colors.shadowTint) {
        const t = colors.shadowTint;
        out["--shadow-e1"] = `0 1px 2px rgba(${t}, 0.04), 0 8px 28px rgba(${t}, 0.07)`;
        out["--shadow-e2"] = `0 2px 6px rgba(${t}, 0.06), 0 22px 60px rgba(${t}, 0.13)`;
    }
    return out;
}

export type ThemePaletteController = {
    getPaletteId(): string;
    setPaletteId(id: string): void;
    /** The user's own colours, or null if they have never opened the custom editor. */
    getCustomPalette(): ThemePalette | null;
    setCustomPalette(palette: ThemePalette): void;
    /** The palette in force, custom included. */
    getPalette(): ThemePalette;
    /** Re-write the vars for the theme currently on <html>. */
    applyPalette(): void;
    onPaletteChange(fn: () => void): () => void;
    /** Apply now and keep applying across theme changes. Call once, at boot. Returns a teardown. */
    initPalette(): () => void;
};

const EVENT = "paperkit:palettechange";

export function createThemePalette(opts: { namespace?: string } = {}): ThemePaletteController {
    const ns = opts.namespace ?? DEFAULT_NAMESPACE;
    const idKey = `${ns}-palette`;
    const customKey = `${ns}-palette-custom`;

    function getCustomPalette(): ThemePalette | null {
        const raw = prefStorage().get(customKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as ThemePalette;
            return parsed?.light && parsed?.dark ? parsed : null;
        } catch {
            return null; // a hand-edited or half-written value must not brick the app
        }
    }

    function getPaletteId(): string {
        const id = prefStorage().get(idKey);
        if (id === CUSTOM_PALETTE_ID) return getCustomPalette() ? id : DEFAULT_PALETTE_ID;
        return id && themePaletteFor(id) ? id : DEFAULT_PALETTE_ID;
    }

    function getPalette(): ThemePalette {
        const id = getPaletteId();
        if (id === CUSTOM_PALETTE_ID) {
            const custom = getCustomPalette();
            if (custom) return custom;
        }
        return themePaletteFor(id) ?? THEME_PALETTES[0];
    }

    function applyPalette(): void {
        if (typeof document === "undefined") return;
        const el = document.documentElement;
        for (const v of MANAGED) el.style.removeProperty(v);
        const id = getPaletteId();
        // Paper is the authored theme. Clearing IS applying it - and it cannot drift.
        if (id === DEFAULT_PALETTE_ID) return;
        const mode = el.classList.contains("dark") ? "dark" : "light";
        const style = themePaletteStyle(getPalette()[mode], mode);
        for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
    }

    function announce(): void {
        applyPalette();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
    }

    function setPaletteId(id: string): void {
        if (id === DEFAULT_PALETTE_ID) prefStorage().remove(idKey);
        else prefStorage().set(idKey, id);
        announce();
    }

    function setCustomPalette(palette: ThemePalette): void {
        prefStorage().set(customKey, JSON.stringify({ ...palette, id: CUSTOM_PALETTE_ID }));
        prefStorage().set(idKey, CUSTOM_PALETTE_ID);
        announce();
    }

    function onPaletteChange(fn: () => void): () => void {
        window.addEventListener(EVENT, fn);
        return () => window.removeEventListener(EVENT, fn);
    }

    function initPalette(): () => void {
        applyPalette();
        if (typeof window === "undefined") return () => {};
        // The vars are mode-specific, so a light/dark flip has to re-resolve them.
        return onThemeChange(applyPalette);
    }

    return {
        getPaletteId,
        setPaletteId,
        getCustomPalette,
        setCustomPalette,
        getPalette,
        applyPalette,
        onPaletteChange,
        initPalette,
    };
}

/** Default controller, on the same namespace as the default theme controller. */
export const themePalette: ThemePaletteController = createThemePalette();

export const {
    getPaletteId,
    setPaletteId,
    getCustomPalette,
    setCustomPalette,
    getPalette,
    applyPalette,
    onPaletteChange,
    initPalette,
} = themePalette;
