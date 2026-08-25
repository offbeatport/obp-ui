import { Check, ChevronDown, ExternalLink, X } from "lucide-react";
import { useState } from "react";
import type { CompanyTabProps } from "~/components/company-tabs/types";
import type { CompanyAction, SliceState } from "~/server/data";

// The "Product" tab: the full agent task backlog, grouped by feature/roadmap. Each task shows a
// mono id + title + status badge; clicking a row expands the details the agent runs against
// (doneWhen, latest run, preview link, and approve/reject for gated tasks).

// --- status → badge tone (small map; keyed by SliceState, with run-status synonyms) -----------
type BadgeMeta = { label: string; cls: string };
const BADGE: Record<string, BadgeMeta> = {
    building: { label: "building", cls: "text-info bg-info-soft" },
    running: { label: "running", cls: "text-info bg-info-soft" },
    awaiting_approval: { label: "approve", cls: "text-approval bg-approval-soft" },
    blocked: { label: "blocked", cls: "text-destructive bg-destructive-soft" },
    shipped: { label: "shipped", cls: "text-success bg-success-soft" },
    done: { label: "done", cls: "text-success bg-success-soft" },
    todo: { label: "queued", cls: "text-muted-foreground bg-secondary" },
    queued: { label: "queued", cls: "text-muted-foreground bg-secondary" },
};
const badgeFor = (key: string): BadgeMeta =>
    BADGE[key] ?? { label: key.replace(/_/g, " "), cls: "text-muted-foreground bg-secondary" };

// A feature/roadmap bucket: a spec slice (or the catch-all) plus the tasks that fall under it.
type Group = { title: string; sub?: string; doneWhen?: string; tasks: CompanyAction[] };

// Group actions by feature. Spec slices are the feature groups; an action maps to slice i when
// its 1-based order (action.n) matches i+1. Anything past the last slice lands in "Backlog".
// With no spec, everything collapses into a single "Roadmap" group.
function groupActions(actions: CompanyAction[], slices?: { title: string; sub: string; doneWhen?: string }[]): Group[] {
    if (!slices || slices.length === 0) {
        return [{ title: "Roadmap", tasks: actions }];
    }
    const groups: Group[] = slices.map((s, i) => ({
        title: s.title,
        sub: s.sub,
        doneWhen: s.doneWhen,
        tasks: actions.filter((a) => a.n === i + 1),
    }));
    const backlog = actions.filter((a) => a.n > slices.length || a.n < 1);
    if (backlog.length) groups.push({ title: "Backlog", tasks: backlog });
    return groups;
}

// Roll a group's tasks up to a single state for the header meta.
function groupState(tasks: CompanyAction[]): SliceState | "empty" {
    if (!tasks.length) return "empty";
    if (tasks.some((t) => t.state === "blocked")) return "blocked";
    if (tasks.some((t) => t.state === "awaiting_approval")) return "awaiting_approval";
    if (tasks.some((t) => t.state === "building")) return "building";
    if (tasks.every((t) => t.state === "shipped")) return "shipped";
    return "todo";
}

export function ProductTab(props: CompanyTabProps) {
    const { co, actions, busy, onApprove, onReject } = props;
    const [openId, setOpenId] = useState<string | null>(null);

    const groups = groupActions(actions, co.spec?.slices);
    const building = actions.filter((a) => a.state === "building").length;
    const queued = actions.filter((a) => a.state === "todo").length;

    return (
        <div className="mx-auto max-w-[720px] py-1">
            {/* header - title + one-line intent + live counts */}
            <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                    <span className="font-display text-[15px] font-semibold text-foreground">Product</span>
                    <span className="text-[12.5px] text-muted-foreground">
                        {" · the full task list the agent works through"}
                    </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-faint">
                    {building} building · {queued} queued
                </span>
            </div>
            <p className="mb-4 max-w-[560px] text-[13px] leading-relaxed text-muted-foreground">
                Tasks the AI builds through, grouped by feature. Click a task to see what it runs.
            </p>

            {/* feature sections */}
            <div className="flex flex-col gap-[18px]">
                {groups.map((g, gi) => {
                    const gs = groupState(g.tasks);
                    return (
                        <section key={`${g.title}-${gi}`}>
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                                <span className="font-display text-[15px] font-semibold text-foreground">
                                    {g.title}
                                </span>
                                <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-faint">
                                    {g.tasks.length} task{g.tasks.length === 1 ? "" : "s"}
                                    {gs !== "empty" ? ` · ${badgeFor(gs).label}` : ""}
                                </span>
                            </div>

                            {g.tasks.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border bg-card px-3.5 py-3 text-[12.5px] text-faint">
                                    No task yet - queued on the roadmap.
                                </p>
                            ) : (
                                <ul className="flex list-none flex-col gap-[7px] p-0">
                                    {g.tasks.map((a) => {
                                        const open = openId === a.id;
                                        const badge = badgeFor(a.state);
                                        const doneWhen = a.doneWhen ?? g.doneWhen;
                                        const run = a.latestRun;
                                        return (
                                            <li key={a.id}>
                                                {/* row - the toggle button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenId(open ? null : a.id)}
                                                    aria-expanded={open}
                                                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition hover:border-primary"
                                                >
                                                    <span className="shrink-0 rounded-md border border-border-soft bg-secondary px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                                                        T{String(a.n).padStart(2, "0")}
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                                                        {a.title}
                                                    </span>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.06em] ${badge.cls}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                    <span className="shrink-0 font-mono text-[10px] text-primary opacity-0 transition group-hover:opacity-100">
                                                        prompt →
                                                    </span>
                                                    <ChevronDown
                                                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                                                    />
                                                </button>

                                                {/* expanded panel - the details the task runs against */}
                                                {open && (
                                                    <div className="mt-1.5 rounded-xl border border-border bg-secondary px-3.5 py-3 text-[13px]">
                                                        {doneWhen && (
                                                            <div className="mb-2">
                                                                <span className="mr-2 font-mono text-[10px] uppercase tracking-wide text-faint">
                                                                    done when
                                                                </span>
                                                                <span className="text-foreground">{doneWhen}</span>
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
                                                            <span className="font-mono text-[11px]">
                                                                Attempt {a.attempts}
                                                            </span>
                                                            {run && (
                                                                <span className="font-mono text-[11px]">
                                                                    run:{" "}
                                                                    <span
                                                                        className={
                                                                            run.status === "failed" || run.error
                                                                                ? "text-destructive"
                                                                                : "text-foreground"
                                                                        }
                                                                    >
                                                                        {run.status}
                                                                    </span>
                                                                    {run.costUsd > 0
                                                                        ? ` · $${run.costUsd.toFixed(2)}`
                                                                        : ""}
                                                                </span>
                                                            )}
                                                            {a.reversible ? (
                                                                <span className="font-mono text-[11px] text-faint">
                                                                    reversible
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        {run?.error && (
                                                            <p className="mt-2 rounded-lg bg-destructive-soft px-2.5 py-1.5 font-mono text-[11px] text-destructive">
                                                                {run.error}
                                                            </p>
                                                        )}

                                                        {a.previewUrl && (
                                                            <a
                                                                href={a.previewUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-2.5 inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline"
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                preview
                                                            </a>
                                                        )}

                                                        {/* gate - approve / reject a task waiting on you */}
                                                        {a.state === "awaiting_approval" && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => void onApprove(a.id)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-medium text-primary transition hover:brightness-95 disabled:opacity-50"
                                                                >
                                                                    <Check className="h-3.5 w-3.5" />
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={busy}
                                                                    onClick={() => void onReject(a.id)}
                                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-50"
                                                                >
                                                                    <X className="h-3.5 w-3.5" />
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
