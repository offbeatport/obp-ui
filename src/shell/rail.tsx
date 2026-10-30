"use client";

import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import { useNav } from "../nav/ui-provider";
import { useRail } from "./rail-context";

export type RailProps = {
    brand?: ReactNode;
    brandCollapsed?: ReactNode;
    brandHref?: string;
    brandLabel?: string;
    footer?: ReactNode;
    children?: ReactNode;
    collapsed?: boolean;
    onToggle?: () => void;
    toggleIcon?: "chevron" | "panel";
    togglePlacement?: "edge" | "header";
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
    toggleIcon = "chevron",
    togglePlacement = "edge",
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

    const glyph = (size: string) =>
        toggleIcon === "panel" ? (
            collapsed ? (
                <PanelLeftOpen className={size} />
            ) : (
                <PanelLeftClose className={size} />
            )
        ) : (
            <ChevronLeft className={cn(size, "transition-transform", collapsed && "rotate-180")} />
        );
    const label = collapsed ? expandLabel : collapseLabel;
    const brandLink =
        brand === undefined ? null : (
            <Link
                href={brandHref ?? paths.home()}
                aria-label={brandLabel}
                className={cn(
                    "flex items-center",
                    togglePlacement === "edge" && "px-4 pb-3.5 pt-5",
                    togglePlacement === "header" && !collapsed && "min-w-0 flex-1",
                    collapsed && "justify-center px-0",
                )}
            >
                {collapsed ? (brandCollapsed ?? brand) : brand}
            </Link>
        );

    return (
        <aside className={cn("relative flex flex-col border-r bg-background", className)}>
            {togglePlacement === "edge" && (
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={label}
                    className="absolute -right-3 top-5 z-10 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-e2 transition-transform hover:bg-primary hover:text-primary-foreground"
                >
                    {glyph("size-3.5")}
                </button>
            )}

            {togglePlacement === "edge" ? (
                brandLink
            ) : (
                <div
                    className={cn(
                        "flex items-center gap-2 px-4 pb-3.5 pt-5",
                        collapsed && "flex-col justify-center px-0",
                    )}
                >
                    {brandLink}
                    <button
                        type="button"
                        onClick={toggle}
                        aria-label={label}
                        title={label}
                        className="grid size-7 flex-none place-items-center rounded-md text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {glyph("size-4")}
                    </button>
                </div>
            )}

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2", bodyClassName)}>
                {children}
            </div>

            {footer !== undefined && (
                <div className={cn("px-3 py-2", footerClassName)}>{footer}</div>
            )}
        </aside>
    );
}
