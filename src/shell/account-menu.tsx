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
    spacing?: "compact" | "comfortable";
    className?: string;
};

export function AccountMenu({
    trigger,
    items,
    align = "start",
    side = "top",
    spacing = "compact",
    className,
}: AccountMenuProps) {
    const rows = items.map((item, i) => ({ item, key: item.key ?? item.href ?? `item-${i}` }));
    const comfortable = spacing === "comfortable";
    const rowClass = comfortable ? "gap-2.5 px-3 py-2" : undefined;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
            <DropdownMenuContent
                align={align}
                side={side}
                className={cn(comfortable ? "w-64 p-1.5" : "w-60", className)}
            >
                {rows.map(({ item, key }) => {
                    const cls = cn(
                        rowClass,
                        item.destructive &&
                            "text-destructive focus:bg-destructive-soft focus:text-destructive",
                    );
                    return (
                        <Fragment key={key}>
                            {item.separatorBefore && (
                                <DropdownMenuSeparator
                                    className={comfortable ? "my-1.5" : undefined}
                                />
                            )}
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
