"use client";

import type { ReactNode, Ref } from "react";
import { cn } from "../lib/cn";

// The chat frame: a scrolling thread with a composer slot. Two looks, unified - both stay
// reachable through `variant`:
//
//   "panel"   the docked co-pilot column (prototype `.cl-head` + `.cpg-chat`): a bordered aside
//             with an identity header, a padded thread, and the composer in normal flow.
//   "thread"  the full-page conversation: a centred measure with a FLOATING composer absolutely
//             positioned over the thread. The gradient fades the scrolling content out behind it;
//             pointer-events pass through the transparent zone.
//
// The scroll container is exposed through `scrollRef` so the caller keeps owning "pin to bottom"
// (which needs to know when messages / stage actually changed).

export type ChatPanelVariant = "panel" | "thread";

export type ChatPanelProps = {
    variant?: ChatPanelVariant;
    /** Identity header - "panel" only (the thread page has its own title in `children`). */
    header?: ReactNode;
    /** The thread itself. */
    children: ReactNode;
    /** Rendered instead of `children` when `isEmpty` - see <ChatEmptyState>. "panel" only. */
    empty?: ReactNode;
    isEmpty?: boolean;
    composer?: ReactNode;
    scrollRef?: Ref<HTMLDivElement>;
    /** The centred column width in px - "thread" only. */
    maxWidth?: number;
    className?: string;
    /** Extra classes on the thread's inner list wrapper. */
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
    className,
    bodyClassName,
}: ChatPanelProps) {
    if (variant === "thread") {
        return (
            <div className={cn("relative flex h-full flex-col", className)}>
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    {/* bottom padding clears the floating composer so the last message isn't hidden */}
                    <div
                        className={cn("mx-auto w-full", bodyClassName)}
                        style={{ maxWidth, padding: "22px 20px 148px" }}
                    >
                        {children}
                    </div>
                </div>

                {composer !== undefined && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-8">
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

// Borderless, open identity header (prototype `.cl-head`): the chat IS the entity you're talking
// to, so there is no chrome between its avatar and its thread.
export type ChatPanelHeaderProps = {
    avatar?: ReactNode;
    title: ReactNode;
    /** Sits inline after the title - a live-status pill, say. */
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
                    <p className="mt-1 truncate text-xs leading-[1.45] text-muted-foreground">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>
    );
}

// The zero-message state: the avatar again, centred, with an invitation to start talking.
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
                "flex h-full flex-col items-center justify-center px-6 text-center",
                className,
            )}
        >
            {avatar}
            <p className="mt-3 text-sm font-medium">{title}</p>
            {description !== undefined && <p className="mt-1 text-xs text-faint">{description}</p>}
        </div>
    );
}
