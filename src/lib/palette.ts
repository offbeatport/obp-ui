export type ThemePaletteColors = {
    background: string;
    card: string;
    secondary: string;
    foreground: string;
    mutedForeground: string;
    faint: string;
    border: string;
    borderSoft: string;
    input: string;
    inputBackground?: string;
    tabsBackground?: string;
    tabsActive?: string;
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

import { hexToHsv, hsvToHex } from "./color";

type Ladder = Record<keyof NeutralSlots, readonly [number, number]>;

export type NeutralSlots = Pick<
    ThemePaletteColors,
    | "background"
    | "card"
    | "secondary"
    | "foreground"
    | "mutedForeground"
    | "faint"
    | "border"
    | "borderSoft"
    | "input"
>;

const LIGHT_LADDER: Ladder = {
    card: [1.0, 0.0039],
    background: [0.9608, 0.0041],
    secondary: [0.9294, 0.0042],
    borderSoft: [0.898, 0.0044],
    border: [0.8353, 0.0093],
    input: [0.545, 0.02],
    faint: [0.4275, 0.0183],
    mutedForeground: [0.3294, 0.0119],
    foreground: [0.1294, 0.0303],
};

const DARK_LADDER: Ladder = {
    foreground: [0.9176, 0.0085],
    mutedForeground: [0.6588, 0.012],
    faint: [0.549, 0.0213],
    input: [0.47, 0.06],
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

export type BrandColors = NeutralSlots & {
    primary: string;
    accent: string;
    accentForeground: string;
};

export type BrandSpec = {
    id: string;
    name: string;
    note: string;
    light: BrandColors;
    dark: Omit<BrandColors, "accent"> & { washAlpha?: number };
};

export function brandPalette(spec: BrandSpec): ThemePalette {
    const { washAlpha = 0.18, ...dark } = spec.dark;
    const darkPrimary = hexToHsv(dark.primary);
    const fg = spec.light.foreground.replace("#", "");
    const tone = [0, 1, 2].map((i) => Number.parseInt(fg.slice(i * 2, i * 2 + 2), 16) + 6);
    return {
        id: spec.id,
        name: spec.name,
        note: spec.note,
        light: { ...spec.light, primaryForeground: "#ffffff", shadowTint: tone.join(", ") },
        dark: {
            ...dark,
            primaryForeground: hsvToHex({
                h: darkPrimary?.h ?? 0,
                s: Math.min(darkPrimary?.s ?? 0, 0.0435),
                v: 0.0941,
            }),
            accent: `rgba(${hexToRgbTriplet(dark.primary)}, ${washAlpha})`,
        },
    };
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

export const DEFAULT_PALETTE_ID = "slate";

export const THEME_PALETTES: [ThemePalette, ...ThemePalette[]] = [
    makePalette({
        id: "slate",
        name: "Slate",
        note: "The default: neutral grey paper under a vivid classic blue, so the interface disappears behind the work. Selecting it removes every override rather than restating one.",
        tint: 1,
        light: {
            primary: "#1c6be0",
            accent: "#cfe1fd",
            accentForeground: "#174ea1",
        },
        dark: {
            primary: "#8eb7f8",
            accentForeground: "#b8d1f8",
        },
    }),
    {
        id: "terracotta",
        name: "Terracotta",
        note: "The original authored theme: cream, ink and terracotta.",
        light: {
            background: "#f7f3ec",
            card: "#fffdf8",
            secondary: "#f1ebe0",
            foreground: "#2c2926",
            mutedForeground: "#635c52",
            faint: "#7b7368",
            border: "#e6ddce",
            borderSoft: "#efe8da",
            input: "#908a81",
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
            input: "#5f6473",
            primary: "#e0794c",
            primaryForeground: "#ffffff",
            accent: "rgba(224, 121, 78, 0.18)",
            accentForeground: "#f0a07e",
        },
    },
    {
        id: "cobalt",
        name: "Cobalt",
        note: "Cool neutral paper under a clear blue, then a black page and a solid navy accent after dark.",
        light: {
            background: "#f4f5f5",
            card: "#feffff",
            secondary: "#eceded",
            foreground: "#202121",
            mutedForeground: "#535454",
            faint: "#6b6c6d",
            border: "#d3d4d5",
            borderSoft: "#e4e5e5",
            input: "#8a8c8d",
            primary: "#026ecd",
            primaryForeground: "#ffffff",
            accent: "#b8d7f2",
            accentForeground: "#015aa7",
            shadowTint: "38, 39, 39",
        },
        dark: {
            background: "#010101",
            card: "#060606",
            secondary: "#191a20",
            foreground: "#e8e9ea",
            mutedForeground: "#a6a7a8",
            faint: "#7f8182",
            border: "#131416",
            borderSoft: "#060606",
            input: "#1e222c",
            inputBackground: "#0f0f14",
            primary: "#346bf1",
            primaryForeground: "#ffffff",
            accent: "#111216",
            accentForeground: "#ffffff",
        },
    },
    brandPalette({
        id: "vercel",
        name: "Vercel",
        note: "Pure black on pure white, and the brand is the contrast itself. No hue anywhere, hairline borders, and a primary that is simply ink.",
        light: {
            background: "#fafafa",
            card: "#ffffff",
            secondary: "#f2f2f2",
            borderSoft: "#ebebeb",
            input: "#909090",
            border: "#e0e0e0",
            faint: "#6f6f6f",
            mutedForeground: "#525252",
            foreground: "#171717",
            primary: "#000000",
            accent: "#ededed",
            accentForeground: "#171717",
        },
        dark: {
            background: "#000000",
            card: "#0a0a0a",
            secondary: "#050505",
            borderSoft: "#1a1a1a",
            input: "#5e5e5e",
            border: "#2e2e2e",
            faint: "#8f8f8f",
            mutedForeground: "#a1a1a1",
            foreground: "#ededed",
            primary: "#ffffff",
            accentForeground: "#ededed",
            washAlpha: 0.14,
        },
    }),
    brandPalette({
        id: "linear",
        name: "Linear",
        note: "Cold near-black under a soft indigo. The dark mode is the real one - #08090a page, #0f1011 panels - and the light mode is its inverse, not a different design.",
        light: {
            background: "#fcfcfd",
            card: "#ffffff",
            secondary: "#f4f5f8",
            borderSoft: "#eceef3",
            input: "#8f9196",
            border: "#dfe1e8",
            faint: "#6b7080",
            mutedForeground: "#575d6b",
            foreground: "#08090a",
            primary: "#5058c4",
            accent: "#e5e7fb",
            accentForeground: "#414bab",
        },
        dark: {
            background: "#08090a",
            card: "#0f1011",
            secondary: "#0b0c0d",
            borderSoft: "#191a1c",
            input: "#616265",
            border: "#26282c",
            faint: "#868b94",
            mutedForeground: "#a4a9b3",
            foreground: "#f7f8f8",
            primary: "#7e87ff",
            accentForeground: "#b8bdff",
        },
    }),
    brandPalette({
        id: "github",
        name: "GitHub",
        note: "Blue-grey institutional neutrals and a link blue that has to work as text before it works as a button. The densest of the set.",
        light: {
            background: "#f6f8fa",
            card: "#ffffff",
            secondary: "#eaeef2",
            borderSoft: "#e4e9ee",
            input: "#888e95",
            border: "#d1d9e0",
            faint: "#6a737d",
            mutedForeground: "#59636e",
            foreground: "#1f2328",
            primary: "#0969da",
            accent: "#ddf4ff",
            accentForeground: "#0550ae",
        },
        dark: {
            background: "#0d1117",
            card: "#151b23",
            secondary: "#10141a",
            borderSoft: "#21262d",
            input: "#616870",
            border: "#3d444d",
            faint: "#868e99",
            mutedForeground: "#9198a1",
            foreground: "#f0f6fc",
            primary: "#4493f8",
            accentForeground: "#79c0ff",
        },
    }),
    brandPalette({
        id: "x",
        name: "X",
        note: "Black page, near-black cards, one sky blue doing every job. Light mode darkens that blue to 4.8:1 - the brand hue at 2.8:1 on white is a logo colour, not a link colour.",
        light: {
            background: "#f7f9f9",
            card: "#ffffff",
            secondary: "#eff3f4",
            borderSoft: "#e9eef0",
            input: "#889095",
            border: "#cfd9de",
            faint: "#66727d",
            mutedForeground: "#536471",
            foreground: "#0f1419",
            primary: "#0b73b2",
            accent: "#dcf0fb",
            accentForeground: "#0b5c94",
        },
        dark: {
            background: "#000000",
            card: "#16181c",
            secondary: "#0a0b0d",
            borderSoft: "#202327",
            input: "#636668",
            border: "#2f3336",
            faint: "#838b93",
            mutedForeground: "#a2abb3",
            foreground: "#e7e9ea",
            primary: "#1d9bf0",
            accentForeground: "#6cc0f7",
        },
    }),
    brandPalette({
        id: "hyperagent",
        name: "Hyperagent",
        note: "The agent-tool reading: a green-black terminal canvas and an acid lime signal. Light mode keeps the hue and drops it to moss so it can carry text.",
        light: {
            background: "#f6f7f3",
            card: "#ffffff",
            secondary: "#eceee6",
            borderSoft: "#e4e7dd",
            input: "#8c8f84",
            border: "#d5d9cb",
            faint: "#6b7060",
            mutedForeground: "#55594b",
            foreground: "#14170f",
            primary: "#4d7c0f",
            accent: "#e2f0c8",
            accentForeground: "#3b6109",
        },
        dark: {
            background: "#060807",
            card: "#0d100e",
            secondary: "#090b0a",
            borderSoft: "#171b18",
            input: "#5c625c",
            border: "#232823",
            faint: "#838d80",
            mutedForeground: "#a3ada0",
            foreground: "#e8f0e6",
            primary: "#a3e635",
            accentForeground: "#bef264",
            washAlpha: 0.16,
        },
    }),
    brandPalette({
        id: "supabase",
        name: "Supabase",
        note: "Achromatic greys with a single emerald. Dark is a soft #121212 rather than black, so the green is the only thing in the frame with a hue.",
        light: {
            background: "#fbfcfb",
            card: "#ffffff",
            secondary: "#f2f4f2",
            borderSoft: "#e9ece9",
            input: "#8f9290",
            border: "#dcdfdc",
            faint: "#6e756f",
            mutedForeground: "#545a55",
            foreground: "#171a18",
            primary: "#0f7a52",
            accent: "#cdf0e0",
            accentForeground: "#0b5c3e",
        },
        dark: {
            background: "#121212",
            card: "#1c1c1c",
            secondary: "#171717",
            borderSoft: "#262626",
            input: "#686868",
            border: "#343434",
            faint: "#8b8b8b",
            mutedForeground: "#a8a8a8",
            foreground: "#ededed",
            primary: "#3ecf8e",
            accentForeground: "#6ee7b7",
        },
    }),
    brandPalette({
        id: "stripe",
        name: "Stripe",
        note: "The marketing-site one: blue-tinted paper, navy ink and a violet primary. The only palette here whose light mode is the designed one.",
        light: {
            background: "#f6f9fc",
            card: "#ffffff",
            secondary: "#eaf0f6",
            borderSoft: "#e3eaf2",
            input: "#8091a2",
            border: "#d6dfe9",
            faint: "#5c7186",
            mutedForeground: "#425466",
            foreground: "#0a2540",
            primary: "#5b52f0",
            accent: "#e3e1ff",
            accentForeground: "#4038c9",
        },
        dark: {
            background: "#0b1020",
            card: "#131a2f",
            secondary: "#0e1426",
            borderSoft: "#1c2440",
            input: "#616880",
            border: "#2a3352",
            faint: "#8a94ad",
            mutedForeground: "#a9b3c9",
            foreground: "#eef1f8",
            primary: "#9b8cff",
            accentForeground: "#c3b9ff",
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

const RENAMED_PALETTES: Record<string, string> = { paper: "terracotta" };

export const themePaletteFor = (id: string): ThemePalette | undefined =>
    THEME_PALETTES.find((p) => p.id === (RENAMED_PALETTES[id] ?? id));
