"use client";

import { ChevronDown, LayoutGrid, type LucideIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../primitives";

// ============================================================================
// 10 fancier tab-select variants for a page-level tab bar. Each is a controlled
// component over the same contract, so any one can drop into a real page.
//
// Tab labels, their badges and their icons are all supplied by the caller: the
// gallery ships the ten looks, the app ships the tabs. Pass `icons` keyed by
// label for the icon-bearing variants (3, 5, 6, 9) - anything unmapped falls
// back to `fallbackIcon` (LayoutGrid).
// ============================================================================

export type TabSelectorProps = {
    tabs: string[];
    active: string;
    onSelect: (t: string) => void;
    badges?: Record<string, string | number>;
    /** Label → glyph. The app owns this map; it is domain data. */
    icons?: Record<string, LucideIcon>;
    /** Used for any label missing from `icons`. */
    fallbackIcon?: LucideIcon;
};

function iconFor(p: TabSelectorProps, t: string): LucideIcon {
    return p.icons?.[t] ?? p.fallbackIcon ?? LayoutGrid;
}

// Measure the active [data-tab] child so an indicator can slide to it. Re-runs
// on active change and on container resize.
function useSlider(active: number) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const measure = () => {
            const node = el.querySelectorAll<HTMLElement>("[data-tab]")[active];
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
    }, [active]);
    return { ref, box };
}

function Badge({ v, tone = "approval" }: { v?: string | number; tone?: string }) {
    if (v == null) return null;
    return (
        <span
            className="rounded-full px-1.5 py-px font-mono text-[9.5px] font-bold"
            style={{
                background: `color-mix(in srgb, var(--${tone}) 16%, transparent)`,
                color: `var(--${tone})`,
            }}
        >
            {v}
        </span>
    );
}

// ------------------------------------------------------------- 1. Underline slide
export function UnderlineSlide({ tabs, active, onSelect, badges }: TabSelectorProps) {
    const i = tabs.indexOf(active);
    const { ref, box } = useSlider(i);
    return (
        <div ref={ref} className="relative flex items-end gap-1 border-b border-border">
            {tabs.map((t) => (
                <button
                    key={t}
                    data-tab
                    type="button"
                    onClick={() => onSelect(t)}
                    className={cn(
                        "inline-flex items-center gap-2 whitespace-nowrap px-3.5 pb-3 pt-2 text-[13px] transition-colors",
                        t === active
                            ? "font-semibold text-foreground"
                            : "font-medium text-faint hover:text-muted-foreground",
                    )}
                >
                    {t}
                    <Badge v={badges?.[t]} />
                </button>
            ))}
            <span
                className="absolute -bottom-px h-0.5 rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ left: box.left, width: box.width }}
            />
        </div>
    );
}

// ------------------------------------------------------------- 2. Segmented pill
// Close cousin of ../nav/segmented-tabs, but NOT the same look (that one is a floating
// control: bg-secondary/80 + shadow-e2 + backdrop-blur, and it takes {key,label,badge}
// objects). Both are kept.
export function SegmentedPill({ tabs, active, onSelect, badges }: TabSelectorProps) {
    const i = tabs.indexOf(active);
    const { ref, box } = useSlider(i);
    return (
        <div
            ref={ref}
            className="relative inline-flex gap-1 rounded-full border border-border bg-secondary/70 p-1"
        >
            <span
                className="absolute rounded-full bg-card shadow-e1 transition-all duration-300 ease-out"
                style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
            {tabs.map((t) => (
                <button
                    key={t}
                    data-tab
                    type="button"
                    onClick={() => onSelect(t)}
                    className={cn(
                        "relative z-10 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] transition-colors",
                        t === active
                            ? "font-semibold text-foreground"
                            : "font-medium text-faint hover:text-foreground",
                    )}
                >
                    {t}
                    <Badge v={badges?.[t]} />
                </button>
            ))}
        </div>
    );
}

// ------------------------------------------------------------- 3. Icon pills
export function IconPills(p: TabSelectorProps) {
    const { tabs, active, onSelect, badges } = p;
    return (
        <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => {
                const Icon = iconFor(p, t);
                const on = t === active;
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onSelect(t)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] transition-all",
                            on
                                ? "border-primary bg-accent font-semibold text-accent-foreground shadow-e1"
                                : "border-border bg-card font-medium text-muted-foreground hover:border-border-soft hover:text-foreground",
                        )}
                    >
                        <Icon className="size-4" strokeWidth={2} />
                        {t}
                        <Badge v={badges?.[t]} />
                    </button>
                );
            })}
        </div>
    );
}

// ------------------------------------------------------------- 4. Command bar
export function CommandBar({ tabs, active, onSelect, badges }: TabSelectorProps) {
    return (
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-e1">
            <span className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-faint">
                ⌘
            </span>
            {tabs.map((t, idx) => {
                const on = t === active;
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onSelect(t)}
                        className={cn(
                            "group inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] transition-colors",
                            on
                                ? "bg-primary font-semibold text-primary-foreground"
                                : "font-medium text-muted-foreground hover:bg-secondary",
                        )}
                    >
                        {t}
                        <Badge v={badges?.[t]} tone={on ? "primary" : "approval"} />
                        <kbd
                            className={cn(
                                "rounded border px-1 font-mono text-[9px] transition-colors",
                                on
                                    ? "border-primary-foreground/40 text-primary-foreground/80"
                                    : "border-border text-faint",
                            )}
                        >
                            {idx + 1}
                        </kbd>
                    </button>
                );
            })}
        </div>
    );
}

// ------------------------------------------------------------- 5. Vertical rail
export function VerticalRail(p: TabSelectorProps) {
    const { tabs, active, onSelect, badges } = p;
    const i = tabs.indexOf(active);
    const { ref, box } = useSlider(i);
    return (
        <div
            ref={ref}
            className="relative inline-flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-e1"
        >
            <span
                className="absolute left-2 w-1 rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ top: box.top + 8, height: box.height - 16 }}
            />
            {tabs.map((t) => {
                const Icon = iconFor(p, t);
                const on = t === active;
                return (
                    <button
                        key={t}
                        data-tab
                        type="button"
                        onClick={() => onSelect(t)}
                        className={cn(
                            "inline-flex items-center gap-3 rounded-xl py-2 pl-4 pr-5 text-[12.5px] transition-colors",
                            on
                                ? "bg-accent font-semibold text-accent-foreground"
                                : "font-medium text-muted-foreground hover:bg-secondary",
                        )}
                    >
                        <Icon className="size-4" strokeWidth={2} />
                        {t}
                        <span className="ml-auto">
                            <Badge v={badges?.[t]} />
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ------------------------------------------------------------- 6. Floating dock
export function FloatingDock(p: TabSelectorProps) {
    const { tabs, active, onSelect, badges } = p;
    const [hover, setHover] = useState<string | null>(null);
    return (
        <div className="inline-flex items-end gap-1 rounded-full border border-border bg-card/80 px-2.5 py-2 shadow-e2 backdrop-blur">
            {tabs.map((t) => {
                const Icon = iconFor(p, t);
                const on = t === active;
                const lift = on || hover === t;
                return (
                    <button
                        key={t}
                        type="button"
                        onMouseEnter={() => setHover(t)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => onSelect(t)}
                        title={t}
                        className="group relative grid place-items-center transition-transform duration-200"
                        style={{ transform: lift ? "translateY(-6px) scale(1.12)" : "none" }}
                    >
                        <span
                            className={cn(
                                "grid size-10 place-items-center rounded-2xl transition-colors",
                                on
                                    ? "bg-primary text-primary-foreground shadow-e1"
                                    : "bg-secondary text-muted-foreground group-hover:text-foreground",
                            )}
                        >
                            <Icon className="size-4.5" strokeWidth={2} />
                        </span>
                        {badges?.[t] != null && (
                            <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-approval font-mono text-[8px] font-bold text-approval-foreground">
                                {badges[t]}
                            </span>
                        )}
                        <span
                            className={cn(
                                "pointer-events-none absolute -top-7 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-[10px] font-medium text-background transition-opacity",
                                lift ? "opacity-100" : "opacity-0",
                            )}
                        >
                            {t}
                        </span>
                        <span
                            className={cn(
                                "mt-1.5 size-1 rounded-full bg-primary transition-opacity",
                                on ? "opacity-100" : "opacity-0",
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}

// ------------------------------------------------------------- 7. Numbered ticker
export function NumberedTicker({ tabs, active, onSelect, badges }: TabSelectorProps) {
    const i = tabs.indexOf(active);
    const { ref, box } = useSlider(i);
    return (
        <div className="inline-flex flex-col gap-2">
            <div ref={ref} className="relative flex gap-6">
                {tabs.map((t, idx) => {
                    const on = t === active;
                    return (
                        <button
                            key={t}
                            data-tab
                            type="button"
                            onClick={() => onSelect(t)}
                            className="group flex items-baseline gap-2"
                        >
                            <span
                                className={cn(
                                    "font-mono text-[10px] transition-colors",
                                    on ? "text-primary" : "text-faint",
                                )}
                            >
                                {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span
                                className={cn(
                                    "text-[13px] transition-colors",
                                    on
                                        ? "font-semibold text-foreground"
                                        : "font-medium text-faint group-hover:text-muted-foreground",
                                )}
                            >
                                {t}
                            </span>
                            <Badge v={badges?.[t]} />
                        </button>
                    );
                })}
            </div>
            <div className="relative h-px w-full bg-border-soft">
                <span
                    className="absolute -top-px h-0.5 rounded-full bg-primary transition-all duration-300 ease-out"
                    style={{ left: box.left, width: box.width }}
                />
            </div>
        </div>
    );
}

// ------------------------------------------------------------- 8. Glow tabs (dark)
// The only variant with hard-coded colours: it is a deliberately dark-glass control that keeps
// its look on a light page, so the hexes are not tokens and must not be "fixed".
export function GlowTabs({ tabs, active, onSelect, badges }: TabSelectorProps) {
    const i = tabs.indexOf(active);
    const { ref, box } = useSlider(i);
    return (
        <div className="inline-block rounded-2xl bg-[#0b0e1a] p-1.5">
            <div ref={ref} className="relative flex gap-1">
                <span
                    className="absolute rounded-xl transition-all duration-300 ease-out"
                    style={{
                        left: box.left,
                        top: box.top,
                        width: box.width,
                        height: box.height,
                        background: "rgba(150,130,255,0.16)",
                        boxShadow:
                            "0 0 22px -4px rgba(150,130,255,0.8), inset 0 0 0 1px rgba(150,130,255,0.4)",
                    }}
                />
                {tabs.map((t) => {
                    const on = t === active;
                    return (
                        <button
                            key={t}
                            data-tab
                            type="button"
                            onClick={() => onSelect(t)}
                            className={cn(
                                "relative z-10 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12.5px] transition-colors",
                                on
                                    ? "font-semibold text-white"
                                    : "font-medium text-[#8790b8] hover:text-[#c9cfe8]",
                            )}
                        >
                            {t}
                            <Badge v={badges?.[t]} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ------------------------------------------------------------- 9. Morphing dropdown
export function MorphDropdown(p: TabSelectorProps) {
    const { tabs, active, onSelect, badges } = p;
    const Icon = iconFor(p, active);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-e1 transition-colors hover:bg-secondary"
                >
                    <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                        <Icon className="size-4" strokeWidth={2} />
                    </span>
                    <span className="text-[13px] font-semibold text-foreground">{active}</span>
                    <Badge v={badges?.[active]} />
                    <ChevronDown className="size-4 text-faint" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-1.5">
                <div className="grid grid-cols-2 gap-1">
                    {tabs.map((t) => {
                        const I = iconFor(p, t);
                        const on = t === active;
                        return (
                            <DropdownMenuItem
                                key={t}
                                onSelect={() => onSelect(t)}
                                className={cn(
                                    "flex cursor-pointer flex-col items-start gap-1.5 rounded-lg p-2.5",
                                    on && "bg-accent",
                                )}
                            >
                                <I
                                    className={cn(
                                        "size-4",
                                        on ? "text-accent-foreground" : "text-muted-foreground",
                                    )}
                                    strokeWidth={2}
                                />
                                <span className="flex items-center gap-1.5 text-[12px] font-medium">
                                    {t}
                                    <Badge v={badges?.[t]} />
                                </span>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ------------------------------------------------------------- 10. Status tabs
// Position-based tone cycle: these are token names, not cslopslop states, so it stays here.
const STATUS_TONE = ["success", "warning", "info", "primary", "approval", "faint"];
export function StatusTabs({ tabs, active, onSelect, badges }: TabSelectorProps) {
    return (
        <div className="flex flex-wrap gap-1">
            {tabs.map((t, idx) => {
                const on = t === active;
                const tone = STATUS_TONE[idx % STATUS_TONE.length];
                return (
                    <button
                        key={t}
                        type="button"
                        onClick={() => onSelect(t)}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-lg border-l-[3px] py-1.5 pl-2.5 pr-3 text-[12.5px] transition-all",
                            on
                                ? "bg-card font-semibold text-foreground shadow-e1"
                                : "border-l-transparent font-medium text-faint hover:bg-secondary hover:text-muted-foreground",
                        )}
                        style={on ? { borderLeftColor: `var(--${tone})` } : undefined}
                    >
                        <span
                            className="size-1.5 rounded-full"
                            style={{
                                background: `var(--${tone})`,
                                boxShadow: on ? `0 0 8px -1px var(--${tone})` : "none",
                            }}
                        />
                        {t}
                        <Badge v={badges?.[t]} tone={tone} />
                    </button>
                );
            })}
        </div>
    );
}

export type TabSelectorDef = {
    id: number;
    name: string;
    blurb: string;
    Component: (p: TabSelectorProps) => ReactNode;
    dark?: boolean; // render on a dark backdrop in the showcase
};

export const TAB_SELECTORS: TabSelectorDef[] = [
    {
        id: 1,
        name: "Underline Slide",
        blurb: "Animated underline that slides to the active tab.",
        Component: UnderlineSlide,
    },
    {
        id: 2,
        name: "Segmented Pill",
        blurb: "iOS-style segmented control with a sliding pill.",
        Component: SegmentedPill,
    },
    {
        id: 3,
        name: "Icon Pills",
        blurb: "Icon + label chips, active one tinted & raised.",
        Component: IconPills,
    },
    {
        id: 4,
        name: "Command Bar",
        blurb: "⌘-number command palette bar with kbd hints.",
        Component: CommandBar,
    },
    {
        id: 5,
        name: "Vertical Rail",
        blurb: "Left icon rail with a sliding vertical marker.",
        Component: VerticalRail,
    },
    {
        id: 6,
        name: "Floating Dock",
        blurb: "macOS dock - hover to lift, active scales up.",
        Component: FloatingDock,
    },
    {
        id: 7,
        name: "Numbered Ticker",
        blurb: "01·02·03 numbering over a moving progress line.",
        Component: NumberedTicker,
    },
    {
        id: 8,
        name: "Glow Tabs",
        blurb: "Dark glass tabs with a neon glow indicator.",
        Component: GlowTabs,
        dark: true,
    },
    {
        id: 9,
        name: "Morphing Dropdown",
        blurb: "Compact trigger that opens a 2-col tab grid.",
        Component: MorphDropdown,
    },
    {
        id: 10,
        name: "Status Tabs",
        blurb: "Per-tab status dot + left accent, ticker feel.",
        Component: StatusTabs,
    },
];

/** Bind an icon map (domain data) onto every gallery entry, keeping ids/names/blurbs. */
export function withTabIcons(
    icons: Record<string, LucideIcon>,
    defs: TabSelectorDef[] = TAB_SELECTORS,
): TabSelectorDef[] {
    return defs.map((d) => ({
        ...d,
        Component: (p: TabSelectorProps) => <d.Component {...p} icons={p.icons ?? icons} />,
    }));
}
