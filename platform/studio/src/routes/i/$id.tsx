import { createFileRoute, Outlet, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  getProjectData, getProjectChannels, updateProject, deleteProject, purgeProjectData,
} from "~/lib/project-fns";
import type { Project, Product } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";
import { Input } from "~/components/ui/Input";
import { ProjectConfigModal } from "~/components/ui/ProjectConfigModal";
import {
  LayoutDashboard, Radio, Target, Hammer, Send, BarChart2, MoreHorizontal, Rocket,
} from "lucide-react";
import { ProjectCtx } from "~/lib/project-context";

// ── Steps ─────────────────────────────────────────────────────────────────────

// Idea routes are discovery-only. Build/Distribution/Monitor live on the Product (/products/$id).
const ALL_STEPS = [
  { key: "overview",      label: "Overview",      icon: LayoutDashboard },
  { key: "channels",      label: "Discover",      icon: Radio },
  { key: "opportunities", label: "Opportunities", icon: Target },
] as const;

export type StepKey = typeof ALL_STEPS[number]["key"];

export function getSteps(_isLive?: boolean) {
  return ALL_STEPS.slice();
}

export const STEPS = ALL_STEPS;

// ── Shared micro-components ───────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.60rem] font-bold tracking-widest uppercase text-fg-subtle block mb-[10px]">
      {children}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-[10px] py-[3px] text-sm border border-border-strong rounded-[var(--radius)] text-fg-muted">
      {children}
    </span>
  );
}

export function Stat({ value, label, dim }: { value: number; label: string; dim?: boolean }) {
  return (
    <div className="flex flex-col gap-[3px]">
      <span
        className="text-[2.4rem] font-light tracking-tight leading-none [font-variant-numeric:tabular-nums]"
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          color: dim ? "var(--fg-subtle)" : "var(--fg)",
        }}
      >
        {value}
      </span>
      <span className="text-[0.65rem] font-semibold tracking-widest uppercase text-fg-subtle">
        {label}
      </span>
    </div>
  );
}

export const CHART_TOOLTIP: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  fontSize: "0.78rem",
  color: "var(--fg-muted)",
};

export { ScoreDot } from "~/components/ui/ScoreDot";

export function ActionCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a
      href={href}
      className="block no-underline pl-[14px] mb-4"
      style={{ borderLeft: "2px solid var(--border)" }}
    >
      <div className="text-sm font-semibold text-fg mb-[3px]">
        {title} →
      </div>
      <p className="m-0 text-sm text-fg-subtle leading-[1.5]">
        {desc}
      </p>
    </a>
  );
}

export function ComingSoonSection({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="pl-[14px] mb-5 opacity-60" style={{ borderLeft: "2px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-fg-subtle">{label}</span>
        <span
          className="text-[0.58rem] font-bold tracking-widest uppercase text-fg-subtle px-[5px] py-[1px] border border-border"
        >
          soon
        </span>
      </div>
      <p className="m-0 text-sm text-fg-subtle leading-[1.5]">
        {detail}
      </p>
    </div>
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

function ProjectPending() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Project header skeleton */}
      <div style={{ height: 40, flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
        <div className="sk" style={{ width: 8, height: 8, borderRadius: "50%" }} />
        <div className="sk" style={{ width: 160, height: 14 }} />
        <div style={{ flex: 1 }} />
        <div className="sk" style={{ width: 72, height: 26, borderRadius: 4 }} />
      </div>
      {/* Tab bar skeleton */}
      <div style={{ height: 40, flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 0, padding: "0 8px" }}>
        {[90, 110, 100, 80, 80, 70].map((w, i) => (
          <div key={i} className="sk" style={{ width: w, height: 14, margin: "0 12px" }} />
        ))}
      </div>
      {/* Content skeleton */}
      <div style={{ flex: 1, padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="sk" style={{ width: "45%", height: 24 }} />
        <div className="sk" style={{ width: "70%", height: 14 }} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="sk" key={i} style={{ height: 44, opacity: 1 - i * 0.07 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/i/$id")({
  loader: async ({ params }) => {
    const id = parseInt(params.id, 10);
    const data = await getProjectData({ data: { id } });
    if (!data) throw new Error("Project not found");
    const { getProductsForIdea } = await import("~/lib/product-fns");
    const products = await getProductsForIdea({ data: { ideaId: id } });
    return { ...data, product: products[0] ?? null };
  },
  staleTime: 30_000,
  pendingComponent: ProjectPending,
  component: ProjectLayout,
});

// ── MenuItem ──────────────────────────────────────────────────────────────────

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
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

// ── ProjectHeader ─────────────────────────────────────────────────────────────

function ProjectHeader({
  project,
  onDeleted,
  onUpdated,
}: {
  project: Project;
  onDeleted: () => void;
  onUpdated: (patch: Partial<Project>) => void;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(project.name);
  const [renameBusy, setRenameBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!renaming) setRenameVal(project.name);
  }, [project.name, renaming]);

  function openMenu() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    setMenuOpen((v) => !v);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameVal.trim()) return;
    setRenameBusy(true);
    try {
      await updateProject({ data: { id: project.id, name: renameVal.trim() } });
      onUpdated({ name: renameVal.trim() });
      window.dispatchEvent(new Event("projects:changed"));
      setRenaming(false);
    } finally {
      setRenameBusy(false);
    }
  }

  async function handleStatusToggle() {
    setMenuOpen(false);
    const next = project.status === "active" ? "paused" : "active";
    await updateProject({ data: { id: project.id, status: next } });
    onUpdated({ status: next });
  }

  async function handlePurge() {
    setMenuOpen(false);
    const ok = await confirm(
      `Purge all data for "${project.name}"? This deletes all signals, opportunities, features, versions, and resets discovery - but keeps the project and its channels. Cannot be undone.`,
      { variant: "danger", confirmLabel: "Purge everything" }
    );
    if (!ok) return;
    await purgeProjectData({ data: { id: project.id } });
    window.dispatchEvent(new Event("projects:changed"));
    router.invalidate();
  }

  async function handleDelete() {
    setMenuOpen(false);
    const ok = await confirm(`Delete "${project.name}"? This cannot be undone.`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    await deleteProject({ data: { id: project.id } });
    window.dispatchEvent(new Event("projects:changed"));
    onDeleted();
  }

  const menu = menuOpen && menuPos ? createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.top,
        right: menuPos.right,
        minWidth: 190,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        zIndex: 9999,
        padding: "4px 0",
      }}
    >
      <MenuItem onClick={() => { setMenuOpen(false); setConfigOpen(true); }}>
        Configure project
      </MenuItem>
      <div className="h-px bg-border my-1" />
      <MenuItem onClick={() => { setMenuOpen(false); setRenameVal(project.name); setRenaming(true); }}>
        Rename
      </MenuItem>
      <MenuItem onClick={handleStatusToggle}>
        {project.status === "active" ? "Mark as paused" : "Mark as active"}
      </MenuItem>
      <div className="h-px bg-border my-1" />
      <MenuItem onClick={handlePurge} danger>
        Purge all data
      </MenuItem>
      <MenuItem onClick={handleDelete} danger>
        Delete project
      </MenuItem>
    </div>,
    document.body
  ) : null;

  return (
    <div
      className="px-5 h-[40px] border-b border-border flex items-center gap-[10px] flex-shrink-0 bg-bg group"
    >
      <div
        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
        style={{ background: project.status === "active" ? "var(--accent)" : "var(--fg-subtle)" }}
      />

      {renaming ? (
        <form onSubmit={handleRename} className="flex items-center gap-2 flex-1">
          <Input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            style={{ maxWidth: 280, height: 30, padding: "4px 8px", fontSize: "0.88rem" }}
          />
          <Button type="submit" variant="primary" size="sm" disabled={renameBusy || !renameVal.trim()}>
            {renameBusy ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex-1 min-w-0 flex items-center gap-[8px]">
          <span className="text-base font-semibold text-fg flex-shrink-0">
            {project.name}
          </span>
          {project.hypothesis && (
            <span
              title={project.hypothesis}
              style={{ fontSize: "0.82rem", color: "rgba(165,182,214,0.72)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320, cursor: "default" }}
            >
              {project.hypothesis.slice(0, 60)}{project.hypothesis.length > 60 ? "…" : ""}
            </span>
          )}
          <button
            ref={btnRef}
            onClick={openMenu}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0"
            style={{
              background: menuOpen ? "rgba(165,182,214,0.1)" : "transparent",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              padding: "2px 5px",
              display: "flex",
              alignItems: "center",
              color: menuOpen ? "var(--fg)" : "var(--fg-dim)",
              opacity: menuOpen ? 1 : undefined,
            }}
          >
            <MoreHorizontal size={13} />
          </button>
        </div>
      )}

      {menu}

      <ProjectConfigModal
        open={configOpen}
        project={project}
        onClose={() => setConfigOpen(false)}
        onSaved={(patch) => onUpdated(patch as Partial<Project>)}
      />
    </div>
  );
}


// ── StepTabs ──────────────────────────────────────────────────────────────────

function StepTabs({ projectId, runningChannels, isLive }: { projectId: string; runningChannels: number; isLive: boolean }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/i/${projectId}`;
  const steps = getSteps(isLive);

  return (
    <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
      {steps.map(({ key, label, icon: Icon }) => {
        const targetPath = key === "overview" ? base : `${base}/${key}`;
        const isActive = key === "overview"
          ? pathname === base || pathname === `${base}/`
          : pathname.startsWith(targetPath);
        const showBadge = key === "channels" && runningChannels > 0;

        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: targetPath as any })}
            style={{
              gap: 7,
              padding: "0 22px", height: 46,
              background: isActive ? "rgba(165,182,214,0.05)" : "transparent",
              borderBottom: `2px solid ${isActive ? "var(--accent)" : "transparent"}`,
              borderRadius: 0,
              color: isActive ? "var(--fg)" : "var(--fg-subtle)",
              fontSize: "0.84rem", fontWeight: isActive ? 600 : 400,
              letterSpacing: "0.03em",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <Icon size={13} />
            {label}
            {showBadge && (
              <span className="pulse" style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 16, height: 16, borderRadius: 8,
                background: "#fbbf24", color: "#010407",
                fontSize: "0.60rem", fontWeight: 700, lineHeight: 1,
                padding: "0 4px",
              }}>
                {runningChannels}
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────

function ProjectLayout() {
  const { project: initial, product: initialProduct, stats, scores, funnel, activeChannels } = Route.useLoaderData();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(initialProduct);
  useEffect(() => { setProduct(initialProduct); }, [initial.id]);

  // Patch stores only optimistic overrides (renames, status changes).
  // Reset whenever we navigate to a different project.
  const [patch, setPatch] = useState<Partial<Project>>({});
  useEffect(() => { setPatch({}); }, [initial.id]);

  const [channels, setChannels] = useState(activeChannels);
  useEffect(() => { setChannels(activeChannels); }, [initial.id]);

  // Always derived from fresh loader data - no stale state on navigation.
  const project: Project = { ...initial, ...patch };
  const setProject = (update: Project | ((p: Project) => Project)) => {
    setPatch((prev) => {
      const current: Project = { ...initial, ...prev };
      const next = typeof update === "function" ? update(current) : update;
      // Only store fields that differ from the current loader data
      const diff: Partial<Project> = {};
      for (const k of Object.keys(next) as (keyof Project)[]) {
        if (next[k] !== initial[k]) (diff as Record<string, unknown>)[k] = next[k];
      }
      return diff;
    });
  };

  return (
    <ProjectCtx.Provider value={{ project, setProject, product, setProduct, channels, setChannels, stats, scores, funnel }}>
      <div className="flex flex-col h-screen overflow-hidden">
        <ProjectHeader
          project={project}
          onDeleted={() => router.navigate({ to: "/" })}
          onUpdated={(patch) => setProject((p) => ({ ...p, ...patch }))}
        />
        <StepTabs projectId={String(initial.id)} runningChannels={0} isLive={product?.deployStatus === "deployed"} />
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </ProjectCtx.Provider>
  );
}
