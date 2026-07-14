import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { toneColor, toneSoft } from "~/components/command-center/shared";
import { type OpportunityItem, listOpportunities } from "~/server/data";

// Ranked demand signals — a calm shortlist, highest demand first. Promote one to start a company.
export const Route = createFileRoute("/opportunities")({
    loader: async () => ({ opportunities: await listOpportunities() }),
    component: Opportunities,
});

// score → tone (prototype oppgScoreCol: ≥70 green · ≥50 amber · else slate)
const scoreTone = (o: OpportunityItem) =>
    o.status === "killed" ? "slate" : o.score >= 70 ? "green" : o.score >= 50 ? "amber" : "slate";

function Opportunities() {
    const { opportunities } = Route.useLoaderData();
    const rows = [...opportunities].sort((a, b) => b.score - a.score);

    return (
        <AppShell active="opportunities">
            <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-6 py-8">
                <header className="text-center">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Opportunities"}
                    </div>
                    <h1 className="mt-2 font-display text-3xl font-light tracking-tight">
                        Opportunities
                    </h1>
                    <p className="mx-auto mt-2 max-w-[520px] text-[13px] leading-relaxed text-muted-foreground">
                        A calm shortlist of scored bets, highest demand first. Promote one to spin
                        up a walking skeleton.
                    </p>
                </header>

                <div className="flex flex-col gap-2.5">
                    {rows.map((o) => {
                        const killed = o.status === "killed";
                        const tone = scoreTone(o);
                        return (
                            <div
                                key={o.id}
                                className={`flex items-center gap-3.5 rounded-[14px] border bg-card p-4 shadow-e1 transition hover:border-accent ${
                                    killed ? "opacity-55" : ""
                                }`}
                            >
                                <span
                                    className="grid size-[42px] flex-none place-items-center rounded-[11px] font-mono text-[16px] font-bold text-white"
                                    style={{ background: toneColor(tone) }}
                                >
                                    {o.score}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="font-display text-[15px] font-semibold tracking-[-0.01em]">
                                        {o.title}
                                    </div>
                                    <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-[1.45] text-muted-foreground">
                                        {o.thesis}
                                    </div>
                                </div>
                                {killed ? (
                                    <span
                                        className="flex-none rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-faint"
                                        style={{ background: toneSoft("slate") }}
                                    >
                                        killed
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="inline-flex flex-none items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold shadow-e1 transition hover:-translate-y-px hover:brightness-105"
                                        style={{
                                            color: "var(--accent-foreground)",
                                            background: "var(--accent)",
                                        }}
                                    >
                                        Promote <ArrowRight className="size-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </AppShell>
    );
}
