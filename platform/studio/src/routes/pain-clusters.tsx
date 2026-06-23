import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Layers, RefreshCw, Play, DollarSign, Zap, RefreshCcw, Search } from "lucide-react";
import { getScoredClusters, runPainClustering } from "~/lib/project-fns";
import type { ScoredCluster, ClusterDimensions } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";

export const Route = createFileRoute("/pain-clusters")({
  component: PainClustersPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Stable color from community name hash */
function communityColor(name: string): { fg: string; border: string } {
  const PALETTE = [
    { fg: "#60a5fa", border: "rgba(96,165,250,0.3)" },
    { fg: "#f472b6", border: "rgba(244,114,182,0.3)" },
    { fg: "#34d399", border: "rgba(52,211,153,0.3)" },
    { fg: "#fb923c", border: "rgba(251,146,60,0.3)" },
    { fg: "#a78bfa", border: "rgba(167,139,250,0.3)" },
    { fg: "#fbbf24", border: "rgba(251,191,36,0.3)" },
    { fg: "#38bdf8", border: "rgba(56,189,248,0.3)" },
    { fg: "#f87171", border: "rgba(248,113,113,0.3)" },
    { fg: "#4ade80", border: "rgba(74,222,128,0.3)" },
    { fg: "#e879f9", border: "rgba(232,121,249,0.3)" },
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const STATUS_CONFIG: Record<string, { label: string; fg: string; bg: string }> = {
  open: { label: "open", fg: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  building: { label: "building", fg: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
  built: { label: "built", fg: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  killed: { label: "killed", fg: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

// ── Card ──────────────────────────────────────────────────────────────────────

function DimBadge({ active, label, title }: { active: boolean; label: string; title: string }) {
  return (
    <span
      title={title}
      style={{
        fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "1px 5px", borderRadius: 3,
        border: `1px solid ${active ? "rgba(96,165,250,0.4)" : "rgba(165,182,214,0.12)"}`,
        background: active ? "rgba(96,165,250,0.1)" : "transparent",
        color: active ? "var(--accent)" : "rgba(165,182,214,0.25)",
        transition: "all 0.15s",
        cursor: "default",
      }}
    >
      {label}
    </span>
  );
}

function ConfBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 50 ? "#22c55e" : pct >= 25 ? "#f59e0b" : "#6b7280";
  return (
    <div title={`Confidence: ${pct}%`} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 48, height: 3, background: "rgba(165,182,214,0.12)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: "0.60rem", color, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

function ClusterCard({ cluster }: { cluster: ScoredCluster }) {
  const isCross = (cluster.communities?.length ?? 0) > 1;
  const statusCfg = STATUS_CONFIG[cluster.status ?? "open"] ?? STATUS_CONFIG.open;
  const quotes = cluster.themeJson?.exampleQuotes ?? [];

  return (
    <div
      style={{
        padding: "18px 20px",
        borderBottom: "1px solid var(--border)",
        borderLeft: isCross ? "2px solid var(--accent)" : "2px solid transparent",
        background: isCross ? "rgba(96,165,250,0.03)" : "transparent",
        transition: "background 0.15s",
      }}
      className="cluster-card"
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.3 }}>
              {cluster.theme}
            </span>
            {isCross && (
              <span style={{
                fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "#60a5fa",
                border: "1px solid rgba(96,165,250,0.4)", borderRadius: 3,
                padding: "1px 5px",
              }}>
                cross-community
              </span>
            )}
          </div>

          {/* Communities */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {(cluster.communities ?? []).map(c => {
              const col = communityColor(c);
              return (
                <span key={c} style={{
                  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: col.fg, border: `1px solid ${col.border}`,
                  padding: "1px 6px", borderRadius: 3,
                }}>
                  r/{c}
                </span>
              );
            })}
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <span style={{
            fontSize: "0.68rem", fontWeight: 600,
            color: statusCfg.fg, background: statusCfg.bg,
            padding: "2px 8px", borderRadius: 4,
          }}>
            {statusCfg.label}
          </span>
          <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", textAlign: "right" }}>
            <span style={{ color: "var(--fg-muted)" }}>{cluster.signalCount}</span>
            <span style={{ opacity: 0.5 }}> signals</span>
          </div>
          {cluster.avgAuthenticityScore > 0 && (
            <div style={{ fontSize: "0.68rem", color: "var(--fg-subtle)" }}>
              auth <span style={{ color: cluster.avgAuthenticityScore >= 7 ? "#22c55e" : "var(--fg-muted)" }}>
                {cluster.avgAuthenticityScore.toFixed(1)}
              </span>
            </div>
          )}
          <ConfBar score={cluster.dims.confidenceScore} />
        </div>
      </div>

      {/* Dimension badges */}
      <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
        <DimBadge
          active={cluster.dims.spendScore >= 0.25}
          label="💰 Spend"
          title={`Existing spend evidence: ${Math.round(cluster.dims.spendScore * 100)}%${cluster.dims.spendSamples[0] ? ` - "${cluster.dims.spendSamples[0]}"` : ""}`}
        />
        <DimBadge
          active={cluster.dims.painScore >= 0.35}
          label="⚡ Pain"
          title={`Validated pain score: ${Math.round(cluster.dims.painScore * 100)}% - ${cluster.signalCount} signals across ${cluster.communities?.length ?? 1} communit${(cluster.communities?.length ?? 1) > 1 ? "ies" : "y"}`}
        />
        <DimBadge
          active={cluster.dims.workflowScore >= 0.25}
          label="↻ Workflow"
          title={`Recurring workflow language: ${Math.round(cluster.dims.workflowScore * 100)}%${cluster.dims.workflowSamples[0] ? ` - "${cluster.dims.workflowSamples[0]}"` : ""}`}
        />
        <DimBadge
          active={cluster.dims.demandScore >= 0.25}
          label="◎ Demand"
          title={`Active demand signals: ${Math.round(cluster.dims.demandScore * 100)}%`}
        />
        {cluster.dims.hitAll && (
          <span style={{
            fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.08em",
            textTransform: "uppercase", padding: "1px 6px", borderRadius: 3,
            background: "rgba(251,191,36,0.15)", color: "#fbbf24",
            border: "1px solid rgba(251,191,36,0.35)",
          }}>
            ⭐ High confidence
          </span>
        )}
      </div>

      {/* Description */}
      {cluster.description && (
        <p style={{
          margin: "0 0 10px",
          fontSize: "0.78rem",
          color: "var(--fg-muted)",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
        }}>
          {cluster.description}
        </p>
      )}

      {/* Example quotes */}
      {quotes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {quotes.slice(0, 2).map((q, i) => (
            <div key={i} style={{
              borderLeft: "2px solid var(--border-strong)",
              paddingLeft: 10,
              marginBottom: 4,
              fontSize: "0.74rem",
              color: "var(--fg-subtle)",
              fontStyle: "italic",
              lineHeight: 1.45,
            }}>
              &ldquo;{q.length > 200 ? q.slice(0, 200) + "…" : q}&rdquo;
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link
          to="/ideas"
          search={{ clusterId: cluster.id } as Record<string, unknown>}
          style={{
            fontSize: "0.74rem",
            color: "var(--accent)",
            textDecoration: "none",
            borderBottom: "1px solid rgba(96,165,250,0.3)",
            paddingBottom: 1,
          }}
        >
          Create Idea
        </Link>
        <span style={{ color: "var(--border-strong)" }}>›</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type FilterKey = "all" | "cross" | "highconf" | "spend" | "workflow" | "demand";

export default function PainClustersPage() {
  const [clusters, setClusters] = useState<ScoredCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ clustersCreated: number; clustersUpdated: number; signalsAssigned: number } | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getScoredClusters();
      setClusters(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    switch (filter) {
      case "cross": return clusters.filter(c => (c.communities?.length ?? 0) > 1);
      case "highconf": return clusters.filter(c => c.dims.hitAll);
      case "spend": return clusters.filter(c => c.dims.spendScore >= 0.25);
      case "workflow": return clusters.filter(c => c.dims.workflowScore >= 0.25);
      case "demand": return clusters.filter(c => c.dims.demandScore >= 0.25);
      default: return clusters;
    }
  }, [clusters, filter]);

  async function handleRunClustering() {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runPainClustering({ data: {} });
      setRunResult(result);
      await load();
    } finally {
      setRunning(false);
    }
  }

  const crossCount = clusters.filter(c => (c.communities?.length ?? 0) > 1).length;
  const highConfCount = clusters.filter(c => c.dims.hitAll).length;
  const spendCount = clusters.filter(c => c.dims.spendScore >= 0.25).length;
  const workflowCount = clusters.filter(c => c.dims.workflowScore >= 0.25).length;
  const demandCount = clusters.filter(c => c.dims.demandScore >= 0.25).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Layers size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Pain Clusters</h1>
          </div>
          <span style={{ fontSize: "0.80rem", color: "var(--fg-subtle)" }}>
            {clusters.length} clusters
          </span>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {runResult && (
              <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)" }}>
                +{runResult.clustersCreated} created, {runResult.clustersUpdated} merged, {runResult.signalsAssigned} signals
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={load}
              disabled={loading}
              style={{ gap: 4 }}
            >
              <RefreshCw size={12} style={{ animation: loading ? "bd-spin 0.8s linear infinite" : "none" }} />
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunClustering}
              disabled={running}
              style={{ gap: 4 }}
            >
              <Play size={11} />
              {running ? "Clustering…" : "Run Clustering"}
            </Button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          {([
            { key: "all" as FilterKey, label: "All", count: clusters.length, color: undefined },
            { key: "highconf" as FilterKey, label: "⭐ All three", count: highConfCount, color: "#fbbf24" },
            { key: "cross" as FilterKey, label: "Cross-community", count: crossCount, color: undefined },
            { key: "spend" as FilterKey, label: "💰 Existing spend", count: spendCount, color: "#22c55e" },
            { key: "workflow" as FilterKey, label: "↻ Workflow", count: workflowCount, color: "#60a5fa" },
            { key: "demand" as FilterKey, label: "◎ Demand", count: demandCount, color: "#f59e0b" },
          ]).map(({ key, label, count, color }) => {
            const active = filter === key;
            const ac = color ?? "var(--accent)";
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "3px 10px", borderRadius: 4, border: "1px solid",
                  borderColor: active ? ac : "var(--border-strong)",
                  background: active ? `${ac}18` : "transparent",
                  color: active ? ac : "var(--fg-subtle)",
                  fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.1s",
                }}
              >
                {label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Column header */}
        <div style={{
          padding: "0 20px 8px",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "var(--fg-subtle)",
        }}>
          Theme / Communities / Signals
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>
            Loading clusters…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <Layers size={28} style={{ color: "var(--border-strong)", marginBottom: 12 }} />
            <div style={{ fontSize: "0.88rem", color: "var(--fg-subtle)", marginBottom: 6 }}>
              {clusters.length === 0
                ? "Run clustering to find cross-community pain patterns"
                : "No clusters match this filter"}
            </div>
            {clusters.length === 0 && (
              <div style={{ fontSize: "0.76rem", color: "rgba(165,182,214,0.4)" }}>
                Needs signals with authenticity score ≥ 6
              </div>
            )}
          </div>
        ) : (
          filtered.map(c => <ClusterCard key={c.id} cluster={c} />)
        )}
      </div>
    </div>
  );
}
