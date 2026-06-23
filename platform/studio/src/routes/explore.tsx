import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  listVerticals,
  expandVertical,
  scoreCommunities,
  trackScannedCommunities,
  getTrackedCommunities,
  getOpportunityLeads,
  getProblemShapes,
  detectProblemShapes,
} from "~/lib/market-scan";
import type {
  VerticalDef,
  VerticalExpansion,
  ScoredCommunity,
  OpportunityLead,
  ProblemShape,
  TrackedCommunity,
} from "~/lib/market-scan";
import { Button } from "~/components/ui/Button";
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
  ChevronRight,
  Plus,
  LineChart,
  UtensilsCrossed,
  Factory,
  Shield,
  FolderOpen,
  FlaskConical,
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
};

function VertIcon({ name, size = 18 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Activity;
  return <Icon size={size} />;
}

// ── LoadingState ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{ padding: "80px 32px", color: "var(--fg-muted)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: 10 }}>
      <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
      Loading Opportunity Radar…
    </div>
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

type LoaderData = {
  verticals: VerticalDef[];
  shapes: ProblemShape[];
  leads: OpportunityLead[];
  tracked: TrackedCommunity[];
};

export const Route = createFileRoute("/explore")({
  loader: async (): Promise<LoaderData> => {
    const [verticals, shapes, leads, tracked] = await Promise.all([
      listVerticals(),
      getProblemShapes(),
      getOpportunityLeads({ data: { limit: 20 } }),
      getTrackedCommunities(),
    ]);
    return { verticals, shapes, leads, tracked };
  },
  pendingComponent: LoadingState,
  component: ExplorePage,
});

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

// ── SeverityDots ──────────────────────────────────────────────────────────────

function SeverityDots({ value, max = 10 }: { value: number; max?: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            width: 7, height: 7,
            borderRadius: "50%",
            background: i < value
              ? (value >= 7 ? "#22c55e" : value >= 4 ? "#f59e0b" : "#ef4444")
              : "rgba(165,182,214,0.1)",
          }}
        />
      ))}
    </div>
  );
}

// ── MRR score badge ───────────────────────────────────────────────────────────

function MrrBadge({ score, estimate }: { score: number; estimate: string }) {
  const color = score >= 7 ? "#22c55e" : score >= 4 ? "#f59e0b" : "rgba(165,182,214,0.5)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px",
      borderRadius: 3,
      border: `1px solid ${color}40`,
      background: `${color}10`,
      fontSize: "0.68rem", fontWeight: 600,
      color,
    }}>
      {estimate}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ExplorePage() {
  const loaderData = Route.useLoaderData();
  const { verticals } = loaderData;

  const [tab, setTab] = useState<"vertical" | "shapes">("vertical");
  type SortCol = "name" | "mrrFloor" | "trustLevel" | "switchingCost";
  const [sortCol, setSortCol] = useState<SortCol>("mrrFloor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Vertical scan state
  const [selectedVertical, setSelectedVertical] = useState<VerticalDef | null>(null);
  const [expansion, setExpansion] = useState<VerticalExpansion | null>(null);
  const [expandLoading, setExpandLoading] = useState(false);
  const [scoredCommunities, setScoredCommunities] = useState<ScoredCommunity[]>([]);
  const [scoringCommunities, setScoringCommunities] = useState<Set<string>>(new Set());
  const [selectedForTracking, setSelectedForTracking] = useState<Set<string>>(new Set());
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedCount, setTrackedCount] = useState<number | null>(null);

  // Problem shapes state
  const [detectingShapes, setDetectingShapes] = useState(false);
  const [shapes, setShapes] = useState<ProblemShape[]>(loaderData.shapes);
  const [leads, setLeads] = useState<OpportunityLead[]>(loaderData.leads);
  const [tracked, setTracked] = useState<TrackedCommunity[]>(loaderData.tracked);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSelectVertical(v: VerticalDef) {
    setSelectedVertical(v);
    setExpansion(null);
    setScoredCommunities([]);
    setSelectedForTracking(new Set());
    setTrackedCount(null);
  }

  async function handleExpand() {
    if (!selectedVertical) return;
    setExpandLoading(true);
    setExpansion(null);
    setScoredCommunities([]);
    try {
      const { expansion } = await expandVertical({ data: { verticalSlug: selectedVertical.slug } });
      setExpansion(expansion);
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
    if (!expansion) return;
    const allSubs = [
      ...(selectedVertical?.seedCommunities ?? []),
      ...expansion.communities,
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    // Score sequentially to show live results
    for (const sub of allSubs) {
      if (scoredCommunities.some((c) => c.subreddit === sub && !c.error)) continue;
      await handleScoreOne(sub);
    }
  }

  async function handleTrack() {
    if (selectedForTracking.size === 0) return;
    setTrackingLoading(true);
    try {
      // Pass full scored community objects so metadata is persisted
      const scoredToTrack = scoredCommunities.filter(c => selectedForTracking.has(c.subreddit));
      const unscoredToTrack = [...selectedForTracking]
        .filter(s => !scoredToTrack.find(c => c.subreddit === s))
        .map(s => ({ subreddit: s, painDensity: 0, buyerDensity: 0, sampleSize: 0, topPatterns: [], subscribers: 0, activeUsers: 0, engagementRatio: 0, submissionType: "any", size: "micro" as const, fit: 0 }));

      const { tracked: count } = await trackScannedCommunities({
        data: {
          communities: [...scoredToTrack, ...unscoredToTrack],
          verticalSlug: selectedVertical?.slug,
        },
      });
      setTrackedCount(count);
      // Refresh tracked list and leads
      const [newLeads, newTracked] = await Promise.all([
        getOpportunityLeads({ data: { limit: 20 } }),
        getTrackedCommunities(),
      ]);
      setLeads(newLeads);
      setTracked(newTracked);
    } catch (err) {
      console.error("[handleTrack]", err);
    } finally {
      setTrackingLoading(false);
    }
  }

  async function handleDetectShapes() {
    setDetectingShapes(true);
    try {
      const newShapes = await detectProblemShapes({ data: {} });
      setShapes(newShapes);
    } catch (err) {
      console.error("[handleDetectShapes]", err);
    } finally {
      setDetectingShapes(false);
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

  // ── Communities list (seed + LLM-generated) ──────────────────────────────────

  const allCommunities = expansion
    ? [...(selectedVertical?.seedCommunities ?? []), ...expansion.communities].filter(
      (s, i, arr) => arr.indexOf(s) === i
    )
    : selectedVertical?.seedCommunities ?? [];

  // Merge scored data into community list
  const communityData = allCommunities.map((sub) => {
    const scored = scoredCommunities.find((c) => c.subreddit === sub);
    return { sub, scored };
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Radar size={20} style={{ color: "var(--accent)" }} />
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)" }}>
              Opportunity Radar
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-muted)" }}>
            Find high-MRR B2B opportunities from operational pain
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex", gap: 2,
          background: "rgba(165,182,214,0.06)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 3,
        }}>
          {(["vertical", "shapes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "5px 14px",
                borderRadius: "calc(var(--radius) - 1px)",
                border: "none",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontWeight: 500,
                fontFamily: "inherit",
                background: tab === t ? "var(--bg-elevated)" : "transparent",
                color: tab === t ? "var(--fg)" : "var(--fg-muted)",
                boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {t === "vertical" ? "Vertical Scan" : "Problem Shapes"}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Vertical Scan ── */}
      {tab === "vertical" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Step 1: Pick vertical */}
          <section>
            <SectionHeader label="Step 1: Pick a vertical" />
            <VerticalTable
              verticals={verticals}
              selected={selectedVertical}
              onSelect={handleSelectVertical}
              sortCol={sortCol}
              sortDir={sortDir}
              onSort={(col) => {
                if (col === sortCol) setSortDir(d => d === "asc" ? "desc" : "asc");
                else { setSortCol(col); setSortDir(col === "name" ? "asc" : "desc"); }
              }}
            />
          </section>

          {/* Step 2: Expansion */}
          {selectedVertical && (
            <section>
              <SectionHeader label="Step 2: Market intelligence" />
              <div style={{
                marginTop: 10,
                padding: "14px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExpand}
                    disabled={expandLoading}
                    style={{ gap: 6 }}
                  >
                    {expandLoading
                      ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Expanding…</>
                      : <><Zap size={13} /> Expand {selectedVertical.name} →</>}
                  </Button>
                  {expansion && (
                    <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)" }}>
                      Found {expansion.communities.length} communities + {expansion.jobTitles.length} job titles
                    </span>
                  )}
                </div>

                {expansion && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <ChipGroup label="Job titles" items={expansion.jobTitles} color="rgba(96,165,250,0.15)" />
                    <ChipGroup label="Tools" items={expansion.tools} color="rgba(245,158,11,0.12)" />
                    <ChipGroup label="Pain vocabulary" items={expansion.painVocabulary} color="rgba(239,68,68,0.1)" />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 3: Community scores */}
          {selectedVertical && allCommunities.length > 0 && (
            <section>
              <SectionHeader label="Step 3: Community scores" />
              <div style={{
                marginTop: 10,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}>
                {/* Actions bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border)",
                  background: "rgba(165,182,214,0.02)",
                }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScoreAll}
                    disabled={scoringCommunities.size > 0}
                  >
                    {scoringCommunities.size > 0
                      ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Scoring…</>
                      : "Score all communities"}
                  </Button>
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
                  {trackedCount !== null && (
                    <span style={{ fontSize: "0.72rem", color: "var(--success)" }}>
                      {trackedCount} communities tracked
                    </span>
                  )}
                </div>

                {/* Community rows */}
                <div>
                  {communityData.map(({ sub, scored }) => {
                    const isScoring = scoringCommunities.has(sub);
                    const isSelected = selectedForTracking.has(sub);
                    return (
                      <div
                        key={sub}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "9px 14px",
                          borderBottom: "1px solid rgba(165,182,214,0.05)",
                          background: isSelected ? "rgba(96,165,250,0.04)" : undefined,
                        }}
                      >
                        {/* Track checkbox */}
                        <button
                          onClick={() => toggleTrack(sub)}
                          style={{
                            width: 18, height: 18,
                            borderRadius: 3,
                            border: `1px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                            background: isSelected ? "var(--accent)" : "transparent",
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            padding: 0,
                          }}
                        >
                          {isSelected && <Check size={11} color="#050d1e" />}
                        </button>

                        {/* Name */}
                        <a
                          href={`https://reddit.com/r/${sub}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            width: 160, flexShrink: 0,
                            fontSize: "0.80rem", fontWeight: 500,
                            color: "var(--fg)",
                            textDecoration: "none",
                          }}
                        >
                          r/{sub}
                        </a>

                        {/* Density bars */}
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
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
                            <span style={{ fontSize: "0.70rem", color: "rgba(239,68,68,0.6)" }}>
                              {scored.error}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.70rem", color: "var(--fg-dim)" }}>Not scored</span>
                          )}
                        </div>

                        {/* Score button */}
                        {!scored && !isScoring && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleScoreOne(sub)}
                            style={{ fontSize: "0.70rem", padding: "2px 8px", height: "auto", flexShrink: 0 }}
                          >
                            Score
                          </Button>
                        )}
                        {scored && scored.sampleSize > 0 && (
                          <span style={{ fontSize: "0.66rem", color: "var(--fg-dim)", flexShrink: 0, width: 52, textAlign: "right" }}>
                            {scored.sampleSize} posts
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Step 4: Opportunity leads */}
          {leads.length > 0 && (
            <section>
              <SectionHeader label="Step 4: Opportunity leads" />
              <div style={{
                display: "flex", flexDirection: "column", gap: 6, marginTop: 10,
              }}>
                {leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            </section>
          )}

          {leads.length === 0 && selectedForTracking.size === 0 && (
            <div style={{
              padding: "24px 16px",
              color: "var(--fg-dim)",
              fontSize: "0.80rem",
              textAlign: "center",
              borderRadius: "var(--radius)",
              border: "1px dashed var(--border)",
            }}>
              Track communities above to surface opportunity leads from pain clusters
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Problem Shapes ── */}
      {tab === "shapes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header row */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
          }}>
            <div>
              <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>
                Abstract workflow patterns across all verticals
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                Structural pain shapes derived from your collected signals
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDetectShapes}
              disabled={detectingShapes}
              style={{ gap: 6, flexShrink: 0 }}
            >
              {detectingShapes
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Detecting…</>
                : <><Radar size={13} /> Detect shapes</>}
            </Button>
          </div>

          {shapes.length === 0 ? (
            <div style={{
              padding: "40px 16px",
              color: "var(--fg-dim)",
              fontSize: "0.80rem",
              textAlign: "center",
              borderRadius: "var(--radius)",
              border: "1px dashed var(--border)",
            }}>
              No problem shapes yet - click "Detect shapes" to analyze your signals
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
              {shapes.map((shape) => (
                <ShapeCard key={shape.id} shape={shape} />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ── VerticalCard ──────────────────────────────────────────────────────────────

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

function SortArrow({ col, active, dir }: { col: SortCol; active: boolean; dir: "asc" | "desc" }) {
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
    fontSize: "0.68rem",
    fontWeight: 600,
    letterSpacing: "0.05em",
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
        <SortArrow col={col} active={sortCol === col} dir={sortDir} />
      </th>
    );
  }

  return (
    <div style={{
      marginTop: 10,
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
                {/* Name + icon */}
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
                {/* Tagline */}
                <td style={{ padding: "9px 12px", color: "var(--fg-dim)", fontSize: "0.75rem", maxWidth: 280 }}>
                  {v.tagline}
                </td>
                {/* MRR */}
                <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                  <span style={{
                    fontSize: "0.72rem", fontWeight: 600,
                    color: v.mrrFloor >= 1000 ? "#22c55e" : v.mrrFloor >= 500 ? "#86efac" : "var(--fg-subtle)",
                  }}>
                    {v.mrrRange}
                  </span>
                </td>
                {/* Trust */}
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
                {/* Switching cost */}
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
                {/* Seeds */}
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

// ── VerticalCard ──────────────────────────────────────────────────────────────

function VerticalCard({
  vertical,
  selected,
  onSelect,
}: {
  vertical: VerticalDef;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: "11px 13px",
        borderRadius: "var(--radius)",
        border: selected
          ? "1px solid var(--accent)"
          : "1px solid var(--border)",
        background: selected
          ? "rgba(96,165,250,0.08)"
          : "var(--bg-elevated)",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        fontFamily: "inherit",
        color: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ color: selected ? "var(--accent)" : "var(--fg-muted)" }}>
          <VertIcon name={vertical.icon} size={15} />
        </span>
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: selected ? "var(--fg)" : "var(--fg-muted)" }}>
          {vertical.name}
        </span>
      </div>
      <p style={{ margin: 0, fontSize: "0.70rem", color: "var(--fg-dim)", lineHeight: 1.4 }}>
        {vertical.tagline}
      </p>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: "0.62rem", fontWeight: 600,
          padding: "1px 5px",
          background: "rgba(165,182,214,0.08)",
          borderRadius: 2,
          color: "var(--fg-subtle)",
          letterSpacing: "0.02em",
        }}>
          {vertical.mrrRange}
        </span>
        <span style={{ fontSize: "0.60rem", color: "var(--fg-dim)" }}>
          {vertical.seedCommunities.length} seeds
        </span>
      </div>
    </button>
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

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      fontSize: "0.68rem", fontWeight: 700,
      letterSpacing: "0.10em", textTransform: "uppercase",
      color: "var(--fg-subtle)",
    }}>
      {label}
    </div>
  );
}

// ── LeadCard ──────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: OpportunityLead }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "11px 14px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)", marginBottom: 2 }}>
          {lead.theme}
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--fg-muted)", marginBottom: 6, lineHeight: 1.4 }}>
          {lead.description}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.68rem", color: "var(--fg-subtle)" }}>
            {lead.signalCount} signals
          </span>
          {lead.communities.length > 0 && (
            <span style={{ fontSize: "0.68rem", color: "var(--fg-dim)" }}>
              · {lead.communities.slice(0, 3).map((c) => `r/${c}`).join(", ")}
              {lead.communities.length > 3 && ` +${lead.communities.length - 3}`}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <MrrBadge score={lead.mrrScore} estimate={lead.mrrEstimate} />
        <span style={{ fontSize: "0.62rem", color: "var(--fg-dim)" }}>
          score {lead.mrrScore.toFixed(1)}/10
        </span>
      </div>
    </div>
  );
}

// ── ShapeCard ─────────────────────────────────────────────────────────────────

function ShapeCard({ shape }: { shape: ProblemShape }) {
  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div>
        <div style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>
          {shape.shape}
        </div>
        <p style={{ margin: 0, fontSize: "0.73rem", color: "var(--fg-muted)", lineHeight: 1.5 }}>
          {shape.description}
        </p>
      </div>

      {shape.verticals.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {shape.verticals.slice(0, 5).map((v) => (
            <span key={v} style={{
              padding: "1px 6px",
              fontSize: "0.64rem",
              background: "rgba(96,165,250,0.08)",
              color: "rgba(96,165,250,0.7)",
              borderRadius: 2,
              border: "1px solid rgba(96,165,250,0.15)",
            }}>
              {v}
            </span>
          ))}
          {shape.verticals.length > 5 && (
            <span style={{ fontSize: "0.64rem", color: "var(--fg-dim)" }}>
              +{shape.verticals.length - 5}
            </span>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {shape.severity != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.64rem", color: "var(--fg-subtle)", width: 52 }}>Severity</span>
              <SeverityDots value={shape.severity} max={10} />
            </div>
          )}
          {shape.mrrCeiling && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.64rem", color: "var(--fg-subtle)", width: 52 }}>MRR ceil.</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#22c55e" }}>
                {shape.mrrCeiling}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontSize: "0.64rem", color: "var(--fg-dim)" }}>
            {shape.signalCount} signals
          </span>
        </div>
      </div>

      {shape.wedgeRecommendation && (
        <div style={{
          padding: "7px 10px",
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.15)",
          borderRadius: "var(--radius)",
          fontSize: "0.72rem",
          color: "rgba(245,158,11,0.9)",
          lineHeight: 1.4,
          display: "flex", gap: 7, alignItems: "flex-start",
        }}>
          <ChevronRight size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {shape.wedgeRecommendation}
        </div>
      )}
    </div>
  );
}
