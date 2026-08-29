"use client";

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
    key?: string;
    icon?: ReactNode;
    label: ReactNode;
    href?: string;
    onSelect?: () => void;
    destructive?: boolean;
    disabled?: boolean;
    separatorBefore?: boolean;
};

export type AccountMenuProps = {
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
