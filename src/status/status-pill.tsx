"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { StatusDot } from "./status-dot";

// The labelled state pill - a dot plus a mono uppercase word. Two looks, unified:
//
//   "bare"  the company chat header's live-status lockup (prototype `.cl-live`): no chrome, a
//           tone dot with a soft 3px ring and a muted caption. Pass `dotClassName` (the fill)
//           and `ring` (the soft ring colour).
//   "soft"  the Setup tab's connection pill: a tinted capsule where the dot inherits the text
//           colour (`bg-current`), so one `text-*`/`bg-*-soft` pair on `className` colours both.
//
// The tone→class decision stays in the app: this ships the shape, the caller supplies the colour.

export type StatusPillVariant = "bare" | "soft";

const PILL: Record<StatusPillVariant, string> = {
    bare: "inline-flex flex-none items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-muted-foreground",
    soft: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide",
};

export type StatusPillProps = {
    variant?: StatusPillVariant;
    children: ReactNode;
    /** Tailwind fill class for the dot. Defaults to "bg-current" on the "soft" variant. */
    dotClassName?: string;
    /** Runtime CSS colour for the dot when a class is not knowable ahead of time. */
    dotColor?: string;
    /** Soft ring colour behind the dot - renders as `0 0 0 3px <ring>`. */
    ring?: string;
    /** Hide the dot entirely (a plain state chip). */
    hideDot?: boolean;
    className?: string;
};

export function StatusPill({
    variant = "soft",
    children,
    dotClassName,
    dotColor,
    ring,
    hideDot,
    className,
}: StatusPillProps) {
    return (
        <span className={cn(PILL[variant], className)}>
            {!hideDot && (
                <StatusDot
                    size="sm"
                    colorClassName={dotClassName ?? (variant === "soft" ? "bg-current" : undefined)}
                    color={dotColor}
                    ring={ring}
                />
            )}
            {children}
        </span>
    );
}
