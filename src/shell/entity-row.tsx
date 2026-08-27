"use client";

// One entity row in the rail (the prototype's `.co-item`): avatar + status dot, the name with
// an optional badge, a second "state" line, and a hover ⋯ menu.
//
// Everything domain lives on the props: the row does not know what a company is, what its
// statuses are, or what deleting one means. Colours arrive as a `Tone`, actions as callbacks.

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { GradientMark, type GradientMarkBranding } from "../brand/gradient-mark";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../primitives";
import { StatusDot } from "../status/status-dot";
import { TONE, type Tone } from "../status/tone";
import { useRailCollapsed } from "./rail-context";

/** One entry of the hover ⋯ menu. `href` navigates, `onSelect` fires - set one. */
export type EntityRowAction = {
    /** Stable identity when several actions share a label. */
    key?: string;
    /** Leading glyph, e.g. <Trash2 className="size-4" />. */
    icon?: ReactNode;
    label: ReactNode;
    href?: string;
    onSelect?: () => void;
    destructive?: boolean;
};

export type EntityRowProps = {
    /** Stable id - only used as the fallback React key inside menus. */
    id?: string;
    name: string;
    href: string;
    /**
     * Full avatar override (a placeholder tile for an entity with no logo yet). When absent
     * the row draws the gradient mark for `name`/`branding` plus the status dot.
     */
    avatar?: ReactNode;
    branding?: GradientMarkBranding | null;
    /** px size of the generated mark. 32 matches the rail's row height. */
    avatarSize?: number;
    /** Status dot colour, via the kit's tone families. Omit for no dot. */
    statusTone?: Tone;
    /** Escape hatch that wins over `statusTone`, e.g. "bg-success". */
    statusDotClassName?: string;
    /** The second line under the name ("$120/mo · building"). */
    metaLabel?: ReactNode;
    /** Small pill after the name (the "INBOX" flag). Content only - the pill is ours. */
    badge?: ReactNode;
    badgeClassName?: string;
    /** Selected = this entity's page is open. */
    selected?: boolean;
    /** Overrides the collapse context. */
    collapsed?: boolean;
    /** Native tooltip for the COLLAPSED row (expanded, the same text is already on screen). */
    title?: string;
    actions?: EntityRowAction[];
    /** aria-label of the ⋯ trigger. Defaults to "<name> actions". */
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
        // The generated entity logo + a status dot ringed in the rail's own fill so it reads
        // as punched out of the avatar.
        <span className="relative flex-none">
            <GradientMark name={name} branding={branding} size={avatarSize} />
            {dotClass && (
                <StatusDot
                    size="lg"
                    colorClassName={dotClass}
                    className="absolute -bottom-0.5 -right-0.5 shadow-[0_0_0_2px_var(--secondary)]"
                />
            )}
        </span>
    );

    // Collapsed rail: just the avatar, with a native tooltip carrying the details.
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
        // Hover bg lives on the wrapper so hovering the ⋯ menu (a sibling overlapping
        // the Link) lights the whole row too.
        <div className={cn("group relative rounded-md hover:bg-primary/[0.1]", className)}>
            <Link
                href={href}
                className={cn(
                    "relative flex items-center gap-3 rounded-md py-2 pl-2.5 pr-8",
                    // selected: paper fill + a terracotta bar hugging the rail edge
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
            {/* hover ⋯ menu (sits above the Link so it doesn't navigate) */}
            {actions && actions.length > 0 && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={actionsLabel ?? `${name} actions`}
                            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint opacity-0 transition hover:bg-neutral/30 hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-primary/20 data-[state=open]:opacity-100"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        {actions.map((action) => {
                            const cls = cn(
                                "gap-2",
                                action.destructive &&
                                    "text-destructive focus:bg-destructive-soft focus:text-destructive",
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
