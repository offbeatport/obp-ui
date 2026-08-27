import { BackgroundVariant } from "@xyflow/react";
import type { CSSProperties } from "react";

// ============================================================================
// FLAVORS - the visual "skin" a canvas variant wears. A flavor owns the frame
// (card border/fill/shadow), the edges, the background grid and the viewport
// backdrop. Node RENDERERS are shared; a flavor only restyles them, so the 10
// canvas layouts get real visual range from just layout × flavor.
//
// `accent` is a function of the node's KIND STRING, not of any app enum: a
// flavor ships a sensible single-colour default and an app layers its own
// kind → colour palette on top with `withAccents()`.
// ============================================================================

export type FlavorKey = "paper" | "editorial" | "blueprint" | "mono" | "neon" | "soft";

export type FlavorEdge = {
    type: "smoothstep" | "step" | "straight" | "bezier" | "default";
    animated: boolean;
    dash?: string;
    stroke: string;
    width: number;
};

/** kind → accent colour. Kinds are plain strings so any app's node vocabulary fits. */
export type FlavorAccent = (kind: string) => string;

export type Flavor = {
    key: FlavorKey;
    dark: boolean; // force a dark backdrop regardless of theme
    container: string; // classes on the RF wrapper (backdrop)
    bg: { variant: BackgroundVariant; gap: number; size: number; color: string } | null;
    edge: FlavorEdge;
    // Per-kind accent → a CSS colour string (theme token). Layer an app palette on
    // top with `withAccents(flavor, { idea: "var(--primary)", … })`.
    accent: FlavorAccent;
    // The card frame, computed from the node's accent colour.
    frame: (accent: string) => CSSProperties;
    // Shared text classes for the node internals.
    eyebrow: string;
    title: string;
    sub: string;
    chip: string;
    radius: string; // corner class, e.g. "rounded-[14px]"
};

export const FLAVORS: Record<FlavorKey, Flavor> = {
    // Default paper theme - matches the live company canvas.
    paper: {
        key: "paper",
        dark: false,
        container: "",
        bg: { variant: BackgroundVariant.Dots, gap: 34, size: 1.4, color: "var(--rf-dot)" },
        edge: {
            type: "smoothstep",
            animated: false,
            dash: "5 7",
            stroke: "var(--rf-edge)",
            width: 1.4,
        },
        accent: () => "var(--primary)",
        frame: () => ({
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-mono text-sm font-bold uppercase tracking-[0.12em]",
        title: "text-sm font-semibold text-foreground",
        sub: "text-sm leading-[1.45] text-muted-foreground",
        chip: "rounded-[6px] bg-secondary px-1.5 py-0.5 font-mono text-sm text-faint",
        radius: "rounded-[14px]",
    },
    // Editorial - a lighter, airier card with a coloured top hairline.
    editorial: {
        key: "editorial",
        dark: false,
        container: "",
        bg: { variant: BackgroundVariant.Dots, gap: 40, size: 1, color: "var(--rf-dot)" },
        edge: { type: "step", animated: false, stroke: "var(--rf-edge)", width: 1.5 },
        accent: () => "var(--primary)",
        frame: (a) => ({
            background: "var(--card)",
            border: "1px solid var(--border-soft)",
            borderTop: `3px solid ${a}`,
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-display text-sm font-semibold uppercase tracking-[0.16em]",
        title: "font-display text-base font-medium text-foreground",
        sub: "text-sm leading-[1.5] text-muted-foreground",
        chip: "rounded-full border border-border-soft px-2 py-0.5 font-mono text-sm text-faint",
        radius: "rounded-[4px]",
    },
    // Blueprint - schematic, monospace, thin square frames on a cross grid.
    blueprint: {
        key: "blueprint",
        dark: true,
        container:
            "bg-[#0c1524] [--rf-dot:rgba(120,170,255,0.18)] [--rf-edge:rgba(120,170,255,0.5)]",
        bg: { variant: BackgroundVariant.Cross, gap: 26, size: 4, color: "rgba(120,170,255,0.14)" },
        edge: {
            type: "step",
            animated: false,
            dash: "2 4",
            stroke: "rgba(120,170,255,0.55)",
            width: 1,
        },
        accent: () => "#8fb8ff",
        frame: (a) => ({
            background: "rgba(14,26,46,0.82)",
            border: `1px solid ${a}`,
            boxShadow: "0 0 0 1px rgba(120,170,255,0.08), 0 10px 30px rgba(0,0,0,0.5)",
            color: "#cfe0ff",
        }),
        eyebrow: "font-mono text-sm font-bold uppercase tracking-[0.2em]",
        title: "font-mono text-sm font-semibold text-[#eaf1ff]",
        sub: "font-mono text-sm leading-[1.5] text-[#9db6e0]",
        chip: "rounded-[2px] border border-[rgba(120,170,255,0.35)] px-1.5 py-0.5 font-mono text-sm text-[#9db6e0]",
        radius: "rounded-[3px]",
    },
    // Mono - quiet, borderless-ish, tight grid; lets the layout do the talking.
    mono: {
        key: "mono",
        dark: false,
        container: "",
        bg: { variant: BackgroundVariant.Lines, gap: 44, size: 1, color: "var(--border-soft)" },
        edge: { type: "straight", animated: false, stroke: "var(--rf-edge)", width: 1.2 },
        accent: () => "var(--primary)",
        frame: (a) => ({
            background: "var(--card)",
            border: "1px solid var(--border-soft)",
            borderLeft: `3px solid ${a}`,
            boxShadow: "none",
        }),
        eyebrow: "font-mono text-sm font-medium uppercase tracking-[0.14em]",
        title: "text-sm font-semibold text-foreground",
        sub: "text-sm leading-[1.45] text-muted-foreground",
        chip: "rounded-[5px] bg-secondary px-1.5 py-0.5 font-mono text-sm text-faint",
        radius: "rounded-[8px]",
    },
    // Neon - the cofounder.ai board: dark glass, glowing accents, animated edges.
    neon: {
        key: "neon",
        dark: true,
        container:
            "bg-[radial-gradient(120%_120%_at_20%_0%,#141a2e_0%,#0a0d18_55%,#06070d_100%)] [--rf-edge:rgba(150,130,255,0.55)]",
        bg: {
            variant: BackgroundVariant.Dots,
            gap: 30,
            size: 1.4,
            color: "rgba(150,160,255,0.14)",
        },
        edge: { type: "bezier", animated: true, stroke: "rgba(150,130,255,0.6)", width: 1.6 },
        accent: () => "#8b7bff",
        frame: (a) => ({
            background: "rgba(20,24,40,0.72)",
            border: `1px solid ${a}66`,
            boxShadow: `0 0 0 1px ${a}22, 0 0 26px -6px ${a}, 0 18px 50px rgba(0,0,0,0.6)`,
            backdropFilter: "blur(6px)",
            color: "#e7ebfb",
        }),
        eyebrow: "font-mono text-sm font-bold uppercase tracking-[0.16em]",
        title: "text-sm font-semibold text-[#f2f4ff]",
        sub: "text-sm leading-[1.45] text-[#aeb6d8]",
        chip: "rounded-full border border-[rgba(150,160,255,0.28)] bg-[rgba(150,160,255,0.08)] px-2 py-0.5 font-mono text-sm text-[#c3c9e8]",
        radius: "rounded-[16px]",
    },
    // Soft - rounded, pastel-tinted cards on a plain field (kanban feel).
    soft: {
        key: "soft",
        dark: false,
        container: "bg-secondary/40",
        bg: null,
        edge: { type: "straight", animated: false, stroke: "var(--border)", width: 1.5 },
        accent: () => "var(--primary)",
        frame: (a) => ({
            background: `color-mix(in srgb, ${a} 7%, var(--card))`,
            border: `1px solid color-mix(in srgb, ${a} 28%, var(--border))`,
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-mono text-sm font-bold uppercase tracking-[0.12em]",
        title: "text-sm font-semibold text-foreground",
        sub: "text-sm leading-[1.45] text-muted-foreground",
        chip: "rounded-full bg-card px-2 py-0.5 font-mono text-sm text-faint",
        radius: "rounded-[18px]",
    },
};

/**
 * Layer an app's kind → colour palette onto a flavor. Kinds the map doesn't mention
 * fall through to the flavor's own default accent, so a partial map is fine.
 */
export function withAccents(flavor: Flavor, accents: Record<string, string>): Flavor {
    return { ...flavor, accent: (kind) => accents[kind] ?? flavor.accent(kind) };
}

/**
 * `withAccents` across a whole flavor set - the usual way an app skins the kit once.
 * `shared` applies to every flavor; `perFlavor` overrides it for the flavors that
 * carry their own palette (blueprint's cool company blue, neon's hex set).
 */
export function withAccentPalette(
    flavors: Record<FlavorKey, Flavor>,
    shared: Record<string, string>,
    perFlavor: Partial<Record<FlavorKey, Record<string, string>>> = {},
): Record<FlavorKey, Flavor> {
    const out = {} as Record<FlavorKey, Flavor>;
    for (const key of Object.keys(flavors) as FlavorKey[]) {
        out[key] = withAccents(flavors[key], { ...shared, ...perFlavor[key] });
    }
    return out;
}
