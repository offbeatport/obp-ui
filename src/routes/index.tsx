import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "~/components/app-shell";
import { CompanyCard } from "~/components/command-center/company-card";
import { TONE } from "~/components/command-center/tone";
import { CompanyLogo } from "~/components/company-logo";
import { cn } from "~/lib/utils";
import { getBootState } from "~/server/agents";
import type { CompanySummary, InboxItem } from "~/server/data";
import { listActivity, listCompanies, listInbox } from "~/server/data";

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
            <div className="px-5 pb-24">
                <div className="mx-auto flex max-w-[1120px] flex-col gap-[clamp(40px,12vh,94px)] pt-[clamp(56px,17vh,190px)]">
                    {/* greeting + ask */}
                    <div className="flex w-full flex-col items-center">
                        <div className="w-full max-w-[720px] text-center">
                            <h1 className="my-[18px] font-display text-[42px] font-light leading-[1.05] tracking-[-0.025em] text-foreground">
                                {greeting}, Vlad.
                            </h1>
                        </div>
                        <div className="mx-auto mt-6 w-full max-w-[720px]">
                            <form
                                className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-3.5 pt-3.5 pb-3 shadow-e1 transition-[border-color,box-shadow] duration-[140ms] focus-within:border-primary focus-within:shadow-[0_0_0_3px_var(--accent),var(--shadow-e1)]"
                                onSubmit={(e) => e.preventDefault()}
                            >
                                <textarea
                                    rows={3}
                                    className="min-h-[66px] max-h-[140px] min-w-0 flex-1 resize-none border-0 bg-transparent p-2.5 font-[inherit] text-[15px] leading-[1.45] text-foreground outline-none placeholder:text-faint"
                                    placeholder="Ask anything about your companies, an opportunity, or something new to build..."
                                />
                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        className="inline-flex cursor-pointer items-center gap-[7px] rounded-full border border-border bg-secondary px-[11px] py-[5px] font-[inherit] text-[12.5px] font-semibold text-muted-foreground hover:border-primary hover:text-foreground"
                                    >
                                        <span
                                            className="size-2 flex-none rounded-full shadow-[0_0_0_2px_var(--card)]"
                                            style={{ background: "var(--primary)" }}
                                        />
                                        Claude Opus
                                    </button>
                                    <span className="ml-auto flex-none whitespace-nowrap font-mono text-[10.5px] tracking-[0.02em] text-faint">
                                        <kbd className="font-[inherit] text-muted-foreground">
                                            ⏎
                                        </kbd>{" "}
                                        send ·{" "}
                                        <kbd className="font-[inherit] text-muted-foreground">
                                            ⇧⏎
                                        </kbd>{" "}
                                        new line
                                    </span>
                                    <button
                                        type="submit"
                                        className="grid size-10 flex-none cursor-pointer place-items-center rounded-full border-0 bg-primary text-white shadow-[0_2px_8px_rgba(0,0,0,0.14)] transition-[transform,filter] duration-[120ms] hover:-translate-y-px hover:brightness-105"
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
                                            className="size-[18px]"
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
                        <div className="mx-auto w-full max-w-[720px]">
                            <div className="mx-auto mb-3 flex w-full max-w-full items-center gap-2.5">
                                <span className="flex-none font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint">
                                    Inbox
                                </span>
                                <span className="h-px flex-1 bg-border-soft" />
                                <span className="font-mono text-[11px] text-faint">
                                    {inbox.length}
                                </span>
                                <Link
                                    to="/inbox"
                                    className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[12px] font-semibold text-accent-foreground hover:underline"
                                >
                                    Open inbox →
                                </Link>
                            </div>
                            <div className="mt-0.5 flex flex-col">
                                {inbox.map((item) => (
                                    <GateRow key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Your Companies */}
                    <div className="mx-auto w-full max-w-[1040px]">
                        <div className="mx-auto my-10 flex w-[888px] max-w-full items-center gap-2.5 p-0">
                            <span className="flex-none font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint">
                                Your Companies
                            </span>
                            <span className="h-px flex-1 bg-border-soft" />
                            <span className="font-mono text-[11px] text-faint">{total}</span>
                            <Link
                                to="/companies"
                                className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-[12px] font-semibold text-accent-foreground hover:underline"
                            >
                                Open portfolio →
                            </Link>
                        </div>
                        <div className="flex flex-wrap justify-center gap-[22px]">
                            {shown.map((c) => (
                                <CompanyCard
                                    key={c.id}
                                    c={c}
                                    feed={activity.filter((a) => a.companySlug === c.slug)}
                                />
                            ))}
                        </div>
                        {showAll && (
                            <div className="mt-6 flex justify-center">
                                <Link
                                    to="/companies"
                                    className="cursor-pointer rounded-full border border-border bg-card px-5 py-2.5 font-mono text-[12px] tracking-[0.02em] text-muted-foreground shadow-e1 transition-[border-color,color,transform] duration-[140ms] hover:-translate-y-px hover:border-faint hover:text-foreground"
                                >
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
            className="group flex cursor-pointer items-center gap-[13px] rounded-sm px-3 py-[11px] text-inherit no-underline transition-[background] duration-[120ms] [&:not(:first-child)]:shadow-[inset_0_1px_0_var(--border-soft)] hover:bg-secondary"
        >
            <CompanyLogo name={item.companyName} branding={item.branding} size={34} radius={10} />
            <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-[650] text-foreground">
                        {item.companyName}
                    </span>
                    <span
                        className={cn(
                            "inline-flex flex-none items-center gap-[5px] self-start rounded-[6px] px-[7px] py-0.5 font-mono text-[9.5px] font-bold tracking-[0.07em]",
                            t.soft,
                            t.text,
                        )}
                    >
                        <span className={cn("size-[5px] rounded-full", t.solid)} />
                        {g.label}
                    </span>
                </div>
                <div className="text-[13.5px] font-semibold leading-[1.3] text-foreground">
                    {item.title}
                </div>
                <div className="mt-0.5 text-[11.5px] leading-[1.35] text-faint">{item.sub}</div>
            </div>
            <div className="flex flex-none items-center gap-[7px]">
                <span className="cursor-pointer whitespace-nowrap rounded-[10px] border border-border bg-transparent px-3 py-[7px] text-[12px] font-semibold text-faint transition-all duration-[120ms] group-hover:text-muted-foreground hover:border-accent hover:bg-card hover:text-accent-foreground">
                    Review
                </span>
                <span
                    className={cn(
                        "flex-none cursor-pointer whitespace-nowrap rounded-[10px] border px-[13px] py-[7px] text-[12px] font-semibold transition-all duration-[120ms] group-hover:border-accent group-hover:text-accent-foreground",
                        g.primary
                            ? "border-success bg-success text-white group-hover:brightness-105"
                            : "border-border bg-card text-muted-foreground",
                    )}
                >
                    {g.act}
                </span>
            </div>
        </Link>
    );
}

// Up-next loop → dot/loop-label tone (was .uq-task.is-* --tone/--tone-soft; the single queued
// item is always :first-child, so its dot always gets the tone-soft ring).
const UP_TONE: Record<"build" | "run", { dot: string; loop: string }> = {
    build: { dot: "bg-info shadow-[0_0_0_3px_var(--info-soft)]", loop: "text-info" },
    run: { dot: "bg-success shadow-[0_0_0_3px_var(--success-soft)]", loop: "text-success" },
};

// Up next - one queued task per company (its current slice), matching upcomingTasksHTML().
function UpNext({ companies }: { companies: CompanySummary[] }) {
    const groups = companies
        // only genuinely-pending slices - a finished (shipped) slice is not "up next"
        .filter((c) => c.slice && c.slice.state !== "shipped")
        .map((c) => ({
            c,
            loop: (c.slice?.state === "building" ? "build" : c.mrr > 0 ? "run" : "build") as
                | "build"
                | "run",
        }));
    if (!groups.length) return null;

    return (
        <div className="mx-auto w-full max-w-[1040px] px-8 pt-[30px] pb-6 font-sans text-foreground">
            <div className="mb-[22px] flex items-end justify-between gap-4 border-b border-border-soft pb-[18px]">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="m-0 font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.015em] text-foreground">
                        Up next
                    </h2>
                    <p className="m-0 text-[13px] leading-[1.4] text-faint">
                        What each company works on next
                    </p>
                </div>
                <span className="flex-none whitespace-nowrap pb-0.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.03em] text-faint">
                    <b className="font-semibold text-muted-foreground">{groups.length}</b> queued
                    across <b className="font-semibold text-muted-foreground">{groups.length}</b>{" "}
                    {groups.length === 1 ? "company" : "companies"}
                </span>
            </div>
            <div className="flex flex-col gap-6">
                {groups.map(({ c, loop }) => {
                    const live = c.status === "active" && (c.mrr > 0 || c.shipped > 0);
                    return (
                        <section
                            key={c.id}
                            className="relative pl-5 before:absolute before:top-1 before:bottom-[5px] before:left-0 before:w-0.5 before:rounded-[2px] before:bg-border before:content-['']"
                        >
                            <div className="flex items-center gap-3">
                                <CompanyLogo
                                    name={c.name}
                                    branding={c.branding}
                                    size={30}
                                    radius={9}
                                />
                                <div className="flex flex-auto flex-wrap items-baseline gap-2.5 min-w-0">
                                    <span className="whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                                        {c.name}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] tracking-[0.02em] text-faint">
                                        <i
                                            className={cn(
                                                "size-1.5 flex-none rounded-full",
                                                live ? "bg-success" : "bg-warning",
                                            )}
                                        />
                                        {live ? "live" : "building"}
                                    </span>
                                </div>
                                <span className="flex-none font-mono text-[10px] uppercase tracking-[0.05em] text-faint">
                                    1 queued
                                </span>
                            </div>
                            <ol className="mt-1.5 mb-0 list-none pl-1">
                                <li className="group grid grid-cols-[14px_46px_1fr_auto] items-center gap-x-2.5 rounded-[9px] pt-[7px] pr-3 pb-[7px] pl-2.5 transition-[background] duration-150 hover:bg-secondary">
                                    <span
                                        className={cn(
                                            "size-[7px] justify-self-center rounded-full transition-[box-shadow] duration-150",
                                            UP_TONE[loop].dot,
                                        )}
                                    />
                                    <span
                                        className={cn(
                                            "whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.09em]",
                                            UP_TONE[loop].loop,
                                        )}
                                    >
                                        {loop}
                                    </span>
                                    <span className="truncate text-[13.5px] leading-[1.35] text-muted-foreground transition-[color] duration-150 group-hover:text-foreground">
                                        {c.slice?.title}
                                    </span>
                                    <span className="justify-self-end whitespace-nowrap rounded-[5px] border border-border-soft bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.04em] text-faint">
                                        S{c.slice?.n}
                                    </span>
                                </li>
                            </ol>
                        </section>
                    );
                })}
            </div>
            <div className="mt-[22px] flex items-center gap-2 border-t border-border-soft pt-4 font-mono text-[10px] tracking-[0.05em] text-faint">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="size-3 flex-none opacity-70"
                >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                </svg>
                <span>Preview only - each company runs its own queue on autopilot</span>
            </div>
        </div>
    );
}
