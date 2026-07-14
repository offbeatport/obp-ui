import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import type { OpportunityItem } from "~/server/data";
import { listOpportunities } from "~/server/data";

export const Route = createFileRoute("/opportunities")({
    loader: async () => ({ opportunities: await listOpportunities() }),
    component: Opportunities,
});

// Opportunities — cheap bets scored on demand, promote the good ones.
// Ported from design/v2-prototypes/08-chat-spine-pro-v7.html (oppCardHTML / .opp-card).
function Opportunities() {
    const { opportunities } = Route.useLoaderData();
    return (
        <AppShell active="opportunities">
            <div className="mx-auto w-full max-w-[820px] px-6 py-9">
                <div className="mb-6">
                    <span className="rounded-full bg-success-soft px-[9px] py-[3px] font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-success">
                        Opportunities
                    </span>
                    <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em]">
                        Cheap bets, scored on demand
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Ranked demand signals — promote one to start a company.
                    </p>
                </div>

                <div className="overflow-hidden rounded-[18px] border bg-card shadow-e1">
                    <div className="border-b px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
                        {opportunities.length} candidates · sorted by demand
                    </div>
                    <div className="flex flex-col gap-2.5 p-4">
                        {opportunities.map((o) => (
                            <OppCard key={o.id} o={o} />
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

const CIRC = 2 * Math.PI * 18; // r=18 ring circumference

function OppCard({ o }: { o: OpportunityItem }) {
    const killed = o.status === "killed";
    const promoted = o.status === "promoted";
    // demand → tone (matches oppCardHTML: ≥70 green · ≥50 amber · else slate)
    const tone = killed
        ? "text-neutral"
        : o.score >= 70
          ? "text-success"
          : o.score >= 50
            ? "text-warning"
            : "text-neutral";
    const off = CIRC * (1 - o.score / 100);

    return (
        <div
            className={`flex items-center gap-3.5 rounded-lg border px-[15px] py-[13px] ${
                killed ? "opacity-55" : ""
            }`}
        >
            {/* demand ring */}
            <div className="flex flex-none flex-col items-center gap-[3px]">
                <div className={`relative size-[46px] ${tone}`}>
                    <svg width="46" height="46" className="-rotate-90" aria-hidden="true">
                        <circle
                            cx="23"
                            cy="23"
                            r="18"
                            fill="none"
                            stroke="var(--border)"
                            strokeWidth="4"
                        />
                        <circle
                            cx="23"
                            cy="23"
                            r="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            strokeDashoffset={off}
                        />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center font-mono text-[13px] font-bold">
                        {o.score}
                    </div>
                </div>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-faint">
                    demand
                </span>
            </div>

            {/* info */}
            <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{o.title}</div>
                <div className="text-xs text-faint">{o.thesis}</div>
            </div>

            {/* promote */}
            {killed ? (
                <span className="flex-none rounded-full bg-neutral-soft px-[15px] py-2 text-[13.5px] font-semibold text-faint">
                    killed
                </span>
            ) : (
                <button
                    type="button"
                    className="flex-none rounded-full bg-primary px-[15px] py-2 text-[13.5px] font-semibold text-primary-foreground transition hover:brightness-105"
                >
                    {promoted ? "Promoted" : "Promote →"}
                </button>
            )}
        </div>
    );
}
