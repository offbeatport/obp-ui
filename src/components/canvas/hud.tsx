import { useState } from "react";
import { TONE_VAR } from "~/components/command-center/tone";
import { cn } from "~/lib/utils";
import type { ActivityItem } from "~/server/data";

// Fixed HUD overlays for the command-surface canvas (rendered as React Flow <Panel>s). Dark-themed
// (they live inside the forced-`.dark` canvas). Ported from the 05 prototype's corner panels.

const PANEL = "rounded-[14px] border border-border bg-card/85 backdrop-blur";

// Top-left: portfolio identity + headline stats + next moves.
export function PortfolioHud({
    stats,
    moves,
}: {
    stats: { mrr: number; users: number; active: number; shipped: number; needsYou: number };
    moves: string[];
}) {
    const cells: [string, string | number, boolean][] = [
        ["mrr", `$${stats.mrr}`, false],
        ["users", stats.users, false],
        ["active", stats.active, false],
        ["shipped", stats.shipped, false],
        ["needs you", stats.needsYou, true],
    ];
    return (
        <div className={cn(PANEL, "w-[330px] px-4 py-3.5")}>
            <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-[13px] font-bold tracking-[0.04em]">
                    C <span className="text-[color:var(--info)]">SLOP</span> SLOP
                </span>
                <span className="ml-auto font-mono text-[9.5px] tracking-[0.08em] text-faint">
                    {"// command surface"}
                </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
                {cells.map(([label, val, alert]) => (
                    <div
                        key={label}
                        className="rounded-[9px] border border-border bg-white/[0.02] px-1.5 py-1.5 text-center"
                    >
                        <b className={cn("block font-mono text-[15px]", alert && "text-[color:var(--approval)]")}>
                            {val}
                        </b>
                        <span className="font-mono text-[8px] uppercase tracking-[0.04em] text-faint">{label}</span>
                    </div>
                ))}
            </div>
            {moves.length > 0 && (
                <div className="mt-3 border-t border-border pt-2.5">
                    <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                        {"// next moves"}
                    </div>
                    {moves.map((m, i) => (
                        <div
                            key={m}
                            className="mb-1.5 flex gap-2 text-[11.5px] leading-[1.4] text-muted-foreground last:mb-0"
                        >
                            <span className="flex-none font-mono text-[color:var(--info)]">{i + 1}.</span>
                            <span>{m}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Top-center: live activity strip, collapsible.
export function ActivityStrip({ activity }: { activity: ActivityItem[] }) {
    const [open, setOpen] = useState(false);
    if (!activity.length) return null;
    const latest = activity[0];
    const groups = new Map<string, ActivityItem[]>();
    for (const a of activity) {
        const key = a.companyName ?? "portfolio";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)?.push(a);
    }
    return (
        <div className={cn(PANEL, "w-[460px] max-w-[46vw] overflow-hidden")}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            >
                <span className="size-2 flex-none animate-pulse rounded-full bg-[color:var(--success)]" />
                <span className="flex-1 truncate font-mono text-[11.5px] text-muted-foreground">
                    <b className="text-[color:var(--info)]">{latest.companyName ?? "portfolio"}</b> · {latest.text}
                </span>
                <span className="flex-none font-mono text-[10px] tracking-[0.08em] text-faint">
                    {open ? "▴ collapse" : "▾ stream"}
                </span>
            </button>
            {open && (
                <div className="max-h-[300px] overflow-y-auto border-t border-border">
                    {[...groups.entries()].map(([co, items]) => (
                        <div key={co} className="border-b border-border px-3.5 py-2.5 last:border-b-0">
                            <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">
                                {co}
                            </div>
                            {items.map((a) => (
                                <div
                                    key={a.id}
                                    className="mb-1.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground last:mb-0"
                                >
                                    <span
                                        className="size-1.5 flex-none rounded-full"
                                        style={{ background: TONE_VAR[a.tone] }}
                                    />
                                    <span className="flex-1 truncate">{a.text}</span>
                                    <span className="flex-none font-mono text-[9.5px] text-faint">{a.ago}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Bottom-center: portfolio command bar.
export function CommandBar({ onSubmit }: { onSubmit: () => void }) {
    const [v, setV] = useState("");
    const send = () => {
        setV("");
        onSubmit();
    };
    return (
        <div
            className={cn(PANEL, "flex w-[560px] max-w-[70vw] items-center gap-2.5 px-3.5 py-2.5")}
            style={{
                boxShadow:
                    "0 14px 50px rgba(0,0,0,.6), 0 0 0 1px color-mix(in srgb, var(--info) 40%, transparent), 0 0 24px color-mix(in srgb, var(--info) 24%, transparent)",
            }}
        >
            <span className="font-mono font-bold text-[color:var(--info)]">›</span>
            <input
                value={v}
                onChange={(e) => setV(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Direct the portfolio - e.g. start a new company"
                className="nodrag nopan flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            />
            <button
                type="button"
                onClick={send}
                className="nodrag nopan rounded-[9px] bg-[color:var(--info)] px-3.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            >
                Send
            </button>
        </div>
    );
}
