import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronUp,
  CreditCard,
  Diamond,
  Home,
  Inbox,
  LayoutGrid,
  Lock,
  type LucideIcon,
  MessageCircle,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Logo, LogoMark } from "~/components/logo";
import { ThemeToggle } from "~/components/theme-toggle";
import { cn } from "~/lib/utils";

// The app shell — left rail + main workspace — reproducing
// design/v2-prototypes/08-chat-spine-pro-v7.html. Follow that prototype for all shell work.
export function AppShell({ active, children }: { active?: NavKey; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div
      className="grid h-screen overflow-hidden transition-[grid-template-columns] duration-300"
      style={{ gridTemplateColumns: collapsed ? "60px 1fr" : "264px 1fr" }}
    >
      <Rail active={active} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex min-w-0 flex-col overflow-y-auto bg-background">
        <div className="flex-1">{children}</div>
        <footer className="flex items-center justify-between gap-4 border-t px-6 py-3 text-xs text-muted-foreground">
          <span>
            <span className="text-primary">{"{"}</span> C Slop Slop{" "}
            <span className="text-primary">{"}"}</span> — from a thought to bag.
          </span>
          <ThemeToggle />
        </footer>
      </main>
    </div>
  );
}

type NavKey = "home" | "inbox" | "guardrails" | "opportunities" | "portfolio";
const NAV: { key: NavKey; label: string; icon: LucideIcon; to?: string }[] = [
  { key: "home", label: "Home", icon: Home, to: "/" },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "guardrails", label: "Guardrails", icon: SlidersHorizontal },
  { key: "opportunities", label: "Opportunities", icon: Diamond },
  { key: "portfolio", label: "Portfolio", icon: LayoutGrid, to: "/queue" },
];

function Rail({
  active,
  collapsed,
  onToggle,
}: {
  active?: NavKey;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="relative flex flex-col border-r bg-secondary">
      {/* collapse toggle straddling the edge */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-5 z-10 grid size-6 place-items-center rounded-full border bg-card text-foreground shadow-e2 transition-transform hover:bg-primary hover:text-primary-foreground"
      >
        <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
      </button>

      {/* Glow-C wordmark (V7) */}
      <div className={cn("flex items-center px-4 pb-3.5 pt-5", collapsed && "justify-center px-0")}>
        {collapsed ? <LogoMark /> : <Logo />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <NavItem icon={Plus} label="New company" collapsed={collapsed} tint onClick={() => {}} />

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
        {!collapsed && (
          <div className="mx-1 mt-1 rounded-xl border border-dashed p-4 text-center">
            <div className="text-[13px] font-semibold">No companies yet</div>
            <p className="mx-auto mt-1 max-w-[15rem] text-[12px] leading-relaxed text-faint">
              You bring the ideas — I build, launch and run them.
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-accent-foreground transition hover:brightness-105"
            >
              <Plus className="size-3.5" /> Start your first company
            </button>
          </div>
        )}

        <SectionHead collapsed={collapsed}>Chats</SectionHead>
        {!collapsed &&
          CHATS.map((c) => (
            <button
              type="button"
              key={c.title}
              className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-primary/[0.06]"
            >
              <MessageCircle className="mt-0.5 size-4 flex-none text-faint" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{c.title}</span>
                <span className="block text-[11px] text-faint">{c.ago}</span>
              </span>
            </button>
          ))}
      </div>

      {/* foot: credit · user · theme */}
      <div className="border-t px-3 py-2">
        {!collapsed && (
          <div className="mb-1 flex items-center gap-2 px-2.5 py-1.5">
            <CreditCard className="size-4 text-primary" />
            <span className="text-[11.5px] text-faint">Credit</span>
            <span className="ml-auto font-mono text-[12.5px] font-bold">$100.00</span>
          </div>
        )}
        <div
          className={cn("flex items-center gap-2.5 rounded-xl p-2", collapsed && "justify-center")}
        >
          <div className="grid size-8 flex-none place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
            V
          </div>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">Vlad</span>
                <span className="block truncate text-[11px] text-faint">$0 MRR · 0 users</span>
              </span>
              <ChevronUp className="size-4 flex-none text-faint" />
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

const CHATS = [
  { title: "How is my portfolio doing?", ago: "3d ago" },
  { title: "Ideas for a solo-founder SaaS", ago: "yesterday" },
  { title: "Which company should I double down on?", ago: "2h ago" },
];

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
          "grid size-8 flex-none place-items-center rounded-[10px]",
          tint || active
            ? "bg-accent text-accent-foreground"
            : "bg-accent/60 text-accent-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && locked && <Lock className="size-3.5 flex-none text-faint/60" />}
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-medium transition",
    active
      ? "bg-card text-foreground shadow-e1"
      : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground",
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
    <button type="button" onClick={onClick} className={cls}>
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
