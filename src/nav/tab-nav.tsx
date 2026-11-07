"use client";

import { cn } from "../lib/cn";
import { Link } from "./link";
import { useNav } from "./ui-provider";

export type TabNavItem = { href: string; label: string };

function activeHref(tabs: TabNavItem[], pathname: string): string | undefined {
    const matches = tabs.filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`));
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function TabNav({
    tabs,
    label,
    className,
}: {
    tabs: TabNavItem[];
    label?: string;
    className?: string;
}) {
    const { pathname } = useNav();
    const current = activeHref(tabs, pathname);
    return (
        <nav aria-label={label} className={cn("flex gap-1 border-b", className)}>
            {tabs.map((t) => {
                const active = t.href === current;
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                            "-mb-px inline-flex h-8 items-center whitespace-nowrap rounded-sm border-b-2 px-3 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                            active
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
