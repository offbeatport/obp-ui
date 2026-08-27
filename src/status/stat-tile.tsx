"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// Number-over-label tile. Three near-identical copies lived in the app (the Pipeline tab's
// `Metric`, the canvas HUD's portfolio cells, the task-timeline header stats); they differ only
// in framing, type scale and alignment, so those are variants and every class string is kept:
//
//   "metric"  Pipeline header metric - bordered secondary card, display value, optional `sub` line.
//   "cell"    Canvas HUD stat cell - compact, centred, mono value; `alert` tints it approval.
//   "bare"    Task-timeline header stat - no chrome at all (the parent owns alignment).

export type StatTileVariant = "metric" | "cell" | "bare";

const FRAME: Record<StatTileVariant, string> = {
    metric: "min-w-[92px] rounded-xl border border-border-soft bg-secondary px-3.5 py-2.5",
    cell: "rounded-[9px] border border-border bg-white/[0.02] px-1.5 py-1.5 text-center",
    bare: "",
};

const VALUE: Record<StatTileVariant, string> = {
    metric: "font-display text-xl font-medium tracking-tight",
    cell: "block font-mono text-base",
    bare: "font-mono text-lg font-semibold text-foreground",
};

const LABEL: Record<StatTileVariant, string> = {
    metric: "font-mono text-sm uppercase tracking-[0.1em] text-faint",
    cell: "font-mono text-sm uppercase tracking-[0.04em] text-faint",
    bare: "font-mono text-sm uppercase tracking-wide text-faint",
};

const SUB = "mt-0.5 text-sm text-muted-foreground";

export type StatTileProps = {
    variant?: StatTileVariant;
    value: ReactNode;
    label: ReactNode;
    /** Third line under the label ("metric" only in the app today, but harmless anywhere). */
    sub?: ReactNode;
    /** Attention tint on the value (the HUD's "needs you" cell). */
    alert?: boolean;
    className?: string;
    valueClassName?: string;
    labelClassName?: string;
};

export function StatTile({
    variant = "metric",
    value,
    label,
    sub,
    alert,
    className,
    valueClassName,
    labelClassName,
}: StatTileProps) {
    // The HUD cell renders <b>/<span>; the other two render <div>/<div>. Kept per variant so the
    // markup matches the original exactly (the "cell" value is `block`-ified by its class).
    const Value = variant === "cell" ? "b" : "div";
    const Label = variant === "cell" ? "span" : "div";
    return (
        <div className={cn(FRAME[variant], className)}>
            <Value
                className={cn(
                    VALUE[variant],
                    alert && "text-[color:var(--approval)]",
                    valueClassName,
                )}
            >
                {value}
            </Value>
            <Label className={cn(LABEL[variant], labelClassName)}>{label}</Label>
            {sub !== undefined && <div className={SUB}>{sub}</div>}
        </div>
    );
}
