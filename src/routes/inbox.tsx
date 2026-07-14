import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Check, HelpCircle, type LucideIcon } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { Avatar, toneColor, toneSoft } from "~/components/command-center/shared";
import { type InboxItem, listInbox } from "~/server/data";

// The needs-you inbox — approvals, blocks & decisions, grouped one card per company.
export const Route = createFileRoute("/inbox")({
    loader: async () => ({ inbox: await listInbox() }),
    component: Inbox,
});

const KIND_ICON: Record<InboxItem["kind"], LucideIcon> = {
    approval: Check,
    blocked: AlertTriangle,
    decision: HelpCircle,
};

function Inbox() {
    const { inbox } = Route.useLoaderData();

    // group by company so you clear one before switching
    const groups = new Map<string, InboxItem[]>();
    for (const it of inbox) {
        const arr = groups.get(it.companySlug) ?? [];
        arr.push(it);
        groups.set(it.companySlug, arr);
    }

    return (
        <AppShell active="inbox">
            <div className="mx-auto flex max-w-[720px] flex-col gap-3.5 px-6 py-8">
                <header>
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Inbox"}
                    </div>
                    <h1 className="mt-2 font-display text-3xl font-light tracking-tight">
                        Needs you
                    </h1>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
                        {inbox.length
                            ? `${inbox.length} decision${inbox.length === 1 ? "" : "s"} across ${groups.size} compan${groups.size === 1 ? "y" : "ies"} — clear one company before the next.`
                            : "All clear · nothing needs you right now."}
                    </p>
                </header>

                {inbox.length === 0 ? (
                    <div className="rounded-xl border bg-card py-16 text-center shadow-e1">
                        <div className="text-4xl" style={{ color: toneColor("green") }}>
                            ✓
                        </div>
                        <div className="mt-2.5 text-[15px] text-muted-foreground">
                            You're all caught up. The build loop will surface the next decision
                            here.
                        </div>
                    </div>
                ) : (
                    [...groups.entries()].map(([slug, items], i) => (
                        <Group key={slug} slug={slug} items={items} rank={i + 1} top={i === 0} />
                    ))
                )}
            </div>
        </AppShell>
    );
}

function Group({
    slug,
    items,
    rank,
    top,
}: { slug: string; items: InboxItem[]; rank: number; top: boolean }) {
    const head = items[0];
    return (
        <section
            className={`overflow-hidden rounded-xl border bg-card shadow-e1 ${
                top ? "border-accent shadow-e2" : ""
            }`}
        >
            <header className="flex items-center gap-2.5 border-b border-border-soft bg-secondary/40 px-4 py-3">
                <span
                    className={`w-4 flex-none text-center font-mono text-[12px] font-bold ${
                        top ? "text-primary" : "text-faint"
                    }`}
                >
                    {rank}
                </span>
                <Avatar name={head.companyName} tone={head.tone} className="size-9 text-[15px]" />
                <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold">{head.companyName}</div>
                    <div className="font-mono text-[12px] text-faint">
                        {items.length} item{items.length === 1 ? "" : "s"} waiting
                    </div>
                </div>
                <Link
                    to="/companies/$slug"
                    params={{ slug }}
                    className="flex-none rounded-full border border-border-soft bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold text-muted-foreground transition hover:text-foreground"
                >
                    open →
                </Link>
            </header>
            <div className="flex flex-col">
                {items.map((it) => (
                    <Row key={it.id} item={it} />
                ))}
            </div>
        </section>
    );
}

function Row({ item }: { item: InboxItem }) {
    const Icon = KIND_ICON[item.kind];
    const primary =
        item.kind === "approval"
            ? "Approve & ship"
            : item.kind === "blocked"
              ? "Unblock"
              : "Decide";
    return (
        <div className="flex flex-wrap items-start gap-4 border-t border-border-soft px-4 py-4 first:border-t-0">
            <span
                className="grid size-10 flex-none place-items-center rounded-[11px]"
                style={{ color: toneColor(item.tone), background: toneSoft(item.tone) }}
            >
                <Icon className="size-[19px]" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">
                    {item.companyName}
                    {item.sliceN ? ` · slice ${item.sliceN}` : ""}
                </div>
                <div className="my-1 text-[17px] font-semibold leading-[1.35]">{item.title}</div>
                <div className="text-[14px] leading-relaxed text-muted-foreground">{item.sub}</div>
            </div>
            <div className="flex min-w-[148px] flex-col gap-2 pt-0.5">
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 rounded-[11px] px-3.5 py-2.5 text-[14px] font-semibold text-white shadow-e1 transition hover:-translate-y-px hover:brightness-105"
                    style={{
                        background: toneColor(item.kind === "approval" ? "green" : "violet"),
                    }}
                >
                    {item.kind === "approval" && <Check className="size-3.5" strokeWidth={2.4} />}
                    {primary}
                </button>
                {item.liveUrl ? (
                    <a
                        href={item.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-[11px] border bg-card px-3.5 py-2.5 text-center text-[14px] font-medium text-muted-foreground transition hover:border-faint hover:text-foreground"
                    >
                        Review changes
                    </a>
                ) : (
                    <Link
                        to="/companies/$slug"
                        params={{ slug: item.companySlug }}
                        className="rounded-[11px] border bg-card px-3.5 py-2.5 text-center text-[14px] font-medium text-muted-foreground transition hover:border-faint hover:text-foreground"
                    >
                        Open company
                    </Link>
                )}
            </div>
        </div>
    );
}
