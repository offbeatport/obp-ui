"use client";

import { Lock } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import { useIsActive } from "../nav/ui-provider";
import { useRailCollapsed } from "./rail-context";

export type IconComponent = ComponentType<{ className?: string }>;

export type NavItemProps = {
    icon: IconComponent;
    label: ReactNode;
    href?: string;
    active?: boolean;
    locked?: boolean;
    collapsed?: boolean;
    tint?: boolean;
    iconStyle?: "tile" | "plain";
    onClick?: () => void;
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
    iconStyle = "tile",
    onClick,
    title,
    className,
}: NavItemProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;
    const autoActive = useIsActive(href ?? "");
    const isActive = active ?? autoActive;

    const inner = (
        <>
            <span
                className={cn(
                    "grid flex-none place-items-center",
                    iconStyle === "tile" ? "size-8 rounded-md bg-accent text-primary" : "size-5",
                    tint && "newco-ic",
                )}
            >
                <Icon className="size-4" />
            </span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && locked && <Lock className="size-3.5 flex-none text-faint" />}
        </>
    );
    const cls = cn(
        "group flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm font-semibold transition",
        iconStyle === "plain" && "py-1.5",
        isActive && "bg-accent text-accent-foreground",
        !locked && !isActive && "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
