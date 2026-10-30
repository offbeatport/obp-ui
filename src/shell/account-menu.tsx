"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { type ThemePref, getThemePref, onThemeChange, setThemePref } from "../lib/theme";
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
    kind?: "item" | "theme";
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

const THEME_PREFS: { value: ThemePref; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
];

function isThemePref(value: unknown): value is ThemePref {
    return value === "light" || value === "dark" || value === "system";
}

function ThemeRow({
    icon,
    label,
    className,
}: { icon?: ReactNode; label: ReactNode; className?: string }) {
    const [pref, setPref] = useState<ThemePref>(getThemePref);
    useEffect(() => onThemeChange(() => setPref(getThemePref())), []);
    return (
        <div
            className={cn(
                "flex items-center gap-2 px-2 py-1 text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
                className,
            )}
        >
            {icon}
            <span className="flex-1">{label}</span>
            <MenuPrimitive.RadioGroup
                value={pref}
                onValueChange={(value) => {
                    if (isThemePref(value)) setThemePref(value);
                }}
                aria-label="Theme"
                className="flex"
            >
                {THEME_PREFS.map((option) => (
                    <MenuPrimitive.RadioItem
                        key={option.value}
                        value={option.value}
                        closeOnClick={false}
                        className="flex h-6 cursor-default items-center rounded-sm px-1.5 text-sm text-muted-foreground outline-hidden select-none data-highlighted:not-data-checked:bg-secondary data-highlighted:text-foreground data-checked:bg-accent data-checked:text-accent-foreground"
                    >
                        {option.label}
                    </MenuPrimitive.RadioItem>
                ))}
            </MenuPrimitive.RadioGroup>
        </div>
    );
}

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
                            {item.kind === "theme" ? (
                                <ThemeRow
                                    icon={item.icon}
                                    label={item.label}
                                    className={cn(cls, comfortable && "py-1.5")}
                                />
                            ) : item.href ? (
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
