import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { Avatar, Sbadge } from "~/components/command-center/parts";
import { TONE } from "~/components/command-center/tone";
import { listActivity, listCompanies } from "~/server/data";

export const Route = createFileRoute("/companies/")({
    loader: async () => {
        const [companies, activity] = await Promise.all([listCompanies(), listActivity()]);
        return { companies, activity };
    },
    component: Portfolio,
});

// Portfolio grid — one co-card per company (brandmark · metrics · current slice · live feed).
// Card anatomy from design/v2-prototypes/08-chat-spine-pro-v7.html (.co-card), fed by the contract.
function Portfolio() {
    const { companies, activity } = Route.useLoaderData();
    return (
        <AppShell active="companies">
            <div className="mx-auto w-full max-w-[1120px] px-6 py-9">
                <header className="mb-8 flex items-end justify-between gap-4">
                    <div>
                        <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint">
                            {"// Portfolio"}
                        </div>
                        <h1 className="mt-1.5 font-display text-3xl font-light tracking-tight">
                            Companies
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Every company you've started — status, MRR, current slice.
                        </p>
                    </div>
                    <Link
                        to="/companies/new"
                        className="inline-flex flex-none items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-105"
                    >
                        <Plus className="size-4" /> New company
                    </Link>
                </header>

                <div className="grid gap-[22px] [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
                    {companies.map((c) => {
                        const feed = activity.filter((a) => a.companySlug === c.slug).slice(0, 4);
                        return (
                            <Link
                                key={c.slug}
                                to="/companies/$slug"
                                params={{ slug: c.slug }}
                                className={`group flex flex-col gap-4 rounded-[18px] border bg-card p-[22px] shadow-e1 transition duration-200 hover:-translate-y-0.5 hover:border-current hover:shadow-e2 ${
                                    TONE[c.tone].text
                                }`}
                            >
                                {/* head — brandmark · name · needs-you */}
                                <div className="flex items-center gap-2.5 text-foreground">
                                    <Avatar
                                        name={c.name}
                                        tone={c.tone}
                                        className="size-11 rounded-xl text-base"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <h3 className="truncate font-display text-lg font-semibold tracking-[-0.01em]">
                                            {c.name}
                                        </h3>
                                        <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] text-faint">
                                            <span
                                                className={`size-[7px] rounded-full ${
                                                    c.status === "active"
                                                        ? "bg-success"
                                                        : "bg-warning"
                                                }`}
                                            />
                                            ${c.mrr} · {c.users}u · {c.shipped} shipped
                                        </div>
                                    </div>
                                    {c.needsYou && (
                                        <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-primary px-2 py-[3px] font-mono text-[10px] font-semibold tracking-[0.03em] text-primary-foreground">
                                            <span className="size-1.5 rounded-full bg-white pulse" />
                                            needs you
                                        </span>
                                    )}
                                </div>

                                {/* current slice */}
                                {c.slice && (
                                    <div className="text-foreground">
                                        <Sbadge state={c.slice.state} />
                                        <div className="text-[13px] leading-[1.45] text-muted-foreground">
                                            <b className="font-mono text-[11px] font-medium text-faint">
                                                S{c.slice.n}
                                            </b>{" "}
                                            {c.slice.title}
                                        </div>
                                    </div>
                                )}

                                {/* live activity feed */}
                                <div className="flex flex-col gap-2 border-t pt-3">
                                    <div className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-faint">
                                        <span className="size-[5px] rounded-full bg-success pulse" />
                                        live activity
                                    </div>
                                    <div className="flex min-h-[72px] flex-col gap-1.5">
                                        {feed.length > 0 ? (
                                            feed.map((a) => (
                                                <div
                                                    key={a.id}
                                                    className="flex items-center gap-2 overflow-hidden font-mono text-[11.5px] text-muted-foreground"
                                                >
                                                    <span
                                                        className={`size-[5px] flex-none rounded-full ${TONE[a.tone].solid}`}
                                                    />
                                                    <span className="truncate">{a.text}</span>
                                                    <span className="ml-auto flex-none text-faint">
                                                        {a.ago}
                                                    </span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="font-mono text-[11.5px] text-faint">
                                                idle · no recent activity
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </AppShell>
    );
}
