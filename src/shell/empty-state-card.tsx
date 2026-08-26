"use client";

// The dashed "nothing here yet" card that stands in for a list in the rail (the prototype's
// .co-empty-cta): a title, a line of prose, and one full-width call to action.
//
// All copy is a prop - the package ships the frame, the app supplies the words.

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";

export type EmptyStateCardProps = {
    title: ReactNode;
    description?: ReactNode;
    /** The call-to-action label. Omit for a card with no action. */
    actionLabel?: ReactNode;
    /** Renders the action as a link. */
    actionHref?: string;
    /** Renders the action as a button (ignored when `actionHref` is set). */
    onAction?: () => void;
    /** Leading glyph inside the action, e.g. <Plus className="size-3.5" />. */
    actionIcon?: ReactNode;
    className?: string;
};

const ACTION =
    "mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm font-semibold text-muted-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground";

export function EmptyStateCard({
    title,
    description,
    actionLabel,
    actionHref,
    onAction,
    actionIcon,
    className,
}: EmptyStateCardProps) {
    return (
        <div
            className={cn(
                "mx-1 mt-1.5 mb-0.5 rounded-md border-2 border-dashed bg-secondary px-3.5 py-4 text-center",
                className,
            )}
        >
            <div className="text-sm font-[650] text-foreground">{title}</div>
            {description !== undefined && <p className="m-2 text-sm leading-[1.45] text-faint">{description}</p>}
            {actionLabel !== undefined &&
                (actionHref ? (
                    <Link href={actionHref} className={ACTION}>
                        {actionIcon} {actionLabel}
                    </Link>
                ) : (
                    <button type="button" onClick={onAction} className={ACTION}>
                        {actionIcon} {actionLabel}
                    </button>
                ))}
        </div>
    );
}
