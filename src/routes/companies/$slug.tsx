import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { ChatThread } from "~/components/command-center/chat";
import {
    Avatar,
    SLICE_META,
    SliceBadge,
    initials,
    toneColor,
    toneSoft,
} from "~/components/command-center/shared";
import {
    type ChatMessage,
    type CompanyDetail,
    type CompanySummary,
    getCompany,
    listCompanies,
} from "~/server/data";

// One company's workspace — co-pilot chat (left) + company dashboard (right).
export const Route = createFileRoute("/companies/$slug")({
    loader: async ({ params }) => {
        const [detail, companies] = await Promise.all([
            getCompany({ data: params.slug }),
            listCompanies(),
        ]);
        const summary = companies.find((c) => c.slug === params.slug) ?? null;
        return { detail, summary };
    },
    component: CompanyWorkspace,
});

// Seed a co-pilot intro when the DB has no chat yet (derived from the current slice state).
function seedMessages(co: CompanySummary): ChatMessage[] {
    const s = co.slice;
    let content: string;
    if (!s)
        content = `${co.name} is set up — I'll queue the first slice and surface anything that needs you here.`;
    else if (s.state === "awaiting_approval")
        content = `Slice ${s.n} (${s.title}) is built and the doneWhen check passed. Approve to ship?`;
    else if (s.state === "building")
        content = `Building slice ${s.n} · ${s.title}. I'll surface anything that needs your call right here.`;
    else if (s.state === "blocked")
        content = `Slice ${s.n} (${s.title}) is blocked — no progress. It needs a decision.`;
    else if (s.state === "todo")
        content = `Slice ${s.n} (${s.title}) is queued next. Nothing needs you right now.`;
    else content = `Slice ${s.n} (${s.title}) shipped. Lining up the next one.`;
    return [{ id: "seed", role: "assistant", content, ago: "now" }];
}

function CompanyWorkspace() {
    const { slug } = Route.useParams();
    const { detail, summary } = Route.useLoaderData();
    const co = detail ?? summary;

    if (!co) {
        return (
            <AppShell active="companies">
                <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-3 px-6 py-16 text-center">
                    <h1 className="font-display text-2xl">Company not found</h1>
                    <p className="text-muted-foreground">
                        No company matches <code className="font-mono">{slug}</code>.
                    </p>
                    <Link to="/companies" className="text-sm font-medium text-primary">
                        ← Back to portfolio
                    </Link>
                </div>
            </AppShell>
        );
    }

    const messages = detail?.messages.length ? detail.messages : seedMessages(co);
    const live = detail?.liveUrl;
    const domain = detail?.domain;
    const thesis = detail?.thesis;

    return (
        <AppShell active="companies">
            <div className="mx-auto flex h-full max-w-[1120px] flex-col px-6 py-6">
                <Link
                    to="/companies"
                    className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" /> Portfolio
                </Link>

                <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[1fr_360px]">
                    {/* CO-PILOT */}
                    <section className="flex min-h-0 flex-col rounded-xl border bg-secondary/40 p-4">
                        <header className="mb-3 flex items-center gap-3 border-b border-border-soft pb-3">
                            <Avatar name={co.name} tone={co.tone} className="size-9 text-[15px]" />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 text-[15px] font-semibold">
                                    {co.name}
                                    <span
                                        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium"
                                        style={{
                                            color: toneColor(
                                                co.status === "paused" ? "amber" : "green",
                                            ),
                                        }}
                                    >
                                        <span
                                            className="pulse size-1.5 rounded-full"
                                            style={{
                                                background: toneColor(
                                                    co.status === "paused" ? "amber" : "green",
                                                ),
                                            }}
                                        />
                                        {co.status === "paused" ? "paused" : "live"}
                                    </span>
                                </div>
                                <div className="truncate font-mono text-[11px] text-faint">
                                    agent · co-pilot
                                </div>
                            </div>
                        </header>
                        <ChatThread
                            messages={messages}
                            assistantMark={initials(co.name)}
                            reply={`On it — I'll fold that into ${co.name}'s build loop and surface anything that needs your call right here.`}
                            placeholder={`Message the ${co.name} agent…`}
                        />
                    </section>

                    {/* DASHBOARD */}
                    <aside className="flex flex-col gap-4 overflow-y-auto">
                        <Dashboard co={co} thesis={thesis} domain={domain} live={live} />
                    </aside>
                </div>
            </div>
        </AppShell>
    );
}

function Dashboard({
    co,
    thesis,
    domain,
    live,
}: {
    co: CompanySummary | CompanyDetail;
    thesis?: string;
    domain?: string;
    live?: string;
}) {
    const metrics: [string, string][] = [
        ["MRR", `$${co.mrr}`],
        ["Users", String(co.users)],
        ["Shipped", `${co.shipped}`],
        ["Status", co.status],
    ];
    return (
        <>
            {thesis && (
                <Card label="Thesis">
                    <p className="text-[13.5px] leading-relaxed text-muted-foreground">{thesis}</p>
                    {domain && (
                        <a
                            href={live ?? `https://${domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11.5px] text-accent-foreground"
                        >
                            <ExternalLink className="size-3" /> {domain}
                        </a>
                    )}
                </Card>
            )}

            <Card label="Metrics">
                <div className="grid grid-cols-2 gap-3">
                    {metrics.map(([l, v]) => (
                        <div key={l} className="rounded-lg border bg-card px-3 py-2.5">
                            <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                                {l}
                            </div>
                            <div className="mt-1 text-[18px] font-semibold capitalize">{v}</div>
                        </div>
                    ))}
                </div>
            </Card>

            {co.slice && (
                <Card label="Current slice">
                    <div className="mb-2">
                        <SliceBadge state={co.slice.state} />
                    </div>
                    <div className="text-[14px] font-medium leading-snug">
                        <span className="font-mono text-[12px] text-faint">S{co.slice.n}</span>{" "}
                        {co.slice.title}
                    </div>
                    <p className="mt-2 text-[12.5px] text-muted-foreground">
                        {SLICE_META[co.slice.state].label === "Awaiting you"
                            ? "Built and green — approve it from the co-pilot or your Inbox."
                            : SLICE_META[co.slice.state].label === "Blocked"
                              ? "Stalled — needs a decision to move."
                              : "The agent is working this on autopilot."}
                    </p>
                </Card>
            )}

            {live && (
                <a
                    href={live}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-[13.5px] font-medium transition hover:border-faint"
                    style={{ color: toneColor("green"), background: toneSoft("green") }}
                >
                    <ExternalLink className="size-4" /> Open live product
                </a>
            )}
        </>
    );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border bg-card p-4 shadow-e1">
            <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint">
                {label}
            </div>
            {children}
        </section>
    );
}
