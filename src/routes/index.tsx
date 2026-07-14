import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import {
    ArrowIcon,
    Avatar,
    CheckIcon,
    Column,
    ExternalIcon,
    Sbadge,
    SecHead,
} from "~/components/command-center/parts";
import { TONE } from "~/components/command-center/tone";
import { getBootState } from "~/server/agents";
import {
    getCompany,
    getPortfolioMetrics,
    listActivity,
    listCompanies,
    listInbox,
    listOpportunities,
} from "~/server/data";

export const Route = createFileRoute("/")({
    // Self-host first-run gate → onboarding (until an agent is picked).
    beforeLoad: async () => {
        const boot = await getBootState();
        if (boot.deployment === "self-host" && !boot.onboarded) {
            throw redirect({ to: "/onboarding" });
        }
    },
    loader: async () => {
        const [metrics, companies, activity, inbox, opportunities] = await Promise.all([
            getPortfolioMetrics(),
            listCompanies(),
            listActivity(),
            listInbox(),
            listOpportunities(),
        ]);
        const approval = inbox.find((i) => i.kind === "approval");
        const hero = approval ? await getCompany({ data: approval.companySlug }) : null;
        return { metrics, companies, activity, inbox, opportunities, hero };
    },
    component: Home,
});

// Command center — portfolio metrics · needs-you hero · next moves · companies · activity.
// Matches design/v2-prototypes/08-chat-spine-pro-v7.html (dashTpl1).
function Home() {
    const { metrics, companies, activity, inbox, opportunities, hero } = Route.useLoaderData();
    const approval = inbox.find((i) => i.kind === "approval");
    const blocked = inbox.find((i) => i.kind === "blocked");
    const topOpp = opportunities.find((o) => o.status === "candidate");
    const moveCount = (approval ? 1 : 0) + (blocked ? 1 : 0) + (topOpp ? 1 : 0);

    return (
        <AppShell active="home">
            <Column className="flex flex-col gap-[26px] py-6 text-foreground">
                {/* portfolio metrics line */}
                <div className="flex flex-wrap items-center gap-x-[22px] gap-y-2 px-1 py-0.5">
                    <Metric v={`$${metrics.mrr}`} l="MRR" />
                    <Dot />
                    <Metric v={metrics.users} l="users" />
                    <Dot />
                    <Metric v={metrics.active} l="active" />
                    <Dot />
                    <Metric v={metrics.shipped} l="shipped" />
                    {metrics.needsYou > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-accent px-[11px] py-1 text-[11.5px] font-semibold text-accent-foreground">
                            <span className="size-[7px] rounded-full bg-primary pulse" />
                            {metrics.needsYou} needs you
                        </span>
                    )}
                </div>

                {/* HERO — the one thing that needs you */}
                {approval && hero && (
                    <section className="relative overflow-hidden rounded-[18px] border bg-card px-7 pb-6 pt-[26px] shadow-e2">
                        <span className="absolute inset-y-0 left-0 w-1 bg-approval" />
                        <div className="mb-[18px] flex items-center gap-[11px]">
                            <span className="inline-flex items-center gap-[7px] rounded-full bg-approval-soft px-[11px] py-[5px] font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-approval">
                                <span className="size-1.5 rounded-full bg-approval" />
                                Awaiting your approval
                            </span>
                            <Link
                                to="/companies/$slug"
                                params={{ slug: hero.slug }}
                                className="ml-auto flex items-center gap-2"
                            >
                                <Avatar
                                    name={hero.name}
                                    tone={hero.tone}
                                    className="size-6 rounded-[7px] text-xs"
                                />
                                <span className="text-[13px] font-semibold">
                                    {hero.name}
                                    {hero.domain && (
                                        <small className="block font-mono text-[10px] font-normal text-faint">
                                            {hero.domain}
                                        </small>
                                    )}
                                </span>
                            </Link>
                        </div>

                        <div className="flex items-start gap-[30px] max-md:flex-col">
                            <div className="min-w-0 flex-1">
                                <div className="mb-[7px] font-mono text-[11px] text-faint">
                                    SLICE {approval.sliceN} · {hero.name.toUpperCase()}
                                </div>
                                <h2 className="mb-4 text-[24px] font-semibold leading-[1.22] tracking-[-0.015em]">
                                    {approval.title.replace(/^Approve slice \d+ — /, "")}
                                </h2>
                                <div className="flex flex-wrap gap-[9px]">
                                    <span className="inline-flex items-center gap-2 rounded-[11px] bg-success-soft px-[13px] py-[7px] text-[12.5px] font-medium text-success">
                                        <CheckIcon className="size-3.5" />
                                        doneWhen passed
                                    </span>
                                    {approval.liveUrl && (
                                        <a
                                            href={approval.liveUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-[11px] bg-secondary px-[13px] py-[7px] font-mono text-[11.5px] text-muted-foreground hover:text-accent-foreground"
                                        >
                                            <ExternalIcon className="size-3.5" />
                                            {approval.liveUrl.replace(/^https?:\/\//, "")}
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="flex w-[178px] flex-none flex-col gap-[9px] pt-0.5 max-md:w-full">
                                <button
                                    type="button"
                                    className="flex items-center justify-center gap-2 rounded-[13px] bg-success px-4 py-[13px] text-sm font-semibold text-white shadow-e1 transition hover:brightness-105"
                                >
                                    <CheckIcon className="size-4" />
                                    Approve &amp; ship
                                </button>
                                <Link
                                    to="/companies/$slug"
                                    params={{ slug: hero.slug }}
                                    className="rounded-[13px] border bg-card px-4 py-3 text-center text-[13.5px] font-medium text-muted-foreground hover:border-faint hover:text-foreground"
                                >
                                    Review changes
                                </Link>
                                <p className="mt-0.5 text-center text-[11px] leading-[1.4] text-faint">
                                    {approval.sub}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* NEXT MOVES */}
                <div>
                    <div className="my-4">
                        <SecHead label="Next moves" count={moveCount} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {approval && (
                            <Move n="01" slug={approval.companySlug}>
                                Approve <b className="font-semibold">{approval.companyName}</b>{" "}
                                slice {approval.sliceN} · it's live and the check is green
                            </Move>
                        )}
                        {blocked && (
                            <Move n="02" slug={blocked.companySlug}>
                                Unblock <b className="font-semibold">{blocked.companyName}</b> slice{" "}
                                {blocked.sliceN}, or pause the company
                            </Move>
                        )}
                        {topOpp && (
                            <div className="flex items-center gap-3.5 rounded-lg px-4 py-[13px]">
                                <span className="w-4 flex-none font-mono text-[11px] text-faint">
                                    03
                                </span>
                                <MoveText>
                                    Promote <b className="font-semibold">{topOpp.title}</b> (demand{" "}
                                    {topOpp.score}) to a company
                                </MoveText>
                                <button
                                    type="button"
                                    className="flex-none rounded-[9px] bg-accent px-[11px] py-1.5 text-[11.5px] font-semibold text-accent-foreground hover:brightness-95"
                                >
                                    Promote
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* COMPANIES STRIP */}
                <div>
                    <div className="my-4">
                        <SecHead label="Companies" count={companies.length} />
                    </div>
                    <div className="grid grid-cols-5 gap-3 max-md:grid-cols-2">
                        {companies.map((c) => (
                            <Link
                                key={c.slug}
                                to="/companies/$slug"
                                params={{ slug: c.slug }}
                                className={`flex flex-col gap-[11px] rounded-lg border bg-card px-3.5 pb-3.5 pt-[15px] shadow-e1 transition hover:-translate-y-0.5 hover:shadow-e2 ${
                                    c.needsYou ? "border-approval/40" : ""
                                }`}
                            >
                                <div className="flex items-center gap-[9px]">
                                    <Avatar name={c.name} tone={c.tone} />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
                                            <span
                                                className={`size-[7px] flex-none rounded-full ${
                                                    c.status === "active"
                                                        ? "bg-success"
                                                        : "bg-warning"
                                                }`}
                                            />
                                            {c.name}
                                        </div>
                                        <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                                            ${c.mrr} · {c.users}u · {c.shipped} shipped
                                        </div>
                                    </div>
                                </div>
                                {c.slice && (
                                    <div className="border-t border-border-soft pt-2.5">
                                        <Sbadge state={c.slice.state} />
                                        <div className="line-clamp-2 text-xs leading-[1.4] text-muted-foreground">
                                            <b className="font-mono text-[11px] font-medium text-faint">
                                                S{c.slice.n}
                                            </b>{" "}
                                            {c.slice.title}
                                        </div>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* RECENT ACTIVITY */}
                <div>
                    <div className="my-4">
                        <SecHead label="Recent activity" />
                    </div>
                    <div className="flex flex-col">
                        {activity.map((a) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 border-t border-border-soft px-1 py-2 text-[12.5px] text-muted-foreground first:border-t-0"
                            >
                                <span
                                    className={`size-1.5 flex-none rounded-full ${TONE[a.tone].solid}`}
                                />
                                <span className="flex-1 leading-[1.35]">
                                    {a.companyName && (
                                        <b className="font-semibold text-foreground">
                                            {a.companyName}
                                        </b>
                                    )}{" "}
                                    {a.text}
                                </span>
                                <span
                                    className={`flex-none font-mono text-[10.5px] ${
                                        a.ago === "now" ? "text-info" : "text-faint"
                                    }`}
                                >
                                    {a.ago}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </Column>
        </AppShell>
    );
}

function Metric({ v, l }: { v: string | number; l: string }) {
    return (
        <div className="flex items-baseline gap-[7px]">
            <span className="font-mono text-[17px] font-medium tracking-[-0.01em]">{v}</span>
            <span className="text-[11px] text-muted-foreground">{l}</span>
        </div>
    );
}

const Dot = () => <span className="size-[3px] rounded-full bg-border" />;

function MoveText({ children }: { children: React.ReactNode }) {
    return <span className="flex-1 text-sm font-medium leading-[1.35]">{children}</span>;
}

function Move({ n, slug, children }: { n: string; slug: string; children: React.ReactNode }) {
    return (
        <Link
            to="/companies/$slug"
            params={{ slug }}
            className="group flex items-center gap-3.5 rounded-lg border-t border-border-soft px-4 py-[13px] no-underline transition first:border-t-0 hover:border-transparent hover:bg-card hover:shadow-e1"
        >
            <span className="w-4 flex-none font-mono text-[11px] text-faint">{n}</span>
            <MoveText>{children}</MoveText>
            <span className="flex-none text-faint transition group-hover:translate-x-0.5 group-hover:text-primary">
                <ArrowIcon className="size-[17px]" />
            </span>
        </Link>
    );
}
