import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { CompanyLogo } from "~/components/company-logo";
import { cn } from "~/lib/utils";
import type { ActivityItem, CompanySummary, Tone } from "~/server/data";
import { TONE_VAR } from "./tone";

// The work-line node glyphs (coICON).
const AREA_ICON = {
    build: "M9 8l-4 4 4 4M15 8l4 4-4 4",
    grow: "M4 17l6-6 3 3 7-7M15 7h5v5",
    run: "M3 12h4l2 6 4-12 2 6h6",
} as const;
type Area = keyof typeof AREA_ICON;
type NodeState = "active" | "needs" | "idle" | "off";

// Per-area tone (was `.co-a-*` setting --co-area/--co-area-soft): build=blue/info,
// grow=violet/approval, run=green/success. Set as inline vars on the node so the
// color-mix utilities below can read var(--co-area) / var(--co-area-soft).
const AREA_VAR: Record<Area, { area: string; soft: string }> = {
    build: { area: "var(--info)", soft: "var(--info-soft)" },
    grow: { area: "var(--approval)", soft: "var(--approval-soft)" },
    run: { area: "var(--success)", soft: "var(--success-soft)" },
};

// Feed area → the mono BUILD/GROW/RUN tag colors (was `.co-tag.co-build/.co-grow/.co-run`).
const TAG_TONE: Record<Area, string> = {
    build: "text-info bg-info-soft",
    grow: "text-approval bg-approval-soft",
    run: "text-success bg-success-soft",
};

// Feed tone → the mono BUILD/GROW/RUN tag on activity lines.
const TAG: Record<Tone, Area> = {
    green: "run",
    blue: "build",
    violet: "grow",
    slate: "build",
    amber: "grow",
    red: "build",
};

// Derive the three loop-node states from the summary (the contract carries no per-loop model).
function loopStates(c: CompanySummary): Record<Area, NodeState> {
    const live = c.mrr > 0 || c.shipped > 0;
    const building = c.slice?.state === "building";
    const needs = c.needsYou === true;
    return {
        build: building
            ? "active"
            : needs && (c.slice?.state === "awaiting_approval" || c.slice?.state === "blocked")
              ? "needs"
              : c.shipped > 0
                ? "idle"
                : "off",
        grow: c.mrr > 0 ? "active" : live ? "idle" : "off",
        run: live ? "active" : "off",
    };
}

function LoopNode({ area, state, focus }: { area: Area; state: NodeState; focus: boolean }) {
    // co-focus only applies when it's the focused node AND not off (matches the original guard).
    const isFocus = focus && state !== "off";
    const areaVars = AREA_VAR[area];
    // Focus glow (was `.co-focus .co-node` box-shadow). Kept in inline style rather than a
    // shadow-[…] utility because Tailwind v4 hoists the shadow color into --tw-shadow-color and
    // mangles the color-mix() (dropping the 50%/transparent) - this preserves it exactly.
    const focusShadow = !isFocus
        ? undefined
        : state === "needs"
          ? "0 0 0 4px var(--accent), 0 0 22px color-mix(in srgb, var(--primary) 50%, transparent)"
          : "0 0 0 4px var(--co-area-soft), 0 0 22px color-mix(in srgb, var(--co-area) 50%, transparent)";
    return (
        <div
            className="relative flex flex-none flex-col items-center gap-[9px]"
            style={
                {
                    "--co-area": areaVars.area,
                    "--co-area-soft": areaVars.soft,
                } as CSSProperties
            }
        >
            <div
                style={focusShadow ? { boxShadow: focusShadow } : undefined}
                className={cn(
                    "relative grid size-13 place-items-center rounded-full border-[1.5px] transition-[color,background-color,border-color,box-shadow,transform] duration-300",
                    state === "active" &&
                        "bg-[color-mix(in_srgb,var(--co-area-soft)_55%,var(--card))] text-[var(--co-area)]",
                    state === "active" &&
                        !isFocus &&
                        "border-[color:color-mix(in_srgb,var(--co-area)_55%,var(--border))]",
                    state === "needs" && "bg-accent text-primary",
                    state === "needs" &&
                        !isFocus &&
                        "border-[color:color-mix(in_srgb,var(--primary)_60%,var(--border))]",
                    state === "idle" && "border-border bg-card text-muted-foreground",
                    state === "off" && "border-dashed border-border bg-secondary text-faint opacity-50",
                    isFocus &&
                        "scale-[1.14] after:absolute after:inset-[-6px] after:animate-[co-halo_2.2s_ease-out_infinite] after:rounded-full after:border-[1.5px] after:border-solid after:content-[''] motion-reduce:after:animate-none",
                    isFocus &&
                        state === "active" &&
                        "border-[color:var(--co-area)] after:border-[color:color-mix(in_srgb,var(--co-area)_45%,transparent)]",
                    isFocus &&
                        state === "needs" &&
                        "border-primary after:border-[color:color-mix(in_srgb,var(--primary)_50%,transparent)]",
                )}
            >
                <svg
                    className="size-[21px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d={AREA_ICON[area]} />
                </svg>
            </div>
            <span className="whitespace-nowrap text-center font-mono text-[9.5px] tracking-[0.04em] text-faint">
                <b className={cn("font-semibold", state === "off" ? "text-faint" : "text-foreground")}>
                    {area.toUpperCase()}
                </b>
            </span>
        </div>
    );
}

// Company card - brandmark · needs-you · build→grow→run work-line · live activity feed.
// Ported from design/v2-prototypes/08-chat-spine-pro-v7.html (coCardHTML / .co-card).
export function CompanyCard({ c, feed }: { c: CompanySummary; feed: ActivityItem[] }) {
    const st = loopStates(c);
    const focus: Area = st.build !== "idle" && st.build !== "off" ? "build" : st.grow === "active" ? "grow" : "run";
    const dead = c.status === "archived";

    return (
        <Link
            to="/companies/$slug"
            // Route by the unique name slug (default); drafts keep their stable id while volatile.
            params={{ slug: c.status === "draft" ? c.id : c.slug }}
            className={cn(
                "relative flex flex-col gap-4 rounded-[18px] border border-border bg-card p-[22px] shadow-e1 !transition-all max-w-3xs",
                " hover:border-[color:color-mix(in_srgb,var(--co-tone)_40%,var(--border))] ",
                dead && "opacity-60 hover:opacity-85",
            )}
            // --co-bc feeds the brandmark tint; --co-tone feeds the hover border color-mix.
            style={
                {
                    "--co-bc": TONE_VAR[c.tone],
                    "--co-tone": TONE_VAR[c.tone],
                } as CSSProperties
            }
        >
            <div className="flex items-center gap-2.5">
                <CompanyLogo name={c.name} branding={c.branding} size={34} radius={10} />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <h3 className="m-0 min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-display text-lg font-semibold tracking-[-0.01em]">
                        {c.name}
                    </h3>
                </div>
                {c.needsYou && (
                    <span className="inline-flex flex-none items-center gap-[5px] rounded-full bg-primary px-2 py-[3px] font-mono text-[10px] font-semibold tracking-[0.03em] text-white before:size-1.5 before:animate-[co-pip_1.6s_ease-out_infinite] before:rounded-full before:bg-white before:shadow-[0_0_0_0_rgba(255,255,255,0.7)] before:content-[''] motion-reduce:before:animate-none">
                        needs you
                    </span>
                )}
            </div>

            <div className="flex flex-col items-center">
                <div className="flex w-full items-start justify-center px-[30px] py-[14px]">
                    <LoopNode area="build" state={st.build} focus={focus === "build"} />
                    <span className="mt-[26px] h-0 min-w-[18px] flex-auto self-start border-t-2 border-dotted border-border" />
                    <LoopNode area="grow" state={st.grow} focus={focus === "grow"} />
                    <span className="mt-[26px] h-0 min-w-[18px] flex-auto self-start border-t-2 border-dotted border-border" />
                    <LoopNode area="run" state={st.run} focus={focus === "run"} />
                </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                    <span className="size-[5px] animate-[co-blink_3s_ease-in-out_infinite] rounded-full bg-success opacity-80 motion-reduce:animate-none" />
                    live activity
                </div>
                <div className="flex min-h-[84px] flex-col gap-1.5">
                    {feed.length > 0 ? (
                        feed.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-[9px] overflow-hidden font-mono text-[11.5px] text-muted-foreground"
                            >
                                <span
                                    className={cn(
                                        "w-11 flex-none rounded-[5px] px-1.5 py-0.5 text-center text-[9px] font-semibold tracking-[0.05em]",
                                        TAG_TONE[TAG[a.tone]],
                                    )}
                                >
                                    {TAG[a.tone].toUpperCase()}
                                </span>
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{a.text}</span>
                            </div>
                        ))
                    ) : (
                        <div className="flex items-center gap-[9px] overflow-hidden font-mono text-[11.5px] text-muted-foreground">
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                                standing by · no recent activity
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}
