import { Check, CircleAlert, Clock, GitCommitHorizontal, Hammer, X } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";

// ============================================================================
// Tasks as a single vertical-timeline LIST (no pipeline diagram). Each task is
// a node on a spine, state-coloured, newest → oldest. The one awaiting approval
// carries inline Approve / Reject. Mock data - drops onto the company page as
// the "Tasks" surface.
// ============================================================================

type TaskState = "shipped" | "building" | "awaiting_approval" | "blocked" | "queued";

type Task = {
    id: string;
    n: number;
    title: string;
    sub: string;
    doneWhen: string;
    state: TaskState;
    ago: string;
    attempts: number;
    costUsd: number;
};

const TASKS: Task[] = [
    {
        id: "t9",
        n: 9,
        title: "Stripe billing - $19/mo plan",
        sub: "Self-serve upgrade, 14-day trial, test mode.",
        doneWhen: "a card is charged end-to-end in test mode",
        state: "queued",
        ago: "queued",
        attempts: 0,
        costUsd: 0,
    },
    {
        id: "t8",
        n: 8,
        title: "Team shared views",
        sub: "Route support-shaped mail to an assignable queue.",
        doneWhen: "two seats see the same queue with assignment",
        state: "queued",
        ago: "queued",
        attempts: 0,
        costUsd: 0,
    },
    {
        id: "t7",
        n: 7,
        title: "Reddit launch post - r/SaaS teardown",
        sub: "Build-in-public inbox teardown, soft CTA to the digest.",
        doneWhen: "post is live and links resolve",
        state: "blocked",
        ago: "8m ago",
        attempts: 2,
        costUsd: 0.14,
    },
    {
        id: "t6",
        n: 6,
        title: "Daily digest email",
        sub: "One 8am mail with the 5 threads that need a reply.",
        doneWhen: "a test account gets a correctly-ranked digest",
        state: "awaiting_approval",
        ago: "just now",
        attempts: 1,
        costUsd: 0.32,
    },
    {
        id: "t5",
        n: 5,
        title: "Snooze & nudge scheduler",
        sub: "Resurface a thread at the right moment; chase silent replies.",
        doneWhen: "a snoozed thread reappears on schedule",
        state: "building",
        ago: "running · 3m",
        attempts: 1,
        costUsd: 0.09,
    },
    {
        id: "t4",
        n: 4,
        title: "Inbox triage engine",
        sub: "Classify every thread into act / defer / archive.",
        doneWhen: "80% of a seeded inbox is auto-sorted correctly",
        state: "shipped",
        ago: "2h ago",
        attempts: 2,
        costUsd: 0.71,
    },
    {
        id: "t3",
        n: 3,
        title: "Landing page + waitlist",
        sub: "Hero, how-it-works, trust, pricing, FAQ.",
        doneWhen: "page deploys and the waitlist captures an email",
        state: "shipped",
        ago: "5h ago",
        attempts: 1,
        costUsd: 0.44,
    },
    {
        id: "t2",
        n: 2,
        title: "Magic-link auth",
        sub: "Passwordless sign-in, zero-friction onboarding.",
        doneWhen: "a new user lands in-app from an emailed link",
        state: "shipped",
        ago: "yesterday",
        attempts: 1,
        costUsd: 0.28,
    },
    {
        id: "t1",
        n: 1,
        title: "Scaffold app + deploy pipeline",
        sub: "TanStack Start, SQLite, CI, first green deploy.",
        doneWhen: "the skeleton is live on a URL",
        state: "shipped",
        ago: "2d ago",
        attempts: 1,
        costUsd: 0.19,
    },
];

const STATE_META: Record<TaskState, { label: string; color: string; Icon: typeof Check; pulse?: boolean }> = {
    shipped: { label: "shipped", color: "var(--success)", Icon: Check },
    building: { label: "building", color: "var(--warning)", Icon: Hammer, pulse: true },
    awaiting_approval: { label: "needs you", color: "var(--approval)", Icon: Clock, pulse: true },
    blocked: { label: "blocked", color: "var(--destructive)", Icon: CircleAlert },
    queued: { label: "queued", color: "var(--faint)", Icon: GitCommitHorizontal },
};

export function TaskTimeline() {
    // Local overrides so Approve/Reject feels live in the showcase.
    const [override, setOverride] = useState<Record<string, TaskState>>({});
    const stateOf = (t: Task): TaskState => override[t.id] ?? t.state;

    const tasks = TASKS.map((t) => ({ ...t, state: stateOf(t) }));
    const done = tasks.filter((t) => t.state === "shipped").length;
    const totalCost = tasks.reduce((s, t) => s + t.costUsd, 0);

    return (
        <div className="mx-auto max-w-[680px]">
            {/* header row */}
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Tasks</div>
                    <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">Build log</h2>
                </div>
                <div className="flex gap-5 text-right">
                    <div>
                        <div className="font-mono text-lg font-semibold text-foreground">
                            {done}/{tasks.length}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-wide text-faint">shipped</div>
                    </div>
                    <div>
                        <div className="font-mono text-lg font-semibold text-foreground">${totalCost.toFixed(2)}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wide text-faint">spent</div>
                    </div>
                </div>
            </div>

            {/* the timeline */}
            <ol className="relative m-0 list-none p-0">
                {/* spine */}
                <span className="absolute bottom-3 left-[11px] top-3 w-px bg-border" />
                {tasks.map((t) => {
                    const m = STATE_META[t.state];
                    const gate = t.state === "awaiting_approval" || t.state === "blocked";
                    return (
                        <li key={t.id} className="relative flex gap-4 pb-5 pl-0 last:pb-0">
                            {/* dot */}
                            <span className="relative z-10 mt-1 flex-none">
                                <span
                                    className={cn(
                                        "grid size-[23px] place-items-center rounded-full",
                                        m.pulse && "animate-pulse",
                                    )}
                                    style={{
                                        background: `color-mix(in srgb, ${m.color} 16%, var(--card))`,
                                        boxShadow: `0 0 0 4px var(--background), inset 0 0 0 1.5px ${m.color}`,
                                        color: m.color,
                                    }}
                                >
                                    <m.Icon className="size-3" strokeWidth={2.4} />
                                </span>
                            </span>

                            {/* card */}
                            <div
                                className={cn(
                                    "min-w-0 flex-1 rounded-xl border bg-card px-4 py-3 shadow-e1 transition-colors",
                                    gate ? "border-transparent" : "border-border",
                                )}
                                style={
                                    gate
                                        ? {
                                              borderColor: `color-mix(in srgb, ${m.color} 45%, transparent)`,
                                          }
                                        : undefined
                                }
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] font-bold text-faint">#{t.n}</span>
                                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
                                        {t.title}
                                    </span>
                                    <span
                                        className="flex-none rounded-full px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wide"
                                        style={{
                                            background: `color-mix(in srgb, ${m.color} 15%, transparent)`,
                                            color: m.color,
                                        }}
                                    >
                                        {m.label}
                                    </span>
                                </div>
                                <p className="mt-1 text-[12.5px] leading-[1.45] text-muted-foreground">{t.sub}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-faint">
                                    <span>{t.ago}</span>
                                    {t.attempts > 0 && (
                                        <span>
                                            · {t.attempts} attempt{t.attempts === 1 ? "" : "s"}
                                        </span>
                                    )}
                                    {t.costUsd > 0 && <span>· ${t.costUsd.toFixed(2)}</span>}
                                    <span className="text-muted-foreground">· done when {t.doneWhen}</span>
                                </div>

                                {gate && (
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOverride((o) => ({ ...o, [t.id]: "shipped" }))}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                        >
                                            <Check className="size-3.5" />
                                            {t.state === "blocked" ? "Approve fix" : "Approve & ship"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setOverride((o) => ({ ...o, [t.id]: "queued" }))}
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                                        >
                                            <X className="size-3.5" />
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
