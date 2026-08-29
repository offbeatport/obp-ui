"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { hms, localeTime } from "./time";

export type LogKind = "act" | "ok" | "warn" | "info" | "msg" | "error";

const KIND_TEXT: Partial<Record<LogKind, string>> = {
    act: "text-primary",
    ok: "text-success",
    warn: "text-warning",
    info: "text-info",
    error: "text-destructive",
};

export type LogVariant = "console" | "run";

const FALLBACK_TEXT: Record<LogVariant, string> = {
    console: "text-foreground",
    run: "text-muted-foreground",
};

const TIME_FORMAT: Record<LogVariant, (t: number) => string> = {
    console: hms,
    run: localeTime,
};

export type StatusVariant = "neutral" | "info" | "approval" | "success" | "destructive";

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
    t?: number;
    msg: ReactNode;
    kind?: LogKind;
};

export type LogLineProps = {
    line: LogLineData;
    variant?: LogVariant;
    formatTime?: (t: number) => string;
    className?: string;
};

export function LogLine({ line, variant = "console", formatTime, className }: LogLineProps) {
    const time = line.t === undefined ? "" : (formatTime ?? TIME_FORMAT[variant])(line.t);
    const text = (line.kind && KIND_TEXT[line.kind]) ?? FALLBACK_TEXT[variant];

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
