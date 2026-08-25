"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { LogLineData } from "./log-line";
import { LogLine } from "./log-line";
import { LogView } from "./log-view";
import { useNearBottomScroll } from "./use-near-bottom";

// CONSOLE PANE - one agent's column inside the dock: a header (avatar, name, state chip)
// over a scrolling log that follows the tail while the reader is near the bottom.
//
// What a state chip SAYS and which token pair it wears is domain data, so it arrives as a
// `status` descriptor from the app; the chip chrome (size, radius, mono caps) lives here.

const HEADER = "flex flex-none items-center gap-2 border-b border-border px-3 py-[9px]";
const TITLE =
    "overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-foreground";
const CHIP =
    "ml-auto flex-none rounded-[5px] px-[7px] py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.05em]";

/** A pane's state chip: the word, plus the token colour pair the app picked for it. */
export type ConsoleStatusChip = {
    label: ReactNode;
    /** Colour pair, e.g. "text-info bg-info-soft". */
    className?: string;
};

export type ConsolePaneProps = {
    title: ReactNode;
    /** The company avatar (or any leading mark) - the app owns what a logo looks like. */
    logo?: ReactNode;
    status?: ConsoleStatusChip;
    lines: readonly LogLineData[];
    /** A run is genuinely live: appends the working ticker under the last line. */
    active?: boolean;
    /** The ticker text. Default "● working…". */
    activeLabel?: ReactNode;
    className?: string;
};

export function ConsolePane({
    title,
    logo,
    status,
    lines,
    active,
    activeLabel = "● working…",
    className,
}: ConsolePaneProps) {
    const scrollRef = useNearBottomScroll<HTMLDivElement>(lines);
    return (
        <section className={cn("flex min-h-[210px] min-w-0 flex-col bg-card", className)}>
            <div className={HEADER}>
                {logo}
                <span className={TITLE}>{title}</span>
                {status && <span className={cn(CHIP, status.className)}>{status.label}</span>}
            </div>
            <LogView
                ref={scrollRef}
                lines={lines}
                // The ticker is a clock-less line, so it lines up under the messages.
                footer={active ? <LogLine line={{ msg: activeLabel, kind: "act" }} /> : undefined}
            />
        </section>
    );
}
