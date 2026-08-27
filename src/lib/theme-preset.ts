// THEME PRESETS: the whole design system re-skinned on four axes at once.
//
//   colour   13 tokens x light/dark      the ten palettes in ./palette.ts
//   type     --font-sans/-display/-mono/-serif
//   radius   --radius, --radius-card
//   space    --spacing
//
// NAMING. "Theme" in this package already means "light" | "dark" (./theme.ts), and that is the
// MODE. This file's concept is the PRESET: a named bundle of the four axes, which then renders
// in either mode. Nothing here touches the light/dark controller.
//
// WHY A PRESET AND NOT FOUR DROPDOWNS. Most points in colour x type x radius x space look bad -
// a serif display over 4px corners at compact density is not a style, it is a mistake. The six
// below are curated bundles; the custom editor is where the four axes come apart, and it opens
// seeded from whichever preset you were looking at so the starting point is always coherent.
//
// SPACE IS ONE TOKEN, and that is the whole reason this axis is cheap. Tailwind v4 compiles
// EVERY spacing utility as a multiple of one variable - measured in the built gallery CSS:
//   .h-9{height:calc(var(--spacing) * 9)}  .px-4{padding-inline:calc(var(--spacing) * 4)}
//   .gap-2{gap:calc(var(--spacing) * 2)}   .p-5{padding:calc(var(--spacing) * 5)}
// 254 such declarations in the current build, all against one `--spacing:.25rem`. So density
// needs no new tokens and no edits to a single primitive: set it and the whole kit breathes.
// Tailwind declares it
// inside `@layer theme` on `:root,:host`; an inline style on <html> is not in any layer and
// outranks it. Measured in headless Chrome on the live gallery, on a real <Button> (h-9):
//   0.25rem -> 36.00px   0.22rem -> 31.67px   0.28rem -> 40.32px
// and removing the inline property returns it to exactly 36.00px.
//
// APPLYING a preset writes inline custom properties on <html>, which outrank both :root and
// .dark. The colour half is mode-specific, so the controller re-applies on every theme change.
// Selecting Paper REMOVES every managed property rather than re-writing it, so the authored
// theme is always byte-exact whatever tokens.css says today - and MANAGED therefore has to
// list every property any axis can write, or switching back to Paper leaves radius, spacing or
// a font family stuck on the preset you just left.
//
// FACES ARE NOT FREE. A pairing only names families; the app must import the stylesheet that
// loads them (obp-ui/fonts.css for the authored four, obp-ui/fonts-alt.css for the rest). An
// unloaded face falls through the token's fallback stack to system-ui and looks like the
// preset silently failed. See src/styles/fonts-alt.css.

import {
    DEFAULT_PALETTE_ID,
    THEME_PALETTES,
    type ThemePalette,
    type ThemePaletteColors,
    themePaletteFor,
} from "./palette";
import { prefStorage } from "./storage";
import { DEFAULT_NAMESPACE, onThemeChange } from "./theme";

export const DEFAULT_PRESET_ID = "paper";
export const CUSTOM_PRESET_ID = "custom";

// ── type axis ────────────────────────────────────────────────────────────────

export type TypePairing = {
    id: string;
    name: string;
    /** One line on what the pairing is for. Shown in the editor. */
    note: string;
    sans: string;
    display: string;
    mono: string;
    serif: string;
};

// Fallback stacks are three deep on purpose: the registered variable name, the plain family
// name for a host that has the static face installed, then a generic. The variable packages
// register "<Family> Variable" - naming plain "Geist" matches nothing and drops to system-ui
// with no error, which is the single most common way a type axis appears not to work.
const SYS = "system-ui, sans-serif";
const INTER = `"Inter Variable", "Inter", ${SYS}`;
const GEIST = `"Geist Variable", "Geist", ${SYS}`;
const PLEX = `"IBM Plex Sans Variable", "IBM Plex Sans", ${SYS}`;
const GROTESK = `"Space Grotesk Variable", "Space Grotesk", "Inter Variable", sans-serif`;
const JETBRAINS = `"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace`;
const GEIST_MONO = `"Geist Mono Variable", "Geist Mono", ui-monospace, monospace`;
const SPECTRAL = `"Spectral", Georgia, serif`;
const FRAUNCES = `"Fraunces Variable", "Fraunces", Georgia, serif`;
const INSTRUMENT = `"Instrument Serif", Georgia, serif`;

export const TYPE_PAIRINGS: TypePairing[] = [
    {
        id: "paper",
        name: "Paper",
        note: "The authored pairing: Inter body, Space Grotesk headings, JetBrains meta, Spectral pull-quotes.",
        sans: INTER,
        display: GROTESK,
        mono: JETBRAINS,
        serif: SPECTRAL,
    },
    {
        id: "operator",
        name: "Operator",
        note: "Geist body under geometric Space Grotesk headings, with Geist Mono. Reads as a tool, not a document.",
        sans: GEIST,
        display: GROTESK,
        mono: GEIST_MONO,
        serif: SPECTRAL,
    },
    {
        id: "geist",
        name: "Geist",
        note: "One family in both roles. Nothing about the type says anything - which is the point when the palette is already silent.",
        sans: GEIST,
        display: GEIST,
        mono: GEIST_MONO,
        serif: SPECTRAL,
    },
    {
        id: "plex",
        name: "Plex",
        note: "IBM Plex Sans throughout with JetBrains Mono. A neutral grotesk built for long tables and code beside prose.",
        sans: PLEX,
        display: PLEX,
        mono: JETBRAINS,
        serif: SPECTRAL,
    },
    {
        id: "fraunces",
        name: "Fraunces",
        note: "Inter body under a soft display serif, and Fraunces again for the serif role. Long-form.",
        sans: INTER,
        display: FRAUNCES,
        mono: JETBRAINS,
        serif: FRAUNCES,
    },
    {
        id: "instrument",
        name: "Instrument",
        note: "High-contrast serif headings over Inter. Instrument Serif ships 400 only, so a light heading renders at 400 by design.",
        sans: INTER,
        display: INSTRUMENT,
        mono: JETBRAINS,
        serif: SPECTRAL,
    },
];

export const typePairingFor = (id: string): TypePairing | undefined =>
    TYPE_PAIRINGS.find((t) => t.id === id);

// ── radius axis ──────────────────────────────────────────────────────────────

export type RadiusStep = {
    id: string;
    name: string;
    /** --radius: buttons, inputs, badges. */
    radius: string;
    /** --radius-card: cards, surfaces, dialogs. */
    card: string;
};

// The card radius runs ~1.5x the control radius at every step, which is the ratio tokens.css
// authored (12px / 18px). Holding it is what keeps a button inside a card from looking like it
// belongs to a different kit.
//
// `sharp` bottoms out at 4px rather than 0 because tokens.css derives --radius-sm as
// calc(var(--radius) - 4px); at 4px that lands on exactly 0, and anything lower goes negative,
// which browsers clamp silently and inconsistently.
export const RADIUS_STEPS: RadiusStep[] = [
    { id: "sharp", name: "Sharp", radius: "0.25rem", card: "0.375rem" },
    { id: "default", name: "Default", radius: "0.75rem", card: "1.125rem" },
    { id: "soft", name: "Soft", radius: "1rem", card: "1.5rem" },
    { id: "round", name: "Round", radius: "1.5rem", card: "2rem" },
];

export const DEFAULT_RADIUS_ID = "default";
export const radiusStepFor = (id: string): RadiusStep | undefined =>
    RADIUS_STEPS.find((r) => r.id === id);

// ── space axis ───────────────────────────────────────────────────────────────

export type SpaceStep = {
    id: string;
    name: string;
    /** What it does to a default <Button> (h-9), measured. */
    note: string;
    spacing: string;
};

// The three steps are deliberately narrow. --spacing multiplies EVERYTHING - control heights,
// gaps, page padding, icon boxes (size-4), rail widths - so the usable range is much smaller
// than it looks. Measured on a real h-9 button: 31.67px / 36.00px / 40.32px. A fourth step at
// 0.19rem gives a 27px control, which is below the 28px the icon-xs button already draws and
// starts failing pointer targets; 0.31rem pushes the rail past its own max-width.
export const SPACE_STEPS: SpaceStep[] = [
    { id: "compact", name: "Compact", note: "31.7px controls", spacing: "0.22rem" },
    {
        id: "default",
        name: "Default",
        note: "36px controls - the authored density",
        spacing: "0.25rem",
    },
    { id: "airy", name: "Airy", note: "40.3px controls", spacing: "0.28rem" },
];

export const DEFAULT_SPACE_ID = "default";
export const spaceStepFor = (id: string): SpaceStep | undefined =>
    SPACE_STEPS.find((s) => s.id === id);

// ── the preset ───────────────────────────────────────────────────────────────

export type ThemePreset = {
    id: string;
    name: string;
    /** One line on what it is for. Shown in the picker. */
    note: string;
    /** Colour axis, resolved to values - a custom preset has no palette to point at. */
    light: ThemePaletteColors;
    dark: ThemePaletteColors;
    /**
     * Which palette the colours came from, or CUSTOM_PRESET_ID once a picker has been dragged.
     * Provenance for the UI only; `light`/`dark` above are the truth.
     */
    palette: string;
    /** TYPE_PAIRINGS id. */
    type: string;
    /** RADIUS_STEPS id. */
    radius: string;
    /** SPACE_STEPS id. */
    space: string;
};

const bundle = (
    id: string,
    name: string,
    note: string,
    palette: string,
    type: string,
    radius: string,
    space: string,
): ThemePreset => {
    const p = themePaletteFor(palette) ?? THEME_PALETTES[0];
    return { id, name, note, light: p.light, dark: p.dark, palette, type, radius, space };
};

// THE SIX, and why each is a bundle rather than a colour.
//
// Paper is the authored theme on all four axes; it applies by clearing.
//
// Console and Technical share a density (compact) and a radius (sharp) because that IS the
// shape of a tool you sit in front of all day - the honest difference between them is voice,
// not measurement: Console is a neutral grey under a vivid blue with a geometric display, a
// thing you operate; Technical is instrumentation teal under Plex, a thing you read.
//
// Editorial and Soft share airy density and diverge on radius: Editorial's 16px/24px is a
// printed page, Soft's 24px/32px is a consumer app. Pairing a serif display with round
// corners is the one combination here that would be wrong, so Soft takes the high-contrast
// Instrument display instead of Fraunces' soft one.
//
// Mono is the achromatic palette at authored density with the one-family pairing: the only
// preset in which nothing - not colour, not type, not measurement - is making a claim.
export const THEME_PRESETS: ThemePreset[] = [
    bundle(
        "paper",
        "Paper",
        "The authored theme on every axis: cream, ink and terracotta, Inter over Space Grotesk, 12px corners. Selecting it removes every override rather than restating one.",
        DEFAULT_PALETTE_ID,
        "paper",
        "default",
        "default",
    ),
    bundle(
        "console",
        "Console",
        "An operator tool. Neutral grey under a vivid blue, geometric headings over Geist and Geist Mono, 4px corners, compact density.",
        "slate",
        "operator",
        "sharp",
        "compact",
    ),
    bundle(
        "editorial",
        "Editorial",
        "Long-form. Masthead red, Fraunces display serif, generous 16px/24px corners and airy spacing - a printed page, not a panel.",
        "claret",
        "fraunces",
        "soft",
        "airy",
    ),
    bundle(
        "technical",
        "Technical",
        "Docs and data. Instrumentation teal, IBM Plex Sans with a strong JetBrains mono, sharp corners and tight rows for tables you scan rather than read.",
        "teal",
        "plex",
        "sharp",
        "compact",
    ),
    bundle(
        "soft",
        "Soft",
        "A consumer surface. Warm gold on barely-warm paper, Instrument Serif headings, 24px/32px corners and airy spacing.",
        "ochre",
        "instrument",
        "round",
        "airy",
    ),
    bundle(
        "mono",
        "Mono",
        "Everything quiet. No hue anywhere, one type family in both roles, authored radius and density - the whole system saying nothing at all.",
        "graphite",
        "geist",
        "default",
        "default",
    ),
];

export const themePresetFor = (id: string): ThemePreset | undefined =>
    THEME_PRESETS.find((p) => p.id === id);

/**
 * The four colours that identify a theme at a glance - what the picker draws as a chip.
 * Page, paper, the soft brand fill and the brand: with the surfaces deliberately near-neutral,
 * a chip built from page/paper/line/brand would be three identical stops in every palette.
 *
 * Takes a preset OR a bare palette: the editor's colour chips draw the ten palettes, and a
 * palette is structurally the colour half of a preset.
 */
export const themePresetSwatch = (
    p: Pick<ThemePreset, "light" | "dark"> | ThemePalette,
    mode: "light" | "dark",
): string[] => [p[mode].background, p[mode].card, p[mode].accent, p[mode].primary];

// The colour tokens a preset owns. Anything not listed here - the status hues below, the type
// scale - is the same in every preset on purpose: it is the app's vocabulary, not its skin.
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

// The status hues are the SAME in every preset - they are the app's vocabulary, not its skin -
// but they are not the same in every MODE, so they have to be restated here.
//
// The reason is that .dark is a class on <html>, and a preview that draws a preset's dark mode
// inside a light page is not inside that class. Without these it would take the surfaces from
// the preset and the status hues from whatever mode the page happens to be in - a dark card
// with light-mode chips on it. Writing them makes themePresetStyle() a COMPLETE token set for
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
    // which puts white on mint at about 2:1 on a filled success button. A preset is allowed to
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

// Their tinted fills ARE re-mixed per preset, against the page - so a chip on Console's cold
// paper is a cold chip, not the cream one tokens.css authored for Paper.
const SOFT = ["success", "warning", "info", "approval", "neutral", "destructive"];

/**
 * Every property any axis can write. applyThemePreset() clears this list before writing, so a
 * property missing from it is a property that survives the switch back to Paper - a stuck
 * radius or a stuck font is the failure mode, and it is invisible until someone tries the
 * default and gets the last preset's measurements.
 */
const MANAGED = [
    ...VARS.map(([, v]) => v),
    ...Object.keys(STATUS.light),
    ...SOFT.map((s) => `--${s}-soft`),
    "--shadow-e1",
    "--shadow-e2",
    "--font-sans",
    "--font-display",
    "--font-mono",
    "--font-serif",
    "--radius",
    "--radius-card",
    "--spacing",
];

/**
 * Every token value for one preset in one mode, as a style object - all four axes.
 *
 * Complete on purpose: apply it to any element and that subtree is that theme in that mode,
 * whatever the page around it is doing. The controller writes it to <html>; the gallery writes
 * it to a card to show six presets' dark modes on a light page. Custom properties inherit, so
 * --spacing and --radius on a div re-measure everything inside it and nothing outside.
 */
export function themePresetStyle(
    preset: ThemePreset,
    mode: "light" | "dark",
): Record<string, string> {
    const colors = preset[mode];
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

    const type = typePairingFor(preset.type);
    if (type) {
        out["--font-sans"] = type.sans;
        out["--font-display"] = type.display;
        out["--font-mono"] = type.mono;
        out["--font-serif"] = type.serif;
    }
    const radius = radiusStepFor(preset.radius);
    if (radius) {
        out["--radius"] = radius.radius;
        out["--radius-card"] = radius.card;
    }
    const space = spaceStepFor(preset.space);
    if (space) out["--spacing"] = space.spacing;

    return out;
}

export type ThemePresetController = {
    getThemePresetId(): string;
    setThemePresetId(id: string): void;
    /** The user's own theme, or null if they have never opened the custom editor. */
    getCustomTheme(): ThemePreset | null;
    setCustomTheme(preset: ThemePreset): void;
    /** The preset in force, custom included. */
    getThemePreset(): ThemePreset;
    /** Re-write the vars for the theme currently on <html>. */
    applyThemePreset(): void;
    onThemePresetChange(fn: () => void): () => void;
    /** Apply now and keep applying across theme changes. Call once, at boot. Returns a teardown. */
    initThemePreset(): () => void;
};

const EVENT = "obp:themepresetchange";

export function createThemePresets(opts: { namespace?: string } = {}): ThemePresetController {
    const ns = opts.namespace ?? DEFAULT_NAMESPACE;
    // Deliberately NOT the old `${ns}-palette` keys. A stored palette has no type, radius or
    // space, so reviving one under the new type would hand every consumer a preset with three
    // undefined axes. A fresh key means an upgrading user lands back on Paper once, which is
    // the correct default, instead of on a half-built theme.
    const idKey = `${ns}-theme-preset`;
    const customKey = `${ns}-theme-custom`;

    function getCustomTheme(): ThemePreset | null {
        const raw = prefStorage().get(customKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Partial<ThemePreset>;
            if (!parsed?.light || !parsed?.dark) return null;
            // Normalise the three id axes rather than trusting them: a hand-edited value, or one
            // written by a build that named a pairing this one no longer ships, must degrade to
            // the authored step instead of writing `undefined` into a custom property.
            return {
                id: CUSTOM_PRESET_ID,
                name: parsed.name ?? "Custom",
                note: parsed.note ?? "Your theme.",
                light: parsed.light,
                dark: parsed.dark,
                palette: parsed.palette ?? CUSTOM_PRESET_ID,
                type: typePairingFor(parsed.type ?? "") ? (parsed.type as string) : "paper",
                radius: radiusStepFor(parsed.radius ?? "")
                    ? (parsed.radius as string)
                    : DEFAULT_RADIUS_ID,
                space: spaceStepFor(parsed.space ?? "")
                    ? (parsed.space as string)
                    : DEFAULT_SPACE_ID,
            };
        } catch {
            return null; // a hand-edited or half-written value must not brick the app
        }
    }

    function getThemePresetId(): string {
        const id = prefStorage().get(idKey);
        if (id === CUSTOM_PRESET_ID) return getCustomTheme() ? id : DEFAULT_PRESET_ID;
        return id && themePresetFor(id) ? id : DEFAULT_PRESET_ID;
    }

    function getThemePreset(): ThemePreset {
        const id = getThemePresetId();
        if (id === CUSTOM_PRESET_ID) {
            const custom = getCustomTheme();
            if (custom) return custom;
        }
        return themePresetFor(id) ?? THEME_PRESETS[0];
    }

    function applyThemePreset(): void {
        if (typeof document === "undefined") return;
        const el = document.documentElement;
        for (const v of MANAGED) el.style.removeProperty(v);
        const id = getThemePresetId();
        // Paper is the authored theme. Clearing IS applying it - and it cannot drift.
        if (id === DEFAULT_PRESET_ID) return;
        const mode = el.classList.contains("dark") ? "dark" : "light";
        const style = themePresetStyle(getThemePreset(), mode);
        for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
    }

    function announce(): void {
        applyThemePreset();
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
    }

    function setThemePresetId(id: string): void {
        if (id === DEFAULT_PRESET_ID) prefStorage().remove(idKey);
        else prefStorage().set(idKey, id);
        announce();
    }

    function setCustomTheme(preset: ThemePreset): void {
        prefStorage().set(customKey, JSON.stringify({ ...preset, id: CUSTOM_PRESET_ID }));
        prefStorage().set(idKey, CUSTOM_PRESET_ID);
        announce();
    }

    function onThemePresetChange(fn: () => void): () => void {
        window.addEventListener(EVENT, fn);
        return () => window.removeEventListener(EVENT, fn);
    }

    function initThemePreset(): () => void {
        applyThemePreset();
        if (typeof window === "undefined") return () => {};
        // The colour half is mode-specific, so a light/dark flip has to re-resolve it.
        return onThemeChange(applyThemePreset);
    }

    return {
        getThemePresetId,
        setThemePresetId,
        getCustomTheme,
        setCustomTheme,
        getThemePreset,
        applyThemePreset,
        onThemePresetChange,
        initThemePreset,
    };
}

/** Default controller, on the same namespace as the default theme controller. */
export const themePresets: ThemePresetController = createThemePresets();

export const {
    getThemePresetId,
    setThemePresetId,
    getCustomTheme,
    setCustomTheme,
    getThemePreset,
    applyThemePreset,
    onThemePresetChange,
    initThemePreset,
} = themePresets;
