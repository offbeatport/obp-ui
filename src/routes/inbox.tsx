import { Link, createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { ExternalIcon, SecHead } from "~/components/command-center/parts";
import { TONE } from "~/components/command-center/tone";
import type { InboxItem } from "~/server/data";
import { listInbox } from "~/server/data";

export const Route = createFileRoute("/inbox")({
    loader: async () => ({ inbox: await listInbox() }),
    component: Inbox,
});

const KIND_LABEL: Record<InboxItem["kind"], string> = {
    approval: "Approve",
    blocked: "Unblock",
    decision: "Decision",
};

// Needs-you inbox — approvals, blocked companies & decisions waiting on you.
// Card language from design/v2-prototypes/08-chat-spine-pro-v7.html (.ny-card).
function Inbox() {
    const { inbox } = Route.useLoaderData();
    return (
        <AppShell active="inbox">
            <div className="mx-auto w-full max-w-[720px] px-6 py-9">
                <header className="mb-6">
                    <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint">
                        {"// Inbox"}
                    </div>
                    <h1 className="mt-1.5 font-display text-3xl font-light tracking-tight">
                        Needs you
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Approvals, blocked companies & decisions waiting on you.
                    </p>
                </header>

                {inbox.length > 0 ? (
                    <>
                        <div className="mb-3">
                            <SecHead label="Now" count={inbox.length} />
                        </div>
                        <div className="flex flex-col gap-3">
                            {inbox.map((item) => (
                                <NyCard key={item.id} item={item} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-3 rounded-lg border border-success bg-success-soft px-4 py-3.5">
                        <span className="grid size-6 flex-none place-items-center rounded-full bg-success text-white">
                            <Check className="size-3.5" strokeWidth={3} />
                        </span>
                        <div>
                            <b className="block text-[13px]">All clear</b>
                            <span className="text-xs text-muted-foreground">
                                Nothing needs you right now.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

function NyCard({ item }: { item: InboxItem }) {
    const t = TONE[item.tone];
    return (
        <div className={`rounded-lg border border-l-[3px] bg-card p-3.5 shadow-e1 ${t.borderL}`}>
            <div className="mb-1.5 flex items-center gap-2">
                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] ${t.soft} ${t.text}`}
                >
                    {KIND_LABEL[item.kind]}
                </span>
                <span className="ml-auto font-mono text-[10px] text-faint">
                    {item.companyName}
                    {item.sliceN ? ` · slice ${item.sliceN}` : ""}
                </span>
            </div>
            <div className="text-[13.5px] font-semibold leading-[1.35]">{item.title}</div>
            <div className="mt-1 text-xs leading-[1.45] text-muted-foreground">{item.sub}</div>

            <div className="mt-[11px] flex flex-wrap items-center gap-[7px]">
                {item.kind === "approval" ? (
                    <>
                        <button
                            type="button"
                            className="rounded-[9px] border border-success bg-success px-[13px] py-[7px] text-xs font-semibold text-white active:scale-[0.97]"
                        >
                            Approve &amp; ship
                        </button>
                        <Link
                            to="/companies/$slug"
                            params={{ slug: item.companySlug }}
                            className="rounded-[9px] border bg-card px-[13px] py-[7px] text-xs font-semibold"
                        >
                            Review
                        </Link>
                    </>
                ) : item.kind === "blocked" ? (
                    <>
                        <button
                            type="button"
                            className="rounded-[9px] border bg-secondary px-[13px] py-[7px] text-xs font-semibold"
                        >
                            Retry differently
                        </button>
                        <button
                            type="button"
                            className="rounded-[9px] border bg-card px-[13px] py-[7px] text-xs font-semibold"
                        >
                            Pause {item.companyName}
                        </button>
                    </>
                ) : (
                    <Link
                        to="/companies/$slug"
                        params={{ slug: item.companySlug }}
                        className="rounded-[9px] border border-foreground bg-foreground px-[13px] py-[7px] text-xs font-semibold text-background"
                    >
                        Review
                    </Link>
                )}
                {item.liveUrl && (
                    <a
                        href={item.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto inline-flex items-center gap-1.5 font-mono text-[11px] text-faint hover:text-primary"
                    >
                        <ExternalIcon className="size-3.5" />
                        {item.liveUrl.replace(/^https?:\/\//, "")}
                    </a>
                )}
            </div>
        </div>
    );
}
