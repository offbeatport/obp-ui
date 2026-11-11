"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "../lib/cn";

export type ChatPanelVariant = "panel" | "thread" | "inset";

export type ChatPanelProps = {
    variant?: ChatPanelVariant;
    header?: ReactNode;
    children: ReactNode;
    empty?: ReactNode;
    isEmpty?: boolean;
    composer?: ReactNode;
    scrollRef?: Ref<HTMLDivElement>;
    maxWidth?: number;
    busy?: boolean;
    label?: string;
    className?: string;
    bodyClassName?: string;
};

export function ChatPanel({
    variant = "panel",
    header,
    children,
    empty,
    isEmpty,
    composer,
    scrollRef,
    maxWidth = 840,
    busy,
    label = "Conversation",
    className,
    bodyClassName,
}: ChatPanelProps) {
    if (variant === "inset") {
        return (
            <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
                {header}
                <div
                    ref={scrollRef}
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto p-panel"
                >
                    {isEmpty && empty !== undefined ? (
                        empty
                    ) : (
                        <div
                            role="log"
                            aria-label={label}
                            aria-busy={busy || undefined}
                            className={cn("flex flex-col gap-5", bodyClassName)}
                        >
                            {children}
                        </div>
                    )}
                </div>
                {composer !== undefined && <div className="border-t">{composer}</div>}
            </div>
        );
    }

    if (variant === "thread") {
        return (
            <div className={cn("relative flex h-full flex-col", className)}>
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    <div
                        className={cn("mx-auto w-full", bodyClassName)}
                        style={{ maxWidth, padding: "22px 20px 148px" }}
                    >
                        {children}
                    </div>
                </div>

                {composer !== undefined && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border bg-background pt-3">
                        <div className="pointer-events-auto mx-auto w-full" style={{ maxWidth }}>
                            {composer}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <aside
            className={cn("flex min-h-0 flex-col border-r bg-secondary/40 lg:h-full", className)}
        >
            {header}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {isEmpty && empty !== undefined ? (
                    empty
                ) : (
                    <div className={cn("flex flex-col gap-4 px-1.5 pt-2 pb-2.5", bodyClassName)}>
                        {children}
                    </div>
                )}
            </div>
            {composer}
        </aside>
    );
}

export type ChatPanelHeaderProps = {
    avatar?: ReactNode;
    title: ReactNode;
    badge?: ReactNode;
    subtitle?: ReactNode;
    className?: string;
};

export function ChatPanelHeader({
    avatar,
    title,
    badge,
    subtitle,
    className,
}: ChatPanelHeaderProps) {
    return (
        <div className={cn("flex items-start gap-3 px-[18px] py-[15px]", className)}>
            {avatar}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                    <span className="truncate font-display text-lg font-semibold tracking-[-0.01em]">
                        {title}
                    </span>
                    {badge}
                </div>
                {subtitle && (
                    <p className="mt-1 truncate text-sm leading-[1.45] text-muted-foreground">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

export type ChatEmptyStateProps = {
    avatar?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    className?: string;
};

export function ChatEmptyState({ avatar, title, description, className }: ChatEmptyStateProps) {
    return (
        <div
            className={cn(
                "flex h-full flex-1 flex-col items-center justify-center px-6 text-center",
                className,
            )}
        >
            {avatar}
            <p className={cn("text-base font-medium", avatar !== undefined && "mt-3")}>{title}</p>
            {description !== undefined && (
                <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
            )}
        </div>
    );
}
