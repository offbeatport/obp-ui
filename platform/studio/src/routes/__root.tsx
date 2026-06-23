/// <reference types="vite/client" />
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  Link,
  useRouterState,
  useRouter,
} from "@tanstack/react-router";
import {
  useState, useEffect, useRef, useCallback,
  type ReactNode, type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import globalsCss from "../styles/globals.css?url";
import type { BuildEntry } from "../../vite.config";
import type { ProjectWithCounts } from "../lib/project-fns.js";
import {
  LayoutDashboard, Search, Terminal, FolderKanban, TrendingUp,
  Settings, Plus, ChevronLeft, Home, ChevronsUpDown, MoreHorizontal, Activity, Zap, Inbox, Compass, DollarSign, Globe, Layers, Lightbulb, Radar, Target,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { ConfirmProvider, useConfirm } from "~/components/ui/Confirm";
import { ProjectConfigModal } from "~/components/ui/ProjectConfigModal";
import { CHANNEL_LABELS } from "~/lib/channels";

// ── Constants ─────────────────────────────────────────────────────────────────

const COLLAPSED_W = 52;
const DEFAULT_W = 220;
const MIN_W = 160;
const MAX_W = 360;

// ── Active channel jobs counter ───────────────────────────────────────────────

export interface ActiveJob {
  id: string;
  kind: "channel" | "build";
  label: string;        // e.g. "Reddit" or build title
  projectName?: string;
  projectId?: number;
  status: "running" | "queued";
  queuePosition?: number;
  link: string;
}

function useActiveChannelJobs() {
  const [count, setCount] = useState(0);
  const [byProject, setByProject] = useState<Map<number, number>>(new Map());
  const [jobs, setJobs] = useState<ActiveJob[]>([]);
  const jobsRef = useRef<Map<string, { channelType: string; projectId: number; projectName: string; status: string; queuePosition?: number }>>(new Map());

  useEffect(() => {
    const CL = CHANNEL_LABELS;
    let es: EventSource;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      es = new EventSource("/api/channel-jobs/stream");

      es.onopen = () => {
        // Server (re)connected - reload projects in case they were lost on restart
        window.dispatchEvent(new Event("projects:changed"));
      };

      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(connect, 3_000);
      };

      es.onmessage = onMessage;
    }

    function rebuild() {
      const arr: ActiveJob[] = [];
      const map = new Map<number, number>();
      let total = 0;
      for (const [id, j] of jobsRef.current) {
        if (j.status !== "running" && j.status !== "queued") continue;
        arr.push({
          id, kind: "channel",
          label: (CL as Record<string, string>)[j.channelType] ?? j.channelType,
          projectName: j.projectName,
          projectId: j.projectId,
          status: j.status as "running" | "queued",
          queuePosition: j.queuePosition,
          link: `/i/${j.projectId}/channels`,
        });
        if (j.status === "running") {
          total++;
          map.set(j.projectId, (map.get(j.projectId) ?? 0) + 1);
        }
      }
      setJobs(arr);
      setCount(total);
      setByProject(map);
    }

    function onMessage(e: MessageEvent) {
      try {
        const event = JSON.parse(e.data);
        if (event.type === "snapshot") {
          jobsRef.current.clear();
          for (const j of event.jobs) {
            if (j.status === "running" || j.status === "queued") {
              jobsRef.current.set(j.id, { channelType: j.channelType, projectId: j.projectId, projectName: j.projectName, status: j.status, queuePosition: j.queuePosition });
            }
          }
          rebuild();
        } else if (event.type === "created") {
          const j = event.job;
          jobsRef.current.set(j.id, { channelType: j.channelType, projectId: j.projectId, projectName: j.projectName, status: j.status, queuePosition: j.queuePosition });
          rebuild();
        } else if (event.type === "queued") {
          const j = jobsRef.current.get(event.jobId);
          if (j) { j.queuePosition = event.position; rebuild(); }
        } else if (event.type === "started") {
          const j = jobsRef.current.get(event.jobId);
          if (j) { j.status = "running"; j.queuePosition = undefined; rebuild(); }
        } else if (event.type === "ended") {
          jobsRef.current.delete(event.jobId);
          rebuild();
        }
      } catch { }
    }

    connect();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  return { count, byProject, jobs };
}

// ── Unified builds state (single SSE connection) ─────────────────────────────

function useBuildsState() {
  const [count, setCount] = useState(0);
  const [buildJobs, setBuildJobs] = useState<ActiveJob[]>([]);
  const [activeProjectIds, setActiveProjectIds] = useState<Set<number>>(new Set());
  const buildsRef = useRef<Map<string, BuildEntry>>(new Map());

  useEffect(() => {
    // Snapshot first
    fetch("/api/builds-list")
      .then(r => r.json())
      .then((list: BuildEntry[]) => {
        for (const b of list) buildsRef.current.set(b.id, b);
        recompute();
      }).catch(() => { });

    function recompute() {
      const all = [...buildsRef.current.values()];
      const active = all.filter(b => b.status === "running" || b.status === "dev:starting");
      setCount(active.length);
      setBuildJobs(active.map(b => ({ id: b.id, kind: "build" as const, label: b.title, status: "running" as const, link: "/builds" })));
      setActiveProjectIds(new Set(active.map(b => b.projectId).filter((id): id is number => id != null)));
    }

    function connect() {
      const es = new EventSource("/api/builds-stream");
      es.onmessage = (e) => {
        try {
          const { build } = JSON.parse(e.data) as { build: BuildEntry };
          if (!build) return;
          buildsRef.current.set(build.id, build);
          recompute();
        } catch { }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 4000); };
      return es;
    }
    const es = connect();
    return () => es.close();
  }, []);

  return { count, buildJobs, activeProjectIds };
}

// ── Sidebar nav primitives ────────────────────────────────────────────────────

function SidebarSection({ label, collapsed, action }: {
  label: string;
  collapsed: boolean;
  action?: ReactNode;
}) {
  if (collapsed) return <div style={{ height: 1, background: "var(--border)", margin: "8px 10px" }} />;
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "16px 12px 4px",
    }}>
      <span className="text-[0.62rem] font-bold tracking-widest uppercase" style={{ color: "var(--fg-subtle)", flex: 1 }}>
        {label}
      </span>
      {action}
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  badge,
  exact,
  collapsed,
}: {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  exact?: boolean;
  collapsed: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact
    ? pathname === to
    : to === "/" ? pathname === "/" : pathname.startsWith(to);

  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 9,
    padding: collapsed ? "0" : "0 10px",
    height: 34,
    width: "100%",
    justifyContent: collapsed ? "center" : "flex-start",
    borderRadius: "var(--radius)",
    background: active ? "rgba(96,165,250,0.1)" : undefined,
    color: active ? "var(--accent)" : "var(--fg-muted)",
    textDecoration: "none",
    cursor: "pointer",
    position: "relative",
  };

  const content = (
    <>
      <Icon size={15} strokeWidth={active ? 2 : 1.5} style={{ flexShrink: 0 }} />
      {!collapsed && (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {label}
        </span>
      )}
      {!collapsed && badge != null && badge > 0 && (
        <span className="text-[0.58rem] font-bold tracking-widest uppercase" style={{
          minWidth: 16, height: 16, padding: "0 4px",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: "#f59e0b", color: "#050d1e",
          borderRadius: 8,
          animation: "pulse 1.5s ease-in-out infinite",
        }}>
          {badge}
        </span>
      )}
    </>
  );

  return (
    <div style={{ padding: collapsed ? "2px 6px" : "2px 8px" }}>
      <Link
        to={to}
        className={`nav-item text-sm${active ? " font-semibold" : " font-normal"}`}
        style={style}>
        {content}
      </Link>
    </div>
  );
}

function ProjectItem({ id, name, handle, status, collapsed, runningChannels = 0, hypothesis, isBuilding = false, isLive = false }: {
  id: number;
  name: string;
  handle: string | null;
  status: string;
  collapsed: boolean;
  runningChannels?: number;
  hypothesis?: string | null;
  isBuilding?: boolean;
  isLive?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const active = pathname === `/i/${id}` || pathname.startsWith(`/i/${id}/`);
  const initial = name.charAt(0).toUpperCase();

  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(name);
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
      setRenaming(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming) setTimeout(() => renameRef.current?.focus(), 30);
  }, [renaming]);

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left });
    setRenaming(false);
    setRenameVal(name);
    setMenuOpen((v) => !v);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameVal.trim() || busy) return;
    setBusy(true);
    try {
      const { updateProject } = await import("../lib/project-fns.js");
      await updateProject({ data: { id, name: renameVal.trim() } });
      window.dispatchEvent(new Event("projects:changed"));
      setMenuOpen(false);
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusToggle() {
    setMenuOpen(false);
    const next = status === "active" ? "paused" : "active";
    const { updateProject } = await import("../lib/project-fns.js");
    await updateProject({ data: { id, status: next } });
    window.dispatchEvent(new Event("projects:changed"));
  }

  async function handleDelete() {
    setMenuOpen(false);
    const ok = await confirm(`Delete "${name}"? This cannot be undone.`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    const { deleteProject } = await import("../lib/project-fns.js");
    await deleteProject({ data: { id } });
    window.dispatchEvent(new Event("projects:changed"));
    if (active) router.navigate({ to: "/" });
  }

  const menu = menuOpen && menuPos ? createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        minWidth: 190,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 9999,
        padding: "4px 0",
        overflow: "hidden",
      }}
    >
      {renaming ? (
        <form onSubmit={handleRename} style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            ref={renameRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setRenaming(false); } }}
            className="text-xs"
            style={{
              height: 28, padding: "0 8px",
              background: "rgba(165,182,214,0.06)",
              border: "1px solid var(--border-strong)", borderRadius: "var(--radius)",
              color: "var(--fg)", outline: "none", width: "100%", boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(165,182,214,0.3)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={busy || !renameVal.trim()}
              className="text-xs"
              style={{ flex: 1, height: 26 }}
            >
              {busy ? "…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenaming(false)}
              className="text-xs"
              style={{ height: 26 }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <SidebarMenuItem onClick={() => { setMenuOpen(false); setConfigOpen(true); }}>Configure project</SidebarMenuItem>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SidebarMenuItem onClick={() => setRenaming(true)}>Rename</SidebarMenuItem>
          <SidebarMenuItem onClick={handleStatusToggle}>
            {status === "active" ? "Mark as paused" : "Mark as active"}
          </SidebarMenuItem>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <SidebarMenuItem onClick={handleDelete} danger>Delete project</SidebarMenuItem>
        </>
      )}
    </div>,
    document.body
  ) : null;

  const linkStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: collapsed ? 0 : 9,
    padding: collapsed ? "0" : "0 10px",
    height: 32,
    width: "100%",
    justifyContent: collapsed ? "center" : "flex-start",
    borderRadius: "var(--radius)",
    background: active ? "rgba(96,165,250,0.1)" : undefined,
    color: active ? "var(--accent)" : "var(--fg-muted)",
    textDecoration: "none",
    fontSize: "0.84rem",
    fontWeight: active ? 500 : 400,
    cursor: "pointer",
    position: "relative",
  };

  return (
    <div
      className="sidebar-item"
      style={{ padding: collapsed ? "2px 6px" : "2px 8px", position: "relative" }}
    >
      <Link to="/i/$id" params={{ id: String(id) }} className="project-nav-item nav-item" style={linkStyle} title={hypothesis || undefined}>
        {collapsed ? (
          <span style={{
            width: 22, height: 22, borderRadius: 4,
            background: active ? "rgba(96,165,250,0.15)" : "rgba(165,182,214,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.70rem", fontWeight: 700,
            color: active ? "var(--accent)" : "var(--fg-subtle)",
            flexShrink: 0,
          }}>
            {initial}
          </span>
        ) : (
          <>
            <span style={{
              width: 6, height: 6, borderRadius: isLive ? "50%" : 2, flexShrink: 0,
              background: active ? "var(--accent)" : isLive ? "var(--success)" : "rgba(165,182,214,0.3)",
            }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {name}
            </span>
            {isBuilding && (
              <span className="sidebar-badge" style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: "#f59e0b",
                boxShadow: "0 0 4px #f59e0b",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
            )}
            {runningChannels > 0 && (
              <span className="pulse sidebar-badge" style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 16, height: 16, borderRadius: 8,
                background: "#fbbf24", color: "#010407",
                fontSize: "0.60rem", fontWeight: 700, lineHeight: 1,
                padding: "0 4px", flexShrink: 0,
              }}>
                {runningChannels}
              </span>
            )}
            {handle && runningChannels === 0 && (
              <span className="sidebar-badge" style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", flexShrink: 0 }}>
                {handle.startsWith("@") ? handle : `@${handle}`}
              </span>
            )}
          </>
        )}
      </Link>

      {/* ... button */}
      {!collapsed && (
        <Button
          ref={btnRef}
          variant="ghost"
          size="sm"
          onClick={openMenu}
          title="More options"
          className={`sidebar-menu-btn${menuOpen ? " sidebar-menu-open" : ""}`}
          style={{
            position: "absolute",
            right: 12, top: "50%", transform: "translateY(-50%)",
            width: 22, height: 22,
            background: menuOpen ? "rgba(165,182,214,0.12)" : "rgba(165,182,214,0.06)",
            color: menuOpen ? "var(--fg)" : "var(--fg-subtle)",
            padding: 0,
            zIndex: 1,
          }}
        >
          <MoreHorizontal size={12} />
        </Button>
      )}

      {menu}

      <ProjectConfigModal
        open={configOpen}
        project={{ id }}
        onClose={() => setConfigOpen(false)}
        onSaved={() => { }}
      />
    </div>
  );
}

function SidebarMenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      style={{
        display: "flex",
        width: "100%",
        justifyContent: "flex-start",
        padding: "7px 14px",
        fontSize: "0.84rem",
        color: danger ? "rgba(239,68,68,0.8)" : "var(--fg-muted)",
        height: "auto",
        borderRadius: 0,
      }}
    >
      {children}
    </Button>
  );
}

// ── Products section ──────────────────────────────────────────────────────────

interface SidebarProduct {
  id: number;
  name: string;
  deployStatus: string | null;
}

function ProductsSection({ collapsed, buildingProjectIds }: { collapsed: boolean; buildingProjectIds: Set<number> }) {
  const [products, setProducts] = useState<SidebarProduct[] | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const load = useCallback(async () => {
    try {
      const { getProductsList } = await import("../lib/project-fns.js");
      const rows = await getProductsList();
      setProducts(rows.map((p) => ({ id: p.id, name: p.name, deployStatus: p.deployStatus })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    window.addEventListener("projects:changed", load);
    return () => window.removeEventListener("projects:changed", load);
  }, [load]);

  if (!products || products.length === 0) return null;

  return (
    <>
      <SidebarSection label="Products" collapsed={collapsed} />
      {products.map((p) => {
        const active = pathname === `/products/${p.id}` || pathname.startsWith(`/products/${p.id}/`);
        const live = p.deployStatus === "deployed";
        return (
          <div key={p.id} style={{ padding: collapsed ? "2px 6px" : "2px 8px" }}>
            <Link
              to="/products/$id"
              params={{ id: String(p.id) }}
              className="nav-item"
              style={{
                display: "flex", alignItems: "center", gap: collapsed ? 0 : 9,
                padding: collapsed ? "0" : "0 10px", height: 32, width: "100%",
                justifyContent: collapsed ? "center" : "flex-start",
                borderRadius: "var(--radius)",
                background: active ? "rgba(96,165,250,0.1)" : undefined,
                color: active ? "var(--accent)" : "var(--fg-muted)",
                textDecoration: "none", fontSize: "0.84rem",
              }}
              title={p.name}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: live ? "var(--success)" : "rgba(165,182,214,0.3)",
              }} />
              {!collapsed && (
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                  {p.name}
                </span>
              )}
            </Link>
          </div>
        );
      })}
    </>
  );
}

// ── User menu ─────────────────────────────────────────────────────────────────

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{ handle: string | null; companyName: string | null } | null>(null);
  const [dropPos, setDropPos] = useState<{ x: number; y: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const { getFounderProfile } = await import("../lib/project-fns.js");
        const p = await getFounderProfile();
        setProfile(p ? { handle: p.handle, companyName: p.companyName } : null);
      } catch { }
    }
    load();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function handleToggle() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Always anchor to button's top-left; dropdown opens upward
    setDropPos({ x: r.left, y: r.top, width: 220 });
    setOpen((v) => !v);
  }

  const displayName = profile?.companyName || profile?.handle || "Profile";
  const displayHandle = profile?.handle
    ? (profile.handle.startsWith("@") ? profile.handle : `@${profile.handle}`)
    : null;
  const initial = displayName.charAt(0).toUpperCase();

  const dropdown = open && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: "fixed",
        bottom: `calc(100vh - ${dropPos.y}px + 6px)`,
        left: dropPos.x,
        width: dropPos.width,
        minWidth: 200,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 9999,
      }}
    >
      <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", lineHeight: 1.3 }}>
          {displayName}
        </div>
        {displayHandle && displayHandle !== displayName && (
          <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", marginTop: 2 }}>
            {displayHandle}
          </div>
        )}
      </div>
      <div style={{ padding: "4px 0" }}>
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 12px",
            fontSize: "0.84rem",
            color: "var(--fg-muted)",
            textDecoration: "none",
          }}
        >
          <Settings size={13} />
          Settings
        </Link>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ padding: collapsed ? "4px 6px" : "4px 8px" }}>
      <Button
        ref={btnRef}
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="nav-item"
        style={{
          display: "flex",
          width: "100%",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: collapsed ? 0 : 8,
          padding: collapsed ? "0" : "0 8px",
          height: 34,
          background: open ? "rgba(96,165,250,0.08)" : undefined,
          color: "var(--fg-muted)",
          fontSize: "0.84rem",
        }}
      >
        <span style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(96,165,250,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.66rem", fontWeight: 700,
          color: "var(--accent)", flexShrink: 0,
        }}>
          {initial}
        </span>
        {!collapsed && (
          <>
            <span style={{
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, textAlign: "left", fontSize: "0.82rem",
            }}>
              {displayName}
            </span>
            <ChevronsUpDown size={12} style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
          </>
        )}
      </Button>
      {dropdown}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  projects,
  activeBuilds,
  activeChannelJobs,
  runningByProject,
  buildingProjectIds,
  collapsed,
  setCollapsed,
  width,
  setWidth,
}: {
  projects: ProjectWithCounts[] | null;
  activeBuilds: number;
  activeChannelJobs: number;
  runningByProject: Map<number, number>;
  buildingProjectIds: Set<number>;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  width: number;
  setWidth: (v: number) => void;
}) {
  const effectiveW = collapsed ? COLLAPSED_W : width;
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; w: number } | null>(null);

  // Project drag-to-reorder
  const [localProjects, setLocalProjects] = useState<ProjectWithCounts[] | null>(null);
  useEffect(() => { setLocalProjects(projects); }, [projects]);
  const draggedProjectId = useRef<number | null>(null);
  const dragOverProjectId = useRef<number | null>(null);

  function onProjectDragStart(id: number) {
    draggedProjectId.current = id;
  }

  function onProjectDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    dragOverProjectId.current = id;
  }

  function onProjectDrop(e: React.DragEvent, group: "live" | "building") {
    e.preventDefault();
    const fromId = draggedProjectId.current;
    const toId = dragOverProjectId.current;
    if (!fromId || !toId || fromId === toId || !localProjects) return;

    const grouped = group === "live"
      ? localProjects.filter(p => p.isLive)
      : localProjects.filter(p => !p.isLive);
    const other = group === "live"
      ? localProjects.filter(p => !p.isLive)
      : localProjects.filter(p => p.isLive);

    const fromIdx = grouped.findIndex(p => p.id === fromId);
    const toIdx = grouped.findIndex(p => p.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...grouped];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, grouped[fromIdx]);

    const newOrder = group === "live" ? [...reordered, ...other] : [...other, ...reordered];
    setLocalProjects(newOrder);

    draggedProjectId.current = null;
    dragOverProjectId.current = null;

    import("../lib/project-fns.js").then(m =>
      m.reorderProjects({ data: { orderedIds: newOrder.map(p => p.id) } })
    ).catch(() => { });
  }

  function onResizeStart(e: React.MouseEvent) {
    if (collapsed) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX, w: width };
    setDragging(true);
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const delta = e.clientX - dragStart.current.x;
      const nw = Math.max(MIN_W, Math.min(MAX_W, dragStart.current.w + delta));
      setWidth(nw);
    }
    function onUp() {
      setDragging(false);
      if (dragStart.current) {
        const delta = 0; // width is already set reactively
        localStorage.setItem("sidebar:width", String(width));
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, width, setWidth]);

  return (
    <aside style={{
      position: "fixed", left: 0, top: 0,
      width: effectiveW, height: "100vh",
      background: "#03080f",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      zIndex: 50,
      overflowY: collapsed ? "hidden" : "auto",
      overflowX: "hidden",
      userSelect: dragging ? "none" : undefined,
      flexShrink: 0,
    }}>

      {/* Brand + collapse toggle */}
      <div style={{
        height: 52, flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        padding: collapsed ? "0" : "0 12px",
        justifyContent: collapsed ? "center" : "space-between",
        gap: 8,
      }}>
        {collapsed ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCollapsed(false); localStorage.setItem("sidebar:collapsed", "false"); }}
            title="Expand sidebar"
            style={{
              width: 32, height: 32,
              background: "rgba(96,165,250,0.1)",
              color: "var(--accent)",
              padding: 0,
            }}
          >
            <span style={{ fontSize: "0.72rem", fontWeight: 800 }}>BD</span>
          </Button>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 5,
                background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.62rem", fontWeight: 800, color: "#050d1e",
                letterSpacing: "-0.02em", flexShrink: 0,
              }}>
                BD
              </div>
              <span style={{
                fontSize: "0.82rem", fontWeight: 600,
                letterSpacing: "0.02em", color: "var(--fg)",
                whiteSpace: "nowrap", overflow: "hidden",
              }}>
                Studio
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCollapsed(true); localStorage.setItem("sidebar:collapsed", "true"); }}
              title="Collapse sidebar"
              style={{
                width: 24, height: 24,
                color: "var(--fg-subtle)",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <ChevronLeft size={14} />
            </Button>
          </>
        )}
      </div>

      {/* Nav content */}
      <div style={{ flex: 1, paddingBottom: 8, paddingTop: 4 }}>

        {/* Workspace */}
        <SidebarSection label="Workspace" collapsed={collapsed} />
        <NavItem to="/" icon={Home} label="Overview" exact collapsed={collapsed} />
        <NavItem to="/opportunities" icon={Target} label="Opportunities" collapsed={collapsed} />

        {/* Projects */}
        <SidebarSection
          label="Ideas"
          collapsed={collapsed}
          action={!collapsed ? (
            <Link
              to="/i/new"
              search={{ opportunityId: undefined }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 20, height: 20, borderRadius: 4,
                color: "var(--fg-subtle)",
                textDecoration: "none",
              }}
              title="New project"
            >
              <Plus size={13} />
            </Link>
          ) : undefined}
        />

        {localProjects === null ? (
          /* Loading skeleton */
          !collapsed && (
            <div style={{ padding: "2px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {[80, 65, 72].map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 10px" }}>
                  <div className="sk" style={{ width: 6, height: 6, borderRadius: 2, flexShrink: 0 }} />
                  <div className="sk" style={{ width: `${w}%`, height: 11 }} />
                </div>
              ))}
            </div>
          )
        ) : localProjects.length === 0 ? (
          !collapsed && (
            <div style={{ padding: "4px 8px" }}>
              <Link to="/i/new" search={{ opportunityId: undefined }} style={{
                display: "flex", alignItems: "center",
                padding: "6px 10px", borderRadius: "var(--radius)",
                color: "var(--fg-subtle)", textDecoration: "none",
                fontSize: "0.82rem", fontStyle: "italic",
                gap: 6,
              }}>
                <Plus size={12} />
                New project
              </Link>
            </div>
          )
        ) : (
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={e => onProjectDrop(e, "building")}
          >
            {localProjects
              .map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onProjectDragStart(p.id)}
                  onDragOver={e => onProjectDragOver(e, p.id)}
                  style={{ cursor: "grab" }}
                >
                  <ProjectItem
                    id={p.id}
                    name={p.name}
                    handle={null}
                    status={p.status ?? "active"}
                    collapsed={collapsed}
                    runningChannels={runningByProject.get(p.id) ?? 0}
                    hypothesis={p.hypothesis}
                    isBuilding={buildingProjectIds.has(p.id)}
                  />
                </div>
              ))
            }
          </div>
        )}

        {/* Products */}
        <ProductsSection collapsed={collapsed} buildingProjectIds={buildingProjectIds} />

        {/* Tools */}
        <SidebarSection label="Tools" collapsed={collapsed} />
        <NavItem to="/inbox" icon={Inbox} label="Inbox" collapsed={collapsed} />
        <NavItem to="/scan" icon={Zap} label="Scan" collapsed={collapsed} />
        <NavItem to="/seo-discover" icon={Search} label="SEO Discover" collapsed={collapsed} />
        <NavItem to="/verticals" icon={Radar} label="Verticals" collapsed={collapsed} />
        <NavItem to="/channel-scouts" icon={Activity} label="Channel Scouts" badge={activeChannelJobs} collapsed={collapsed} />
        <NavItem to="/market" icon={TrendingUp} label="Market Intel" collapsed={collapsed} />
        <NavItem to="/signals" icon={Zap} label="Signals" collapsed={collapsed} />
        <NavItem to="/pain-clusters" icon={Layers} label="Pain Clusters" collapsed={collapsed} />
        <NavItem to="/seo" icon={Search} label="SEO Discovery" collapsed={collapsed} />
        <NavItem to="/domain-search" icon={Globe} label="Domain Search" collapsed={collapsed} />
        <NavItem to="/costs" icon={DollarSign} label="Costs" collapsed={collapsed} />

        {/* Build section removed - building happens in Claude Code externally */}

      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0, paddingTop: 4, paddingBottom: 4 }}>
        <UserMenu collapsed={collapsed} />
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          onMouseDown={onResizeStart}
          style={{
            position: "absolute", top: 0, right: 0,
            width: 4, height: "100%",
            cursor: "col-resize",
            background: dragging ? "rgba(96,165,250,0.25)" : "transparent",
          }}
        />
      )}
    </aside>
  );
}

// ── Navigation progress bar ───────────────────────────────────────────────────

function NavProgressBar() {
  const isLoading = useRouterState({ select: (s) => s.isLoading });
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      setWidth(30);
      // Crawl to 85% while waiting
      timerRef.current = setTimeout(() => setWidth(85), 200);
    } else {
      // Complete quickly then fade out
      setWidth(100);
      timerRef.current = setTimeout(() => setVisible(false), 250);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading]);

  if (!visible) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: 2,
      zIndex: 9999, pointerEvents: "none",
    }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        background: "var(--accent)",
        transition: width === 100 ? "width 0.15s ease-out" : "width 0.8s ease-out",
        boxShadow: "0 0 8px var(--accent)",
      }} />
    </div>
  );
}

// ── Always-visible floating pill (project pages only) ────────────────────────

function StatusPillPortal({ jobs, buildingProjectIds }: { jobs: ActiveJob[]; buildingProjectIds: Set<number> }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // BreadcrumbHeader already shows StatusPill on non-project pages - only float it on idea/product routes
  if (!(pathname.startsWith("/i/") || pathname.startsWith("/products/")) || pathname === "/i/new") return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {buildingProjectIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.06em" }}>
            {buildingProjectIds.size} building
          </span>
        </div>
      )}
      <UsagePill />
      <StatusPill jobs={jobs} />
    </div>
  );
}

// ── Breadcrumb header ─────────────────────────────────────────────────────────

function StatusPill({ jobs }: { jobs: ActiveJob[] }) {
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function stopAll() {
    setStopping(true);
    try { await fetch("/api/stop-all", { method: "POST" }); } finally { setStopping(false); setOpen(false); }
  }

  const running = jobs.filter((j) => j.status === "running");
  const queued = jobs.filter((j) => j.status === "queued");
  const total = jobs.length;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (total === 0) return null;

  const label = running.length > 0
    ? `${running.length} running${queued.length > 0 ? ` · ${queued.length} queued` : ""}`
    : `${queued.length} queued`;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: open ? "rgba(96,165,250,0.1)" : "rgba(96,165,250,0.06)",
          border: "1px solid rgba(96,165,250,0.2)",
          borderRadius: 4,
          padding: "3px 9px",
          cursor: "pointer",
          fontSize: "0.70rem", fontWeight: 600,
          color: "var(--accent)",
          fontFamily: "inherit",
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent)",
          animation: "pulse 1.5s ease-in-out infinite",
          flexShrink: 0,
        }} />
        {label}
      </button>

      {open && (
        <div style={{
          position: "fixed",
          top: 44, right: 12,
          zIndex: 9999,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          borderRadius: "calc(var(--radius) * 1.5)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          minWidth: 280, maxWidth: 360,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "8px 12px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-dim)" }}>
              Active jobs
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={stopAll}
              disabled={stopping}
              style={{ fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "2px 8px", height: "auto" }}
            >
              {stopping ? "Stopping…" : "Stop all"}
            </Button>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {jobs.map((job) => (
              <Link
                key={job.id}
                to={job.link as any}
                onClick={() => setOpen(false)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", textDecoration: "none", borderBottom: "1px solid var(--border)" }}
              >
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                  background: job.status === "running" ? "var(--accent)" : "#f59e0b",
                  animation: job.status === "running" ? "pulse 1.5s ease-in-out infinite" : "none",
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.80rem", fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {job.label}
                  </div>
                  {job.projectName && (
                    <div style={{ fontSize: "0.70rem", color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.projectName}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: job.status === "running" ? "var(--accent)" : "#f59e0b",
                  flexShrink: 0,
                }}>
                  {job.status === "queued" && job.queuePosition ? `#${job.queuePosition}` : job.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UsagePill() {
  const [stats, setStats] = useState<{ last7DaysUsd: number; last30DaysUsd: number; byModel: { model: string; totalUsd: number; calls: number }[] } | null>(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("~/lib/project-fns").then(m => m.getAiCostStats()).then(s => setStats({
      last7DaysUsd: s.last7DaysUsd,
      last30DaysUsd: s.last30DaysUsd,
      byModel: s.byModel,
    })).catch(() => { });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!btnRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const fmt = (n: number) => n === 0 ? "$0.0000" : n < 0.0001 ? "<$0.0001" : `$${n.toFixed(4)}`;
  const cost7 = stats?.last7DaysUsd ?? 0;

  const pill = (
    <button
      ref={btnRef}
      onClick={() => setOpen(o => !o)}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "3px 8px",
        border: `1px solid ${open ? "rgba(165,182,214,0.2)" : "rgba(165,182,214,0.1)"}`,
        borderRadius: 4,
        background: open ? "rgba(165,182,214,0.06)" : "transparent",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
      title="AI usage"
    >
      <DollarSign size={11} style={{ color: cost7 > 1 ? "#ef4444" : "rgba(165,182,214,0.4)", flexShrink: 0 }} />
      <span style={{ fontSize: "0.68rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: cost7 > 1 ? "#ef4444" : "rgba(165,182,214,0.5)" }}>
        {stats ? fmt(cost7) : "-"}
      </span>
      <span style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.25)", letterSpacing: "0.04em" }}>7d</span>
    </button>
  );

  if (!open || !stats) return pill;

  const rect = btnRef.current?.getBoundingClientRect();
  const top = (rect?.bottom ?? 0) + 6;
  const right = typeof window !== "undefined" ? window.innerWidth - (rect?.right ?? 0) : 0;

  return (
    <>
      {pill}
      {createPortal(
        <div
          ref={dropRef}
          style={{
            position: "fixed", top, right, zIndex: 9999,
            width: 220,
            background: "#0c0c0f",
            border: "1px solid rgba(165,182,214,0.12)",
            borderRadius: 6,
            boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
            padding: "14px 16px",
            display: "flex", flexDirection: "column", gap: 12,
          }}
        >
          {/* Spend rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Last 7 days", val: stats.last7DaysUsd },
              { label: "Last 30 days", val: stats.last30DaysUsd },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.74rem", color: "rgba(165,182,214,0.45)" }}>{label}</span>
                <span style={{ fontSize: "0.80rem", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: val > 0 ? "var(--fg-muted)" : "rgba(165,182,214,0.25)" }}>
                  {fmt(val)}
                </span>
              </div>
            ))}
          </div>

          {/* By model */}
          {stats.byModel.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid rgba(165,182,214,0.07)" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.25)", marginBottom: 2 }}>
                  By model (30d)
                </span>
                {stats.byModel.slice(0, 4).map(m => (
                  <div key={m.model} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "0.70rem", color: "rgba(165,182,214,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {m.model.replace(/^.*\//, "").replace(/-\d{8}$/, "")}
                    </span>
                    <span style={{ fontSize: "0.70rem", fontVariantNumeric: "tabular-nums", color: "rgba(165,182,214,0.55)", flexShrink: 0 }}>
                      {fmt(m.totalUsd)}
                    </span>
                    <span style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.25)", flexShrink: 0 }}>
                      {m.calls}×
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Link */}
          <div style={{ borderTop: "1px solid rgba(165,182,214,0.07)", paddingTop: 8 }}>
            <Link
              to="/costs"
              onClick={() => setOpen(false)}
              style={{ fontSize: "0.72rem", color: "rgba(165,182,214,0.4)", textDecoration: "none" }}
            >
              View full cost log →
            </Link>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function BreadcrumbHeader({ allJobs, buildingProjectIds }: { allJobs: ActiveJob[]; buildingProjectIds: Set<number> }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  // Project detail pages manage their own top bar
  if ((pathname.startsWith("/i/") || pathname.startsWith("/products/")) && pathname !== "/i/new") return null;

  const crumb = (() => {
    if (pathname === "/") return "Overview";
    if (pathname === "/scan") return "Scan";
    if (pathname === "/verticals") return "Verticals";
    if (pathname === "/i/new") return "New Idea";
    if (pathname.startsWith("/settings")) return "Settings";
    if (pathname.startsWith("/inbox")) return "Inbox";
    if (pathname === "/discovery") return "Discovery";
    if (pathname === "/explore") return "Verticals";
    if (pathname === "/costs") return "Costs";
    if (pathname === "/market") return "Market Intelligence";
    if (pathname === "/opportunities") return "Opportunities";
    if (pathname === "/channel-scouts") return "Channel Scouts";
    if (pathname === "/seo") return "SEO Discovery";
    if (pathname === "/signals") return "Signals";
    if (pathname === "/pain-clusters") return "Pain Clusters";
    if (pathname === "/projects") return "Builds";
    if (pathname === "/ideas") return "Ideas";
    if (pathname === "/ideas/new") return "New Idea";
    if (pathname.startsWith("/ideas/")) return "Idea";
    if (pathname === "/domain-search") return "Domain Search";
    if (pathname.startsWith("/opportunity/")) return "Opportunity";
    return "";
  })();

  // Only show back on sub-pages, not root sidebar items
  const canGoBack = pathname.split("/").filter(Boolean).length > 1;

  return (
    <div style={{
      height: 40, flexShrink: 0,
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 16px",
      gap: 8,
      background: "var(--bg)",
    }}>
      {canGoBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.history.back()}
          title="Go back"
          style={{ color: "var(--fg-dim)", padding: "2px 4px", height: "auto", flexShrink: 0 }}
        >
          <ChevronLeft size={14} />
        </Button>
      )}
      {crumb && (
        <span style={{
          fontSize: "0.70rem", fontWeight: 600,
          letterSpacing: "0.10em", textTransform: "uppercase",
          color: "var(--fg-subtle)",
        }}>
          {crumb}
        </span>
      )}
      <div style={{ flex: 1 }} />
      {buildingProjectIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 8px", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f59e0b", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#f59e0b", letterSpacing: "0.06em" }}>
            {buildingProjectIds.size} building
          </span>
        </div>
      )}
      <UsagePill />
      <StatusPill jobs={allJobs} />
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export const Route = createRootRoute({
  notFoundComponent: () => (
    <div style={{ padding: "80px 32px", color: "var(--fg-muted)", fontSize: "0.9rem" }}>
      Page not found.
    </div>
  ),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BurningDemand Studio" },
    ],
    links: [
      { rel: "stylesheet", href: globalsCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // Start with SSR-safe defaults, sync from localStorage after hydration
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_W);

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar:collapsed") === "true");
    const saved = parseInt(localStorage.getItem("sidebar:width") ?? "", 10);
    if (!isNaN(saved) && saved >= MIN_W && saved <= MAX_W) setSidebarWidth(saved);
  }, []);
  const [projects, setProjects] = useState<ProjectWithCounts[] | null>(null);
  const { count: activeBuilds, buildJobs, activeProjectIds: buildingProjectIds } = useBuildsState();
  const { count: activeChannelJobs, byProject: runningByProject, jobs: channelActiveJobs } = useActiveChannelJobs();

  const effectiveW = collapsed ? COLLAPSED_W : sidebarWidth;

  const loadProjects = useCallback(async () => {
    try {
      const { getProjects } = await import("../lib/project-fns.js");
      setProjects(await getProjects());
    } catch { /* handled below */ }
  }, []);

  // Keep retrying until projects load (handles dev server restarts)
  useEffect(() => {
    let cancelled = false;
    async function tryLoad() {
      while (!cancelled) {
        try {
          const { getProjects } = await import("../lib/project-fns.js");
          const result = await getProjects();
          if (!cancelled) { setProjects(result); return; }
        } catch {
          if (!cancelled) await new Promise(r => setTimeout(r, 1_500));
        }
      }
    }
    tryLoad();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.addEventListener("projects:changed", loadProjects);
    return () => window.removeEventListener("projects:changed", loadProjects);
  }, [loadProjects]);

  return (
    <RootDocument>
      <ConfirmProvider>
        <NavProgressBar />
        <div style={{ display: "flex", height: "100vh" }}>
          <Sidebar
            projects={projects}
            activeBuilds={activeBuilds}
            activeChannelJobs={activeChannelJobs}
            runningByProject={runningByProject}
            buildingProjectIds={buildingProjectIds}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            width={sidebarWidth}
            setWidth={setSidebarWidth}
          />
          <div style={{
            marginLeft: effectiveW,
            flex: 1, display: "flex", flexDirection: "column",
            height: "100vh", overflow: "hidden", minWidth: 0,
          }}>
            <BreadcrumbHeader allJobs={[...channelActiveJobs, ...buildJobs]} buildingProjectIds={buildingProjectIds} />
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <Outlet />
            </div>
          </div>
          {/* Always-visible status pill - floats top-right on project pages where BreadcrumbHeader is hidden */}
          <div style={{ position: "fixed", top: 8, right: 12, zIndex: 500, pointerEvents: "auto" }}>
            <StatusPillPortal jobs={[...channelActiveJobs, ...buildJobs]} buildingProjectIds={buildingProjectIds} />
          </div>
        </div>
      </ConfirmProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body style={{
        margin: 0,
        fontFamily: "'Space Grotesk', sans-serif",
        background: "var(--bg)",
        color: "var(--fg)",
      }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
