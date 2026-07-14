import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
import { TONE_VAR } from "~/components/command-center/tone";
import type { OpportunityItem } from "~/server/data";
import { listOpportunities } from "~/server/data";

export const Route = createFileRoute("/opportunities")({
    loader: async () => ({ opportunities: await listOpportunities() }),
    component: Opportunities,
});

// Opportunities — the live prototype's renderOpportunitiesView() (basic shortlist):
// Basic/Advanced toggle · a calm ranked list of scored bets · promote to spin up a company.
// design/v2-prototypes/08-chat-spine-pro-v7.html.
function Opportunities() {
    const { opportunities } = Route.useLoaderData();
    const [view, setView] = useState<"basic" | "advanced">("basic");
    const rows = [...opportunities].sort((a, b) => b.score - a.score);

    return (
        <AppShell active="opportunities">
            <div className="cc px-6 py-10">
                <div className="oppv-head">
                    <div className="oppv-toggle" role="tablist" aria-label="Opportunities view">
                        <button
                            type="button"
                            className={`oppv-tg-btn${view === "basic" ? " on" : ""}`}
                            aria-pressed={view === "basic"}
                            onClick={() => setView("basic")}
                        >
                            Basic
                        </button>
                        <button
                            type="button"
                            className={`oppv-tg-btn${view === "advanced" ? " on" : ""}`}
                            aria-pressed={view === "advanced"}
                            onClick={() => setView("advanced")}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                <div className="oppb-wrap">
                    <p className="oppb-lead">
                        {view === "basic"
                            ? "A calm shortlist of scored bets, highest demand first. Promote one to spin up a walking skeleton."
                            : "The full evidence table streams in from the scout — promote any live bet to spin up a walking skeleton with slice #1 queued."}
                    </p>
                    {rows.map((o) => (
                        <OppRow key={o.id} o={o} />
                    ))}
                </div>
            </div>
        </AppShell>
    );
}

// score → tone (oppgScoreCol: ≥70 green · ≥50 amber · else slate).
function scoreTone(o: OpportunityItem): string {
    if (o.status === "killed") return TONE_VAR.slate;
    if (o.score >= 70) return TONE_VAR.green;
    if (o.score >= 50) return TONE_VAR.amber;
    return TONE_VAR.slate;
}

function OppRow({ o }: { o: OpportunityItem }) {
    const killed = o.status === "killed";
    return (
        <div className={`oppb-row${killed ? " killed" : ""}`}>
            <span className="oppb-score" style={{ background: scoreTone(o) }}>
                {o.score}
            </span>
            <div className="oppb-bd">
                <div className="oppb-name">{o.title}</div>
                <div className="oppb-one">{o.thesis}</div>
            </div>
            {killed ? (
                <button type="button" className="oppb-promote killed" disabled>
                    killed
                </button>
            ) : (
                <button type="button" className="oppb-promote">
                    {o.status === "promoted" ? "Promoted" : "Promote →"}
                </button>
            )}
        </div>
    );
}
