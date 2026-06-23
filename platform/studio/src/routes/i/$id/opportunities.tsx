import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FilterPanel, EMPTY_OPP_FILTERS, isOppFiltersEmpty } from "~/components/ui/FilterPanel";
import type { OppFilterState } from "~/components/ui/FilterPanel";
import { createPortal } from "react-dom";
import {
  useState, useRef, useEffect, useMemo, useCallback, useTransition,
  type ReactNode,
} from "react";
import { getOpportunities, getOpportunity, bulkSetPass, bulkDelete, generateBriefForOpportunity, setOpportunityStatus, getOpportunitySignals, generateAndCreateOpportunity, selectOpportunityToBuild, getProjectVersions, refineOpportunity } from "~/lib/server-fns";
import { analyzeProjectGaps } from "~/lib/project-fns";
import { Checkbox } from "~/components/ui/Checkbox";
import type { OpportunityWithSignals } from "~/lib/types";
import { SCORE_CRITERIA } from "~/lib/types";
import type { WtpSignal, WtpSignalType } from "~/lib/types";
import { useProjectContext } from "~/lib/project-context";
import { ScoreDot } from "../$id";
import { buildOppMarkdown } from "~/routes/opportunity/$id";
import { Modal } from "~/components/ui/Modal";

import { ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, Columns3, SlidersHorizontal, X, RefreshCw, Search, Bookmark, Hammer, ArrowLeft, Zap, MoreHorizontal, Trash2, Archive, Plus, Copy, Download, PenLine, Sparkles } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

export const Route = createFileRoute("/i/$id/opportunities")({
  validateSearch: (s: Record<string, unknown>) => ({
    opp: s.opp != null ? Number(s.opp) : undefined,
  }),
  loader: async ({ params }) => {
    const projectId = parseInt(params.id, 10);
    return {
      initialOpportunities: await getOpportunities({ data: { projectId } }),
    };
  },
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: OpportunitiesRoot,
});

function OpportunitiesRoot() {
  const { opp: inlineOppId } = Route.useSearch();
  if (inlineOppId != null) return <InlineOpportunityDetail oppId={inlineOppId} />;
  return <OpportunitiesPage />;
}

// ── Column definitions ────────────────────────────────────────────────────────

const ALL_COLS = [
  { id: "select", label: "☑", default: true, fixed: true },
  { id: "title", label: "Opportunity", default: true, fixed: true },
  { id: "shipScore", label: "Ship", default: true },
  { id: "scoreTotal", label: "Score", default: true },
  { id: "signalCount", label: "Signals", default: true },
  { id: "sector", label: "Sector", default: true },
  { id: "community", label: "Community", default: true },
  { id: "createdAt", label: "Found", default: true },
  // off by default - add via column picker
  { id: "mrr", label: "MRR", default: true },
  { id: "platforms", label: "Sources", default: true },
  { id: "brief", label: "Brief", default: true },
  { id: "wtpCount", label: "WTP Signals", default: true },
  { id: "wtp", label: "WTP", default: true },
  { id: "urgency", label: "Urgency", default: true },
  { id: "viral", label: "Viral", default: true },
  { id: "build", label: "Build", default: true },
  { id: "legal", label: "Legal Safety", default: true },
  { id: "priceAnchor", label: "Price Signal", default: true },
  { id: "buyer", label: "Buyer", default: true },
  { id: "pass", label: "Actions", default: true, fixed: true },
] as const;

type ColId = typeof ALL_COLS[number]["id"];
const DEFAULT_COLS = new Set(ALL_COLS.filter((c) => c.default).map((c) => c.id)) as Set<ColId>;


// ── ColPicker ─────────────────────────────────────────────────────────────────

const COL_GROUPS = [
  { label: "Core", ids: ["title", "signalCount", "wtpCount", "sector", "community", "createdAt"] as ColId[] },
  // "select" and "pass" are fixed - not shown in picker
  { label: "Scores", ids: ["scoreTotal", "shipScore", "wtp", "urgency", "viral", "build", "legal"] as ColId[] },
  { label: "Market", ids: ["mrr", "priceAnchor", "buyer", "platforms"] as ColId[] },
  { label: "Other", ids: ["brief"] as ColId[] },
];

const COL_TIPS: Partial<Record<ColId, string>> = {
  title: "Opportunity name - a specific tool or workflow gap for a named buyer persona, derived from clustering similar signals.",
  shipScore: "Should you build this right now? Average of just 3 criteria: pain urgency + willingness to pay + distribution readiness. High ship = real pain, people are paying, and you can reach them in one post. More actionable than Score for solopreneurs.",
  scoreTotal: "Overall quality score - weighted average of all criteria: pain urgency, WTP (2×), buyer quality, timing signal, build simplicity, distribution readiness, pricing ceiling, legal safety.",
  mrr: "Estimated monthly recurring revenue range from AI analysis of pricing signals in the cluster. Rough proxy - treat as directional.",
  sector: "Market vertical this opportunity belongs to. Useful for grouping and filtering similar opportunities across projects.",
  community: "Primary community where this pain was discovered - the first place you'd post to reach potential buyers.",
  platforms: "Signal sources - which channels (Reddit, HN, GitHub, etc.) contributed posts or reviews to this cluster.",
  brief: "Whether a playbook has been generated. ✓ = ready to read; - = not yet generated.",
  pass: "Quick actions: archive (pass), bookmark for later, or mark as actively building.",
  signalCount: "Raw posts, comments, or reviews that formed this cluster. Click to browse the signals.",
  wtpCount: "Number of concrete WTP signals: job postings, explicit budget mentions, workarounds people pay for. Higher = stronger buying intent.",
  wtp: "Willingness to Pay (0–10) - direct money evidence: job postings, explicit budgets, paid workarounds in the signals.",
  urgency: "Pain Urgency (0–10) - does this cost real money or hours today, not just hypothetically?",
  viral: "Viral Potential (0–10) - do users naturally share outputs or invite teammates into the workflow?",
  build: "Build Simplicity (0–10) - can a solo engineer ship a useful V1 in under 5 days?",
  legal: "Legal Safety (0–10) - regulatory, IP, or liability risk. 10 = completely safe to ship without a lawyer.",
  priceAnchor: "What buyers currently spend - explicit $ signals extracted from posts and reviews in this cluster.",
  buyer: "Specific buyer persona: role, company size, and current workaround, derived from AI analysis of the signals.",
  createdAt: "When this opportunity cluster was first discovered by the pipeline.",
};

function ColPicker({ visible, onChange, onReset, align = "right" }: {
  visible: Set<ColId>; onChange: (next: Set<ColId>) => void; onReset: () => void; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(id: ColId) {
    const col = ALL_COLS.find((c) => c.id === id);
    if ((col as any)?.fixed) return;
    const next = new Set(visible);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  const nonFixed = ALL_COLS.filter((c) => !(c as any).fixed);
  const activeCount = nonFixed.filter((c) => visible.has(c.id)).length;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <Button
        ref={btnRef}
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        style={{
          gap: 5,
          background: open ? "rgba(0,255,136,0.06)" : "transparent",
          border: `1px solid ${open ? "rgba(0,255,136,0.35)" : "var(--border)"}`,
          color: open ? "var(--accent)" : "rgba(250,250,250,0.52)",
          fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase",
        }}
      >
        <Columns3 size={11} />
        Columns
        {activeCount !== nonFixed.length && (
          <span style={{
            minWidth: 16, height: 15, padding: "0 4px",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,255,136,0.15)", color: "var(--accent)",
            fontSize: "0.66rem", fontWeight: 700, borderRadius: 2,
          }}>{activeCount}</span>
        )}
      </Button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute", ...(align === "left" ? { left: 0 } : { right: 0 }), top: "calc(100% + 5px)",
            background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)",
            zIndex: 200, width: 300,
            boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <span style={{ fontSize: "0.70rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.45)" }}>
              Columns
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              style={{ fontSize: "0.74rem", color: "rgba(250,250,250,0.38)", height: "auto", padding: "0 2px" }}
            >
              Reset defaults
            </Button>
          </div>
          <div style={{ padding: "6px 0 8px" }}>
            {COL_GROUPS.map((grp) => {
              const grpCols = grp.ids.map((id) => ALL_COLS.find((c) => c.id === id)).filter(Boolean) as typeof ALL_COLS[number][];
              return (
                <div key={grp.label}>
                  <div style={{ padding: "6px 14px 3px", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(250,250,250,0.28)" }}>
                    {grp.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    {grpCols.map((col) => {
                      const on = visible.has(col.id);
                      const fixed = (col as any).fixed;
                      return (
                        <div
                          key={col.id}
                          onClick={() => !fixed && toggle(col.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", cursor: fixed ? "default" : "pointer", opacity: fixed ? 0.4 : 1 }}
                        >
                          <span style={{
                            width: 13, height: 13, flexShrink: 0,
                            border: `1px solid ${on ? "var(--accent)" : "rgba(255,255,255,0.2)"}`,
                            background: on ? "var(--accent)" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 2,
                          }}>
                            {on && <span style={{ color: "#050d1e", fontSize: "0.6rem", fontWeight: 800 }}>✓</span>}
                          </span>
                          <span style={{ fontSize: "0.82rem", color: on ? "var(--fg)" : "rgba(250,250,250,0.48)", whiteSpace: "nowrap" }}>
                            {col.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter state ─────────────────────────────────────────────────────────────

type FilterState = OppFilterState;
const EMPTY_FILTERS = EMPTY_OPP_FILTERS;
const isFiltersEmpty = isOppFiltersEmpty;

// (FilterPanel imported from shared component)


// ── Signal Viewer ─────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  reddit: "#ff6314", hn: "#e17b3c", github: "#58a6ff",
  stackoverflow: "#f48024", trustpilot: "#00b67a", devto: "#3b49df",
  bluesky: "#0085ff", mastodon: "#6364ff", ph: "#cc4d29",
  ih: "#0e2150", lobsters: "#ac130d", substack: "#ff6719",
  jobs: "#a78bfa", firefox: "#ff9500", edgar: "#4b5563",
  youtube: "#ff0000", lemmy: "#00c2cb", community: "#6b7280",
};

type SignalRow = Awaited<ReturnType<typeof getOpportunitySignals>>[number];

function SignalViewer({ opportunityId, signalCount }: { opportunityId: number; signalCount: number }) {
  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 480) });
    setOpen(true);
    if (signals.length === 0) {
      setLoading(true);
      try {
        const rows = await getOpportunitySignals({ data: { opportunityId } });
        setSignals(rows);
      } finally { setLoading(false); }
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function daysAgo(d: Date | string | null | undefined) {
    if (!d) return "";
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
    if (diff === 0) return "today";
    if (diff === 1) return "1d ago";
    return `${diff}d ago`;
  }

  return (
    <div ref={ref} style={{ display: "inline-flex" }}>
      <button
        onClick={toggle}
        style={{
          background: "none", border: "none", padding: 0, cursor: "pointer",
          fontSize: "0.84rem", fontVariantNumeric: "tabular-nums",
          color: signalCount > 0 ? "rgba(250,250,250,0.68)" : "rgba(250,250,250,0.25)",
          textDecoration: signalCount > 0 ? "underline dotted" : "none",
          textUnderlineOffset: 3,
        }}
        title={signalCount > 0 ? "Click to view signals" : "No signals"}
      >
        {signalCount}
      </button>
      {open && pos && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "fixed", top: pos.top, left: pos.left,
            width: 460, maxHeight: 420,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
            zIndex: 9999,
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
            {signalCount} signal{signalCount !== 1 ? "s" : ""}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 16, fontSize: "0.82rem", color: "var(--fg-subtle)" }}>Loading…</div>
            ) : signals.length === 0 ? (
              <div style={{ padding: 16, fontSize: "0.82rem", color: "var(--fg-subtle)", fontStyle: "italic" }}>
                Signals were pruned. Re-run channels to collect fresh ones.
              </div>
            ) : signals.map(sig => (
              <div key={sig.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                    color: SOURCE_COLORS[sig.source] ?? "#888",
                    border: `1px solid ${SOURCE_COLORS[sig.source] ?? "#888"}33`,
                    padding: "1px 5px", borderRadius: 3, flexShrink: 0,
                  }}>
                    {sig.source}
                  </span>
                  {sig.toolName && (
                    <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)" }}>{sig.toolName}</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)" }}>
                    {daysAgo(sig.postedAt ?? sig.scrapedAt)}
                  </span>
                  {sig.url && (
                    <a href={sig.url} target="_blank" rel="noreferrer"
                      style={{ color: "var(--accent)", fontSize: "0.72rem", flexShrink: 0 }}>
                      ↗
                    </a>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--fg-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {sig.rawText}
                </p>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}


// ── ColHeader (with tooltip from COL_TIPS) ────────────────────────────────────

function ColHeader({ id, label }: { id: ColId; label: string }) {
  const tip = COL_TIPS[id];
  if (!tip) return <>{label}</>;
  return (
    <span title={tip} style={{ cursor: "default", borderBottom: "1px dotted rgba(250,250,250,0.25)" }}>
      {label}
    </span>
  );
}

// ── Cell helpers ──────────────────────────────────────────────────────────────

function SubScore({ value }: { value: number | undefined }) {
  if (value === undefined) return <span style={{ color: "var(--border)" }}>-</span>;
  const color = value >= 7 ? "var(--accent)" : value >= 5 ? "#f59e0b" : "#ef4444";
  return <span style={{ color, fontVariantNumeric: "tabular-nums", fontSize: "0.90rem" }}>{value}</span>;
}

function MrrCell({ insights }: { insights: OpportunityWithSignals["insightsJson"] }) {
  if (!insights?.mrr_avg) return <span style={{ color: "var(--border)" }}>-</span>;
  const avg = insights.mrr_avg;
  const color = avg >= 15000 ? "var(--accent)" : avg >= 5000 ? "#f59e0b" : "var(--muted)";
  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  return (
    <span style={{ fontSize: "0.86rem", color }}>
      {insights.mrr_low && insights.mrr_high ? `${fmt(insights.mrr_low)}–${fmt(insights.mrr_high)}` : fmt(avg)}
    </span>
  );
}

const PLATFORM_COLORS: Record<string, { fg: string; bg: string }> = {
  reddit: { fg: "#ff6314", bg: "rgba(255,99,20,0.12)" },
  hn: { fg: "#e17b3c", bg: "rgba(225,123,60,0.12)" },
  g2: { fg: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
};
const PLATFORM_SHORT: Record<string, string> = { reddit: "r/", hn: "hn", g2: "g2" };

function SourceBadges({ platforms }: { platforms?: string[] }) {
  if (!platforms?.length) return <span style={{ color: "var(--border)", fontSize: "0.84rem" }}>-</span>;
  return (
    <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {platforms.map((p) => {
        const c = PLATFORM_COLORS[p] ?? { fg: "var(--muted)", bg: "var(--subtle)" };
        return (
          <span key={p} style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.05em", padding: "1px 5px", color: c.fg, background: c.bg }}>
            {PLATFORM_SHORT[p] ?? p}
          </span>
        );
      })}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LS_KEY = (projectId: number) => `opp-cols-v2-${projectId}`;
const LS_SORT_KEY = (projectId: number) => `opp-sort-${projectId}`;

function loadSort(projectId: number): SortingState {
  try {
    const raw = localStorage.getItem(LS_SORT_KEY(projectId));
    if (!raw) return [{ id: "scoreTotal", desc: true }];
    return JSON.parse(raw) as SortingState;
  } catch { return [{ id: "scoreTotal", desc: true }]; }
}

function saveSort(projectId: number, sort: SortingState) {
  try { localStorage.setItem(LS_SORT_KEY(projectId), JSON.stringify(sort)); } catch { }
}

function loadCols(projectId: number): Set<ColId> {
  try {
    const raw = localStorage.getItem(LS_KEY(projectId));
    if (!raw) return DEFAULT_COLS;
    const arr = JSON.parse(raw) as string[];
    const valid = arr.filter((id) => ALL_COLS.some((c) => c.id === id)) as ColId[];
    return valid.length ? new Set(valid) : DEFAULT_COLS;
  } catch { return DEFAULT_COLS; }
}

function saveCols(projectId: number, cols: Set<ColId>) {
  try { localStorage.setItem(LS_KEY(projectId), JSON.stringify([...cols])); } catch { /* ignore */ }
}

// ── Source colors (shared with inline detail) ────────────────────────────────
const SRC_COLORS: Record<string, { fg: string; border: string }> = {
  reddit: { fg: "#ff6314", border: "rgba(255,99,20,0.3)" },
  hn: { fg: "#e17b3c", border: "rgba(225,123,60,0.3)" },
  twitter: { fg: "#1d9bf0", border: "rgba(29,155,240,0.3)" },
  g2: { fg: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  github: { fg: "#a78bfa", border: "rgba(167,139,250,0.3)" },
  jobs: { fg: "#a78bfa", border: "rgba(167,139,250,0.3)" },
};

const WTP_TYPE_COLORS: Record<string, string> = {
  workaround: "rgba(251,191,36,0.7)",
  budget_spend: "var(--accent)",
  job_posting: "#a78bfa",
  already_paying: "rgba(251,191,36,0.7)",
  repeated_attempts: "rgba(250,250,250,0.68)",
  competitor_complaint: "rgba(239,68,68,0.7)",
};
const WTP_TYPE_LABELS: Record<string, string> = {
  workaround: "workaround", budget_spend: "$ spend", job_posting: "job posting",
  already_paying: "paying for bad alt", repeated_attempts: "tried many tools",
  competitor_complaint: "competitor gap",
};

// ── Inline Opportunity Detail ────────────────────────────────────────────────

function ScoreBarInline({ label, value, reason }: { label: string; value: number; reason?: string }) {
  const color = value >= 7 ? "var(--accent)" : value >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div title={reason || undefined} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: reason ? "help" : "default" }}>
      <span style={{ fontSize: "0.76rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", minWidth: 108, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 2, background: "var(--border)", position: "relative" as const }}>
        <div style={{ position: "absolute" as const, left: 0, top: 0, height: "100%", width: `${(value / 10) * 100}%`, background: color }} />
      </div>
      <span style={{ fontSize: "0.88rem", fontWeight: 600, color, minWidth: 18, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function parseBriefSectionsInline(html: string): Array<{ heading: string; html: string }> {
  const sections: Array<{ heading: string; html: string }> = [];
  const parts = html.split(/(?=<h2[^>]*>)/i);
  for (const part of parts) {
    const t = part.trim();
    if (!t) continue;
    if (/^<h2/i.test(t)) {
      const m = t.match(/^<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*)/i);
      if (m) {
        const heading = m[1].replace(/<[^>]+>/g, "").trim();
        const body = m[2].trim();
        if (heading || body) sections.push({ heading, html: body });
      }
    } else {
      sections.push({ heading: "", html: t });
    }
  }
  return sections;
}

function isBriefSectionWideInline(heading: string): boolean {
  const h = heading.toLowerCase();
  return h.includes("competitor") || h.includes("distribution") ||
    h.includes("mrr") || h.includes("revenue") || h.includes("expected") ||
    h.includes("landscape") || h.includes("channel") || h === "";
}

function InlineOpportunityDetail({ oppId }: { oppId: number }) {
  const { project } = useProjectContext();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [opp, setOpp] = useState<any>(null);
  const [briefHtml, setBriefHtml] = useState("");
  const [loadingOpp, setLoadingOpp] = useState(true);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [activeTab, setActiveTab] = useState<"playbook" | "signals">("playbook");
  const [pass, setPass] = useState(false);
  const [status, setStatus] = useState("new");
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState<{ top: number; right: number } | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [activeBuildVersion, setActiveBuildVersion] = useState<{ versionNumber: number; opportunityId: number | null } | null>(null);
  const [startingBuild, setStartingBuild] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [refineResult, setRefineResult] = useState<{ changeSummary: string; diffs: any[] } | null>(null);
  const { product } = useProjectContext();

  function goBack() {
    navigate({ to: "/i/$id/opportunities", params: { id: String(project.id) }, search: { opp: undefined } });
  }

  function handleBuild() {
    // "Build this" → New Product flow (Name → Build), carrying this opportunity.
    navigate({ to: "/products/new", search: { opportunityId: oppId } });
  }

  async function handleRefine() {
    if (!opp || !refineRequest.trim()) return;
    setRefining(true);
    setRefineError("");
    try {
      const updated = await refineOpportunity({ data: { id: opp.id, changeRequest: refineRequest.trim() } }) as any;
      setOpp((prev: any) => ({ ...prev, ...updated }));
      setBriefHtml("");
      if (updated.briefMd && !updated.briefMd.startsWith("Brief generation failed")) {
        const { remark } = await import("remark");
        const html = await import("remark-html");
        const gfm = await import("remark-gfm");
        const file = await remark().use(gfm.default).use(html.default).process(updated.briefMd);
        setBriefHtml(String(file));
      }
      setRefineOpen(false);
      setRefineRequest("");
      setRefineResult({ changeSummary: (updated as any).changeSummary ?? "", diffs: (updated as any).diffs ?? [] });
    } catch (err: any) {
      setRefineError(err.message ?? "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  function handleCopyMd() {
    if (!opp) return;
    navigator.clipboard.writeText(buildOppMarkdown(opp, opp.briefMd ?? ""));
    setCopied(true);
    setMoreOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadZip() {
    if (!opp) return;
    setMoreOpen(false);
    const { strFromU8, zipSync } = await import("fflate");
    const md = buildOppMarkdown(opp, opp.briefMd ?? "");
    const slug = (opp.title as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
    const files: Record<string, Uint8Array> = {
      [`${slug}/opportunity.md`]: new TextEncoder().encode(md),
    };
    if (opp.briefMd && !opp.briefMd.startsWith("Brief generation failed")) {
      files[`${slug}/playbook.md`] = new TextEncoder().encode(opp.briefMd);
    }
    const zipped = zipSync(files);
    const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug}.zip`; a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    setLoadingOpp(true); setOpp(null); setBriefHtml(""); setBriefError("");
    setActiveBuildVersion(null);
    Promise.all([
      getOpportunity({ data: { id: oppId } }),
      product ? getProjectVersions({ data: { productId: product.id } }) : Promise.resolve([]),
    ]).then(async ([o, versions]) => {
      const building = versions.find(v => v.status === "building");
      if (building) setActiveBuildVersion({ versionNumber: building.versionNumber, opportunityId: building.opportunityId });
      if (!o) { setLoadingOpp(false); return; }
      setOpp(o); setPass(o.pass); setStatus(o.status ?? "new");
      if (o.briefMd && !o.briefMd.startsWith("Brief generation failed")) {
        const { remark } = await import("remark");
        const html = await import("remark-html");
        const gfm = await import("remark-gfm");
        const file = await remark().use(gfm.default).use(html.default).process(o.briefMd);
        setBriefHtml(String(file));
      }
      setLoadingOpp(false);
    });
  }, [oppId]);

  useEffect(() => {
    if (!moreOpen) return;
    function onDown(e: MouseEvent) {
      if (moreBtnRef.current?.contains(e.target as Node) || moreMenuRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);

  async function handleGenerateBrief() {
    if (!opp) return;
    setGeneratingBrief(true); setBriefError("");
    try {
      const result = await generateBriefForOpportunity({ data: { id: opp.id } });
      const { remark } = await import("remark");
      const html = await import("remark-html");
      const gfm = await import("remark-gfm");
      const file = await remark().use(gfm.default).use(html.default).process(result.briefMd);
      setBriefHtml(String(file));
    } catch (err: any) { setBriefError(err.message ?? "Failed"); }
    finally { setGeneratingBrief(false); }
  }

  if (loadingOpp) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <div style={{ height: 40, flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
          <div className="sk" style={{ width: 110, height: 13 }} />
          <div style={{ flex: 1 }} /><div className="sk" style={{ width: 60, height: 26, borderRadius: 4 }} />
        </div>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="sk" style={{ height: 14, width: `${85 - i * 8}%` }} />)}
          </div>
          <div style={{ flex: 1, padding: "20px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="sk" style={{ height: 14, width: `${90 - i * 5}%`, opacity: 1 - i * 0.08 }} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!opp) return <div style={{ padding: 32, color: "var(--muted)" }}>Opportunity not found.</div>;

  const pain = opp.scoresJson?.["pain_urgency"] ?? 0;
  const wtp = opp.scoresJson?.["willingness_to_pay"] ?? 0;
  const dist = opp.scoresJson?.["distribution_ready"] ?? 0;
  const ship = Math.round(((pain + wtp + dist) / 3) * 10) / 10;
  const shipColor = ship >= 7 ? "var(--accent)" : ship >= 5 ? "#f59e0b" : "rgba(250,250,250,0.62)";
  const scoreColor = (opp.scoreTotal ?? 0) >= 7 ? "var(--accent)" : (opp.scoreTotal ?? 0) >= 5 ? "#f59e0b" : "#ef4444";
  const wtpEvidence: WtpSignal[] = opp.insightsJson?.wtp_evidence ?? [];
  const platforms: string[] = opp.insightsJson?.source_platforms ?? [];
  const isParked = status === "parked";
  const isBuilding = status === "building";

  function openMore() {
    if (!moreBtnRef.current) return;
    const r = moreBtnRef.current.getBoundingClientRect();
    setMorePos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setMoreOpen(v => !v);
  }
  async function doStatus(next: string) {
    setMoreOpen(false);
    const val = status === next ? "new" : next;
    setStatus(val);
    await setOpportunityStatus({ data: { id: opp.id, status: val as any } });
  }
  async function doPass() {
    setMoreOpen(false);
    const next = !pass; setPass(next);
    await bulkSetPass({ data: { ids: [opp.id], pass: next } });
  }
  async function doDelete() {
    setMoreOpen(false);
    const ok = await confirm("Delete this opportunity?", { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    await bulkDelete({ data: { ids: [opp.id] } });
    goBack();
  }

  const menuItemStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
    cursor: "pointer", fontSize: "0.84rem", color: "var(--fg)",
    background: "transparent", border: "none", width: "100%",
    textAlign: "left", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── Back bar ── */}
      <div style={{
        height: 48, flexShrink: 0, borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
        background: "var(--bg)",
      }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          style={{ gap: 5, flexShrink: 0 }}
        >
          <ArrowLeft size={13} /> Opportunities
        </Button>
        <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.76rem", flexShrink: 0 }}>/</span>
        <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {opp.title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Build button - three states */}
          {(() => {
            const isThisBuilding = activeBuildVersion?.opportunityId === oppId;
            const anotherBuilding = activeBuildVersion != null && !isThisBuilding;
            if (isThisBuilding) {
              return (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => product && navigate({ to: "/products/$id/build", params: { id: String(product.id) } })}
                  style={{ gap: 6, borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  <Hammer size={12} /> v{activeBuildVersion.versionNumber} Building ↗
                </Button>
              );
            }
            if (anotherBuilding) {
              return (
                <div title={`v${activeBuildVersion!.versionNumber} is already building - deploy it first`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius)", color: "var(--fg-dim)", fontSize: "0.76rem" }}>
                  <Hammer size={11} /> v{activeBuildVersion!.versionNumber} building
                </div>
              );
            }
            return (
              <Button
                variant="primary"
                size="sm"
                onClick={handleBuild}
                disabled={startingBuild}
                style={{ gap: 6 }}
              >
                <Hammer size={12} /> {startingBuild ? "Starting…" : "Build This"}
              </Button>
            );
          })()}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefineOpen(true)}
            title="Refine with AI"
            style={{ gap: 5 }}
          >
            <PenLine size={12} /> Refine
          </Button>

          <Button
            ref={moreBtnRef}
            variant="outline"
            size="sm"
            onClick={openMore}
            style={{ padding: "3px 6px" }}
          >
            <MoreHorizontal size={13} />
          </Button>
        </div>

        {/* Refine modal */}
        <Modal open={refineOpen} onClose={() => { setRefineOpen(false); setRefineRequest(""); setRefineError(""); }} title="Refine opportunity" width={560}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
              Describe what to change. AI will update the scores, insights, and playbook.
            </p>
            <textarea
              autoFocus
              value={refineRequest}
              onChange={e => setRefineRequest(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !refining) handleRefine(); }}
              placeholder="e.g. 'Focus more on enterprise buyers', 'Update distribution to target Indie Hackers', 'Lower the pain urgency score - this is a nice-to-have not a fire'"
              rows={5}
              disabled={refining}
              style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.86rem", padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.65 }}
            />
            {refineError && <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(239,68,68,0.8)" }}>{refineError}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm" onClick={() => { setRefineOpen(false); setRefineRequest(""); setRefineError(""); }}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleRefine}
                disabled={refining || !refineRequest.trim()}
                style={{ gap: 7 }}
              >
                {refining ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Refining…</> : <><PenLine size={13} /> Update with AI</>}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Changes result modal */}
        <Modal open={!!refineResult} onClose={() => setRefineResult(null)} title="What changed" width={600}>
          {refineResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {refineResult.changeSummary && (
                <p style={{ margin: 0, fontSize: "0.90rem", color: "var(--fg-muted)", lineHeight: 1.7, borderLeft: "2px solid var(--accent)", paddingLeft: 14 }}>
                  {refineResult.changeSummary}
                </p>
              )}
              {refineResult.diffs.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border)" }}>
                  {refineResult.diffs.map((d: any) => (
                    <div key={d.key} style={{ background: "var(--bg-elevated)", padding: "10px 14px", display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: "0 16px", alignItems: "start" }}>
                      <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", paddingTop: 2 }}>{d.label}</span>
                      <span style={{ fontSize: "0.82rem", color: "rgba(239,68,68,0.65)", lineHeight: 1.5, wordBreak: "break-word" }}>
                        {d.type === "score" ? <span style={{ fontWeight: 700 }}>{d.before}</span> : d.before.slice(0, 120)}{d.before.length > 120 ? "…" : ""}
                      </span>
                      <span style={{ fontSize: "0.82rem", color: d.type === "score" ? (Number(d.after) > Number(d.before) ? "var(--accent)" : "#ef4444") : "rgba(250,250,250,0.85)", lineHeight: 1.5, wordBreak: "break-word" }}>
                        {d.type === "score"
                          ? <><span style={{ fontWeight: 700 }}>{d.after}</span> <span style={{ fontSize: "0.72rem" }}>{Number(d.after) > Number(d.before) ? "↑" : "↓"}{Math.abs(Number(d.after) - Number(d.before))}</span></>
                          : <>{d.after.slice(0, 120)}{d.after.length > 120 ? "…" : ""}</>}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)" }}>No structural changes detected - the AI may have refined tone or detail within existing values.</p>
              )}
            </div>
          )}
        </Modal>
      </div>

      {moreOpen && morePos && createPortal(
        <div ref={moreMenuRef} style={{ position: "fixed", top: morePos.top, right: morePos.right, zIndex: 9999, minWidth: 190, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "4px 0" }}>
          {briefHtml && (
            <button style={menuItemStyle} onClick={() => { setMoreOpen(false); handleGenerateBrief(); }}
            >
              <RefreshCw size={13} style={{ opacity: 0.7 }} />
              {generatingBrief ? "Regenerating…" : "Regenerate playbook"}
            </button>
          )}
          {briefHtml && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
          {[
            { label: copied ? "Copied!" : "Copy as Markdown", icon: <Copy size={13} style={{ opacity: 0.7 }} />, action: handleCopyMd },
            { label: "Download .zip", icon: <Download size={13} style={{ opacity: 0.7 }} />, action: handleDownloadZip },
          ].map((item) => (
            <button key={item.label} style={menuItemStyle} onClick={item.action}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          {[
            { label: pass ? "Unpass" : "Pass (archive)", icon: <Archive size={13} style={{ opacity: 0.7 }} />, action: doPass },
            { label: isParked ? "Unpark" : "Park for later", icon: <Bookmark size={13} style={{ color: isParked ? "#facc15" : undefined, opacity: isParked ? 1 : 0.7 }} />, action: () => doStatus("parked") },
          ].map((item) => (
            <button key={item.label} style={menuItemStyle} onClick={item.action}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <button style={{ ...menuItemStyle, color: "rgba(239,68,68,0.85)" }} onClick={doDelete}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>,
        document.body
      )}

      {/* ── Body: sidebar + main ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Sidebar */}
        <div style={{ width: 340, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto", padding: "20px 20px 48px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Pain summary */}
          <p style={{ margin: 0, fontSize: "0.92rem", color: "rgba(250,250,250,0.72)", lineHeight: 1.7 }}>{opp.painSummary}</p>

          {/* Tags */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {opp.sector && <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", border: "1px solid var(--border)", padding: "2px 7px" }}>{opp.sector}</span>}
            {platforms.map(p => { const c = SRC_COLORS[p]; return <span key={p} style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 6px", color: c?.fg ?? "var(--muted)", border: `1px solid ${c?.border ?? "var(--border)"}` }}>{p}</span>; })}
            {opp.communityUrl
              ? <a href={opp.communityUrl} target="_blank" rel="noreferrer" style={{ fontSize: "0.84rem", color: "var(--accent)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>{opp.community} <ExternalLink size={10} /></a>
              : opp.community && <span style={{ fontSize: "0.84rem", color: "var(--muted)" }}>{opp.community}</span>}
          </div>

          {/* Metrics grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "var(--border)" }}>
            {[
              { label: "Ship", value: ship.toFixed(1), color: shipColor },
              { label: "Score", value: (opp.scoreTotal ?? 0).toFixed(1), color: scoreColor },
              ...(opp.insightsJson?.mrr_avg ? [{ label: "MRR", value: `$${opp.insightsJson.mrr_avg >= 1000 ? `${(opp.insightsJson.mrr_avg / 1000).toFixed(0)}k` : opp.insightsJson.mrr_avg}`, color: "var(--accent)" }] : []),
              { label: "Signals", value: String(opp.signalCount ?? 0), color: "var(--fg)" },
            ].map(m => (
              <div key={m.label} style={{ background: "var(--bg)", padding: "10px 12px" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.35)", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 600, color: m.color, letterSpacing: "-0.02em" }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Buyer + Price + Distribution */}
          {(opp.insightsJson?.buyer_persona || opp.insightsJson?.price_anchor || opp.insightsJson?.distribution_primary) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)" }}>
              {opp.insightsJson?.buyer_persona && <div style={{ background: "var(--bg)", padding: "11px 12px" }}><div style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.38)", marginBottom: 4 }}>Buyer</div><div style={{ fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.55 }}>{opp.insightsJson.buyer_persona}</div></div>}
              {opp.insightsJson?.price_anchor && <div style={{ background: "var(--bg)", padding: "11px 12px" }}><div style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.38)", marginBottom: 4 }}>Price Signal</div><div style={{ fontSize: "0.88rem", color: "var(--accent)", lineHeight: 1.55 }}>{opp.insightsJson.price_anchor}</div></div>}
              {opp.insightsJson?.distribution_primary && <div style={{ background: "var(--bg)", padding: "11px 12px" }}><div style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.38)", marginBottom: 4 }}>Distribution</div><div style={{ fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.55 }}>{opp.insightsJson.distribution_primary}</div></div>}
            </div>
          )}

          {/* Score bars */}
          <div>
            <p style={{ margin: "0 0 8px", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.45)" }}>Scores</p>
            {SCORE_CRITERIA.map(c => <ScoreBarInline key={c.key} label={c.label} value={opp.scoresJson?.[c.key] ?? 0} reason={opp.insightsJson?.score_reasoning?.[c.key]} />)}
          </div>

        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", minWidth: 0, display: "flex", flexDirection: "column" }}>

          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {(["playbook", "signals"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: "none", border: "none", cursor: "pointer", padding: "10px 18px",
                fontSize: "0.78rem", fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? "var(--accent)" : "rgba(250,250,250,0.45)",
                borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
                marginBottom: -1, letterSpacing: "0.05em", fontFamily: "inherit",
              }}>
                {tab === "playbook" ? "Playbook" : `Signals (${(opp.signals ?? []).length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 60px" }}>

            {activeTab === "playbook" && (
              <div>
                {/* Error */}
                {briefError && (
                  <div style={{ padding: "10px 14px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", color: "rgba(239,68,68,0.8)", fontSize: "0.84rem", marginBottom: 16 }}>{briefError}</div>
                )}

                {/* No brief - CTA */}
                {!briefHtml && !briefError && (
                  <div style={{ padding: "56px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <Zap size={28} style={{ color: "var(--accent)", marginBottom: 14, opacity: 0.8 }} />
                    <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 600 }}>No playbook yet</h3>
                    <p style={{ fontSize: "0.84rem", color: "rgba(250,250,250,0.42)", maxWidth: 300, lineHeight: 1.65, margin: "0 auto 22px" }}>
                      Generate a full analysis: buyer research, V1 features, distribution plan, and risk assessment.
                    </p>
                    <Button variant="primary" size="sm" onClick={handleGenerateBrief} disabled={generatingBrief} style={{ gap: 7 }}>
                      <Zap size={13} /> {generatingBrief ? "Generating…" : "Generate Playbook"}
                    </Button>
                  </div>
                )}

                {/* Section grid - 580px columns ≈ 65 chars/line */}
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 580px) minmax(0, 580px)", gap: "28px 40px" }}>

                  {/* WTP Evidence - full width, left accent stripe */}
                  {wtpEvidence.length > 0 && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbbf24", marginBottom: 12 }}>
                        WTP Evidence · {wtpEvidence.length}
                      </div>
                      <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 16 }}>
                        {wtpEvidence.map((e: any, i: number) => {
                          if (typeof e === "string") {
                            return (
                              <div key={i} style={{ padding: "8px 0", borderBottom: i < wtpEvidence.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                                <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(250,250,250,0.82)", lineHeight: 1.65, fontStyle: "italic" }}>"{e}"</p>
                              </div>
                            );
                          }
                          return (
                            <div key={i} onClick={() => e.url && window.open(e.url, "_blank", "noreferrer")}
                              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", cursor: e.url ? "pointer" : "default", borderBottom: i < wtpEvidence.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
                            >
                              <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingTop: 2 }}>
                                <span style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", color: SRC_COLORS[e.source]?.fg ?? "var(--muted)", border: `1px solid ${SRC_COLORS[e.source]?.border ?? "var(--border)"}` }}>{e.source}</span>
                                <span style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", color: WTP_TYPE_COLORS[e.type] ?? "var(--muted)", border: "1px solid var(--border)" }}>{WTP_TYPE_LABELS[e.type] ?? e.type}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(250,250,250,0.82)", lineHeight: 1.65, fontStyle: "italic" }}>"{e.excerpt}"</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Score reasoning - full width, shown when AI has explanations */}
                  {opp.insightsJson?.score_reasoning && Object.keys(opp.insightsJson.score_reasoning).length > 0 && (
                    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18 }}>
                      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.6)", marginBottom: 14 }}>
                        Score Reasoning
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {SCORE_CRITERIA.map(c => {
                          const reason = (opp.insightsJson?.score_reasoning as any)?.[c.key];
                          const val = opp.scoresJson?.[c.key] ?? 0;
                          const color = val >= 7 ? "var(--accent)" : val >= 5 ? "#f59e0b" : "#ef4444";
                          if (!reason) return null;
                          return (
                            <div key={c.key} style={{ display: "grid", gridTemplateColumns: "28px 120px 1fr", gap: "0 12px", alignItems: "baseline" }}>
                              <span style={{ fontSize: "0.92rem", fontWeight: 700, color, textAlign: "right" }}>{val}</span>
                              <span style={{ fontSize: "0.68rem", color: "rgba(250,250,250,0.45)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</span>
                              <span style={{ fontSize: "0.86rem", color: "rgba(250,250,250,0.75)", lineHeight: 1.6 }}>{reason}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Brief sections - borderless, top rule separator */}
                  {briefHtml && parseBriefSectionsInline(briefHtml).map((section, i) => (
                    <div
                      key={i}
                      style={{
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        paddingTop: 18,
                        gridColumn: isBriefSectionWideInline(section.heading) ? "1 / -1" : undefined,
                      }}
                    >
                      {section.heading && (
                        <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.6)", marginBottom: 12 }}>
                          {section.heading}
                        </div>
                      )}
                      <div className="brief-section" dangerouslySetInnerHTML={{ __html: section.html }} />
                    </div>
                  ))}

                  {/* InsightsJson - only when no brief */}
                  {!briefHtml && opp.insightsJson?.hidden_need && (
                    <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 14 }}>
                      <div style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 8 }}>Hidden Need</div>
                      <p style={{ margin: 0, fontSize: "0.90rem", color: "var(--fg)", lineHeight: 1.7 }}>{opp.insightsJson.hidden_need}</p>
                    </div>
                  )}
                  {!briefHtml && (opp.insightsJson?.v1_features?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.6)", marginBottom: 12 }}>V1 Features</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                        {opp.insightsJson!.v1_features!.map((f: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0, fontSize: "0.80rem", lineHeight: 1.7 }}>{i + 1}.</span>
                            <span style={{ fontSize: "0.90rem", color: "rgba(250,250,250,0.85)", lineHeight: 1.65 }}>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!briefHtml && opp.insightsJson?.self_growth && (
                    <div>
                      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.6)", marginBottom: 8 }}>Self-Growth</div>
                      <p style={{ margin: 0, fontSize: "0.90rem", color: "rgba(250,250,250,0.78)", lineHeight: 1.7 }}>{opp.insightsJson.self_growth}</p>
                    </div>
                  )}
                  {!briefHtml && (opp.insightsJson?.risks?.length ?? 0) > 0 && (
                    <div>
                      <div style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.6)", marginBottom: 8 }}>Risks</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {opp.insightsJson!.risks!.map((r: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                            <span style={{ color: "rgba(239,68,68,0.5)", flexShrink: 0, fontSize: "0.72rem", lineHeight: 1.7 }}>▲</span>
                            <span style={{ fontSize: "0.88rem", color: "rgba(250,250,250,0.65)", lineHeight: 1.65 }}>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {activeTab === "signals" && (
              (opp.signals ?? []).length === 0
                ? <p style={{ color: "rgba(250,250,250,0.35)", fontSize: "0.84rem" }}>No signals linked to this opportunity.</p>
                : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {(opp.signals ?? []).map((sig: any) => (
                    <div key={sig.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--bg-elevated)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--border)", background: "rgba(100,130,180,0.04)" }}>
                        {(() => { const c = (SRC_COLORS as any)[sig.source] ?? { fg: "#888", border: "rgba(128,128,128,0.3)" }; return <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.fg, border: `1px solid ${c.border}`, padding: "1px 5px", borderRadius: 3 }}>{sig.source}</span>; })()}
                        {sig.toolName && <span style={{ fontSize: "0.68rem", color: "var(--fg-dim)", background: "rgba(165,182,214,0.08)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3 }}>{sig.toolName}</span>}
                        {sig.url && <a href={sig.url} target="_blank" rel="noreferrer" style={{ marginLeft: "auto", color: "var(--fg-dim)", display: "flex", alignItems: "center" }}><ExternalLink size={11} /></a>}
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        <p style={{ margin: 0, fontSize: "0.80rem", color: "rgba(250,250,250,0.72)", lineHeight: 1.65, wordBreak: "break-word" }}>
                          {sig.rawText.slice(0, 400)}{sig.rawText.length > 400 ? "…" : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Opportunities page ────────────────────────────────────────────────────────

function OpportunitiesPage() {
  const { project, product } = useProjectContext();
  const navigate = useNavigate();
  const { initialOpportunities } = Route.useLoaderData();
  const [items, setItems] = useState<OpportunityWithSignals[] | null>(initialOpportunities ?? null);
  const [loading, setLoading] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "scoreTotal", desc: true }]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set());
  const togglePin = useCallback((id: number) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      try { localStorage.setItem(`opp-pinned-${project.id}`, JSON.stringify([...next])); } catch { }
      return next;
    });
  }, [project.id]);
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(DEFAULT_COLS);

  // Sync sort/pins/cols from localStorage after hydration
  useEffect(() => {
    setSorting(loadSort(project.id));
    try {
      const r = localStorage.getItem(`opp-pinned-${project.id}`);
      if (r) setPinnedIds(new Set(JSON.parse(r)));
    } catch { }
    setVisibleCols(loadCols(project.id));
  }, [project.id]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const confirm = useConfirm();
  const [findingGaps, setFindingGaps] = useState(false);
  const [gapsMessage, setGapsMessage] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [briefingAll, setBriefingAll] = useState(false);
  const [newOppOpen, setNewOppOpen] = useState(false);
  const LOG_KEY = `brief-logs-${project.id}`;
  const LOG_OPEN_KEY = `brief-log-open-${project.id}`;
  const [reprocessLogs, setReprocessLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
    try {
      const r = sessionStorage.getItem(LOG_KEY);
      if (r) setReprocessLogs(JSON.parse(r));
      if (sessionStorage.getItem(LOG_OPEN_KEY) === "true") setLogOpen(true);
    } catch { }
  }, [LOG_KEY, LOG_OPEN_KEY]);
  useEffect(() => {
    try { sessionStorage.setItem(LOG_KEY, JSON.stringify(reprocessLogs)); } catch { }
  }, [reprocessLogs]);
  useEffect(() => {
    try { sessionStorage.setItem(LOG_OPEN_KEY, String(logOpen)); } catch { }
  }, [logOpen]);
  const [, startColTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const reprocessAbortRef = useRef<AbortController | null>(null);
  const briefingAllAbortRef = useRef<AbortController | null>(null);

  // Derive available filter options from loaded data
  const availableSectors = useMemo(() =>
    [...new Set((items ?? []).map((o) => o.sector).filter(Boolean))].sort(),
    [items]
  );
  const availablePlatforms = useMemo(() =>
    [...new Set((items ?? []).flatMap((o) => o.insightsJson?.source_platforms ?? []))].sort(),
    [items]
  );

  // Apply filters
  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((o) => {
      if (!filters.showPassed && o.pass) return false;
      if (filters.scoreMin !== null && o.scoreTotal < filters.scoreMin) return false;
      if (filters.shipScoreMin !== null) {
        const s = o.scoresJson;
        const ship = ((s["pain_urgency"] ?? 0) + (s["willingness_to_pay"] ?? 0) + (s["distribution_ready"] ?? 0)) / 3;
        if (ship < filters.shipScoreMin) return false;
      }
      if (filters.sectors.size > 0 && !filters.sectors.has(o.sector)) return false;
      if (filters.hasBrief !== null) {
        const has = !!o.briefMd && !o.briefMd.startsWith("Brief generation failed") && o.briefMd.trim().length > 0;
        if (has !== filters.hasBrief) return false;
      }
      if (filters.signalMin !== null && o.signalCount < filters.signalMin) return false;
      if (filters.platforms.size > 0) {
        const oPlats = new Set(o.insightsJson?.source_platforms ?? []);
        if (![...filters.platforms].some((p) => oPlats.has(p))) return false;
      }
      if (filters.wtpCountMin !== null) {
        const wtpCnt = o.insightsJson?.wtp_evidence?.length ?? 0;
        if (wtpCnt < filters.wtpCountMin) return false;
      }
      return true;
    });
  }, [items, filters]);

  // Pinned rows bubble to top
  const filteredSorted = useMemo(() => {
    const pinned = filtered.filter((o) => pinnedIds.has(o.id));
    const rest = filtered.filter((o) => !pinnedIds.has(o.id));
    return [...pinned, ...rest];
  }, [filtered, pinnedIds]);

  // Active filter chips for toolbar
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.showPassed) chips.push({
      key: "passed",
      label: "showing passed",
      clear: () => setFilters((f) => ({ ...f, showPassed: false })),
    });
    if (filters.scoreMin !== null) chips.push({
      key: "score", label: `Score ≥ ${filters.scoreMin}`,
      clear: () => setFilters((f) => ({ ...f, scoreMin: null })),
    });
    if (filters.shipScoreMin !== null) chips.push({
      key: "ship", label: `Ship ≥ ${filters.shipScoreMin}`,
      clear: () => setFilters((f) => ({ ...f, shipScoreMin: null })),
    });
    if (filters.signalMin !== null) chips.push({
      key: "signals", label: `Signals ≥ ${filters.signalMin}`,
      clear: () => setFilters((f) => ({ ...f, signalMin: null })),
    });
    if (filters.sectors.size > 0) chips.push({
      key: "sectors",
      label: filters.sectors.size === 1 ? [...filters.sectors][0] : `${filters.sectors.size} sectors`,
      clear: () => setFilters((f) => ({ ...f, sectors: new Set() })),
    });
    if (filters.platforms.size > 0) chips.push({
      key: "platforms",
      label: filters.platforms.size === 1 ? [...filters.platforms][0] : `${filters.platforms.size} sources`,
      clear: () => setFilters((f) => ({ ...f, platforms: new Set() })),
    });
    if (filters.hasBrief !== null) chips.push({
      key: "brief", label: filters.hasBrief ? "Has brief" : "No brief",
      clear: () => setFilters((f) => ({ ...f, hasBrief: null })),
    });
    if (filters.wtpCountMin !== null) chips.push({
      key: "wtpCount", label: `WTP signals ≥ ${filters.wtpCountMin}`,
      clear: () => setFilters((f) => ({ ...f, wtpCountMin: null })),
    });
    return chips;
  }, [filters]);

  const allSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));
  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSel = filtered.every((o) => prev.has(o.id));
      return allSel ? new Set() : new Set(filtered.map((o) => o.id));
    });
  }, [filtered]);
  const lastClickedIdxRef = useRef<number>(-1);
  const toggleOne = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = filtered.findIndex((o) => o.id === id);
    if (e.shiftKey && lastClickedIdxRef.current >= 0 && idx >= 0) {
      const lo = Math.min(idx, lastClickedIdxRef.current);
      const hi = Math.max(idx, lastClickedIdxRef.current);
      const rangeIds = filtered.slice(lo, hi + 1).map((o) => o.id);
      setSelectedIds((prev) => { const next = new Set(prev); rangeIds.forEach((rid) => next.add(rid)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    }
    lastClickedIdxRef.current = idx;
  }, [filtered]);

  async function bulkDoPass(pass: boolean) {
    const ids = [...selectedIds];
    try {
      await bulkSetPass({ data: { ids, pass } });
      setItems((prev) => prev?.map((o) => selectedIds.has(o.id) ? { ...o, pass } : o) ?? prev);
      setSelectedIds(new Set());
    } catch { }
  }

  async function bulkRemove() {
    const ids = [...selectedIds];
    const ok = await confirm(`Delete ${ids.length} opportunit${ids.length === 1 ? "y" : "ies"}?`, { variant: "danger", confirmLabel: "Delete" });
    if (!ok) return;
    try {
      await bulkDelete({ data: { ids } });
      setItems((prev) => prev?.filter((o) => !selectedIds.has(o.id)) ?? prev);
      setSelectedIds(new Set());
    } catch { }
  }

  async function bulkRunBrief() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBriefing(true);
    setReprocessLogs([]); setLogOpen(true);
    const total = ids.length; let done = 0; let failed = 0;
    const appendLog = (line: string) => { setReprocessLogs((p) => [...p, line]); requestAnimationFrame(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }); };
    appendLog(`> Generating briefs for ${total} opportunit${total === 1 ? "y" : "ies"}…`);
    const queue = [...ids];
    async function worker() {
      while (queue.length > 0) {
        const id = queue.shift()!;
        const opp = items?.find((o) => o.id === id);
        const label = (opp?.title ?? `#${id}`).slice(0, 60);
        try {
          appendLog(`  Running: "${label}"`);
          const result = await generateBriefForOpportunity({ data: { id } });
          done++; appendLog(`  ✓ [${done}/${total}] "${label}"`);
          setItems((prev) => prev?.map((o) => o.id === id ? { ...o, briefMd: result.briefMd, insightsJson: result.insightsJson } : o) ?? null);
        } catch (err: unknown) { failed++; appendLog(`  [error] "${label}": ${(err as Error).message}`); }
      }
    }
    try { await Promise.all(Array.from({ length: Math.min(2, ids.length) }, worker)); appendLog(`> Done: ${done} generated, ${failed} failed`); }
    finally { setBriefing(false); }
  }

  async function handleReprocess() {
    if (reprocessing) return;
    setReprocessing(true);
    setReprocessLogs([]);
    setLogOpen(true);

    const abort = new AbortController();
    reprocessAbortRef.current = abort;

    const append = (line: string) => {
      setReprocessLogs((p) => [...p, line]);
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    };

    try {
      const res = await fetch("/api/run-script?script=reprocess&provider=openrouter", { signal: abort.signal });
      if (!res.ok || !res.body) { append(`[error: HTTP ${res.status}]`); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const line = JSON.parse(part.slice(6)) as string;
            if (!line.startsWith("[EXIT:") && !line.startsWith("[LLM]")) append(line);
          } catch { /* ignore */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") append(`[error: ${(err as Error).message}]`);
    } finally {
      reprocessAbortRef.current = null;
      setReprocessing(false);
      getOpportunities({ data: { projectId: project.id } }).then(setItems);
    }
  }


  async function handleFindGaps() {
    if (findingGaps) return;
    if (!product) { setGapsMessage("Build a product first to run gap analysis"); return; }
    setFindingGaps(true);
    setGapsMessage(null);
    try {
      const result = await analyzeProjectGaps({ data: { productId: product.id } });
      setGapsMessage(`${result.created} gap${result.created === 1 ? "" : "s"} added`);
      getOpportunities({ data: { projectId: project.id } }).then(setItems);
      setTimeout(() => setGapsMessage(null), 3000);
    } catch (err: unknown) {
      setGapsMessage(`Error: ${(err as Error).message}`);
      setTimeout(() => setGapsMessage(null), 4000);
    } finally {
      setFindingGaps(false);
    }
  }

  function hasBrief(o: { briefMd?: string | null }) {
    return !!(o.briefMd && !o.briefMd.startsWith("Brief generation failed") && o.briefMd.trim().length > 0);
  }

  const notPassedItems = items?.filter(o => !o.pass) ?? [];
  const allHaveBriefs = notPassedItems.length > 0 && notPassedItems.every(hasBrief);

  async function generateAllBriefs(regenerate = false) {
    if (!items || items.length === 0) return;
    const notPassed = items.filter(o => !o.pass);
    const targets = regenerate ? notPassed : notPassed.filter(o => !hasBrief(o));
    if (targets.length === 0) return;

    const abort = new AbortController();
    briefingAllAbortRef.current = abort;
    setBriefingAll(true);
    setReprocessLogs([]);
    setLogOpen(true);

    const total = targets.length;
    let done = 0;
    let failed = 0;

    const appendLog = (line: string) => {
      setReprocessLogs((p) => [...p, line]);
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    };

    appendLog(`> ${regenerate ? "Regenerating" : "Generating"} playbooks for ${total} opportunit${total === 1 ? "y" : "ies"}…`);

    const queue = [...targets];

    async function worker() {
      while (queue.length > 0) {
        if (abort.signal.aborted) break;
        const opp = queue.shift()!;
        const label = opp.title.slice(0, 60);
        try {
          appendLog(`  Running: "${label}"`);
          const result = await generateBriefForOpportunity({ data: { id: opp.id } });
          if (abort.signal.aborted) break;
          done++;
          appendLog(`  ✓ [${done}/${total}] "${label}"`);
          setItems((prev) =>
            prev?.map((o) =>
              o.id === opp.id ? { ...o, briefMd: result.briefMd, insightsJson: result.insightsJson, scoresJson: result.scoresJson } : o
            ) ?? null
          );
        } catch (err: unknown) {
          if (abort.signal.aborted) break;
          failed++;
          appendLog(`  [error] "${label}": ${(err as Error).message}`);
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(2, targets.length) }, worker));
      if (abort.signal.aborted) {
        appendLog(`> Stopped. ${done} generated, ${failed} failed`);
      } else {
        appendLog(`> Done: ${done} generated, ${failed} failed`);
      }
    } finally {
      briefingAllAbortRef.current = null;
      setBriefingAll(false);
    }
  }

  const checkboxCol = useMemo<ColumnDef<OpportunityWithSignals>>(() => ({
    id: "select", size: 48, enableSorting: false,
    header: () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 8px" }}>
        <Checkbox checked={allSelected} indeterminate={!allSelected && selectedIds.size > 0} onChange={toggleAll} />
      </div>
    ),
    cell: ({ row }) => (
      <div role="checkbox" aria-checked={selectedIds.has(row.original.id)} onClick={(e) => toggleOne(row.original.id, e)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 8px", margin: "-8px 0", cursor: "pointer", minHeight: 36 }}>
        <Checkbox checked={selectedIds.has(row.original.id)} onClick={(e) => toggleOne(row.original.id, e)} />
      </div>
    ),
  }), [allSelected, selectedIds, toggleAll, toggleOne]);

  const columns = useMemo<ColumnDef<OpportunityWithSignals>[]>(() => {
    const cols: ColumnDef<OpportunityWithSignals>[] = [checkboxCol];

    if (visibleCols.has("title")) cols.push({
      id: "title", accessorKey: "title", header: () => <ColHeader id="title" label="Opportunity" />, minSize: 280,
      cell: ({ row }) => (
        <span style={{ fontWeight: 500, fontSize: "0.88rem", lineHeight: 1.35, display: "block", maxWidth: 480 }}>
          {row.original.title}
        </span>
      ),
    });
    if (visibleCols.has("shipScore")) cols.push({
      id: "shipScore", header: () => <ColHeader id="shipScore" label="Ship" />, size: 70,
      accessorFn: (row) => {
        const s = row.scoresJson;
        const pain = s["pain_urgency"] ?? 0, wtp = s["willingness_to_pay"] ?? 0, dist = s["distribution_ready"] ?? 0;
        return pain > 0 || wtp > 0 || dist > 0 ? Math.round(((pain + wtp + dist) / 3) * 10) / 10 : 0;
      },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (!v) return <span style={{ color: "var(--border)" }}>-</span>;
        const color = v >= 7 ? "var(--accent)" : v >= 5 ? "#f59e0b" : "rgba(250,250,250,0.62)";
        return <span style={{ fontSize: "0.82rem", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{v.toFixed(1)}</span>;
      },
    });
    if (visibleCols.has("scoreTotal")) cols.push({
      id: "scoreTotal", accessorKey: "scoreTotal", header: () => <ColHeader id="scoreTotal" label="Score" />, size: 80,
      cell: ({ getValue }) => <ScoreDot score={getValue() as number} />,
    });
    if (visibleCols.has("mrr")) cols.push({
      id: "mrr", header: () => <ColHeader id="mrr" label="MRR" />, size: 100,
      accessorFn: (row) => row.insightsJson?.mrr_avg ?? 0,
      cell: ({ row }) => <MrrCell insights={row.original.insightsJson} />,
    });
    if (visibleCols.has("sector")) cols.push({
      id: "sector", accessorKey: "sector", header: () => <ColHeader id="sector" label="Sector" />, size: 90,
      cell: ({ getValue }) => (
        <span style={{ fontSize: "0.82rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)" }}>
          {getValue() as string}
        </span>
      ),
    });
    if (visibleCols.has("community")) cols.push({
      id: "community", accessorKey: "community", header: () => <ColHeader id="community" label="Community" />,
      cell: ({ row }) => (
        <span style={{ fontSize: "0.86rem", color: "rgba(250,250,250,0.80)" }}>
          {row.original.community}
          {row.original.communityUrl && (
            <a href={row.original.communityUrl} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ marginLeft: 5, color: "var(--accent)", verticalAlign: "middle" }}>
              <ExternalLink size={9} />
            </a>
          )}
        </span>
      ),
    });
    if (visibleCols.has("platforms")) cols.push({
      id: "platforms", header: () => <ColHeader id="platforms" label="Sources" />, size: 100, enableSorting: false,
      accessorFn: (row) => row.insightsJson?.source_platforms?.length ?? 0,
      cell: ({ row }) => <SourceBadges platforms={row.original.insightsJson?.source_platforms} />,
    });
    if (visibleCols.has("wtp")) cols.push({
      id: "wtp", header: () => <ColHeader id="wtp" label="WTP" />, size: 55,
      accessorFn: (row) => row.scoresJson?.willingness_to_pay ?? 0,
      cell: ({ row }) => <SubScore value={row.original.scoresJson?.willingness_to_pay} />,
    });
    if (visibleCols.has("urgency")) cols.push({
      id: "urgency", header: () => <ColHeader id="urgency" label="Urgency" />, size: 65,
      accessorFn: (row) => row.scoresJson?.pain_urgency ?? 0,
      cell: ({ row }) => <SubScore value={row.original.scoresJson?.pain_urgency} />,
    });
    if (visibleCols.has("viral")) cols.push({
      id: "viral", header: () => <ColHeader id="viral" label="Viral" />, size: 55,
      accessorFn: (row) => row.scoresJson?.viral_potential ?? 0,
      cell: ({ row }) => <SubScore value={row.original.scoresJson?.viral_potential} />,
    });
    if (visibleCols.has("build")) cols.push({
      id: "build", header: () => <ColHeader id="build" label="Build" />, size: 55,
      accessorFn: (row) => row.scoresJson?.build_simplicity ?? 0,
      cell: ({ row }) => <SubScore value={row.original.scoresJson?.build_simplicity} />,
    });
    if (visibleCols.has("legal")) cols.push({
      id: "legal", header: () => <ColHeader id="legal" label="Legal" />, size: 60,
      accessorFn: (row) => row.scoresJson?.legal_safety ?? 0,
      cell: ({ row }) => {
        const v = row.original.scoresJson?.legal_safety;
        // 0 = not assessed (LLM defaulted) - show - instead of misleading red 0
        return <SubScore value={v === 0 || v === undefined ? undefined : v} />;
      },
    });
    if (visibleCols.has("priceAnchor")) cols.push({
      id: "priceAnchor", header: () => <ColHeader id="priceAnchor" label="Price Signal" />, size: 180,
      accessorFn: (row) => row.insightsJson?.price_anchor ?? "",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v
          ? <span style={{ fontSize: "0.84rem", color: "var(--accent)", opacity: 0.85 }}>{v.slice(0, 80)}{v.length > 80 ? "…" : ""}</span>
          : <span style={{ color: "var(--border)" }}>-</span>;
      },
    });
    if (visibleCols.has("buyer")) cols.push({
      id: "buyer", header: () => <ColHeader id="buyer" label="Buyer" />, size: 200,
      accessorFn: (row) => row.insightsJson?.buyer_persona ?? "",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v
          ? <span style={{ fontSize: "0.84rem", color: "rgba(250,250,250,0.80)" }}>{v.slice(0, 80)}{v.length > 80 ? "…" : ""}</span>
          : <span style={{ color: "var(--border)" }}>-</span>;
      },
    });
    if (visibleCols.has("brief")) cols.push({
      id: "brief", header: () => <ColHeader id="brief" label="Brief" />, size: 55, enableSorting: false,
      accessorFn: (row) => {
        const b = row.briefMd;
        return b && !b.startsWith("Brief generation failed") && b.trim() ? 1 : 0;
      },
      cell: ({ row }) => {
        const b = row.original.briefMd;
        const has = b && !b.startsWith("Brief generation failed") && b.trim();
        return has
          ? <span style={{ color: "var(--accent)", fontSize: "0.82rem", fontWeight: 700 }}>✓</span>
          : <span style={{ color: "var(--border)" }}>-</span>;
      },
    });
    if (visibleCols.has("signalCount")) cols.push({
      id: "signalCount", accessorKey: "signalCount", header: () => <ColHeader id="signalCount" label="Signals" />, size: 70,
      cell: ({ row }) => (
        <SignalViewer opportunityId={row.original.id} signalCount={row.original.signalCount} />
      ),
    });
    if (visibleCols.has("wtpCount")) cols.push({
      id: "wtpCount",
      header: () => <ColHeader id="wtpCount" label="WTP Signals" />,
      size: 90,
      accessorFn: (row) => row.insightsJson?.wtp_evidence?.length ?? 0,
      cell: ({ getValue }) => {
        const n = getValue() as number;
        if (n === 0) return <span style={{ color: "var(--border)" }}>-</span>;
        return (
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fbbf24", fontVariantNumeric: "tabular-nums" }}>
            $ {n}
          </span>
        );
      },
    });
    if (visibleCols.has("createdAt")) cols.push({
      id: "createdAt", accessorKey: "createdAt", header: () => <ColHeader id="createdAt" label="Found" />, size: 130,
      cell: ({ getValue }) => {
        const d = new Date(getValue() as Date);
        return (
          <span style={{ fontSize: "0.82rem", color: "rgba(250,250,250,0.68)", fontVariantNumeric: "tabular-nums" }}>
            {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
            <span style={{ color: "rgba(250,250,250,0.38)" }}>{d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          </span>
        );
      },
    });

    return cols;
  }, [visibleCols, checkboxCol, setItems, pinnedIds, togglePin, items]);

  const [columnSizing, setColumnSizing] = useState<Record<string, number>>({});

  // ── Context menu ────────────────────────────────────────────────────────────
  type CtxMenu = { x: number; y: number; opp: OpportunityWithSignals };
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    function close(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setCtxMenu(null); }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, [!!ctxMenu]);
  const table = useReactTable({
    data: filteredSorted,
    columns,
    columnResizeMode: "onChange",
    state: { sorting, columnSizing },
    onColumnSizingChange: setColumnSizing,
    onSortingChange: (updater) => {
      setSorting((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        saveSort(project.id, next);
        return next;
      });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const vItems = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const paddingTop = vItems.length > 0 ? vItems[0].start : 0;
  const paddingBottom = vItems.length > 0 ? totalHeight - vItems[vItems.length - 1].end : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        {/* Toolbar placeholder */}
        <div style={{ height: 44, flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, padding: "0 20px" }}>
          <div className="sk" style={{ width: 48, height: 13 }} />
          <div className="sk" style={{ width: 130, height: 26 }} />
          <div style={{ flex: 1 }} />
          <div className="sk" style={{ width: 70, height: 26 }} />
          <div className="sk" style={{ width: 70, height: 26 }} />
        </div>
        {/* Table skeleton */}
        <div style={{ flex: 1, overflow: "hidden", padding: "0 0" }}>
          {/* Header row */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "10px 20px", background: "rgba(165,182,214,0.03)" }}>
            {[48, 260, 60, 60, 80, 80, 90, 80, 60].map((w, i) => (
              <div key={i} className="sk" style={{ width: w, height: 10, marginRight: 12, flexShrink: 0 }} />
            ))}
          </div>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", padding: "11px 20px", alignItems: "center", opacity: 1 - i * 0.04 }}>
              <div className="sk" style={{ width: 14, height: 14, borderRadius: 2, marginRight: 24, flexShrink: 0 }} />
              <div className="sk" style={{ width: `${180 + (i % 4) * 40}px`, height: 13, marginRight: 12, flexShrink: 0 }} />
              <div className="sk" style={{ width: 36, height: 13, marginRight: 12, flexShrink: 0 }} />
              <div className="sk" style={{ width: 36, height: 13, marginRight: 12, flexShrink: 0 }} />
              <div className="sk" style={{ width: 55, height: 20, borderRadius: 3, marginRight: 12, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center",
        padding: "0 20px", height: 40, flexShrink: 0,
        borderBottom: activeChips.length > 0 ? "none" : "1px solid var(--border)", gap: 8,
      }}>
        {/* Left: filters + columns */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          emptyFilters={EMPTY_FILTERS}
          isEmpty={isFiltersEmpty}
          availableSectors={availableSectors}
          availablePlatforms={availablePlatforms}
          align="left"
        />
        <ColPicker
          visible={visibleCols}
          onChange={(next) => startColTransition(() => { setVisibleCols(next); saveCols(project.id, next); })}
          onReset={() => startColTransition(() => { setVisibleCols(DEFAULT_COLS); saveCols(project.id, DEFAULT_COLS); })}
          align="left"
        />
        <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", flexShrink: 0 }}>
          {filtered.length}
          {filtered.length !== (items?.length ?? 0) && <span style={{ color: "rgba(250,250,250,0.18)" }}> / {items?.length ?? 0}</span>}
          {" "}opp{filtered.length === 1 ? "" : "s"}
        </span>

        <div style={{ flex: 1 }} />

        {/* Right: actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateAllBriefs(allHaveBriefs)}
          disabled={briefingAll || reprocessing || notPassedItems.length === 0}
          title={allHaveBriefs ? "Regenerate playbooks for all non-passed opportunities" : "Generate playbooks for non-passed opportunities without one"}
          style={{ gap: 5, border: `1px solid ${briefingAll ? "rgba(167,139,250,0.35)" : "var(--border)"}`, color: briefingAll ? "var(--purple)" : "rgba(250,250,250,0.35)", fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          <RefreshCw size={11} style={{ animation: briefingAll ? "spin 1s linear infinite" : "none" }} />
          {briefingAll ? "Generating…" : allHaveBriefs ? "Regenerate Playbooks" : "Generate Playbooks"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReprocess}
          disabled={reprocessing}
          title="Re-cluster all signals into opportunities"
          style={{ gap: 5, border: `1px solid ${reprocessing ? "rgba(0,255,136,0.3)" : "var(--border)"}`, color: reprocessing ? "var(--accent)" : "rgba(250,250,250,0.35)", fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase" }}
        >
          <RefreshCw size={11} style={{ animation: reprocessing ? "spin 1s linear infinite" : "none" }} />
          {reprocessing ? "Clustering…" : "Run Cluster"}
        </Button>
        {product?.deployStatus === "deployed" && product?.domain && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleFindGaps}
            disabled={findingGaps}
            title={`Crawl ${product.domain} and generate gap opportunities from market signals`}
            style={{
              gap: 5,
              border: `1px solid ${findingGaps ? "rgba(250,204,21,0.4)" : gapsMessage && !gapsMessage.startsWith("Error") ? "rgba(0,255,136,0.4)" : gapsMessage?.startsWith("Error") ? "rgba(239,68,68,0.4)" : "var(--border)"}`,
              color: findingGaps ? "rgba(250,204,21,0.9)" : gapsMessage && !gapsMessage.startsWith("Error") ? "var(--accent)" : gapsMessage?.startsWith("Error") ? "rgba(239,68,68,0.8)" : "rgba(250,250,250,0.35)",
              fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase",
              background: findingGaps ? "rgba(250,204,21,0.04)" : "transparent",
            }}
          >
            <Sparkles size={11} style={{ animation: findingGaps ? "pulse 1s ease-in-out infinite" : "none" }} />
            {findingGaps ? "Analysing gaps…" : gapsMessage ?? "Find Gaps"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setNewOppOpen(true)}
          style={{ gap: 5, fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.35)" }}
        >
          <Plus size={11} /> Create opportunity
        </Button>
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap",
          padding: "6px 20px", flexShrink: 0,
          borderBottom: "1px solid var(--border)",
          background: "rgba(0,255,136,0.015)",
        }}>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: "0.72rem", fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", padding: "2px 7px 2px 9px",
                border: "1px solid rgba(0,255,136,0.25)",
                background: "rgba(0,255,136,0.06)",
                color: "var(--accent)",
              }}
            >
              {chip.label}
              <Button
                variant="ghost"
                size="sm"
                onClick={chip.clear}
                style={{ padding: 0, height: "auto", color: "rgba(0,255,136,0.6)", lineHeight: 1 }}
              >
                <X size={10} />
              </Button>
            </span>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters(EMPTY_FILTERS)}
            style={{ padding: "2px 4px", fontSize: "0.70rem", color: "rgba(250,250,250,0.28)", height: "auto", letterSpacing: "0.04em" }}
          >
            clear all
          </Button>
        </div>
      )}



      {/* Context menu */}
      {ctxMenu && createPortal(
        <div
          ref={ctxRef}
          style={{
            position: "fixed",
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 9999,
            background: "var(--bg-elevated)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "4px",
            minWidth: 180,
            boxShadow: "0 8px 32px rgba(0,0,0,0.55)",
          }}
        >
          {/* Build */}
          <button
            onClick={async () => {
              setCtxMenu(null);
              const opp = ctxMenu.opp;
              const isBuilding = opp.status === "building";
              const next = isBuilding ? "new" : "building";
              if (next === "building") {
                const prev = items?.find((o) => o.status === "building" && o.id !== opp.id);
                if (prev) {
                  await setOpportunityStatus({ data: { id: prev.id, status: "new" } });
                  setItems((p) => p?.map((o) => o.id === prev.id ? { ...o, status: "new" as never } : o) ?? p);
                }
              }
              await setOpportunityStatus({ data: { id: opp.id, status: next } });
              setItems((p) => p?.map((o) => o.id === opp.id ? { ...o, status: next as never } : o) ?? p);
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", color: "var(--accent)", textAlign: "left", fontWeight: 600 }}
          >
            <Hammer size={13} />
            {ctxMenu.opp.status === "building" ? "Stop building" : "Build this"}
          </button>

          {/* New project from opportunity */}
          <button
            onClick={() => {
              const oppId = ctxMenu.opp.id;
              setCtxMenu(null);
              navigate({ to: "/i/new", search: { opportunityId: oppId } });
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", color: "var(--fg-muted)", textAlign: "left" }}
          >
            <Plus size={13} />
            New project from this
          </button>

          {/* Add to favorites (pin) */}
          <button
            onClick={() => {
              setCtxMenu(null);
              togglePin(ctxMenu.opp.id);
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", color: pinnedIds.has(ctxMenu.opp.id) ? "#facc15" : "var(--fg-muted)", textAlign: "left" }}
          >
            <Bookmark size={13} style={{ fill: pinnedIds.has(ctxMenu.opp.id) ? "#facc15" : "none" }} />
            {pinnedIds.has(ctxMenu.opp.id) ? "Remove from favourites" : "Add to favourites"}
          </button>

          {/* Pass */}
          <button
            onClick={async () => {
              setCtxMenu(null);
              const opp = ctxMenu.opp;
              const next = !opp.pass;
              await bulkSetPass({ data: { ids: [opp.id], pass: next } });
              setItems((prev) => prev?.map((o) => o.id === opp.id ? { ...o, pass: next } : o) ?? prev);
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", color: "var(--fg-muted)", textAlign: "left" }}
          >
            <Archive size={13} />
            {ctxMenu.opp.pass ? "Unpass" : "Pass (archive)"}
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />

          {/* Delete */}
          <button
            onClick={async () => {
              setCtxMenu(null);
              const ok = await confirm(`Delete "${ctxMenu.opp.title}"?`);
              if (!ok) return;
              await bulkDelete({ data: { ids: [ctxMenu.opp.id] } });
              setItems((prev) => prev?.filter((o) => o.id !== ctxMenu.opp.id) ?? prev);
            }}
            style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 12px", background: "none", border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", color: "rgba(239,68,68,0.8)", textAlign: "left" }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 20px", height: 36, flexShrink: 0, borderBottom: "1px solid var(--border)", borderLeft: "2px solid var(--accent)", background: "rgba(0,255,136,0.02)" }}>
          <span style={{ fontSize: "0.84rem", color: "var(--accent)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginRight: 4 }}>{selectedIds.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => bulkDoPass(true)} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.75)", padding: "2px 10px", fontSize: "0.84rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", height: "auto" }}>Pass</Button>
          <Button variant="outline" size="sm" onClick={() => bulkDoPass(false)} style={{ padding: "2px 10px", fontSize: "0.84rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", height: "auto", color: "rgba(250,250,250,0.55)" }}>Unpass</Button>
          <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 2px" }} />
          <Button variant="outline" size="sm" onClick={bulkRunBrief} disabled={briefing} style={{ padding: "2px 10px", fontSize: "0.84rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", height: "auto", color: "rgba(250,250,250,0.55)" }}>{briefing ? "Generating…" : "Generate Playbook"}</Button>
          <div style={{ width: 1, height: 14, background: "var(--border)", margin: "0 2px" }} />
          <Button variant="outline" size="sm" onClick={bulkRemove} style={{ border: "1px solid rgba(239,68,68,0.25)", color: "rgba(239,68,68,0.7)", padding: "2px 8px", fontSize: "0.84rem", height: "auto" }}>Delete</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} style={{ marginLeft: "auto", color: "rgba(250,250,250,0.55)", fontSize: "0.84rem", height: "auto" }}>clear</Button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "auto" }}>
          <table className="opp-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#070c12" }}>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {hg.headers.map((header, i) => {
                    const sorted = header.column.getIsSorted();
                    const isActions = header.column.id === "pass";
                    const isTitle = header.column.id === "title";
                    const isSelect = header.column.id === "select";
                    return (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        style={{
                          textAlign: "left",
                          paddingLeft: i === 0 ? "16px" : "0",
                          paddingRight: "12px",
                          height: 36,
                          fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase",
                          color: sorted ? "var(--accent)" : "rgba(250,250,250,0.38)",
                          userSelect: "none",
                          cursor: header.column.getCanSort() ? "pointer" : "default",
                          whiteSpace: "nowrap",
                          width: header.getSize(),
                          position: "relative",
                          ...(isActions ? { position: "sticky", right: 0, background: "#070c12", boxShadow: "-1px 0 0 rgba(255,255,255,0.06)", paddingRight: 16, zIndex: 2 } : {}),
                          ...(isSelect ? { position: "sticky", left: 0, background: "#070c12", zIndex: 2 } : {}),
                          ...(isTitle ? { position: "sticky", left: 48, background: "#070c12", boxShadow: "1px 0 0 rgba(255,255,255,0.04)", zIndex: 2 } : {}),
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span style={{ opacity: sorted ? 1 : 0.3 }}>
                              {sorted === "asc" ? <ChevronUp size={9} /> : sorted === "desc" ? <ChevronDown size={9} /> : <ChevronsUpDown size={9} />}
                            </span>
                          )}
                        </span>
                        {header.column.getCanResize() && !isActions && !isSelect && (
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); header.getResizeHandler()(e); }}
                            onTouchStart={header.getResizeHandler()}
                            style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 1, background: header.column.getIsResizing() ? "var(--accent)" : "transparent" }}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && <tr><td colSpan={columns.length} style={{ height: paddingTop, padding: 0 }} /></tr>}
              {vItems.map((vi) => {
                const row = rows[vi.index];
                const isPinned = pinnedIds.has(row.original.id);
                const isSelected = selectedIds.has(row.original.id);
                const isBuilding = row.original.status === "building";
                const isPassed = row.original.pass;
                const rowBg = isSelected ? "rgba(0,255,136,0.02)" : isPassed ? "rgba(239,68,68,0.03)" : isBuilding ? "rgba(96,165,250,0.08)" : isPinned ? "rgba(250,204,21,0.02)" : undefined;
                return (
                  <tr
                    key={row.id}
                    data-index={vi.index}
                    ref={virtualizer.measureElement}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[role=checkbox]")) return;
                      if (e.shiftKey) { e.preventDefault(); toggleOne(row.original.id, e); return; }
                      if (selectedIds.size > 0) { toggleOne(row.original.id, e); return; }
                      if (e.metaKey || e.ctrlKey) window.open(`/opportunity/${row.original.id}`, "_blank");
                      else navigate({ to: "/i/$id/opportunities", params: { id: String(project.id) }, search: { opp: row.original.id } });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ x: e.clientX, y: e.clientY, opp: row.original });
                    }}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                      borderLeft: isBuilding ? "2px solid var(--accent)" : isPinned ? "2px solid #facc15" : isPassed ? "2px solid rgba(239,68,68,0.3)" : undefined,
                      background: rowBg,
                    }}
                  >
                    {row.getVisibleCells().map((cell, i) => {
                      const isActions = cell.column.id === "pass";
                      const isTitleCell = cell.column.id === "title";
                      const isSelectCell = cell.column.id === "select";
                      // Only set explicit bg on sticky cells when row has a special tint (to block scrolled content behind).
                      // For normal rows leave it unset so sticky cells inherit the tr hover background.
                      const specialBg = isPassed ? "rgba(239,68,68,0.03)" : isPinned ? "rgba(250,204,21,0.02)" : isBuilding ? "rgba(0,255,136,0.015)" : null;
                      const cellBg = specialBg ?? "var(--bg)";
                      return (
                        <td key={cell.id}
                          {...((isSelectCell || isTitleCell) ? { "data-sticky": "1" } : {})}
                          style={{
                            padding: "10px 14px 10px 0",
                            paddingLeft: i === 0 ? "16px" : "0",
                            verticalAlign: "middle",
                            borderLeft: i === 0 ? "2px solid transparent" : undefined,
                            width: cell.column.getSize(),
                            maxWidth: cell.column.getSize(),
                            overflow: "hidden",
                            ...(isSelectCell ? { position: "sticky", left: 0, background: specialBg ?? "var(--bg)", zIndex: 1 } : {}),
                            ...(isTitleCell ? { position: "sticky", left: 48, background: specialBg ?? "var(--bg)", boxShadow: "1px 0 0 var(--border)", paddingRight: 16, zIndex: 1 } : {}),
                            ...(isActions ? {
                              position: "sticky", right: 0,
                              background: specialBg ?? "var(--bg)",
                              boxShadow: "-1px 0 0 var(--border)",
                              paddingLeft: 12,
                              paddingRight: 16,
                            } : {}),
                          }}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {paddingBottom > 0 && <tr><td colSpan={columns.length} style={{ height: paddingBottom, padding: 0 }} /></tr>}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div style={{ padding: "60px 32px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--fg-subtle)", fontStyle: "italic" }}>
                No opportunities yet - run Scout to find them.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Run Cluster / Brief log - bottom drawer */}
      {logOpen && (
        <div style={{
          flexShrink: 0,
          borderTop: "1px solid var(--border)",
          background: "#050607",
        }}>
          {/* Header bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "5px 20px",
            borderBottom: "1px solid var(--border)",
            background: "#070c12",
          }}>
            <RefreshCw size={10} style={{
              color: (reprocessing || briefing || briefingAll) ? "var(--accent)" : "var(--fg-subtle)",
              animation: (reprocessing || briefing || briefingAll) ? "spin 1s linear infinite" : "none",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: (reprocessing || briefing || briefingAll) ? "var(--accent)" : "var(--fg-subtle)",
            }}>
              {reprocessing ? "Clustering…" : briefingAll ? "Generating playbooks…" : briefing ? "Generating playbook…" : "Done"}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {reprocessing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { reprocessAbortRef.current?.abort(); }}
                  style={{ padding: "0 4px", fontSize: "0.72rem", color: "rgba(239,68,68,0.6)", height: "auto", letterSpacing: "0.04em" }}
                >
                  stop
                </Button>
              )}
              {briefingAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { briefingAllAbortRef.current?.abort(); }}
                  style={{ padding: "0 4px", fontSize: "0.72rem", color: "rgba(239,68,68,0.6)", height: "auto", letterSpacing: "0.04em" }}
                >
                  stop
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogOpen(false)}
                style={{ padding: "0 4px", fontSize: "0.72rem", color: "var(--fg-subtle)", height: "auto", letterSpacing: "0.04em" }}
              >
                hide
              </Button>
            </span>
          </div>
          {/* Log lines */}
          <div
            ref={logRef}
            style={{
              padding: "10px 20px",
              fontFamily: "inherit",
              fontSize: "0.76rem",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {reprocessLogs.length === 0 ? (
              <span style={{ color: "var(--fg-subtle)" }}>No output yet…</span>
            ) : reprocessLogs.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith("[error") || line.startsWith("[FAILED") ? "#ef4444" :
                  line.startsWith(">") ? "var(--accent)" : "var(--fg-muted)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New opportunity modal ── */}
      {newOppOpen && createPortal(
        <NewOpportunityModal
          projectId={project.id}
          onClose={() => setNewOppOpen(false)}
          onCreated={(opp) => {
            setItems((prev) => prev ? [opp as any, ...prev] : [opp as any]);
            setNewOppOpen(false);
          }}
        />,
        document.body
      )}
    </div>
  );
}

function NewOpportunityModal({ projectId, onClose, onCreated }: {
  projectId: number;
  onClose: () => void;
  onCreated: (opp: any) => void;
}) {
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if ((e.key === "Enter" && (e.metaKey || e.ctrlKey))) generate();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [description, onClose]);

  async function generate() {
    if (!description.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const result = await generateAndCreateOpportunity({
        data: { projectId, description: description.trim() },
      }) as any;
      onCreated({
        id: result.id, projectId,
        title: result.title, painSummary: result.painSummary,
        sector: result.sector, community: result.community,
        scoreTotal: result.scoreTotal ?? 0,
        scoresJson: result.scoresJson ?? {},
        insightsJson: result.insightsJson ?? {},
        briefMd: result.briefMd ?? "",
        status: "new", pass: false, signalCount: 0,
        createdAt: new Date(), updatedAt: new Date(),
      });
    } catch (err: any) {
      setError(err?.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", zIndex: 9001, top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 480, background: "#0c0c0f", border: "1px solid rgba(165,182,214,0.12)", boxShadow: "0 32px 80px rgba(0,0,0,0.85)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(165,182,214,0.07)" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>Create opportunity</h2>
            <p style={{ margin: "3px 0 0", fontSize: "0.74rem", color: "rgba(165,182,214,0.4)" }}>
              Describe the opportunity - AI generates scores, insights, and a full playbook
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} style={{ color: "rgba(165,182,214,0.4)", padding: 4 }}>
            <X size={16} />
          </Button>
        </div>

        <div style={{ padding: "20px" }}>
          <textarea
            autoFocus
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Freelance designers who use Figma and need to send invoices but have no payment tool built in - they copy-paste into PayPal every time"
            rows={9}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "rgba(165,182,214,0.04)",
              border: "1px solid rgba(165,182,214,0.12)",
              color: "var(--fg)", padding: "10px 12px",
              fontSize: "0.88rem", lineHeight: 1.65,
              outline: "none", fontFamily: "inherit", resize: "vertical",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,255,136,0.35)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(165,182,214,0.12)"; }}
          />
          {error && (
            <p style={{ margin: "8px 0 0", fontSize: "0.78rem", color: "rgba(239,68,68,0.8)" }}>{error}</p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: "0.70rem", color: "rgba(165,182,214,0.3)", lineHeight: 1.5 }}>
            Be specific: name the persona, the pain, the existing tools, and why they fail. AI will fill gaps. Takes ~10s. ⌘↵ to generate.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid rgba(165,182,214,0.07)", alignItems: "center" }}>
          <Button variant="primary" size="sm" onClick={generate} disabled={generating || !description.trim()} style={{ gap: 6 }}>
            {generating ? (
              <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Generating…</>
            ) : (
              <><Zap size={11} /> Generate opportunity</>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </>
  );
}
