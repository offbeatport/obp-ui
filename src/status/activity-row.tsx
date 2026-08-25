"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// One line of a live-activity feed: an optional fixed-width tone tag (the company card's
// BUILD/GROW/RUN chip), the prose, and an optional timestamp pushed to the end.
//
// The row is `overflow-hidden` and the text ellipsises: a feed line must never widen its card.
// The tag is a fixed `w-11` so the prose of every line starts on the same x - that alignment is
// the whole point of the chip, so the width is not configurable.
//
// Tone→class mapping stays in the app (it is domain data); pass the colour pair on `tagClassName`.

const ROW =
    "flex items-center gap-[9px] overflow-hidden font-mono text-[11.5px] text-muted-foreground";
const TAG =
    "w-11 flex-none rounded-[5px] px-1.5 py-0.5 text-center text-[9px] font-semibold tracking-[0.05em]";
const TEXT = "overflow-hidden text-ellipsis whitespace-nowrap";
const AGO = "ml-auto flex-none opacity-[0.65]";

export type ActivityRowProps = {
    /** Leading chip content (e.g. "BUILD"). Omit for an untagged line. */
    tag?: ReactNode;
    /** Colour pair for the chip, e.g. "text-info bg-info-soft". */
    tagClassName?: string;
    /** Anything rendered before the text and after the tag - typically a <StatusDot />. */
    leading?: ReactNode;
    text: ReactNode;
    /** Relative timestamp, right-aligned. */
    ago?: ReactNode;
    className?: string;
    agoClassName?: string;
};

export function ActivityRow({
    tag,
    tagClassName,
    leading,
    text,
    ago,
    className,
    agoClassName,
}: ActivityRowProps) {
    return (
        <div className={cn(ROW, className)}>
            {tag !== undefined && <span className={cn(TAG, tagClassName)}>{tag}</span>}
            {leading}
            <span className={TEXT}>{text}</span>
            {ago !== undefined && <span className={cn(AGO, agoClassName)}>{ago}</span>}
        </div>
    );
}
