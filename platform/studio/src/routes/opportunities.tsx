import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getUnifiedOpportunities, updateIdea,
  promoteIdeaToProject, getIdea, buildFullProjectFromOp,
  getClusterReplyQueue, getCommunityProfiles, draftSignalReply, markSignalReplied,
} from "~/lib/project-fns";
import { generatePlaybookForIdea } from "~/lib/server-fns";
import type { UnifiedOp, OpStatus, ReplyQueueSignal, CommunityProfileSummary } from "~/lib/project-fns";
import type { ClusterDimensions } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import {
  RefreshCw, Target, ChevronUp, ChevronDown, ChevronsUpDown,
  Sparkles, Hammer, X, Plus, Loader2, ExternalLink, Copy, Check,
  MessageSquare, Users,
} from "lucide-react";

export const Route = createFileRoute("/opportunities")({
  loader: async () => getUnifiedOpportunities(),
  staleTime: 0,
  pendingMs: 0,
  pendingComponent: () => (
    <div style={{ padding: "40px 28px", display: "flex", alignItems: "center", gap: 8, color: "var(--fg-subtle)", fontSize: "0.82rem" }}>
      <Loader2 size={14} style={{ animation: "bd-spin 0.8s linear infinite" }} /> Loading opportunities…
    </div>
  ),
  component: OpportunitiesPage,
});

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OpStatus, { label: string; color: string; bg: string; border: string }> = {
  signal: { label: "signal", color: "var(--fg-subtle)", bg: "rgba(165,182,214,0.06)", border: "rgba(165,182,214,0.15)" },
  analyzing: { label: "analyzing", color: "var(--accent)", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)" },
  ready: { label: "ready", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)" },
  building: { label: "building", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
  dead: { label: "dead", color: "#6b7280", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)" },
};

const VERDICT_CFG = {
  go: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
  maybe: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.3)" },
  kill: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)" },
};

// ── Sort ──────────────────────────────────────────────────────────────────────

type SortKey = "title" | "status" | "confidence" | "signals" | "mrr" | "verdict";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<OpStatus, number> = { ready: 0, analyzing: 1, signal: 2, building: 3, dead: 4 };
const VERDICT_ORDER: Record<string, number> = { go: 0, maybe: 1, kill: 2, "": 3 };

function sortOps(ops: UnifiedOp[], key: SortKey, dir: SortDir): UnifiedOp[] {
  return [...ops].sort((a, b) => {
    let cmp = 0;
    if (key === "title") cmp = a.title.localeCompare(b.title);
    if (key === "status") cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (key === "confidence") cmp = a.confidenceScore - b.confidenceScore;
    if (key === "signals") cmp = a.signalCount - b.signalCount;
    if (key === "verdict") cmp = VERDICT_ORDER[a.verdict ?? ""] - VERDICT_ORDER[b.verdict ?? ""];
    if (key === "mrr") cmp = (a.mrrEstimate ?? "").localeCompare(b.mrrEstimate ?? "");
    return dir === "asc" ? cmp : -cmp;
  });
}

// ── Small components ──────────────────────────────────────────────────────────

function DimDots({ dims }: { dims: ClusterDimensions | null }) {
  if (!dims) return <span style={{ color: "var(--fg-dim)", fontSize: "0.70rem" }}>-</span>;
  const badges = [
    { key: "spend", icon: "💰", active: dims.spendScore >= 0.25, title: `Spend ${Math.round(dims.spendScore * 100)}%` },
    { key: "pain", icon: "⚡", active: dims.painScore >= 0.35, title: `Pain ${Math.round(dims.painScore * 100)}%` },
    { key: "workflow", icon: "↻", active: dims.workflowScore >= 0.25, title: `Workflow ${Math.round(dims.workflowScore * 100)}%` },
    { key: "demand", icon: "◎", active: dims.demandScore >= 0.25, title: `Demand ${Math.round(dims.demandScore * 100)}%` },
  ];
  return (
    <span style={{ display: "flex", gap: 3 }}>
      {badges.map(b => (
        <span key={b.key} title={b.title} style={{ fontSize: "0.72rem", opacity: b.active ? 1 : 0.18, cursor: "default" }}>
          {b.icon}
        </span>
      ))}
    </span>
  );
}

function ConfBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 50 ? "#22c55e" : pct >= 25 ? "#f59e0b" : "#6b7280";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-block", width: 40, height: 3, background: "rgba(165,182,214,0.12)", borderRadius: 2, position: "relative" as const, verticalAlign: "middle" }}>
        <span style={{ position: "absolute" as const, left: 0, top: 0, height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
      </span>
      <span style={{ fontSize: "0.72rem", color, fontWeight: 600, minWidth: 26 }}>{pct}%</span>
    </span>
  );
}

function CommChips({ communities }: { communities: string[] }) {
  if (!communities.length) return <span style={{ color: "var(--fg-dim)", fontSize: "0.70rem" }}>-</span>;
  const show = communities.slice(0, 2);
  const rest = communities.length - 2;
  return (
    <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {show.map(c => (
        <span key={c} style={{ fontSize: "0.62rem", fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(96,165,250,0.08)", color: "var(--accent)", border: "1px solid rgba(96,165,250,0.2)", whiteSpace: "nowrap" }}>
          r/{c}
        </span>
      ))}
      {rest > 0 && <span style={{ fontSize: "0.62rem", color: "var(--fg-dim)" }}>+{rest}</span>}
    </span>
  );
}

function Th({ col, label, sortKey, sortDir, onSort, style }: {
  col: SortKey; label: string; sortKey: SortKey; sortDir: SortDir;
  onSort: (k: SortKey) => void; style?: React.CSSProperties;
}) {
  const active = sortKey === col;
  return (
    <th onClick={() => onSort(col)} style={{
      padding: "8px 12px", textAlign: "left", cursor: "pointer",
      fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: active ? "var(--accent)" : "var(--fg-dim)",
      background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)",
      whiteSpace: "nowrap", userSelect: "none", ...style,
    }}>
      {label}
      {active
        ? (sortDir === "asc" ? <ChevronUp size={10} style={{ marginLeft: 3, verticalAlign: "middle" }} /> : <ChevronDown size={10} style={{ marginLeft: 3, verticalAlign: "middle" }} />)
        : <ChevronsUpDown size={10} style={{ marginLeft: 3, verticalAlign: "middle", opacity: 0.3 }} />}
    </th>
  );
}

function StaticTh({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: "8px 12px", textAlign: "left",
      fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--fg-dim)",
      background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)",
      whiteSpace: "nowrap", ...style,
    }}>{label}</th>
  );
}

// ── Expanded: Analyze form ────────────────────────────────────────────────────

function AnalyzeRow({ op, onDone, onCancel }: { op: UnifiedOp; onDone: () => void; onCancel: () => void }) {
  const [angle, setAngle] = useState("");
  const [busy, setBusy] = useState(false);
  const [briefHtml, setBriefHtml] = useState("");
  const navigate = useNavigate();

  async function submit() {
    setBusy(true);
    try {
      const result = await generatePlaybookForIdea({
        data: {
          clusterId: op.clusterId ?? undefined,
          clusterTitle: op.title,
          clusterHypothesis: angle.trim() || op.description || op.title,
          communities: op.communities.slice(0, 6),
          angle: angle.trim() || undefined,
        },
      });
      setBriefHtml(result.briefHtml);
      onDone(); // refresh list so status updates to "ready"
    } catch (err) { console.error(err); setBusy(false); }
  }

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ padding: "18px 24px", background: "rgba(96,165,250,0.04)", borderBottom: "1px solid var(--border)", borderLeft: "3px solid var(--accent)" }}>
          {!briefHtml ? (
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 320px" }}>
                <label style={{ fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--fg-muted)", display: "block", marginBottom: 5 }}>
                  Your angle <span style={{ fontWeight: 400, textTransform: "none", opacity: 0.6 }}>(optional - shapes the brief)</span>
                </label>
                <input value={angle} onChange={e => setAngle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !busy && submit()}
                  placeholder={`e.g. Focus on ${op.communities[0] ? `r/${op.communities[0]} community` : "agencies, not solo freelancers"}`}
                  style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "7px 10px", color: "var(--fg)", fontSize: "0.80rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
                />
                {op.communities.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {op.communities.slice(0, 6).map(c => (
                      <span key={c} style={{ fontSize: "0.64rem", fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "rgba(96,165,250,0.08)", color: "var(--accent)", border: "1px solid rgba(96,165,250,0.2)" }}>r/{c}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <Button variant="primary" size="sm" onClick={submit} disabled={busy} style={{ gap: 5 }}>
                  {busy
                    ? <><Loader2 size={11} style={{ animation: "bd-spin 0.8s linear infinite" }} />Generating playbook…</>
                    : <><Sparkles size={11} />Generate Playbook</>}
                </Button>
                <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--fg-muted)" }}>
              <div className="brief-content" dangerouslySetInnerHTML={{ __html: briefHtml }} />
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Community Intelligence ────────────────────────────────────────────────────

function CommunityIntel({ communities }: { communities: string[] }) {
  const [profiles, setProfiles] = useState<CommunityProfileSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!communities.length) { setLoading(false); return; }
    getCommunityProfiles({ data: { subreddits: communities } })
      .then(setProfiles).finally(() => setLoading(false));
  }, [communities.join(",")]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-dim)", fontSize: "0.76rem", padding: "12px 0" }}>
      <Loader2 size={12} style={{ animation: "bd-spin 0.8s linear infinite" }} /> Loading community profiles…
    </div>
  );

  if (!profiles?.length) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Users size={11} /> Community intelligence
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {profiles.map(p => (
          <div key={p.subreddit} style={{ padding: "12px 14px", borderRadius: "var(--radius)", background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: p.hasProfile ? 10 : 0 }}>
              <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--accent)" }}>r/{p.subreddit}</span>
              {p.hasProfile && p.opennessScore != null && (
                <span title="Openness to new product pitches (1-10)" style={{
                  fontSize: "0.64rem", fontWeight: 700,
                  padding: "1px 7px", borderRadius: 4,
                  background: p.opennessScore >= 7 ? "rgba(34,197,94,0.12)" : p.opennessScore >= 5 ? "rgba(245,158,11,0.10)" : "rgba(239,68,68,0.08)",
                  color: p.opennessScore >= 7 ? "#22c55e" : p.opennessScore >= 5 ? "#f59e0b" : "#ef4444",
                  border: `1px solid ${p.opennessScore >= 7 ? "rgba(34,197,94,0.3)" : p.opennessScore >= 5 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.2)"}`,
                }}>
                  openness {p.opennessScore}/10
                </span>
              )}
              {!p.hasProfile && (
                <span style={{ fontSize: "0.64rem", color: "var(--fg-dim)", fontStyle: "italic" }}>No deep scan yet - run from Discovery page</span>
              )}
            </div>
            {p.hasProfile && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {p.whatGetsTraction && (
                  <div>
                    <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#22c55e", marginBottom: 3 }}>✓ What works</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--fg)", lineHeight: 1.5 }}>{p.whatGetsTraction}</div>
                  </div>
                )}
                {p.whatFails && (
                  <div>
                    <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#ef4444", marginBottom: 3 }}>✗ What fails</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--fg)", lineHeight: 1.5 }}>{p.whatFails}</div>
                  </div>
                )}
                {p.distributionPlaybook && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--accent)", marginBottom: 3 }}>Playbook</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--fg)", lineHeight: 1.5 }}>{p.distributionPlaybook}</div>
                  </div>
                )}
                {p.avoidList.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#f59e0b", marginBottom: 4 }}>Avoid</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {p.avoidList.map(a => (
                        <span key={a} style={{ fontSize: "0.68rem", padding: "1px 7px", borderRadius: 3, background: "rgba(245,158,11,0.08)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reply Queue ───────────────────────────────────────────────────────────────

function ReplyQueue({ clusterId, productName, productPitch, communities }: {
  clusterId: number | null;
  productName: string;
  productPitch: string;
  communities: string[];
}) {
  const [posts, setPosts] = useState<ReplyQueueSignal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Map<string, CommunityProfileSummary>>(new Map());

  useEffect(() => {
    if (!clusterId) { setLoading(false); return; }
    Promise.all([
      getClusterReplyQueue({ data: { clusterId } }),
      communities.length ? getCommunityProfiles({ data: { subreddits: communities } }) : Promise.resolve([]),
    ]).then(([sigs, profs]) => {
      setPosts(sigs);
      const m = new Map<string, CommunityProfileSummary>();
      profs.forEach(p => m.set(p.subreddit, p));
      setProfiles(m);
    }).finally(() => setLoading(false));
  }, [clusterId]);

  async function handleDraft(post: ReplyQueueSignal) {
    setDrafting(d => new Set([...d, post.id]));
    try {
      const profile = post.subreddit ? profiles.get(post.subreddit) : undefined;
      const { draft } = await draftSignalReply({
        data: {
          signalId: post.id,
          productName,
          productPitch,
          communityPlaybook: profile?.distributionPlaybook ?? undefined,
        },
      });
      setPosts(prev => prev?.map(p => p.id === post.id ? { ...p, replyDraft: draft } : p) ?? null);
    } finally {
      setDrafting(d => { const n = new Set(d); n.delete(post.id); return n; });
    }
  }

  async function handleToggleReplied(post: ReplyQueueSignal) {
    const newState = !post.repliedAt;
    setPosts(prev => prev?.map(p => p.id === post.id ? { ...p, repliedAt: newState ? new Date() : null } : p) ?? null);
    await markSignalReplied({ data: { signalId: post.id, replied: newState } });
  }

  async function handleCopy(text: string, id: number) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(c => c === id ? null : c), 1500);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg-dim)", fontSize: "0.76rem", padding: "12px 0" }}>
      <Loader2 size={12} style={{ animation: "bd-spin 0.8s linear infinite" }} /> Loading posts…
    </div>
  );

  if (!clusterId) return (
    <div style={{ fontSize: "0.76rem", color: "var(--fg-dim)", padding: "12px 0" }}>No cluster linked - reply queue not available.</div>
  );

  if (!posts?.length) return (
    <div style={{ fontSize: "0.76rem", color: "var(--fg-dim)", padding: "12px 0" }}>No Reddit posts found for this opportunity yet. Run a scan to collect signals.</div>
  );

  const replied = posts.filter(p => p.repliedAt).length;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <MessageSquare size={11} />
        Reply queue
        <span style={{ fontSize: "0.64rem", fontWeight: 600, color: replied > 0 ? "#22c55e" : "var(--fg-dim)", background: replied > 0 ? "rgba(34,197,94,0.1)" : "rgba(165,182,214,0.06)", padding: "1px 7px", borderRadius: 10, border: `1px solid ${replied > 0 ? "rgba(34,197,94,0.25)" : "var(--border)"}` }}>
          {replied}/{posts.length} replied
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {posts.map(post => (
          <div key={post.id} style={{
            padding: "12px 14px",
            borderRadius: "var(--radius)",
            background: post.repliedAt ? "rgba(34,197,94,0.04)" : "var(--bg-elevated)",
            border: `1px solid ${post.repliedAt ? "rgba(34,197,94,0.2)" : "var(--border)"}`,
            opacity: post.repliedAt ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}>
            {/* Post header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {post.subreddit && (
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--accent)", marginRight: 6 }}>r/{post.subreddit}</span>
                )}
                {post.authenticityScore != null && (
                  <span style={{ fontSize: "0.60rem", color: "var(--fg-dim)" }}>auth {post.authenticityScore}/10</span>
                )}
                <div style={{ fontSize: "0.78rem", color: "var(--fg)", lineHeight: 1.5, marginTop: 3 }}>
                  {post.rawText.slice(0, 200)}{post.rawText.length > 200 ? "…" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open original post"
                  style={{ display: "flex", alignItems: "center", padding: "4px 6px", borderRadius: 4, background: "rgba(165,182,214,0.06)", border: "1px solid var(--border)", color: "var(--fg-muted)", textDecoration: "none" }}
                >
                  <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => handleToggleReplied(post)}
                  title={post.repliedAt ? "Mark as not replied" : "Mark as replied"}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px", borderRadius: 4, cursor: "pointer",
                    fontSize: "0.68rem", fontWeight: 600,
                    background: post.repliedAt ? "rgba(34,197,94,0.12)" : "rgba(165,182,214,0.06)",
                    border: `1px solid ${post.repliedAt ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                    color: post.repliedAt ? "#22c55e" : "var(--fg-muted)",
                  }}
                >
                  <Check size={11} />
                  {post.repliedAt ? "Replied" : "Replied?"}
                </button>
              </div>
            </div>

            {/* Draft area */}
            {post.replyDraft ? (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 5 }}>Draft reply</div>
                <div style={{ position: "relative" as const }}>
                  <textarea
                    defaultValue={post.replyDraft}
                    rows={4}
                    style={{
                      width: "100%", resize: "vertical",
                      background: "rgba(165,182,214,0.04)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius)", padding: "8px 10px",
                      color: "var(--fg)", fontSize: "0.78rem", fontFamily: "inherit",
                      outline: "none", boxSizing: "border-box",
                      paddingRight: 40,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(post.replyDraft!, post.id)}
                    title="Copy to clipboard"
                    style={{
                      position: "absolute" as const, top: 8, right: 8,
                      background: "none", border: "none", cursor: "pointer",
                      color: copied === post.id ? "#22c55e" : "var(--fg-muted)",
                      display: "flex", alignItems: "center", padding: 4,
                    }}
                  >
                    {copied === post.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleDraft(post)}
                disabled={drafting.has(post.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 4, cursor: drafting.has(post.id) ? "default" : "pointer",
                  fontSize: "0.72rem", fontWeight: 600,
                  background: "transparent", border: "1px solid var(--border)",
                  color: "var(--fg-subtle)",
                }}
              >
                {drafting.has(post.id)
                  ? <><Loader2 size={11} style={{ animation: "bd-spin 0.8s linear infinite" }} />Drafting…</>
                  : <><Sparkles size={11} />Draft reply</>}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Expanded: Ready detail ────────────────────────────────────────────────────

function ReadyRow({ op, onKill, onCancel }: { op: UnifiedOp; onKill: () => void; onCancel: () => void }) {
  const a = op.analysisJson!;
  const vc = VERDICT_CFG[a.verdict as keyof typeof VERDICT_CFG] ?? VERDICT_CFG.maybe;
  const [buildBusy, setBuildBusy] = useState(false);
  const [killBusy, setKillBusy] = useState(false);
  const [playbookBusy, setPlaybookBusy] = useState(false);
  const [playbookHtml, setPlaybookHtml] = useState("");
  const navigate = useNavigate();

  async function handleGeneratePlaybook() {
    if (!op.ideaId) return;
    setPlaybookBusy(true);
    try {
      const result = await generatePlaybookForIdea({ data: { ideaId: op.ideaId } });
      setPlaybookHtml(result.briefHtml);
    } finally { setPlaybookBusy(false); }
  }

  async function handleBuild() {
    if (!op.ideaId) return;
    setBuildBusy(true);
    try {
      const { projectId } = await promoteIdeaToProject({ data: { id: op.ideaId } });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/i/$id/opportunities", params: { id: String(projectId) }, search: { opp: undefined } });
    } finally { setBuildBusy(false); }
  }

  async function handleKill() {
    if (!op.ideaId) return;
    setKillBusy(true);
    try {
      await updateIdea({ data: { id: op.ideaId, status: "killed" } });
      onKill();
    } finally { setKillBusy(false); }
  }

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div style={{ padding: "18px 24px", background: `${vc.bg}`, borderBottom: "1px solid var(--border)", borderLeft: `3px solid ${vc.color}` }}>
          {/* Verdict + actions */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.03em", color: vc.color, lineHeight: 1, textTransform: "uppercase", flexShrink: 0 }}>
              {a.verdict}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.74rem", color: "var(--fg-subtle)", marginBottom: 3 }}>
                Confidence: <strong style={{ color: "var(--fg)" }}>{a.confidence}/10</strong>
                {a.estimatedMrrRange && <> · MRR: <strong style={{ color: "var(--fg)" }}>{a.estimatedMrrRange}</strong></>}
                {a.buildComplexity && <> · Build: <strong style={{ color: "var(--fg)" }}>{a.buildComplexity}</strong></>}
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.verdictReason}</p>
            </div>
            <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
              {a.verdict !== "kill" && !playbookHtml && (
                <Button variant="ghost" size="sm" onClick={handleGeneratePlaybook} disabled={playbookBusy} style={{ gap: 5 }}>
                  {playbookBusy ? <Loader2 size={11} style={{ animation: "bd-spin 0.8s linear infinite" }} /> : <Sparkles size={11} />}
                  {playbookBusy ? "Generating…" : "Regenerate Playbook"}
                </Button>
              )}
              {a.verdict !== "kill" && (
                <Button variant="primary" size="sm" onClick={handleBuild} disabled={buildBusy} style={{ gap: 5 }}>
                  {buildBusy ? <Loader2 size={11} style={{ animation: "bd-spin 0.8s linear infinite" }} /> : <Hammer size={11} />}
                  Build →
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleKill} disabled={killBusy}>{killBusy ? "Killing…" : "Kill"}</Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>Collapse</Button>
            </div>
          </div>

          {/* Detail grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
            {[
              { label: "Top opportunity", value: a.topOpportunity },
              { label: "User persona", value: a.userPersona },
              { label: "Distribution", value: a.distributionStrategy },
              { label: "Messaging", value: a.messagingThatWorks },
              { label: "Avoid saying", value: a.messagingToAvoid },
              { label: "Time to revenue", value: a.timeToFirstRevenue },
            ].filter(d => d.value).map(d => (
              <div key={d.label}>
                <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 3 }}>{d.label}</div>
                <div style={{ fontSize: "0.76rem", color: "var(--fg)", lineHeight: 1.5 }}>{d.value}</div>
              </div>
            ))}
          </div>

          {/* Community scores */}
          {(a.communityInsights ?? []).length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 7 }}>Community breakdown</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {a.communityInsights!.map(ci => (
                  <div key={ci.subreddit} style={{ padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--bg-elevated)", border: "1px solid var(--border)", minWidth: 150 }}>
                    <div style={{ fontSize: "0.70rem", fontWeight: 700, color: "var(--accent)", marginBottom: 4 }}>r/{ci.subreddit}</div>
                    <div style={{ fontSize: "0.66rem", color: "var(--fg-muted)", display: "flex", gap: 8 }}>
                      <span title="Urgency">⚡{ci.urgencyScore}/10</span>
                      <span title="Pain">🔥{ci.painScore}/10</span>
                      <span title="Purchase intent">💰{ci.purchaseIntentScore}/10</span>
                    </div>
                    {ci.topInsights[0] && (
                      <div style={{ marginTop: 3, fontSize: "0.66rem", color: "var(--fg-subtle)", lineHeight: 1.4 }}>{ci.topInsights[0]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playbook */}
          {playbookHtml && (
            <div style={{ marginTop: 18, borderTop: "1px solid rgba(165,182,214,0.12)", paddingTop: 18 }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-dim)", marginBottom: 12 }}>
                Playbook
              </div>
              <div
                className="brief-content"
                dangerouslySetInnerHTML={{ __html: playbookHtml }}
                style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--fg-muted)" }}
              />
            </div>
          )}

          {/* Community intelligence */}
          {op.communities.length > 0 && (
            <CommunityIntel communities={op.communities} />
          )}

          {/* Reply queue */}
          <ReplyQueue
            clusterId={op.clusterId}
            productName={op.title}
            productPitch={op.description || op.title}
            communities={op.communities}
          />
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function OpportunitiesPage() {
  const loaderData = Route.useLoaderData() as UnifiedOp[];
  const navigate = useNavigate();
  const [ops, setOps] = useState<UnifiedOp[]>(loaderData);
  const [filter, setFilter] = useState<OpStatus | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [buildingByKey, setBuildingByKey] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const analyzing = useMemo(() => ops.filter(o => o.status === "analyzing" && o.ideaId != null), [ops]);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      let changed = false;
      for (const op of analyzing) {
        const updated = await getIdea({ data: { id: op.ideaId! } });
        if (updated && (updated.status === "ready" || updated.status === "killed")) { changed = true; break; }
      }
      if (changed) { const fresh = await getUnifiedOpportunities(); setOps(fresh); }
    }, 3_000);
  }, [analyzing]);

  useEffect(() => {
    if (analyzing.length > 0) startPolling();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [analyzing.length, startPolling]);

  async function refresh() {
    setLoading(true);
    try { setOps(await getUnifiedOpportunities()); } finally { setLoading(false); }
  }

  async function handleBuildProject(op: UnifiedOp) {
    setBuildingByKey(prev => new Set(prev).add(op.key));
    try {
      // Build a rich description from all available signal data so the full
      // opportunity generator has maximum context to score + brief properly
      const a = op.analysisJson;
      const descParts = [
        `## Opportunity: ${op.title}`,
        op.description ? `**Problem:** ${op.description}` : '',
        op.communities.length > 0 ? `**Communities:** ${op.communities.map(c => `r/${c}`).join(', ')}` : '',
        a?.topOpportunity ? `**Product opportunity:** ${a.topOpportunity}` : '',
        a?.userPersona ? `**Target buyer:** ${a.userPersona}` : '',
        a?.distributionStrategy ? `**How to reach them:** ${a.distributionStrategy}` : '',
        a?.messagingThatWorks ? `**Messaging that works:** ${a.messagingThatWorks}` : '',
        a?.messagingToAvoid ? `**Avoid saying:** ${a.messagingToAvoid}` : '',
        a?.estimatedMrrRange ? `**MRR estimate:** ${a.estimatedMrrRange}` : '',
        op.mrrEstimate ? `**MRR:** ${op.mrrEstimate}` : '',
        op.signalCount > 0 ? `**Signal count:** ${op.signalCount} Reddit posts/comments matching this pain` : '',
      ].filter(Boolean).join('\n');

      const { projectId, opportunityId } = await buildFullProjectFromOp({
        data: {
          title: op.title,
          description: descParts,
          communities: op.communities,
          hypothesis: op.description || op.title,
        }
      });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/i/$id/opportunities", params: { id: String(projectId) }, search: { opp: opportunityId } });
    } catch (e) {
      console.error("Build project failed", e);
    } finally {
      setBuildingByKey(prev => { const n = new Set(prev); n.delete(op.key); return n; });
    }
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const counts = useMemo(() => {
    const c: Partial<Record<OpStatus | "all", number>> = { all: ops.length };
    for (const op of ops) c[op.status] = (c[op.status] ?? 0) + 1;
    return c;
  }, [ops]);

  const filtered = useMemo(() => {
    const base = filter === "all" ? ops : ops.filter(o => o.status === filter);
    return sortOps(base, sortKey, sortDir);
  }, [ops, filter, sortKey, sortDir]);

  const pillOrder: Array<OpStatus | "all"> = ["all", "signal", "analyzing", "ready", "building", "dead"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "18px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Target size={15} style={{ color: "var(--accent)" }} />
          <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>Opportunities</h1>
          <span style={{ fontSize: "0.76rem", color: "var(--fg-subtle)" }}>{ops.length} total</span>
          <div style={{ marginLeft: "auto" }}>
            <Button variant="ghost" size="sm" onClick={refresh} disabled={loading} style={{ gap: 4 }}>
              <RefreshCw size={11} style={{ animation: loading ? "bd-spin 0.8s linear infinite" : "none" }} />
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          {pillOrder.map(s => {
            const active = filter === s;
            const cfg = s === "all" ? null : STATUS_CFG[s];
            const ac = cfg?.color ?? "var(--accent)";
            return (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "3px 10px", borderRadius: 4, border: "1px solid",
                borderColor: active ? ac : "var(--border-strong)",
                background: active ? `${ac}15` : "transparent",
                color: active ? ac : "var(--fg-subtle)",
                fontSize: "0.74rem", cursor: "pointer", fontFamily: "inherit",
                textTransform: "capitalize", transition: "all 0.1s",
              }}>
                {s} <span style={{ opacity: 0.6 }}>{counts[s] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 28px 28px" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: "0.82rem" }}>
            {ops.length === 0
              ? "No opportunities yet - run the Pain Scanner or scan a vertical in Opportunity Radar."
              : `No ${filter} opportunities.`}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <Th col="status" label="Status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th col="title" label="Opportunity" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} style={{ minWidth: 220 }} />
                <Th col="verdict" label="Verdict" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th col="confidence" label="Confidence" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th col="signals" label="Signals" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <StaticTh label="Communities" />
                <StaticTh label="Quality" />
                <Th col="mrr" label="MRR est." sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <StaticTh label="" />
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((op, i) => {
                const isExpanded = expandedKey === op.key;
                const scfg = STATUS_CFG[op.status];
                const vc = op.verdict ? VERDICT_CFG[op.verdict as keyof typeof VERDICT_CFG] : null;
                const rowBg = isExpanded ? "rgba(165,182,214,0.05)" : i % 2 !== 0 ? "rgba(165,182,214,0.02)" : "transparent";
                const canExpand = op.status !== "building" && op.status !== "dead";

                const mainRow = (
                  <tr
                    key={op.key}
                    onClick={() => canExpand && (expandedKey === op.key ? setExpandedKey(null) : setExpandedKey(op.key))}
                    style={{
                      background: rowBg,
                      borderBottom: isExpanded ? "none" : "1px solid rgba(165,182,214,0.06)",
                      cursor: canExpand ? "pointer" : "default",
                      opacity: op.status === "dead" ? 0.42 : 1,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isExpanded && op.status !== "dead") (e.currentTarget as HTMLTableRowElement).style.background = "rgba(165,182,214,0.05)"; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLTableRowElement).style.background = rowBg; }}
                  >
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: scfg.bg, color: scfg.color, border: `1px solid ${scfg.border}`, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {op.status === "analyzing" && <Loader2 size={9} style={{ animation: "bd-spin 0.8s linear infinite" }} />}
                        {scfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: "0.84rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{op.title}</div>
                      {op.description && <div style={{ fontSize: "0.70rem", color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{op.description}</div>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      {vc
                        ? <span style={{ fontSize: "0.67rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, background: vc.bg, color: vc.color, border: `1px solid ${vc.border}` }}>{op.verdict}</span>
                        : <span style={{ color: "var(--fg-dim)", fontSize: "0.70rem" }}>-</span>}
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}><ConfBar score={op.confidenceScore} /></td>
                    <td style={{ padding: "9px 12px", color: "var(--fg-muted)", fontSize: "0.80rem", whiteSpace: "nowrap" }}>{op.signalCount > 0 ? op.signalCount : <span style={{ color: "var(--fg-dim)" }}>-</span>}</td>
                    <td style={{ padding: "9px 12px" }}><CommChips communities={op.communities} /></td>
                    <td style={{ padding: "9px 12px" }}><DimDots dims={op.dims} /></td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      {op.mrrEstimate
                        ? <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "#22c55e" }}>{op.mrrEstimate}</span>
                        : <span style={{ color: "var(--fg-dim)", fontSize: "0.70rem" }}>-</span>}
                    </td>
                    <td style={{ padding: "9px 8px", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                      {op.status === "building" && op.projectId ? (
                        <a href={`/i/${op.projectId}/opportunities`}
                          style={{ fontSize: "0.67rem", color: "#f59e0b", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          View project →
                        </a>
                      ) : op.status !== "dead" && (
                        <button
                          onClick={() => handleBuildProject(op)}
                          disabled={buildingByKey.has(op.key)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 5, border: "none", background: buildingByKey.has(op.key) ? "rgba(34,197,94,0.2)" : "#22c55e", color: buildingByKey.has(op.key) ? "#22c55e" : "#050d1e", fontSize: "0.68rem", fontWeight: 700, cursor: buildingByKey.has(op.key) ? "default" : "pointer", fontFamily: "inherit", transition: "all 0.1s" }}
                        >
                          {buildingByKey.has(op.key)
                            ? <><Loader2 size={9} style={{ animation: "bd-spin 0.8s linear infinite" }} /> Building…</>
                            : <><Hammer size={9} /> Build Project</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );

                const expandedRow =
                  isExpanded && op.status === "signal" ? (
                    <AnalyzeRow key={`${op.key}-x`} op={op} onDone={async () => { setExpandedKey(null); await refresh(); }} onCancel={() => setExpandedKey(null)} />
                  ) : isExpanded && op.status === "ready" && op.analysisJson ? (
                    <ReadyRow key={`${op.key}-x`} op={op} onKill={async () => { setExpandedKey(null); await refresh(); }} onCancel={() => setExpandedKey(null)} />
                  ) : isExpanded && op.status === "analyzing" ? (
                    <tr key={`${op.key}-x`}>
                      <td colSpan={9} style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", background: "rgba(96,165,250,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-muted)", fontSize: "0.80rem" }}>
                          <Loader2 size={13} style={{ animation: "bd-spin 0.8s linear infinite", color: "var(--accent)" }} />
                          Analyzing {op.communities.length} {op.communities.length === 1 ? "community" : "communities"}…
                          <span style={{ color: "var(--fg-dim)", fontSize: "0.72rem" }}>30–60 seconds.</span>
                        </div>
                        <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {op.communities.map(c => (
                            <span key={c} style={{ fontSize: "0.62rem", fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "rgba(96,165,250,0.08)", color: "var(--accent)", border: "1px solid rgba(96,165,250,0.2)" }}>r/{c}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null;

                return expandedRow ? [mainRow, expandedRow] : [mainRow];
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
