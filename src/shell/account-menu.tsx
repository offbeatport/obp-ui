"use client";

// The account dropdown. The menu's CONTENTS are a declarative array so the host decides what
// an account can do (and can rebuild the array from live state - theme, session, deployment
// mode); the package only knows how a menu looks.

import { Fragment, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Link } from "../nav/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../primitives";

export type AccountMenuItem = {
    /** Stable identity. Falls back to `href`, then to the item's position. */
    key?: string;
    /** Leading glyph, e.g. <Settings2 />. Sized by the menu item itself. */
    icon?: ReactNode;
    label: ReactNode;
    /** Navigates when set. */
    href?: string;
    /** Fires when there is no `href`. */
    onSelect?: () => void;
    destructive?: boolean;
    disabled?: boolean;
    /** Draw a rule above this item - how a flat array expresses groups. */
    separatorBefore?: boolean;
};

export type AccountMenuProps = {
    /** The trigger - typically <AccountButton />. Rendered with `asChild`. */
    trigger: ReactNode;
    items: AccountMenuItem[];
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    className?: string;
};

export function AccountMenu({
    trigger,
    items,
    align = "start",
    side = "top",
    className,
}: AccountMenuProps) {
    // Keys are resolved here rather than in the JSX so a positional fallback never reads as
    // "keyed by array index" at the call site.
    const rows = items.map((item, i) => ({ item, key: item.key ?? item.href ?? `item-${i}` }));
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent align={align} side={side} className={cn("w-60", className)}>
                {rows.map(({ item, key }) => {
                    const cls = item.destructive
                        ? "text-destructive focus:bg-destructive-soft focus:text-destructive"
                        : undefined;
                    return (
                        <Fragment key={key}>
                            {item.separatorBefore && <DropdownMenuSeparator />}
                            {item.href ? (
                                <DropdownMenuItem asChild disabled={item.disabled} className={cls}>
                                    <Link href={item.href}>
                                        {item.icon}
                                        {item.label}
                                    </Link>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onSelect={item.onSelect}
                                    disabled={item.disabled}
                                    className={cls}
                                >
                                    {item.icon}
                                    {item.label}
                                </DropdownMenuItem>
                            )}
                        </Fragment>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
