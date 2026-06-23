import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  scanForPain, getRecentFindScans,
  saveOpportunityFromSignal, draftReplyForSignal, saveScanClassifications,
  deepAnalyzeSignals, saveScanAnalysis, getCrossMarketSeo, analyzeSignal,
  promoteIdeaToProject, classifyOpportunities, buildFullProjectFromOp,
} from "~/lib/project-fns";
import type { SignalPlaybook, CrossMarketSeo } from "~/lib/project-fns";
import { getTrackedCommunities, trackScannedCommunities } from "~/lib/market-scan";
import { generatePlaybookForIdea } from "~/lib/server-fns";
import type { PainSignal, OpportunityClassification } from "~/lib/project-fns";
import { PAIN_DIMENSIONS } from "~/lib/reddit-patterns";
import type { TrackedCommunity } from "~/lib/market-scan";
import { Button } from "~/components/ui/Button";
import { Tooltip } from "~/components/ui/Tooltip";
import { Dropdown } from "~/components/ui/Dropdown";
import {
  Zap, Loader2, ExternalLink, Filter, History, Layers, Sparkles,
  Plus, Check, Star, BookmarkCheck, MessageSquare, Download, Copy,
} from "lucide-react";

export const Route = createFileRoute("/scan")({
  loader: async () => getTrackedCommunities(),
  staleTime: 60_000,
  pendingMs: 0,
  component: FindPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(s: number) {
  const d = Math.floor(Date.now() / 1000) - s;
  if (d < 60) return `${d}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}
function fmtSubs(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

const PATTERNS_DISPLAY = [
  "been doing this manually", "is there a better way to",
  "does anything exist that", "how do you all handle",
  "just use a spreadsheet", "wish there was a tool",
  "has to be a better way", "no good solution",
  "doing it manually", "anyone know a good way to",
];

type FilterMode = "all" | "buyer" | "manual" | "spreadsheet" | "opportunities";
type VerdictFilter = "all" | "go" | "maybe" | "kill";
type SortMode = "best" | "viability" | "upvotes" | "comments" | "newest" | "title" | "subscribers" | "authscore";
type SortDir = "asc" | "desc";
type ColKey = "signal" | "community" | "engage" | "score" | "verdict" | "workflow" | "wedge" | "evidence" | "distribution" | "brief" | "actions";
type HistoryEntry = { id: number; timeRange: string; signalCount: number; communityCount: number; createdAt: Date; signalsJson: string | null; classificationsJson?: string | null; analysisJson?: string | null };

interface ColDef {
  key: ColKey;
  label: string;
  tip: string;
  defaultWidth: number;
  sortKey?: SortMode;
  analysisOnly?: boolean;
  align?: "left" | "right" | "center";
}

const COLUMNS: ColDef[] = [
  { key: "signal", label: "Signal", tip: "Post title. Hover body for full text. Tags shown inline.", defaultWidth: 260, sortKey: "title" },
  { key: "community", label: "r/", tip: "Subreddit · subscribers · age. Click + to track.", defaultWidth: 110, sortKey: "subscribers" },
  { key: "engage", label: "Engage", tip: "↑ upvotes · 💬 comments. Hover comments for fetched text.", defaultWidth: 70, sortKey: "upvotes", align: "right" },
  { key: "score", label: "Score", tip: "Authenticity score 0–10.", defaultWidth: 65, sortKey: "authscore", align: "center" },
  { key: "verdict", label: "Verdict", tip: "go/maybe/kill · viability/10 · MRR estimate · verdict reason.", defaultWidth: 130, sortKey: "viability", analysisOnly: true },
  { key: "workflow", label: "Workflow", tip: "Workflow type · recurring cadence · build complexity · time to revenue.", defaultWidth: 150, analysisOnly: true },
  { key: "wedge", label: "Wedge", tip: "The product opportunity identified in this signal. User persona below.", defaultWidth: 190, analysisOnly: true },
  { key: "evidence", label: "Evidence", tip: "Direct quotes from comments confirming the pain.", defaultWidth: 180, analysisOnly: true },
  { key: "distribution", label: "Distribution", tip: "How to reach this audience. Messaging that works / to avoid.", defaultWidth: 180, analysisOnly: true },
  { key: "brief", label: "Brief", tip: "Generate full brief then promote to a Build project.", defaultWidth: 95, analysisOnly: true, align: "center" },
  { key: "actions", label: "Actions", tip: "⭐ star · 🔖 save · 💬 reply · open post", defaultWidth: 90, align: "right" },
];

// Analyze config encodes "limit:minScore" - e.g. "10:6", "all:7"
const ANALYZE_OPTIONS = [
  { value: "10:6", label: "Top 10 · score ≥ 6" },
  { value: "25:6", label: "Top 25 · score ≥ 6" },
  { value: "50:5", label: "Top 50 · score ≥ 5" },
  { value: "all:8", label: "All · score ≥ 8" },
  { value: "all:7", label: "All · score ≥ 7" },
  { value: "all:6", label: "All · score ≥ 6" },
  { value: "all:5", label: "All · score ≥ 5" },
  { value: "all:0", label: "Everything" },
] as const;

function parseAnalyzeConfig(cfg: string): { limit: number | null; minScore: number } {
  const [l, s] = cfg.split(":");
  return { limit: l === "all" ? null : Number(l), minScore: Number(s ?? 0) };
}

const STARRED_KEY = "bd_starred_signals";
function loadStarred(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) ?? "[]")); }
  catch { return new Set(); }
}
function saveStarred(s: Set<string>) {
  localStorage.setItem(STARRED_KEY, JSON.stringify([...s]));
}

// ── Reply modal ───────────────────────────────────────────────────────────────

function ReplyModal({ sig, classification, onClose }: {
  sig: PainSignal;
  classification?: OpportunityClassification;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    draftReplyForSignal({
      data: {
        signal: { title: sig.title, body: sig.body, subreddit: sig.subreddit },
        classification: classification ? {
          workflowType: classification.workflowType,
          wedgeOpportunity: classification.wedgeOpportunity,
          currentWorkaround: classification.currentWorkaround,
        } : null,
      }
    }).then(r => { setDraft(r.draft); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ position: "relative", width: 560, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
        <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.91rem", fontWeight: 600, color: "var(--fg)" }}>Draft reply</div>
            <div style={{ fontSize: "0.93rem", color: "var(--fg-dim)", marginTop: 2 }}>r/{sig.subreddit} · {sig.title.slice(0, 60)}{sig.title.length > 60 ? '…' : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--fg-dim)", cursor: "pointer", fontSize: "1rem", padding: "2px 6px" }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-subtle)", fontSize: "0.87rem", minHeight: 80 }}>
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Drafting…
            </div>
          ) : (
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              style={{ width: "100%", minHeight: 130, background: "rgba(165,182,214,0.04)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontSize: "0.89rem", lineHeight: 1.6, padding: "9px 11px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
            <a href={sig.permalink} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "0.79rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
              Open post <ExternalLink size={9} />
            </a>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => { navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 2000); }} disabled={!draft}>
                {copied ? <><Check size={11} /> Copied</> : "Copy reply"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Classification expanded row ───────────────────────────────────────────────

// ── Cross-market patterns ─────────────────────────────────────────────────────

interface Cluster {
  pattern: string;
  label: string;       // workflowType if available, else pattern
  subreddits: string[];
  signals: PainSignal[];
  seoData?: CrossMarketSeo;
}

function CrossMarketPatterns({ signals, playbooks, seoAngles }: {
  signals: PainSignal[];
  playbooks: Map<string, SignalPlaybook>;
  seoAngles: Map<string, CrossMarketSeo>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const clusters = useMemo((): Cluster[] => {
    const map = new Map<string, { label: string; subs: Set<string>; sigs: PainSignal[] }>();

    for (const sig of signals) {
      const pb = playbooks.get(sig.id);
      const key = pb?.workflowType?.trim() || sig.matchedPattern;
      const label = pb?.workflowType?.trim() || sig.matchedPattern;
      if (!map.has(key)) map.set(key, { label, subs: new Set(), sigs: [] });
      const entry = map.get(key)!;
      entry.subs.add(sig.subreddit);
      entry.sigs.push(sig);
    }

    return [...map.entries()]
      .map(([pattern, { label, subs, sigs }]) => ({
        pattern,
        label,
        subreddits: [...subs],
        signals: sigs,
      }))
      .filter(c => c.subreddits.length >= 2)       // cross-market = 2+ communities
      .sort((a, b) => b.subreddits.length - a.subreddits.length);
  }, [signals, playbooks]);

  if (!clusters.length) return null;

  const maxSubs = clusters[0]?.subreddits.length ?? 1;
  const hasSeo = seoAngles.size > 0;

  return (
    <div style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--bg-elevated)" }}>
      {/* Header */}
      <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, background: "rgba(165,182,214,0.02)" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: "0.79rem", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.01em" }}>Cross-market patterns</span>
          <span style={{ fontSize: "0.73rem", color: "var(--fg-dim)", marginLeft: 8 }}>
            {clusters.length} pains in 2+ communities
          </span>
        </div>
        {hasSeo && <span style={{ fontSize: "0.73rem", color: "#22c55e" }}>✓ SEO angles included</span>}
      </div>

      {/* Cluster list */}
      {clusters.map(c => {
        const seo = seoAngles.get(c.pattern);
        const isOpen = expanded.has(c.pattern);

        return (
          <div key={c.pattern} style={{ borderBottom: "1px solid rgba(165,182,214,0.05)" }}>
            {/* Cluster row */}
            <div
              onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(c.pattern) ? n.delete(c.pattern) : n.add(c.pattern); return n; })}
              style={{ padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(165,182,214,0.02)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: "0.87rem", color: "var(--fg-dim)", flexShrink: 0 }}>
                {isOpen ? "▼" : "▶"}
              </span>

              {/* Label */}
              <span style={{ fontSize: "0.83rem", fontWeight: 500, color: "var(--fg)", minWidth: 200 }}>
                {c.label}
              </span>

              {/* Bar */}
              <div style={{ flex: 1, height: 3, background: "rgba(165,182,214,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(c.subreddits.length / maxSubs) * 100}%`, background: "var(--accent)", borderRadius: 2, opacity: 0.5 }} />
              </div>

              {/* Counts */}
              <span style={{ fontSize: "0.93rem", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                {c.subreddits.length} communities
              </span>
              <span style={{ fontSize: "0.73rem", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                {c.signals.length} signals
              </span>

              {/* SEO keyword preview */}
              {seo?.seoKeywords[0] && (
                <span style={{ fontSize: "0.89rem", color: "#22c55e", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>
                  "{seo.seoKeywords[0]}"
                </span>
              )}
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div style={{ padding: "0 14px 12px 28px", display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Communities */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {c.subreddits.map(sub => (
                    <span key={sub} style={{ fontSize: "0.81rem", color: "var(--accent)", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 3, padding: "1px 6px" }}>
                      r/{sub}
                    </span>
                  ))}
                </div>

                {/* Signal titles - click to jump to row in table */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {c.signals.map(s => (
                    <div key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                      <button
                        onClick={() => {
                          const el = document.getElementById(`signal-row-${s.id}`);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.style.transition = "background 0.2s";
                            el.style.background = "rgba(96,165,250,0.12)";
                            setTimeout(() => { el.style.background = ""; }, 1800);
                          }
                        }}
                        style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontSize: "0.83rem", color: "var(--fg-subtle)", lineHeight: 1.4, fontFamily: "inherit" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-subtle)"; }}
                      >
                        → {s.title}
                      </button>
                      <a href={s.permalink} target="_blank" rel="noopener noreferrer"
                        style={{ flexShrink: 0, color: "var(--fg-dim)", opacity: 0.5, lineHeight: 1 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.5"; }}>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  ))}
                </div>

                {/* SEO angles */}
                {seo && (
                  <div style={{ marginTop: 4, padding: "10px 12px", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "0.87rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#22c55e" }}>SEO</span>
                      {seo.seoKeywords.map((kw, i) => (
                        <span key={i} style={{ fontSize: "0.85rem", color: "#22c55e", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 4, padding: "1px 7px" }}>
                          {kw}
                        </span>
                      ))}
                      <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)", marginLeft: 4 }}>
                        {seo.toolType}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.77rem", color: "var(--fg-muted)" }}>
                      🎯 {seo.landingPageAngle}
                    </div>
                    <div style={{ fontSize: "0.81rem", color: "var(--fg-subtle)" }}>
                      Intent: {seo.searchIntent}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PlaybookRow({ p, sig, colSpan }: { p: SignalPlaybook; sig: PainSignal; colSpan: number }) {
  const navigate = useNavigate();
  const [briefHtml, setBriefHtml] = useState("");
  const [ideaId, setIdeaId] = useState<number | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [buildBusy, setBuildBusy] = useState(false);

  async function handleFullBrief() {
    setLoadingBrief(true);
    try {
      const result = await generatePlaybookForIdea({
        data: {
          clusterTitle: p.workflowType || sig.title,
          clusterHypothesis: p.wedgeOpportunity || p.verdictReason,
          communities: [sig.subreddit],
          angle: p.distributionStrategy || undefined,
        },
      });
      setBriefHtml(result.briefHtml);
      setIdeaId(result.ideaId);
    } catch { }
    setLoadingBrief(false);
  }

  async function handleBuild() {
    if (!ideaId) return;
    setBuildBusy(true);
    try {
      const { projectId } = await promoteIdeaToProject({ data: { id: ideaId } });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/products/$id/build", params: { id: String(projectId) } });
    } catch { setBuildBusy(false); }
  }

  const isGo = p.verdict === 'go';
  const isMaybe = p.verdict === 'maybe';
  const verdictColor = isGo ? "#22c55e" : isMaybe ? "#f59e0b" : "#ef4444";
  const svColor = p.solopreneurViability >= 8 ? "#22c55e" : p.solopreneurViability >= 6 ? "#f59e0b" : "#94a3b8";

  return (
    <tr style={{ background: "rgba(6,10,20,0.7)" }}>
      <td colSpan={colSpan} style={{ padding: "14px 16px 14px 28px", borderBottom: "1px solid var(--border)" }}>

        {/* Header: verdict + key numbers */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: "0.87rem", fontWeight: 800, color: verdictColor, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            {p.verdict}
          </span>
          <span style={{ fontSize: "0.83rem", color: "var(--fg-subtle)", flex: 1 }}>{p.verdictReason}</span>
          <span style={{ fontSize: "0.81rem", fontWeight: 700, color: svColor }}>{p.solopreneurViability}/10</span>
          <span style={{ fontSize: "0.93rem", color: "#22c55e", fontWeight: 600 }}>{p.estimatedMrr}/mo</span>
          <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>{p.buildComplexity} to build · MRR in {p.timeToFirstRevenue}</span>
        </div>

        {/* Body: 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: "0 24px", alignItems: "start" }}>

          {/* Col 1: Workflow */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ fontSize: "0.77rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Workflow</div>
            {p.workflowGraph && (
              <div style={{ fontSize: "0.79rem", color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>{p.workflowGraph}</div>
            )}
            <div style={{ fontSize: "0.79rem", color: "var(--fg-muted)", fontWeight: 500 }}>{p.workflowType}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", fontSize: "0.89rem" }}>
              {p.isRecurring && <span style={{ color: "#22c55e" }}>● {p.recurringFrequency}</span>}
              {p.recurrenceNote && <span style={{ color: "var(--fg-dim)" }}>↻ {p.recurrenceNote}</span>}
            </div>
            {p.failedSolutions.length > 0 && (
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {p.failedSolutions.map((s, i) => (
                  <span key={i} style={{ fontSize: "0.87rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 3, padding: "0 5px", color: "#f59e0b" }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Col 2: Evidence + wedge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {p.commentEvidence.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: "0.77rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)" }}>From comments</div>
                {p.commentEvidence.slice(0, 3).map((q, i) => (
                  <div key={i} style={{ fontSize: "0.85rem", color: "#7dd3fc", fontStyle: "italic", lineHeight: 1.45 }}>"{q}"</div>
                ))}
              </div>
            )}
            {p.wedgeOpportunity && (
              <div style={{ fontSize: "0.79rem", color: "#7dd3fc", lineHeight: 1.5, paddingTop: p.commentEvidence.length > 0 ? 4 : 0, borderTop: p.commentEvidence.length > 0 ? "1px solid rgba(165,182,214,0.06)" : "none" }}>
                💡 {p.wedgeOpportunity}
              </div>
            )}
            {p.userPersona && (
              <div style={{ fontSize: "0.81rem", color: "var(--fg-subtle)" }}>👤 {p.userPersona}</div>
            )}
          </div>

          {/* Col 3: Distribution + messaging */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "0.77rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Distribution</div>
            {p.distributionStrategy && (
              <div style={{ fontSize: "0.85rem", color: "var(--fg-muted)", lineHeight: 1.5 }}>{p.distributionStrategy}</div>
            )}
            {(p.messagingThatWorks || p.messagingToAvoid) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 4, borderTop: "1px solid rgba(165,182,214,0.06)" }}>
                {p.messagingThatWorks && (
                  <div style={{ fontSize: "0.81rem" }}>
                    <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ </span>
                    <span style={{ color: "var(--fg-subtle)" }}>{p.messagingThatWorks}</span>
                  </div>
                )}
                {p.messagingToAvoid && (
                  <div style={{ fontSize: "0.81rem" }}>
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>✗ </span>
                    <span style={{ color: "var(--fg-dim)" }}>{p.messagingToAvoid}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full brief CTA + panel */}
        {!briefHtml ? (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(165,182,214,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
            {p.verdict !== 'kill' && (
              <button
                onClick={handleFullBrief}
                disabled={loadingBrief}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: "var(--radius)", border: "1px solid rgba(96,165,250,0.25)", background: "rgba(96,165,250,0.06)", color: "#60a5fa", fontSize: "0.81rem", fontWeight: 600, cursor: loadingBrief ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.1s" }}
                onMouseEnter={e => { if (!loadingBrief) (e.currentTarget as HTMLButtonElement).style.background = "rgba(96,165,250,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(96,165,250,0.06)"; }}
              >
                {loadingBrief
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Generating full brief…</>
                  : <><Sparkles size={11} /> Full brief + competitors + build plan</>}
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(165,182,214,0.08)", paddingTop: 14 }}>
            {/* Brief header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Full brief</span>
              <button
                onClick={handleBuild}
                disabled={buildBusy}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: "var(--radius)", border: "none", background: "#22c55e", color: "#050d1e", fontSize: "0.85rem", fontWeight: 700, cursor: buildBusy ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {buildBusy
                  ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Creating project…</>
                  : <>⚒ Build this</>}
              </button>
            </div>
            {/* Brief content */}
            <div
              className="brief-content"
              dangerouslySetInnerHTML={{ __html: briefHtml }}
              style={{ fontSize: "0.89rem", lineHeight: 1.75, color: "var(--fg-muted)" }}
            />
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleBuild}
                disabled={buildBusy}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: "var(--radius)", border: "none", background: "#22c55e", color: "#050d1e", fontSize: "0.89rem", fontWeight: 700, cursor: buildBusy ? "default" : "pointer", fontFamily: "inherit" }}
              >
                {buildBusy ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Creating project…</> : <>⚒ Build this →</>}
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function ClassificationRow({ c, colSpan }: { c: OpportunityClassification; colSpan: number }) {
  if (!c.accept) return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "5px 12px 8px 26px", background: "rgba(239,68,68,0.02)", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "0.85rem", color: "#ef4444" }}>✗ Not a B2B opportunity{c.rejectReason ? ` - ${c.rejectReason}` : ''}</span>
      </td>
    </tr>
  );

  const sv = c.solopreneurViability;
  const svColor = sv >= 8 ? "#22c55e" : sv >= 6 ? "#f59e0b" : "#94a3b8";

  return (
    <tr style={{ background: "rgba(8,12,24,0.5)" }}>
      <td colSpan={colSpan} style={{ padding: "10px 14px 10px 26px", borderBottom: "1px solid var(--border)" }}>
        {/* 4-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr 180px", gap: "0 20px", alignItems: "start" }}>

          {/* Col 1: Score */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Viability</span>
            <span style={{ fontSize: "0.93rem", fontWeight: 700, color: svColor }}>{sv}/10</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>{c.marketMaturity}</span>
              <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>{c.implementationComplexity} to build</span>
              <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>{c.buyerSophistication}</span>
              {c.scalingBreakpoint && <span style={{ fontSize: "0.79rem", color: "#f59e0b" }}>⚡ breaks at scale</span>}
              {c.hasExistingSpend && <span style={{ fontSize: "0.79rem", color: "#22c55e" }}>💳 existing spend</span>}
            </div>
          </div>

          {/* Col 2: Workflow */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Workflow</span>
            {c.workflowGraph && c.workflowGraph !== "N/A" && (
              <span style={{ fontSize: "0.81rem", color: "#60a5fa", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>{c.workflowGraph}</span>
            )}
            <span style={{ fontSize: "0.77rem", color: "var(--fg-muted)", fontWeight: 500 }}>{c.workflowType}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: "0.89rem" }}>
              {c.isRecurring && <span style={{ color: "#22c55e" }}>● {c.recurringFrequency}</span>}
              {c.timeWastedPerWeek !== "unknown" && <span style={{ color: "#f59e0b" }}>{c.timeWastedPerWeek}</span>}
              {c.buyingStage !== "unaware" && <span style={{ color: "var(--fg-dim)" }}>{c.buyingStage}</span>}
              {c.switchingIntent === "high" && <span style={{ color: "#22c55e" }}>high switch intent</span>}
            </div>
            {c.existingTools.length > 0 && (
              <span style={{ fontSize: "0.89rem", color: "var(--fg-subtle)" }}>Tools: {c.existingTools.join(', ')}</span>
            )}
            {c.failedIncumbentSignals.length > 0 && (
              <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                {c.failedIncumbentSignals.map((s, i) => (
                  <span key={i} style={{ fontSize: "0.77rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 3, padding: "0 4px", color: "#f59e0b" }}>{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* Col 3: Wedge */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Wedge</span>
            {c.wedgeOpportunity && (
              <span style={{ fontSize: "0.87rem", color: "#7dd3fc", lineHeight: 1.5 }}>💡 {c.wedgeOpportunity}</span>
            )}
            {c.hiddenRisk && (
              <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)", marginTop: 2 }}>⚠ {c.hiddenRisk}</span>
            )}
          </div>

          {/* Col 4: Economics */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)" }}>Economics</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#22c55e" }}>{c.estimatedMrr}<span style={{ fontSize: "0.89rem", fontWeight: 400, color: "var(--fg-dim)" }}>/customer</span></span>
            <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>First MRR in {c.timeToFirstMrr}</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: "0.79rem", color: "var(--fg-dim)" }}>
              <span>GTM difficulty: {c.gtmDifficulty}/10</span>
              <span>Distribution ease: {c.distributionEase}/10</span>
              <span>Market saturation: {c.marketSaturation}/10</span>
              {c.crossVerticalPotential && <span style={{ color: "#a78bfa" }}>cross-vertical potential</span>}
            </div>
          </div>

        </div>
      </td>
    </tr>
  );
}

// ── Community heatmap ─────────────────────────────────────────────────────────

function CommunityHeatmap({ signals }: { signals: PainSignal[] }) {
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signals) map.set(s.subreddit, (map.get(s.subreddit) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [signals]);

  if (!counts.length) return null;
  const max = counts[0]![1];

  return (
    <div style={{ marginBottom: 10, padding: "10px 14px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
      <div style={{ fontSize: "0.89rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 8 }}>Top communities by signal count</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px 16px" }}>
        {counts.map(([sub, n]) => (
          <div key={sub} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.77rem", color: "var(--accent)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>r/{sub}</span>
            <div style={{ flex: 1, height: 3, background: "rgba(165,182,214,0.07)", borderRadius: 2 }}>
              <div style={{ height: "100%", width: `${(n / max) * 100}%`, background: "var(--accent)", borderRadius: 2, opacity: 0.5 }} />
            </div>
            <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)", flexShrink: 0 }}>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sortable + resizable table header cell ────────────────────────────────────

function Th({ col, width, currentSort, sortDir, onSort, onResizeStart }: {
  col: ColDef;
  width: number;
  currentSort: SortMode;
  sortDir: SortDir;
  onSort: (key: SortMode) => void;
  onResizeStart: (key: ColKey, e: React.MouseEvent) => void;
}) {
  const isActive = col.sortKey && currentSort === col.sortKey;
  const arrow = isActive ? (sortDir === "desc" ? " ↓" : " ↑") : "";
  return (
    <th style={{
      position: "relative",
      padding: "7px 18px 7px 8px",
      textAlign: col.align ?? "left",
      fontSize: "0.71rem",
      fontWeight: 700,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      color: isActive ? "var(--accent)" : "var(--fg-dim)",
      width,
      minWidth: width,
      maxWidth: width,
      userSelect: "none",
      whiteSpace: "nowrap",
      cursor: col.sortKey ? "pointer" : "default",
      boxSizing: "border-box",
    }}
      onClick={() => col.sortKey && onSort(col.sortKey)}
    >
      <Tooltip content={<span style={{ fontSize: "0.81rem", lineHeight: 1.55 }}>{col.tip}</span>} width={220} side="bottom">
        <span style={{ borderBottom: isActive ? "none" : "1px dotted rgba(165,182,214,0.3)" }}>
          {col.label}{arrow}
        </span>
      </Tooltip>
      {/* Resize handle */}
      <div
        onMouseDown={e => { e.stopPropagation(); onResizeStart(col.key, e); }}
        onClick={e => e.stopPropagation()}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize", zIndex: 1 }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(96,165,250,0.3)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
      />
    </th>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function FindPage() {
  const tracked = Route.useLoaderData() as TrackedCommunity[];
  const trackedSubreddits = tracked.map(c => c.subreddit);
  const navigate = useNavigate();

  const [scanning, setScanning] = useState(false);
  const [scanElapsed, setScanElapsed] = useState(0);
  const [scanPatternIdx, setScanPatternIdx] = useState(0);
  const [result, setResult] = useState<{ signals: PainSignal[]; patternsSearched: string[]; totalFound: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [loadingComments, setLoadingComments] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifications, setClassifications] = useState<Map<string, OpportunityClassification>>(new Map());
  const [playbooks, setPlaybooks] = useState<Map<string, SignalPlaybook>>(new Map());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [seoAngles, setSeoAngles] = useState<Map<string, CrossMarketSeo>>(new Map());
  const [analyzeConfig, setAnalyzeConfig] = useState<string>("10:6");
  const [scopeToTracked, setScopeToTracked] = useState(false);
  const [trackedSet, setTrackedSet] = useState<Set<string>>(() => new Set(tracked.map(c => c.subreddit)));
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(loadStarred);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set()); // used only for classification fallback
  const [loadingBriefIds, setLoadingBriefIds] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<{ sig: PainSignal; classification?: OpportunityClassification } | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const currentSessionIdRef = useRef<number | null>(null);

  const [painDimension, setPainDimension] = useState<string>("default");

  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [typeFilter, setTypeFilter] = useState<'all' | 'post' | 'comment'>('all');
  const [sortMode, setSortMode] = useState<SortMode>("best");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [keyword, setKeyword] = useState("");

  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(
    () => Object.fromEntries(COLUMNS.map(c => [c.key, c.defaultWidth])) as Record<ColKey, number>
  );
  const resizingRef = useRef<{ col: ColKey; startX: number; startW: number } | null>(null);

  function handleSortClick(key: SortMode) {
    if (sortMode === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortMode(key); setSortDir("desc"); }
  }

  function onResizeStart(col: ColKey, e: React.MouseEvent) {
    e.preventDefault();
    resizingRef.current = { col, startX: e.clientX, startW: colWidths[col] };
    function onMove(me: MouseEvent) {
      if (!resizingRef.current) return;
      const { col, startX, startW } = resizingRef.current;
      setColWidths(prev => ({ ...prev, [col]: Math.max(50, startW + me.clientX - startX) }));
    }
    function onUp() {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  function restoreEntry(e: HistoryEntry) {
    if (!e.signalsJson) return;
    try {
      setResult({ signals: JSON.parse(e.signalsJson), patternsSearched: [], totalFound: 0 });
      setCurrentSessionId(e.id);
      currentSessionIdRef.current = e.id;
      setPlaybooks(new Map());
      setSeoAngles(new Map());
      setClassifications(new Map());
      // Restore brief ids from localStorage
      try { localStorage.removeItem(`scan_briefs_${e.id}`); } catch { }
      if (e.analysisJson) {
        try {
          const { playbooks: pbs, seoAngles: seas } = JSON.parse(e.analysisJson) as { v: 2; playbooks: SignalPlaybook[]; seoAngles: CrossMarketSeo[] };
          setPlaybooks(new Map(pbs.map(p => [p.postId, p])));
          setSeoAngles(new Map(seas.map(s => [s.pattern, s])));
          setSortMode("viability");
        } catch { }
      } else if (e.classificationsJson) {
        try {
          const cls = JSON.parse(e.classificationsJson) as OpportunityClassification[];
          setClassifications(new Map(cls.map(r => [r.postId, r])));
          setSortMode("viability");
        } catch { }
      }
    } catch { }
  }

  useEffect(() => {
    getRecentFindScans().then(h => {
      setHistory(h);
      if (h[0]) restoreEntry(h[0]); // auto-restore last scan
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (!scanning) { setScanElapsed(0); setScanPatternIdx(0); return; }
    const start = Date.now();
    const TOTAL = PATTERNS_DISPLAY.length; // shown patterns
    const RATE_MS = 2_000; // ~2s per pattern (sequential with rate limiting)
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      setScanElapsed(secs);
      setScanPatternIdx(Math.min(TOTAL, Math.floor((Date.now() - start) / RATE_MS)));
    }, 500);
    return () => clearInterval(interval);
  }, [scanning]);
  useEffect(() => {
    if (!historyOpen) return;
    const fn = (e: MouseEvent) => { if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [historyOpen]);

  function buildCsv() {
    if (!result) return "";
    const escape = (v: unknown) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return `"${s}"`;
    };
    const headers = [
      "Title", "Subreddit", "Type", "Pattern",
      "Upvotes", "Comments", "Auth Score",
      "Manual", "Sheet", "Buyer",
      "Verdict", "Viability", "MRR", "Workflow", "Wedge",
      "Build", "Time to Revenue", "URL",
    ];
    const rows = result.signals.map(sig => {
      const pb = playbooks.get(sig.id);
      return [
        escape(sig.title), escape(sig.subreddit), escape(sig.type), escape(sig.matchedPattern),
        sig.score, sig.numComments, sig.authenticityScore,
        sig.hasManualMention ? "yes" : "", sig.hasSpreadsheetMention ? "yes" : "", sig.isBuyerCommunity ? "yes" : "",
        escape(pb?.verdict ?? ""), pb?.solopreneurViability ?? "", escape(pb?.estimatedMrr ?? ""),
        escape(pb?.workflowType ?? ""), escape(pb?.wedgeOpportunity ?? ""),
        escape(pb?.buildComplexity ?? ""), escape(pb?.timeToFirstRevenue ?? ""),
        escape(sig.permalink),
      ].join(",");
    });
    return [headers.join(","), ...rows].join("\n");
  }

  function exportToCsv() {
    const csv = buildCsv();
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scan-signals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [csvCopied, setCsvCopied] = useState(false);
  function copyAsCsv() {
    const csv = buildCsv();
    if (!csv) return;
    navigator.clipboard.writeText(csv).then(() => {
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    });
  }

  async function handleScan() {
    // Reset ALL analysis + filter state so new results are always visible
    setScanning(true);
    setError(null);
    setClassifications(new Map());
    setPlaybooks(new Map());
    setSeoAngles(new Map());
    setAnalyzingIds(new Set());
    setExpandedRows(new Set());
    setFilterMode("all");
    setVerdictFilter("all");
    setTypeFilter("all");
    setSortMode("best");
    setKeyword("");
    try {
      const dim = PAIN_DIMENSIONS[painDimension];
      const patterns = dim && painDimension !== "default" ? dim.patterns : undefined;
      const consumerMode = dim?.isConsumer ?? false;
      const data = await scanForPain({ data: { limit: 300, timeRange, includeComments: false, subreddits: scopeToTracked ? trackedSubreddits : undefined, patterns, consumerMode } });
      setResult(data);
      getRecentFindScans().then(h => { setHistory(h); if (h[0]) { setCurrentSessionId(h[0].id); currentSessionIdRef.current = h[0].id; } }).catch(() => { });
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Scan failed."); }
    finally { setScanning(false); }
  }

  async function handleLoadComments() {
    if (!result) return;
    setLoadingComments(true);
    try {
      const dim = PAIN_DIMENSIONS[painDimension];
      const patterns = dim && painDimension !== "default" ? dim.patterns : undefined;
      const consumerMode = dim?.isConsumer ?? false;
      const data = await scanForPain({ data: { limit: 300, timeRange, includeComments: true, skipPosts: true, subreddits: scopeToTracked ? trackedSubreddits : undefined, patterns, consumerMode } });
      const existing = new Set(result.signals.map(s => s.id));
      const news = data.signals.filter(s => !existing.has(s.id));
      setResult(prev => prev ? { ...prev, signals: [...prev.signals, ...news], totalFound: prev.totalFound + news.length } : prev);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed."); }
    finally { setLoadingComments(false); }
  }

  async function handleClassify() {
    if (!result) return;
    setClassifying(true);
    try {
      const candidates = result.signals.filter(s => s.authenticityScore >= 6).slice(0, 20)
        .map(s => ({ id: s.id, title: s.title, body: s.body, subreddit: s.subreddit, matchedPattern: s.matchedPattern }));
      const res = await classifyOpportunities({ data: { signals: candidates } });
      const map = new Map(res.map(r => [r.postId, r]));
      setClassifications(map);
      setSortMode("viability");
      setFilterMode("opportunities");
      const toExpand = new Set(res.filter(r => r.accept && r.solopreneurViability >= 7).map(r => r.postId));
      setExpandedRows(toExpand);
      // Persist classifications into the scan session
      if (currentSessionId) {
        saveScanClassifications({ data: { sessionId: currentSessionId, classificationsJson: JSON.stringify(res) } }).catch(() => { });
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Classification failed."); }
    finally { setClassifying(false); }
  }

  async function analyzeSingleSignal(sig: PainSignal) {
    if (!result || analyzingIds.has(sig.id) || playbooks.has(sig.id)) return;
    setAnalyzingIds(prev => new Set(prev).add(sig.id));
    const related = result.signals
      .filter(s => s.id !== sig.id && (s.subreddit === sig.subreddit || s.matchedPattern === sig.matchedPattern))
      .slice(0, 10)
      .map(s => ({ title: s.title, subreddit: s.subreddit, matchedPattern: s.matchedPattern }));
    try {
      const pb = await analyzeSignal({
        data: {
          signal: { id: sig.id, title: sig.title, body: sig.body, subreddit: sig.subreddit, permalink: sig.permalink, matchedPattern: sig.matchedPattern },
          relatedSignals: related,
        },
      });
      setPlaybooks(prev => new Map(prev).set(sig.id, pb));
    } catch { }
    setAnalyzingIds(prev => { const n = new Set(prev); n.delete(sig.id); return n; });
  }

  async function handleDeepAnalyze() {
    if (!result) return;
    const { limit, minScore } = parseAnalyzeConfig(analyzeConfig);
    const top = result.signals
      .filter(s => s.authenticityScore >= minScore)
      .slice(0, limit ?? result.signals.length);

    setAnalyzingIds(new Set(top.map(s => s.id)));
    setExpandedRows(prev => new Set([...prev, ...top.map(s => s.id)]));

    const allPlaybooks: SignalPlaybook[] = [];

    // Run 3 at a time - each resolves independently so results appear progressively
    const BATCH = 3;
    for (let i = 0; i < top.length; i += BATCH) {
      await Promise.all(top.slice(i, i + BATCH).map(async sig => {
        const related = result.signals
          .filter(s => s.id !== sig.id && (s.subreddit === sig.subreddit || s.matchedPattern === sig.matchedPattern))
          .slice(0, 10)
          .map(s => ({ title: s.title, subreddit: s.subreddit, matchedPattern: s.matchedPattern }));
        try {
          const pb = await analyzeSignal({
            data: {
              signal: { id: sig.id, title: sig.title, body: sig.body, subreddit: sig.subreddit, permalink: sig.permalink, matchedPattern: sig.matchedPattern },
              relatedSignals: related,
            },
          });
          allPlaybooks.push(pb);
          setPlaybooks(prev => new Map(prev).set(sig.id, pb));
          if (pb.verdict === 'go' || pb.solopreneurViability >= 7) {
            setExpandedRows(prev => new Set(prev).add(sig.id));
          }
        } catch { }
        setAnalyzingIds(prev => { const n = new Set(prev); n.delete(sig.id); return n; });
      }));
    }

    // SEO angles after all playbooks complete
    const patternMap = new Map<string, { subs: Set<string>; sigs: typeof result.signals }>();
    for (const sig of result.signals) {
      if (!patternMap.has(sig.matchedPattern)) patternMap.set(sig.matchedPattern, { subs: new Set(), sigs: [] });
      const e = patternMap.get(sig.matchedPattern)!;
      e.subs.add(sig.subreddit); e.sigs.push(sig);
    }
    const clusters = [...patternMap.entries()]
      .filter(([, v]) => v.subs.size >= 2)
      .sort((a, b) => b[1].subs.size - a[1].subs.size)
      .slice(0, 8)
      .map(([pattern, { subs, sigs }]) => ({ pattern, communityCount: subs.size, signalCount: sigs.length, subreddits: [...subs], sampleTitles: sigs.slice(0, 3).map(s => s.title) }));

    const sid = currentSessionIdRef.current;

    // Strip fetchedComments before persisting (display-only, bloats storage)
    const playbooksToSave = allPlaybooks.map(p => ({ ...p, fetchedComments: [] }));

    if (clusters.length > 0) {
      try {
        const angles = await getCrossMarketSeo({ data: { clusters } });
        setSeoAngles(new Map(angles.map(a => [a.pattern, a])));
        if (sid && playbooksToSave.length > 0) {
          await saveScanAnalysis({ data: { sessionId: sid, playbooks: playbooksToSave, seoAngles: angles } });
          getRecentFindScans().then(setHistory).catch(() => { });
        }
      } catch { }
    } else if (sid && playbooksToSave.length > 0) {
      await saveScanAnalysis({ data: { sessionId: sid, playbooks: playbooksToSave, seoAngles: [] } });
      getRecentFindScans().then(setHistory).catch(() => { });
    }
  }

  async function handleTrack(subreddit: string) {
    setTrackingInProgress(prev => new Set(prev).add(subreddit));
    try { await trackScannedCommunities({ data: { subreddits: [subreddit] } }); setTrackedSet(prev => new Set(prev).add(subreddit)); }
    catch { }
    setTrackingInProgress(prev => { const n = new Set(prev); n.delete(subreddit); return n; });
  }

  function toggleStar(id: string) {
    setStarred(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); saveStarred(n); return n; });
  }

  function toggleExpanded(id: string) {
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleSaveOpportunity(sig: PainSignal, c: OpportunityClassification) {
    try {
      await saveOpportunityFromSignal({
        data: {
          signal: { title: sig.title, body: sig.body, subreddit: sig.subreddit, permalink: sig.permalink, authenticityScore: sig.authenticityScore },
          classification: c,
        }
      });
      setSavedIds(prev => new Set(prev).add(sig.id));
    } catch { }
  }

  async function handleBuildProject(sig: PainSignal, pb: SignalPlaybook) {
    setLoadingBriefIds(prev => new Set(prev).add(sig.id));
    try {
      // Build a rich description from all playbook fields so generateFullOpportunityFromDescription
      // has maximum context - produces same quality as /i/$id/opportunities
      const descParts = [
        `## Opportunity: ${pb.workflowType || sig.title}`,
        `**Subreddit:** r/${sig.subreddit}`,
        `**Matched pattern:** "${sig.matchedPattern}"`,
        pb.verdictReason ? `**Verdict:** ${pb.verdict} - ${pb.verdictReason}` : '',
        pb.wedgeOpportunity ? `**Product wedge:** ${pb.wedgeOpportunity}` : '',
        pb.userPersona ? `**Target buyer:** ${pb.userPersona}` : '',
        pb.distributionStrategy ? `**How to reach them:** ${pb.distributionStrategy}` : '',
        pb.messagingThatWorks ? `**Messaging that works:** ${pb.messagingThatWorks}` : '',
        pb.messagingToAvoid ? `**Avoid saying:** ${pb.messagingToAvoid}` : '',
        pb.estimatedMrr ? `**MRR estimate:** ${pb.estimatedMrr}` : '',
        pb.buildComplexity ? `**Build complexity:** ${pb.buildComplexity}` : '',
        pb.timeToFirstRevenue ? `**Time to first revenue:** ${pb.timeToFirstRevenue}` : '',
        pb.recurrenceNote ? `**Recurrence:** ${pb.recurrenceNote}` : '',
        pb.failedSolutions.length > 0 ? `**Failed solutions:** ${pb.failedSolutions.join(', ')}` : '',
        pb.commentEvidence.length > 0
          ? `**Direct quotes from users:**\n${pb.commentEvidence.map(q => `- "${q}"`).join('\n')}` : '',
        sig.body ? `**Original post:**\n${sig.body.slice(0, 600)}` : '',
      ].filter(Boolean).join('\n\n');

      const { projectId, opportunityId } = await buildFullProjectFromOp({
        data: {
          title: pb.workflowType || sig.title,
          description: descParts,
          communities: [sig.subreddit],
          hypothesis: pb.wedgeOpportunity || pb.verdictReason || sig.title,
        }
      });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/i/$id/opportunities", params: { id: String(projectId) }, search: { opp: opportunityId } });
    } catch { }
    setLoadingBriefIds(prev => { const n = new Set(prev); n.delete(sig.id); return n; });
  }

  const filtered = useMemo(() => {
    if (!result) return [];
    let list = [...result.signals];
    if (filterMode === "buyer") list = list.filter(s => s.isBuyerCommunity);
    if (filterMode === "manual") list = list.filter(s => s.hasManualMention);
    if (filterMode === "spreadsheet") list = list.filter(s => s.hasSpreadsheetMention);
    if (filterMode === "opportunities") list = list.filter(s => { const c = classifications.get(s.id); return c?.accept && (c.solopreneurViability ?? 0) >= 7; });
    if (verdictFilter !== "all") list = list.filter(s => playbooks.get(s.id)?.verdict === verdictFilter);
    if (typeFilter !== "all") list = list.filter(s => s.type === typeFilter);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(s => s.title.toLowerCase().includes(kw) || s.body.toLowerCase().includes(kw) || s.subreddit.toLowerCase().includes(kw));
    }
    const d = sortDir === "desc" ? 1 : -1;
    if (sortMode === "viability") list.sort((a, b) => d * ((playbooks.get(b.id)?.solopreneurViability ?? classifications.get(b.id)?.solopreneurViability ?? 0) - (playbooks.get(a.id)?.solopreneurViability ?? classifications.get(a.id)?.solopreneurViability ?? 0)));
    else if (sortMode === "upvotes") list.sort((a, b) => d * (b.score - a.score));
    else if (sortMode === "comments") list.sort((a, b) => d * (b.numComments - a.numComments));
    else if (sortMode === "newest") list.sort((a, b) => d * (b.createdUtc - a.createdUtc));
    else if (sortMode === "title") list.sort((a, b) => d * a.title.localeCompare(b.title));
    else if (sortMode === "subscribers") list.sort((a, b) => d * ((b.subredditSubscribers ?? 0) - (a.subredditSubscribers ?? 0)));
    else if (sortMode === "authscore") list.sort((a, b) => d * (b.authenticityScore - a.authenticityScore));
    return list;
  }, [result, filterMode, verdictFilter, typeFilter, sortMode, sortDir, keyword, classifications, playbooks]);

  const hasComments = result?.signals.some(s => s.type === 'comment') ?? false;
  const opportunityCount = [...classifications.values()].filter(c => c.accept && c.solopreneurViability >= 7).length;

  const sortOptions = useMemo(() => [
    { value: "best" as SortMode, label: "Best match" },
    ...(classifications.size > 0 ? [{ value: "viability" as SortMode, label: "Opportunity score" }] : []),
    { value: "upvotes" as SortMode, label: "Most upvoted" },
    { value: "comments" as SortMode, label: "Most discussed" },
    { value: "newest" as SortMode, label: "Newest" },
  ], [classifications.size]);

  return (
    <div style={{ padding: "24px", minHeight: "100%", boxSizing: "border-box" }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        /* Brighter muted text inside the scan table */
        table { --fg-dim: rgba(165,182,214,0.65); --fg-subtle: rgba(192,208,229,0.92); --fg-muted: rgba(239,245,255,0.98); }
        .pill{cursor:pointer;border:1px solid var(--border);border-radius:5px;padding:3px 9px;font-size:0.71rem;font-weight:500;background:transparent;color:var(--fg-subtle);font-family:inherit;transition:all 0.1s}
        .pill:hover{border-color:rgba(165,182,214,0.3);color:var(--fg-muted)}
        .pill.on{background:rgba(96,165,250,0.09);border-color:rgba(96,165,250,0.28);color:var(--accent)}
        .pill.on-green{background:rgba(34,197,94,0.07);border-color:rgba(34,197,94,0.25);color:#22c55e}
        .kw{background:rgba(165,182,214,0.04);border:1px solid var(--border);border-radius:5px;color:var(--fg);font-size:0.72rem;padding:3px 10px;font-family:inherit;outline:none;width:160px}
        .kw:focus{border-color:rgba(165,182,214,0.3)}
        .brief-content h2{font-size:0.82rem;font-weight:700;color:var(--fg);margin:14px 0 5px;letter-spacing:-0.01em}
        .brief-content h3{font-size:0.76rem;font-weight:600;color:var(--fg-muted);margin:10px 0 4px}
        .brief-content p{margin:0 0 8px;font-size:0.78rem;color:var(--fg-subtle);line-height:1.65}
        .brief-content ul,.brief-content ol{margin:0 0 8px;padding-left:18px}
        .brief-content li{font-size:0.78rem;color:var(--fg-subtle);line-height:1.6;margin-bottom:2px}
        .brief-content table{width:100%;border-collapse:collapse;margin:8px 0;font-size:0.74rem}
        .brief-content th{padding:5px 10px;text-align:left;font-weight:600;color:var(--fg-dim);font-size:0.64rem;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid var(--border)}
        .brief-content td{padding:6px 10px;color:var(--fg-subtle);border-bottom:1px solid rgba(165,182,214,0.05);vertical-align:top}
        .brief-content strong{color:var(--fg);font-weight:600}
        .sig-row{transition:background 0.08s}
        .sig-row:hover{background:rgba(165,182,214,0.025) !important}
        .icon-btn{background:transparent;border:none;cursor:pointer;padding:2px 4px;color:var(--fg-dim);transition:color 0.1s;line-height:1}
        .icon-btn:hover{color:var(--fg-muted)}
        th{white-space:nowrap}
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--fg)", letterSpacing: "-0.02em" }}>Scan</h1>
          <div style={{ marginTop: 3, fontSize: "0.77rem", color: "var(--fg-dim)", display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={10} />
            {scopeToTracked && trackedSubreddits.length > 0
              ? <><span>Scoped to</span><span style={{ color: "var(--accent)" }}>{trackedSubreddits.length} tracked communities</span></>
              : <><span>Global Reddit</span><span>·</span><Link to="/verticals" style={{ color: "var(--accent)", textDecoration: "none" }}>{trackedSubreddits.length} communities tracked</Link></>
            }
            {painDimension !== "default" && (
              <><span>·</span><span style={{ color: PAIN_DIMENSIONS[painDimension]?.isConsumer ? "#34d399" : "#a78bfa" }}>{PAIN_DIMENSIONS[painDimension]?.description}</span></>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Pain dimension picker */}
          <Dropdown
            value={painDimension}
            options={Object.entries(PAIN_DIMENSIONS).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={setPainDimension}
            align="right"
          />

          <div style={{ display: "flex", gap: 1, background: "rgba(100,130,180,0.06)", borderRadius: 6, padding: 2 }}>
            {(['day', 'week', 'month', 'year'] as const).map(v => (
              <button key={v} onClick={() => setTimeRange(v)}
                style={{ fontSize: "0.93rem", fontWeight: 600, padding: "3px 8px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit", background: timeRange === v ? "var(--accent)" : "transparent", color: timeRange === v ? "#050d1e" : "var(--fg-subtle)" }}>
                {v === 'day' ? '1d' : v === 'week' ? '7d' : v === 'month' ? '30d' : '1y'}
              </button>
            ))}
          </div>
          {trackedSubreddits.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.77rem", color: scopeToTracked ? "var(--accent)" : "var(--fg-subtle)", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={scopeToTracked} onChange={e => setScopeToTracked(e.target.checked)} style={{ accentColor: "var(--accent)", cursor: "pointer" }} />
              Tracked only
            </label>
          )}
          {history.length > 0 && (
            <div ref={historyRef} style={{ position: "relative" }}>
              <button onClick={() => setHistoryOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: "var(--fg-subtle)", fontSize: "0.77rem", cursor: "pointer", fontFamily: "inherit" }}>
                <History size={11} /> History
              </button>
              {historyOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 5px)", right: 0, width: 210, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.35)", zIndex: 50, overflow: "hidden" }}>
                  {history.map((e, i) => (
                    <button key={e.id} onClick={() => { restoreEntry(e); setHistoryOpen(false); }}
                      disabled={!e.signalsJson}
                      style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "7px 12px", background: currentSessionId === e.id ? "rgba(96,165,250,0.06)" : "transparent", border: "none", borderBottom: i < history.length - 1 ? "1px solid var(--border)" : "none", cursor: e.signalsJson ? "pointer" : "default", fontFamily: "inherit" }}>
                      <span style={{ fontSize: "0.79rem", color: "var(--fg-muted)" }}>{e.signalCount} signals{e.analysisJson ? <span style={{ color: "#22c55e", marginLeft: 5 }}>✓</span> : ''}</span>
                      <span style={{ fontSize: "0.73rem", color: "var(--fg-dim)" }}>{new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {result && (
            <>
              <button onClick={exportToCsv}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: "var(--fg-subtle)", fontSize: "0.77rem", cursor: "pointer", fontFamily: "inherit" }}>
                <Download size={11} /> Export CSV
              </button>
              <button onClick={copyAsCsv}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: csvCopied ? "#22c55e" : "var(--fg-subtle)", fontSize: "0.77rem", cursor: "pointer", fontFamily: "inherit" }}>
                {csvCopied ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy CSV</>}
              </button>
            </>
          )}
          <Button variant="primary" size="sm" onClick={handleScan} disabled={scanning} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {scanning ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={12} />}
            {scanning ? "Scanning…" : "Scan"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "var(--radius)", fontSize: "0.85rem", color: "#ef4444" }}>{error}</div>}

      {/* Empty state */}
      {!scanning && !result && !error && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 360, textAlign: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ maxWidth: 380 }}>
            <h2 style={{ margin: "0 0 5px", fontSize: "0.96rem", fontWeight: 600, color: "var(--fg)" }}>B2B workflow pain scanner</h2>
            <p style={{ margin: 0, fontSize: "0.87rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
              Finds recurring operational pain across Reddit. Run Analyze to surface solopreneur opportunities.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxWidth: 480, justifyContent: "center" }}>
            {PATTERNS_DISPLAY.map(p => (
              <span key={p} style={{ padding: "2px 8px", background: "rgba(165,182,214,0.04)", border: "1px solid var(--border)", borderRadius: 99, fontSize: "0.73rem", color: "var(--fg-subtle)", fontFamily: "'JetBrains Mono', monospace" }}>"{p}"</span>
            ))}
          </div>
          <Button variant="primary" onClick={handleScan} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Zap size={13} /> Scan for Pain
          </Button>
        </div>
      )}

      {/* Scanning */}
      {scanning && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 16 }}>
          <Loader2 size={24} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--fg)" }}>Searching Reddit…</span>
              {painDimension !== "default" && (
                <span style={{ fontSize: "0.77rem", color: "#a78bfa", fontWeight: 600 }}>{PAIN_DIMENSIONS[painDimension]?.label}</span>
              )}
              <span style={{ fontSize: "0.81rem", color: "var(--accent)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {scanPatternIdx}/{PATTERNS_DISPLAY.length} patterns
              </span>
              <span style={{ fontSize: "0.77rem", color: "var(--fg-dim)", fontVariantNumeric: "tabular-nums" }}>{scanElapsed}s</span>
            </div>
            {/* Progress bar */}
            <div style={{ width: 320, height: 2, background: "rgba(165,182,214,0.08)", borderRadius: 1, margin: "0 auto 12px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(scanPatternIdx / PATTERNS_DISPLAY.length) * 100}%`, background: "var(--accent)", borderRadius: 1, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", maxWidth: 420 }}>
              {PATTERNS_DISPLAY.map((p, i) => (
                <span key={p} style={{ padding: "2px 7px", background: i < scanPatternIdx ? "rgba(96,165,250,0.1)" : "rgba(96,165,250,0.04)", border: `1px solid ${i < scanPatternIdx ? "rgba(96,165,250,0.25)" : "rgba(96,165,250,0.08)"}`, borderRadius: 99, fontSize: "0.89rem", color: i < scanPatternIdx ? "var(--accent)" : "var(--fg-dim)", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.3s" }}>"{p}"</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && !scanning && (
        <>
          {/* Stats + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "7px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12, fontSize: "0.81rem" }}>
              <span><b style={{ color: "var(--fg)" }}>{result.totalFound}</b> <span style={{ color: "var(--fg-subtle)" }}>signals</span></span>
              <span><b style={{ color: "#22c55e" }}>{result.signals.filter(s => s.isBuyerCommunity).length}</b> <span style={{ color: "var(--fg-subtle)" }}>buyer</span></span>
              <span><b style={{ color: "#f59e0b" }}>{result.signals.filter(s => s.hasManualMention).length}</b> <span style={{ color: "var(--fg-subtle)" }}>manual</span></span>
              {opportunityCount > 0 && <span><b style={{ color: "#22c55e" }}>{opportunityCount}</b> <span style={{ color: "var(--fg-subtle)" }}>opportunities</span></span>}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => setShowHeatmap(v => !v)}
                style={{ fontSize: "0.83rem", color: showHeatmap ? "var(--accent)" : "var(--fg-dim)", background: "transparent", border: "none", cursor: "pointer", padding: "2px 5px" }}>
                {showHeatmap ? "▼" : "▶"} Communities
              </button>
              {!hasComments && (
                <Button variant="ghost" size="sm" onClick={handleLoadComments} disabled={loadingComments} style={{ fontSize: "0.83rem", display: "flex", alignItems: "center", gap: 3 }}>
                  {loadingComments ? <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> : "💬"} {loadingComments ? "Loading…" : "Comments"}
                </Button>
              )}
              {playbooks.size === 0 && analyzingIds.size === 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <Dropdown
                    value={analyzeConfig}
                    options={ANALYZE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                    onChange={setAnalyzeConfig}
                    align="right"
                  />
                  <Button variant="ghost" size="sm" onClick={handleDeepAnalyze}
                    style={{ fontSize: "0.83rem", display: "flex", alignItems: "center", gap: 3 }}>
                    ✦ Analyze
                  </Button>
                </div>
              ) : analyzingIds.size > 0 ? (
                <span style={{ fontSize: "0.83rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} />
                  Analyzing with Claude Sonnet…
                </span>
              ) : (
                <span style={{ fontSize: "0.83rem", color: "#22c55e" }}>✓ {playbooks.size} playbooks + SEO</span>
              )}
              <Button variant="ghost" size="sm" onClick={handleScan} style={{ fontSize: "0.83rem", display: "flex", alignItems: "center", gap: 3 }}>
                <Zap size={9} /> Re-scan
              </Button>
            </div>
          </div>

          {showHeatmap && <CommunityHeatmap signals={result.signals} />}

          {/* Cross-market patterns */}
          <CrossMarketPatterns signals={result.signals} playbooks={playbooks} seoAngles={seoAngles} />

          {/* Filter + sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <Filter size={11} style={{ color: "var(--fg-dim)" }} />
            {([
              { mode: "all" as FilterMode, label: "All" },
              { mode: "opportunities" as FilterMode, label: `Opportunities${opportunityCount > 0 ? ` (${opportunityCount})` : ''}`, disabled: opportunityCount === 0 },
              { mode: "buyer" as FilterMode, label: "Buyer" },
              { mode: "manual" as FilterMode, label: "Manual" },
            ]).map(({ mode, label, disabled }) => (
              <button key={mode}
                className={`pill${filterMode === mode ? (mode === "opportunities" ? " on-green" : " on") : ""}`}
                onClick={() => !disabled && setFilterMode(mode)}
                style={{ opacity: disabled ? 0.3 : 1, cursor: disabled ? "default" : "pointer" }}>
                {label}
              </button>
            ))}
            <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 2px" }} />
            {(["all", "post", "comment"] as const).map(t => (
              <button key={t} className={`pill${typeFilter === t ? " on" : ""}`} onClick={() => setTypeFilter(t)}>
                {t === "all" ? "All" : t === "post" ? "Posts" : "Comments"}
              </button>
            ))}
            {playbooks.size > 0 && (
              <>
                <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 2px" }} />
                {([
                  { v: "all" as VerdictFilter, label: "All verdicts" },
                  { v: "go" as VerdictFilter, label: "Go", color: "#22c55e" },
                  { v: "maybe" as VerdictFilter, label: "Maybe", color: "#f59e0b" },
                  { v: "kill" as VerdictFilter, label: "Kill", color: "#ef4444" },
                ]).map(({ v, label, color }) => (
                  <button key={v} onClick={() => setVerdictFilter(v)}
                    className={`pill${verdictFilter === v ? " on" : ""}`}
                    style={verdictFilter === v && color ? { background: `${color}18`, borderColor: `${color}44`, color } : {}}>
                    {color && <span style={{ color, marginRight: 3, fontSize: "0.73rem" }}>●</span>}{label}
                  </button>
                ))}
              </>
            )}
            <div style={{ flex: 1 }} />
            <input className="kw" type="text" placeholder="Search…" value={keyword} onChange={e => setKeyword(e.target.value)} />
            <span style={{ fontSize: "0.83rem", color: "var(--fg-dim)" }}>{filtered.length}</span>
          </div>

          {/* Table */}
          {(() => {
            const showAnalysisCols = playbooks.size > 0 || analyzingIds.size > 0;
            const visibleCols = COLUMNS.filter(c => !c.analysisOnly || showAnalysisCols);
            const tableWidth = visibleCols.reduce((s, c) => s + colWidths[c.key], 0);
            return filtered.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.87rem", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                {result.signals.length === 0
                  ? <span>Scan returned 0 signals. Check server logs for [scanForPain] output.</span>
                  : <>
                    <span>
                      {result.signals.length} signals received from server, but all filtered out.
                      {filterMode !== "all" && <> Filter: <b style={{ color: "var(--accent)" }}>{filterMode}</b>.</>}
                      {verdictFilter !== "all" && <> Verdict: <b style={{ color: "var(--accent)" }}>{verdictFilter}</b>.</>}
                      {typeFilter !== "all" && <> Type: <b style={{ color: "var(--accent)" }}>{typeFilter}</b>.</>}
                      {keyword && <> Keyword: <b style={{ color: "var(--accent)" }}>"{keyword}"</b>.</>}
                    </span>
                    <button onClick={() => { setFilterMode("all"); setVerdictFilter("all"); setTypeFilter("all"); setKeyword(""); setSortMode("best"); }}
                      style={{ padding: "5px 14px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit" }}>
                      Reset all filters
                    </button>
                  </>
                }
              </div>
            ) : (
              <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflowX: "auto", background: "var(--bg-elevated)" }}>
                <table style={{ borderCollapse: "collapse", fontSize: "0.87rem", width: "100%", minWidth: tableWidth, tableLayout: "fixed" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "rgba(165,182,214,0.02)" }}>
                      {COLUMNS
                        .filter(c => !c.analysisOnly || showAnalysisCols)
                        .map(col => (
                          <Th key={col.key} col={col} width={colWidths[col.key]}
                            currentSort={sortMode} sortDir={sortDir}
                            onSort={handleSortClick} onResizeStart={onResizeStart} />
                        ))
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((sig, idx) => {
                      const authColor = sig.authenticityScore >= 7 ? "#22c55e" : sig.authenticityScore >= 5 ? "#f59e0b" : "#94a3b8";
                      const c = classifications.get(sig.id);
                      const pb = playbooks.get(sig.id);
                      const isAnalyzing = analyzingIds.has(sig.id);
                      const isExpanded = expandedRows.has(sig.id); // only used for classification fallback
                      const isStarred = starred.has(sig.id);
                      const isSaved = savedIds.has(sig.id);
                      const isLoadingBrief = loadingBriefIds.has(sig.id);
                      const verdictColor = pb?.verdict === 'go' ? "#22c55e" : pb?.verdict === 'maybe' ? "#f59e0b" : "#ef4444";
                      const leftColor = pb ? (pb.verdict === 'go' ? "#22c55e" : pb.verdict === 'maybe' ? "#f59e0b" : "rgba(239,68,68,0.15)") : isStarred ? "#fbbf24" : sig.hasManualMention ? "#f59e0b" : "transparent";

                      return (
                        <React.Fragment key={sig.id}>
                          <tr id={`signal-row-${sig.id}`} className="sig-row" style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--border)" : "none", borderLeft: `2px solid ${leftColor}`, background: isStarred ? "rgba(250,204,21,0.015)" : "transparent", verticalAlign: "top" }}>

                            {/* Signal */}
                            <td style={{ padding: "9px 12px" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 2 }}>
                                {sig.type === 'comment' && <span style={{ fontSize: "0.83rem", fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.18)", flexShrink: 0, marginTop: 2 }}>CMT</span>}
                                <a href={sig.permalink} target="_blank" rel="noopener noreferrer"
                                  style={{ color: "var(--fg)", textDecoration: "none", fontWeight: 500, fontSize: "0.91rem", lineHeight: 1.35 }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)"; }}>
                                  {sig.title}
                                </a>
                              </div>
                              {/* Inline tags */}
                              <div style={{ display: "flex", gap: 3, flexWrap: "wrap", margin: "3px 0" }}>
                                {sig.hasManualMention && <span style={{ fontSize: "0.93rem", fontWeight: 700, padding: "0 4px", borderRadius: 3, background: "rgba(245,158,11,0.07)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.15)" }}>Manual</span>}
                                {sig.hasSpreadsheetMention && <span style={{ fontSize: "0.93rem", fontWeight: 700, padding: "0 4px", borderRadius: 3, background: "rgba(245,158,11,0.07)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.15)" }}>Sheet</span>}
                                {sig.isBuyerCommunity && <span style={{ fontSize: "0.93rem", fontWeight: 700, padding: "0 4px", borderRadius: 3, background: "rgba(34,197,94,0.06)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)" }}>Buyer</span>}
                              </div>
                              {sig.body && sig.type === 'post' && (
                                <Tooltip side="bottom" width={380} content={<div style={{ fontSize: "0.81rem", lineHeight: 1.6, maxHeight: 300, overflow: "auto", color: "var(--fg)" }}>{sig.body.slice(0, 1000)}</div>}>
                                  <div style={{ fontSize: "0.85rem", color: "var(--fg-dim)", fontStyle: "italic", cursor: "default" }}>"{sig.matchedPattern}"</div>
                                </Tooltip>
                              )}
                              {(!sig.body || sig.type !== 'post') && (
                                <div style={{ fontSize: "0.85rem", color: "var(--fg-dim)", fontStyle: "italic" }}>"{sig.matchedPattern}"</div>
                              )}
                            </td>

                            {/* Community */}
                            <td style={{ padding: "9px 8px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <a href={`https://reddit.com/r/${sig.subreddit}`} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: "0.93rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
                                  r/{sig.subreddit}
                                </a>
                                {sig.subredditSubscribers != null && <span style={{ fontSize: "0.89rem", color: "var(--fg-dim)" }}>{fmtSubs(sig.subredditSubscribers)}</span>}
                                <span style={{ fontSize: "0.87rem", color: "var(--fg-dim)" }}>{timeAgo(sig.createdUtc)}</span>
                                {trackedSet.has(sig.subreddit)
                                  ? <span style={{ fontSize: "0.85rem", color: "#22c55e", display: "flex", alignItems: "center", gap: 2 }}><Check size={7} /> tracked</span>
                                  : <button onClick={() => handleTrack(sig.subreddit)} disabled={trackingInProgress.has(sig.subreddit)}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "0 5px", border: "1px solid var(--border)", borderRadius: 3, background: "transparent", fontSize: "0.93rem", color: "var(--fg-dim)", cursor: "pointer", fontFamily: "inherit" }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-dim)"; }}>
                                    {trackingInProgress.has(sig.subreddit) ? <Loader2 size={7} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={7} />} track
                                  </button>
                                }
                              </div>
                            </td>

                            {/* Engage */}
                            <td style={{ padding: "9px 8px", textAlign: "right" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "flex-end" }}>
                                <span style={{ fontSize: "0.81rem", color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>↑{sig.score}</span>
                                {pb?.fetchedComments?.length ? (
                                  <Tooltip side="bottom" width={420} content={
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.89rem", maxHeight: 400, overflow: "auto" }}>
                                      <div style={{ fontSize: "0.87rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)" }}>{pb.fetchedComments.length} comments</div>
                                      {pb.fetchedComments.map((fc, i) => <div key={i} style={{ color: "var(--fg)", lineHeight: 1.55, paddingBottom: 6, borderBottom: i < pb.fetchedComments.length - 1 ? "1px solid rgba(165,182,214,0.06)" : "none" }}>{fc}</div>)}
                                    </div>
                                  }>
                                    <span style={{ fontSize: "0.77rem", color: "var(--accent)", fontVariantNumeric: "tabular-nums", cursor: "default", borderBottom: "1px dotted rgba(96,165,250,0.3)" }}>💬{sig.numComments}</span>
                                  </Tooltip>
                                ) : (
                                  <span style={{ fontSize: "0.77rem", color: "var(--fg-subtle)", fontVariantNumeric: "tabular-nums" }}>💬{sig.numComments}</span>
                                )}
                              </div>
                            </td>

                            {/* Score */}
                            <td style={{ padding: "9px 8px", textAlign: "center" }}>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                <span style={{ fontSize: "0.87rem", fontWeight: 700, color: authColor }}>{sig.authenticityScore.toFixed(0)}</span>
                                <div style={{ width: 24, height: 2, background: "rgba(165,182,214,0.08)", borderRadius: 1 }}>
                                  <div style={{ height: "100%", width: `${(sig.authenticityScore / 10) * 100}%`, background: authColor, borderRadius: 1 }} />
                                </div>
                              </div>
                            </td>

                            {/* ── Analysis columns ─────────────────────────────── */}
                            {showAnalysisCols && <>

                              {/* Verdict */}
                              <td style={{ padding: "9px 8px" }}>
                                {isAnalyzing ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--fg-dim)" }}>
                                    <Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> analyzing…
                                  </div>
                                ) : pb ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: "0.87rem", fontWeight: 800, padding: "1px 5px", borderRadius: 3, background: `${verdictColor}14`, border: `1px solid ${verdictColor}33`, color: verdictColor, letterSpacing: "0.05em", textTransform: "uppercase" }}>{pb.verdict}</span>
                                      <span style={{ fontSize: "0.79rem", fontWeight: 700, color: verdictColor }}>{pb.solopreneurViability}/10</span>
                                    </div>
                                    <span style={{ fontSize: "0.83rem", color: "#22c55e", fontWeight: 600 }}>{pb.estimatedMrr}</span>
                                    {pb.verdictReason && <span style={{ fontSize: "0.75rem", color: "var(--fg-dim)", lineHeight: 1.4 }}>{pb.verdictReason}</span>}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => analyzeSingleSignal(sig)}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius)", border: "1px solid rgba(165,182,214,0.15)", background: "transparent", color: "var(--fg-dim)", fontSize: "0.71rem", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(96,165,250,0.3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(165,182,214,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-dim)"; }}
                                  >
                                    ✦ Analyze
                                  </button>
                                )}
                              </td>

                              {/* Workflow */}
                              <td style={{ padding: "9px 8px" }}>
                                {pb ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                    {pb.workflowType && <span style={{ fontSize: "0.77rem", color: "var(--fg-muted)", fontWeight: 500, lineHeight: 1.3 }}>{pb.workflowType}</span>}
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                      {pb.isRecurring && <span style={{ fontSize: "0.85rem", color: "#22c55e" }}>● {pb.recurringFrequency}</span>}
                                      {pb.buildComplexity && <span style={{ fontSize: "0.85rem", color: "var(--fg-dim)" }}>{pb.buildComplexity}</span>}
                                      {pb.timeToFirstRevenue && <span style={{ fontSize: "0.85rem", color: "var(--fg-dim)" }}>· {pb.timeToFirstRevenue}</span>}
                                    </div>
                                    {pb.failedSolutions.length > 0 && (
                                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                        {pb.failedSolutions.map((s, i) => <span key={i} style={{ fontSize: "0.75rem", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 3, padding: "0 4px", color: "#f59e0b" }}>{s}</span>)}
                                      </div>
                                    )}
                                  </div>
                                ) : <span style={{ color: "var(--fg-dim)", fontSize: "0.89rem" }}>-</span>}
                              </td>

                              {/* Wedge */}
                              <td style={{ padding: "9px 8px" }}>
                                {pb?.wedgeOpportunity ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{ fontSize: "0.77rem", color: "#7dd3fc", lineHeight: 1.5 }}>
                                      💡 {pb.wedgeOpportunity}
                                    </div>
                                    {pb.userPersona && <div style={{ fontSize: "0.73rem", color: "var(--fg-dim)" }}>👤 {pb.userPersona}</div>}
                                  </div>
                                ) : <span style={{ color: "var(--fg-dim)", fontSize: "0.77rem" }}>-</span>}
                              </td>

                              {/* Evidence */}
                              <td style={{ padding: "9px 8px" }}>
                                {pb?.commentEvidence?.length ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                    {pb.commentEvidence.map((q, i) => (
                                      <div key={i} style={{ fontSize: "0.75rem", color: "#7dd3fc", fontStyle: "italic", lineHeight: 1.5 }}>"{q}"</div>
                                    ))}
                                  </div>
                                ) : <span style={{ color: "var(--fg-dim)", fontSize: "0.77rem" }}>-</span>}
                              </td>

                              {/* Distribution */}
                              <td style={{ padding: "9px 8px" }}>
                                {pb?.distributionStrategy ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                    <div style={{ fontSize: "0.77rem", color: "var(--fg-subtle)", lineHeight: 1.5 }}>{pb.distributionStrategy}</div>
                                    {pb.messagingThatWorks && <div style={{ fontSize: "0.73rem", color: "#22c55e" }}>✓ {pb.messagingThatWorks}</div>}
                                    {pb.messagingToAvoid && <div style={{ fontSize: "0.73rem", color: "#ef4444" }}>✗ {pb.messagingToAvoid}</div>}
                                  </div>
                                ) : <span style={{ color: "var(--fg-dim)", fontSize: "0.77rem" }}>-</span>}
                              </td>

                              {/* Build Project */}
                              <td style={{ padding: "9px 8px", textAlign: "center" }}>
                                {pb && pb.verdict !== 'kill' && (
                                  <button
                                    onClick={() => handleBuildProject(sig, pb)}
                                    disabled={isLoadingBrief}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: "var(--radius)", border: "none", background: isLoadingBrief ? "rgba(34,197,94,0.2)" : "#22c55e", color: isLoadingBrief ? "#22c55e" : "#050d1e", fontSize: "0.75rem", fontWeight: 700, cursor: isLoadingBrief ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                                    {isLoadingBrief
                                      ? <><Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> Building…</>
                                      : <><Sparkles size={9} /> Build Project</>}
                                  </button>
                                )}
                              </td>
                            </>}

                            {/* Actions */}
                            <td style={{ padding: "9px 8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 1, justifyContent: "flex-end" }}>
                                <button className="icon-btn" onClick={() => toggleStar(sig.id)} title={isStarred ? "Unstar" : "Star"} style={{ color: isStarred ? "#fbbf24" : "var(--fg-dim)" }}>
                                  <Star size={12} fill={isStarred ? "#fbbf24" : "none"} />
                                </button>
                                {c?.accept && !isSaved && (
                                  <Tooltip content="Save as opportunity" side="bottom" width={140}>
                                    <button className="icon-btn" onClick={() => handleSaveOpportunity(sig, c)}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#22c55e"; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-dim)"; }}>
                                      <BookmarkCheck size={12} />
                                    </button>
                                  </Tooltip>
                                )}
                                {isSaved && <BookmarkCheck size={12} style={{ color: "#22c55e" }} />}
                                <Tooltip content="Draft reply" side="bottom" width={90}>
                                  <button className="icon-btn" onClick={() => setReplyTarget({ sig, classification: c })}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#60a5fa"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-dim)"; }}>
                                    <MessageSquare size={12} />
                                  </button>
                                </Tooltip>
                                <a href={sig.permalink} target="_blank" rel="noopener noreferrer"
                                  style={{ display: "inline-flex", alignItems: "center", padding: "3px 6px", border: "1px solid var(--border)", borderRadius: "var(--radius)", fontSize: "0.89rem", color: "var(--fg-subtle)", textDecoration: "none" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-subtle)"; }}>
                                  <ExternalLink size={9} />
                                </a>
                              </div>
                            </td>
                          </tr>

                          {/* Classification fallback for history items without playbooks */}
                          {isExpanded && c && !pb && <ClassificationRow c={c} colSpan={visibleCols.length} />}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </>
      )}

      {/* Reply modal */}
      {replyTarget && (
        <ReplyModal
          sig={replyTarget.sig}
          classification={replyTarget.classification}
          onClose={() => setReplyTarget(null)}
        />
      )}
    </div>
  );
}
