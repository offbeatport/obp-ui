import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  listVerticals,
  expandVertical,
  scoreCommunities,
  trackScannedCommunities,
  getTrackedCommunities,
} from "~/lib/market-scan";
import { trackCommunity } from "~/lib/project-fns";
import type {
  VerticalDef,
  VerticalExpansion,
  ScoredCommunity,
  TrackedCommunity,
} from "~/lib/market-scan";
import { VERTICALS } from "~/lib/verticals";
import { Button } from "~/components/ui/Button";
import { Tooltip } from "~/components/ui/Tooltip";
import { Checkbox } from "~/components/ui/Checkbox";
import {
  Building2,
  BarChart2,
  Users,
  ShoppingCart,
  Server,
  TrendingUp,
  Briefcase,
  Scale,
  Home,
  Activity,
  Truck,
  GraduationCap,
  Wrench,
  Heart,
  DollarSign,
  Radar,
  Loader2,
  Check,
  Zap,
  Plus,
  LineChart,
  UtensilsCrossed,
  Factory,
  Shield,
  FolderOpen,
  FlaskConical,
  HelpCircle,
  ChevronLeft,
  Laptop,
  Rocket,
  Palette,
  Video,
  Code2,
} from "lucide-react";

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICONS: Record<string, React.ElementType> = {
  Building2,
  BarChart2,
  Users,
  ShoppingCart,
  Server,
  TrendingUp,
  Briefcase,
  Scale,
  Home,
  Activity,
  Truck,
  GraduationCap,
  Wrench,
  Heart,
  DollarSign,
  LineChart,
  UtensilsCrossed,
  Factory,
  Shield,
  FolderOpen,
  FlaskConical,
  Laptop,
  Rocket,
  Palette,
  Zap,
  Video,
  Code2,
};

function VertIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Activity;
  return <Icon size={size} />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function relativeTime(d: Date | null): string {
  if (!d) return "Never";
  const secs = (Date.now() - new Date(d).getTime()) / 1000;
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Column tooltips ───────────────────────────────────────────────────────────

const COL_TIPS: Record<string, string> = {
  "Community": "The subreddit. Communities under 1,000 members are dimmed - too small for reliable signal volume.",
  "Vertical": "Which market vertical this community was discovered from.",
  "Size": "Size category based on subscriber count. Sweet spot for reply-based outreach: 5k–300k. Enough daily posts to find problems, and an early reply still gets read.",
  "Members": "Total subscribers - includes dormant accounts from years ago. Use as a floor check only; the number alone says nothing about activity.",
  "Activity": "Estimated posts per day, derived from the timestamps of the 50 most-recent posts. Shows how frequently people post. 1–5/day = healthy niche; >20/day = noisy.",
  "Engagement": "Posts per 1,000 subscribers per day. Normalises activity by community size - a better signal than raw post count. Above 0.1 = active; above 0.5 = highly engaged.",
  "Fit": "Solopreneur fit score (0–100%). Combines pain density (45%), size fit (35%, peaks at 5k–300k), and post activity (20%). Sort by this to find the best communities to reply in.",
  "Status": "Feed scanner status. Done = last scan completed. Idle = not yet scanned. Running = scan in progress.",
  "Last scanned": "When the feed scanner last checked this community for new posts.",
  "Pain / Buyer": "Pain density (red): % of recent posts with frustration language - tells you there are problems worth replying to. Buyer density (green): % with spend signals - tells you the community culture already accepts product talk. For reply-based promotion: you want both bars visible.",
  "Links?": "Whether the subreddit allows link posts. 'Links' = can post URLs to your product. 'Text only' = text posts only - you can mention your product in comments but can't share a URL directly. Combined with buyer density, this tells you how receptive the community is to solution promotion.",
};

function ColLabel({ label }: { label: string }) {
  const tip = COL_TIPS[label];
  if (!tip) return <>{label}</>;
  return (
    <Tooltip content={<span style={{ fontSize: "0.75rem", lineHeight: 1.55 }}>{tip}</span>} width={240} side="bottom">
      <span style={{ borderBottom: "1px dotted rgba(165,182,214,0.35)" }}>{label}</span>
    </Tooltip>
  );
}

// ── LoadingState ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: "80px 32px", color: "var(--fg-muted)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 10 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      Loading Verticals…
    </div>
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

type LoaderData = {
  verticals: VerticalDef[];
  tracked: TrackedCommunity[];
};

export const Route = createFileRoute("/verticals")({
  loader: async (): Promise<LoaderData> => {
    const [verticals, tracked] = await Promise.all([
      listVerticals(),
      getTrackedCommunities(),
    ]);
    return { verticals, tracked };
  },
  pendingComponent: LoadingState,
  component: VerticalsPage,
});

// ── Size badge ────────────────────────────────────────────────────────────────

const SIZE_CONFIG: Record<string, { label: string; color: string }> = {
  micro: { label: "micro", color: "#6b7280" },
  niche: { label: "niche", color: "#22c55e" },
  medium: { label: "medium", color: "#60a5fa" },
  large: { label: "large", color: "#f59e0b" },
  mega: { label: "mega", color: "#ef4444" },
};

function SizeBadge({ size }: { size: string }) {
  const cfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.micro!;
  return (
    <span style={{
      fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase",
      padding: "1px 5px", borderRadius: 3,
      background: `${cfg.color}15`,
      color: cfg.color,
      border: `1px solid ${cfg.color}30`,
    }}>
      {cfg.label}
    </span>
  );
}

// ── FitBar ────────────────────────────────────────────────────────────────────

function FitBar({ fit }: { fit: number }) {
  const pct = Math.round(fit * 100);
  const color = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#6b7280";
  return (
    <div title={`Solopreneur fit: ${pct}%`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 36, height: 3, background: "rgba(165,182,214,0.1)", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: "0.58rem", color, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

// ── DensityBar ────────────────────────────────────────────────────────────────

function DensityBar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)", width: 44, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(165,182,214,0.08)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRadius: 3,
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: "0.68rem", color: "var(--fg-muted)", width: 28, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── ChipGroup ─────────────────────────────────────────────────────────────────

function ChipGroup({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {items.map((item) => (
          <span
            key={item}
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              background: color,
              fontSize: "0.71rem",
              color: "var(--fg-muted)",
              border: "1px solid rgba(165,182,214,0.08)",
            }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── VerticalTable ─────────────────────────────────────────────────────────────

const TRUST_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Self-serve", color: "#22c55e" },
  2: { label: "Low", color: "#86efac" },
  3: { label: "Medium", color: "#f59e0b" },
  4: { label: "High", color: "#f97316" },
  5: { label: "Very high", color: "#ef4444" },
};

const SWITCH_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Easy", color: "#22c55e" },
  2: { label: "Low", color: "#86efac" },
  3: { label: "Medium", color: "#f59e0b" },
  4: { label: "High", color: "#f97316" },
  5: { label: "Very high", color: "#ef4444" },
};

type SortCol = "name" | "mrrFloor" | "trustLevel" | "switchingCost";

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span style={{ color: "var(--fg-dim)", fontSize: "0.65rem", marginLeft: 3 }}>↕</span>;
  return <span style={{ color: "var(--accent)", fontSize: "0.65rem", marginLeft: 3 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

function VerticalTable({
  verticals,
  selected,
  onSelect,
  sortCol,
  sortDir,
  onSort,
}: {
  verticals: VerticalDef[];
  selected: VerticalDef | null;
  onSelect: (v: VerticalDef) => void;
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (col: SortCol) => void;
}) {
  const sorted = [...verticals].sort((a, b) => {
    let cmp = 0;
    if (sortCol === "name") cmp = a.name.localeCompare(b.name);
    else if (sortCol === "mrrFloor") cmp = a.mrrFloor - b.mrrFloor;
    else if (sortCol === "trustLevel") cmp = a.trustLevel - b.trustLevel;
    else if (sortCol === "switchingCost") cmp = a.switchingCost - b.switchingCost;
    return sortDir === "asc" ? cmp : -cmp;
  });

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    textAlign: "left",
    fontSize: "0.64rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--fg-dim)",
    background: "var(--bg-elevated)",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  function Th({ col, children }: { col: SortCol; children: React.ReactNode }) {
    return (
      <th style={thStyle} onClick={() => onSort(col)}>
        {children}
        <SortArrow active={sortCol === col} dir={sortDir} />
      </th>
    );
  }

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr>
            <Th col="name">Vertical</Th>
            <th style={thStyle}>Tagline</th>
            <Th col="mrrFloor">MRR range</Th>
            <Th col="trustLevel">Trust needed</Th>
            <Th col="switchingCost">Switching cost</Th>
            <th style={{ ...thStyle, cursor: "default" }}>Seeds</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((v, i) => {
            const isSelected = selected?.slug === v.slug;
            const trust = TRUST_LABELS[v.trustLevel]!;
            const sw = SWITCH_LABELS[v.switchingCost]!;
            return (
              <tr
                key={v.slug}
                onClick={() => onSelect(v)}
                style={{
                  background: isSelected
                    ? "rgba(96,165,250,0.07)"
                    : i % 2 === 0 ? "transparent" : "rgba(165,182,214,0.02)",
                  borderBottom: "1px solid rgba(165,182,214,0.06)",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(165,182,214,0.05)";
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.background =
                    i % 2 === 0 ? "transparent" : "rgba(165,182,214,0.02)";
                }}
              >
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ color: isSelected ? "var(--accent)" : "var(--fg-muted)", flexShrink: 0 }}>
                      <VertIcon name={v.icon} size={14} />
                    </span>
                    <span style={{ fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--fg)" : "var(--fg-muted)" }}>
                      {v.name}
                    </span>
                    {isSelected && (
                      <span style={{ fontSize: "0.6rem", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        selected
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "9px 12px", color: "var(--fg-dim)", fontSize: "0.75rem", maxWidth: 280 }}>
                  {v.tagline}
                </td>
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  <span style={{
                    fontSize: "0.72rem", fontWeight: 600,
                    color: v.mrrFloor >= 1000 ? "#22c55e" : v.mrrFloor >= 500 ? "#86efac" : "var(--fg-subtle)",
                  }}>
                    {v.mrrRange}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  <span style={{
                    fontSize: "0.70rem", fontWeight: 500,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: `${trust.color}18`,
                    color: trust.color,
                    border: `1px solid ${trust.color}30`,
                  }}>
                    {trust.label}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  <span style={{
                    fontSize: "0.70rem", fontWeight: 500,
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: `${sw.color}18`,
                    color: sw.color,
                    border: `1px solid ${sw.color}30`,
                  }}>
                    {sw.label}
                  </span>
                </td>
                <td style={{ padding: "9px 12px", color: "var(--fg-dim)", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                  {v.seedCommunities.length} communities
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Select" },
    { n: 2, label: "Track" },
  ] as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, idx) => {
        const done = step > s.n;
        const active = step === s.n;
        const circleColor = active ? "var(--accent)" : done ? "var(--accent)" : "rgba(165,182,214,0.2)";
        const labelColor = active ? "var(--fg)" : done ? "var(--fg-muted)" : "var(--fg-dim)";
        const labelWeight = active ? 700 : 400;

        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 20, height: 20,
                borderRadius: "50%",
                background: circleColor,
                border: active ? `2px solid var(--accent)` : done ? `2px solid var(--accent)` : "2px solid rgba(165,182,214,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {done ? (
                  <Check size={10} color="var(--bg)" />
                ) : (
                  <span style={{ fontSize: "0.60rem", fontWeight: 700, color: active ? "var(--bg)" : "var(--fg-dim)" }}>
                    {s.n}
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.75rem", fontWeight: labelWeight, color: labelColor }}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{
                width: 24, height: 1,
                background: step > s.n ? "var(--accent)" : "rgba(165,182,214,0.2)",
                margin: "0 8px",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── VerticalsPage ─────────────────────────────────────────────────────────────

function VerticalsPage() {
  const loaderData = Route.useLoaderData();
  const { verticals } = loaderData;

  // Main view state
  const [tracked, setTracked] = useState<TrackedCommunity[]>(loaderData.tracked);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);

  // Table sort + filter
  type TCol = "subreddit" | "vertical" | "size" | "subscribers" | "engagement" | "fit" | "status" | "lastScanned";
  const [tSort, setTSort] = useState<TCol>("fit");
  const [tDir, setTDir] = useState<"asc" | "desc">("desc");
  const [filterText, setFilterText] = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [filterSizes, setFilterSizes] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());

  const SIZE_ORDER: Record<string, number> = { micro: 0, niche: 1, medium: 2, large: 3, mega: 4 };
  const STATUS_ORDER: Record<string, number> = { done: 0, running: 1, idle: 2, failed: 3 };

  const availableVerticals = useMemo(() =>
    [...new Set(tracked.map(c => c.discoveryReason).filter(Boolean) as string[])],
    [tracked]);

  const filteredTracked = useMemo(() => {
    let rows = [...tracked];
    if (filterText) rows = rows.filter(c => c.subreddit.toLowerCase().includes(filterText.toLowerCase()));
    if (filterVertical) rows = rows.filter(c => c.discoveryReason === filterVertical);
    if (filterSizes.size) rows = rows.filter(c => filterSizes.has(c.size));
    if (filterStatuses.size) rows = rows.filter(c => filterStatuses.has(c.scanStatus ?? "idle"));
    rows.sort((a, b) => {
      let cmp = 0;
      if (tSort === "subreddit") cmp = a.subreddit.localeCompare(b.subreddit);
      if (tSort === "vertical") cmp = (a.discoveryReason ?? "").localeCompare(b.discoveryReason ?? "");
      if (tSort === "size") cmp = (SIZE_ORDER[a.size] ?? 0) - (SIZE_ORDER[b.size] ?? 0);
      if (tSort === "subscribers") cmp = (a.subscribers ?? 0) - (b.subscribers ?? 0);
      if (tSort === "engagement") cmp = (a.engagementRatio ?? 0) - (b.engagementRatio ?? 0);
      if (tSort === "fit") cmp = a.fit - b.fit;
      if (tSort === "status") cmp = (STATUS_ORDER[a.scanStatus ?? "idle"] ?? 2) - (STATUS_ORDER[b.scanStatus ?? "idle"] ?? 2);
      if (tSort === "lastScanned") cmp = (a.lastScannedAt?.getTime() ?? 0) - (b.lastScannedAt?.getTime() ?? 0);
      return tDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [tracked, filterText, filterVertical, filterSizes, filterStatuses, tSort, tDir]);

  function handleTSort(col: TCol) {
    if (col === tSort) setTDir(d => d === "asc" ? "desc" : "asc");
    else { setTSort(col); setTDir(col === "subreddit" || col === "vertical" ? "asc" : "desc"); }
  }

  function toggleSizeFilter(s: string) {
    setFilterSizes(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }
  function toggleStatusFilter(s: string) {
    setFilterStatuses(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds(prev =>
      prev.size === tracked.length ? new Set() : new Set(tracked.map(c => c.id))
    );
  }

  async function handleRemoveSelected() {
    if (selectedIds.size === 0) return;
    setRemoving(true);
    try {
      await Promise.all([...selectedIds].map(id =>
        trackCommunity({ data: { id, tracked: false } })
      ));
      setTracked(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
    } finally {
      setRemoving(false);
    }
  }

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  // Vertical selection + sort
  type SortCol = "name" | "mrrFloor" | "trustLevel" | "switchingCost";
  const [sortCol, setSortCol] = useState<SortCol>("mrrFloor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedVertical, setSelectedVertical] = useState<VerticalDef | null>(null);

  // Expand state
  const [expansion, setExpansion] = useState<VerticalExpansion | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);

  // Score state
  const [scoredCommunities, setScoredCommunities] = useState<ScoredCommunity[]>([]);
  const [scoringCommunities, setScoringCommunities] = useState<Set<string>>(new Set());
  const [selectedForTracking, setSelectedForTracking] = useState<Set<string>>(new Set());
  type ScoredSortCol = "subreddit" | "pain" | "subscribers" | "engagement" | "fit";
  const [scoredSortCol, setScoredSortCol] = useState<ScoredSortCol>("fit");
  const [scoredSortDir, setScoredSortDir] = useState<"asc" | "desc">("desc");
  function handleScoredSort(col: ScoredSortCol) {
    if (col === scoredSortCol) setScoredSortDir(d => d === "asc" ? "desc" : "asc");
    else { setScoredSortCol(col); setScoredSortDir(col === "subreddit" ? "asc" : "desc"); }
  }
  const [trackingLoading, setTrackingLoading] = useState(false);

  // ── Wizard helpers ───────────────────────────────────────────────────────────

  function openWizard() {
    setWizardOpen(true);
    setStep(1);
    setSelectedVertical(null);
    setExpansion(null);
    setScoredCommunities([]);
    setSelectedForTracking(new Set());
  }

  function closeWizard() {
    setWizardOpen(false);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleExpand() {
    if (!selectedVertical) return;
    setExpandLoading(true);
    setExpansion(null);
    setScoredCommunities([]);
    try {
      const { expansion: exp } = await expandVertical({ data: { verticalSlug: selectedVertical.slug } });
      setExpansion(exp);
    } catch (err) {
      console.error("[handleExpand]", err);
    } finally {
      setExpandLoading(false);
    }
  }

  async function handleScoreOne(subreddit: string) {
    setScoringCommunities((prev) => new Set(prev).add(subreddit));
    try {
      const results = await scoreCommunities({ data: { subreddits: [subreddit] } });
      setScoredCommunities((prev) => {
        const map = new Map(prev.map((c) => [c.subreddit, c]));
        for (const r of results) map.set(r.subreddit, r);
        return [...map.values()];
      });
    } catch (err) {
      console.error("[handleScoreOne]", err);
    } finally {
      setScoringCommunities((prev) => {
        const next = new Set(prev);
        next.delete(subreddit);
        return next;
      });
    }
  }

  async function handleScoreAll() {
    const allSubs = allCommunities;
    for (const sub of allSubs) {
      if (scoredCommunities.some((c) => c.subreddit === sub && !c.error)) continue;
      await handleScoreOne(sub);
    }
  }

  async function handleTrack() {
    if (selectedForTracking.size === 0) return;
    setTrackingLoading(true);
    try {
      const scoredToTrack = scoredCommunities.filter(c => selectedForTracking.has(c.subreddit));
      const unscoredToTrack = [...selectedForTracking]
        .filter(s => !scoredToTrack.find(c => c.subreddit === s))
        .map(s => ({
          subreddit: s,
          painDensity: 0,
          buyerDensity: 0,
          sampleSize: 0,
          topPatterns: [],
          subscribers: 0,
          activeUsers: 0,
          engagementRatio: 0,
          submissionType: "any",
          size: "micro" as const,
          fit: 0,
        }));

      await trackScannedCommunities({
        data: {
          communities: [...scoredToTrack, ...unscoredToTrack],
          verticalSlug: selectedVertical?.slug,
        },
      });

      const newTracked = await getTrackedCommunities();
      setTracked(newTracked);
      setWizardOpen(false);
      // Reset wizard state
      setStep(1);
      setSelectedVertical(null);
      setExpansion(null);
      setScoredCommunities([]);
      setSelectedForTracking(new Set());
    } catch (err) {
      console.error("[handleTrack]", err);
    } finally {
      setTrackingLoading(false);
    }
  }

  function toggleTrack(subreddit: string) {
    setSelectedForTracking((prev) => {
      const next = new Set(prev);
      if (next.has(subreddit)) {
        next.delete(subreddit);
      } else {
        next.add(subreddit);
      }
      return next;
    });
  }

  // ── allCommunities derivation ────────────────────────────────────────────────

  const allCommunities: string[] = expansion
    ? [...(selectedVertical?.seedCommunities ?? []), ...expansion.communities].filter(
      (s, i, arr) => arr.indexOf(s) === i
    )
    : selectedVertical?.seedCommunities ?? [];

  const communityData = useMemo(() => {
    const data = allCommunities.map((sub) => {
      const scored = scoredCommunities.find((c) => c.subreddit === sub);
      return { sub, scored };
    });
    return [...data].sort((a, b) => {
      const sa = a.scored, sb = b.scored;
      let cmp = 0;
      if (scoredSortCol === "subreddit") cmp = a.sub.localeCompare(b.sub);
      if (scoredSortCol === "pain") cmp = (sa?.painDensity ?? -1) - (sb?.painDensity ?? -1);
      if (scoredSortCol === "subscribers") cmp = (sa?.subscribers ?? -1) - (sb?.subscribers ?? -1);
      if (scoredSortCol === "engagement") cmp = (sa?.engagementRatio ?? -1) - (sb?.engagementRatio ?? -1);
      if (scoredSortCol === "fit") cmp = (sa?.fit ?? -1) - (sb?.fit ?? -1);
      return scoredSortDir === "asc" ? cmp : -cmp;
    });
  }, [allCommunities, scoredCommunities, scoredSortCol, scoredSortDir]);

  // ── Status badge ─────────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: string }) {
    const cfg =
      status === "done" ? { bg: "rgba(34,197,94,0.1)", color: "#22c55e" } :
        status === "running" ? { bg: "rgba(96,165,250,0.1)", color: "var(--accent)" } :
          status === "failed" ? { bg: "rgba(239,68,68,0.1)", color: "#ef4444" } :
            { bg: "rgba(165,182,214,0.06)", color: "var(--fg-dim)" };
    return (
      <span style={{
        fontSize: "0.64rem", fontWeight: 600,
        padding: "1px 6px", borderRadius: 3,
        background: cfg.bg, color: cfg.color,
      }}>
        {status}
      </span>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>

      {/* ── Main view ── */}
      <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 28,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Radar size={20} style={{ color: "var(--accent)" }} />
              <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}>
                Verticals
              </h1>
              <Tooltip
                width={320}
                side="bottom"
                content={
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontWeight: 700, color: "var(--fg)", marginBottom: 2 }}>How Verticals works</div>
                    <div><span style={{ color: "var(--accent)", fontWeight: 600 }}>1. Pick a vertical</span> - choose a B2B market from the table. Sort by MRR range or trust level to find the best fit for a solopreneur.</div>
                    <div><span style={{ color: "var(--accent)", fontWeight: 600 }}>2. Expand</span> - the AI generates the specific communities where your buyers complain: their job titles, the tools they use, and the exact phrases they write when frustrated.</div>
                    <div><span style={{ color: "var(--accent)", fontWeight: 600 }}>3. Score communities</span> - each subreddit is sampled for pain density (% of posts with real complaints), engagement ratio (active users ÷ subscribers), and solopreneur fit (peaks at 2k–30k members).</div>
                    <div><span style={{ color: "var(--accent)", fontWeight: 600 }}>4. Track</span> - selected communities are monitored hourly. Every new post is checked for pain signals and stored. Similar signals cluster together and appear in Opportunities.</div>
                  </div>
                }
              >
                <span style={{ display: "flex", alignItems: "center", cursor: "help", color: "var(--fg-dim)", opacity: 0.5 }}>
                  <HelpCircle size={15} />
                </span>
              </Tooltip>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-muted)" }}>
              Pick a market, score communities, track the best ones
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={openWizard}
            style={{ gap: 6 }}
          >
            <Plus size={13} />
            Add communities
          </Button>
        </div>

        {/* Coverage summary */}
        {tracked.length > 0 && (() => {
          // Group by vertical (discoveryReason = slug)
          const byVertical = new Map<string, number>();
          for (const c of tracked) {
            const key = c.discoveryReason ?? "other";
            byVertical.set(key, (byVertical.get(key) ?? 0) + 1);
          }
          const entries = [...byVertical.entries()].sort((a, b) => b[1] - a[1]);
          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {entries.map(([slug, count]) => {
                const name = VERTICALS.find(v => v.slug === slug)?.name ?? slug;
                const status = count >= 5 ? { label: "good", color: "#22c55e" }
                  : count >= 3 ? { label: "minimal", color: "#f59e0b" }
                    : { label: "too few", color: "#ef4444" };
                return (
                  <div key={slug} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: "var(--radius)",
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    fontSize: "0.74rem",
                  }}>
                    <span style={{ color: "var(--fg-muted)" }}>{name}</span>
                    <span style={{
                      fontSize: "0.64rem", fontWeight: 700,
                      color: status.color,
                      padding: "1px 5px", borderRadius: 3,
                      background: `${status.color}12`,
                      border: `1px solid ${status.color}30`,
                    }}>
                      {count} · {status.label}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: "0.68rem", color: "var(--fg-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: "#22c55e" }}>●</span> ≥5 good
                <span style={{ color: "#f59e0b", marginLeft: 6 }}>●</span> 3–4 minimal
                <span style={{ color: "#ef4444", marginLeft: 6 }}>●</span> &lt;3 too few
              </div>
            </div>
          );
        })()}

        {/* Monitored communities table */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
              Monitored communities
            </span>
            <span style={{
              fontSize: "0.64rem", fontWeight: 700,
              background: tracked.length > 0 ? "rgba(96,165,250,0.12)" : "transparent",
              color: tracked.length > 0 ? "var(--accent)" : "var(--fg-dim)",
              border: `1px solid ${tracked.length > 0 ? "rgba(96,165,250,0.25)" : "var(--border)"}`,
              padding: "1px 7px", borderRadius: 10,
            }}>
              {tracked.length}
            </span>
            {selectedIds.size > 0 && (
              <button
                onClick={handleRemoveSelected}
                disabled={removing}
                style={{
                  marginLeft: 4,
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 4, cursor: removing ? "default" : "pointer",
                  fontSize: "0.72rem", fontWeight: 600,
                  background: "rgba(239,68,68,0.08)", color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.25)",
                  fontFamily: "inherit",
                }}
              >
                {removing
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />Removing…</>
                  : <>Remove {selectedIds.size} selected</>}
              </button>
            )}
          </div>

          {tracked.length === 0 ? (
            <div style={{
              padding: "48px 16px", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.80rem",
              border: "1px dashed var(--border)", borderRadius: "var(--radius)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <span>No communities tracked yet</span>
              <button onClick={openWizard} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: "0.80rem", padding: 0, fontFamily: "inherit" }}>
                Add your first vertical →
              </button>
            </div>
          ) : (
            <>
              {/* Filter bar */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
                {/* Text search */}
                <input
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Search subreddit…"
                  style={{
                    background: "var(--bg-elevated)", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", padding: "4px 10px",
                    color: "var(--fg)", fontSize: "0.76rem", fontFamily: "inherit",
                    outline: "none", width: 160,
                  }}
                />
                {/* Vertical filter */}
                {availableVerticals.length > 1 && (
                  <select
                    value={filterVertical}
                    onChange={e => setFilterVertical(e.target.value)}
                    style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", padding: "4px 8px",
                      color: filterVertical ? "var(--fg)" : "var(--fg-dim)",
                      fontSize: "0.76rem", fontFamily: "inherit", outline: "none", cursor: "pointer",
                    }}
                  >
                    <option value="">All verticals</option>
                    {availableVerticals.map(slug => (
                      <option key={slug} value={slug}>
                        {VERTICALS.find(v => v.slug === slug)?.name ?? slug}
                      </option>
                    ))}
                  </select>
                )}
                {/* Size chips */}
                <div style={{ display: "flex", gap: 4 }}>
                  {["micro", "niche", "medium", "large", "mega"].map(s => {
                    const cfg = SIZE_CONFIG[s]!;
                    const on = filterSizes.has(s);
                    return (
                      <button key={s} onClick={() => toggleSizeFilter(s)} style={{
                        padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit",
                        fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        background: on ? `${cfg.color}18` : "transparent",
                        color: on ? cfg.color : "var(--fg-dim)",
                        border: `1px solid ${on ? `${cfg.color}40` : "var(--border)"}`,
                        transition: "all 0.1s",
                      }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                {/* Status chips */}
                <div style={{ display: "flex", gap: 4 }}>
                  {["idle", "running", "done", "failed"].map(s => {
                    const color = s === "done" ? "#22c55e" : s === "running" ? "var(--accent)" : s === "failed" ? "#ef4444" : "var(--fg-dim)";
                    const on = filterStatuses.has(s);
                    return (
                      <button key={s} onClick={() => toggleStatusFilter(s)} style={{
                        padding: "2px 8px", borderRadius: 3, cursor: "pointer", fontFamily: "inherit",
                        fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                        background: on ? `${color}18` : "transparent",
                        color: on ? color : "var(--fg-dim)",
                        border: `1px solid ${on ? `${color}40` : "var(--border)"}`,
                        transition: "all 0.1s",
                      }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
                {/* Clear filters */}
                {(filterText || filterVertical || filterSizes.size > 0 || filterStatuses.size > 0) && (
                  <button onClick={() => { setFilterText(""); setFilterVertical(""); setFilterSizes(new Set()); setFilterStatuses(new Set()); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-dim)", fontSize: "0.72rem", fontFamily: "inherit", padding: "2px 6px", textDecoration: "underline" }}>
                    Clear
                  </button>
                )}
                {filteredTracked.length < tracked.length && (
                  <span style={{ fontSize: "0.70rem", color: "var(--fg-dim)", marginLeft: 4 }}>
                    {filteredTracked.length} of {tracked.length}
                  </span>
                )}
              </div>

              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-elevated)" }}>
                      {/* Select-all */}
                      <th style={{ padding: "7px 10px 7px 12px", width: 32 }}>
                        <Checkbox
                          checked={selectedIds.size === filteredTracked.length && filteredTracked.length > 0}
                          indeterminate={selectedIds.size > 0 && selectedIds.size < filteredTracked.length}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      {([
                        { col: "subreddit" as TCol, label: "Community" },
                        { col: "vertical" as TCol, label: "Vertical" },
                        { col: "size" as TCol, label: "Size" },
                        { col: "subscribers" as TCol, label: "Members" },
                        { col: null as unknown as TCol, label: "Activity" },
                        { col: "engagement" as TCol, label: "Engagement" },
                        { col: "fit" as TCol, label: "Fit" },
                        { col: "status" as TCol, label: "Status" },
                        { col: "lastScanned" as TCol, label: "Last scanned" },
                      ] as const).map(({ col, label }) => {
                        const active = tSort === col;
                        return (
                          <th
                            key={col}
                            onClick={() => handleTSort(col)}
                            style={{
                              padding: "7px 12px", textAlign: "left", cursor: "pointer",
                              fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: active ? "var(--accent)" : "var(--fg-dim)",
                              whiteSpace: "nowrap", userSelect: "none",
                            }}
                          >
                            <ColLabel label={label} />
                            <span style={{ marginLeft: 3, fontSize: "0.60rem", opacity: active ? 1 : 0.4 }}>
                              {active ? (tDir === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTracked.map((c, i) => {
                      const verticalName = VERTICALS.find(v => v.slug === c.discoveryReason)?.name ?? "-";
                      const isSelected = selectedIds.has(c.id);
                      const tooSmall = (c.subscribers ?? 0) > 0 && (c.subscribers ?? 0) < 1000;
                      return (
                        <tr key={c.id} style={{
                          borderBottom: "1px solid rgba(165,182,214,0.06)",
                          background: isSelected ? "rgba(239,68,68,0.04)" : i % 2 === 0 ? "transparent" : "rgba(165,182,214,0.015)",
                          opacity: tooSmall ? 0.35 : 1,
                          transition: "opacity 0.1s",
                        }}>
                          <td style={{ padding: "8px 10px 8px 12px" }}>
                            <Checkbox checked={isSelected} onChange={() => toggleSelect(c.id)} />
                          </td>
                          <td style={{ padding: "8px 12px" }}>
                            <a href={`https://reddit.com/r/${c.subreddit}`} target="_blank" rel="noopener noreferrer"
                              style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500, fontSize: "0.80rem" }}>
                              r/{c.subreddit}
                            </a>
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: "0.74rem" }}>{verticalName}</td>
                          <td style={{ padding: "8px 12px" }}><SizeBadge size={c.size} /></td>
                          <td style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: "0.74rem", whiteSpace: "nowrap" }}>
                            {c.subscribers != null ? fmt(c.subscribers) : "-"}
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--fg-muted)", fontSize: "0.74rem", whiteSpace: "nowrap" }}>
                            {c.activeUsers != null && c.activeUsers > 0 ? `${Number(c.activeUsers).toFixed(1)}/day` : "-"}
                          </td>
                          <td style={{ padding: "8px 12px", fontSize: "0.72rem", color: "var(--fg-muted)", whiteSpace: "nowrap" }}>
                            {c.engagementRatio != null && c.engagementRatio > 0 ? `${Number(c.engagementRatio).toFixed(2)}/1k` : "-"}
                          </td>
                          <td style={{ padding: "8px 12px" }}><FitBar fit={c.fit} /></td>
                          <td style={{ padding: "8px 12px" }}><StatusBadge status={c.scanStatus} /></td>
                          <td style={{ padding: "8px 12px", color: "var(--fg-dim)", fontSize: "0.70rem", whiteSpace: "nowrap" }}>
                            {relativeTime(c.lastScannedAt)}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTracked.length === 0 && (
                      <tr>
                        <td colSpan={9} style={{ padding: "24px", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.78rem" }}>
                          No communities match the current filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── Backdrop ── */}
      <div
        onClick={() => setWizardOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 199,
          background: "rgba(0,0,0,0.5)",
          opacity: wizardOpen ? 1 : 0,
          pointerEvents: wizardOpen ? "auto" : "none",
          transition: "opacity 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* ── Wizard overlay ── */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "45%",
          zIndex: 200,
          background: "var(--bg)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.25)",
          transform: wizardOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Overlay top bar */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
          gap: 16,
          flexShrink: 0,
        }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={closeWizard}
            style={{ gap: 5, flexShrink: 0 }}
          >
            <ChevronLeft size={14} />
            Back
          </Button>

          <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--fg)", flex: 1 }}>
            Add communities
          </span>

          <Stepper step={step} />
        </div>

        {/* Wizard body */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", maxWidth: 1100, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

          {/* Step 1: Select vertical */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
                  Select a vertical
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--fg-muted)" }}>
                  Click a row to select it and continue to the Expand step.
                </div>
              </div>
              <VerticalTable
                verticals={verticals}
                selected={selectedVertical}
                onSelect={(v) => {
                  setSelectedVertical(v);
                  setExpansion(null);
                  setScoredCommunities([]);
                  setSelectedForTracking(new Set());
                  setStep(2);
                  // Auto-expand immediately
                  setExpandLoading(true);
                  expandVertical({ data: { verticalSlug: v.slug } })
                    .then(({ expansion: exp }) => setExpansion(exp))
                    .catch(console.error)
                    .finally(() => setExpandLoading(false));
                }}
                sortCol={sortCol}
                sortDir={sortDir}
                onSort={(col) => {
                  if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
                  else { setSortCol(col); setSortDir(col === "name" ? "asc" : "desc"); }
                }}
              />
            </div>
          )}

          {/* Step 2: Score & select */}
          {step === 2 && selectedVertical && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {expandLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--radius)", background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.2)", fontSize: "0.78rem", color: "var(--accent)" }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                  Finding communities for {selectedVertical.name}…
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>
                    {selectedVertical.name} - select communities to track
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--fg-muted)" }}>
                    {expandLoading ? "Discovering communities…" : `${allCommunities.length} communities found · score and select which ones to monitor`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScoreAll}
                    disabled={scoringCommunities.size > 0}
                  >
                    {scoringCommunities.size > 0
                      ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Scoring…</>
                      : "Score all"}
                  </Button>
                  {/* Select all scored */}
                  {scoredCommunities.length > 0 && (() => {
                    const scoredSubs = scoredCommunities.filter(c => !c.error).map(c => c.subreddit);
                    const allSelected = scoredSubs.every(s => selectedForTracking.has(s));
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (allSelected) {
                            setSelectedForTracking(new Set());
                          } else {
                            setSelectedForTracking(new Set(scoredSubs));
                          }
                        }}
                      >
                        {allSelected ? "Deselect all" : `Select all scored (${scoredSubs.length})`}
                      </Button>
                    );
                  })()}
                  {selectedForTracking.size > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleTrack}
                      disabled={trackingLoading}
                      style={{ gap: 5 }}
                    >
                      {trackingLoading
                        ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Tracking…</>
                        : <><Check size={12} /> Track selected ({selectedForTracking.size})</>}
                    </Button>
                  )}
                </div>
              </div>

              <div style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}>
                {/* Table header */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "32px 160px 70px 1fr 90px 70px 90px 70px",
                  padding: "7px 12px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-elevated)",
                }}>
                  {/* Select-all */}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <button
                      onClick={() => {
                        if (selectedForTracking.size === allCommunities.length) {
                          setSelectedForTracking(new Set());
                        } else {
                          setSelectedForTracking(new Set(allCommunities));
                        }
                      }}
                      style={{
                        width: 18, height: 18, borderRadius: 3, cursor: "pointer", padding: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: `1px solid ${selectedForTracking.size > 0 ? "var(--accent)" : "var(--border-strong)"}`,
                        background: selectedForTracking.size === allCommunities.length && allCommunities.length > 0
                          ? "var(--accent)" : "transparent",
                      }}
                    >
                      {selectedForTracking.size === allCommunities.length && allCommunities.length > 0
                        ? <Check size={11} color="#050d1e" />
                        : selectedForTracking.size > 0
                          ? <span style={{ width: 8, height: 2, background: "var(--accent)", borderRadius: 1, display: "block" }} />
                          : null}
                    </button>
                  </div>
                  {([
                    { col: "subreddit" as ScoredSortCol, label: "Community" },
                    { col: "fit" as ScoredSortCol, label: "Fit" },
                    { col: null, label: "Pain / Buyer" },
                    { col: "subscribers" as ScoredSortCol, label: "Members" },
                    { col: null as unknown as ScoredSortCol, label: "Activity" },
                    { col: "engagement" as ScoredSortCol, label: "Engagement" },
                    { col: null, label: "Size" },
                  ]).map(({ col, label }) => (
                    <div
                      key={label}
                      onClick={col ? () => handleScoredSort(col) : undefined}
                      style={{
                        fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: col && scoredSortCol === col ? "var(--accent)" : "var(--fg-dim)",
                        cursor: col ? "pointer" : "default",
                        userSelect: "none",
                        display: "flex", alignItems: "center", gap: 3,
                      }}
                    >
                      <ColLabel label={label} />
                      {col && <span style={{ opacity: scoredSortCol === col ? 1 : 0.3, fontSize: "0.60rem" }}>
                        {scoredSortCol === col ? (scoredSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </span>}
                    </div>
                  ))}
                </div>

                {communityData.map(({ sub, scored }) => {
                  const isScoring = scoringCommunities.has(sub);
                  const isSelected = selectedForTracking.has(sub);
                  const tooSmall = scored && !scored.error && scored.subscribers > 0 && scored.subscribers < 1000;

                  return (
                    <div
                      key={sub}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "32px 160px 70px 1fr 90px 70px 90px 70px",
                        alignItems: "center",
                        padding: "9px 12px",
                        borderBottom: "1px solid rgba(165,182,214,0.06)",
                        background: isSelected ? "rgba(96,165,250,0.04)" : "transparent",
                        opacity: (scored && !scored.error && scored.subscribers > 0 && scored.subscribers < 1000) ? 0.3 : 1,
                        transition: "background 0.1s, opacity 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "rgba(165,182,214,0.04)"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      {/* Checkbox */}
                      <Checkbox checked={isSelected} onChange={() => toggleTrack(sub)} />

                      {/* Community name */}
                      <a
                        href={`https://reddit.com/r/${sub}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.80rem", fontWeight: 500,
                          color: "var(--fg)", textDecoration: "none",
                        }}
                      >
                        r/{sub}
                      </a>

                      {/* Fit - primary sort column */}
                      <div>
                        {scored && !scored.error ? <FitBar fit={scored.fit} /> : isScoring ? null : <span style={{ fontSize: "0.70rem", color: "var(--fg-dim)" }}>-</span>}
                      </div>

                      {/* Pain / Buyer bars */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {scored && !scored.error ? (
                          <>
                            <DensityBar value={scored.painDensity} color="#ef4444" label="Pain" />
                            <DensityBar value={scored.buyerDensity} color="#22c55e" label="Buyer" />
                          </>
                        ) : isScoring ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-subtle)", fontSize: "0.72rem" }}>
                            <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
                            Scoring…
                          </div>
                        ) : scored?.error ? (
                          <span style={{ fontSize: "0.70rem", color: "rgba(239,68,68,0.6)" }}>{scored.error}</span>
                        ) : (
                          <span style={{ fontSize: "0.70rem", color: "var(--fg-dim)" }}>-</span>
                        )}
                      </div>

                      {/* Members */}
                      <div style={{ fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                        {scored && !scored.error ? fmt(scored.subscribers) : "-"}
                      </div>

                      {/* Activity (posts/day) */}
                      <div style={{ fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                        {scored && !scored.error ? (scored.activeUsers > 0 ? `${scored.activeUsers.toFixed(1)}/day` : "-") : "-"}
                      </div>

                      {/* Engagement (posts/1k subs/day) */}
                      <div style={{ fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                        {scored && !scored.error ? (scored.engagementRatio > 0 ? `${scored.engagementRatio.toFixed(2)}/1k` : "-") : "-"}
                      </div>

                      {/* Size */}
                      <div>
                        {!scored && !isScoring && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleScoreOne(sub)}
                            style={{ fontSize: "0.70rem", padding: "2px 8px", height: "auto" }}
                          >
                            Score
                          </Button>
                        )}
                        {scored && !scored.error && <SizeBadge size={scored.size} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedForTracking.size > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleTrack}
                    disabled={trackingLoading}
                    style={{ gap: 5 }}
                  >
                    {trackingLoading
                      ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Tracking…</>
                      : <><Check size={12} /> Track selected ({selectedForTracking.size})</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
