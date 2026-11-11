"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type ChatMetaProps = {
    items: ReactNode[];
    className?: string;
};

export function ChatMeta({ items, className }: ChatMetaProps) {
    const shown = items.filter(
        (item) => item !== null && item !== undefined && item !== false && item !== "",
    );
    if (shown.length === 0) return null;
    return (
        <p className={cn("text-sm text-muted-foreground tabular-nums", className)}>
            {shown.map((item, index) => (
                <span key={typeof item === "string" ? item : index}>
                    {index > 0 && " · "}
                    {item}
                </span>
            ))}
        </p>
    );
}

export type ChatActionsProps = {
    children: ReactNode;
    label?: string;
    className?: string;
};

export function ChatActions({ children, label = "Answer actions", className }: ChatActionsProps) {
    return (
        <fieldset
            aria-label={label}
            className={cn("m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0", className)}
        >
            {children}
        </fieldset>
    );
}
