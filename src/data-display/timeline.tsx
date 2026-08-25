"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// The vertical timeline: an ordered list drawn on a single hairline spine, one state-coloured
// dot per item. Extracted verbatim from the app's task-timeline ("Build log") so the desktop
// app can draw the same surface.
//
// The three pieces are separate so a caller can put anything in the item body - the task card
// (see ./task-card) is only the first tenant.

export type TimelineProps = {
    children: ReactNode;
    /** Draw the spine (the hairline the dots sit on). Off for a single-item list. */
    spine?: boolean;
    className?: string;
};

export function Timeline({ children, spine = true, className }: TimelineProps) {
    return (
        <ol className={cn("relative m-0 list-none p-0", className)}>
            {/* spine - left-[11px] is the centre of the 23px dot; inset top/bottom so the line
                stops inside the first and last dot rather than running past them. */}
            {spine && <span className="absolute bottom-3 left-[11px] top-3 w-px bg-border" />}
            {children}
        </ol>
    );
}

export type TimelineItemProps = {
    /** The marker in the gutter - normally a <TimelineDot />. */
    dot?: ReactNode;
    children: ReactNode;
    className?: string;
};

export function TimelineItem({ dot, children, className }: TimelineItemProps) {
    return (
        <li className={cn("relative flex gap-4 pb-5 pl-0 last:pb-0", className)}>
            {dot}
            {children}
        </li>
    );
}

export type TimelineDotProps = {
    /** Runtime CSS colour for the ring, icon and tint, e.g. "var(--success)" or a brand hex.
     *  Inline because the state→colour decision is the caller's and Tailwind cannot emit a
     *  class it has not seen. */
    color: string;
    /** Tailwind's animate-pulse - the "in flight" / "needs you" states breathe. */
    pulse?: boolean;
    /** Lucide icon rendered at the size the timeline expects. */
    icon?: LucideIcon;
    /** Escape hatch for a non-lucide marker (a number, an avatar). Wins over `icon`. */
    children?: ReactNode;
    className?: string;
};

export function TimelineDot({ color, pulse, icon: Icon, children, className }: TimelineDotProps) {
    return (
        <span className="relative z-10 mt-1 flex-none">
            <span
                className={cn(
                    "grid size-[23px] place-items-center rounded-full",
                    pulse && "animate-pulse",
                    className,
                )}
                style={{
                    background: `color-mix(in srgb, ${color} 16%, var(--card))`,
                    // The 4px background ring is what "punches" the dot out of the spine.
                    boxShadow: `0 0 0 4px var(--background), inset 0 0 0 1.5px ${color}`,
                    color,
                }}
            >
                {children ?? (Icon ? <Icon className="size-3" strokeWidth={2.4} /> : null)}
            </span>
        </span>
    );
}
