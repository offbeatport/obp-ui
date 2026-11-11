"use client";

import { cn } from "../lib/cn";

export type SegTab = { key: string; label: string; badge?: string | number };

export function SegmentedTabs({
    tabs,
    active,
    onSelect,
    size = "default",
}: {
    tabs: SegTab[];
    active: string;
    onSelect: (key: string) => void;
    size?: "default" | "sm";
}) {
    return (
        <div className="inline-flex flex-nowrap items-center gap-0.5 rounded-none border border-border bg-tabs-background p-0.5">
            {tabs.map((t) => {
                const on = t.key === active;
                return (
                    <button
                        key={t.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onSelect(t.key)}
                        className={cn(
                            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-none border text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            size === "sm" ? "h-7 px-2.5" : "h-7.5 px-3",
                            on
                                ? "border-transparent bg-tabs-active text-accent-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {t.label}
                        {t.badge != null && (
                            <span className="font-mono text-sm text-approval tabular-nums">
                                {t.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
