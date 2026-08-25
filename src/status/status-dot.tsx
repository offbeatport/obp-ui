"use client";

import type { CSSProperties } from "react";
import { cn } from "../lib/cn";

// The coloured state dot - the smallest atom in the kit. Every surface that says "something is
// happening" (chat status pill, setup connection pill, canvas node, console, company card) draws
// the same circle at one of five sizes with an optional soft ring, glow, blink or halo.
//
// Sizes are a fixed map rather than a numeric prop on purpose: Tailwind can only emit a class it
// can see in the source, so `size-[5px]` must be a literal. The five entries below are exactly the
// sizes the app already uses.

export type StatusDotSize = "xs" | "sm" | "md" | "lg" | "xl";

const DOT_SIZE: Record<StatusDotSize, string> = {
    xs: "size-[5px]", // company-card "live activity" dot, chat system line
    sm: "size-1.5", // 6px - status pills, pipeline chips
    md: "size-[7px]", // canvas CurrentLine, lab feature/channel dots
    lg: "size-2", // 8px - console live dot, hud activity pulse
    xl: "size-[9px]", // canvas company status dot
};

export type StatusDotProps = {
    size?: StatusDotSize;
    /** Tailwind fill class, e.g. "bg-success" or "bg-current". */
    colorClassName?: string;
    /** Runtime CSS colour (`var(--success)`, a brand hex, …) applied as an inline background.
     *  Use this when the colour is only known at runtime - a class cannot be generated then. */
    color?: string;
    /** Soft surrounding ring - renders as `0 0 0 3px <ring>` (the prototype's `.cl-live` dot). */
    ring?: string;
    /** Raw box-shadow escape hatch for glows, e.g. "0 0 10px var(--success)" or "none".
     *  Kept as an inline style because Tailwind v4 hoists shadow colours into
     *  --tw-shadow-color and mangles color-mix()/var() payloads. */
    glow?: string;
    /** co-blink: the slow opacity breathe used by the company card's live-activity label.
     *  The 80% base opacity is what shows when the user prefers reduced motion. */
    blink?: boolean;
    /** Tailwind's animate-pulse (canvas CurrentLine, pipeline "needs you" pip). */
    pulse?: boolean;
    /** co-halo: an expanding ring drawn as an ::after in the given colour. */
    halo?: string;
    className?: string;
    style?: CSSProperties;
};

export function StatusDot({
    size = "sm",
    colorClassName,
    color,
    ring,
    glow,
    blink,
    pulse,
    halo,
    className,
    style,
}: StatusDotProps) {
    const shadow =
        [ring ? `0 0 0 3px ${ring}` : undefined, glow].filter(Boolean).join(", ") || undefined;
    return (
        <span
            aria-hidden="true"
            className={cn(
                DOT_SIZE[size],
                "rounded-full",
                colorClassName,
                blink && "animate-[co-blink_3s_ease-in-out_infinite] opacity-80",
                blink && "motion-reduce:animate-none",
                pulse && "animate-pulse",
                halo &&
                    "relative after:absolute after:inset-[-4px] after:animate-[co-halo_2.2s_ease-out_infinite] after:rounded-full after:border-[1.5px] after:border-solid after:border-[color:var(--pk-halo)] after:content-[''] motion-reduce:after:animate-none",
                className,
            )}
            style={
                {
                    ...(color ? { background: color } : null),
                    ...(shadow ? { boxShadow: shadow } : null),
                    ...(halo ? { "--pk-halo": halo } : null),
                    ...style,
                } as CSSProperties
            }
        />
    );
}
