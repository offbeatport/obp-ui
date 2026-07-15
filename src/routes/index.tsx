import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "~/components/app-shell";
import { CompanyCard } from "~/components/command-center/company-card";
import { TONE } from "~/components/command-center/tone";
import { CompanyLogo } from "~/components/company-logo";
import { getBootState } from "~/server/agents";
import type { CompanySummary, InboxItem } from "~/server/data";
import { listActivity, listCompanies, listInbox } from "~/server/data";
// The .cc / .home-simple stylesheet this port relies on. parts.tsx (its only other importer)
// isn't in the homepage's module graph, so load it here or the page renders unstyled.
import "~/components/command-center/proto.css";

export const Route = createFileRoute("/")({
    // Self-host first-run gate → onboarding (until an agent is picked).
    beforeLoad: async () => {
        const boot = await getBootState();
        if (boot.deployment === "self-host" && !boot.onboarded) {
            throw redirect({ to: "/onboarding" });
        }
    },
    loader: async () => {
        const [companies, activity, inbox] = await Promise.all([
            listCompanies(),
            listActivity(),
            listInbox(),
        ]);
        return { companies, activity, inbox };
    },
    component: Home,
});

// Home - the live prototype's renderHome() / .home-simple:
// greeting · big ask composer · Inbox strip · Your Companies (co-cards) · Up next.
// design/v2-prototypes/08-chat-spine-pro-v7.html.
function Home() {
    const { companies, activity, inbox } = Route.useLoaderData();
    const greeting = useGreeting();
    const total = companies.length;
    const showAll = total > 3;
    const shown = showAll ? companies.slice(0, 3) : companies;

    return (
        <AppShell active="home">
            <div className="cc px-5 pb-24">
                <div className="home-simple">
                    {/* greeting + ask */}
                    <div className="home-lead">
                        <div className="home-hero">
                            <h1 className="home-hero-h">{greeting}, Vlad.</h1>
                        </div>
                        <div className="home-ask home-ask-lg">
                            <form className="home-ask-form" onSubmit={(e) => e.preventDefault()}>
                                <textarea
                                    rows={3}
                                    placeholder="Ask anything about your companies, an opportunity, or something new to build..."
                                />
                                <div className="home-ask-bar">
                                    <button type="button" className="askmodel-btn">
                                        <span
                                            className="askmodel-dot"
                                            style={{ background: "var(--primary)" }}
                                        />
                                        Claude Opus
                                    </button>
                                    <span className="home-ask-hint">
                                        <kbd>⏎</kbd> send · <kbd>⇧⏎</kbd> new line
                                    </span>
                                    <button
                                        type="submit"
                                        className="home-ask-send"
                                        aria-label="Send"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 19V5M5 12l7-7 7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Inbox strip */}
                    {inbox.length > 0 && (
                        <div className="needs-bare">
                            <div className="sec-head">
                                <span className="ulab">Inbox</span>
                                <span className="rule" />
                                <span className="count">{inbox.length}</span>
                                <Link to="/inbox" className="pc-link">
                                    Open inbox →
                                </Link>
                            </div>
                            <div className="gateq">
                                {inbox.map((item) => (
                                    <GateRow key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Your Companies */}
                    <div className="home-cos">
                        <div className="sec-head">
                            <span className="ulab">Your Companies</span>
                            <span className="rule" />
                            <span className="count">{total}</span>
                            <Link to="/companies" className="pc-link">
                                Open portfolio →
                            </Link>
                        </div>
                        <div className="co-grid">
                            {shown.map((c) => (
                                <CompanyCard
                                    key={c.id}
                                    c={c}
                                    feed={activity.filter((a) => a.companySlug === c.slug)}
                                />
                            ))}
                        </div>
                        {showAll && (
                            <div className="home-cos-more">
                                <Link to="/companies" className="home-showall">
                                    Show all {total} companies →
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Up next */}
                    <UpNext companies={companies} />
                </div>
            </div>
        </AppShell>
    );
}

// Local-time greeting, computed client-side to avoid an SSR/hydration mismatch.
function useGreeting() {
    const [g, setG] = useState("Welcome");
    useEffect(() => {
        const h = new Date().getHours();
        setG(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    }, []);
    return g;
}

// The home strip is a glanceable shortcut: the row links to the company, where the real
// Approve/Reject controls live (and the /inbox page). Labels read as navigation, not fake
// action buttons.
const GATE: Record<InboxItem["kind"], { label: string; act: string; primary: boolean }> = {
    approval: { label: "SHIP", act: "Review & ship →", primary: true },
    blocked: { label: "UNBLOCK", act: "Review →", primary: false },
    decision: { label: "DECIDE", act: "Review →", primary: false },
};

function GateRow({ item }: { item: InboxItem }) {
    const g = GATE[item.kind];
    const t = TONE[item.tone];
    return (
        <Link
            to="/companies/$slug"
            params={{ slug: item.companySlug || item.companyId }}
            className="gate"
        >
            <CompanyLogo name={item.companyName} branding={item.branding} size={34} radius={10} />
            <div className="gate-main">
                <div className="gate-top">
                    <span className="gate-co2">{item.companyName}</span>
                    <span className={`gate-tp ${t.soft} ${t.text}`}>
                        <span className={`gd ${t.solid}`} />
                        {g.label}
                    </span>
                </div>
                <div className="gate-t">{item.title}</div>
                <div className="gate-d">{item.sub}</div>
            </div>
            <div className="gate-do">
                <span className="gate-review">Review</span>
                <span className={`gate-act ${g.primary ? "primary" : ""}`}>{g.act}</span>
            </div>
        </Link>
    );
}

// Up next - one queued task per company (its current slice), matching upcomingTasksHTML().
function UpNext({ companies }: { companies: CompanySummary[] }) {
    const groups = companies
        // only genuinely-pending slices - a finished (shipped) slice is not "up next"
        .filter((c) => c.slice && c.slice.state !== "shipped")
        .map((c) => ({
            c,
            loop: c.slice?.state === "building" ? "build" : c.mrr > 0 ? "run" : "build",
        }));
    if (!groups.length) return null;

    return (
        <div className="uq-panel uq-v10">
            <div className="uq-head">
                <div className="uq-head-txt">
                    <h2 className="uq-title">Up next</h2>
                    <p className="uq-sub">What each company works on next</p>
                </div>
                <span className="uq-count">
                    <b>{groups.length}</b> queued across <b>{groups.length}</b>{" "}
                    {groups.length === 1 ? "company" : "companies"}
                </span>
            </div>
            <div className="uq-groups">
                {groups.map(({ c, loop }) => {
                    const live = c.status === "active" && (c.mrr > 0 || c.shipped > 0);
                    return (
                        <section key={c.id} className="uq-co">
                            <div className="uq-co-head">
                                <CompanyLogo
                                    name={c.name}
                                    branding={c.branding}
                                    size={30}
                                    radius={9}
                                />
                                <div className="uq-co-id">
                                    <span className="uq-co-name">{c.name}</span>
                                    <span
                                        className={`uq-status ${live ? "is-live" : "is-building"}`}
                                    >
                                        <i />
                                        {live ? "live" : "building"}
                                    </span>
                                </div>
                                <span className="uq-co-count">1 queued</span>
                            </div>
                            <ol className="uq-queue">
                                <li className={`uq-task is-${loop}`}>
                                    <span className="uq-dot" />
                                    <span className="uq-loop">{loop}</span>
                                    <span className="uq-what">{c.slice?.title}</span>
                                    <span className="uq-id">S{c.slice?.n}</span>
                                </li>
                            </ol>
                        </section>
                    );
                })}
            </div>
            <div className="uq-foot">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                </svg>
                <span>Preview only - each company runs its own queue on autopilot</span>
            </div>
        </div>
    );
}
