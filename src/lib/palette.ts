// Palettes: the whole design system re-skinned by overriding token VALUES, which is exactly
// what DESIGN.md says branding a product means. No component knows this file exists.
//
// HOW THE NINE WERE BUILT, because it matters if you add a tenth:
//
// THE PAPER IS NEUTRAL. Every one of them is near-white (chroma <= 0.006) or, for Graphite,
// exactly grey. A tinted page - pale blue, lilac, mint - is the first thing that looks wrong on
// a blue-shifted, uncalibrated or cheap panel, because the viewer has no reference for what it
// was supposed to be. A near-white page looks deliberate on every screen there is. What
// distinguishes these palettes is the BRAND colour, which is a decision, not a tint.
//
// THE BRAND IS DEEP. Its lightness is solved, per hue, as the most vivid value that still reads
// at 4.5:1 AGAINST THE PAGE - because --primary is a link and a focus ring at least as often as
// it is a button fill, so it has to work as text. That constraint is what makes these colours
// deep rather than bright, and deep is also what ages well: no neon, no pastel, no gradient-era
// purple-pink. White on the resulting button lands near 5:1.
//
// DARK MODE INVERTS THE BRAND. --primary goes light and --primary-foreground goes dark, which
// is what every dark interface that reads well does. A dark-mode button dark enough to carry
// white text is too dark to read as body text, and the same token has to do both jobs; light
// brand on dark ink settles it at ~9:1 both ways.
//
// EVERY STEP IS A STEP DARKER than the authored theme: ink 16:1 rather than 13:1, the faintest
// text 5.2:1 rather than 4.6:1, and borders at 1.35:1 against the page rather than 1.1:1, which
// is the difference between a visible line and no line at all on a dim laptop screen. Dark mode
// lifts OFF pure black - an almost-black page haloes white text on OLED and bands on cheap
// LCDs, and it leaves nothing to show a raised card against.
//
// Paper is exempt from all of it. It is the authored theme and stays exactly as tokens.css
// wrote it, tinted paper and all.
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
        id: "slate",
        name: "Slate",
        note: "Cool grey paper under a deep classic blue. The safest of the ten - the one to reach for when the interface should disappear behind the work.",
        light: {
            background: "#f2f5f7",
            card: "#feffff",
            secondary: "#e9edf0",
            foreground: "#1e2123",
            mutedForeground: "#515458",
            faint: "#696d71",
            border: "#d1d5da",
            borderSoft: "#e2e5e9",
            primary: "#2373bb",
            primaryForeground: "#ffffff",
            accent: "#daeaff",
            accentForeground: "#004d88",
            shadowTint: "34, 39, 44",
        },
        dark: {
            background: "#080b0e",
            card: "#1d2126",
            secondary: "#111418",
            foreground: "#e6eaef",
            mutedForeground: "#a1a8af",
            faint: "#858c95",
            border: "#323940",
            borderSoft: "#22282d",
            primary: "#7ebbfa",
            primaryForeground: "#13181d",
            accent: "rgba(126, 187, 250, 0.16)",
            accentForeground: "#a8d1fb",
        },
    },
    {
        id: "graphite",
        name: "Graphite",
        note: "No hue anywhere. Black ink, white paper, and the brand is the ink - the Swiss poster reading of a UI, and the only palette that cannot age.",
        light: {
            background: "#f4f4f4",
            card: "#ffffff",
            secondary: "#ececec",
            foreground: "#202020",
            mutedForeground: "#545454",
            faint: "#6c6c6c",
            border: "#d5d5d5",
            borderSoft: "#e5e5e5",
            primary: "#232323",
            primaryForeground: "#ffffff",
            accent: "#e6e6e6",
            accentForeground: "#414141",
            shadowTint: "38, 38, 38",
        },
        dark: {
            background: "#0a0a0a",
            card: "#212121",
            secondary: "#141414",
            foreground: "#eaeaea",
            mutedForeground: "#a7a7a7",
            faint: "#8b8b8b",
            border: "#383838",
            borderSoft: "#272727",
            primary: "#ededed",
            primaryForeground: "#101010",
            accent: "rgba(237, 237, 237, 0.16)",
            accentForeground: "#cccccc",
        },
    },
    {
        id: "indigo",
        name: "Indigo",
        note: "Barely-cool paper and a deep indigo. Reads as considered rather than corporate, and holds up on a projector.",
        light: {
            background: "#f4f4f7",
            card: "#ffffff",
            secondary: "#ebecf0",
            foreground: "#202023",
            mutedForeground: "#535458",
            faint: "#6b6c71",
            border: "#d3d5da",
            borderSoft: "#e4e5e9",
            primary: "#6d64c1",
            primaryForeground: "#ffffff",
            accent: "#e7e5ff",
            accentForeground: "#473d8e",
            shadowTint: "37, 38, 44",
        },
        dark: {
            background: "#090a0d",
            card: "#1f2026",
            secondary: "#131417",
            foreground: "#e8e9ef",
            mutedForeground: "#a4a6ae",
            faint: "#898b94",
            border: "#363740",
            borderSoft: "#25272d",
            primary: "#aeabfc",
            primaryForeground: "#16161d",
            accent: "rgba(174, 171, 252, 0.16)",
            accentForeground: "#c6c6fd",
        },
    },
    {
        id: "pine",
        name: "Pine",
        note: "Warm-neutral paper with a deep forest green. Calm without going herbal - the least tiring of the ten over a long session.",
        light: {
            background: "#f3f5f3",
            card: "#fefffe",
            secondary: "#eaedeb",
            foreground: "#1f211f",
            mutedForeground: "#515552",
            faint: "#6a6e6a",
            border: "#d2d6d3",
            borderSoft: "#e3e6e3",
            primary: "#1c8052",
            primaryForeground: "#ffffff",
            accent: "#d8efe2",
            accentForeground: "#005b37",
            shadowTint: "35, 40, 36",
        },
        dark: {
            background: "#090b09",
            card: "#1e221e",
            secondary: "#121512",
            foreground: "#e7ebe8",
            mutedForeground: "#a2a9a3",
            faint: "#878e88",
            border: "#333a34",
            borderSoft: "#232824",
            primary: "#80c89f",
            primaryForeground: "#131915",
            accent: "rgba(128, 200, 159, 0.16)",
            accentForeground: "#aad9bd",
        },
    },
    {
        id: "olive",
        name: "Olive",
        note: "Drab olive on bone. Utilitarian in the good sense: field notebook, not dashboard.",
        light: {
            background: "#f5f5f2",
            card: "#fffffd",
            secondary: "#edede9",
            foreground: "#21211e",
            mutedForeground: "#545450",
            faint: "#6d6d67",
            border: "#d5d5d0",
            borderSoft: "#e5e5e1",
            primary: "#677729",
            primaryForeground: "#ffffff",
            accent: "#e4ecd8",
            accentForeground: "#455303",
            shadowTint: "39, 39, 33",
        },
        dark: {
            background: "#0b0b07",
            card: "#21211c",
            secondary: "#141410",
            foreground: "#eaeae5",
            mutedForeground: "#a8a79f",
            faint: "#8c8c83",
            border: "#393830",
            borderSoft: "#282721",
            primary: "#aebe7f",
            primaryForeground: "#161812",
            accent: "rgba(174, 190, 127, 0.16)",
            accentForeground: "#c7d2a8",
        },
    },
    {
        id: "ochre",
        name: "Ochre",
        note: "Warm paper and a deep gold. Carries warmth without the terracotta the default already owns.",
        light: {
            background: "#f6f4f1",
            card: "#fffffe",
            secondary: "#eeece8",
            foreground: "#22201d",
            mutedForeground: "#56544f",
            faint: "#6f6c67",
            border: "#d7d4cf",
            borderSoft: "#e7e5e0",
            primary: "#946800",
            primaryForeground: "#ffffff",
            accent: "#f3e7d0",
            accentForeground: "#644500",
            shadowTint: "41, 38, 32",
        },
        dark: {
            background: "#0c0a07",
            card: "#23201b",
            secondary: "#16140f",
            foreground: "#ece9e4",
            mutedForeground: "#aaa69e",
            faint: "#908b81",
            border: "#3c372f",
            borderSoft: "#2a2720",
            primary: "#daae63",
            primaryForeground: "#1a1711",
            accent: "rgba(218, 174, 99, 0.16)",
            accentForeground: "#e5c897",
        },
    },
    {
        id: "claret",
        name: "Claret",
        note: "Off-white with a deep burgundy. The editorial one - masthead red, kept dark enough to sit under body text.",
        light: {
            background: "#f7f4f3",
            card: "#fffffe",
            secondary: "#f0ebea",
            foreground: "#231f1f",
            mutedForeground: "#585251",
            faint: "#716b6a",
            border: "#d9d3d2",
            borderSoft: "#e8e4e3",
            primary: "#b74f50",
            primaryForeground: "#ffffff",
            accent: "#ffe0dd",
            accentForeground: "#82272b",
            shadowTint: "44, 37, 35",
        },
        dark: {
            background: "#0d0909",
            card: "#251f1e",
            secondary: "#171212",
            foreground: "#efe8e7",
            mutedForeground: "#aea4a2",
            faint: "#948987",
            border: "#3f3534",
            borderSoft: "#2c2524",
            primary: "#f49996",
            primaryForeground: "#1c1515",
            accent: "rgba(244, 153, 150, 0.16)",
            accentForeground: "#f9bab6",
        },
    },
    {
        id: "aubergine",
        name: "Aubergine",
        note: "Faintly warm paper and a deep aubergine. Distinctive at a glance and still quiet at arm's length.",
        light: {
            background: "#f5f4f6",
            card: "#ffffff",
            secondary: "#eeebee",
            foreground: "#212022",
            mutedForeground: "#555356",
            faint: "#6e6b6f",
            border: "#d7d3d7",
            borderSoft: "#e6e4e7",
            primary: "#a0549b",
            primaryForeground: "#ffffff",
            accent: "#f8e0f2",
            accentForeground: "#6f2d6b",
            shadowTint: "41, 37, 41",
        },
        dark: {
            background: "#0c090c",
            card: "#231f23",
            secondary: "#151316",
            foreground: "#ece8ec",
            mutedForeground: "#aaa5ab",
            faint: "#8f8990",
            border: "#3b363c",
            borderSoft: "#29252a",
            primary: "#de9cd8",
            primaryForeground: "#1a151a",
            accent: "rgba(222, 156, 216, 0.16)",
            accentForeground: "#e9bbe3",
        },
    },
    {
        id: "teal",
        name: "Teal",
        note: "Cool paper and a deep teal. The one that stays legible under fluorescent light and on a washed-out screen.",
        light: {
            background: "#f2f5f5",
            card: "#feffff",
            secondary: "#e9eeee",
            foreground: "#1e2122",
            mutedForeground: "#505556",
            faint: "#676e6e",
            border: "#d0d6d7",
            borderSoft: "#e1e6e6",
            primary: "#007d82",
            primaryForeground: "#ffffff",
            accent: "#d3eff2",
            accentForeground: "#00575b",
            shadowTint: "32, 40, 41",
        },
        dark: {
            background: "#070b0c",
            card: "#1b2223",
            secondary: "#101515",
            foreground: "#e5ebec",
            mutedForeground: "#9fa9aa",
            faint: "#838e8f",
            border: "#303a3b",
            borderSoft: "#20292a",
            primary: "#63c8cd",
            primaryForeground: "#111919",
            accent: "rgba(99, 200, 205, 0.16)",
            accentForeground: "#9bd9dc",
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
/** The label on a filled status chip in dark mode. Deep enough for 5.7:1 on the darkest of them. */
const STATUS_INK = "#101216";

const STATUS: Record<"light" | "dark", Record<string, string>> = {
    light: {
        "--success": "#4f8a52",
        "--warning": "#c08a2e",
        "--info": "#4a72b0",
        "--approval": "#7a5ea8",
        "--neutral": "#8a8579",
        "--destructive": "#b6483f",
        "--success-foreground": "#ffffff",
        "--warning-foreground": "#ffffff",
        "--info-foreground": "#ffffff",
        "--approval-foreground": "#ffffff",
        "--neutral-foreground": "#ffffff",
        "--destructive-foreground": "#ffffff",
    },
    // The dark hues are LIGHT colours - mint, amber, sky, violet - so their labels go dark, the
    // same inversion the brand makes. tokens.css leaves these as white, inherited from :root,
    // which puts white on mint at about 2:1 on a filled success button. A palette is allowed to
    // fix that; Paper, which applies by clearing, keeps the authored behaviour.
    dark: {
        "--success": "#34d399",
        "--warning": "#fbbf24",
        "--info": "#60a5fa",
        "--approval": "#a78bfa",
        "--neutral": "#8a93a8",
        "--destructive": "#dd6b62",
        "--success-foreground": STATUS_INK,
        "--warning-foreground": STATUS_INK,
        "--info-foreground": STATUS_INK,
        "--approval-foreground": STATUS_INK,
        "--neutral-foreground": STATUS_INK,
        "--destructive-foreground": STATUS_INK,
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
