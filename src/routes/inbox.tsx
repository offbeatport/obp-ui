import { Link, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { TONE_SOFT_VAR, TONE_VAR } from "~/components/command-center/tone";
import type { CompanySummary, InboxItem } from "~/server/data";
import { listCompanies, listInbox } from "~/server/data";

export const Route = createFileRoute("/inbox")({
    loader: async () => {
        const [inbox, companies] = await Promise.all([listInbox(), listCompanies()]);
        return { inbox, companies };
    },
    component: Inbox,
});

const GATE: Record<InboxItem["kind"], { tag: string; act: string; approve: boolean }> = {
    approval: { tag: "SHIP", act: "Approve & ship", approve: true },
    blocked: { tag: "UNBLOCK", act: "Unblock", approve: false },
    decision: { tag: "DECISION", act: "Decide", approve: false },
};

// Inbox — the live prototype's renderNeedsYouView() / .needsc:
// everything that needs a decision, grouped into one clean card per company.
// design/v2-prototypes/08-chat-spine-pro-v7.html.
function Inbox() {
    const { inbox, companies } = Route.useLoaderData();
    // group by company, preserving first-seen order
    const order: string[] = [];
    const groups = new Map<string, InboxItem[]>();
    for (const it of inbox) {
        if (!groups.has(it.companySlug)) {
            groups.set(it.companySlug, []);
            order.push(it.companySlug);
        }
        groups.get(it.companySlug)?.push(it);
    }
    const total = inbox.length;

    return (
        <AppShell active="inbox">
            <div className="cc px-6 py-9">
                <div className="needsc">
                    <p className="needsc-lead">
                        Everything that needs a decision, grouped by company — one clean card per
                        company so you can clear it before moving on.
                    </p>

                    {total === 0 ? (
                        <div className="needsc-empty">
                            <div className="ce">✓</div>
                            <div className="ct">
                                You're all caught up. The build loop will surface the next decision
                                here.
                            </div>
                        </div>
                    ) : (
                        order.map((slug) => (
                            <Group
                                key={slug}
                                items={groups.get(slug) ?? []}
                                company={companies.find((c) => c.slug === slug)}
                            />
                        ))
                    )}
                </div>
            </div>
        </AppShell>
    );
}

function Group({ items, company }: { items: InboxItem[]; company?: CompanySummary }) {
    const first = items[0];
    const meta = company
        ? company.mrr > 0
            ? `$${company.mrr}/mo · ${company.users} users`
            : "pre-revenue"
        : "";
    return (
        <section className="nc-card">
            <div className="nc-head">
                <span className="nc-av" style={{ background: TONE_VAR[first.tone] }}>
                    {first.companyName.charAt(0)}
                </span>
                <div className="nc-id">
                    <div className="nc-nm">{first.companyName}</div>
                    <div className="nc-meta">{meta}</div>
                </div>
                <span className="nc-count">
                    {items.length} {items.length === 1 ? "action" : "actions"}
                </span>
            </div>
            {items.map((it) => (
                <Row key={it.id} it={it} />
            ))}
        </section>
    );
}

function Row({ it }: { it: InboxItem }) {
    const g = GATE[it.kind];
    return (
        <div className="nc-act">
            <span className="nc-dot" style={{ background: TONE_VAR[it.tone] }} />
            <div className="nc-bd">
                <div className="nc-t">
                    <span
                        className="nc-tag"
                        style={{ background: TONE_SOFT_VAR[it.tone], color: TONE_VAR[it.tone] }}
                    >
                        {g.tag}
                    </span>
                    {it.title}
                </div>
                <div className="nc-d">{it.sub}</div>
            </div>
            <div className="nc-do">
                {g.approve ? (
                    <>
                        <Link
                            to="/companies/$slug"
                            params={{ slug: it.companySlug }}
                            className="btn-review ghost"
                        >
                            Review
                        </Link>
                        <button type="button" className="btn-approve">
                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path
                                    d="M3 8.5l3 3 7-7.5"
                                    stroke="currentColor"
                                    strokeWidth="1.9"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>{" "}
                            {g.act}
                        </button>
                    </>
                ) : (
                    <Link
                        to="/companies/$slug"
                        params={{ slug: it.companySlug }}
                        className="btn-review"
                    >
                        {g.act}
                    </Link>
                )}
            </div>
        </div>
    );
}
