"use client";

// One row of rail navigation: an icon tile, the label, an optional lock, and the active fill.
//
// Renders a <Link> when it has an `href` and a <button> otherwise, so a nav list can mix
// routes with actions. The nav array itself (labels, icons, order, which entries are locked)
// is domain data and stays in the app.

import { Lock } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import { useIsActive } from "../nav/ui-provider";
import { useRailCollapsed } from "./rail-context";

/**
 * Any icon component that takes a className. lucide's `LucideIcon` satisfies this
 * structurally, so an app hands its icons over without the package depending on an icon set.
 */
export type IconComponent = ComponentType<{ className?: string }>;

export type NavItemProps = {
    icon: IconComponent;
    label: ReactNode;
    /** Route target. Omit for a button (use `onClick`). */
    href?: string;
    /** Explicit active state. Omitted → exact-match on the nav context's pathname. */
    active?: boolean;
    /** Locked = disabled: dimmed, no hover, not interactive. */
    locked?: boolean;
    /** Overrides the collapse context. */
    collapsed?: boolean;
    /** The "new thing" accent: the icon tile springs to a terracotta diamond on hover. */
    tint?: boolean;
    onClick?: () => void;
    /** Native tooltip - worth setting when the rail is collapsed and the label is hidden. */
    title?: string;
    className?: string;
};

export function NavItem({
    icon: Icon,
    label,
    href,
    active,
    locked,
    collapsed: collapsedProp,
    tint,
    onClick,
    title,
    className,
}: NavItemProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;
    // Hooks can't be conditional: ask for the auto state always, use it only as the fallback.
    const autoActive = useIsActive(href ?? "");
    const isActive = active ?? autoActive;

    const inner = (
        <>
            <span
                className={cn(
                    "grid size-8 flex-none place-items-center rounded-md bg-accent text-primary",
                    // New-company: spring-rotate the plus + fill terracotta on hover. The hover
                    // state lives in the package's shell.css (.nav-newco:hover .newco-ic) with a
                    // DIRECT transform so the .22s spring actually interpolates (Tailwind's
                    // var-based rotate can't).
                    tint && "newco-ic",
                )}
            >
                <Icon className="size-4" />
            </span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && locked && <Lock className="size-3.5 flex-none text-faint/60" />}
        </>
    );
    const cls = cn(
        "group flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm font-semibold transition",
        isActive && "bg-card text-foreground",
        !locked && "text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground",
        // locked = disabled: dimmed, no hover, not interactive
        locked && "cursor-default text-muted-foreground opacity-40",
        tint && "nav-newco mb-1.5",
        collapsed && "justify-center px-0",
        className,
    );
    if (href) {
        return (
            <Link href={href} title={title} className={cls}>
                {inner}
            </Link>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={locked}
            aria-disabled={locked}
            title={title}
            className={cls}
        >
            {inner}
        </button>
    );
}
