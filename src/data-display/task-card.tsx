"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// The card body that sits next to a <TimelineDot /> - a numbered task with a state chip, a
// one-line summary, a mono meta row and (when the task is gated on the human) an actions row.
//
// Everything domain-shaped is a slot or a prop: the state→label/colour table, the meta copy and
// the buttons all stay in the app. `accent` is the runtime colour of the current state; when
// `gated` is set the card trades its border for a 45%-tinted one in that colour, which is how
// "needs you" / "blocked" rows pull the eye without changing the card's footprint.

export type TaskCardProps = {
    /** Sequence number - rendered as "#4". */
    n?: ReactNode;
    title: ReactNode;
    /** State chip text ("shipped", "needs you", …). Omit for a chip-less card. */
    chip?: ReactNode;
    /** Runtime CSS colour for the chip and the gated border, e.g. "var(--warning)". */
    accent?: string;
    /** This task is waiting on the human: tint the border with `accent`. */
    gated?: boolean;
    /** One-line summary under the title. */
    sub?: ReactNode;
    /** Mono meta row - pass plain <span>s ("2h ago", "· 2 attempts", "· $0.71"). */
    meta?: ReactNode;
    /** Optional progress element between the meta row and the actions. The original card has
     *  no progress bar, so nothing is styled here - the slot renders exactly what it is given. */
    progress?: ReactNode;
    /** Approve / reject buttons (or anything else) - only rendered when present. */
    actions?: ReactNode;
    className?: string;
};

export function TaskCard({
    n,
    title,
    chip,
    accent,
    gated,
    sub,
    meta,
    progress,
    actions,
    className,
}: TaskCardProps) {
    return (
        <div
            className={cn(
                "min-w-0 flex-1 rounded-xl border bg-card px-4 py-3 shadow-e1 transition-colors",
                gated ? "border-transparent" : "border-border",
                className,
            )}
            style={
                gated && accent
                    ? { borderColor: `color-mix(in srgb, ${accent} 45%, transparent)` }
                    : undefined
            }
        >
            <div className="flex items-center gap-2">
                {n !== undefined && (
                    <span className="font-mono text-[10px] font-bold text-faint">#{n}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
                    {title}
                </span>
                {chip !== undefined && <TaskStateChip color={accent}>{chip}</TaskStateChip>}
            </div>
            {sub !== undefined && (
                <p className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">{sub}</p>
            )}
            {meta !== undefined && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-faint">
                    {meta}
                </div>
            )}
            {progress}
            {actions !== undefined && <div className="mt-3 flex gap-2">{actions}</div>}
        </div>
    );
}

export type TaskStateChipProps = {
    children: ReactNode;
    /** Runtime CSS colour - the chip is a 15% tint of it with the colour as text. */
    color?: string;
    className?: string;
};

// Deliberately NOT ../status/StatusPill: this chip is dot-less, one step smaller (9.5px/bold)
// and `flex-none` so the title can truncate against it. Merging the two would move pixels.
export function TaskStateChip({ children, color, className }: TaskStateChipProps) {
    return (
        <span
            className={cn(
                "flex-none rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide",
                className,
            )}
            style={
                color
                    ? {
                          background: `color-mix(in srgb, ${color} 15%, transparent)`,
                          color,
                      }
                    : undefined
            }
        >
            {children}
        </span>
    );
}
