// Palettes: the whole design system re-skinned by overriding token VALUES, which is exactly
// what DESIGN.md says branding a product means. No component knows this file exists.
//
// HOW THE NINE WERE BUILT, because it matters if you add a tenth:
//
// THE SURFACES ARE ACHROMATIC. Chroma 0.001-0.0035 - a temperature, not a colour. You cannot
// see it without two palettes side by side, and that is the point: a tinted page is the first
// thing that looks wrong on a blue-shifted, uncalibrated or cheap panel, because the viewer has
// no reference for what it was supposed to be. Grey paper looks deliberate on every screen
// there is. All of the identity is carried by the brand.
//
// THE BRAND IS AS SATURATED AS THE HUE ALLOWS. Chroma is not a number picked per palette; it is
// 90% of the sRGB ceiling at the lightness in use, solved jointly with that lightness against a
// 4.5:1 target ON THE PAGE - because --primary is a link and a focus ring at least as often as
// it is a button fill, so it has to work as text. 90% is measured, not taste: it is where
// Tailwind's 600 tier sits (blue-600 86% of ceiling, red-600 91%, violet-600 87%, teal-600 98%).
// Sitting ON the ceiling is what makes a colour look like it is clipping.
//
// The ceiling is a property of the hue, so it also decides the hues. A "classic blue" at 250
// tops out at chroma 0.157; the same blue to the eye at 259 reaches 0.24. Every hue here was
// nudged onto the part of the wheel where sRGB has room. Teal, gold and green have hard low
// ceilings whatever you do - that is the gamut, not a compromise, and it is why yellow-600 and
// teal-600 are the least chromatic colours Tailwind ships too.
//
// THE ACCENT IS A SURFACE, not text, so its legibility is accentForeground's job and it gets
// real colour rather than the near-white wash a soft fill usually settles for.
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
        note: "Neutral grey paper under a vivid classic blue. The safest of the ten - reach for it when the interface should disappear behind the work.",
        light: {
            background: "#f4f4f5",
            card: "#feffff",
            secondary: "#ececed",
            foreground: "#202021",
            mutedForeground: "#535455",
            faint: "#6b6c6d",
            border: "#d4d5d6",
            borderSoft: "#e4e5e6",
            primary: "#1c6be0",
            primaryForeground: "#ffffff",
            accent: "#d1e0fd",
            accentForeground: "#174ea1",
            shadowTint: "37, 39, 40",
        },
        dark: {
            background: "#0a0a0b",
            card: "#202122",
            secondary: "#131415",
            foreground: "#e9eaeb",
            mutedForeground: "#a5a7a8",
            faint: "#8a8c8d",
            border: "#37383a",
            borderSoft: "#262728",
            primary: "#8eb7f8",
            primaryForeground: "#161718",
            accent: "rgba(142, 183, 248, 0.18)",
            accentForeground: "#b8d1f8",
        },
    },
    {
        id: "graphite",
        name: "Graphite",
        note: "No hue anywhere. Black ink, white paper, and the brand is the ink - the Swiss poster reading of a UI, and the only palette that cannot age.",
        light: {
            background: "#f5f4f4",
            card: "#ffffff",
            secondary: "#edecec",
            foreground: "#212020",
            mutedForeground: "#555354",
            faint: "#6d6c6c",
            border: "#d6d4d5",
            borderSoft: "#e6e4e5",
            primary: "#232323",
            primaryForeground: "#ffffff",
            accent: "#e4e4e4",
            accentForeground: "#414141",
            shadowTint: "40, 38, 38",
        },
        dark: {
            background: "#0b0a0a",
            card: "#222021",
            secondary: "#151314",
            foreground: "#ebe9ea",
            mutedForeground: "#a8a6a7",
            faint: "#8d8b8b",
            border: "#3a3738",
            borderSoft: "#282627",
            primary: "#ededed",
            primaryForeground: "#101010",
            accent: "rgba(237, 237, 237, 0.16)",
            accentForeground: "#cccccc",
        },
    },
    {
        id: "indigo",
        name: "Indigo",
        note: "Cool-neutral paper and a saturated indigo. Reads as considered rather than corporate, and holds up on a projector.",
        light: {
            background: "#f4f4f5",
            card: "#ffffff",
            secondary: "#ececed",
            foreground: "#202021",
            mutedForeground: "#545455",
            faint: "#6c6c6d",
            border: "#d5d5d6",
            borderSoft: "#e5e5e6",
            primary: "#7e4df2",
            primaryForeground: "#ffffff",
            accent: "#e1dafc",
            accentForeground: "#5a26ba",
            shadowTint: "38, 38, 40",
        },
        dark: {
            background: "#0a0a0b",
            card: "#202022",
            secondary: "#141415",
            foreground: "#e9eaeb",
            mutedForeground: "#a6a6a8",
            faint: "#8b8b8d",
            border: "#38383a",
            borderSoft: "#272728",
            primary: "#b6a9f8",
            primaryForeground: "#171718",
            accent: "rgba(182, 169, 248, 0.18)",
            accentForeground: "#cfc9f8",
        },
    },
    {
        id: "pine",
        name: "Pine",
        note: "Warm-neutral paper with a strong forest green. Calm without going herbal - the least tiring of the ten over a long session.",
        light: {
            background: "#f4f4f4",
            card: "#fefffe",
            secondary: "#ecedec",
            foreground: "#202120",
            mutedForeground: "#535453",
            faint: "#6b6d6c",
            border: "#d4d5d4",
            borderSoft: "#e4e5e4",
            primary: "#208046",
            primaryForeground: "#ffffff",
            accent: "#c5ebd1",
            accentForeground: "#1d6236",
            shadowTint: "37, 39, 37",
        },
        dark: {
            background: "#0a0a0a",
            card: "#202120",
            secondary: "#131413",
            foreground: "#e9eae9",
            mutedForeground: "#a5a7a6",
            faint: "#8a8c8a",
            border: "#373837",
            borderSoft: "#262726",
            primary: "#3bd678",
            primaryForeground: "#161716",
            accent: "rgba(59, 214, 120, 0.18)",
            accentForeground: "#54f28e",
        },
    },
    {
        id: "olive",
        name: "Olive",
        note: "Bone paper and a sharp olive. Utilitarian in the good sense: field notebook, not dashboard.",
        light: {
            background: "#f4f4f4",
            card: "#fffffe",
            secondary: "#ececeb",
            foreground: "#202020",
            mutedForeground: "#545453",
            faint: "#6c6c6b",
            border: "#d5d5d3",
            borderSoft: "#e5e5e4",
            primary: "#63781c",
            primaryForeground: "#ffffff",
            accent: "#d8e6c3",
            accentForeground: "#4a5a19",
            shadowTint: "38, 39, 36",
        },
        dark: {
            background: "#0a0a0a",
            card: "#21211f",
            secondary: "#141413",
            foreground: "#eaeae8",
            mutedForeground: "#a7a7a5",
            faint: "#8b8c89",
            border: "#383836",
            borderSoft: "#272725",
            primary: "#a4c634",
            primaryForeground: "#171716",
            accent: "rgba(164, 198, 52, 0.18)",
            accentForeground: "#bce14c",
        },
    },
    {
        id: "ochre",
        name: "Ochre",
        note: "Barely-warm paper and a rich gold. Carries warmth without the terracotta the default already owns.",
        light: {
            background: "#f5f4f4",
            card: "#fffffe",
            secondary: "#edeceb",
            foreground: "#212020",
            mutedForeground: "#545453",
            faint: "#6d6c6b",
            border: "#d5d5d3",
            borderSoft: "#e5e5e4",
            primary: "#93681c",
            primaryForeground: "#ffffff",
            accent: "#f0ddc0",
            accentForeground: "#6b4c18",
            shadowTint: "39, 38, 36",
        },
        dark: {
            background: "#0b0a09",
            card: "#21211f",
            secondary: "#141413",
            foreground: "#eaeae8",
            mutedForeground: "#a7a7a5",
            faint: "#8c8b89",
            border: "#393836",
            borderSoft: "#272725",
            primary: "#eba733",
            primaryForeground: "#181716",
            accent: "rgba(235, 167, 51, 0.18)",
            accentForeground: "#f8c67c",
        },
    },
    {
        id: "claret",
        name: "Claret",
        note: "Off-white with a full-blooded crimson. The editorial one - masthead red, dark enough to sit under body text.",
        light: {
            background: "#f5f4f4",
            card: "#fffffe",
            secondary: "#edecec",
            foreground: "#212020",
            mutedForeground: "#555353",
            faint: "#6d6c6b",
            border: "#d6d4d4",
            borderSoft: "#e6e4e4",
            primary: "#d7282d",
            primaryForeground: "#ffffff",
            accent: "#fdd5cf",
            accentForeground: "#942021",
            shadowTint: "40, 38, 37",
        },
        dark: {
            background: "#0b0a0a",
            card: "#222020",
            secondary: "#151313",
            foreground: "#ebe9e9",
            mutedForeground: "#a8a6a5",
            faint: "#8d8b8a",
            border: "#3a3737",
            borderSoft: "#282626",
            primary: "#f9978e",
            primaryForeground: "#181716",
            accent: "rgba(249, 151, 142, 0.18)",
            accentForeground: "#f8bfb9",
        },
    },
    {
        id: "aubergine",
        name: "Aubergine",
        note: "Neutral paper and a deep magenta-purple. The most distinctive at a glance, and still quiet at arm's length.",
        light: {
            background: "#f5f4f5",
            card: "#ffffff",
            secondary: "#edeced",
            foreground: "#212021",
            mutedForeground: "#545354",
            faint: "#6d6c6d",
            border: "#d5d4d5",
            borderSoft: "#e5e4e5",
            primary: "#c328b0",
            primaryForeground: "#ffffff",
            accent: "#fecff0",
            accentForeground: "#851f77",
            shadowTint: "39, 38, 39",
        },
        dark: {
            background: "#0b0a0b",
            card: "#212021",
            secondary: "#141314",
            foreground: "#eae9ea",
            mutedForeground: "#a8a6a8",
            faint: "#8c8b8c",
            border: "#393739",
            borderSoft: "#282628",
            primary: "#f985e5",
            primaryForeground: "#181718",
            accent: "rgba(249, 133, 229, 0.18)",
            accentForeground: "#f8b7eb",
        },
    },
    {
        id: "teal",
        name: "Teal",
        note: "Cool-neutral paper and a saturated teal. The one that stays legible under fluorescent light and on a washed-out screen.",
        light: {
            background: "#f4f5f5",
            card: "#feffff",
            secondary: "#ebeded",
            foreground: "#202121",
            mutedForeground: "#535454",
            faint: "#6b6d6d",
            border: "#d3d5d5",
            borderSoft: "#e4e5e5",
            primary: "#207c7b",
            primaryForeground: "#ffffff",
            accent: "#c6e7e7",
            accentForeground: "#1d5e5c",
            shadowTint: "36, 39, 39",
        },
        dark: {
            background: "#090b0b",
            card: "#1f2121",
            secondary: "#131414",
            foreground: "#e8eaea",
            mutedForeground: "#a5a7a7",
            faint: "#898c8c",
            border: "#363839",
            borderSoft: "#252727",
            primary: "#3bcecb",
            primaryForeground: "#161718",
            accent: "rgba(59, 206, 203, 0.18)",
            accentForeground: "#54e9e6",
        },
    },
];

export const themePaletteFor = (id: string): ThemePalette | undefined =>
    THEME_PALETTES.find((p) => p.id === id);

/**
 * The four colours that identify a palette at a glance - what the picker draws as a chip.
 * Page, paper, the soft brand fill and the brand: with the surfaces deliberately near-neutral,
 * a chip built from page/paper/line/brand would be three identical stops in every palette.
 */
export const themePaletteSwatch = (p: ThemePalette, mode: "light" | "dark"): string[] => [
    p[mode].background,
    p[mode].card,
    p[mode].accent,
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
