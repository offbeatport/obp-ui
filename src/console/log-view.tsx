"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "../lib/cn";
import { Card } from "../primitives";
import { LogLine, type LogLineData, type LogVariant } from "./log-line";

// LOG VIEW - a scrolling list of monospace log lines. Transport-free by design: it takes
// the `lines` it should show, so the same view backs an SSE tail, a polled digest delta,
// or a file the desktop app read off disk.
//
// Two chromes, matching <LogLine>'s two variants:
//
//   "console"  the flex body of a console pane - it fills the pane and scrolls inside it.
//   "run"      a standalone Card tail (the admin run log). Give it a height via `className`.
//
// Sticking to the bottom is the caller's call: pass the ref from `useNearBottomScroll`.

const VIEW: Record<LogVariant, string> = {
    console: "min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3 font-mono text-[11px] leading-[1.65]",
    run: "gap-0 overflow-y-auto rounded-xl border bg-secondary p-3 font-mono text-sm leading-relaxed",
};

export type LogViewProps = {
    lines: readonly LogLineData[];
    variant?: LogVariant;
    /** Shown instead of the lines when there are none (e.g. "waiting for output…"). */
    empty?: ReactNode;
    /** Rendered after the last line - e.g. the console's "● working…" ticker. */
    footer?: ReactNode;
    /** Override the clock format for every line. */
    formatTime?: (t: number) => string;
    /** The scroll container - hand it `useNearBottomScroll()`'s ref to follow the tail. */
    ref?: Ref<HTMLDivElement>;
    className?: string;
};

export function LogView({ lines, variant = "console", empty, footer, formatTime, ref, className }: LogViewProps) {
    const body = (
        <>
            {lines.length
                ? lines.map((line, i) => (
                      <LogLine
                          // Append-only capped buffer: timestamp + position is as stable as
                          // a key gets here, and a line is never reordered.
                          key={`${line.t ?? ""}-${i}`}
                          line={line}
                          variant={variant}
                          formatTime={formatTime}
                      />
                  ))
                : empty}
            {footer}
        </>
    );

    if (variant === "run")
        return (
            <Card ref={ref} className={cn(VIEW.run, className)}>
                {body}
            </Card>
        );

    return (
        <div ref={ref} className={cn(VIEW.console, className)}>
            {body}
        </div>
    );
}
