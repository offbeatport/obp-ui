import type { SliceState, Tone } from "~/server/data";

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

// Slice state → the badge tone + label used on tiles/hero (matches the prototype's .sbadge).
export const SLICE: Record<SliceState, { tone: Tone; label: string }> = {
    shipped: { tone: "green", label: "Shipped" },
    building: { tone: "blue", label: "Building" },
    awaiting_approval: { tone: "violet", label: "Awaiting you" },
    todo: { tone: "slate", label: "Queued" },
    blocked: { tone: "red", label: "Blocked" },
};

// First letter for an avatar tile.
export const initial = (name: string) => name.charAt(0).toUpperCase();
