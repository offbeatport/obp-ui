import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { Avatar, ExternalIcon, Sbadge } from "~/components/command-center/parts";
import { TONE, initial } from "~/components/command-center/tone";
import type { ChatMessage, CompanyDetail } from "~/server/data";
import { getCompany, listActivity, listCompanies } from "~/server/data";

export const Route = createFileRoute("/companies/$slug")({
    loader: async ({ params }) => {
        const [detail, companies, activity] = await Promise.all([
            getCompany({ data: params.slug }),
            listCompanies(),
            listActivity(),
        ]);
        const summary = companies.find((c) => c.slug === params.slug) ?? null;
        return {
            detail,
            summary,
            activity: activity.filter((a) => a.companySlug === params.slug),
        };
    },
    component: CompanyWorkspace,
});

// One company's workspace — co-pilot chat (left) + live dashboard (right).
// Chat + dashboard language from design/v2-prototypes/08-chat-spine-pro-v7.html (.cpg-chat / .rm-v8).
function CompanyWorkspace() {
    const { slug } = Route.useParams();
    const { detail, summary, activity } = Route.useLoaderData();
    const base = detail ?? summary;

    if (!base) {
        return (
            <AppShell active="companies">
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16 text-center">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Not found"}
                    </div>
                    <h1 className="mt-2 font-display text-4xl font-light tracking-tight">{slug}</h1>
                    <p className="mt-3 text-muted-foreground">No company with this slug.</p>
                    <Link to="/companies" className="mt-4 text-sm text-primary hover:underline">
                        ← Back to portfolio
                    </Link>
                </div>
            </AppShell>
        );
    }

    // Fields only on CompanyDetail; degrade gracefully when only a summary exists.
    const co = base as CompanyDetail;
    const messages = detail?.messages ?? [];

    return (
        <AppShell active="companies">
            <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(360px,420px)_1fr]">
                {/* ============ LEFT · co-pilot chat ============ */}
                <aside className="flex min-h-0 flex-col border-r lg:h-full">
                    <div className="flex items-start gap-3.5 border-b px-5 py-4">
                        <Avatar
                            name={co.name}
                            tone={co.tone}
                            className="size-10 rounded-xl text-[17px]"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate font-display text-[22px] font-semibold tracking-[-0.02em]">
                                    {co.name}
                                </span>
                                <span
                                    className={`size-2 flex-none rounded-full ${
                                        co.status === "active" ? "bg-success pulse" : "bg-warning"
                                    }`}
                                />
                            </div>
                            {detail?.thesis && (
                                <p className="mt-1 truncate text-xs leading-[1.45] text-muted-foreground">
                                    {detail.thesis}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                        {messages.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {messages.map((m) => (
                                    <Bubble key={m.id} m={m} co={co} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                <Avatar
                                    name={co.name}
                                    tone={co.tone}
                                    className="size-11 rounded-xl text-base"
                                />
                                <p className="mt-3 text-sm font-medium">Message {co.name}</p>
                                <p className="mt-1 text-xs text-faint">
                                    Steer this company — ask for changes, approve slices, set
                                    direction.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="relative px-3.5 pb-3.5 pt-2">
                        <textarea
                            rows={1}
                            placeholder={`Message ${co.name}…`}
                            className="block max-h-[260px] min-h-[92px] w-full resize-none rounded-xl border bg-card px-3.5 py-3 pr-12 text-sm leading-relaxed outline-none focus:border-primary"
                        />
                        <button
                            type="button"
                            aria-label="Send"
                            className="absolute bottom-6 right-6 grid size-[30px] place-items-center rounded-full bg-primary text-[15px] text-primary-foreground active:scale-95"
                        >
                            ↑
                        </button>
                    </div>
                </aside>

                {/* ============ RIGHT · company dashboard ============ */}
                <div className="min-h-0 overflow-y-auto">
                    <div className="mx-auto w-full max-w-[760px] px-8 py-9">
                        <Link
                            to="/companies"
                            className="mb-6 inline-flex items-center gap-1.5 font-mono text-[11px] text-faint hover:text-foreground"
                        >
                            <ArrowLeft className="size-3.5" /> Portfolio
                        </Link>

                        {/* identity + metrics */}
                        <div className="flex flex-wrap items-start justify-between gap-5">
                            <div>
                                <h1 className="font-display text-[26px] font-semibold tracking-[-0.02em]">
                                    {co.name}
                                </h1>
                                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-faint">
                                    <span
                                        className={`size-[7px] rounded-full ${
                                            co.status === "active" ? "bg-success" : "bg-warning"
                                        }`}
                                    />
                                    {co.status}
                                    {co.domain && <span>· {co.domain}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <Metric v={`$${co.mrr}`} l="MRR" />
                                <Metric v={co.users} l="users" />
                                <Metric v={co.shipped} l="shipped" />
                            </div>
                        </div>

                        {detail?.thesis && (
                            <p className="mt-4 max-w-[54ch] font-serif text-[15px] leading-[1.55] text-muted-foreground">
                                {detail.thesis}
                            </p>
                        )}

                        {/* current slice */}
                        {co.slice && (
                            <section className="mt-8 rounded-[18px] border bg-card p-6 shadow-e1">
                                <div className="mb-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
                                    Current slice
                                </div>
                                <Sbadge state={co.slice.state} />
                                <h2 className="mt-2 font-display text-lg font-medium leading-[1.4]">
                                    <span className="font-mono text-[13px] text-faint">
                                        S{co.slice.n}
                                    </span>{" "}
                                    {co.slice.title}
                                </h2>
                                {co.needsYou && (
                                    <div className="mt-4 flex flex-wrap gap-2.5">
                                        <button
                                            type="button"
                                            className="rounded-[10px] bg-success px-4 py-2.5 text-[13px] font-semibold text-white shadow-e1 transition hover:brightness-105"
                                        >
                                            Approve &amp; ship
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-[10px] border bg-card px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                                        >
                                            Review changes
                                        </button>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* live product */}
                        {detail?.liveUrl && (
                            <section className="mt-6 overflow-hidden rounded-[18px] border bg-card shadow-e1">
                                <div className="flex items-center gap-2 border-b bg-secondary px-4 py-2.5">
                                    <span className="size-2.5 rounded-full bg-destructive/60" />
                                    <span className="size-2.5 rounded-full bg-warning/60" />
                                    <span className="size-2.5 rounded-full bg-success/60" />
                                    <span className="ml-2 truncate font-mono text-[11px] text-faint">
                                        {detail.liveUrl.replace(/^https?:\/\//, "")}
                                    </span>
                                    <a
                                        href={detail.liveUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline"
                                    >
                                        <ExternalIcon className="size-3.5" /> Open
                                    </a>
                                </div>
                                <div className="grid place-items-center px-6 py-10 text-center">
                                    <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 font-display text-2xl font-semibold text-primary">
                                        {initial(co.name)}
                                    </div>
                                    <p className="mt-3 text-sm font-medium">{co.name} is live</p>
                                    <p className="mt-0.5 font-mono text-[11px] text-faint">
                                        {detail.liveUrl.replace(/^https?:\/\//, "")}
                                    </p>
                                </div>
                            </section>
                        )}

                        {/* recent activity */}
                        {activity.length > 0 && (
                            <section className="mt-8">
                                <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
                                    Recent activity
                                </div>
                                <div className="flex flex-col">
                                    {activity.map((a) => (
                                        <div
                                            key={a.id}
                                            className="flex items-center gap-3 border-t border-border-soft py-2.5 text-[13px] text-muted-foreground first:border-t-0"
                                        >
                                            <span
                                                className={`size-1.5 flex-none rounded-full ${TONE[a.tone].solid}`}
                                            />
                                            <span className="flex-1">{a.text}</span>
                                            <span className="flex-none font-mono text-[10.5px] text-faint">
                                                {a.ago}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

// Left-rail chat bubble (.cpg-chat .msg / .bubble).
function Bubble({ m, co }: { m: ChatMessage; co: CompanyDetail }) {
    if (m.role === "system") {
        return (
            <div className="flex items-center gap-2 px-1.5 font-mono text-[10.5px] text-faint">
                <span className="size-[5px] flex-none rounded-full bg-success shadow-[0_0_0_3px_var(--success-soft)]" />
                <span className="min-w-0 flex-1 truncate">{m.content}</span>
                <span className="ml-auto flex-none opacity-65">{m.ago}</span>
            </div>
        );
    }
    const me = m.role === "user";
    return (
        <div className={`flex items-start gap-[11px] ${me ? "flex-row-reverse" : ""}`}>
            {me ? (
                <span className="grid size-7 flex-none place-items-center rounded-[9px] bg-secondary text-[11px] font-semibold text-muted-foreground">
                    You
                </span>
            ) : (
                <Avatar
                    name={co.name}
                    tone={co.tone}
                    className="size-7 rounded-[9px] text-[13px]"
                />
            )}
            <div
                className={
                    me
                        ? "max-w-[300px] rounded-[14px_5px_14px_14px] bg-primary px-3.5 py-2.5 text-[13.5px] text-primary-foreground"
                        : "max-w-[440px] rounded-[5px_14px_14px_14px] py-0.5 text-[13.5px] text-foreground"
                }
            >
                <p>{m.content}</p>
                <span
                    className={`mt-1.5 block font-mono text-[10px] ${
                        me ? "text-primary-foreground/70" : "text-faint"
                    }`}
                >
                    {m.ago}
                </span>
            </div>
        </div>
    );
}

function Metric({ v, l }: { v: string | number; l: string }) {
    return (
        <div className="flex flex-col items-end">
            <span className="font-mono text-[19px] font-medium tracking-[-0.01em]">{v}</span>
            <span className="text-[10.5px] text-faint">{l}</span>
        </div>
    );
}
