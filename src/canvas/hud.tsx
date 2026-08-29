"use client";

import type { CSSProperties } from "react";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/cn";

export const CANVAS_PANEL = "rounded-[14px] border border-border bg-card/85 backdrop-blur";

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

export type CanvasHudStat = { label: string; value: ReactNode; alert?: boolean };

export type CanvasHudProps = {
    title: ReactNode;
    note?: ReactNode;
    stats: CanvasHudStat[];
    moves?: string[];
    movesLabel?: ReactNode;
    statsClassName?: string;
    className?: string;
};

export function CanvasHud({
    title,
    note,
    stats,
    moves = [],
    movesLabel = "// next moves",
    statsClassName = "grid grid-cols-3 gap-2",
    className,
}: CanvasHudProps) {
    return (
        <CanvasPanel className={cn("w-[330px] px-4 py-3.5", className)}>
            <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-[0.04em]">{title}</span>
                {note !== undefined && (
                    <span className="ml-auto font-mono text-sm tracking-[0.08em] text-faint">
                        {note}
                    </span>
                )}
            </div>
            <div className={statsClassName}>
                {stats.map((s) => (
                    <div
                        key={s.label}
                        className="rounded-[9px] border border-border bg-white/[0.02] px-1.5 py-1.5 text-center"
                    >
                        <b
                            className={cn(
                                "block font-mono text-base",
                                s.alert && "text-[color:var(--approval)]",
                            )}
                        >
                            {s.value}
                        </b>
                        <span className="font-mono text-sm uppercase tracking-[0.04em] text-faint">
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>
            {moves.length > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                    <div className="mb-1.5 font-mono text-sm uppercase tracking-[0.14em] text-faint">
                        {movesLabel}
                    </div>
                    {moves.map((m, i) => (
                        <div
                            key={m}
                            className="mb-1.5 flex gap-2 text-sm leading-[1.4] text-muted-foreground last:mb-0"
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

export type CanvasActivityItem = {
    id: string;
    group: string;
    text: ReactNode;
    ago?: ReactNode;
    color?: string;
};

export type CanvasActivityStripProps = {
    items: CanvasActivityItem[];
    expandLabel?: ReactNode;
    collapseLabel?: ReactNode;
    className?: string;
};

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
                <span
                    aria-hidden="true"
                    className="size-2 flex-none animate-pulse rounded-full bg-[color:var(--success)]"
                />
                <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
                    <b className="text-[color:var(--info)]">{latest.group}</b> · {latest.text}
                </span>
                <span className="flex-none font-mono text-sm tracking-[0.08em] text-faint">
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
                            <div className="mb-1.5 font-mono text-sm uppercase tracking-[0.14em] text-faint">
                                {group}
                            </div>
                            {list.map((a) => (
                                <div
                                    key={a.id}
                                    className="mb-1.5 flex items-center gap-2 font-mono text-sm text-muted-foreground last:mb-0"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-1.5 flex-none rounded-full"
                                        style={{ background: a.color }}
                                    />
                                    <span className="flex-1 truncate">{a.text}</span>
                                    <span className="flex-none font-mono text-sm text-faint">
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

export type CanvasCommandBarProps = {
    onSubmit: (value: string) => void;
    placeholder?: string;
    prefix?: ReactNode;
    submitLabel?: ReactNode;
    className?: string;
};

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
                className="nodrag nopan flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
            />
            <button
                type="button"
                onClick={send}
                className="nodrag nopan rounded-[9px] bg-[color:var(--info)] px-3.5 py-1.5 text-sm font-semibold text-info-foreground transition-opacity hover:opacity-90"
            >
                {submitLabel}
            </button>
        </CanvasPanel>
    );
}
