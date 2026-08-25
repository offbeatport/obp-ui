import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { CompanyCard } from "~/components/command-center/company-card";
import { usePollInvalidate } from "~/lib/use-poll-invalidate";
import { getPortfolioMetrics, listActivity, listCompanies } from "~/server/data";

// The Portfolio - every company you've started, as a card grid, with a portfolio stats strip.
// Reuses the prototype-faithful CompanyCard; the wrapper is inline Tailwind.
export const Route = createFileRoute("/companies/")({
    loader: async () => {
        const [companies, activity, metrics] = await Promise.all([
            listCompanies(),
            listActivity(),
            getPortfolioMetrics(),
        ]);
        return { companies, activity, metrics };
    },
    component: Portfolio,
});

function fmtMoney(n: number): string {
    return n >= 1000 ? `$${(Math.round(n / 100) / 10).toLocaleString()}k` : `$${n}`;
}

function Portfolio() {
    const { companies, activity, metrics } = Route.useLoaderData();
    usePollInvalidate(4000);

    const stats = [
        { label: "revenue / mo", value: fmtMoney(metrics.mrr), tone: "text-success" },
        { label: "paying users", value: String(metrics.users) },
        { label: "active", value: String(metrics.active) },
        { label: "slices shipped", value: String(metrics.shipped) },
        {
            label: "needs you",
            value: String(metrics.needsYou),
            tone: metrics.needsYou > 0 ? "text-primary" : undefined,
        },
    ];

    return (
        <AppShell active="companies">
            <div className="cc mx-auto w-full max-w-[1040px] px-6 py-10">
                {/* header */}
                <header className="text-center">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                        {"// Portfolio"}
                    </div>
                    <h1 className="mt-2 font-display text-[32px] font-light tracking-[-0.02em]">Portfolio</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                        {companies.length === 0
                            ? "No companies yet - start your first one."
                            : `${companies.length} ${companies.length === 1 ? "company" : "companies"} in your portfolio.`}
                    </p>

                    {companies.length > 0 && (
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-4 shadow-e1">
                            {stats.map((s) => (
                                <div key={s.label} className="text-center">
                                    <div
                                        className={`font-display text-2xl font-semibold ${s.tone ?? "text-foreground"}`}
                                    >
                                        {s.value}
                                    </div>
                                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                                        {s.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </header>

                {/* grid / empty state */}
                {companies.length === 0 ? (
                    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center">
                        <p className="text-sm text-muted-foreground">
                            You bring the ideas - I build, launch and run them.
                        </p>
                        <Link
                            to="/companies/new"
                            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-105"
                        >
                            <Plus className="size-4" /> Start your first company
                        </Link>
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-[22px]">
                        {companies.map((c) => (
                            <CompanyCard key={c.id} c={c} feed={activity.filter((a) => a.companySlug === c.slug)} />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
