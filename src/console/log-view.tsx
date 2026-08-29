"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "../lib/cn";
import { Card } from "../primitives";
import { LogLine, type LogLineData, type LogVariant } from "./log-line";

const VIEW: Record<LogVariant, string> = {
    console: "min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3 font-mono text-sm leading-[1.65]",
    run: "gap-0 overflow-y-auto rounded-xl border bg-secondary p-3 font-mono text-sm leading-relaxed",
};

export type LogViewProps = {
    lines: readonly LogLineData[];
    variant?: LogVariant;
    empty?: ReactNode;
    footer?: ReactNode;
    formatTime?: (t: number) => string;
    ref?: Ref<HTMLDivElement>;
    className?: string;
};

export function LogView({
    lines,
    variant = "console",
    empty,
    footer,
    formatTime,
    ref,
    className,
}: LogViewProps) {
    const body = (
        <>
            {lines.length
                ? lines.map((line, i) => (
                      <LogLine
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
