import type { Tone } from "~/server/data";

// Tone → semantic token family (globals.css maps the prototype's --green/--blue/… onto
// success/info/approval/neutral/warning/destructive). One place owns the translation.
type ToneClasses = { text: string; solid: string; soft: string; borderL: string };

export const TONE: Record<Tone, ToneClasses> = {
    green: {
        text: "text-success",
        solid: "bg-success",
        soft: "bg-success-soft",
        borderL: "border-l-success",
    },
    blue: { text: "text-info", solid: "bg-info", soft: "bg-info-soft", borderL: "border-l-info" },
    violet: {
        text: "text-approval",
        solid: "bg-approval",
        soft: "bg-approval-soft",
        borderL: "border-l-approval",
    },
    slate: {
        text: "text-neutral",
        solid: "bg-neutral",
        soft: "bg-neutral-soft",
        borderL: "border-l-neutral",
    },
    amber: {
        text: "text-warning",
        solid: "bg-warning",
        soft: "bg-warning-soft",
        borderL: "border-l-warning",
    },
    red: {
        text: "text-destructive",
        solid: "bg-destructive",
        soft: "bg-destructive-soft",
        borderL: "border-l-destructive",
    },
};

// Tone → the underlying app CSS custom property (for inline `--co-bc` brand tints etc).
export const TONE_VAR: Record<Tone, string> = {
    green: "var(--success)",
    blue: "var(--info)",
    violet: "var(--approval)",
    slate: "var(--neutral)",
    amber: "var(--warning)",
    red: "var(--destructive)",
};

// Tone → the prototype's stage class on `.co-card` (drives hover tint / area tone).
export const STAGE_CLASS: Record<Tone, string> = {
    green: "co-s-growing",
    blue: "co-s-building",
    violet: "co-s-ejected",
    slate: "co-s-idea",
    amber: "co-s-testing",
    red: "co-s-killed",
};
