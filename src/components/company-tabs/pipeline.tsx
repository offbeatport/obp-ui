import {
    ArrowRight,
    Check,
    CircleAlert,
    CircleDollarSign,
    Hammer,
    type LucideIcon,
    Radio,
    Rocket,
    Sparkles,
    TrendingUp,
    X,
} from "lucide-react";
import { CompanyLogo } from "~/components/company-logo";
import type { CompanyTabProps } from "~/components/company-tabs/types";
import type { CompanyAction } from "~/server/data";

// The Pipeline tab: the autonomous-factory view of one company. It renders the
// Idea → Build → Ship → Grow → Revenue loop, highlights the stage where work is
// live, and surfaces the ONE task awaiting a human as a prominent "Needs you" gate.
// Every number here is derived from real props (co + actions) - no mock data.

type StageKey = "idea" | "build" | "ship" | "grow" | "revenue";

const STAGES: { key: StageKey; label: string; verb: string; Icon: LucideIcon }[] = [
    { key: "idea", label: "Idea", verb: "auto-scoring", Icon: Sparkles },
    { key: "build", label: "Build", verb: "shipping code", Icon: Hammer },
    { key: "ship", label: "Ship", verb: "deploy · run", Icon: Rocket },
    { key: "grow", label: "Grow", verb: "distribution", Icon: TrendingUp },
    { key: "revenue", label: "Revenue", verb: "compounding", Icon: CircleDollarSign },
];

function timeAgo(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

export function PipelineTab({ co, actions, busy, onApprove, onReject }: CompanyTabProps) {
    const building = actions.filter((a) => a.state === "building");
    const awaiting = actions.filter((a) => a.state === "awaiting_approval");
    const blocked = actions.filter((a) => a.state === "blocked");
    const shipped = actions.filter((a) => a.state === "shipped");

    // The single task that needs a human: the first awaiting-approval, else the first blocked.
    const gate: CompanyAction | undefined = awaiting[0] ?? blocked[0];

    // Where the loop is spending its attention right now (the highlighted stage).
    const order: StageKey[] = ["idea", "build", "ship", "grow", "revenue"];
    const current: StageKey = building.length
        ? "build"
        : gate
          ? "ship"
          : co.mrr > 0
            ? "revenue"
            : co.shipped > 0 || co.users > 0
              ? "grow"
              : "idea";
    const currentIdx = order.indexOf(current);
    // How far the company has actually progressed (fills the track behind the nodes).
    let reachedIdx = 0;
    if (actions.length || co.spec) reachedIdx = 1;
    if (co.shipped > 0) reachedIdx = 2;
    if (co.users > 0 || co.shipped > 0) reachedIdx = 3;
    if (co.mrr > 0) reachedIdx = 4;
    reachedIdx = Math.max(reachedIdx, currentIdx);

    const meta: Record<StageKey, string> = {
        idea: co.spec
            ? `${co.spec.slices.length} slices scoped`
            : actions.length
              ? `${actions.length} tasks`
              : "scoping",
        build: building.length ? `${building.length} building` : shipped.length ? "idle" : "queued",
        ship: co.shipped > 0 ? `${co.shipped} shipped` : awaiting.length ? "ready" : "not yet",
        grow: co.users > 0 ? `${co.users} users` : "no users yet",
        revenue: co.mrr > 0 ? `$${co.mrr}/mo` : "pre-revenue",
    };

    const monthlyCost = actions.reduce((sum, a) => sum + (a.latestRun?.costUsd ?? 0), 0);
    const net = co.mrr - monthlyCost;
    const recent = shipped
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);
    const statusLabel =
        co.status === "active"
            ? "live & growing"
            : co.status === "paused"
              ? "paused"
              : co.status === "archived"
                ? "archived"
                : "incubating";

    return (
        <div className="flex flex-col gap-5">
            {/* HEADER - identity + the three headline metrics */}
            <header className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-border bg-card p-5 shadow-e1">
                <div className="flex items-center gap-4">
                    <CompanyLogo name={co.name} branding={co.branding} size={40} />
                    <div>
                        <div className="flex items-center gap-2 font-display text-xl font-medium tracking-tight">
                            {co.name}
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 font-sans text-[11px] font-medium text-success">
                                <span className="size-1.5 rounded-full bg-success" />
                                {statusLabel}
                            </span>
                        </div>
                        <div className="mt-0.5 max-w-md text-sm text-muted-foreground">
                            {co.spec?.tagline ?? co.thesis}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Metric label="MRR" value={`$${co.mrr}`} sub={co.mrr > 0 ? "recurring" : "pre-revenue"} />
                    <Metric label="users" value={`${co.users}`} sub={co.users > 0 ? "active" : "landing first"} />
                    <Metric
                        label="net / mo"
                        value={`${net >= 0 ? "+" : "−"}$${Math.abs(Math.round(net))}`}
                        sub={`after $${Math.round(monthlyCost)} cost`}
                    />
                </div>
            </header>

            {/* LIVING PIPELINE - the five-stage loop, current stage highlighted */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-e1">
                <div className="mb-6 flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                        Autonomous pipeline
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground">
                        <Radio className="size-3.5 text-primary" />
                        Autopilot · {co.autopilot === "on" ? "on" : "assisted"}
                    </span>
                </div>

                <div className="relative">
                    {/* the flow track behind the nodes */}
                    <div className="absolute inset-x-[10%] top-6 h-0.5 rounded-full bg-border-soft" />
                    <div
                        className="absolute left-[10%] top-6 h-0.5 rounded-full bg-primary transition-all"
                        style={{ width: `${(reachedIdx / 4) * 80}%` }}
                    />
                    <div className="grid grid-cols-5">
                        {STAGES.map((stage, i) => {
                            const state = i === currentIdx ? "active" : i <= reachedIdx ? "done" : "todo";
                            const isGate = stage.key === "ship" && gate;
                            return (
                                <div key={stage.key} className="flex flex-col items-center gap-2 px-1 text-center">
                                    <div
                                        className={`relative z-10 grid size-12 place-items-center rounded-xl border transition-colors ${
                                            state === "active"
                                                ? "border-primary bg-primary text-primary-foreground shadow-e1 ring-4 ring-accent"
                                                : state === "done"
                                                  ? "border-success-soft bg-success-soft text-success"
                                                  : "border-border-soft bg-secondary text-faint"
                                        }`}
                                    >
                                        <stage.Icon className="size-5" strokeWidth={1.8} />
                                        {isGate && (
                                            <span className="absolute -right-1 -top-1 size-3 animate-pulse rounded-full bg-approval ring-2 ring-card" />
                                        )}
                                    </div>
                                    <div className="font-mono text-[10px] text-faint">
                                        {String(i + 1).padStart(2, "0")}
                                    </div>
                                    <div
                                        className={`font-display text-sm font-medium ${
                                            state === "active" ? "text-primary" : "text-foreground"
                                        }`}
                                    >
                                        {stage.label}
                                    </div>
                                    <div className="text-[11px] italic text-muted-foreground">{stage.verb}</div>
                                    <span
                                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                                            state === "active"
                                                ? "bg-accent text-accent-foreground"
                                                : "bg-secondary text-muted-foreground"
                                        }`}
                                    >
                                        {meta[stage.key]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* FOCUS - the one thing that needs a human, or a calm autopilot state */}
            {gate ? (
                <section
                    className={`rounded-2xl border p-5 shadow-e2 ${
                        gate.state === "blocked"
                            ? "border-destructive/40 bg-destructive-soft"
                            : "border-approval/40 bg-approval-soft"
                    }`}
                >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${
                                gate.state === "blocked" ? "text-destructive" : "text-approval"
                            }`}
                        >
                            {gate.state === "blocked" ? (
                                <CircleAlert className="size-3.5" />
                            ) : (
                                <span className="size-2 animate-pulse rounded-full bg-approval" />
                            )}
                            {gate.state === "blocked" ? "Blocked" : "Needs you"}
                        </span>
                        <span className="text-muted-foreground">
                            at <b className="font-medium text-foreground">Ship</b> ·{" "}
                            {gate.state === "blocked"
                                ? "the agent hit a wall and needs your call"
                                : "reversible, but it wants your OK before it goes live"}
                        </span>
                        {gate.reversible && (
                            <span className="ml-auto rounded-full bg-card px-2 py-0.5 font-mono text-[10px] text-faint">
                                reversible
                            </span>
                        )}
                    </div>

                    <div className="mt-4 rounded-xl border border-border-soft bg-card p-4">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-faint">
                            <span className="rounded bg-secondary px-1.5 py-0.5">{gate.title ? `#${gate.n}` : ""}</span>
                            Drafted by agent · {gate.attempts} attempt
                            {gate.attempts === 1 ? "" : "s"}
                            {gate.latestRun?.error ? ` · ${gate.latestRun.error}` : ""}
                        </div>
                        <div className="mt-1.5 font-display text-lg font-medium">{gate.title}</div>
                        {gate.doneWhen && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                Ships when: <span className="text-foreground">{gate.doneWhen}</span>
                            </p>
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => onApprove(gate.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-foreground shadow-e1 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Check className="size-4" />
                            {gate.state === "blocked" ? "Approve fix & retry" : "Approve & ship"}
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => onReject(gate.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 font-sans text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <X className="size-4" />
                            Reject
                        </button>
                        {gate.previewUrl && (
                            <a
                                href={gate.previewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-sans text-sm text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Preview
                                <ArrowRight className="size-4" />
                            </a>
                        )}
                    </div>
                </section>
            ) : (
                <section className="flex items-center gap-3 rounded-2xl border border-border-soft bg-secondary p-5">
                    <span className="grid size-9 place-items-center rounded-full bg-success-soft text-success">
                        <Check className="size-4.5" />
                    </span>
                    <div>
                        <div className="font-display text-sm font-medium">Running on autopilot</div>
                        <div className="text-sm text-muted-foreground">
                            {building.length
                                ? `Building ${building[0].title} - nothing needs you right now.`
                                : "No approvals waiting. The loop is shipping, monitoring, and growing on its own."}
                        </div>
                    </div>
                </section>
            )}

            {/* RECENT - what the factory ran on its own */}
            <footer className="rounded-2xl border border-border bg-card p-4 shadow-e1">
                <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                    <span className="size-1.5 rounded-full bg-success" />
                    Ran on its own
                </div>
                {recent.length ? (
                    <div className="flex flex-wrap gap-2">
                        {recent.map((a) => (
                            <span
                                key={a.id}
                                className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-secondary px-3 py-1 text-xs"
                            >
                                <span className="size-1.5 rounded-full bg-success" />
                                <span className="text-foreground">Shipped {a.title}</span>
                                <span className="font-mono text-[10px] text-faint">{timeAgo(a.createdAt)}</span>
                            </span>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        Nothing shipped yet - the first slice is on its way.
                    </div>
                )}
            </footer>
        </div>
    );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="min-w-[92px] rounded-xl border border-border-soft bg-secondary px-3.5 py-2.5">
            <div className="font-display text-xl font-medium tracking-tight">{value}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{label}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
        </div>
    );
}
