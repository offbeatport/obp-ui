"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { GradientMark, type GradientMarkBranding } from "../data-display/gradient-mark";
import { cn } from "../lib/cn";
import { TONE, type Tone } from "../lib/tone";
import { Link } from "../nav/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../primitives";
import { useRailCollapsed } from "./rail-context";

export type EntityRowAction = {
    key?: string;
    icon?: ReactNode;
    label: ReactNode;
    href?: string;
    onSelect?: () => void;
    destructive?: boolean;
};

export type EntityRowProps = {
    id?: string;
    name: string;
    href: string;
    avatar?: ReactNode;
    branding?: GradientMarkBranding | null;
    avatarSize?: number;
    statusTone?: Tone;
    statusDotClassName?: string;
    metaLabel?: ReactNode;
    badge?: ReactNode;
    badgeClassName?: string;
    selected?: boolean;
    collapsed?: boolean;
    title?: string;
    actions?: EntityRowAction[];
    actionsLabel?: string;
    className?: string;
};

export function EntityRow({
    id,
    name,
    href,
    avatar,
    branding,
    avatarSize = 32,
    statusTone,
    statusDotClassName,
    metaLabel,
    badge,
    badgeClassName,
    selected,
    collapsed: collapsedProp,
    title,
    actions,
    actionsLabel,
    className,
}: EntityRowProps) {
    const railCollapsed = useRailCollapsed();
    const collapsed = collapsedProp ?? railCollapsed;

    const dotClass = statusDotClassName ?? (statusTone ? TONE[statusTone].solid : undefined);
    const avatarNode = avatar ?? (
        <span className="relative flex-none">
            <GradientMark name={name} branding={branding} size={avatarSize} />
            {dotClass && (
                <span
                    aria-hidden="true"
                    className={cn(
                        "absolute -bottom-0.5 -right-0.5 size-2 rounded-full shadow-[0_0_0_2px_var(--secondary)]",
                        dotClass,
                    )}
                />
            )}
        </span>
    );

    if (collapsed) {
        return (
            <Link
                href={href}
                title={title ?? name}
                className={cn(
                    "grid place-items-center rounded-md p-1 hover:bg-primary/[0.1]",
                    selected && "bg-card",
                    className,
                )}
            >
                {avatarNode}
            </Link>
        );
    }

    return (
        <div className={cn("group relative rounded-md hover:bg-primary/[0.1]", className)}>
            <Link
                href={href}
                className={cn(
                    "relative flex items-center gap-3 rounded-md py-2 pl-2.5 pr-8",
                    selected &&
                        "bg-card before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-xs before:bg-primary before:content-['']",
                )}
            >
                {avatarNode}
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <span className="truncate">{name}</span>
                        {badge !== undefined && badge !== null && badge !== false && (
                            <span
                                className={cn(
                                    "flex-none rounded-full bg-approval px-1.5 py-px text-sm font-bold tracking-[0.03em] text-approval-foreground",
                                    badgeClassName,
                                )}
                            >
                                {badge}
                            </span>
                        )}
                    </span>
                    {metaLabel !== undefined && (
                        <span className="block truncate text-sm text-faint">{metaLabel}</span>
                    )}
                </span>
            </Link>
            {actions && actions.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={actionsLabel ?? `${name} actions`}
                            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint opacity-0 transition hover:bg-neutral/30 hover:text-foreground group-hover:opacity-100 data-popup-open:bg-primary/20 data-popup-open:opacity-100"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        {actions.map((action) => {
                            const cls = cn(
                                "gap-2",
                                action.destructive &&
                                    "text-destructive data-highlighted:bg-destructive-soft data-highlighted:text-destructive",
                            );
                            const key =
                                action.key ?? action.href ?? `${id ?? name}:${action.label}`;
                            if (action.href) {
                                return (
                                    <DropdownMenuItem key={key} asChild className={cls}>
                                        <Link href={action.href}>
                                            {action.icon} {action.label}
                                        </Link>
                                    </DropdownMenuItem>
                                );
                            }
                            return (
                                <DropdownMenuItem
                                    key={key}
                                    onSelect={action.onSelect}
                                    className={cls}
                                >
                                    {action.icon} {action.label}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
