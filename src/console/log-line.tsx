"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { hms, localeTime } from "./time";

// LOG LINE - one line of agent output. The app renders logs in two chromes and both stay
// reachable through `variant`:
//
//   "console"  the docked console pane: the timestamp is its own flex column, so every
//              message starts on the same x. An untoned message reads as foreground.
//   "run"      the admin run tail: the timestamp sits inline with a right margin and the
//              kind colours the whole row. An untoned message reads as muted.
//
// The line SHAPE ships here; deciding which log record is which kind stays in the app -
// only it knows what a "status" / "end" / stderr record means.

/**
 * The colour language of a log line. A superset of the console digest's kinds, so a
 * digest line can be handed to <LogLine> unchanged.
 */
export type LogKind = "act" | "ok" | "warn" | "info" | "msg" | "error";

// Log-line kind → the message colour (the timestamp stays faint in both variants).
const KIND_TEXT: Partial<Record<LogKind, string>> = {
    act: "text-primary",
    ok: "text-success",
    warn: "text-warning",
    info: "text-info",
    error: "text-destructive",
};

export type LogVariant = "console" | "run";

// What a line with no kind of its own falls back to - deliberately different per chrome:
// a console pane is the foreground content, a run tail is a quiet backdrop to its header.
const FALLBACK_TEXT: Record<LogVariant, string> = {
    console: "text-foreground",
    run: "text-muted-foreground",
};

// Default clock per chrome (override with `formatTime`).
const TIME_FORMAT: Record<LogVariant, (t: number) => string> = {
    console: hms,
    run: localeTime,
};

/** Badge variants that carry the status language. */
export type StatusVariant = "neutral" | "info" | "approval" | "success" | "destructive";

// action/run status → Badge variant - the shared status language across queue + runs.
export const STATUS_VARIANT: Record<string, StatusVariant> = {
    queued: "neutral",
    running: "info",
    awaiting_approval: "approval",
    approved: "approval",
    done: "success",
    blocked: "destructive",
    succeeded: "success",
    failed: "destructive",
    cancelled: "neutral",
};

export type LogLineData = {
    /** epoch ms. Omit for a line with no clock (e.g. the console's "working…" ticker). */
    t?: number;
    msg: ReactNode;
    kind?: LogKind;
};

export type LogLineProps = {
    line: LogLineData;
    variant?: LogVariant;
    /** Override the clock format. Defaults to `hms` (console) / `localeTime` (run). */
    formatTime?: (t: number) => string;
    className?: string;
};

export function LogLine({ line, variant = "console", formatTime, className }: LogLineProps) {
    const time = line.t === undefined ? "" : (formatTime ?? TIME_FORMAT[variant])(line.t);
    const text = (line.kind && KIND_TEXT[line.kind]) ?? FALLBACK_TEXT[variant];

    // The run tail colours the whole row, so the timestamp has to re-assert `text-faint`.
    if (variant === "run")
        return (
            <div className={cn(text, className)}>
                <span className="mr-2 text-faint">{time}</span>
                {line.msg}
            </div>
        );

    return (
        <div className={cn("flex gap-[9px]", className)}>
            <span className="flex-none text-faint">{time}</span>
            <span className={cn("min-w-0 break-words", text)}>{line.msg}</span>
        </div>
    );
}
