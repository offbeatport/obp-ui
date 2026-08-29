export type ThemePaletteColors = {
    background: string;
    card: string;
    secondary: string;
    foreground: string;
    mutedForeground: string;
    faint: string;
    border: string;
    borderSoft: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    shadowTint?: string;
};

export type ThemePalette = {
    id: string;
    name: string;
    note: string;
    light: ThemePaletteColors;
    dark: ThemePaletteColors;
};

import { hexToHsv, hsvToHex, rgbToHex } from "./color";

type Ladder = Record<keyof NeutralSlots, readonly [number, number]>;

type NeutralSlots = Pick<
    ThemePaletteColors,
    | "background"
    | "card"
    | "secondary"
    | "foreground"
    | "mutedForeground"
    | "faint"
    | "border"
    | "borderSoft"
>;

const LIGHT_LADDER: Ladder = {
    card: [1.0, 0.0039],
    background: [0.9608, 0.0041],
    secondary: [0.9294, 0.0042],
    borderSoft: [0.898, 0.0044],
    border: [0.8353, 0.0093],
    faint: [0.4275, 0.0183],
    mutedForeground: [0.3294, 0.0119],
    foreground: [0.1294, 0.0303],
};

const DARK_LADDER: Ladder = {
    foreground: [0.9176, 0.0085],
    mutedForeground: [0.6588, 0.012],
    faint: [0.549, 0.0213],
    border: [0.2235, 0.0517],
    borderSoft: [0.1569, 0.05],
    card: [0.1294, 0.0588],
    secondary: [0.0784, 0.05],
    background: [0.0431, 0.0909],
};

export type PaletteSpec = {
    id: string;
    name: string;
    note: string;
    tint?: number;
    light: { primary: string; accent: string; accentForeground: string };
    dark: { primary: string; accentForeground: string; washAlpha?: number };
};

function neutrals(hue: number, ladder: Ladder, tint: number): NeutralSlots {
    const out = {} as NeutralSlots;
    for (const key of Object.keys(ladder) as (keyof NeutralSlots)[]) {
        const [v, s] = ladder[key];
        out[key] = hsvToHex({ h: hue, s: s * tint, v });
    }
    return out;
}

export function makePalette(spec: PaletteSpec): ThemePalette {
    const tint = spec.tint ?? 1;
    const lightHue = hexToHsv(spec.light.primary)?.h ?? 0;
    const darkPrimary = hexToHsv(spec.dark.primary);
    const darkHue = darkPrimary?.h ?? 0;
    const light = neutrals(lightHue, LIGHT_LADDER, tint);
    const dark = neutrals(darkHue, DARK_LADDER, tint);
    const fg = light.foreground.replace("#", "");
    const tone = [0, 1, 2].map((i) => Number.parseInt(fg.slice(i * 2, i * 2 + 2), 16) + 6);
    const wash = darkPrimary
        ? hexToRgbTriplet(hsvToHex(darkPrimary))
        : hexToRgbTriplet(spec.dark.primary);
    return {
        id: spec.id,
        name: spec.name,
        note: spec.note,
        light: {
            ...light,
            primary: spec.light.primary,
            primaryForeground: "#ffffff",
            accent: spec.light.accent,
            accentForeground: spec.light.accentForeground,
            shadowTint: tone.join(", "),
        },
        dark: {
            ...dark,
            primary: spec.dark.primary,
            primaryForeground: hsvToHex({ h: darkHue, s: 0.0435 * tint, v: 0.0941 }),
            accent: `rgba(${wash}, ${spec.dark.washAlpha ?? 0.18})`,
            accentForeground: spec.dark.accentForeground,
        },
    };
}

function hexToRgbTriplet(hex: string): string {
    const h = hex.replace("#", "");
    return [0, 1, 2].map((i) => Number.parseInt(h.slice(i * 2, i * 2 + 2), 16)).join(", ");
}

export const DEFAULT_PALETTE_ID = "paper";

export const THEME_PALETTES: [ThemePalette, ...ThemePalette[]] = [
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
    makePalette({
        id: "slate",
        name: "Slate",
        note: "Neutral grey paper under a vivid classic blue. The safest of the ten - reach for it when the interface should disappear behind the work.",
        tint: 1,
        light: {
            primary: "#1c6be0",
            accent: "#d1e0fd",
            accentForeground: "#174ea1",
        },
        dark: {
            primary: "#8eb7f8",
            accentForeground: "#b8d1f8",
        },
    }),
    makePalette({
        id: "graphite",
        name: "Graphite",
        note: "No hue anywhere. Black ink, white paper, and the brand is the ink - the Swiss poster reading of a UI, and the only palette that cannot age.",
        tint: 0,
        light: {
            primary: "#232323",
            accent: "#e4e4e4",
            accentForeground: "#414141",
        },
        dark: {
            primary: "#ededed",
            accentForeground: "#cccccc",
            washAlpha: 0.16,
        },
    }),
    makePalette({
        id: "indigo",
        name: "Indigo",
        note: "Cool-neutral paper and a saturated indigo. Reads as considered rather than corporate, and holds up on a projector.",
        tint: 1,
        light: {
            primary: "#7e4df2",
            accent: "#e1dafc",
            accentForeground: "#5a26ba",
        },
        dark: {
            primary: "#b6a9f8",
            accentForeground: "#cfc9f8",
        },
    }),
    makePalette({
        id: "pine",
        name: "Pine",
        note: "Warm-neutral paper with a strong forest green. Calm without going herbal - the least tiring of the ten over a long session.",
        tint: 1,
        light: {
            primary: "#208046",
            accent: "#c5ebd1",
            accentForeground: "#1d6236",
        },
        dark: {
            primary: "#3bd678",
            accentForeground: "#54f28e",
        },
    }),
    makePalette({
        id: "olive",
        name: "Olive",
        note: "Bone paper and a sharp olive. Utilitarian in the good sense: field notebook, not dashboard.",
        tint: 1,
        light: {
            primary: "#63781c",
            accent: "#d8e6c3",
            accentForeground: "#4a5a19",
        },
        dark: {
            primary: "#a4c634",
            accentForeground: "#bce14c",
        },
    }),
    makePalette({
        id: "ochre",
        name: "Ochre",
        note: "Barely-warm paper and a rich gold. Carries warmth without the terracotta the default already owns.",
        tint: 1,
        light: {
            primary: "#93681c",
            accent: "#f0ddc0",
            accentForeground: "#6b4c18",
        },
        dark: {
            primary: "#eba733",
            accentForeground: "#f8c67c",
        },
    }),
    makePalette({
        id: "claret",
        name: "Claret",
        note: "Off-white with a full-blooded crimson. The editorial one - masthead red, dark enough to sit under body text.",
        tint: 1,
        light: {
            primary: "#d7282d",
            accent: "#fdd5cf",
            accentForeground: "#942021",
        },
        dark: {
            primary: "#f9978e",
            accentForeground: "#f8bfb9",
        },
    }),
    makePalette({
        id: "aubergine",
        name: "Aubergine",
        note: "Neutral paper and a deep magenta-purple. The most distinctive at a glance, and still quiet at arm's length.",
        tint: 1,
        light: {
            primary: "#c328b0",
            accent: "#fecff0",
            accentForeground: "#851f77",
        },
        dark: {
            primary: "#f985e5",
            accentForeground: "#f8b7eb",
        },
    }),
    makePalette({
        id: "teal",
        name: "Teal",
        note: "Cool-neutral paper and a saturated teal. The one that stays legible under fluorescent light and on a washed-out screen.",
        tint: 1,
        light: {
            primary: "#207c7b",
            accent: "#c6e7e7",
            accentForeground: "#1d5e5c",
        },
        dark: {
            primary: "#3bcecb",
            accentForeground: "#54e9e6",
        },
    }),
];

export const themePaletteFor = (id: string): ThemePalette | undefined =>
    THEME_PALETTES.find((p) => p.id === id);
