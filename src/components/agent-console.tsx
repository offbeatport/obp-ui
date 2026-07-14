import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";
import type { ConsoleLine, ConsolePaneState } from "~/server/console";
import { getConsoleDigest } from "~/server/console";
import type { Tone } from "~/server/data";

// AGENT CONSOLE — bottom-docked "one agent per company, live" panel from
// design/v2-prototypes/08-chat-spine-pro-v7.html. Opens with the bottom-right tab
// or Ctrl+` ; closes with ✕ or Esc. It POLLS ONE digest endpoint (adaptive:
// 0.75s while any run is active, 4s idle) with a per-pane cursor, so steady-state
// polls carry only new lines. No connection is opened until the console opens,
// and polling pauses when the tab is hidden. Styling lives in globals.css
// (.console* — follows the global light/dark theme via the shared tokens).

const ACTIVE_MS = 750;
const IDLE_MS = 4000;
const MAX_LINES = 80;

type PaneMeta = {
    slug: string;
    name: string;
    tone: Tone;
    state: ConsolePaneState;
    active: boolean;
};

const STATE_CLASS: Record<ConsolePaneState, string> = {
    building: "s-building",
    awaiting_approval: "s-await",
    shipped: "s-shipped",
    blocked: "s-blocked",
    todo: "s-todo",
};
const STATE_LABEL: Record<ConsolePaneState, string> = {
    building: "building",
    awaiting_approval: "needs you",
    shipped: "live",
    blocked: "blocked",
    todo: "queued",
};

function hms(t: number): string {
    const d = new Date(t);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function initials(name: string): string {
    const caps = name.match(/[A-Z]/g);
    if (caps && caps.length >= 2) return caps.slice(0, 2).join("");
    return name.slice(0, 2).toUpperCase();
}

export function AgentConsole() {
    const [open, setOpen] = useState(false);
    const [panes, setPanes] = useState<PaneMeta[]>([]);
    const [lines, setLines] = useState<Record<string, ConsoleLine[]>>({});
    const cursorsRef = useRef<Record<string, number>>({});
    const anyActiveRef = useRef(false);

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

    // Adaptive poll — only while open AND the tab is visible. cursorsRef persists
    // across close/open so reopening resumes deltas instead of re-seeding.
    useEffect(() => {
        if (!open) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const tick = async () => {
            if (stopped) return;
            if (document.visibilityState === "visible") {
                try {
                    const resp = await getConsoleDigest({ data: { cursors: cursorsRef.current } });
                    if (stopped) return;
                    setPanes(
                        resp.panes.map(({ slug, name, tone, state, active }) => ({
                            slug,
                            name,
                            tone,
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
                    /* transient — retry next tick */
                }
            }
            if (stopped) return;
            timer = setTimeout(tick, anyActiveRef.current ? ACTIVE_MS : IDLE_MS);
        };

        void tick();
        const onVis = () => {
            if (document.visibilityState === "visible" && !stopped) {
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
        <div className={cn("console", open && "open")}>
            <button
                type="button"
                className="console-tab"
                onClick={() => setOpen(true)}
                title="Open agent console (Ctrl+`)"
            >
                <span className="ct-dot" />
                <span>agents</span>
                <span className="ct-kbd">⌃`</span>
            </button>

            <section className="console-panel" aria-label="Agent console" aria-hidden={!open}>
                <div className="console-head">
                    <div className="console-title">
                        <span className="ct-dot" /> Agent console{" "}
                        <span className="console-sub">one agent per company · live</span>
                    </div>
                    <div className="console-head-right">
                        <span className="console-kbd">
                            <kbd>Ctrl</kbd>
                            <kbd>`</kbd>
                        </span>
                        <button
                            type="button"
                            className="console-close"
                            onClick={() => setOpen(false)}
                            aria-label="Close console"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="console-grid">
                    {panes.map((p) => (
                        <section className="cpane" key={p.slug}>
                            <div className="cpane-head">
                                <span className="cpane-av" data-tone={p.tone}>
                                    {initials(p.name)}
                                </span>
                                <span className="cpane-name">{p.name}</span>
                                <span className={cn("cpane-state", STATE_CLASS[p.state])}>
                                    {STATE_LABEL[p.state]}
                                </span>
                            </div>
                            <PaneLog lines={lines[p.slug] ?? []} active={p.active} />
                        </section>
                    ))}
                </div>
            </section>
        </div>
    );
}

// One pane's scrolling log. Auto-scrolls to the bottom on new lines, but only if
// the user is already near the bottom — a manual scroll-up isn't yanked back.
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
        <div className="cpane-log" ref={ref}>
            {lines.map((l, i) => (
                <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: append-only capped buffer
                    key={i}
                    className={cn("clog", l.kind !== "msg" && l.kind)}
                >
                    <span className="t">{hms(l.t)}</span>
                    <span className="m">{l.msg}</span>
                </div>
            ))}
            {active && (
                <div className="clog act">
                    <span className="t" />
                    <span className="m">● working…</span>
                </div>
            )}
        </div>
    );
}
