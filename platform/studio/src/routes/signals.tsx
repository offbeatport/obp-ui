import { createFileRoute, Link } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getAllSignals } from "~/lib/server-fns";
import type { SignalRow } from "~/lib/server-fns";
import { scoreAllUnscoredSignals } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import { ExternalLink, Search, X, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/signals")({
  component: SignalsPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, { fg: string; border: string }> = {
  reddit: { fg: "#ff6314", border: "rgba(255,99,20,0.3)" },
  hn: { fg: "#e17b3c", border: "rgba(225,123,60,0.3)" },
  github: { fg: "#58a6ff", border: "rgba(88,166,255,0.3)" },
  stackoverflow: { fg: "#f48024", border: "rgba(244,128,36,0.3)" },
  trustpilot: { fg: "#00b67a", border: "rgba(0,182,122,0.3)" },
  devto: { fg: "#3b49df", border: "rgba(59,73,223,0.3)" },
  bluesky: { fg: "#0085ff", border: "rgba(0,133,255,0.3)" },
  mastodon: { fg: "#6364ff", border: "rgba(99,100,255,0.3)" },
  ph: { fg: "#cc4d29", border: "rgba(204,77,41,0.3)" },
  ih: { fg: "#4f46e5", border: "rgba(79,70,229,0.3)" },
  lobsters: { fg: "#ac130d", border: "rgba(172,19,13,0.3)" },
  jobs: { fg: "#a78bfa", border: "rgba(167,139,250,0.3)" },
  firefox: { fg: "#ff9500", border: "rgba(255,149,0,0.3)" },
  edgar: { fg: "#6b7280", border: "rgba(107,114,128,0.3)" },
  youtube: { fg: "#ff0000", border: "rgba(255,0,0,0.3)" },
  lemmy: { fg: "#00c2cb", border: "rgba(0,194,203,0.3)" },
  community: { fg: "#6b7280", border: "rgba(107,114,128,0.3)" },
};

const STATUS_CONFIG = {
  selected: { label: "Selected", bg: "rgba(0,255,136,0.12)", fg: "var(--accent)", dot: "var(--accent)" },
  filtered: { label: "Filtered", bg: "rgba(251,191,36,0.1)", fg: "rgba(251,191,36,0.85)", dot: "#fbbf24" },
  pending: { label: "Pending", bg: "rgba(165,182,214,0.08)", fg: "rgba(165,182,214,0.5)", dot: "rgba(165,182,214,0.4)" },
};

const ALL_SOURCES = [
  "reddit", "hn", "github", "stackoverflow", "trustpilot", "devto", "bluesky",
  "mastodon", "ph", "ih", "lobsters", "jobs", "firefox", "edgar",
  "youtube", "lemmy", "community", "twitter", "upwork", "podcast", "regulatory",
];

// ── Type augmentation for quality fields ──────────────────────────────────────
// getAllSignals returns SignalRow; we track quality separately via a map
type QualityMap = Record<number, {
  authenticityScore: number | null;
  posterIntent: "buyer" | "seller" | "unclear" | null;
  intentSignals: string[] | null;
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(d: Date | string | null | undefined) {
  if (!d) return "-";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "1d ago";
  return `${diff}d ago`;
}

function intentColor(intent: "buyer" | "seller" | "unclear" | null): { bg: string; fg: string; border: string } {
  if (intent === "buyer") return { bg: "rgba(34,197,94,0.12)", fg: "#22c55e", border: "rgba(34,197,94,0.3)" };
  if (intent === "seller") return { bg: "rgba(239,68,68,0.12)", fg: "#ef4444", border: "rgba(239,68,68,0.3)" };
  return { bg: "rgba(251,191,36,0.08)", fg: "rgba(251,191,36,0.75)", border: "rgba(251,191,36,0.25)" };
}

function scoreColor(score: number | null): string {
  if (score === null) return "rgba(165,182,214,0.3)";
  if (score >= 7) return "#22c55e";
  if (score >= 5) return "#fbbf24";
  return "#ef4444";
}

// ── Expanded text popover ─────────────────────────────────────────────────────

function TextCell({ text, url }: { text: string; url: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 440) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;

  return (
    <span ref={ref}>
      <span
        onClick={toggle}
        style={{ cursor: "pointer", color: "var(--fg-muted)", fontSize: "0.78rem", lineHeight: 1.4 }}
        title="Click to expand"
      >
        {preview}
      </span>
      {open && pos && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            width: 430, maxHeight: 320, zIndex: 9999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <span style={{ flex: 1, fontSize: "0.68rem", color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</span>
            <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", flexShrink: 0 }}><ExternalLink size={12} /></a>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} style={{ padding: 0, height: "auto", color: "var(--fg-subtle)" }}><X size={12} /></Button>
          </div>
          <div style={{ padding: "10px 12px", overflowY: "auto", fontSize: "0.80rem", color: "var(--fg-muted)", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {text}
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}

// ── Quality badge ─────────────────────────────────────────────────────────────

function QualityBadge({
  score,
  intent,
  intentSignals,
}: {
  score: number | null;
  intent: "buyer" | "seller" | "unclear" | null;
  intentSignals: string[] | null;
}) {
  const [tipOpen, setTipOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (tipOpen) { setTipOpen(false); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 260) });
    setTipOpen(true);
  }

  useEffect(() => {
    if (!tipOpen) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setTipOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tipOpen]);

  if (score === null) {
    return (
      <span style={{
        fontSize: "0.62rem", color: "rgba(165,182,214,0.3)",
        fontFamily: "monospace", letterSpacing: "0.04em",
      }}>
        -
      </span>
    );
  }

  const ic = intentColor(intent);

  return (
    <div ref={ref} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span
        onClick={handleClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "1px 6px", borderRadius: 3,
          background: ic.bg, border: `1px solid ${ic.border}`,
          cursor: intentSignals?.length ? "pointer" : "default",
        }}
        title={intent ?? undefined}
      >
        <span style={{ fontSize: "0.62rem", fontWeight: 700, color: scoreColor(score), fontFamily: "monospace" }}>
          {score}
        </span>
        <span style={{ fontSize: "0.58rem", color: ic.fg, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {intent === "buyer" ? "buyer" : intent === "seller" ? "seller" : "?"}
        </span>
      </span>
      {tipOpen && pos && intentSignals && intentSignals.length > 0 && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            width: 250, zIndex: 9999,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "0.64rem", color: "var(--fg-subtle)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Intent signals
          </div>
          <ul style={{ margin: 0, padding: "0 0 0 14px", listStyle: "disc" }}>
            {intentSignals.map((s, i) => (
              <li key={i} style={{ fontSize: "0.72rem", color: "var(--fg-muted)", lineHeight: 1.5, marginBottom: 2 }}>{s}</li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SignalsPage() {
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ processed: number; errors: number } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "selected" | "filtered" | "pending">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<"all" | "buyer" | "seller" | "unclear">("all");
  const [minScoreFilter, setMinScoreFilter] = useState<"all" | "7" | "9">("all");

  // Quality data keyed by signal id
  const qualityMap = useMemo<QualityMap>(() => {
    const map: QualityMap = {};
    for (const r of rows) {
      map[r.id] = {
        authenticityScore: r.authenticityScore,
        posterIntent: r.posterIntent,
        intentSignals: r.intentSignals,
      };
    }
    return map;
  }, [rows]);

  const load = useCallback(async () => {
    setLoading(true);
    setScoreResult(null);
    try {
      const data = await getAllSignals({ data: { limit: 5000 } });
      setRows(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleScoreAll() {
    setScoring(true);
    setScoreResult(null);
    try {
      const result = await scoreAllUnscoredSignals({ data: undefined });
      setScoreResult(result);
      // Reload to get updated scores
      await load();
    } catch (e) {
      console.error("Scoring failed:", e);
    } finally {
      setScoring(false);
    }
  }

  const projects = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const r of rows) {
      const key = String(r.projectId ?? "");
      if (r.projectName && !seen.has(key)) { seen.add(key); out.push({ id: key, name: r.projectName }); }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== "all") out = out.filter(r => r.status === statusFilter);
    if (sourceFilter !== "all") out = out.filter(r => r.source === sourceFilter);
    if (projectFilter !== "all") out = out.filter(r => String(r.projectId ?? "") === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(r => r.rawText.toLowerCase().includes(q) || r.url.toLowerCase().includes(q) || (r.opportunityTitle ?? "").toLowerCase().includes(q));
    }
    if (intentFilter !== "all") {
      out = out.filter(r => {
        const q = qualityMap[r.id];
        return q?.posterIntent === intentFilter;
      });
    }
    if (minScoreFilter !== "all") {
      const min = Number(minScoreFilter);
      out = out.filter(r => {
        const q = qualityMap[r.id];
        return q?.authenticityScore !== null && q?.authenticityScore !== undefined && q.authenticityScore >= min;
      });
    }
    return out;
  }, [rows, statusFilter, sourceFilter, projectFilter, search, intentFilter, minScoreFilter, qualityMap]);

  // Counts for status pills
  const counts = useMemo(() => ({
    all: rows.length,
    selected: rows.filter(r => r.status === "selected").length,
    filtered: rows.filter(r => r.status === "filtered").length,
    pending: rows.filter(r => r.status === "pending").length,
  }), [rows]);

  const unscoredCount = useMemo(() =>
    rows.filter(r => qualityMap[r.id]?.authenticityScore === null).length,
    [rows, qualityMap]
  );

  // Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 20,
  });

  const COL_WIDTHS = { status: 100, source: 110, text: "auto", filterStep: 160, quality: 100, project: 120, scraped: 80, url: 40 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Signals</h1>
          <span style={{ fontSize: "0.80rem", color: "var(--fg-subtle)" }}>{rows.length.toLocaleString()} total</span>
          {unscoredCount > 0 && (
            <span style={{ fontSize: "0.72rem", color: "rgba(251,191,36,0.7)" }}>
              {unscoredCount.toLocaleString()} unscored
            </span>
          )}

          {/* Score all button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleScoreAll}
            disabled={scoring || loading}
            style={{ marginLeft: 8, gap: 4, color: scoring ? "var(--fg-subtle)" : "#60a5fa" }}
          >
            <Zap size={11} style={{ animation: scoring ? "bd-spin 0.8s linear infinite" : "none" }} />
            {scoring ? "Scoring…" : "Score all"}
          </Button>

          {scoreResult && (
            <span style={{ fontSize: "0.72rem", color: "rgba(34,197,94,0.8)" }}>
              Scored {scoreResult.processed}{scoreResult.errors > 0 ? `, ${scoreResult.errors} errors` : ""}
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            style={{ marginLeft: "auto", gap: 4 }}
          >
            <RefreshCw size={12} style={{ animation: loading ? "bd-spin 0.8s linear infinite" : "none" }} />
            {loading ? "Loading…" : "Refresh"}
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 4 }}>
            {(["all", "selected", "filtered", "pending"] as const).map(s => {
              const cfg = s === "all" ? null : STATUS_CONFIG[s];
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "3px 10px", borderRadius: 4, border: "1px solid",
                    borderColor: active ? (cfg?.dot ?? "var(--accent)") : "var(--border-strong)",
                    background: active ? (cfg?.bg ?? "rgba(165,182,214,0.08)") : "transparent",
                    color: active ? (cfg?.fg ?? "var(--fg)") : "var(--fg-subtle)",
                    fontSize: "0.76rem", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {s === "all" ? "All" : STATUS_CONFIG[s].label} <span style={{ opacity: 0.6 }}>{counts[s].toLocaleString()}</span>
                </button>
              );
            })}
          </div>

          {/* Intent filter */}
          <div style={{ display: "flex", gap: 3 }}>
            {(["all", "buyer", "seller", "unclear"] as const).map(v => {
              const active = intentFilter === v;
              const ic = v === "buyer"
                ? { fg: "#22c55e", border: "rgba(34,197,94,0.4)", bg: "rgba(34,197,94,0.1)" }
                : v === "seller"
                  ? { fg: "#ef4444", border: "rgba(239,68,68,0.4)", bg: "rgba(239,68,68,0.1)" }
                  : v === "unclear"
                    ? { fg: "rgba(251,191,36,0.75)", border: "rgba(251,191,36,0.3)", bg: "rgba(251,191,36,0.08)" }
                    : { fg: "var(--fg-subtle)", border: "var(--border-strong)", bg: "transparent" };
              return (
                <button
                  key={v}
                  onClick={() => setIntentFilter(v)}
                  style={{
                    padding: "3px 9px", borderRadius: 4, border: "1px solid",
                    borderColor: active ? ic.border : "var(--border-strong)",
                    background: active ? ic.bg : "transparent",
                    color: active ? ic.fg : "var(--fg-subtle)",
                    fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                    textTransform: v === "all" ? "none" : "capitalize",
                  }}
                >
                  {v === "all" ? "Any intent" : v}
                </button>
              );
            })}
          </div>

          {/* Min score filter */}
          <div style={{ display: "flex", gap: 3 }}>
            {([
              { val: "all", label: "Any score" },
              { val: "7", label: "Buyers ≥7" },
              { val: "9", label: "High ≥9" },
            ] as const).map(({ val, label }) => {
              const active = minScoreFilter === val;
              return (
                <button
                  key={val}
                  onClick={() => setMinScoreFilter(val)}
                  style={{
                    padding: "3px 9px", borderRadius: 4, border: "1px solid",
                    borderColor: active ? "rgba(96,165,250,0.5)" : "var(--border-strong)",
                    background: active ? "rgba(96,165,250,0.1)" : "transparent",
                    color: active ? "#60a5fa" : "var(--fg-subtle)",
                    fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Source filter */}
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            style={{ height: 26, padding: "0 8px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-strong)", borderRadius: 4, color: "var(--fg-muted)", fontSize: "0.76rem", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
          >
            <option value="all">All sources</option>
            {ALL_SOURCES.filter(s => rows.some(r => r.source === s)).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Project filter */}
          {projects.length > 1 && (
            <select
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              style={{ height: 26, padding: "0 8px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-strong)", borderRadius: 4, color: "var(--fg-muted)", fontSize: "0.76rem", fontFamily: "inherit", cursor: "pointer", outline: "none" }}
            >
              <option value="all">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 200, maxWidth: 360, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "0 8px" }}>
            <Search size={11} style={{ color: "var(--fg-subtle)", flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search text or URL…"
              style={{ background: "none", border: "none", outline: "none", fontSize: "0.76rem", color: "var(--fg)", width: "100%", fontFamily: "inherit", height: 26 }}
            />
            {search && <Button variant="ghost" size="sm" onClick={() => setSearch("")} style={{ padding: 0, height: "auto", color: "var(--fg-subtle)" }}><X size={10} /></Button>}
          </div>

          <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", marginLeft: "auto" }}>
            {filtered.length.toLocaleString()} shown
          </span>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: `${COL_WIDTHS.status}px ${COL_WIDTHS.source}px 1fr ${COL_WIDTHS.filterStep}px ${COL_WIDTHS.quality}px ${COL_WIDTHS.project}px ${COL_WIDTHS.scraped}px ${COL_WIDTHS.url}px`,
          gap: "0 16px", padding: "0 16px 8px",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--fg-subtle)",
        }}>
          <span>Status</span>
          <span>Source</span>
          <span>Text</span>
          <span>Pipeline step</span>
          <span>Quality</span>
          <span>Project</span>
          <span>Scraped</span>
          <span></span>
        </div>
      </div>

      {/* Virtualized body */}
      <div ref={parentRef} style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>Loading signals…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>No signals match your filters.</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map(vItem => {
              const row = filtered[vItem.index];
              const sc = SOURCE_COLORS[row.source] ?? { fg: "#888", border: "rgba(128,128,128,0.3)" };
              const st = STATUS_CONFIG[row.status];
              const q = qualityMap[row.id];
              return (
                <div
                  key={row.id}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  className="signal-row"
                  style={{
                    position: "absolute", top: vItem.start, left: 0, right: 0,
                    display: "grid",
                    gridTemplateColumns: `${COL_WIDTHS.status}px ${COL_WIDTHS.source}px 1fr ${COL_WIDTHS.filterStep}px ${COL_WIDTHS.quality}px ${COL_WIDTHS.project}px ${COL_WIDTHS.scraped}px ${COL_WIDTHS.url}px`,
                    gap: "0 16px", padding: "10px 16px",
                    borderBottom: "1px solid var(--border)",
                    alignItems: "start",
                    background: "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  {/* Status */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.72rem", color: st.fg }}>{st.label}</span>
                  </div>

                  {/* Source */}
                  <div>
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                      color: sc.fg, border: `1px solid ${sc.border}`, padding: "1px 6px", borderRadius: 3,
                    }}>
                      {row.source}
                    </span>
                  </div>

                  {/* Text */}
                  <div style={{ minWidth: 0 }}>
                    <TextCell text={row.rawText} url={row.url} />
                    {row.opportunityTitle && (
                      <div style={{ marginTop: 3, fontSize: "0.68rem", color: "var(--accent)" }}>
                        → <Link to="/opportunity/$id" params={{ id: String(row.opportunityId) }} style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {row.opportunityTitle}
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Pipeline step */}
                  <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", paddingTop: 2 }}>
                    {row.status === "selected" ? (
                      <span style={{ color: "var(--accent)" }}>Into opportunity</span>
                    ) : row.status === "pending" ? (
                      <span style={{ color: "rgba(165,182,214,0.4)" }}>Awaiting processing</span>
                    ) : (
                      <span style={{ color: "rgba(251,191,36,0.7)" }}>{row.filterStep}</span>
                    )}
                  </div>

                  {/* Quality badge */}
                  <div style={{ paddingTop: 2 }}>
                    <QualityBadge
                      score={q?.authenticityScore ?? null}
                      intent={q?.posterIntent ?? null}
                      intentSignals={q?.intentSignals ?? null}
                    />
                  </div>

                  {/* Project */}
                  <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", paddingTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.projectName ?? "-"}
                  </div>

                  {/* Scraped */}
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.28)", paddingTop: 2 }}>
                    {daysAgo(row.scrapedAt)}
                  </div>

                  {/* URL link */}
                  <div style={{ paddingTop: 2 }}>
                    <a href={row.url} target="_blank" rel="noreferrer" style={{ color: "rgba(165,182,214,0.4)" }} title={row.url}>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
