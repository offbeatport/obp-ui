"use client";

// The rail chrome: the edge collapse toggle, a brand slot that links home, the scrolling
// body (nav items, section labels, entity rows - whatever the host puts there) and a footer
// slot pinned to the bottom.
//
// Nothing in here knows what a "company" is: content comes in as children, the brand mark is
// a slot, the footer is a slot.

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import { useNav } from "../nav/ui-provider";
import { useRail } from "./rail-context";

export type RailProps = {
    /** The wordmark shown when the rail is expanded. Omit to render no brand row at all. */
    brand?: ReactNode;
    /** The mark shown when collapsed; falls back to `brand`. */
    brandCollapsed?: ReactNode;
    /** Where the brand links. Defaults to the nav context's `paths.home()`. */
    brandHref?: string;
    /** aria-label for the brand link (the wordmark itself is decorative markup). */
    brandLabel?: string;
    /** Pinned bottom region - account button, credit row, anything. */
    footer?: ReactNode;
    /** The scrolling rail body. */
    children?: ReactNode;
    /** Overrides the collapse context (which is the default source). */
    collapsed?: boolean;
    /** Overrides the context's toggle. */
    onToggle?: () => void;
    expandLabel?: string;
    collapseLabel?: string;
    className?: string;
    bodyClassName?: string;
    footerClassName?: string;
};

export function Rail({
    brand,
    brandCollapsed,
    brandHref,
    brandLabel,
    footer,
    children,
    collapsed: collapsedProp,
    onToggle,
    expandLabel = "Expand sidebar",
    collapseLabel = "Collapse sidebar",
    className,
    bodyClassName,
    footerClassName,
}: RailProps) {
    const rail = useRail();
    const { paths } = useNav();
    const collapsed = collapsedProp ?? rail.collapsed;
    const toggle = onToggle ?? rail.toggle;

    return (
        <aside className={cn("relative flex flex-col border-r bg-secondary", className)}>
            {/* collapse toggle straddling the edge */}
            <button
                type="button"
                onClick={toggle}
                aria-label={collapsed ? expandLabel : collapseLabel}
                className="absolute -right-3 top-5 z-10 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-e2 transition-transform hover:bg-primary hover:text-primary-foreground"
            >
                <ChevronLeft
                    className={cn("size-3.5 transition-transform", collapsed && "rotate-180")}
                />
            </button>

            {/* wordmark - links home */}
            {brand !== undefined && (
                <Link
                    href={brandHref ?? paths.home()}
                    aria-label={brandLabel}
                    className={cn(
                        "flex items-center px-4 pb-3.5 pt-5",
                        collapsed && "justify-center px-0",
                    )}
                >
                    {collapsed ? (brandCollapsed ?? brand) : brand}
                </Link>
            )}

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2", bodyClassName)}>
                {children}
            </div>

            {/* foot: whatever the host pins there (credit row · account menu) */}
            {footer !== undefined && (
                <div className={cn("px-3 py-2", footerClassName)}>{footer}</div>
            )}
        </aside>
    );
}
