"use client";

import type { CSSProperties } from "react";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { StatTile } from "../status/stat-tile";
import { StatusDot } from "../status/status-dot";

// Fixed HUD overlays for the command-surface board (rendered as React Flow <Panel>s).
// Dark-themed - they live inside the forced-`.dark` canvas. Ported from the 05
// prototype's corner panels; all copy arrives as props.

export const CANVAS_PANEL = "rounded-[14px] border border-border bg-card/85 backdrop-blur";

/** The frosted panel every HUD overlay is built on. */
export function CanvasPanel({
    children,
    className,
    style,
}: { children: ReactNode; className?: string; style?: CSSProperties }) {
    return (
        <div className={cn(CANVAS_PANEL, className)} style={style}>
            {children}
        </div>
    );
}

// ------------------------------------------------------------------- top-left
export type CanvasHudStat = { label: string; value: ReactNode; alert?: boolean };

export type CanvasHudProps = {
    /** Board identity lockup (a wordmark). */
    title: ReactNode;
    /** Right-aligned mono note ("// command surface"). */
    note?: ReactNode;
    stats: CanvasHudStat[];
    /** Prose lines under the hairline. Strings, so each is its own stable key. */
    moves?: string[];
    movesLabel?: ReactNode;
    /** Override when the stat count is not five. */
    statsClassName?: string;
    className?: string;
};

/** Top-left: board identity + headline stats + next moves. */
export function CanvasHud({
    title,
    note,
    stats,
    moves = [],
    movesLabel = "// next moves",
    statsClassName = "grid grid-cols-5 gap-2",
    className,
}: CanvasHudProps) {
    return (
        <CanvasPanel className={cn("w-[330px] px-4 py-3.5", className)}>
            <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-[13px] font-bold tracking-[0.04em]">{title}</span>
                {note !== undefined && (
                    <span className="ml-auto font-mono text-[9.5px] tracking-[0.08em] text-faint">
                        {note}
                    </span>
                )}
            </div>
            <div className={statsClassName}>
                {stats.map((s) => (
                    <StatTile
                        key={s.label}
                        variant="cell"
                        value={s.value}
                        label={s.label}
                        alert={s.alert}
                    />
                ))}
            </div>
            {moves.length > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                    <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                        {movesLabel}
                    </div>
                    {moves.map((m, i) => (
                        <div
                            key={m}
                            className="mb-1.5 flex gap-2 text-[11.5px] leading-[1.4] text-muted-foreground last:mb-0"
                        >
                            <span className="flex-none font-mono text-[color:var(--info)]">
                                {i + 1}.
                            </span>
                            <span>{m}</span>
                        </div>
                    ))}
                </div>
            )}
        </CanvasPanel>
    );
}

// ----------------------------------------------------------------- top-center
export type CanvasActivityItem = {
    id: string;
    /** Section this line belongs to - the strip groups by it, in first-seen order. */
    group: string;
    text: ReactNode;
    ago?: ReactNode;
    /** The line's tone dot. Any CSS colour; the app owns the tone → colour map. */
    color?: string;
};

export type CanvasActivityStripProps = {
    /** Newest first - the collapsed line shows items[0]. */
    items: CanvasActivityItem[];
    expandLabel?: ReactNode;
    collapseLabel?: ReactNode;
    className?: string;
};

/** Top-center: live activity strip, collapsible into a per-group stream. */
export function CanvasActivityStrip({
    items,
    expandLabel = "▾ stream",
    collapseLabel = "▴ collapse",
    className,
}: CanvasActivityStripProps) {
    const [open, setOpen] = useState(false);
    if (!items.length) return null;
    const latest = items[0];
    const groups = new Map<string, CanvasActivityItem[]>();
    for (const a of items) {
        const list = groups.get(a.group);
        if (list) list.push(a);
        else groups.set(a.group, [a]);
    }
    return (
        <CanvasPanel className={cn("w-[460px] max-w-[46vw] overflow-hidden", className)}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            >
                <StatusDot
                    size="lg"
                    colorClassName="bg-[color:var(--success)]"
                    pulse
                    className="flex-none"
                />
                <span className="flex-1 truncate font-mono text-[11.5px] text-muted-foreground">
                    <b className="text-[color:var(--info)]">{latest.group}</b> · {latest.text}
                </span>
                <span className="flex-none font-mono text-[10px] tracking-[0.08em] text-faint">
                    {open ? collapseLabel : expandLabel}
                </span>
            </button>
            {open && (
                <div className="max-h-[300px] overflow-y-auto border-t border-border">
                    {[...groups.entries()].map(([group, list]) => (
                        <div
                            key={group}
                            className="border-b border-border px-3.5 py-2.5 last:border-b-0"
                        >
                            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                                {group}
                            </div>
                            {list.map((a) => (
                                <div
                                    key={a.id}
                                    className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground last:mb-0"
                                >
                                    <StatusDot size="sm" color={a.color} className="flex-none" />
                                    <span className="flex-1 truncate">{a.text}</span>
                                    <span className="flex-none font-mono text-[9.5px] text-faint">
                                        {a.ago}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </CanvasPanel>
    );
}

// -------------------------------------------------------------- bottom-center
export type CanvasCommandBarProps = {
    /** Receives the typed text; the field clears itself afterwards. */
    onSubmit: (value: string) => void;
    placeholder?: string;
    /** Leading glyph. */
    prefix?: ReactNode;
    submitLabel?: ReactNode;
    className?: string;
};

/** Bottom-center: the board's command bar. */
export function CanvasCommandBar({
    onSubmit,
    placeholder,
    prefix = "›",
    submitLabel = "Send",
    className,
}: CanvasCommandBarProps) {
    const [v, setV] = useState("");
    const send = () => {
        setV("");
        onSubmit(v);
    };
    // The blue rim + halo stays an inline box-shadow: Tailwind v4 hoists shadow colours into
    // --tw-shadow-color and mangles the color-mix() payload.
    return (
        <CanvasPanel
            className={cn(
                "flex w-[560px] max-w-[70vw] items-center gap-2.5 px-3.5 py-2.5",
                className,
            )}
            style={{
                boxShadow:
                    "0 14px 50px rgba(0,0,0,.6), 0 0 0 1px color-mix(in srgb, var(--info) 40%, transparent), 0 0 24px color-mix(in srgb, var(--info) 24%, transparent)",
            }}
        >
            <span className="font-mono font-bold text-[color:var(--info)]">{prefix}</span>
            <input
                value={v}
                onChange={(e) => setV(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={placeholder}
                className="nodrag nopan flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            />
            <button
                type="button"
                onClick={send}
                className="nodrag nopan rounded-[9px] bg-[color:var(--info)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
                {submitLabel}
            </button>
        </CanvasPanel>
    );
}
