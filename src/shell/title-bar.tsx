"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type TitleBarProps = {
    leading?: ReactNode;
    title?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    draggable?: boolean;
    className?: string;
    titleClassName?: string;
};

export function TitleBar({
    leading,
    title,
    actions,
    children,
    draggable = true,
    className,
    titleClassName,
}: TitleBarProps) {
    return (
        <div
            data-tauri-drag-region={draggable ? "" : undefined}
            className={cn(
                "titlebar flex flex-none items-center gap-2 border-b bg-secondary",
                "h-[var(--titlebar-height,38px)] ps-[calc(var(--titlebar-inset,0px)+0.5rem)] pe-2",
                className,
            )}
        >
            {leading}
            {title !== undefined && (
                <div
                    className={cn(
                        "min-w-0 truncate text-sm font-semibold text-muted-foreground",
                        titleClassName,
                    )}
                >
                    {title}
                </div>
            )}
            {children}
            {actions !== undefined && (
                <div className="ms-auto flex items-center gap-0.5">{actions}</div>
            )}
        </div>
    );
}
