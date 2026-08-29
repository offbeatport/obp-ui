"use client";

import { cn } from "../lib/cn";
import { Link } from "./link";
import { useNav } from "./ui-provider";

export type TabNavItem = { href: string; label: string };

export function TabNav({ tabs, className }: { tabs: TabNavItem[]; className?: string }) {
    const { pathname } = useNav();
    return (
        <nav className={cn("mt-5 flex gap-1 border-b", className)}>
            {tabs.map((t) => {
                const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
                return (
                    <Link
                        key={t.href}
                        href={t.href}
                        className={cn(
                            "-mb-px border-b-2 px-3.5 py-2 text-sm font-medium",
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
