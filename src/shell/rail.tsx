"use client";

import { ChevronLeft } from "lucide-react";
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

            {footer !== undefined && (
                <div className={cn("px-3 py-2", footerClassName)}>{footer}</div>
            )}
        </aside>
    );
}
