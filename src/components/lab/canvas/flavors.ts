import { BackgroundVariant } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { LabKind } from "~/lab/graph";

// ============================================================================
// FLAVORS - the visual "skin" a canvas variant wears. A flavor owns the frame
// (card border/fill/shadow), the edges, the background grid and the viewport
// backdrop. Node RENDERERS are shared (nodes.tsx); a flavor only restyles them,
// so the 10 canvas variants get real visual range from just layout × flavor.
// ============================================================================

export type FlavorKey = "paper" | "editorial" | "blueprint" | "mono" | "neon" | "soft";

export type FlavorEdge = {
    type: "smoothstep" | "step" | "straight" | "bezier" | "default";
    animated: boolean;
    dash?: string;
    stroke: string;
    width: number;
};

export type Flavor = {
    key: FlavorKey;
    dark: boolean; // force a dark backdrop regardless of theme
    container: string; // classes on the RF wrapper (backdrop)
    bg: { variant: BackgroundVariant; gap: number; size: number; color: string } | null;
    edge: FlavorEdge;
    // Per-kind accent → a CSS colour string (theme token).
    accent: (kind: LabKind) => string;
    // The card frame, computed from the node's accent colour.
    frame: (accent: string) => CSSProperties;
    // Shared text classes for the node internals.
    eyebrow: string;
    title: string;
    sub: string;
    chip: string;
    radius: string; // corner class, e.g. "rounded-[14px]"
};

const ACCENT: Record<LabKind, string> = {
    idea: "var(--primary)",
    opportunity: "var(--warning)",
    company: "var(--foreground)",
    landing: "var(--info)",
    product: "var(--primary)",
    feature: "var(--success)",
    channel: "var(--approval)",
};
const accent = (k: LabKind) => ACCENT[k];

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
        accent,
        frame: () => ({
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
        title: "text-[14px] font-semibold text-foreground",
        sub: "text-[12px] leading-[1.45] text-muted-foreground",
        chip: "rounded-[6px] bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-faint",
        radius: "rounded-[14px]",
    },
    // Editorial - a lighter, airier card with a coloured top hairline.
    editorial: {
        key: "editorial",
        dark: false,
        container: "",
        bg: { variant: BackgroundVariant.Dots, gap: 40, size: 1, color: "var(--rf-dot)" },
        edge: { type: "step", animated: false, stroke: "var(--rf-edge)", width: 1.5 },
        accent,
        frame: (a) => ({
            background: "var(--card)",
            border: "1px solid var(--border-soft)",
            borderTop: `3px solid ${a}`,
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-display text-[10px] font-semibold uppercase tracking-[0.16em]",
        title: "font-display text-[15px] font-medium text-foreground",
        sub: "text-[12px] leading-[1.5] text-muted-foreground",
        chip: "rounded-full border border-border-soft px-2 py-0.5 font-mono text-[9.5px] text-faint",
        radius: "rounded-[4px]",
    },
    // Blueprint - schematic, monospace, thin square frames on a cross grid.
    blueprint: {
        key: "blueprint",
        dark: true,
        container: "bg-[#0c1524] [--rf-dot:rgba(120,170,255,0.18)] [--rf-edge:rgba(120,170,255,0.5)]",
        bg: { variant: BackgroundVariant.Cross, gap: 26, size: 4, color: "rgba(120,170,255,0.14)" },
        edge: {
            type: "step",
            animated: false,
            dash: "2 4",
            stroke: "rgba(120,170,255,0.55)",
            width: 1,
        },
        accent: (k) => (k === "company" ? "#8fb8ff" : accent(k)),
        frame: (a) => ({
            background: "rgba(14,26,46,0.82)",
            border: `1px solid ${a}`,
            boxShadow: "0 0 0 1px rgba(120,170,255,0.08), 0 10px 30px rgba(0,0,0,0.5)",
            color: "#cfe0ff",
        }),
        eyebrow: "font-mono text-[9.5px] font-bold uppercase tracking-[0.2em]",
        title: "font-mono text-[13px] font-semibold text-[#eaf1ff]",
        sub: "font-mono text-[11px] leading-[1.5] text-[#9db6e0]",
        chip: "rounded-[2px] border border-[rgba(120,170,255,0.35)] px-1.5 py-0.5 font-mono text-[9px] text-[#9db6e0]",
        radius: "rounded-[3px]",
    },
    // Mono - quiet, borderless-ish, tight grid; lets the layout do the talking.
    mono: {
        key: "mono",
        dark: false,
        container: "",
        bg: { variant: BackgroundVariant.Lines, gap: 44, size: 1, color: "var(--border-soft)" },
        edge: { type: "straight", animated: false, stroke: "var(--rf-edge)", width: 1.2 },
        accent,
        frame: (a) => ({
            background: "var(--card)",
            border: "1px solid var(--border-soft)",
            borderLeft: `3px solid ${a}`,
            boxShadow: "none",
        }),
        eyebrow: "font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        title: "text-[13.5px] font-semibold text-foreground",
        sub: "text-[11.5px] leading-[1.45] text-muted-foreground",
        chip: "rounded-[5px] bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-faint",
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
        accent: (k) => {
            const map: Record<LabKind, string> = {
                idea: "#ff9d6c",
                opportunity: "#ffcf5c",
                company: "#8b7bff",
                landing: "#5cc8ff",
                product: "#ff8fb0",
                feature: "#48e6a0",
                channel: "#b18bff",
            };
            return map[k];
        },
        frame: (a) => ({
            background: "rgba(20,24,40,0.72)",
            border: `1px solid ${a}66`,
            boxShadow: `0 0 0 1px ${a}22, 0 0 26px -6px ${a}, 0 18px 50px rgba(0,0,0,0.6)`,
            backdropFilter: "blur(6px)",
            color: "#e7ebfb",
        }),
        eyebrow: "font-mono text-[10px] font-bold uppercase tracking-[0.16em]",
        title: "text-[14px] font-semibold text-[#f2f4ff]",
        sub: "text-[12px] leading-[1.45] text-[#aeb6d8]",
        chip: "rounded-full border border-[rgba(150,160,255,0.28)] bg-[rgba(150,160,255,0.08)] px-2 py-0.5 font-mono text-[9.5px] text-[#c3c9e8]",
        radius: "rounded-[16px]",
    },
    // Soft - rounded, pastel-tinted cards on a plain field (kanban feel).
    soft: {
        key: "soft",
        dark: false,
        container: "bg-secondary/40",
        bg: null,
        edge: { type: "straight", animated: false, stroke: "var(--border)", width: 1.5 },
        accent,
        frame: (a) => ({
            background: `color-mix(in srgb, ${a} 7%, var(--card))`,
            border: `1px solid color-mix(in srgb, ${a} 28%, var(--border))`,
            boxShadow: "var(--shadow-e1)",
        }),
        eyebrow: "font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
        title: "text-[14px] font-semibold text-foreground",
        sub: "text-[12px] leading-[1.45] text-muted-foreground",
        chip: "rounded-full bg-card px-2 py-0.5 font-mono text-[9.5px] text-faint",
        radius: "rounded-[18px]",
    },
};

// Per-state dot colour (features + channels). Neutral tokens read in every flavor.
export const STATE_DOT: Record<string, string> = {
    shipped: "var(--success)",
    building: "var(--warning)",
    queued: "var(--info)",
    planned: "var(--faint)",
};
