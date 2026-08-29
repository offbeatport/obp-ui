"use client";

import type {
    KeyboardEvent as ReactKeyboardEvent,
    ReactNode,
    PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { prefStorage } from "../lib/storage";
import { DEFAULT_NAMESPACE } from "../lib/theme";
import { ConsolePane, type ConsoleStatusChip } from "./console-pane";
import type { LogLineData } from "./log-line";

function SonarDot() {
    return (
        <span aria-hidden="true" className="relative inline-flex size-2 flex-none">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-75" />
            <span className="relative size-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
        </span>
    );
}

const ACTIVE_MS = 750;
const IDLE_MS = 4000;
const MAX_LINES = 80;
const MIN_H = 160;
const STEP = 28;
const DEFAULT_HEIGHT_KEY = `${DEFAULT_NAMESPACE}-console-h`;

const clampH = (h: number) => Math.max(MIN_H, Math.min(h, window.innerHeight - 40));

export type ConsoleDigestLine = LogLineData & { off?: number };

export type ConsoleDockPane = {
    slug: string;
    name: string;
    active: boolean;
    cursor: number;
    lines: readonly ConsoleDigestLine[];
};

export type ConsoleDigest<P extends ConsoleDockPane = ConsoleDockPane> = {
    panes: readonly P[];
    anyActive: boolean;
};

export type ConsoleDockProps<P extends ConsoleDockPane = ConsoleDockPane> = {
    fetchDigest: (cursors: Record<string, number>) => Promise<ConsoleDigest<P>>;
    renderLogo?: (pane: P) => ReactNode;
    paneStatus?: (pane: P) => ConsoleStatusChip | undefined;
    paneTitle?: (pane: P) => ReactNode;
    heightKey?: string;
    title?: ReactNode;
    subtitle?: ReactNode;
    launcherLabel?: ReactNode;
    activeLabel?: ReactNode;
    maxLines?: number;
    activeMs?: number;
    idleMs?: number;
};

export function ConsoleDock<P extends ConsoleDockPane = ConsoleDockPane>({
    fetchDigest,
    renderLogo,
    paneStatus,
    paneTitle,
    heightKey = DEFAULT_HEIGHT_KEY,
    title = "Agent console",
    subtitle = "one agent per company · live",
    launcherLabel = "agents",
    activeLabel,
    maxLines = MAX_LINES,
    activeMs = ACTIVE_MS,
    idleMs = IDLE_MS,
}: ConsoleDockProps<P>) {
    const [open, setOpen] = useState(false);
    const [panes, setPanes] = useState<readonly P[]>([]);
    const [lines, setLines] = useState<Record<string, ConsoleDigestLine[]>>({});
    const cursorsRef = useRef<Record<string, number>>({});
    const anyActiveRef = useRef(false);
    const [heightPx, setHeightPx] = useState<number | null>(null);
    const heightRef = useRef<number | null>(null);

    const fetchRef = useRef(fetchDigest);
    useEffect(() => {
        fetchRef.current = fetchDigest;
    }, [fetchDigest]);

    const setHeight = useCallback((h: number) => {
        const c = clampH(h);
        heightRef.current = c;
        setHeightPx(c);
    }, []);
    const persistHeight = useCallback(() => {
        if (heightRef.current) prefStorage().set(heightKey, String(Math.round(heightRef.current)));
    }, [heightKey]);

    useEffect(() => {
        const saved = Number(prefStorage().get(heightKey));
        if (Number.isFinite(saved) && saved > 0) setHeight(saved);
        const onResize = () => {
            if (heightRef.current) setHeight(heightRef.current);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [setHeight, heightKey]);

    const onResizePointerDown = useCallback(
        (e: ReactPointerEvent) => {
            e.preventDefault();
            document.body.style.userSelect = "none";
            const move = (ev: PointerEvent) => setHeight(window.innerHeight - ev.clientY);
            const up = () => {
                document.body.style.userSelect = "";
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                persistHeight();
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
        },
        [setHeight, persistHeight],
    );
    const onResizeKeyDown = useCallback(
        (e: ReactKeyboardEvent) => {
            const cur = heightRef.current ?? Math.round(window.innerHeight * 0.7);
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setHeight(cur + STEP);
                persistHeight();
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setHeight(cur - STEP);
                persistHeight();
            }
        },
        [setHeight, persistHeight],
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "`" || e.key === "~")) {
                e.preventDefault();
                setOpen((o) => !o);
            } else if (e.key === "Escape") {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        if (!open) return;
        let stopped = false;
        let inFlight = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            if (stopped) return;
            if (document.visibilityState === "visible") {
                inFlight = true;
                try {
                    const resp = await fetchRef.current(cursorsRef.current);
                    if (stopped) return;
                    setPanes(resp.panes);
                    setLines((prev) => {
                        const next: Record<string, ConsoleDigestLine[]> = { ...prev };
                        for (const p of resp.panes) {
                            if (p.lines.length)
                                next[p.slug] = [...(next[p.slug] ?? []), ...p.lines].slice(
                                    -maxLines,
                                );
                            cursorsRef.current[p.slug] = p.cursor;
                        }
                        return next;
                    });
                    anyActiveRef.current = resp.anyActive;
                } catch {
                } finally {
                    inFlight = false;
                }
            }
            if (stopped) return;
            timer = setTimeout(tick, anyActiveRef.current ? activeMs : idleMs);
        };

        void tick();
        const onVis = () => {
            if (document.visibilityState === "visible" && !stopped && !inFlight) {
                if (timer) clearTimeout(timer);
                void tick();
            }
        };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            stopped = true;
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [open, maxLines, activeMs, idleMs]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Open agent console (Ctrl+`)"
                className={cn(
                    "fixed right-[30px] bottom-0 z-[88] flex items-center gap-2 rounded-t-[10px] border border-b-0 border-border bg-card px-3.5 pt-[7px] pb-[9px] font-mono text-sm font-semibold tracking-[0.04em] text-muted-foreground shadow-[0_-3px_16px_rgba(0,0,0,0.16)] transition-[transform,color] duration-[140ms] hover:-translate-y-0.5 hover:text-foreground",
                    "after:absolute after:-left-px after:-right-px after:top-[calc(100%-1px)] after:h-2 after:border-x after:border-border after:bg-card after:content-['']",
                    open && "hidden",
                    "[html.console-tab-off_&]:hidden",
                )}
            >
                <SonarDot />
                <span>{launcherLabel}</span>
                <span className="text-sm text-faint">⌃`</span>
            </button>

            <section
                aria-label="Agent console"
                aria-hidden={!open}
                inert={!open}
                style={heightPx ? { height: `${heightPx}px` } : undefined}
                className={cn(
                    "fixed inset-x-0 bottom-0 z-[92] flex h-[70vh] flex-col border-t border-border bg-card text-foreground shadow-[0_-18px_50px_rgba(0,0,0,0.28)] transition-transform duration-[220ms] ease-[cubic-bezier(0.4,0,0.1,1)]",
                    open ? "translate-y-0" : "translate-y-[101%]",
                )}
            >
                <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize console (drag, or arrow keys)"
                    tabIndex={0}
                    onPointerDown={onResizePointerDown}
                    onKeyDown={onResizeKeyDown}
                    className="relative h-2 flex-none cursor-ns-resize touch-none outline-none after:absolute after:left-1/2 after:top-0.5 after:h-[3px] after:w-11 after:-translate-x-1/2 after:rounded-[3px] after:bg-border after:transition-colors after:content-[''] hover:after:bg-muted-foreground focus-visible:after:bg-muted-foreground"
                />
                <div className="flex flex-none items-center gap-3 border-b border-border bg-secondary px-[18px] py-[11px]">
                    <div className="flex items-center gap-[9px] font-mono text-base font-bold tracking-[0.02em] text-foreground">
                        <SonarDot /> {title}{" "}
                        <span className="font-mono text-sm font-normal tracking-[0.03em] text-muted-foreground">
                            {subtitle}
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="flex gap-[3px] [&_kbd]:rounded-[4px] [&_kbd]:border [&_kbd]:border-border [&_kbd]:bg-muted [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-sm [&_kbd]:text-muted-foreground">
                            <kbd>Ctrl</kbd>
                            <kbd>`</kbd>
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close console"
                            className="grid size-[26px] place-items-center rounded-[7px] border border-border bg-transparent text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-px overflow-auto bg-border">
                    {panes.map((p) => (
                        <ConsolePane
                            key={p.slug}
                            title={paneTitle ? paneTitle(p) : p.name}
                            logo={renderLogo?.(p)}
                            status={paneStatus?.(p)}
                            lines={lines[p.slug] ?? []}
                            active={p.active}
                            activeLabel={activeLabel}
                        />
                    ))}
                </div>
            </section>
        </>
    );
}
