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

export type TypePairing = {
    id: string;
    name: string;
    note: string;
    sans: string;
    display: string;
    mono: string;
    serif: string;
};

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
        id: "inter",
        name: "Inter",
        note: "Inter in both roles with JetBrains Mono. The product-UI default of the last decade: it says nothing, which is the job when the palette is doing the talking.",
        sans: INTER,
        display: INTER,
        mono: JETBRAINS,
        serif: SPECTRAL,
    },
    {
        id: "terminal",
        name: "Terminal",
        note: "Mono headings over a Geist body. Every heading reads as output from something rather than as a title.",
        sans: GEIST,
        display: JETBRAINS,
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

export type RadiusStep = {
    id: string;
    name: string;
    radius: string;
    card: string;
};

export const RADIUS_STEPS: RadiusStep[] = [
    { id: "sharp", name: "Sharp", radius: "0.25rem", card: "0.375rem" },
    { id: "tight", name: "Tight", radius: "0.5rem", card: "0.75rem" },
    { id: "default", name: "Default", radius: "0.75rem", card: "1.125rem" },
    { id: "soft", name: "Soft", radius: "1rem", card: "1.5rem" },
    { id: "round", name: "Round", radius: "1.5rem", card: "2rem" },
];

export const DEFAULT_RADIUS_ID = "default";
export const radiusStepFor = (id: string): RadiusStep | undefined =>
    RADIUS_STEPS.find((r) => r.id === id);

export type SpaceStep = {
    id: string;
    name: string;
    note: string;
    spacing: string;
};

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

export const STATUS_KEYS = [
    "success",
    "warning",
    "info",
    "approval",
    "neutral",
    "destructive",
] as const;

export type StatusKey = (typeof STATUS_KEYS)[number];

export type StatusColors = Partial<Record<StatusKey | `${StatusKey}Foreground`, string>>;

export type ThemeStatus = { light?: StatusColors; dark?: StatusColors };

export type ThemePreset = {
    id: string;
    name: string;
    note: string;
    light: ThemePaletteColors;
    dark: ThemePaletteColors;
    palette: string;
    type: string;
    radius: string;
    space: string;
    status?: ThemeStatus;
};

const statusVar = (key: string): string =>
    key.endsWith("Foreground") ? `--${key.slice(0, -"Foreground".length)}-foreground` : `--${key}`;

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

export function makePreset(
    palette: ThemePalette,
    axes: { type?: string; radius?: string; space?: string } = {},
): ThemePreset {
    return {
        id: palette.id,
        name: palette.name,
        note: palette.note,
        light: palette.light,
        dark: palette.dark,
        palette: palette.id,
        type: typePairingFor(axes.type ?? "") ? (axes.type as string) : "paper",
        radius: radiusStepFor(axes.radius ?? "") ? (axes.radius as string) : DEFAULT_RADIUS_ID,
        space: spaceStepFor(axes.space ?? "") ? (axes.space as string) : DEFAULT_SPACE_ID,
    };
}

export const THEME_PRESETS: [ThemePreset, ...ThemePreset[]] = [
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
        "vercel",
        "Vercel",
        "Black and white with nothing between them. Geist in both roles over Geist Mono, 4px/6px corners, compact density - the developer-platform reading.",
        "vercel",
        "geist",
        "sharp",
        "compact",
    ),
    bundle(
        "linear",
        "Linear",
        "The issue-tracker reading. Cold near-black and a soft indigo, Inter throughout, 8px/12px corners and compact rows.",
        "linear",
        "inter",
        "tight",
        "compact",
    ),
    bundle(
        "github",
        "GitHub",
        "Blue-grey institutional neutrals under a link blue, the authored Inter/Space Grotesk pairing, 4px/6px corners and compact rows for tables you scan.",
        "github",
        "paper",
        "sharp",
        "compact",
    ),
    bundle(
        "x",
        "X",
        "The social reading: black page, one sky blue, Inter, and 24px/32px corners - the only preset whose shapes are as loud as its colour.",
        "x",
        "inter",
        "round",
        "default",
    ),
    bundle(
        "hyperagent",
        "Hyperagent",
        "An agent terminal. Green-black canvas, acid lime signal, JetBrains Mono headings over a Geist body, 4px corners and compact density.",
        "hyperagent",
        "terminal",
        "sharp",
        "compact",
    ),
    bundle(
        "supabase",
        "Supabase",
        "Achromatic greys and a single emerald, Inter throughout, 8px/12px corners at the authored density. A dashboard that lets one hue do all the work.",
        "supabase",
        "inter",
        "tight",
        "default",
    ),
    bundle(
        "stripe",
        "Stripe",
        "The marketing-site reading. Blue-tinted paper, navy ink, a violet primary, 16px/24px corners and airy spacing.",
        "stripe",
        "inter",
        "soft",
        "airy",
    ),
];

export const themePresetFor = (id: string): ThemePreset | undefined =>
    THEME_PRESETS.find((p) => p.id === id);

export const themePresetSwatch = (
    p: Pick<ThemePreset, "light" | "dark"> | ThemePalette,
    mode: "light" | "dark",
): string[] => [p[mode].background, p[mode].card, p[mode].accent, p[mode].primary];

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

const SOFT = ["success", "warning", "info", "approval", "neutral", "destructive"];

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

export function themePresetStyle(
    preset: ThemePreset,
    mode: "light" | "dark",
): Record<string, string> {
    const colors = preset[mode];
    const out: Record<string, string> = { ...STATUS[mode] };
    for (const [key, value] of Object.entries(preset.status?.[mode] ?? {})) {
        if (value) out[statusVar(key)] = value;
    }
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
    getCustomTheme(): ThemePreset | null;
    setCustomTheme(preset: ThemePreset): void;
    getThemePreset(): ThemePreset;
    applyThemePreset(): void;
    onThemePresetChange(fn: () => void): () => void;
    initThemePreset(): () => void;
};

const EVENT = "obp:themepresetchange";

export function createThemePresets(opts: { namespace?: string } = {}): ThemePresetController {
    const ns = opts.namespace ?? DEFAULT_NAMESPACE;
    const idKey = `${ns}-theme-preset`;
    const customKey = `${ns}-theme-custom`;

    function getCustomTheme(): ThemePreset | null {
        const raw = prefStorage().get(customKey);
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw) as Partial<ThemePreset>;
            if (!parsed?.light || !parsed?.dark) return null;
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
                status: parsed.status,
            };
        } catch {
            return null;
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
