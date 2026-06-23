import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import {
  getDiscoveryProfile,
  getDiscoveredCommunities,
  saveDiscoveryProfile,
  addCommunityToQueue,
  trackCommunity,
  triggerDiscoveredCommunityAnalysis,
  getDiscoveredCommunity,
  searchForPain,
  getRecentPainSessions,
} from "~/lib/project-fns";
import type {
  DiscoveryProfile,
  DiscoveredCommunity,
  PainSearchResult,
  PainSignalPost,
  CommunityDistribution,
  PainSearchSession,
} from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import {
  Search,
  Zap,
  BarChart2,
  ArrowRight,
  Plus,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

// ── Loader data type ──────────────────────────────────────────────────────────

type LoaderData = {
  profile: DiscoveryProfile | null;
  queue: DiscoveredCommunity[];
  recentSessions: PainSearchSession[];
};

export const Route = createFileRoute("/discovery")({
  loader: async (): Promise<LoaderData> => {
    const [profile, recentSessions, queue] = await Promise.all([
      getDiscoveryProfile(),
      getRecentPainSessions(),
      getDiscoveredCommunities(),
    ]);
    return { profile, recentSessions, queue: queue.filter(c => c.tracked) };
  },
  staleTime: 0,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DiscoveryPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function postAgeFmt(utc: number): string {
  if (!utc) return "-";
  const secs = Date.now() / 1000 - utc;
  const hours = secs / 3600;
  if (hours < 1) return `${Math.floor(secs / 60)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sessionAgeFmt(d: Date): string {
  const secs = (Date.now() - new Date(d).getTime()) / 1000;
  const hours = secs / 3600;
  if (hours < 1) return `${Math.floor(secs / 60)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function distributionColor(label: string): string {
  if (label.startsWith("Open")) return "#22c55e";
  if (label.startsWith("Text posts")) return "#63b3ff";
  if (label.startsWith("Links only")) return "#f59e0b";
  if (label.startsWith("Too small")) return "rgba(165,182,214,0.4)";
  if (label.includes("large")) return "#f97316";
  return "rgba(165,182,214,0.5)";
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ value, max = 10, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const c = color ?? (pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 4, background: "rgba(100,130,180,0.15)", borderRadius: 2, minWidth: 40 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: c, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: "0.68rem", fontVariantNumeric: "tabular-nums", color: "var(--fg-subtle)", minWidth: 16, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Distribution Badge ────────────────────────────────────────────────────────

function DistBadge({ label }: { label: string }) {
  const color = distributionColor(label);
  const shortLabel = label.replace(" (very large)", "").replace("Text posts", "Text");
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 7px",
      borderRadius: 8,
      fontSize: "0.62rem",
      fontWeight: 600,
      background: `${color}18`,
      color,
      border: `1px solid ${color}40`,
      whiteSpace: "nowrap",
    }}>
      {shortLabel}
    </span>
  );
}

// ── Signals Table ─────────────────────────────────────────────────────────────

type SortKey = "painScore" | "score" | "numComments" | "createdUtc" | "distributionScore" | "subreddit";

function SignalsTable({
  signals,
  communities,
  queueSubreddits,
  onAdd,
}: {
  signals: PainSignalPost[];
  communities: CommunityDistribution[];
  queueSubreddits: Set<string>;
  onAdd: (sub: string, subscribers: number) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("painScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [textFilter, setTextFilter] = useState("");
  const [distFilter, setDistFilter] = useState<"all" | "open" | "text" | "nolinks">("all");
  const [minPain, setMinPain] = useState(0);

  const communityMap = new Map<string, CommunityDistribution>();
  for (const c of communities) communityMap.set(c.subreddit.toLowerCase(), c);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sorted = [...signals]
    .filter(s => {
      if (textFilter && !s.title.toLowerCase().includes(textFilter.toLowerCase())) return false;
      if (s.painScore < minPain) return false;
      if (distFilter !== "all") {
        const c = communityMap.get(s.subreddit.toLowerCase());
        if (!c) return false;
        if (distFilter === "open" && c.submissionType !== "any") return false;
        if (distFilter === "text" && c.submissionType !== "self") return false;
        if (distFilter === "nolinks" && c.submissionType === "link") return false;
      }
      return true;
    })
    .sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "subreddit") {
        return sortDir === "asc" ? a.subreddit.localeCompare(b.subreddit) : b.subreddit.localeCompare(a.subreddit);
      }
      if (sortKey === "distributionScore") {
        av = communityMap.get(a.subreddit.toLowerCase())?.distributionScore ?? 0;
        bv = communityMap.get(b.subreddit.toLowerCase())?.distributionScore ?? 0;
      } else {
        av = a[sortKey as keyof PainSignalPost] as number;
        bv = b[sortKey as keyof PainSignalPost] as number;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const thStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: "0.58rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "rgba(165,182,214,0.4)",
    borderBottom: "1px solid var(--border)",
    background: "rgba(100,130,180,0.03)",
    textAlign: "left",
    whiteSpace: "nowrap",
    userSelect: "none" as const,
    cursor: "pointer",
  };
  const cellStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: "0.75rem",
    color: "var(--fg)",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  function SortIcon({ k }: { k: SortKey }) {
    if (k !== sortKey) return <span style={{ opacity: 0.2, fontSize: "0.58rem", marginLeft: 3 }}>▲▼</span>;
    return <span style={{ fontSize: "0.58rem", marginLeft: 3 }}>{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  const filterBtn = (active: boolean): React.CSSProperties => ({
    fontSize: "0.67rem",
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 10,
    cursor: "pointer",
    border: "1px solid",
    background: active ? "var(--accent)" : "rgba(100,130,180,0.07)",
    borderColor: active ? "var(--accent)" : "var(--border)",
    color: active ? "#050d1e" : "var(--fg-subtle)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--fg-subtle)" }} />
          <input
            placeholder="Filter by title…"
            value={textFilter}
            onChange={e => setTextFilter(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, background: "rgba(100,130,180,0.06)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontSize: "0.72rem", outline: "none" }}
          />
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(["all", "open", "text", "nolinks"] as const).map(v => (
            <button key={v} onClick={() => setDistFilter(v)} style={filterBtn(distFilter === v)}>
              {v === "all" ? "All" : v === "open" ? "Open only" : v === "text" ? "Text posts" : "Excl. links-only"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.4)" }}>Min pain</span>
          <input
            type="range" min={0} max={10} step={1} value={minPain}
            onChange={e => setMinPain(parseInt(e.target.value, 10))}
            style={{ width: 80, accentColor: "var(--accent)", cursor: "pointer", appearance: "none", WebkitAppearance: "none", height: 4, borderRadius: 2, background: `linear-gradient(to right, var(--accent) ${minPain * 10}%, rgba(100,130,180,0.18) ${minPain * 10}%)`, outline: "none", border: "none" }}
          />
          <span style={{ fontSize: "0.68rem", fontVariantNumeric: "tabular-nums", color: "var(--accent)", minWidth: 12 }}>{minPain}</span>
          <span style={{ fontSize: "0.67rem", color: "rgba(165,182,214,0.4)", marginLeft: 8 }}>{sorted.length} / {signals.length}</span>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 36 }} />
              <th style={thStyle} onClick={() => toggleSort("painScore")}>Pain Signal <SortIcon k="painScore" /></th>
              <th style={{ ...thStyle, minWidth: 110 }} onClick={() => toggleSort("subreddit")}>Subreddit <SortIcon k="subreddit" /></th>
              <th style={{ ...thStyle, minWidth: 110 }} onClick={() => toggleSort("distributionScore")}>Distribution <SortIcon k="distributionScore" /></th>
              <th style={{ ...thStyle, minWidth: 90 }} onClick={() => toggleSort("painScore")}>Pain <SortIcon k="painScore" /></th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("score")}>↑ Score <SortIcon k="score" /></th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("numComments")}>💬 <SortIcon k="numComments" /></th>
              <th style={{ ...thStyle, textAlign: "right" }} onClick={() => toggleSort("createdUtc")}>Age <SortIcon k="createdUtc" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.8rem" }}>No signals match your filters.</td></tr>
            )}
            {sorted.map(s => {
              const comm = communityMap.get(s.subreddit.toLowerCase());
              const inQueue = queueSubreddits.has(s.subreddit.toLowerCase());
              return (
                <tr key={s.id} style={{ background: inQueue ? "rgba(99,179,255,0.05)" : "transparent" }}>
                  <td style={{ ...cellStyle, width: 36, padding: "8px 6px 8px 10px" }}>
                    <div
                      onClick={() => onAdd(s.subreddit, comm?.subscribers ?? 0)}
                      style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${inQueue ? "var(--accent)" : "var(--border)"}`, background: inQueue ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                    >
                      {inQueue ? <Check size={12} style={{ color: "#050d1e" }} /> : <Plus size={12} style={{ color: "var(--fg-subtle)" }} />}
                    </div>
                  </td>
                  <td style={{ ...cellStyle, maxWidth: 380 }}>
                    <a
                      href={s.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: "var(--fg)", textDecoration: "none", display: "block", lineHeight: 1.4 }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                    >
                      {s.title.length > 100 ? s.title.slice(0, 100) + "…" : s.title}
                    </a>
                    {s.body && (
                      <div style={{ fontSize: "0.68rem", color: "rgba(165,182,214,0.45)", marginTop: 2, lineHeight: 1.5, whiteSpace: "pre-wrap", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {s.body.slice(0, 100)}
                      </div>
                    )}
                    <div style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.28)", marginTop: 2 }}>via "{s.searchQuery.length > 50 ? s.searchQuery.slice(0, 50) + "…" : s.searchQuery}"</div>
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    <a
                      href={`https://reddit.com/r/${s.subreddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontWeight: 600, color: "var(--fg)", textDecoration: "none", fontSize: "0.78rem" }}
                      onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
                      onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
                    >
                      r/{s.subreddit}
                    </a>
                    {comm && (
                      <div style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.4)", marginTop: 1 }}>{fmt(comm.subscribers)} members</div>
                    )}
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    {comm ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <DistBadge label={comm.distributionLabel} />
                        <ScoreBar value={comm.distributionScore} color={distributionColor(comm.distributionLabel)} />
                      </div>
                    ) : (
                      <span style={{ color: "rgba(165,182,214,0.35)", fontSize: "0.68rem" }}>-</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, minWidth: 90 }}>
                    <ScoreBar value={s.painScore} />
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--fg-subtle)", fontSize: "0.70rem" }}>{fmt(s.score)}</td>
                  <td style={{ ...cellStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--fg-subtle)", fontSize: "0.70rem" }}>{s.numComments}</td>
                  <td style={{ ...cellStyle, textAlign: "right", color: "var(--fg-subtle)", fontSize: "0.68rem", whiteSpace: "nowrap" }}>{postAgeFmt(s.createdUtc)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pain × Distribution Matrix ────────────────────────────────────────────────

function PainDistributionMatrix({
  communities,
  queueSubreddits,
  onAdd,
}: {
  communities: CommunityDistribution[];
  queueSubreddits: Set<string>;
  onAdd: (sub: string, subscribers: number) => void;
}) {
  const maxSignals = Math.max(...communities.map(c => c.signalCount), 1);

  // Quadrant labels based on position
  function quadrantLabel(distScore: number, signalCount: number): { label: string; color: string } {
    const highDist = distScore >= 6;
    const highPain = signalCount / maxSignals >= 0.4;
    if (highDist && highPain) return { label: "✓ Build here", color: "#22c55e" };
    if (!highDist && highPain) return { label: "Pain, can't reach", color: "#f59e0b" };
    if (highDist && !highPain) return { label: "Open but quiet", color: "#63b3ff" };
    return { label: "Skip", color: "rgba(165,182,214,0.35)" };
  }

  return (
    <div style={{ position: "relative", minHeight: 420, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
      {/* Axis labels */}
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", fontSize: "0.62rem", color: "rgba(165,182,214,0.4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Distribution readiness →</div>
      <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%) rotate(-90deg)", fontSize: "0.62rem", color: "rgba(165,182,214,0.4)", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Pain signal strength →</div>

      {/* Quadrant dividers */}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 24, width: 1, background: "rgba(100,130,180,0.12)" }} />
      <div style={{ position: "absolute", top: "50%", left: 24, right: 0, height: 1, background: "rgba(100,130,180,0.12)" }} />

      {/* Quadrant labels */}
      <div style={{ position: "absolute", right: 16, top: 12, fontSize: "0.62rem", color: "#22c55e", fontWeight: 700, opacity: 0.7 }}>✓ Build here</div>
      <div style={{ position: "absolute", left: 32, top: 12, fontSize: "0.62rem", color: "#f59e0b", fontWeight: 700, opacity: 0.7 }}>Pain, can't reach</div>
      <div style={{ position: "absolute", right: 16, bottom: 32, fontSize: "0.62rem", color: "#63b3ff", fontWeight: 700, opacity: 0.7 }}>Open but quiet</div>
      <div style={{ position: "absolute", left: 32, bottom: 32, fontSize: "0.62rem", color: "rgba(165,182,214,0.35)", fontWeight: 700, opacity: 0.7 }}>Skip</div>

      {/* Community dots */}
      <div style={{ position: "absolute", inset: "24px 24px 32px 32px" }}>
        {communities.map(c => {
          const xPct = ((c.distributionScore - 1) / 9) * 100;
          const yPct = 100 - ((c.signalCount / maxSignals) * 100);
          const { color } = quadrantLabel(c.distributionScore, c.signalCount);
          const size = Math.max(8, Math.min(32, 8 + c.signalCount * 3));
          const inQueue = queueSubreddits.has(c.subreddit.toLowerCase());
          return (
            <div
              key={c.subreddit}
              style={{
                position: "absolute",
                left: `calc(${xPct}% - ${size / 2}px)`,
                top: `calc(${yPct}% - ${size / 2}px)`,
                width: size,
                height: size,
                borderRadius: "50%",
                background: inQueue ? "var(--accent)" : color,
                border: `2px solid ${inQueue ? "var(--accent)" : color}`,
                opacity: inQueue ? 1 : 0.75,
                cursor: "pointer",
                transition: "transform 0.15s, opacity 0.15s",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={`r/${c.subreddit} - ${c.signalCount} signals - dist ${c.distributionScore}/10`}
              onClick={() => onAdd(c.subreddit, c.subscribers)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1.4)"; (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.zIndex = "20"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; (e.currentTarget as HTMLElement).style.opacity = inQueue ? "1" : "0.75"; (e.currentTarget as HTMLElement).style.zIndex = "10"; }}
            />
          );
        })}
      </div>

      {/* Community cards legend */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 200, background: "rgba(10,20,40,0.85)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: "8px 0" }}>
        <div style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 10px 6px" }}>Communities</div>
        {[...communities].sort((a, b) => (b.distributionScore * b.signalCount) - (a.distributionScore * a.signalCount)).map(c => {
          const { color } = quadrantLabel(c.distributionScore, c.signalCount);
          const inQueue = queueSubreddits.has(c.subreddit.toLowerCase());
          return (
            <div
              key={c.subreddit}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: "pointer", background: inQueue ? "rgba(99,179,255,0.08)" : "transparent" }}
              onClick={() => onAdd(c.subreddit, c.subscribers)}
              onMouseEnter={e => { if (!inQueue) (e.currentTarget as HTMLElement).style.background = "rgba(100,130,180,0.08)"; }}
              onMouseLeave={e => { if (!inQueue) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: inQueue ? "var(--accent)" : color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>r/{c.subreddit}</div>
                <div style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.4)" }}>{c.signalCount} sig · {fmt(c.subscribers)}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {inQueue ? <Check size={11} style={{ color: "var(--accent)" }} /> : <Plus size={11} style={{ color: "rgba(165,182,214,0.3)" }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Queue Tray ────────────────────────────────────────────────────────────────

function QueueTray({
  queue,
  onRemove,
  onAnalyze,
  onAnalyzeAll,
}: {
  queue: DiscoveredCommunity[];
  onRemove: (id: number) => void;
  onAnalyze: (id: number) => void;
  onAnalyzeAll: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: 0, left: "var(--sidebar-width, 220px)", right: 0, zIndex: 50, borderTop: "1px solid var(--border)", background: "#0d1628", boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}>
      {expanded && (
        <div style={{ display: "flex", gap: 8, padding: "10px 20px", overflowX: "auto", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          {queue.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 4px 10px", background: "rgba(100,130,180,0.08)", border: "1px solid var(--border)", borderRadius: 6, flexShrink: 0 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--fg)" }}>r/{c.subreddit}</span>
              <span style={{ fontSize: "0.62rem", color: "var(--fg-subtle)" }}>{fmt(c.subscriberCount ?? 0)}</span>
              {c.scanStatus === "running" && <Loader2 size={10} style={{ animation: "spin 1s linear infinite", color: "var(--fg-subtle)" }} />}
              {c.scanStatus === "done" && <span style={{ fontSize: "0.58rem", color: "#22c55e" }}>✓</span>}
              <button onClick={() => onRemove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(165,182,214,0.35)", padding: 0, display: "flex", alignItems: "center", marginLeft: 2 }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px" }}>
        <button onClick={() => setExpanded(e => !e)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", color: "var(--fg)", padding: 0 }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span style={{ fontSize: "0.78rem", fontWeight: 700 }}>Analyze Queue</span>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "var(--accent)", background: "rgba(99,179,255,0.12)", border: "1px solid rgba(99,179,255,0.25)", borderRadius: 10, padding: "1px 7px" }}>{queue.length}</span>
        </button>
        {!expanded && (
          <div style={{ display: "flex", gap: 6, flex: 1, overflow: "hidden" }}>
            {queue.slice(0, 8).map(c => (
              <span key={c.id} style={{ fontSize: "0.68rem", padding: "2px 8px", background: "rgba(100,130,180,0.08)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--fg-subtle)", flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                r/{c.subreddit}
                {c.scanStatus === "running" && <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} />}
                {c.scanStatus === "done" && <span style={{ color: "#22c55e", fontSize: "0.6rem" }}>✓</span>}
              </span>
            ))}
            {queue.length > 8 && <span style={{ fontSize: "0.68rem", color: "var(--fg-dim)", flexShrink: 0 }}>+{queue.length - 8} more</span>}
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button variant="primary" size="sm" onClick={onAnalyzeAll} style={{ fontSize: "0.72rem" }}>
            Analyze all ({queue.length})
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function DiscoveryPage() {
  const loaderData = Route.useLoaderData() as LoaderData;

  const [profile] = useState<DiscoveryProfile | null>(loaderData.profile);

  // Search input
  const [domain, setDomain] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchQueries, setSearchQueries] = useState<string[]>([]);

  // Results
  const [signals, setSignals] = useState<PainSignalPost[]>([]);
  const [communities, setCommunities] = useState<CommunityDistribution[]>([]);
  const [activeTab, setActiveTab] = useState<"signals" | "matrix">("signals");
  const [hasResults, setHasResults] = useState(false);

  // Recent sessions
  const [recentSessions] = useState<PainSearchSession[]>(loaderData.recentSessions);

  // Queue
  const [queue, setQueue] = useState<DiscoveredCommunity[]>(loaderData.queue);
  const queueSubreddits = new Set(queue.map(c => c.subreddit.toLowerCase()));

  const pollingRefs = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());

  // ── Search ───────────────────────────────────────────────────────────────────

  async function handleSearch() {
    const d = domain.trim();
    if (!d) return;
    setSearching(true);
    setSearchQueries([]);
    setHasResults(false);
    try {
      const keywords = profile?.extractedKeywords ?? [];
      const result: PainSearchResult = await searchForPain({ data: { domain: d, keywords } });
      setSearchQueries(result.searchQueries);
      setSignals(result.signals);
      setCommunities(result.communities);
      setHasResults(true);
    } finally {
      setSearching(false);
    }
  }

  function restoreSession(s: PainSearchSession) {
    const sigs: PainSignalPost[] = s.signalsJson ? JSON.parse(s.signalsJson) : [];
    const comms: CommunityDistribution[] = s.communitiesJson ? JSON.parse(s.communitiesJson) : [];
    setDomain(s.domain);
    setSignals(sigs);
    setCommunities(comms);
    setSearchQueries(s.searchQueries ?? []);
    setHasResults(true);
  }

  // ── Queue handlers ───────────────────────────────────────────────────────────

  async function handleAddToQueue(subredditName: string, subscribers: number) {
    if (queueSubreddits.has(subredditName.toLowerCase())) return;
    const comm = communities.find(c => c.subreddit.toLowerCase() === subredditName.toLowerCase());
    const saved = await addCommunityToQueue({
      data: {
        name: subredditName,
        subscribers,
        activeUserCount: 0,
        description: comm ? `Distribution: ${comm.distributionLabel} (${comm.distributionScore}/10)` : "",
        engagementRatio: 0,
      },
    });
    setQueue(prev => prev.find(c => c.id === saved.id) ? prev.map(c => c.id === saved.id ? saved : c) : [...prev, saved]);
  }

  async function handleRemoveFromQueue(id: number) {
    await trackCommunity({ data: { id, tracked: false } });
    setQueue(prev => prev.filter(c => c.id !== id));
  }

  const handleAnalyze = useCallback(async (id: number) => {
    setQueue(prev => prev.map(c => c.id === id ? { ...c, scanStatus: "running" } : c));
    await triggerDiscoveredCommunityAnalysis({ data: { id } });
    const existing = pollingRefs.current.get(id);
    if (existing) clearInterval(existing);
    const poll = setInterval(async () => {
      const updated = await getDiscoveredCommunity({ data: { id } });
      if (!updated) return;
      setQueue(prev => prev.map(c => c.id === id ? updated : c));
      if (updated.scanStatus === "done" || updated.scanStatus === "failed") {
        clearInterval(poll);
        pollingRefs.current.delete(id);
      }
    }, 3000);
    pollingRefs.current.set(id, poll);
  }, []);

  async function handleAnalyzeAll() {
    for (const c of queue.filter(c => c.scanStatus !== "running")) {
      await handleAnalyze(c.id);
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", overflowY: "auto" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid #0a1628; cursor: pointer; margin-top: -5px; }
        input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid #0a1628; cursor: pointer; }
        input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; }
        input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: rgba(100,130,180,0.18); }
      `}</style>

      <div style={{ padding: "28px 24px 100px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <Zap size={18} style={{ color: "var(--accent)" }} />
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--fg)" }}>Pain Discovery</h1>
          <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)" }}>Find real frustration on Reddit - communities emerge automatically</span>
        </div>

        {/* ── Section 1: Search Input ── */}
        <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px", marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>
            What problem space do you want to explore?
          </label>
          <textarea
            rows={3}
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="e.g. Developers frustrated with deploying monorepos, or freelancers manually tracking invoices in spreadsheets…"
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSearch(); }}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(100,130,180,0.06)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--fg)",
              padding: "10px 12px",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              lineHeight: 1.6,
              resize: "vertical",
              outline: "none",
              marginBottom: 10,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {profile?.extractedKeywords && profile.extractedKeywords.length > 0 && (
              <button
                onClick={() => setDomain(d => d ? d + "\n\nKeywords: " + profile.extractedKeywords!.join(", ") : profile.extractedKeywords!.join(", "))}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.68rem", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(99,179,255,0.06)", color: "var(--accent)", cursor: "pointer" }}
              >
                <Sparkles size={11} />
                Use my profile keywords ({profile.extractedKeywords.length})
              </button>
            )}
            <div style={{ marginLeft: "auto" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSearch}
                disabled={searching || !domain.trim()}
                style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78rem", padding: "7px 16px" }}
              >
                {searching ? (
                  <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Searching for pain…</>
                ) : (
                  <><Search size={13} /> Search for Pain</>
                )}
              </Button>
            </div>
          </div>

          {/* Active query list while searching */}
          {searching && searchQueries.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Running queries</div>
              {searchQueries.map((q, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.70rem", color: "var(--fg-subtle)" }}>
                  <Loader2 size={10} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Recent Sessions ── */}
        {!hasResults && recentSessions.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: "0.60rem", color: "rgba(165,182,214,0.35)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recent searches</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {recentSessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => restoreSession(s)}
                  style={{ fontSize: "0.70rem", padding: "4px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(100,130,180,0.06)", color: "var(--fg-subtle)", cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}
                >
                  <span style={{ color: "var(--fg)", fontWeight: 600 }}>{s.domain.length > 40 ? s.domain.slice(0, 40) + "…" : s.domain}</span>
                  <span style={{ color: "rgba(165,182,214,0.4)" }}>·</span>
                  <span>{s.signalCount} signals</span>
                  <span style={{ color: "rgba(165,182,214,0.4)" }}>·</span>
                  <span>{sessionAgeFmt(s.createdAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading state ── */}
        {searching && !hasResults && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.8rem", color: "var(--fg-subtle)" }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            <div>
              <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>Generating search queries with AI…</div>
              <div style={{ fontSize: "0.72rem" }}>Then searching Reddit for frustration signals across all queries in parallel.</div>
            </div>
          </div>
        )}

        {/* ── Section 2: Results ── */}
        {hasResults && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Results header + tabs */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--fg)" }}>
                  {signals.length} pain signals
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--fg-subtle)" }}>
                  across {communities.length} communities
                </span>
              </div>

              {/* Query chips */}
              {searchQueries.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
                  {searchQueries.slice(0, 5).map((q, i) => (
                    <span key={i} style={{ fontSize: "0.62rem", padding: "2px 8px", borderRadius: 8, background: "rgba(99,179,255,0.08)", color: "var(--fg-subtle)", border: "1px solid rgba(99,179,255,0.15)" }}>{q}</span>
                  ))}
                  {searchQueries.length > 5 && <span style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.4)" }}>+{searchQueries.length - 5} more</span>}
                </div>
              )}

              {/* Tabs */}
              <div style={{ display: "flex", gap: 0, background: "rgba(100,130,180,0.06)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", marginLeft: "auto" }}>
                {([["signals", "Signals", <ArrowRight size={12} />], ["matrix", "Pain × Distribution Matrix", <BarChart2 size={12} />]] as const).map(([tab, label, icon]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as "signals" | "matrix")}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 13px", fontSize: "0.70rem", fontWeight: 600, background: activeTab === tab ? "var(--accent)" : "transparent", color: activeTab === tab ? "#050d1e" : "var(--fg-subtle)", border: "none", cursor: "pointer" }}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === "signals" && (
              <SignalsTable
                signals={signals}
                communities={communities}
                queueSubreddits={queueSubreddits}
                onAdd={handleAddToQueue}
              />
            )}
            {activeTab === "matrix" && (
              <PainDistributionMatrix
                communities={communities}
                queueSubreddits={queueSubreddits}
                onAdd={handleAddToQueue}
              />
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!searching && !hasResults && (
          <div style={{ padding: "60px 24px", textAlign: "center", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg-subtle)", fontSize: "0.8rem", lineHeight: 1.6 }}>
            <Zap size={28} style={{ color: "rgba(165,182,214,0.2)", marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>Start with the pain, not the community</div>
            <div>Describe a problem space above. The AI will generate frustration-language queries,<br />search Reddit posts, then score communities by how easy they are to reach.</div>
          </div>
        )}

      </div>

      {/* ── Queue Tray ── */}
      {queue.length > 0 && (
        <QueueTray
          queue={queue}
          onRemove={handleRemoveFromQueue}
          onAnalyze={handleAnalyze}
          onAnalyzeAll={handleAnalyzeAll}
        />
      )}
    </div>
  );
}
