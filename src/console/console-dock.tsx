"use client";

// Aliased so the DOM's PointerEvent / KeyboardEvent (the window listeners below use them)
// stay reachable in this file.
import type {
    KeyboardEvent as ReactKeyboardEvent,
    ReactNode,
    PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { prefStorage } from "../lib/storage";
import { DEFAULT_NAMESPACE } from "../lib/theme";
import { LiveDot } from "../status/live-dot";
import { ConsolePane, type ConsoleStatusChip } from "./console-pane";
import type { LogLineData } from "./log-line";

// AGENT CONSOLE DOCK - the bottom-docked "one agent per company, live" panel from
// design/v2-prototypes/08-chat-spine-pro-v7.html. Opens with the bottom-right tab
// or Ctrl+` ; closes with ✕ or Esc. It POLLS ONE digest function (adaptive:
// 0.75s while any run is active, 4s idle) with a per-pane cursor, so steady-state
// polls carry only new lines. Nothing is fetched until the console opens, and
// polling pauses when the tab is hidden.
//
// The TRANSPORT is injected (`fetchDigest`) - the web app hands it a server function,
// the desktop app hands it a Tauri command. Everything about HOW the console polls is
// UI behaviour and stays here.
//
// Styling is Tailwind, co-located here (was a ~330-line .console* block in the app's
// globals.css). It follows the global light/dark theme via the shared token utilities
// (bg-card, border-border, text-success, …); the "live" sonar dot is <LiveDot>. Hiding
// the launcher tab is driven by the pre-paint `html.console-tab-off` class (see
// `consoleTabPref` in lib/prepaint) via an arbitrary variant, so there's no flash.

const ACTIVE_MS = 750;
const IDLE_MS = 4000;
const MAX_LINES = 80;
const MIN_H = 160; // px
const STEP = 28; // px per arrow-key nudge
// Same namespace the pre-paint script and the theme derive their keys from, so an app
// that never passes `heightKey` still gets a key that matches its other preferences.
const DEFAULT_HEIGHT_KEY = `${DEFAULT_NAMESPACE}-console-h`;

const clampH = (h: number) => Math.max(MIN_H, Math.min(h, window.innerHeight - 40));

/** One delta line as the digest carries it (`off` is the transport's cursor unit). */
export type ConsoleDigestLine = LogLineData & { off?: number };

/**
 * The minimum a pane must carry. Apps hand in their own richer pane type (branding, tone,
 * state, …) and read it back in the render props - `ConsoleDock` never looks at the extras.
 */
export type ConsoleDockPane = {
    slug: string;
    name: string;
    /** A run is genuinely live - drives both the working ticker and the poll interval. */
    active: boolean;
    /** Latest offset the client should send back next poll. */
    cursor: number;
    /** DELTA since the client's cursor (full window on first poll). */
    lines: readonly ConsoleDigestLine[];
};

export type ConsoleDigest<P extends ConsoleDockPane = ConsoleDockPane> = {
    panes: readonly P[];
    anyActive: boolean;
};

export type ConsoleDockProps<P extends ConsoleDockPane = ConsoleDockPane> = {
    /** The one read the console polls. Cursors are keyed by pane slug. */
    fetchDigest: (cursors: Record<string, number>) => Promise<ConsoleDigest<P>>;
    /** The pane's leading avatar. */
    renderLogo?: (pane: P) => ReactNode;
    /** The pane's state chip - label + token colour pair. */
    paneStatus?: (pane: P) => ConsoleStatusChip | undefined;
    /** The pane's title. Defaults to `pane.name`. */
    paneTitle?: (pane: P) => ReactNode;
    /** Storage key for the dragged height. Defaults to `<namespace>-console-h`. */
    heightKey?: string;
    title?: ReactNode;
    subtitle?: ReactNode;
    /** Text on the launcher tab. */
    launcherLabel?: ReactNode;
    /** The working ticker under a live pane's last line. */
    activeLabel?: ReactNode;
    /** Lines kept per pane; the buffer is capped and drops the oldest. Default 80. */
    maxLines?: number;
    /** Poll interval while any pane is active / while all are idle, in ms. */
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
    // Panel height: null = CSS default (70vh); a number overrides it (in px). Loaded
    // from storage after mount so SSR/hydration match on the CSS default.
    const [heightPx, setHeightPx] = useState<number | null>(null);
    const heightRef = useRef<number | null>(null);

    // The transport lives in a ref so a caller passing a fresh arrow on every render can
    // never restart the poll loop (that would spin it: poll → render → restart → poll).
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

    // Restore a saved height, and re-clamp if the window shrinks below it.
    useEffect(() => {
        const saved = Number(prefStorage().get(heightKey));
        if (Number.isFinite(saved) && saved > 0) setHeight(saved);
        const onResize = () => {
            if (heightRef.current) setHeight(heightRef.current);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [setHeight, heightKey]);

    // Drag the top handle to resize; height = distance from pointer to viewport bottom.
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

    // Global keybinds: Ctrl+` (or ~) toggles, Esc closes. Active even while closed
    // so the shortcut opens the console.
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

    // Adaptive poll - only while open AND the tab is visible. cursorsRef persists
    // across close/open so reopening resumes deltas instead of re-seeding.
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
                    /* transient - retry next tick */
                } finally {
                    inFlight = false;
                }
            }
            if (stopped) return;
            timer = setTimeout(tick, anyActiveRef.current ? activeMs : idleMs);
        };

        void tick();
        // Only relaunch on re-focus if no tick is mid-fetch - otherwise a tab flip during an
        // in-flight poll would spawn a second self-perpetuating chain and multiply the rate.
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
                    "fixed right-[30px] bottom-0 z-[88] flex items-center gap-2 rounded-t-[10px] border border-b-0 border-border bg-card px-3.5 pt-[7px] pb-[9px] font-mono text-[11px] font-semibold tracking-[0.04em] text-muted-foreground shadow-[0_-3px_16px_rgba(0,0,0,0.16)] transition-[transform,color] duration-[140ms] hover:-translate-y-0.5 hover:text-foreground",
                    // "skirt" pinned beneath the tab - lifts with the hover so no page
                    // background shows below the raised button.
                    "after:absolute after:-left-px after:-right-px after:top-[calc(100%-1px)] after:h-2 after:border-x after:border-border after:bg-card after:content-['']",
                    // hidden while open, and when the pre-paint tab-off pref is set on <html>.
                    // The class is a literal on purpose: Tailwind can only build the variant
                    // for a class name it can see in the source.
                    open && "hidden",
                    "[html.console-tab-off_&]:hidden",
                )}
            >
                <LiveDot />
                <span>{launcherLabel}</span>
                <span className="text-[10px] text-faint">⌃`</span>
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
                    <div className="flex items-center gap-[9px] font-mono text-[13px] font-bold tracking-[0.02em] text-foreground">
                        <LiveDot /> {title}{" "}
                        <span className="font-mono text-[10.5px] font-normal tracking-[0.03em] text-muted-foreground">
                            {subtitle}
                        </span>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="flex gap-[3px] [&_kbd]:rounded-[4px] [&_kbd]:border [&_kbd]:border-border [&_kbd]:bg-muted [&_kbd]:px-[5px] [&_kbd]:py-px [&_kbd]:font-mono [&_kbd]:text-[10px] [&_kbd]:text-muted-foreground">
                            <kbd>Ctrl</kbd>
                            <kbd>`</kbd>
                        </span>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            aria-label="Close console"
                            className="grid size-[26px] place-items-center rounded-[7px] border border-border bg-transparent text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-px overflow-auto bg-border">
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
