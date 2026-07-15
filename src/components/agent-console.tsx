import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyLogo } from "~/components/company-logo";
import type { Branding } from "~/config/spin";
import { cn } from "~/lib/utils";
import type { ConsoleLine, ConsolePaneState } from "~/server/console";
import { getConsoleDigest } from "~/server/console";
import type { Tone } from "~/server/data";

// AGENT CONSOLE - bottom-docked "one agent per company, live" panel from
// design/v2-prototypes/08-chat-spine-pro-v7.html. Opens with the bottom-right tab
// or Ctrl+` ; closes with ✕ or Esc. It POLLS ONE digest endpoint (adaptive:
// 0.75s while any run is active, 4s idle) with a per-pane cursor, so steady-state
// polls carry only new lines. No connection is opened until the console opens,
// and polling pauses when the tab is hidden.
//
// Styling is Tailwind, co-located here (was a ~330-line .console* block in
// globals.css). It follows the global light/dark theme via the shared token
// utilities (bg-card, border-border, text-success, …); the "live" sonar dot is
// Tailwind's native animate-ping. Hiding the launcher tab is still driven by the
// pre-paint `html.console-tab-off` class (set in __root before hydration) via an
// arbitrary variant, so there's no flash.

const ACTIVE_MS = 750;
const IDLE_MS = 4000;
const MAX_LINES = 80;
const HEIGHT_KEY = "cslopslop-console-h";
const MIN_H = 160; // px
const STEP = 28; // px per arrow-key nudge
const clampH = (h: number) => Math.max(MIN_H, Math.min(h, window.innerHeight - 40));

type PaneMeta = {
    slug: string;
    name: string;
    tone: Tone;
    branding?: Branding;
    state: ConsolePaneState;
    active: boolean;
};

// Per-pane state chip → its token color pair (text + tinted fill).
const STATE_CHIP: Record<ConsolePaneState, string> = {
    building: "text-info bg-info-soft",
    awaiting_approval: "text-approval bg-approval-soft",
    shipped: "text-success bg-success-soft",
    blocked: "text-destructive bg-destructive-soft",
    todo: "text-neutral bg-neutral-soft",
};
const STATE_LABEL: Record<ConsolePaneState, string> = {
    building: "building",
    awaiting_approval: "needs you",
    shipped: "live",
    blocked: "blocked",
    todo: "queued",
};
// Log-line kind → the message color (timestamp stays faint).
const KIND_TEXT: Partial<Record<ConsoleLine["kind"], string>> = {
    act: "text-primary",
    ok: "text-success",
    warn: "text-warning",
    info: "text-info",
};

// The "live" indicator: a crisp success-colored core with an expanding sonar ring
// (Tailwind's animate-ping). Replaces the old .ct-dot ::after keyframe.
function LiveDot() {
    return (
        <span className="relative inline-flex size-2 flex-none">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-75" />
            <span className="relative size-2 rounded-full bg-success shadow-[0_0_6px_var(--success)]" />
        </span>
    );
}

function hms(t: number): string {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function AgentConsole() {
    const [open, setOpen] = useState(false);
    const [panes, setPanes] = useState<PaneMeta[]>([]);
    const [lines, setLines] = useState<Record<string, ConsoleLine[]>>({});
    const cursorsRef = useRef<Record<string, number>>({});
    const anyActiveRef = useRef(false);
    // Panel height: null = CSS default (70vh); a number overrides it (in px). Loaded
    // from localStorage after mount so SSR/hydration match on the CSS default.
    const [heightPx, setHeightPx] = useState<number | null>(null);
    const heightRef = useRef<number | null>(null);

    const setHeight = useCallback((h: number) => {
        const c = clampH(h);
        heightRef.current = c;
        setHeightPx(c);
    }, []);
    const persistHeight = useCallback(() => {
        if (heightRef.current) {
            try {
                localStorage.setItem(HEIGHT_KEY, String(Math.round(heightRef.current)));
            } catch {
                /* storage unavailable */
            }
        }
    }, []);

    // Restore a saved height, and re-clamp if the window shrinks below it.
    useEffect(() => {
        const saved = Number(localStorage.getItem(HEIGHT_KEY));
        if (Number.isFinite(saved) && saved > 0) setHeight(saved);
        const onResize = () => {
            if (heightRef.current) setHeight(heightRef.current);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [setHeight]);

    // Drag the top handle to resize; height = distance from pointer to viewport bottom.
    const onResizePointerDown = useCallback(
        (e: React.PointerEvent) => {
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
        (e: React.KeyboardEvent) => {
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
                    const resp = await getConsoleDigest({ data: { cursors: cursorsRef.current } });
                    if (stopped) return;
                    setPanes(
                        resp.panes.map(({ slug, name, tone, branding, state, active }) => ({
                            slug,
                            name,
                            tone,
                            branding,
                            state,
                            active,
                        })),
                    );
                    setLines((prev) => {
                        const next: Record<string, ConsoleLine[]> = { ...prev };
                        for (const p of resp.panes) {
                            if (p.lines.length)
                                next[p.slug] = [...(next[p.slug] ?? []), ...p.lines].slice(
                                    -MAX_LINES,
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
            timer = setTimeout(tick, anyActiveRef.current ? ACTIVE_MS : IDLE_MS);
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
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                title="Open agent console (Ctrl+`)"
                className={cn(
                    "fixed right-[30px] bottom-0 z-[88] flex items-center gap-2 rounded-t-[10px] border border-b-0 border-border bg-card px-3.5 pt-[7px] pb-[9px] font-mono text-[11px] font-semibold tracking-[0.04em] text-muted-foreground shadow-[0_-3px_16px_rgba(0,0,0,0.16)] transition-[transform,color] duration-[140ms] hover:-translate-y-0.5 hover:text-foreground",
                    // "skirt" pinned beneath the tab — lifts with the hover so no page
                    // background shows below the raised button.
                    "after:absolute after:-left-px after:-right-px after:top-[calc(100%-1px)] after:h-2 after:border-x after:border-border after:bg-card after:content-['']",
                    // hidden while open, and when the pre-paint tab-off pref is set on <html>.
                    open && "hidden",
                    "[html.console-tab-off_&]:hidden",
                )}
            >
                <LiveDot />
                <span>agents</span>
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
                        <LiveDot /> Agent console{" "}
                        <span className="font-mono text-[10.5px] font-normal tracking-[0.03em] text-muted-foreground">
                            one agent per company · live
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
                        <section
                            className="flex min-h-[210px] min-w-0 flex-col bg-card"
                            key={p.slug}
                        >
                            <div className="flex flex-none items-center gap-2 border-b border-border px-3 py-[9px]">
                                <CompanyLogo
                                    name={p.name}
                                    branding={p.branding}
                                    size={22}
                                    radius={6}
                                />
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold text-foreground">
                                    {p.name}
                                </span>
                                <span
                                    className={cn(
                                        "ml-auto flex-none rounded-[5px] px-[7px] py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.05em]",
                                        STATE_CHIP[p.state],
                                    )}
                                >
                                    {STATE_LABEL[p.state]}
                                </span>
                            </div>
                            <PaneLog lines={lines[p.slug] ?? []} active={p.active} />
                        </section>
                    ))}
                </div>
            </section>
        </>
    );
}

// One pane's scrolling log. Auto-scrolls to the bottom on new lines, but only if
// the user is already near the bottom - a manual scroll-up isn't yanked back.
function PaneLog({ lines, active }: { lines: ConsoleLine[]; active: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on each append
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        if (nearBottom) el.scrollTop = el.scrollHeight;
    }, [lines]);
    return (
        <div
            ref={ref}
            className="min-h-0 flex-1 overflow-y-auto px-3 pt-2 pb-3 font-mono text-[11px] leading-[1.65]"
        >
            {lines.map((l, i) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only capped buffer
                    key={i}
                    className="flex gap-[9px]"
                >
                    <span className="flex-none text-faint">{hms(l.t)}</span>
                    <span
                        className={cn(
                            "min-w-0 break-words",
                            KIND_TEXT[l.kind] ?? "text-foreground",
                        )}
                    >
                        {l.msg}
                    </span>
                </div>
            ))}
            {active && (
                <div className="flex gap-[9px]">
                    <span className="flex-none text-faint" />
                    <span className="min-w-0 break-words text-primary">● working…</span>
                </div>
            )}
        </div>
    );
}
