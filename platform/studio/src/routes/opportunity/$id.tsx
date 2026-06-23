import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ExternalLink, Zap, Square, MoreHorizontal, Bookmark, Hammer, Trash2, Archive, Download, Copy, Check, RefreshCw, FileText, PenLine } from "lucide-react";
import { Button } from "~/components/ui/Button";
import { getOpportunity, generateBriefForOpportunity, setOpportunityStatus, bulkSetPass, bulkDelete, selectOpportunityToBuild, getProjectVersions, refineOpportunity } from "~/lib/server-fns";
import { ScoreRadar } from "~/components/ScoreRadar";
import { Modal } from "~/components/ui/Modal";
import { SCORE_CRITERIA } from "~/lib/types";
import type { WtpSignal, WtpSignalType, FeatureSpec, FeatureFeasibility } from "~/lib/types";
import { useConfirm } from "~/components/ui/Confirm";

function daysAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "1d ago";
  return `${diff}d ago`;
}

const SOURCE_COLORS = {
  reddit: { fg: "#ff6314", border: "rgba(255,99,20,0.3)" },
  hn: { fg: "#e17b3c", border: "rgba(225,123,60,0.3)" },
  twitter: { fg: "#1d9bf0", border: "rgba(29,155,240,0.3)" },
  g2: { fg: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  capterra: { fg: "#3b82f6", border: "rgba(59,130,246,0.3)" },
  jobs: { fg: "#a78bfa", border: "rgba(167,139,250,0.3)" },
};

function OppPending() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header skeleton */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", padding: "20px 32px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div className="sk" style={{ width: 24, height: 24, borderRadius: 4 }} />
          <div className="sk" style={{ width: 60, height: 26, borderRadius: 4 }} />
        </div>
        <div className="sk" style={{ width: "55%", height: 32, marginBottom: 12 }} />
        <div className="sk" style={{ width: "75%", height: 14, marginBottom: 6 }} />
        <div className="sk" style={{ width: "50%", height: 14, marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div className="sk" style={{ width: 70, height: 20 }} />
          <div className="sk" style={{ width: 100, height: 20 }} />
          <div className="sk" style={{ width: 55, height: 20 }} />
          <div style={{ marginLeft: "auto", display: "flex", gap: 0 }}>
            <div className="sk" style={{ width: 80, height: 36 }} />
            <div className="sk" style={{ width: 80, height: 36, marginLeft: 1 }} />
          </div>
        </div>
      </div>
      {/* Body skeleton */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar */}
        <div style={{ width: 260, flexShrink: 0, borderRight: "1px solid var(--border)", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div className="sk" style={{ width: 60, height: 9 }} />
              <div className="sk" style={{ width: "90%", height: 13 }} />
            </div>
          ))}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="sk" style={{ width: 80, height: 9, flexShrink: 0 }} />
                <div className="sk" style={{ flex: 1, height: 4 }} />
                <div className="sk" style={{ width: 16, height: 9 }} />
              </div>
            ))}
          </div>
        </div>
        {/* Main */}
        <div style={{ flex: 1, padding: "28px 36px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="sk" style={{ width: 120, height: 11 }} />
          <div className="sk" style={{ width: "100%", height: 80 }} />
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="sk" key={i} style={{ width: `${90 - i * 6}%`, height: 13 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/opportunity/$id")({
  loader: async ({ params }) => {
    const opp = await getOpportunity({ data: { id: parseInt(params.id, 10) } });
    if (!opp) throw new Error("Not found");

    const { remark } = await import("remark");
    const html = await import("remark-html");
    const gfm = await import("remark-gfm");
    const file = await remark().use(gfm.default).use(html.default).process(opp.briefMd);

    // Build state now lives on the Product (products own project_versions).
    const activeBuildVersion = null as { versionNumber: number; opportunityId: number | null } | null;
    return { opp, briefHtml: String(file), activeBuildVersion };
  },
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: OppPending,
  component: OpportunityPage,
});

function parseBriefSections(html: string): Array<{ heading: string; html: string }> {
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

function isBriefSectionWide(heading: string): boolean {
  const h = heading.toLowerCase();
  return h.includes("competitor") || h.includes("distribution") ||
    h.includes("mrr") || h.includes("revenue") || h.includes("expected") ||
    h.includes("landscape") || h.includes("channel") || h === "";
}

function ScoreBar({ label, value, reason }: { label: string; value: number; reason?: string }) {
  const color = value >= 7 ? "var(--accent)" : value >= 5 ? "#f59e0b" : "#ef4444";
  return (
    <div title={reason || undefined} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "7px 0", cursor: reason ? "help" : "default" }}>
      <span style={{
        fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase",
        letterSpacing: "0.05em", minWidth: "120px", flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 2, background: "var(--border)", position: "relative" as const }}>
        <div style={{
          position: "absolute" as const, left: 0, top: 0, height: "100%",
          width: `${(value / 10) * 100}%`, background: color, transition: "width 0.4s ease",
        }} />
      </div>
      <span style={{ fontSize: "0.92rem", fontWeight: 600, color, minWidth: "20px", textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

const WTP_TYPE_LABELS: Record<WtpSignalType, string> = {
  workaround: "workaround",
  budget_spend: "$ spend",
  job_posting: "job posting",
  already_paying: "paying for bad alt",
  repeated_attempts: "tried many tools",
  competitor_complaint: "competitor gap",
};

const WTP_TYPE_COLORS: Record<WtpSignalType, string> = {
  workaround: "rgba(251,191,36,0.7)",
  budget_spend: "var(--accent)",
  job_posting: "#a78bfa",
  already_paying: "rgba(251,191,36,0.7)",
  repeated_attempts: "rgba(250,250,250,0.68)",
  competitor_complaint: "rgba(239,68,68,0.7)",
};

function WtpEvidencePanel({ evidence, signals }: {
  evidence: WtpSignal[];
  signals?: Array<{ rawText: string; url: string; postedAt: Date | null; scrapedAt: Date }>;
}) {
  function resolveSignal(e: WtpSignal) {
    if (!signals?.length) return null;
    // match by url first, then by excerpt
    const byUrl = e.url ? signals.find((s) => s.url === e.url) : null;
    if (byUrl) return byUrl;
    const needle = e.excerpt.replace(/["""]/g, "").trim().toLowerCase();
    return signals.find((s) => s.url && s.rawText.toLowerCase().includes(needle.slice(0, 60))) ?? null;
  }

  function resolveUrl(e: WtpSignal): string | null {
    if (e.url) return e.url;
    return resolveSignal(e)?.url ?? null;
  }

  return (
    <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 20 }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {(evidence as any[]).map((e, i) => {
          if (typeof e === "string") {
            return (
              <div key={i} style={{ padding: "10px 8px", margin: "0 -8px", borderBottom: i < evidence.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "rgba(250,250,250,0.82)", lineHeight: 1.65, fontStyle: "italic" }}>"{e}"</p>
              </div>
            );
          }
          const url = resolveUrl(e);
          const sig = resolveSignal(e);
          const age = sig ? daysAgo(sig.postedAt ?? sig.scrapedAt) : "";
          return (
            <div
              key={i}
              onClick={() => url && window.open(url, "_blank", "noreferrer")}
              style={{
                display: "flex", gap: "12px", alignItems: "flex-start",
                padding: "10px 8px", margin: "0 -8px",
                cursor: url ? "pointer" : "default",
                borderRadius: 3,
              }}
            >
              <div style={{ display: "flex", gap: "5px", flexShrink: 0, paddingTop: "1px", alignItems: "center" }}>
                <span style={{
                  fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.06em",
                  textTransform: "uppercase", padding: "2px 6px",
                  display: "inline-flex", alignItems: "center", gap: "3px",
                  color: SOURCE_COLORS[e.source as keyof typeof SOURCE_COLORS]?.fg ?? "var(--muted)",
                  border: `1px solid ${SOURCE_COLORS[e.source as keyof typeof SOURCE_COLORS]?.border ?? "var(--border)"}`,
                }}>
                  {e.source}
                  {url && <ExternalLink size={8} />}
                </span>
                <span style={{
                  fontSize: "0.76rem", fontWeight: 600, letterSpacing: "0.06em",
                  textTransform: "uppercase", padding: "2px 6px",
                  color: WTP_TYPE_COLORS[e.type as WtpSignalType] ?? "var(--muted)",
                  border: "1px solid var(--border)",
                }}>
                  {WTP_TYPE_LABELS[e.type as WtpSignalType] ?? e.type}
                </span>
                {age && (
                  <span style={{ fontSize: "0.70rem", color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap" }}>
                    {age}
                  </span>
                )}
              </div>
              <p style={{
                margin: 0, fontSize: "0.84rem", color: "rgba(250,250,250,0.82)",
                lineHeight: 1.65, fontStyle: "italic",
              }}>
                "{e.excerpt}"
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SignalCard ────────────────────────────────────────────────────────────────

type SigItem = NonNullable<NonNullable<ReturnType<typeof Route.useLoaderData>["opp"]["signals"]>[number]>;

function parseRawText(rawText: string): { headline: string; body: string } {
  const trimmed = rawText.trim();
  // Split at first double newline - first block = headline/title, rest = body
  const dbl = trimmed.indexOf("\n\n");
  if (dbl !== -1) {
    const head = trimmed.slice(0, dbl).trim();
    const rest = trimmed.slice(dbl + 2).trim();
    // Only treat as headline if it looks like a title (short, no newline inside)
    if (head.length <= 200 && !head.includes("\n")) {
      return { headline: head, body: rest };
    }
  }
  // Fall back: first line as headline if short enough
  const nl = trimmed.indexOf("\n");
  if (nl !== -1 && nl <= 160) {
    return { headline: trimmed.slice(0, nl).trim(), body: trimmed.slice(nl + 1).trim() };
  }
  return { headline: "", body: trimmed };
}

function SignalCard({ sig }: { sig: SigItem }) {
  const [expanded, setExpanded] = useState(false);
  const sc = (SOURCE_COLORS as Record<string, { fg: string; border: string }>)[sig.source] ?? { fg: "#888", border: "rgba(128,128,128,0.3)" };
  const { headline, body } = parseRawText(sig.rawText);
  const BODY_LIMIT = 320;
  const bodyTrimmed = !expanded && body.length > BODY_LIMIT ? body.slice(0, BODY_LIMIT) + "…" : body;

  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      background: "var(--bg-elevated)",
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 14px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(100,130,180,0.04)",
      }}>
        <span style={{
          fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: sc.fg, border: `1px solid ${sc.border}`, padding: "1px 6px", borderRadius: 3, flexShrink: 0,
        }}>
          {sig.source}
        </span>
        {sig.toolName && (
          <span style={{
            fontSize: "0.68rem", color: "var(--fg-dim)",
            background: "rgba(165,182,214,0.08)", border: "1px solid var(--border)",
            padding: "1px 6px", borderRadius: 3,
          }}>
            {sig.toolName}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--fg-faint)" }}>
          {daysAgo(sig.postedAt ?? sig.scrapedAt)}
        </span>
        {sig.url && (
          <a
            href={sig.url} target="_blank" rel="noreferrer"
            style={{ color: "var(--fg-dim)", display: "flex", alignItems: "center", flexShrink: 0 }}
            title={sig.url}
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "12px 14px 14px" }}>
        {headline ? (
          <>
            {/* Title / post headline */}
            <p style={{ margin: "0 0 8px", lineHeight: 1.4 }}>
              {sig.url ? (
                <a
                  href={sig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="headline-link"
                  style={{
                    fontSize: "0.86rem", fontWeight: 600, color: "var(--fg)",
                    textDecoration: "none",
                    textUnderlineOffset: 3,
                    display: "inline",
                  }}
                >
                  {headline}
                  <ExternalLink
                    size={11}
                    className="headline-ext-icon"
                    style={{
                      display: "inline",
                      marginLeft: 5,
                      verticalAlign: "middle",
                      opacity: 0,
                      transition: "opacity 0.1s",
                      flexShrink: 0,
                    }}
                  />
                </a>
              ) : (
                <span style={{ fontSize: "0.86rem", fontWeight: 600, color: "var(--fg)" }}>
                  {headline}
                </span>
              )}
            </p>
            {/* Body / comment text */}
            {body && (
              <div>
                <p style={{
                  margin: 0,
                  fontSize: "0.80rem", color: "var(--fg-muted)",
                  lineHeight: 1.65, wordBreak: "break-word",
                }}>
                  {bodyTrimmed}
                </p>
                {body.length > BODY_LIMIT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(v => !v)}
                    style={{ marginTop: 5, fontSize: "0.72rem", color: "var(--fg-dim)", padding: 0, height: "auto" }}
                  >
                    {expanded ? "show less" : "show more"}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          /* No detectable title - show full text as body */
          <div>
            <p style={{
              margin: 0,
              fontSize: "0.82rem", color: "var(--fg-muted)",
              lineHeight: 1.65, wordBreak: "break-word",
            }}>
              {bodyTrimmed}
            </p>
            {body.length > BODY_LIMIT && (
              <button
                onClick={() => setExpanded(v => !v)}
                style={{
                  marginTop: 5, background: "none", border: "none", cursor: "pointer",
                  fontSize: "0.72rem", color: "var(--fg-dim)", padding: 0, fontFamily: "inherit",
                }}
              >
                {expanded ? "show less" : "show more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OppMoreMenu({ id, pass, status, onPass, onStatus, onDelete, onRegenerate, generatingBrief, hasBrief, onShowPrompt }: {
  id: number;
  pass: boolean;
  status: string;
  onPass: (v: boolean) => void;
  onStatus: (v: string) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  generatingBrief?: boolean;
  hasBrief?: boolean;
  onShowPrompt?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle() {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    setOpen((v) => !v);
  }

  const isParked = status === "parked";
  const isBuilding = status === "building";

  const itemStyle = (danger = false, active = false): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 14px", cursor: "pointer",
    fontSize: "0.84rem",
    color: danger ? "rgba(239,68,68,0.85)" : active ? "var(--accent)" : "var(--fg)",
    background: "transparent", border: "none", width: "100%",
    textAlign: "left", fontFamily: "inherit",
  });

  async function doStatus(next: string) {
    setOpen(false);
    const val = status === next ? "new" : next;
    onStatus(val);
    await setOpportunityStatus({ data: { id, status: val as any } });
  }

  async function doPass() {
    setOpen(false);
    const next = !pass;
    onPass(next);
    await bulkSetPass({ data: { ids: [id], pass: next } });
  }

  return (
    <>
      <Button
        ref={btnRef}
        variant="ghost"
        size="sm"
        onClick={toggle}
        title="More options"
        style={{
          border: "1px solid var(--border)",
          color: open ? "var(--fg)" : "var(--fg-dim)",
          background: open ? "rgba(165,182,214,0.1)" : undefined,
        }}
      >
        <MoreHorizontal size={14} />
      </Button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed", top: pos.top, right: pos.right,
            zIndex: 9999, minWidth: 190,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            padding: "4px 0", overflow: "hidden",
          }}
        >
          {hasBrief && onRegenerate && (
            <button style={itemStyle(false, false)} onClick={() => { setOpen(false); onRegenerate(); }}
            >
              <RefreshCw size={13} style={{ opacity: 0.7 }} />
              {generatingBrief ? "Regenerating…" : "Regenerate playbook"}
            </button>
          )}
          {onShowPrompt && (
            <button style={itemStyle(false, false)} onClick={() => { setOpen(false); onShowPrompt(); }}
            >
              <FileText size={13} style={{ opacity: 0.7 }} />
              Show original prompt
            </button>
          )}
          {(hasBrief || onShowPrompt) && <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />}
          <button style={itemStyle(false, pass)} onClick={doPass}
          >
            <Archive size={13} style={{ opacity: 0.7 }} />
            {pass ? "Unpass" : "Pass (archive)"}
          </button>
          <button style={itemStyle(false, isParked)} onClick={() => doStatus("parked")}
          >
            <Bookmark size={13} style={{ color: isParked ? "#facc15" : undefined, opacity: isParked ? 1 : 0.7 }} />
            {isParked ? "Unpark" : "Park for later"}
          </button>
          <button style={itemStyle(false, isBuilding)} onClick={() => doStatus("building")}
          >
            <Hammer size={13} style={{ color: isBuilding ? "var(--accent)" : undefined, opacity: isBuilding ? 1 : 0.7 }} />
            {isBuilding ? "Unmark as building" : "Mark as building"}
          </button>
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <button style={itemStyle(true)} onClick={() => { setOpen(false); onDelete(); }}
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Feature table (feasibility-checked V1 spec) ───────────────────────────────

const FEASIBILITY_STYLE: Record<FeatureFeasibility, { bg: string; fg: string; dot: string }> = {
  Proven: { bg: "rgba(0,255,136,0.1)", fg: "var(--accent)", dot: "🟢" },
  Plausible: { bg: "rgba(245,158,11,0.1)", fg: "#f59e0b", dot: "🟡" },
  Speculative: { bg: "rgba(251,146,60,0.1)", fg: "#fb923c", dot: "🟠" },
  Impossible: { bg: "rgba(239,68,68,0.12)", fg: "#ef4444", dot: "🔴" },
};

const PRIORITY_FG: Record<string, string> = { Must: "var(--accent)", Should: "#f59e0b", Could: "rgba(250,250,250,0.5)" };

function FeasibilityBadge({ value }: { value: FeatureFeasibility }) {
  const s = FEASIBILITY_STYLE[value] ?? FEASIBILITY_STYLE.Speculative;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
      background: s.bg, color: s.fg,
      fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.03em",
    }}>
      <span style={{ fontSize: "0.6rem" }}>{s.dot}</span>{value}
    </span>
  );
}

function featureTableMd(features: FeatureSpec[]): string[] {
  const esc = (s: string) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
  const rows = [
    "| Feature | Problem | Example | Pri | Eff | Feasibility | Mechanism | Constraint |",
    "|---------|---------|---------|-----|-----|-------------|-----------|------------|",
    ...features.map(f =>
      `| ${esc(f.feature)} | ${esc(f.problem)} | ${esc(f.example)} | ${f.priority} | ${f.effort} | ${f.feasibility} | ${esc(f.mechanism)} | ${esc(f.constraint)} |`
    ),
  ];
  return rows;
}

function FeatureTable({ features }: { features: FeatureSpec[] }) {
  const th: React.CSSProperties = {
    textAlign: "left", padding: "8px 10px",
    fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
    color: "rgba(250,250,250,0.4)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "10px", fontSize: "0.82rem", color: "rgba(250,250,250,0.85)",
    lineHeight: 1.5, borderBottom: "1px solid var(--border)", verticalAlign: "top",
  };
  const sub: React.CSSProperties = { fontSize: "0.76rem", color: "rgba(250,250,250,0.55)" };

  return (
    <div>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 14 }}>
        V1 Features
      </div>
      <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
          <thead>
            <tr>
              <th style={th}>Feature</th>
              <th style={th}>Problem</th>
              <th style={th}>Example</th>
              <th style={{ ...th, textAlign: "center" }}>Pri</th>
              <th style={{ ...th, textAlign: "center" }}>Eff</th>
              <th style={th}>Feasibility</th>
              <th style={th}>Mechanism</th>
              <th style={th}>Constraint</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f, i) => {
              const impossible = f.feasibility === "Impossible";
              return (
                <tr key={i} title={f.done_when ? `Done when: ${f.done_when}` : undefined} style={impossible ? { opacity: 0.7 } : undefined}>
                  <td style={{ ...td, fontWeight: 600, color: "var(--fg)", minWidth: 140 }}>{f.feature}</td>
                  <td style={{ ...td, ...sub, minWidth: 150 }}>{f.problem}</td>
                  <td style={{ ...td, ...sub, fontStyle: "italic", minWidth: 170 }}>{f.example}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: PRIORITY_FG[f.priority] ?? "var(--fg)", whiteSpace: "nowrap" }}>{f.priority}</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 600 }}>{f.effort}</td>
                  <td style={td}><FeasibilityBadge value={f.feasibility} /></td>
                  <td style={{ ...td, ...sub, minWidth: 200 }}>{f.mechanism}</td>
                  <td style={{ ...td, color: impossible ? "#ef4444" : "rgba(250,250,250,0.55)", fontSize: "0.76rem", minWidth: 160 }}>{f.constraint}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunityPage() {
  const { opp: initial, briefHtml: initialBriefHtml, activeBuildVersion } = Route.useLoaderData();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [building, setBuilding] = useState(false);
  const hasBrief = !!initial.briefMd && !initial.briefMd.startsWith("Brief generation failed");
  const [briefHtml, setBriefHtml] = useState(hasBrief ? initialBriefHtml : "");
  const [briefMd, setBriefMd] = useState(hasBrief ? initial.briefMd : "");
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [activeTab, setActiveTab] = useState<"playbook" | "signals">("playbook");
  const [pass, setPass] = useState(initial.pass);
  const [status, setStatus] = useState<string>(initial.status ?? "new");
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineRequest, setRefineRequest] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [refineResult, setRefineResult] = useState<{ changeSummary: string; diffs: any[] } | null>(null);
  const [sidebarW, setSidebarW] = useState(440);
  useEffect(() => {
    try { const s = parseInt(localStorage.getItem("opp-sidebar-w") ?? "", 10); if (!isNaN(s)) setSidebarW(Math.max(220, Math.min(600, s))); } catch { }
  }, []);
  const draggingRef = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);
  function onResizeStart(e: React.MouseEvent) {
    draggingRef.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = sidebarW;
    function onMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      const next = Math.max(220, Math.min(600, dragStartW.current + ev.clientX - dragStartX.current));
      setSidebarW(next);
      try { localStorage.setItem("opp-sidebar-w", String(next)); } catch { }
    }
    function onUp() { draggingRef.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  async function handleGenerateBrief() {
    setGeneratingBrief(true);
    setBriefError("");
    try {
      const result = await generateBriefForOpportunity({ data: { id: initial.id } });
      setBriefHtml(result.briefHtml);
      setBriefMd(result.briefMd);
    } catch (err: any) {
      setBriefError(err.message ?? "Generation failed");
    } finally {
      setGeneratingBrief(false);
    }
  }

  function handleBuild() {
    // "Build this" → New Product flow (Name → Build), carrying this opportunity.
    setBuilding(true);
    navigate({ to: "/products/new", search: { opportunityId: initial.id } });
  }

  async function _legacyBuild() {
    if (!initial.projectId) return;
    try {
      const { createProduct } = await import("~/lib/product-fns");
      const { id: productId } = await createProduct({ data: { ideaId: initial.projectId, opportunityId: initial.id } });
      await selectOpportunityToBuild({ data: { productId, opportunityId: initial.id } });
      navigate({ to: "/products/$id/build", params: { id: String(initial.projectId) } });
    } catch (err: any) {
      alert(err.message ?? "Failed to start build");
    } finally {
      setBuilding(false);
    }
  }

  async function handleRefine() {
    if (!refineRequest.trim()) return;
    setRefining(true);
    setRefineError("");
    try {
      const updated = await refineOpportunity({ data: { id: initial.id, changeRequest: refineRequest.trim() } });
      setRefineOpen(false);
      setRefineRequest("");
      setRefineResult({ changeSummary: (updated as any).changeSummary ?? "", diffs: (updated as any).diffs ?? [] });
    } catch (err: any) {
      setRefineError(err.message ?? "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  const scoreColor =
    initial.scoreTotal >= 7 ? "var(--accent)" : initial.scoreTotal >= 5 ? "#f59e0b" : "#ef4444";

  const pain = initial.scoresJson["pain_urgency"] ?? 0;
  const wtp = initial.scoresJson["willingness_to_pay"] ?? 0;
  const dist = initial.scoresJson["distribution_ready"] ?? 0;
  const hasShipScore = pain || wtp || dist;
  const ship = Math.round(((pain + wtp + dist) / 3) * 10) / 10;
  const shipColor = ship >= 7 ? "var(--accent)" : ship >= 5 ? "#f59e0b" : "rgba(250,250,250,0.62)";
  const fmt = (n?: number) => n ? (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`) : null;

  const wtpEvidence = initial.insightsJson?.wtp_evidence ?? [];
  const platforms = initial.insightsJson?.source_platforms ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* ── FULL-WIDTH HEADER ─────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        padding: "20px 32px 0",
        background: "var(--bg)",
      }}>
        {/* Breadcrumb + actions row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Back arrow - always present */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              title="Go back"
              style={{ color: "var(--fg-dim)", flexShrink: 0 }}
            >
              <ArrowLeft size={13} />
            </Button>
            {/* Breadcrumb */}
            {initial.projectId && initial.projectName && (
              <>
                <Link
                  to="/i/$id/opportunities"
                  params={{ id: String(initial.projectId) }}
                  search={{ opp: undefined }}
                  style={{ color: "rgba(250,250,250,0.38)", fontSize: "0.76rem", textDecoration: "none" }}
                >
                  {initial.projectName}
                </Link>
                <span style={{ color: "rgba(250,250,250,0.2)", fontSize: "0.72rem" }}>/</span>
                <Link
                  to="/i/$id/opportunities"
                  params={{ id: String(initial.projectId) }}
                  search={{ opp: undefined }}
                  style={{ color: "rgba(250,250,250,0.38)", fontSize: "0.76rem", textDecoration: "none" }}
                >
                  Opportunities
                </Link>
              </>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {initial.projectId && (() => {
              const isThisBuilding = activeBuildVersion?.opportunityId === initial.id;
              const anotherBuilding = activeBuildVersion != null && !isThisBuilding;

              if (isThisBuilding) {
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/products/$id/build", params: { id: String(initial.projectId) } })}
                    style={{ gap: 7, background: "rgba(96,165,250,0.1)", border: "1px solid var(--accent)", color: "var(--accent)" }}
                  >
                    <Hammer size={13} />
                    v{activeBuildVersion.versionNumber} Building ↗
                  </Button>
                );
              }

              if (anotherBuilding) {
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", border: "1px solid var(--border)",
                    borderRadius: "var(--radius)", color: "var(--fg-dim)", fontSize: "0.78rem",
                  }} title={`v${activeBuildVersion!.versionNumber} is currently building. Deploy it first.`}>
                    <Hammer size={12} />
                    v{activeBuildVersion!.versionNumber} building
                  </div>
                );
              }

              return (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBuild}
                  disabled={building}
                  style={{ gap: 7, border: "1px solid var(--accent)", color: "var(--accent)" }}
                >
                  <Hammer size={13} />
                  {building ? "Starting…" : "Build This"}
                </Button>
              );
            })()}
            <OppMoreMenu
              id={initial.id}
              pass={pass}
              status={status}
              onPass={(v) => { setPass(v); }}
              onStatus={(v) => { setStatus(v); }}
              onDelete={async () => {
                const ok = await confirm("Delete this opportunity? This cannot be undone.", { variant: "danger", confirmLabel: "Delete" });
                if (!ok) return;
                await bulkDelete({ data: { ids: [initial.id] } });
                if (initial.projectId) navigate({ to: "/i/$id/opportunities", params: { id: String(initial.projectId) }, search: { opp: undefined } });
                else navigate({ to: "/opportunities" });
              }}
              onRegenerate={hasBrief ? handleGenerateBrief : undefined}
              generatingBrief={generatingBrief}
              hasBrief={hasBrief}
              onShowPrompt={initial.description ? () => setPromptModalOpen(true) : undefined}
            />
            {/* Refine button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRefineOpen(true)}
              title="Refine this opportunity with AI"
              style={{ gap: 6, color: "var(--fg-dim)" }}
            >
              <PenLine size={12} /> Refine
            </Button>

            {/* Refine modal */}
            <Modal open={refineOpen} onClose={() => { setRefineOpen(false); setRefineRequest(""); setRefineError(""); }} title="Refine opportunity" width={560}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
                  Describe what you want to change. AI will update the scores, insights, and playbook accordingly.
                </p>
                <textarea
                  autoFocus
                  value={refineRequest}
                  onChange={e => setRefineRequest(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !refining) handleRefine(); }}
                  placeholder="e.g. 'Make it more focused on enterprise buyers', 'Update distribution to target Indie Hackers instead', 'The pain urgency score seems too high - adjust for longer sales cycles'"
                  rows={5}
                  disabled={refining}
                  style={{
                    width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.86rem",
                    padding: "10px 12px", fontFamily: "inherit", resize: "vertical", outline: "none",
                    boxSizing: "border-box", lineHeight: 1.65,
                  }}
                />
                {refineError && <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(239,68,68,0.8)" }}>{refineError}</p>}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="ghost" size="sm" onClick={() => { setRefineOpen(false); setRefineRequest(""); setRefineError(""); }}>
                    Cancel
                  </Button>
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

            {/* Changes modal */}
            <Modal open={!!refineResult} onClose={() => { setRefineResult(null); window.location.reload(); }} title="What changed" width={640}>
              {refineResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {refineResult.changeSummary && (
                    <p style={{ margin: 0, fontSize: "0.90rem", color: "var(--fg-muted)", lineHeight: 1.7, borderLeft: "2px solid var(--accent)", paddingLeft: 14 }}>
                      {refineResult.changeSummary}
                    </p>
                  )}
                  {refineResult.diffs.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--border)" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: "0 16px", background: "var(--bg)", padding: "6px 14px" }}>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)" }}>Field</span>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(239,68,68,0.5)" }}>Before</span>
                        <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(96,165,250,0.7)" }}>After</span>
                      </div>
                      {refineResult.diffs.map((d: any) => (
                        <div key={d.key} style={{ background: "var(--bg-elevated)", padding: "10px 14px", display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: "0 16px", alignItems: "start" }}>
                          <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", paddingTop: 2 }}>{d.label}</span>
                          <span style={{ fontSize: "0.82rem", color: "rgba(239,68,68,0.65)", lineHeight: 1.5, wordBreak: "break-word" }}>
                            {d.before.length > 140 ? d.before.slice(0, 140) + "…" : d.before}
                          </span>
                          <span style={{ fontSize: "0.82rem", color: d.type === "score" ? (Number(d.after) > Number(d.before) ? "var(--accent)" : "#ef4444") : "rgba(250,250,250,0.88)", lineHeight: 1.5, wordBreak: "break-word" }}>
                            {d.type === "score"
                              ? <><span style={{ fontWeight: 700 }}>{d.after}</span> <span style={{ fontSize: "0.72rem", opacity: 0.7 }}>{Number(d.after) > Number(d.before) ? `↑${Number(d.after) - Number(d.before)}` : `↓${Number(d.before) - Number(d.after)}`}</span></>
                              : d.after.length > 140 ? d.after.slice(0, 140) + "…" : d.after}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)" }}>No structural changes detected - refinements may be within existing field values.</p>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" size="sm" onClick={() => { setRefineResult(null); window.location.reload(); }}>
                      View updated opportunity
                    </Button>
                  </div>
                </div>
              )}
            </Modal>

            {/* Original prompt modal */}
            <Modal
              open={promptModalOpen}
              onClose={() => setPromptModalOpen(false)}
              title="Original prompt"
              width={600}
            >
              <pre style={{
                margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                fontSize: "0.86rem", color: "rgba(238,242,255,0.85)", lineHeight: 1.7,
                maxHeight: 420, overflowY: "auto",
              }}>
                {initial.description}
              </pre>
            </Modal>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ margin: "0 0 10px", fontWeight: 600, fontSize: "1.55rem", lineHeight: 1.2, maxWidth: 820 }}>
          {initial.title}
        </h1>

        {/* Pain summary */}
        <p style={{ margin: "0 0 18px", color: "rgba(250,250,250,0.62)", fontSize: "0.88rem", lineHeight: 1.65, maxWidth: 740 }}>
          {initial.painSummary}
        </p>

        {/* Metadata strip + tab bar combined */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 2 }}>
          {/* Metadata chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 20, borderRight: "1px solid var(--border)", flexShrink: 0, flexWrap: "wrap", padding: "10px 20px 10px 0" }}>
            <span style={{ fontSize: "0.70rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", border: "1px solid var(--border)", padding: "2px 7px" }}>
              {initial.sector}
            </span>
            {initial.communityUrl ? (
              <a href={initial.communityUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 3, color: "rgba(250,250,250,0.55)", fontSize: "0.78rem", textDecoration: "none" }}
              >
                {initial.community} <ExternalLink size={9} />
              </a>
            ) : (
              <span style={{ fontSize: "0.78rem", color: "rgba(250,250,250,0.45)" }}>{initial.community}</span>
            )}
            {platforms.map((p) => {
              const c = SOURCE_COLORS[p as keyof typeof SOURCE_COLORS];
              return (
                <span key={p} style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 5px", color: c?.fg ?? "var(--muted)", border: `1px solid ${c?.border ?? "var(--border)"}` }}>{p}</span>
              );
            })}
            {platforms.length >= 3 && <span style={{ fontSize: "0.68rem", color: "var(--accent)", fontWeight: 600 }}>✦ cross-validated</span>}
            <span style={{ fontSize: "0.75rem", color: "rgba(250,250,250,0.28)" }}>{initial.signalCount} signal{initial.signalCount !== 1 ? "s" : ""}</span>
          </div>

          {/* Metric pills */}
          <div style={{ display: "flex", alignItems: "stretch", flexShrink: 0 }}>
            {hasShipScore && (
              <div style={{ padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 2 }}>Ship</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: shipColor, letterSpacing: "-0.02em", lineHeight: 1 }}>{ship.toFixed(1)}</span>
              </div>
            )}
            <div style={{ padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
              <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 2 }}>Score</span>
              <span style={{ fontSize: "1rem", fontWeight: 600, color: scoreColor, letterSpacing: "-0.02em", lineHeight: 1 }}>{initial.scoreTotal.toFixed(1)}</span>
            </div>
            {(initial.insightsJson?.mrr_low || initial.insightsJson?.mrr_high) && (
              <div style={{ padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 2 }}>MRR</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--accent)", letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {fmt(initial.insightsJson?.mrr_avg) ?? `${fmt(initial.insightsJson?.mrr_low)}–${fmt(initial.insightsJson?.mrr_high)}`}
                </span>
              </div>
            )}
            {wtpEvidence.length > 0 && (
              <div style={{ padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center" }}>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.3)", marginBottom: 2 }}>WTP</span>
                <span style={{ fontSize: "1rem", fontWeight: 600, color: "#fbbf24", letterSpacing: "-0.02em", lineHeight: 1 }}>{wtpEvidence.length}</span>
              </div>
            )}
          </div>

          {/* Tab bar - flush right */}
          <div style={{ display: "flex", marginLeft: "auto" }}>
            {(["playbook", "signals"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "12px 20px", fontSize: "0.78rem",
                  fontWeight: activeTab === tab ? 700 : 400,
                  color: activeTab === tab ? "var(--accent)" : "rgba(250,250,250,0.45)",
                  borderBottom: `2px solid ${activeTab === tab ? "var(--accent)" : "transparent"}`,
                  marginBottom: -1, letterSpacing: "0.05em",
                  fontFamily: "inherit", flexShrink: 0,
                }}
              >
                {tab === "playbook" ? "Playbook" : `Signals (${(initial.signals ?? []).length})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BODY: sidebar + main ────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* LEFT SIDEBAR - scores + reference data */}
        <div style={{
          width: sidebarW, flexShrink: 0,
          borderRight: "1px solid var(--border)",
          overflowY: "auto", overflowX: "hidden",
          padding: "24px 20px 48px",
          display: "flex", flexDirection: "column", gap: "24px",
          position: "relative",
        }}>
          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            style={{
              position: "absolute", top: 0, right: 0, width: 4, height: "100%",
              cursor: "col-resize", zIndex: 10,
              background: "transparent",
            }}
          />
          {/* Buyer + Price + Distribution + Niche - label left, value right */}
          {(initial.insightsJson?.buyer_persona || initial.insightsJson?.price_anchor || initial.insightsJson?.distribution_primary || initial.insightsJson?.niche_signal) && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border)" }}>
              {initial.insightsJson?.buyer_persona && (
                <div style={{ background: "var(--bg)", padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.42)", flexShrink: 0, paddingTop: 3 }}>Buyer</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.55, flex: 1, textAlign: "right" }}>{initial.insightsJson.buyer_persona}</span>
                </div>
              )}
              {initial.insightsJson?.price_anchor && (
                <div style={{ background: "var(--bg)", padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.42)", flexShrink: 0, paddingTop: 3 }}>Price</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--accent)", lineHeight: 1.55, flex: 1, textAlign: "right" }}>{initial.insightsJson.price_anchor}</span>
                </div>
              )}
              {initial.insightsJson?.distribution_primary && (
                <div style={{ background: "var(--bg)", padding: "11px 14px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.42)", flexShrink: 0, paddingTop: 3 }}>Distribution</span>
                  <span style={{ fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.55, flex: 1, textAlign: "right" }}>{initial.insightsJson.distribution_primary}</span>
                </div>
              )}
              {initial.insightsJson?.niche_signal && (
                <div style={{ background: "rgba(0,255,136,0.03)", padding: "11px 14px", borderLeft: "2px solid rgba(0,255,136,0.3)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)", flexShrink: 0, paddingTop: 3 }}>Niche</span>
                  <span style={{ fontSize: "0.88rem", color: "rgba(250,250,250,0.82)", lineHeight: 1.55, flex: 1, textAlign: "right" }}>{initial.insightsJson.niche_signal}</span>
                </div>
              )}
            </div>
          )}

          {/* Score bars */}
          <div>
            <p style={{ margin: "0 0 10px", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.5)" }}>
              Scores
            </p>
            {SCORE_CRITERIA.map((c) => (
              <ScoreBar key={c.key} label={c.label} value={initial.scoresJson[c.key] ?? 0} reason={(initial.insightsJson as any)?.score_reasoning?.[c.key]} />
            ))}
          </div>

          {/* Competition */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.5)" }}>
                Competition
              </p>
              <div style={{ display: "flex", gap: 3 }}>
                {[
                  { label: "PH", url: `https://www.producthunt.com/search?q=${encodeURIComponent(initial.title)}` },
                  { label: "IH", url: `https://www.indiehackers.com/search?query=${encodeURIComponent(initial.title)}` },
                  { label: "G", url: `https://www.google.com/search?q=${encodeURIComponent(initial.title + " site:producthunt.com OR site:indiehackers.com")}` },
                ].map(({ label, url }) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer" style={{
                    fontSize: "0.62rem", fontWeight: 600, color: "var(--muted)", border: "1px solid var(--border)", padding: "1px 5px",
                    textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2,
                  }}>
                    {label} <ExternalLink size={7} />
                  </a>
                ))}
              </div>
            </div>
            {initial.insightsJson?.competitors && initial.insightsJson.competitors.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {initial.insightsJson.competitors.map((c, i) => {
                  const [name, weakness] = c.split(" - ");
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--fg)", flexShrink: 0 }}>{name}</span>
                      {weakness && <span style={{ fontSize: "0.82rem", color: "rgba(239,68,68,0.55)", flex: 1, textAlign: "right", lineHeight: 1.45 }}>- {weakness}</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(250,250,250,0.28)" }}>No competitor data yet.</p>
            )}
          </div>
        </div>

        {/* RIGHT MAIN CONTENT */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 36px 80px", minWidth: 0 }}>

          {/* Playbook tab */}
          {activeTab === "playbook" && (
            <div>
              {/* Error */}
              {briefError && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)", marginBottom: 24 }}>
                  <span style={{ fontSize: "0.90rem", color: "rgba(239,68,68,0.8)", flex: 1 }}>{briefError}</span>
                  <Button variant="outline" size="sm" onClick={handleGenerateBrief} disabled={generatingBrief}
                    style={{ border: "1px solid rgba(239,68,68,0.4)", color: "rgba(239,68,68,0.8)", fontSize: "0.76rem", flexShrink: 0 }}>
                    {generatingBrief ? "Retrying…" : "Retry"}
                  </Button>
                </div>
              )}

              {/* No brief - CTA */}
              {!briefHtml && !briefError && (
                <div style={{ padding: "72px 0", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                  <Zap size={32} style={{ color: "var(--accent)", marginBottom: 18, opacity: 0.8 }} />
                  <h3 style={{ margin: "0 0 10px", fontSize: "1.1rem", fontWeight: 600, letterSpacing: "-0.01em" }}>No playbook yet</h3>
                  <p style={{ fontSize: "0.86rem", color: "rgba(250,250,250,0.45)", maxWidth: 360, lineHeight: 1.7, margin: "0 auto 28px" }}>
                    Generate a full analysis: buyer research, V1 features, distribution plan, and risk assessment.
                  </p>
                  <Button variant="primary" size="sm" onClick={handleGenerateBrief} disabled={generatingBrief}
                    style={{ gap: 8, padding: "9px 22px", fontSize: "0.84rem" }}>
                    <Zap size={14} />
                    {generatingBrief ? "Generating…" : "Generate Playbook"}
                  </Button>
                </div>
              )}

              {/* Section grid - 620px columns = ~65 chars/line, optimal reading width */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 620px) minmax(0, 620px)", gap: "36px 48px", marginBottom: 28 }}>

                {/* WTP Evidence - full width, accent left stripe */}
                {wtpEvidence.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#fbbf24", marginBottom: 14 }}>
                      WTP Evidence · {wtpEvidence.length} signal{wtpEvidence.length !== 1 ? "s" : ""}
                    </div>
                    <WtpEvidencePanel evidence={wtpEvidence} signals={initial.signals} />
                  </div>
                )}

                {/* Score reasoning - full width, above competitors */}
                {(initial.insightsJson as any)?.score_reasoning && Object.keys((initial.insightsJson as any).score_reasoning).length > 0 && (
                  <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 16 }}>
                      Score Reasoning
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {SCORE_CRITERIA.map(c => {
                        const reason = (initial.insightsJson as any)?.score_reasoning?.[c.key];
                        const val = initial.scoresJson[c.key] ?? 0;
                        const color = val >= 7 ? "var(--accent)" : val >= 5 ? "#f59e0b" : "#ef4444";
                        if (!reason) return null;
                        return (
                          <div key={c.key} style={{ display: "grid", gridTemplateColumns: "32px 140px 1fr", gap: "0 14px", alignItems: "baseline" }}>
                            <span style={{ fontSize: "0.96rem", fontWeight: 700, color, textAlign: "right" }}>{val}</span>
                            <span style={{ fontSize: "0.70rem", color: "rgba(250,250,250,0.45)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</span>
                            <span style={{ fontSize: "0.88rem", color: "rgba(250,250,250,0.78)", lineHeight: 1.6 }}>{reason}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Brief sections - borderless, separated by top rule */}
                {briefHtml && parseBriefSections(briefHtml).map((section, i) => (
                  <div
                    key={i}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      paddingTop: 20,
                      gridColumn: isBriefSectionWide(section.heading) ? "1 / -1" : undefined,
                    }}
                  >
                    {section.heading && (
                      <div style={{
                        fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
                        textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 14,
                      }}>
                        {section.heading}
                      </div>
                    )}
                    <div className="brief-section" dangerouslySetInnerHTML={{ __html: section.html }} />
                  </div>
                ))}

                {/* InsightsJson - only when no brief, borderless */}
                {!briefHtml && initial.insightsJson?.hidden_need && (
                  <div style={{ borderLeft: "2px solid var(--accent)", paddingLeft: 16 }}>
                    <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 10 }}>Hidden Need</div>
                    <p style={{ margin: 0, fontSize: "0.92rem", color: "var(--fg)", lineHeight: 1.7 }}>{initial.insightsJson.hidden_need}</p>
                  </div>
                )}

                {/* Structured feature table - shows even with a brief; it's the most important spec */}
                {(initial.insightsJson?.feature_table?.length ?? 0) > 0 && (
                  <FeatureTable features={initial.insightsJson!.feature_table!} />
                )}

                {/* Fallback plain list - only when no structured table and no brief */}
                {!briefHtml && !(initial.insightsJson?.feature_table?.length) && (initial.insightsJson?.v1_features?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 14 }}>V1 Features</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {initial.insightsJson!.v1_features!.map((f, i) => (
                        <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0, fontSize: "0.82rem", lineHeight: 1.7 }}>{i + 1}.</span>
                          <span style={{ fontSize: "0.92rem", color: "rgba(250,250,250,0.85)", lineHeight: 1.65 }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!briefHtml && initial.insightsJson?.self_growth && (
                  <div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 10 }}>Self-Growth</div>
                    <p style={{ margin: 0, fontSize: "0.92rem", color: "rgba(250,250,250,0.78)", lineHeight: 1.7 }}>{initial.insightsJson.self_growth}</p>
                  </div>
                )}

                {!briefHtml && (initial.insightsJson?.risks?.length ?? 0) > 0 && (
                  <div>
                    <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.62)", marginBottom: 10 }}>Risks</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {initial.insightsJson!.risks!.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ color: "rgba(239,68,68,0.5)", flexShrink: 0, fontSize: "0.76rem", lineHeight: 1.7 }}>▲</span>
                          <span style={{ fontSize: "0.90rem", color: "rgba(250,250,250,0.65)", lineHeight: 1.65 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Signals tab */}
          {activeTab === "signals" && (
            <div>
              {(initial.signals ?? []).length === 0 ? (
                <p style={{ color: "rgba(250,250,250,0.35)", fontSize: "0.84rem" }}>
                  No signals linked to this opportunity. Re-run channels to collect fresh ones.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {(initial.signals ?? []).map((sig) => (
                    <SignalCard key={sig.id} sig={sig} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action bar */}
          <ActionBar opp={initial} briefMd={briefMd} />
        </div>
      </div>
    </div>
  );
}

// ── Shared export utility ─────────────────────────────────────────────────────

export function buildOppMarkdown(opp: any, briefMd: string): string {
  const ins = opp.insightsJson ?? {};
  const scores = opp.scoresJson ?? {};
  const fmt = (n?: number) => n ? (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`) : null;
  const lines: string[] = [];

  lines.push(`# ${opp.title}`);
  lines.push(`\n**Pain:** ${opp.painSummary}`);
  lines.push(`**Sector:** ${opp.sector} | **Community:** ${opp.community}${opp.communityUrl ? ` (${opp.communityUrl})` : ""}`);
  lines.push(`**Score:** ${(opp.scoreTotal ?? 0).toFixed(1)}/10 | **Signals:** ${opp.signalCount ?? 0}`);

  const shipPain = scores["pain_urgency"] ?? 0;
  const shipWtp = scores["willingness_to_pay"] ?? 0;
  const shipDist = scores["distribution_ready"] ?? 0;
  if (shipPain || shipWtp || shipDist) {
    lines.push(`**Ship Score:** ${((shipPain + shipWtp + shipDist) / 3).toFixed(1)} (Pain ${shipPain} · WTP ${shipWtp} · Dist ${shipDist})`);
  }

  // All 10 score criteria
  const scoreLabels: Record<string, string> = {
    buyer_quality: "Buyer Quality",
    pain_urgency: "Pain Urgency",
    willingness_to_pay: "Willingness to Pay",
    viral_potential: "Viral Potential",
    build_simplicity: "Build Simplicity",
    distribution_ready: "Distribution Ready",
   
    revenue_potential: "Revenue Potential",
    legal_safety: "Legal Safety",
    competitor_gap: "Competitor Gap",
  };
  const scoreLines = Object.entries(scoreLabels)
    .filter(([k]) => scores[k] !== undefined)
    .map(([k, l]) => {
      const reasoning = ins.score_reasoning?.[k];
      return `- **${l}:** ${scores[k]}/10${reasoning ? ` - ${reasoning}` : ""}`;
    });
  if (scoreLines.length) { lines.push(`\n## Scores`); lines.push(...scoreLines); }

  if (ins.mrr_low || ins.mrr_high || ins.mrr_avg) {
    lines.push(`\n## MRR Estimate`);
    const p = [fmt(ins.mrr_low), fmt(ins.mrr_high)].filter(Boolean);
    lines.push(p.length === 2 ? `${p[0]} – ${p[1]}/mo (avg ${fmt(ins.mrr_avg)})` : `${fmt(ins.mrr_avg)}/mo`);
  }
  if (ins.price_anchor) { lines.push(`\n## Price Signal`); lines.push(ins.price_anchor); }
  if (ins.buyer_persona) { lines.push(`\n## Buyer`); lines.push(ins.buyer_persona); }
  if (ins.niche_signal) { lines.push(`\n## Niche`); lines.push(ins.niche_signal); }
  if (ins.hidden_need) { lines.push(`\n## Hidden Need`); lines.push(ins.hidden_need); }
  if (ins.self_growth) { lines.push(`\n## Self-Growth`); lines.push(ins.self_growth); }
  if (ins.distribution_primary) { lines.push(`\n## Distribution`); lines.push(ins.distribution_primary); }
  if (ins.feature_table?.length) { lines.push(`\n## V1 Features`); lines.push(...featureTableMd(ins.feature_table)); }
  else if (ins.v1_features?.length) { lines.push(`\n## V1 Features`); ins.v1_features.forEach((f: string) => lines.push(`- ${f}`)); }
  if (ins.risks?.length) { lines.push(`\n## Risks`); ins.risks.forEach((r: string) => lines.push(`- ${r}`)); }
  if (ins.competitors?.length) { lines.push(`\n## Competitors`); ins.competitors.forEach((c: string) => lines.push(`- ${c}`)); }
  if (ins.wtp_evidence?.length) {
    lines.push(`\n## Demand Proof`);
    ins.wtp_evidence.forEach((e: any) => {
      if (typeof e === "string") { lines.push(`- ${e}`); }
      else { lines.push(`- **[${e.source ?? "?"} / ${e.type ?? "?"}]** "${e.excerpt ?? ""}"`); }
    });
  }

  if (briefMd && !briefMd.startsWith("Brief generation failed")) { lines.push(`\n---\n`); lines.push(briefMd); }
  if (opp.signals?.length) {
    lines.push(`\n## Source Signals (${opp.signals.length})`);
    opp.signals.slice(0, 20).forEach((s: any) => {
      lines.push(`\n**[${s.source}]** ${s.url ?? ""}`);
      lines.push(s.rawText.slice(0, 400));
    });
    if (opp.signals.length > 20) lines.push(`\n_…and ${opp.signals.length - 20} more signals_`);
  }

  return lines.join("\n");
}

export function ExportButton({ opp, briefMd }: { opp: any; briefMd: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function copy() {
    navigator.clipboard.writeText(buildOppMarkdown(opp, briefMd));
    setCopied(true); setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const md = buildOppMarkdown(opp, briefMd);
    const slug = (opp.title ?? "opportunity").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${slug}.md`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  const btnBase: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit", color: "var(--fg)", textAlign: "left" };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(v => !v)}
        style={{ gap: 5, color: copied ? "var(--accent)" : "var(--fg-dim)", background: open ? "rgba(165,182,214,0.08)" : undefined, border: "1px solid var(--border)" }}
      >
        {copied ? <Check size={12} /> : <Download size={12} />}
        {copied ? "Copied!" : "Export"}
      </Button>
      {open && createPortal(
        <div style={{ position: "fixed", top: ref.current ? ref.current.getBoundingClientRect().bottom + 6 : 0, right: ref.current ? window.innerWidth - ref.current.getBoundingClientRect().right : 0, zIndex: 9999, minWidth: 180, background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)", padding: "4px 0" }}>
          <button style={btnBase} onClick={copy}>
            <Copy size={13} style={{ opacity: 0.6 }} /> Copy as Markdown
          </button>
          <button style={btnBase} onClick={download}>
            <Download size={13} style={{ opacity: 0.6 }} /> Download .md
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function ActionBar({ opp, briefMd }: { opp: any; briefMd: string }) {
  const [copied, setCopied] = useState(false);

  // ── Build state ───────────────────────────────────────────────────────────
  type BuildPhase = "idle" | "running" | "done" | "failed";
  const [phase, setPhase] = useState<BuildPhase>("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const [logExpanded, setLogExpanded] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logExpanded && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logExpanded]);

  const appendLog = useCallback((line: string) => setLogs((prev) => [...prev, line]), []);

  async function startBuild() {
    if (phase === "running") { abortRef.current?.abort(); appendLog("[stopped by user]"); setPhase("idle"); return; }
    setPhase("running"); setLogs([]); setLogExpanded(true);
    const abort = new AbortController();
    abortRef.current = abort;
    let exitCode = 0;
    try {
      const res = await fetch(`/api/build-opportunity?id=${opp.id}&title=${encodeURIComponent(opp.title)}`, { signal: abort.signal });
      if (!res.ok || !res.body) { appendLog(`[error: HTTP ${res.status}]`); setPhase("failed"); return; }
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
            if (line.startsWith("[EXIT:")) { exitCode = parseInt(line.slice(6), 10) || 0; continue; }
            if (line.startsWith("[BUILD_ID:")) { setBuildId(line.slice(10, -1)); continue; }
            appendLog(line);
          } catch { }
        }
      }
      setPhase(exitCode === 0 ? "done" : "failed");
    } catch (err: any) {
      if (err?.name !== "AbortError") { appendLog(`[error: ${err?.message}]`); setPhase("failed"); }
    }
  }

  // ── Markdown builder ──────────────────────────────────────────────────────
  function buildMarkdown() {
    const ins = opp.insightsJson ?? {};
    const scores = opp.scoresJson ?? {};
    const fmt = (n?: number) => n ? (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`) : null;

    const lines: string[] = [];
    lines.push(`# ${opp.title}`);
    lines.push(`\n**Pain:** ${opp.painSummary}`);
    lines.push(`**Sector:** ${opp.sector} | **Community:** ${opp.community}${opp.communityUrl ? ` (${opp.communityUrl})` : ""}`);
    lines.push(`**Score:** ${opp.scoreTotal.toFixed(1)}/10 | **Signals:** ${opp.signalCount}`);

    const shipPain = scores["pain_urgency"] ?? 0;
    const shipWtp = scores["willingness_to_pay"] ?? 0;
    const shipDist = scores["distribution_ready"] ?? 0;
    if (shipPain || shipWtp || shipDist) {
      const ship = ((shipPain + shipWtp + shipDist) / 3).toFixed(1);
      lines.push(`**Ship Score:** ${ship} (Pain ${shipPain} · WTP ${shipWtp} · Distribution ${shipDist})`);
    }

    lines.push(`\n## Scores`);
    const scoreLabels: Record<string, string> = {
      buyer_quality: "Buyer Quality", pain_urgency: "Pain Urgency",
      willingness_to_pay: "Willingness to Pay", viral_potential: "Viral Potential",
      build_simplicity: "Build Simplicity", distribution_ready: "Distribution Ready",
      revenue_potential: "Revenue Potential",
    };
    for (const [k, label] of Object.entries(scoreLabels)) {
      if (scores[k] !== undefined) lines.push(`- **${label}:** ${scores[k]}/10`);
    }

    if (ins.mrr_low || ins.mrr_high || ins.mrr_avg) {
      lines.push(`\n## MRR Estimate`);
      const parts = [fmt(ins.mrr_low), fmt(ins.mrr_high)].filter(Boolean);
      lines.push(parts.length === 2 ? `${parts[0]} – ${parts[1]}/mo (avg ${fmt(ins.mrr_avg)})` : `${fmt(ins.mrr_avg)}/mo`);
    }

    if (ins.price_anchor) { lines.push(`\n## Price Signal`); lines.push(ins.price_anchor); }
    if (ins.buyer_persona) { lines.push(`\n## Buyer`); lines.push(ins.buyer_persona); }
    if (ins.hidden_need) { lines.push(`\n## Hidden Need`); lines.push(ins.hidden_need); }
    if (ins.self_growth) { lines.push(`\n## Self-Growth`); lines.push(ins.self_growth); }
    if (ins.distribution_primary) { lines.push(`\n## Distribution`); lines.push(ins.distribution_primary); }

    if (ins.feature_table?.length) {
      lines.push(`\n## V1 Features`);
      lines.push(...featureTableMd(ins.feature_table));
    } else if (ins.v1_features?.length) {
      lines.push(`\n## V1 Features`);
      ins.v1_features.forEach((f: string) => lines.push(`- ${f}`));
    }

    if (ins.risks?.length) {
      lines.push(`\n## Risks`);
      ins.risks.forEach((r: string) => lines.push(`- ${r}`));
    }

    if (ins.competitors?.length) {
      lines.push(`\n## Competitors`);
      ins.competitors.forEach((c: string) => lines.push(`- ${c}`));
    }

    if (ins.wtp_evidence?.length) {
      lines.push(`\n## Demand Proof (WTP Evidence)`);
      ins.wtp_evidence.forEach((e: any) => {
        lines.push(`- **[${e.source} / ${e.type}]** "${e.excerpt}"`);
      });
    }

    if (briefMd && !briefMd.startsWith("Brief generation failed")) {
      lines.push(`\n---\n`);
      lines.push(briefMd);
    }

    if (opp.signals?.length) {
      lines.push(`\n## Source Signals (${opp.signals.length})`);
      opp.signals.slice(0, 20).forEach((s: any) => {
        lines.push(`\n**[${s.source}]** ${s.url}`);
        lines.push(s.rawText.slice(0, 400));
      });
      if (opp.signals.length > 20) lines.push(`\n_…and ${opp.signals.length - 20} more signals_`);
    }

    return lines.join("\n");
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const md = buildMarkdown();
    const slug = opp.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${slug}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const buildColor =
    phase === "done" ? "var(--accent)" :
      phase === "failed" ? "#ef4444" :
        phase === "running" ? "#f59e0b" :
          "rgba(250,250,250,0.55)";

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "20px", marginTop: "36px" }}>
      {/* Button row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>

        {/* Select to Build */}
        <Button
          variant="outline"
          size="sm"
          onClick={startBuild}
          disabled={phase === "done"}
          style={{
            gap: 8,
            background: phase === "running" ? "rgba(239,68,68,0.06)" : "transparent",
            border: `1px solid ${buildColor}`,
            color: buildColor,
            padding: "7px 16px", fontSize: "0.8rem",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          {phase === "running" ? <Square size={10} /> : <Zap size={10} />}
          {phase === "idle" ? "Select to Build" :
            phase === "running" ? "Stop Build" :
              phase === "done" ? "Built" : "Retry Build"}
        </Button>

        <div style={{ width: 1, height: 18, background: "var(--border)" }} />

        {/* Copy as Markdown */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          style={{
            gap: 8,
            border: `1px solid ${copied ? "var(--accent)" : "var(--border)"}`,
            color: copied ? "var(--accent)" : "rgba(250,250,250,0.55)",
            padding: "7px 16px", fontSize: "0.8rem",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          {copied ? "✓ Copied" : "Copy as Markdown"}
        </Button>

        {/* Download as MD */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          style={{
            gap: 8,
            border: "1px solid var(--border)",
            color: "rgba(250,250,250,0.55)",
            padding: "7px 16px", fontSize: "0.8rem",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        >
          Download .md
        </Button>

        {buildId && (
          <Link
            to={"/builds" as any}
            style={{
              marginLeft: "auto", fontSize: "0.76rem", color: "var(--accent)",
              textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: "4px",
            }}
          >
            View in Builds →
          </Link>
        )}

        {logs.length > 0 && !buildId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLogExpanded((v) => !v)}
            style={{
              marginLeft: "auto", color: "rgba(250,250,250,0.38)",
              fontSize: "0.76rem", letterSpacing: "0.06em", textTransform: "uppercase",
              height: "auto",
            }}
          >
            {logExpanded ? "hide log" : `show log (${logs.length})`}
          </Button>
        )}
      </div>

      {/* Build log */}
      {logExpanded && logs.length > 0 && (
        <div style={{
          marginTop: "14px",
          background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)",
          borderLeft: `2px solid ${buildColor}`, padding: "12px 16px",
          maxHeight: "400px", overflowY: "auto",
          fontFamily: "ui-monospace, 'Cascadia Code', monospace",
          fontSize: "0.82rem", lineHeight: 1.6,
        }}>
          {logs.map((line, i) => {
            const isPhase = line.startsWith("═") || line.startsWith("BUILD PIPELINE") || line.startsWith("IMPLEMENTATION");
            const isStep = /^\[(\d+)\//.test(line) || line.startsWith("  →");
            const isOk = line.startsWith("✓");
            const isErr = line.startsWith("✗") || line.startsWith("[error");
            const color = isPhase ? "#f59e0b" : isOk ? "var(--accent)" : isErr ? "#ef4444" : isStep ? "rgba(250,250,250,0.7)" : "rgba(250,250,250,0.55)";
            return <div key={i} style={{ color, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{line}</div>;
          })}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

