export type Tone = "green" | "blue" | "violet" | "slate" | "amber" | "red";

export type ToneClasses = { text: string; solid: string; soft: string; borderL: string };

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

export const TONE_VAR: Record<Tone, string> = {
    green: "var(--success)",
    blue: "var(--info)",
    violet: "var(--approval)",
    slate: "var(--neutral)",
    amber: "var(--warning)",
    red: "var(--destructive)",
};
