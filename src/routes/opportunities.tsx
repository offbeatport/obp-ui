import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "~/components/app-shell";
import { listOpportunities } from "~/server/data";

// The opportunities feed — scored demand candidates the engine's scope pass writes. Ranked
// by score, newest gate at top. Lane: surfaces.
export const Route = createFileRoute("/opportunities")({
    loader: async () => ({
        items: (await listOpportunities()).slice().sort((a, b) => b.score - a.score),
    }),
    component: Opportunities,
});

function Opportunities() {
    const { items } = Route.useLoaderData();
    const router = useRouter();

    useEffect(() => {
        const t = setInterval(() => void router.invalidate(), 4000);
        return () => clearInterval(t);
    }, [router]);

    return (
        <AppShell active="opportunities">
            <div className="mx-auto max-w-3xl px-6 py-10">
                <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-faint">
                    {"// Opportunities"}
                </div>
                <h1 className="font-display text-3xl font-light tracking-tight">Opportunities</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Scored demand candidates surfaced while scoping your thoughts.
                </p>

                {items.length === 0 ? (
                    <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No opportunities yet — start a company and the agents surface more as they
                        research.
                    </div>
                ) : (
                    <div className="mt-6 space-y-2.5">
                        {items.map((o) => (
                            <div
                                key={o.id}
                                className="flex items-start gap-4 rounded-xl border bg-card p-4"
                            >
                                <div className="flex-none text-center">
                                    <div className="font-display text-2xl font-semibold text-primary">
                                        {o.score}
                                    </div>
                                    <div className="text-[10px] uppercase tracking-[0.08em] text-faint">
                                        demand
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{o.title}</span>
                                        {o.status === "promoted" && (
                                            <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-success">
                                                promoted
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        {o.thesis}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
