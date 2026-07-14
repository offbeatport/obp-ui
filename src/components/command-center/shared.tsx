// Shared command-center primitives — reproduce design/v2-prototypes/08-chat-spine-pro-v7.html
// (dashTpl1 + company/opportunity/inbox views) against the typed data contract in src/server/data.ts.
// Dynamic tone colors use the semantic CSS vars from globals.css directly (as the prototype does).
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type {
    ActivityItem,
    CompanySummary,
    PortfolioMetrics,
    SliceState,
    Tone,
} from "~/server/data";

// tone → semantic token (prototype: --green/--blue/--violet/--slate/--amber/--red → design-system tokens)
const TONE_VAR: Record<Tone, string> = {
    green: "--success",
    blue: "--info",
    violet: "--approval",
    slate: "--neutral",
    amber: "--warning",
    red: "--destructive",
};
export const toneColor = (t: Tone) => `var(${TONE_VAR[t]})`;
export const toneSoft = (t: Tone) => `var(${TONE_VAR[t]}-soft)`;

// slice state → { label, tone } for the badges
export const SLICE_META: Record<SliceState, { label: string; tone: Tone }> = {
    building: { label: "Building", tone: "blue" },
    awaiting_approval: { label: "Awaiting you", tone: "violet" },
    blocked: { label: "Blocked", tone: "red" },
    todo: { label: "Queued", tone: "slate" },
    shipped: { label: "Shipped", tone: "green" },
};

export const initials = (name: string) => name.trim().charAt(0).toUpperCase();

// ── section header: mono label · rule · count (dashTpl1 .sec-head) ──────────────
export function SectionHead({
    label,
    count,
    action,
}: { label: string; count?: number | string; action?: ReactNode }) {
    return (
        <div className="flex items-center gap-2.5">
            <span className="flex-none font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint">
                {label}
            </span>
            <span className="h-px flex-1 bg-border-soft" />
            {count !== undefined && (
                <span className="font-mono text-[11px] text-faint">{count}</span>
            )}
            {action}
        </div>
    );
}

// ── avatar: rounded square with the company initial, tinted by tone ─────────────
export function Avatar({
    name,
    tone,
    className,
    style,
}: { name: string; tone: Tone; className?: string; style?: React.CSSProperties }) {
    return (
        <span
            className={cn(
                "grid flex-none place-items-center rounded-[9px] font-bold text-white",
                className,
            )}
            style={{ background: toneColor(tone), ...style }}
        >
            {initials(name)}
        </span>
    );
}

// ── slice status badge (dashTpl1 .sbadge) ───────────────────────────────────────
export function SliceBadge({ state }: { state: SliceState }) {
    const { label, tone } = SLICE_META[state];
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.05em]"
            style={{ color: toneColor(tone), background: toneSoft(tone) }}
        >
            <span className="size-[5px] rounded-full" style={{ background: toneColor(tone) }} />
            {label}
        </span>
    );
}

// ── company tile (dashTpl1 .ctile) — links to the workspace ─────────────────────
export function CompanyTile({ co, flag }: { co: CompanySummary; flag?: boolean }) {
    return (
        <Link
            to="/companies/$slug"
            params={{ slug: co.slug }}
            className={cn(
                "flex flex-col gap-[11px] rounded-sm border bg-card p-[14px] pt-[15px] shadow-e1 transition hover:-translate-y-0.5 hover:shadow-e2",
                flag && "border-approval-soft",
            )}
        >
            <div className="flex items-center gap-[9px]">
                <Avatar name={co.name} tone={co.tone} className="size-[30px] text-[13px]" />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
                        <span
                            className="size-[7px] flex-none rounded-full"
                            style={{
                                background: toneColor(co.status === "paused" ? "amber" : "green"),
                            }}
                        />
                        {co.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                        ${co.mrr} · {co.users}u · {co.shipped} shipped
                    </div>
                </div>
            </div>
            {co.slice && (
                <div className="border-t border-border-soft pt-2.5">
                    <div className="mb-1.5">
                        <SliceBadge state={co.slice.state} />
                    </div>
                    <div className="line-clamp-2 text-[12px] leading-[1.4] text-muted-foreground">
                        <b className="font-mono text-[11px] font-medium text-faint">
                            S{co.slice.n}
                        </b>{" "}
                        {co.slice.title}
                    </div>
                </div>
            )}
        </Link>
    );
}

// ── portfolio metrics line (dashTpl1 .pf-line) ──────────────────────────────────
export function MetricsBar({ metrics }: { metrics: PortfolioMetrics }) {
    const stats: [number | string, string][] = [
        [`$${metrics.mrr}`, "MRR"],
        [metrics.users, "users"],
        [metrics.active, "active"],
        [metrics.shipped, "shipped"],
    ];
    return (
        <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2 px-1 py-0.5">
            {stats.map(([v, l], i) => (
                <div key={l} className="flex items-center gap-[3px]">
                    {i > 0 && <span className="mr-[19px] size-[3px] rounded-full bg-border" />}
                    <span className="font-mono text-[17px] font-medium tracking-[-0.01em]">
                        {v}
                    </span>
                    <span className="ml-[7px] text-[11px] font-normal text-muted-foreground">
                        {l}
                    </span>
                </div>
            ))}
            {metrics.needsYou > 0 && (
                <span
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-[11.5px] font-semibold"
                    style={{ color: "var(--accent-foreground)", background: "var(--accent)" }}
                >
                    <span className="pulse size-[7px] rounded-full bg-primary" />
                    {metrics.needsYou} needs you
                </span>
            )}
        </div>
    );
}

// ── recent activity feed (dashTpl1 .act) ────────────────────────────────────────
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
    return (
        <div className="flex flex-col">
            {items.map((a) => (
                <div
                    key={a.id}
                    className="flex items-center gap-3 border-t border-border-soft px-1 py-2 text-[12.5px] text-muted-foreground first:border-t-0"
                >
                    <span
                        className="size-1.5 flex-none rounded-full"
                        style={{ background: toneColor(a.tone) }}
                    />
                    <span className="flex-1 leading-[1.35]">
                        {a.companyName && (
                            <b className="font-semibold text-foreground">{a.companyName}</b>
                        )}{" "}
                        {a.text}
                    </span>
                    <span
                        className={cn(
                            "flex-none font-mono text-[10.5px] text-faint",
                            a.ago === "now" && "text-info",
                        )}
                    >
                        {a.ago}
                    </span>
                </div>
            ))}
        </div>
    );
}
