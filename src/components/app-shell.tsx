import { Link, useParams } from "@tanstack/react-router";
import {
    ChevronLeft,
    CreditCard,
    Diamond,
    FlaskConical,
    Home,
    Inbox,
    LayoutGrid,
    Lock,
    type LucideIcon,
    Plus,
    SlidersHorizontal,
    Wrench,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { AgentConsole } from "~/components/agent-console";
import { TONE } from "~/components/command-center/tone";
import { Logo, LogoMark } from "~/components/logo";
import { UserMenu } from "~/components/user-menu";
import { cn } from "~/lib/utils";
import { type CompanySummary, listCompanies } from "~/server/data";

// The app shell - left rail + main workspace - reproducing
// design/v2-prototypes/08-chat-spine-pro-v7.html. Follow that prototype for all shell work.
export function AppShell({ active, children }: { active?: NavKey; children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    return (
        <>
            {/* grid-rows-1 (minmax(0,1fr)) pins the single row to the viewport so the rail
                and main each scroll internally instead of growing the page past 100vh. */}
            <div
                className="grid grid-rows-1 h-screen overflow-hidden transition-[grid-template-columns] duration-300"
                style={{ gridTemplateColumns: collapsed ? "60px 1fr" : "264px 1fr" }}
            >
                <Rail
                    active={active}
                    collapsed={collapsed}
                    onToggle={() => setCollapsed((c) => !c)}
                />
                <main className="flex min-w-0 flex-col overflow-y-auto bg-background">
                    {children}
                </main>
            </div>
            {/* Global overlay - kept OUT of the grid so its root div can't take a grid cell. */}
            <AgentConsole />
        </>
    );
}

type NavKey =
    | "home"
    | "inbox"
    | "guardrails"
    | "opportunities"
    | "companies"
    | "chats"
    | "admin"
    | "settings";
const NAV: { key: NavKey; label: string; icon: LucideIcon; to?: string }[] = [
    { key: "home", label: "Home", icon: Home, to: "/" },
    { key: "inbox", label: "Inbox", icon: Inbox, to: "/inbox" },
    { key: "guardrails", label: "Guardrails", icon: SlidersHorizontal, to: "/guardrails" },
    { key: "opportunities", label: "Opportunities", icon: Diamond, to: "/opportunities" },
    { key: "companies", label: "Companies", icon: LayoutGrid, to: "/companies" },
    { key: "admin", label: "Admin", icon: Wrench, to: "/admin/queue" },
];

function Rail({
    active,
    collapsed,
    onToggle,
}: { active?: NavKey; collapsed: boolean; onToggle: () => void }) {
    return (
        <aside className="relative flex flex-col border-r bg-secondary">
            {/* collapse toggle straddling the edge */}
            <button
                type="button"
                onClick={onToggle}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="absolute -right-3 top-5 z-10 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-e2 transition-transform hover:bg-primary hover:text-primary-foreground"
            >
                <ChevronLeft
                    className={cn("size-3.5 transition-transform", collapsed && "rotate-180")}
                />
            </button>

            {/* Glow-C wordmark (V7) - links home */}
            <Link
                to="/"
                aria-label="C Slop Slop - home"
                className={cn(
                    "flex items-center px-4 pb-3.5 pt-5",
                    collapsed && "justify-center px-0",
                )}
            >
                {collapsed ? <LogoMark /> : <Logo />}
            </Link>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
                <NavItem
                    icon={Plus}
                    label="New company"
                    to="/companies/new"
                    collapsed={collapsed}
                    tint
                />

                <SectionLabel collapsed={collapsed}>Overview</SectionLabel>
                {NAV.map((n) => (
                    <NavItem
                        key={n.key}
                        icon={n.icon}
                        label={n.label}
                        to={n.to}
                        active={active === n.key}
                        locked={!n.to}
                        collapsed={collapsed}
                    />
                ))}

                <SectionHead collapsed={collapsed}>Companies</SectionHead>
                {!collapsed && <CompaniesNav />}
            </div>

            {/* foot: credit · user menu */}
            <div className="px-3 py-2">
                {!collapsed && (
                    <div className="mb-1 flex items-center gap-2 px-2.5 py-1.5 border-b hover:border-b-primary transition duration-300">
                        <CreditCard className="size-4 text-primary" />
                        <span className="text-sm text-faint">Credit</span>
                        <span className="ml-auto font-mono text-sm font-bold">$100.00</span>
                    </div>
                )}
                <UserMenu collapsed={collapsed} />
            </div>
        </aside>
    );
}

function initials(name: string): string {
    const caps = name.match(/[A-Z]/g);
    if (caps && caps.length >= 2) return caps.slice(0, 2).join("");
    return name.slice(0, 2).toUpperCase();
}

// company.status → the avatar's status dot color (prototype COLORS map). Draft = idle/neutral.
const STATUS_DOT: Record<CompanySummary["status"], string> = {
    active: "bg-success",
    paused: "bg-warning",
    archived: "bg-neutral",
    draft: "bg-neutral",
};
// slice state → the rail meta label (prototype SLICE.lbl).
const SLICE_LBL: Record<NonNullable<CompanySummary["slice"]>["state"], string> = {
    todo: "todo",
    building: "building",
    awaiting_approval: "needs you",
    shipped: "shipped",
    blocked: "blocked",
};

// Live company list in the rail — the prototype's `.co-item` rows (design/08-chat-spine-pro-v7,
// #coList). Self-fetches + polls (5s + on focus) so a just-spun-up DRAFT company (created by
// /companies/new before it navigates) shows without a manual refresh. Draft companies read as
// "spinning up…" with a spinner (the prototype's .co-item.spinning). Empty → the .co-empty-cta.
function CompaniesNav() {
    const [companies, setCompanies] = useState<CompanySummary[] | null>(null);
    // Which company page we're on (highlights that row). strict:false → undefined off the route.
    const params = useParams({ strict: false }) as { slug?: string };

    useEffect(() => {
        let stopped = false;
        const load = () => {
            listCompanies()
                .then((c) => {
                    if (!stopped) setCompanies(c);
                })
                .catch(() => {
                    /* transient - keep the last list, retry next tick */
                });
        };
        load();
        const timer = setInterval(load, 5000);
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => {
            stopped = true;
            clearInterval(timer);
            window.removeEventListener("focus", onFocus);
        };
    }, []);

    // First load not back yet: render nothing (avoids flashing the empty-state, then the list).
    if (companies === null) return null;

    if (companies.length === 0) {
        return (
            <div className="mx-1 mt-1.5 mb-0.5 rounded-md border-[1.5px] border-dashed bg-secondary px-3.5 py-4 text-center">
                <div className="text-[12.5px] font-[650] text-foreground">No companies yet</div>
                <p className="mt-[3px] text-[11px] leading-[1.45] text-faint">
                    You bring the ideas - I build, launch and run them.
                </p>
                <Link
                    to="/companies/new"
                    className="mt-[11px] inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-transparent px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary hover:bg-accent hover:text-accent-foreground"
                >
                    <Plus className="size-3.5" /> Start your first company
                </Link>
            </div>
        );
    }

    return (
        <div>
            {companies.map((c) => {
                const sel = params.slug === c.id;
                const draft = c.status === "draft";
                const meta = draft
                    ? null // rendered as spinner + "spinning up…" below
                    : (c.mrr ? `$${c.mrr}/mo · ` : "") + SLICE_LBL[c.slice?.state ?? "todo"];
                return (
                    <Link
                        key={c.id}
                        to="/companies/$slug"
                        // Active → the pretty name slug (the default); drafts → id (their name is
                        // still volatile until graduation, so the slug would churn).
                        params={{ slug: draft ? c.id : c.slug }}
                        className={cn(
                            "relative flex items-center gap-[11px] rounded-xl px-2.5 py-[9px] transition-colors hover:bg-primary/[0.07]",
                            draft && "bg-primary/[0.06]",
                            // selected: paper fill + a terracotta bar hugging the rail edge
                            sel &&
                                "bg-card shadow-e1 before:absolute before:-left-3 before:top-[9px] before:bottom-[9px] before:w-[3px] before:rounded-r-[3px] before:bg-primary before:content-['']",
                        )}
                    >
                        <span
                            className={cn(
                                "relative grid size-8 flex-none place-items-center rounded-[10px] text-[13px] font-semibold text-primary-foreground",
                                // Draft: an incubating icon on a muted fill instead of the tone
                                // letter avatar. Live companies keep their tone avatar + status dot.
                                draft ? "bg-neutral text-card" : TONE[c.tone].solid,
                            )}
                            aria-label={draft ? "Draft (incubating)" : undefined}
                        >
                            {draft ? (
                                <FlaskConical className="size-4" />
                            ) : (
                                <>
                                    {initials(c.name)}
                                    <span
                                        className={cn(
                                            "absolute -bottom-0.5 -right-0.5 size-[7px] rounded-full shadow-[0_0_0_2px_var(--secondary)]",
                                            STATUS_DOT[c.status],
                                        )}
                                    />
                                </>
                            )}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13.5px] font-[550]">
                                <span className="truncate">{c.name}</span>
                                {c.needsYou && (
                                    <span className="flex-none rounded-full bg-approval px-1.5 py-px text-[9.5px] font-bold tracking-[0.03em] text-white">
                                        INBOX
                                    </span>
                                )}
                            </span>
                            <span className="block truncate text-[11.5px] text-faint">
                                {draft ? (
                                    <>
                                        <span className="mr-1.5 inline-block size-2.5 animate-spin rounded-full border-2 border-border border-t-primary align-[-1px]" />
                                        spinning up…
                                    </>
                                ) : (
                                    meta
                                )}
                            </span>
                        </span>
                    </Link>
                );
            })}
        </div>
    );
}

function NavItem({
    icon: Icon,
    label,
    to,
    active,
    locked,
    collapsed,
    tint,
    onClick,
}: {
    icon: LucideIcon;
    label: string;
    to?: string;
    active?: boolean;
    locked?: boolean;
    collapsed?: boolean;
    tint?: boolean;
    onClick?: () => void;
}) {
    const inner = (
        <>
            <span
                className={cn(
                    "grid size-8 flex-none place-items-center rounded-md bg-accent text-primary",
                    // New-company: spring-rotate the plus + fill terracotta on hover. The hover
                    // state lives in globals.css (.nav-newco:hover .newco-ic) with a DIRECT transform
                    // so the .22s spring actually interpolates (Tailwind's var-based rotate can't).
                    tint && "newco-ic",
                )}
            >
                <Icon className="size-4" />
            </span>
            {!collapsed && <span className="flex-1 truncate">{label}</span>}
            {!collapsed && locked && <Lock className="size-3.5 flex-none text-faint/60" />}
        </>
    );
    const cls = cn(
        "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-semibold transition",
        active && "bg-card text-foreground shadow-e1",
        !locked && "text-muted-foreground hover:bg-primary/[0.15] hover:text-foreground",
        // locked = disabled: dimmed, no hover, not interactive
        locked && "cursor-default text-muted-foreground opacity-40",
        tint && "nav-newco mb-1.5",
        collapsed && "justify-center px-0",
    );
    if (to) {
        return (
            <Link to={to} className={cls}>
                {inner}
            </Link>
        );
    }
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={locked}
            aria-disabled={locked}
            className={cls}
        >
            {inner}
        </button>
    );
}

function SectionLabel({ collapsed, children }: { collapsed?: boolean; children: ReactNode }) {
    if (collapsed) return <div className="h-3.5" />;
    return (
        <div className="px-2 pb-1.5 pt-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            {children}
        </div>
    );
}

function SectionHead({ collapsed, children }: { collapsed?: boolean; children: ReactNode }) {
    if (collapsed) return <div className="h-3.5" />;
    return (
        <div className="flex items-center justify-between px-2 pb-1 pt-4 pr-1">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-faint">
                {children}
            </span>
            <button
                type="button"
                className="grid size-5 place-items-center rounded-md text-faint transition hover:bg-accent hover:text-accent-foreground"
                aria-label={`Add ${children}`}
            >
                <Plus className="size-4" />
            </button>
        </div>
    );
}
