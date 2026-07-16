import { Link, useLocation, useNavigate, useParams } from "@tanstack/react-router";
import {
    ChevronLeft,
    CreditCard,
    FlaskConical,
    Home,
    Inbox,
    LayoutGrid,
    Lock,
    type LucideIcon,
    MoreHorizontal,
    Plus,
    SlidersHorizontal,
    Trash2,
    Wrench,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { AgentConsole } from "~/components/agent-console";
import { CompanyLogo } from "~/components/company-logo";
import { Logo, LogoMark } from "~/components/logo";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { UserMenu } from "~/components/user-menu";
import { cn } from "~/lib/utils";
import { deleteCompany } from "~/server/actions";
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

type NavKey = "home" | "inbox" | "guardrails" | "companies" | "chats" | "admin" | "settings";
const NAV: { key: NavKey; label: string; icon: LucideIcon; to?: string }[] = [
    { key: "home", label: "Home", icon: Home, to: "/" },
    { key: "inbox", label: "Inbox", icon: Inbox, to: "/inbox" },
    { key: "guardrails", label: "Guardrails", icon: SlidersHorizontal, to: "/guardrails" },
    { key: "companies", label: "Portfolio", icon: LayoutGrid, to: "/companies" },
    { key: "admin", label: "Admin", icon: Wrench, to: "/admin/queue" },
];

function Rail({
    active,
    collapsed,
    onToggle,
}: { active?: NavKey; collapsed: boolean; onToggle: () => void }) {
    // Highlight "New company" while on its route (it isn't in the NAV list, so drive it off the URL).
    const onNewCompany = useLocation({ select: (l) => l.pathname === "/companies/new" });
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

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">
                <NavItem
                    icon={Plus}
                    label="New company"
                    to="/companies/new"
                    active={onNewCompany}
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

                <SectionLabel collapsed={collapsed}>Companies</SectionLabel>
                <CompaniesNav collapsed={collapsed} />
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
function CompaniesNav({ collapsed }: { collapsed?: boolean }) {
    const [companies, setCompanies] = useState<CompanySummary[] | null>(null);
    // The company queued for deletion (opens the confirm dialog) + an in-flight flag.
    const [pendingDelete, setPendingDelete] = useState<CompanySummary | null>(null);
    const [deleting, setDeleting] = useState(false);
    const navigate = useNavigate();
    // Which company page we're on (highlights that row). strict:false → undefined off the route.
    const params = useParams({ strict: false }) as { slug?: string };

    const confirmDelete = async () => {
        const target = pendingDelete;
        if (!target || deleting) return;
        setDeleting(true);
        try {
            await deleteCompany({ data: { companyId: target.id } });
            setCompanies((prev) => prev?.filter((x) => x.id !== target.id) ?? null);
            setPendingDelete(null);
            // If we're viewing the deleted company, bounce back to the portfolio.
            if (params.slug === target.slug || params.slug === target.id) {
                await navigate({ to: "/companies" });
            }
        } finally {
            setDeleting(false);
        }
    };

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
        // Collapsed rail: the "New company" nav item at the top already covers the empty case.
        if (collapsed) return null;
        return (
            <div className="mx-1 mt-1.5 mb-0.5 rounded-md border-2 border-dashed bg-secondary px-3.5 py-4 text-center">
                <div className="text-xs font-[650] text-foreground">No companies yet</div>
                <p className="m-2 text-xs leading-[1.45] text-faint">
                    You bring the ideas - I build, launch and run them.
                </p>
                <Link
                    to="/companies/new"
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-transparent px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:bg-accent hover:text-accent-foreground"
                >
                    <Plus className="size-3.5" /> Start your first company
                </Link>
            </div>
        );
    }

    return (
        <div className={cn(collapsed && "flex flex-col items-center gap-1")}>
            {companies.map((c) => {
                // Highlight the open company — the URL param may be the name slug (active) or the
                // immutable id (drafts / id links), so match either.
                const sel = params.slug === c.slug || params.slug === c.id;
                const draft = c.status === "draft";
                const meta = draft
                    ? "Draft"
                    : (c.mrr ? `$${c.mrr}/mo · ` : "") + SLICE_LBL[c.slice?.state ?? "todo"];
                const avatar = draft ? (
                    // Draft: an incubating icon on a muted fill (no logo generated yet).
                    <span
                        className="grid size-8 flex-none place-items-center rounded-lg bg-primary/15 text-primary"
                        aria-label="Draft (incubating)"
                    >
                        <FlaskConical className="size-4" />
                    </span>
                ) : (
                    // Live: the generated company logo + a status dot.
                    <span className="relative flex-none">
                        <CompanyLogo name={c.name} branding={c.branding} size={32} />
                        <span
                            className={cn(
                                "absolute -bottom-0.5 -right-0.5 size-2 rounded-full shadow-[0_0_0_2px_var(--secondary)]",
                                STATUS_DOT[c.status],
                            )}
                        />
                    </span>
                );

                // Collapsed rail: just the logo, with a native tooltip carrying the name + meta.
                if (collapsed) {
                    return (
                        <Link
                            key={c.id}
                            to="/companies/$slug"
                            params={{ slug: draft ? c.id : c.slug }}
                            title={`${c.name}${meta ? ` · ${meta}` : ""}${c.needsYou ? " · needs you" : ""}`}
                            className={cn(
                                "grid place-items-center rounded-md p-1 hover:bg-primary/[0.1]",
                                sel && "bg-card",
                            )}
                        >
                            {avatar}
                        </Link>
                    );
                }

                return (
                    // Hover bg lives on the wrapper so hovering the ⋯ menu (a sibling overlapping
                    // the Link) lights the whole row too.
                    <div key={c.id} className="group relative rounded-md hover:bg-primary/[0.1]">
                        <Link
                            to="/companies/$slug"
                            // Active → the pretty name slug (the default); drafts → id (their name
                            // is still volatile until graduation, so the slug would churn).
                            params={{ slug: draft ? c.id : c.slug }}
                            className={cn(
                                "relative flex items-center gap-3 rounded-md py-2 pl-2.5 pr-8",
                                // selected: paper fill + a terracotta bar hugging the rail edge
                                sel &&
                                    "bg-card before:absolute before:-left-3 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-xs before:bg-primary before:content-['']",
                            )}
                        >
                            {avatar}
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5 text-sm font-semibold">
                                    <span className="truncate">{c.name}</span>
                                    {c.needsYou && (
                                        <span className="flex-none rounded-full bg-approval px-1.5 py-px text-[9.5px] font-bold tracking-[0.03em] text-white">
                                            INBOX
                                        </span>
                                    )}
                                </span>
                                <span className="block truncate text-[11.5px] text-faint">
                                    {meta}
                                </span>
                            </span>
                        </Link>
                        {/* hover ⋯ menu (sits above the Link so it doesn't navigate) */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`${c.name} actions`}
                                    className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-faint opacity-0 transition hover:bg-neutral/30 hover:text-foreground group-hover:opacity-100 data-[state=open]:bg-primary/20 data-[state=open]:opacity-100"
                                >
                                    <MoreHorizontal className="size-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                    onSelect={() => setPendingDelete(c)}
                                    className="gap-2 text-destructive focus:bg-destructive-soft focus:text-destructive"
                                >
                                    <Trash2 className="size-4" /> Delete{" "}
                                    {draft ? "draft" : "company"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            })}

            {/* delete confirmation (shared across rows) */}
            <Dialog
                open={!!pendingDelete}
                onOpenChange={(o) => !deleting && !o && setPendingDelete(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
                        <DialogDescription>
                            Permanently removes{" "}
                            <b className="text-foreground">{pendingDelete?.name}</b> and everything
                            it owns — chat, tasks, runs. This can't be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => setPendingDelete(null)}
                            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={deleting}
                            onClick={() => void confirmDelete()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50 dark:bg-destructive/60 dark:hover:bg-destructive/70"
                        >
                            <Trash2 className="size-4" />
                            {deleting ? "Deleting…" : "Delete forever"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
        "group flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm font-semibold transition",
        active && "bg-card text-foreground",
        !locked && "text-muted-foreground hover:bg-primary/[0.1] hover:text-foreground",
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
        <div className="px-2 py-4 text-[11px] font-bold uppercase tracking-wide text-faint/70">
            {children}
        </div>
    );
}
