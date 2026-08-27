"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { StatusDot } from "./status-dot";

// The "live" indicator - two looks that mean the same thing, kept as variants so both stay
// reachable:
//
//   "ping"  a crisp success-coloured core with an expanding sonar ring (Tailwind's animate-ping).
//           Used by the agent console launcher tab + console header. Replaces the old
//           .ct-dot ::after keyframe.
//   "blink" a small dot on the slow co-blink breathe. Used by the company card's
//           "live activity" label.
//
// Pass `label` to get the lockup (dot + mono uppercase caption); omit it for a bare dot that
// sits inside a caller-owned row.

export type LiveDotVariant = "ping" | "blink";

// The company card's caption lockup (was the `.co-feed h4` rule).
const LOCKUP =
    "flex items-center gap-2 font-mono text-sm font-semibold uppercase tracking-[0.12em] text-faint";

export type LiveDotProps = {
    variant?: LiveDotVariant;
    label?: ReactNode;
    /** Extra classes - on the lockup when `label` is set, otherwise on the dot itself. */
    className?: string;
};

export function LiveDot({ variant = "ping", label, className }: LiveDotProps) {
    const dot =
        variant === "ping" ? (
            <span className={cn("relative inline-flex size-2 flex-none", !label && className)}>
                <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-75" />
                <span className="relative size-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
            </span>
        ) : (
            <StatusDot
                size="xs"
                colorClassName="bg-success"
                blink
                className={label ? undefined : className}
            />
        );
    if (label === undefined) return dot;
    return (
        <div className={cn(LOCKUP, className)}>
            {dot}
            {label}
        </div>
    );
}
