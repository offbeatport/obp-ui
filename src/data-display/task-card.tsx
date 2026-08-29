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
                    <span className="font-mono text-sm font-bold text-faint">#{n}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {title}
                </span>
                {chip !== undefined && <TaskStateChip color={accent}>{chip}</TaskStateChip>}
            </div>
            {sub !== undefined && (
                <p className="mt-1 text-sm leading-[1.45] text-muted-foreground">{sub}</p>
            )}
            {meta !== undefined && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-faint">
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
    color?: string;
    className?: string;
};

export function TaskStateChip({ children, color, className }: TaskStateChipProps) {
    return (
        <span
            className={cn(
                "flex-none rounded-full px-2 py-0.5 font-mono text-sm font-bold uppercase tracking-wide",
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
