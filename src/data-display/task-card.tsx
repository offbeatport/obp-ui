"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type TaskCardProps = {
    n?: ReactNode;
    title: ReactNode;
    chip?: ReactNode;
    accent?: string;
    gated?: boolean;
    sub?: ReactNode;
    meta?: ReactNode;
    progress?: ReactNode;
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
                "min-w-0 flex-1 rounded-lg border bg-card px-3 py-2.5",
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
                {n !== undefined && <span className="font-mono text-sm text-faint">#{n}</span>}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {title}
                </span>
                {chip !== undefined && <TaskStateChip color={accent}>{chip}</TaskStateChip>}
            </div>
            {sub !== undefined && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
            {meta !== undefined && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-faint">
                    {meta}
                </div>
            )}
            {progress}
            {actions !== undefined && <div className="mt-2.5 flex gap-2">{actions}</div>}
        </div>
    );
}

export type TaskStateChipProps = {
    children: ReactNode;
    color?: string;
    className?: string;
};

export function TaskStateChip({ children, color, className }: TaskStateChipProps) {
    return (
        <span
            className={cn(
                "flex-none rounded-md border border-current/40 px-1.5 text-sm leading-5 font-medium",
                className,
            )}
            style={
                color
                    ? {
                          borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
                          color,
                      }
                    : undefined
            }
        >
            {children}
        </span>
    );
}
