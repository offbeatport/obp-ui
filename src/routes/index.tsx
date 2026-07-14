import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import {
    ActivityFeed,
    Avatar,
    CompanyTile,
    MetricsBar,
    SectionHead,
    toneColor,
    toneSoft,
} from "~/components/command-center/shared";
import { getBootState } from "~/server/agents";
import {
    type CompanyDetail,
    type InboxItem,
    type OpportunityItem,
    getCompany,
    getPortfolioMetrics,
    listActivity,
    listCompanies,
    listInbox,
    listOpportunities,
} from "~/server/data";

// The command center (dashTpl1) — portfolio metrics · needs-you hero · next moves ·
// companies strip · recent activity. Matches design/v2-prototypes/08-chat-spine-pro-v7.html.
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
        return { metrics, companies, activity, inbox, opportunities, hero, approval };
    },
    component: Home,
});

function Home() {
    const { metrics, companies, activity, inbox, opportunities, hero, approval } =
        Route.useLoaderData();

    return (
        <AppShell active="home">
            <div className="mx-auto flex max-w-[960px] flex-col gap-[26px] px-6 py-8">
                <MetricsBar metrics={metrics} />

                {hero && approval && <NeedsHero detail={hero} item={approval} />}

                <section>
                    <SectionHead label="Next moves" count={inbox.length + 1} />
                    <div className="mt-4 flex flex-col gap-0.5">
                        <NextMoves inbox={inbox} opportunities={opportunities} />
                    </div>
                </section>

                <section>
                    <SectionHead label="Companies" count={companies.length} />
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                        {companies.map((co) => (
                            <CompanyTile key={co.slug} co={co} flag={co.needsYou} />
                        ))}
                    </div>
                </section>

                <section>
                    <SectionHead label="Recent activity" />
                    <div className="mt-4">
                        <ActivityFeed items={activity} />
                    </div>
                </section>
            </div>
        </AppShell>
    );
}

// HERO — the one thing that needs you (dashTpl1 .hero).
function NeedsHero({ detail, item }: { detail: CompanyDetail; item: InboxItem }) {
    return (
        <section className="relative overflow-hidden rounded-xl border bg-card p-7 shadow-e2">
            <span
                className="absolute inset-y-0 left-0 w-1"
                style={{ background: toneColor("violet") }}
            />
            <div className="mb-[18px] flex items-center gap-[11px]">
                <span
                    className="inline-flex items-center gap-[7px] rounded-full px-[11px] py-[5px] font-mono text-[10.5px] font-medium uppercase tracking-[0.08em]"
                    style={{ color: toneColor("violet"), background: toneSoft("violet") }}
                >
                    <span
                        className="size-1.5 rounded-full"
                        style={{ background: toneColor("violet") }}
                    />
                    Awaiting your approval
                </span>
                <Link
                    to="/companies/$slug"
                    params={{ slug: detail.slug }}
                    className="ml-auto flex items-center gap-2"
                >
                    <Avatar name={detail.name} tone={detail.tone} className="size-6 text-[12px]" />
                    <span className="text-[13px] font-semibold leading-none">
                        {detail.name}
                        {detail.domain && (
                            <small className="mt-0.5 block font-mono text-[10px] font-normal text-faint">
                                {detail.domain}
                            </small>
                        )}
                    </span>
                </Link>
            </div>

            <div className="flex flex-col items-start gap-[18px] sm:flex-row sm:gap-[30px]">
                <div className="min-w-0 flex-1">
                    <div className="mb-[7px] font-mono text-[11px] text-faint">
                        SLICE {item.sliceN} · {detail.name.toUpperCase()}
                    </div>
                    <h2 className="mb-4 text-[24px] font-semibold leading-[1.22] tracking-[-0.015em]">
                        {detail.slice?.title ?? item.title}
                    </h2>
                    <div className="flex flex-wrap gap-2.5">
                        <span
                            className="inline-flex items-center gap-2 rounded-[11px] px-[13px] py-[7px] text-[12.5px] font-medium"
                            style={{ color: toneColor("green"), background: toneSoft("green") }}
                        >
                            <Check className="size-3.5" strokeWidth={2.4} />
                            doneWhen passed
                        </span>
                        {item.liveUrl && (
                            <a
                                href={item.liveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-[11px] bg-secondary px-[13px] py-[7px] font-mono text-[11.5px] text-muted-foreground transition hover:text-accent-foreground"
                            >
                                <ExternalLink className="size-3" />
                                {item.liveUrl.replace(/^https?:\/\//, "")}
                            </a>
                        )}
                    </div>
                </div>

                <div className="flex w-full flex-col gap-2.5 pt-0.5 sm:w-[178px]">
                    <button
                        type="button"
                        className="flex items-center justify-center gap-2 rounded-[13px] px-4 py-[13px] text-[14px] font-semibold text-white shadow-e1 transition hover:-translate-y-px hover:brightness-105"
                        style={{ background: toneColor("green") }}
                    >
                        <Check className="size-4" strokeWidth={2.4} />
                        Approve &amp; ship
                    </button>
                    <Link
                        to="/companies/$slug"
                        params={{ slug: detail.slug }}
                        className="rounded-[13px] border bg-card px-4 py-3 text-center text-[13.5px] font-medium text-muted-foreground transition hover:border-faint hover:text-foreground"
                    >
                        Review changes
                    </Link>
                    <p className="mt-0.5 text-center text-[11px] leading-[1.4] text-faint">
                        {item.sub}
                    </p>
                </div>
            </div>
        </section>
    );
}

// NEXT MOVES (dashTpl1 .moves) — derived from the inbox + the top opportunity.
function NextMoves({
    inbox,
    opportunities,
}: { inbox: InboxItem[]; opportunities: OpportunityItem[] }) {
    const top = opportunities
        .filter((o) => o.status === "candidate")
        .sort((a, b) => b.score - a.score)[0];

    const rows = inbox.map((i, idx) => {
        const text =
            i.kind === "approval" ? (
                <>
                    Approve <b className="font-bold">{i.companyName}</b> slice {i.sliceN} · it's
                    live and the check is green
                </>
            ) : i.kind === "blocked" ? (
                <>
                    Unblock <b className="font-bold">{i.companyName}</b> slice {i.sliceN}, or pause
                    the company
                </>
            ) : (
                <>
                    <b className="font-bold">{i.companyName}</b> — {i.title}
                </>
            );
        return (
            <Link
                key={i.id}
                to="/companies/$slug"
                params={{ slug: i.companySlug }}
                className="group flex items-center gap-3.5 rounded-lg px-4 py-3.5 transition hover:bg-card hover:shadow-e1"
            >
                <span className="w-4 flex-none font-mono text-[11px] text-faint">
                    {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[14px] font-medium leading-[1.35]">{text}</span>
                <ArrowRight className="size-4 flex-none text-faint transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
        );
    });

    if (top) {
        rows.push(
            <div key={top.id} className="flex items-center gap-3.5 rounded-lg px-4 py-3.5">
                <span className="w-4 flex-none font-mono text-[11px] text-faint">
                    {String(inbox.length + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-[14px] font-medium leading-[1.35]">
                    Promote <b className="font-bold">{top.title}</b> (demand {top.score}) to a
                    company
                </span>
                <Link
                    to="/opportunities"
                    className="flex-none rounded-[9px] px-[11px] py-1.5 text-[11.5px] font-semibold"
                    style={{ color: "var(--accent-foreground)", background: "var(--accent)" }}
                >
                    Promote
                </Link>
            </div>,
        );
    }
    return <>{rows}</>;
}
