"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

// An iOS-style "segmented pill" tab bar: a card-coloured pill slides behind the active
// tab. Built to float over a full-bleed canvas, but works anywhere a small, self-contained
// tab control is wanted. Purely local state - it takes `active` and reports `onSelect`.

export type SegTab = { key: string; label: string; badge?: string | number };

export function SegmentedTabs({
    tabs,
    active,
    onSelect,
}: {
    tabs: SegTab[];
    active: string;
    onSelect: (key: string) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
    const activeIdx = tabs.findIndex((t) => t.key === active);

    // Measure the active [data-seg] child so the pill can slide to it; re-measure
    // on active change and on resize.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const node = el.querySelectorAll<HTMLElement>("[data-seg]")[activeIdx];
            if (node)
                setBox({
                    left: node.offsetLeft,
                    top: node.offsetTop,
                    width: node.offsetWidth,
                    height: node.offsetHeight,
                });
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [activeIdx]);

    return (
        <div
            ref={ref}
            className="relative inline-flex flex-nowrap items-center gap-1 rounded-full border border-border bg-secondary/80 p-1 shadow-e2 backdrop-blur"
        >
            {box.width > 0 && (
                <span
                    className="absolute rounded-full bg-card shadow-e1 transition-all duration-300 ease-out"
                    style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                />
            )}
            {tabs.map((t) => {
                const on = t.key === active;
                return (
                    <button
                        key={t.key}
                        data-seg
                        type="button"
                        onClick={() => onSelect(t.key)}
                        className={cn(
                            "relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors",
                            on
                                ? "font-semibold text-foreground"
                                : "font-medium text-faint hover:text-foreground",
                        )}
                    >
                        {t.label}
                        {t.badge != null && (
                            <span className="rounded-full bg-approval-soft px-1.5 py-px font-mono text-sm font-bold text-approval">
                                {t.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
