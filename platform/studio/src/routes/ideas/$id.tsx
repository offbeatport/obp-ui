import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  getIdea,
  updateIdea,
  analyzeIdea,
  deleteIdea,
  promoteIdeaToProject,
  discoverSubreddits,
} from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import type { Idea, IdeaAnalysisData } from "~/lib/project-fns";
import { Sparkles, ArrowLeft, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/ideas/$id")({
  loader: async ({ params }) => {
    const idea = await getIdea({ data: { id: Number(params.id) } });
    if (!idea) throw new Error("Idea not found");
    return idea;
  },
  component: IdeaDetailPage,
});

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS: { key: Idea["status"]; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "communities", label: "Communities" },
  { key: "analyzing", label: "Analyzing" },
  { key: "ready", label: "Results" },
];

function StepIndicator({ current }: { current: Idea["status"] }) {
  const idx = STEPS.findIndex(s => s.key === current);
  const displayIdx = (current === "killed" || current === "promoted") ? 3 : idx;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 36 }}>
      {STEPS.map((step, i) => {
        const active = i === displayIdx;
        const done = i < displayIdx;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: active ? "var(--accent)" : done ? "rgba(96,165,250,0.12)" : "transparent",
              border: `1px solid ${active ? "var(--accent)" : done ? "rgba(96,165,250,0.3)" : "var(--border-strong)"}`,
              color: active ? "#010407" : done ? "var(--accent)" : "var(--fg-subtle)",
              fontSize: "0.76rem", fontWeight: active ? 700 : 500,
              transition: "all 0.15s",
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 800,
                background: active ? "rgba(0,0,0,0.15)" : "transparent",
              }}>
                {done ? "✓" : i + 1}
              </span>
              {step.label}
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 20, height: 1, background: i < displayIdx ? "rgba(96,165,250,0.4)" : "var(--border-strong)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Setup ─────────────────────────────────────────────────────────────

function StepSetup({ idea, onNext }: { idea: Idea; onNext: (updated: Idea) => void }) {
  const [name, setName] = useState(idea.name);
  const [hypothesis, setHypothesis] = useState(idea.hypothesis ?? "");
  const [lookbackDays, setLookbackDays] = useState(idea.lookbackDays);
  const [busy, setBusy] = useState(false);

  const LOOKBACK = [
    { label: "30 days", value: 30 },
    { label: "90 days", value: 90 },
    { label: "180 days", value: 180 },
    { label: "365 days", value: 365 },
  ];

  async function advance() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateIdea({ data: { id: idea.id, name: name.trim(), hypothesis: hypothesis.trim() || undefined, lookbackDays, status: "communities" } });
      onNext({ ...idea, name: name.trim(), hypothesis: hypothesis.trim() || null, lookbackDays, status: "communities" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "1.10rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Setup your idea
        </h2>
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
          Define what you are testing. Be specific - the clearer the hypothesis, the better the analysis.
        </p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={LABEL_STYLE}>Idea name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Reddit pain monitor for SaaS founders"
          style={INPUT_STYLE}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={LABEL_STYLE}>Hypothesis</label>
        <textarea
          value={hypothesis}
          onChange={e => setHypothesis(e.target.value)}
          placeholder="What pain does this solve? Who has it? Why are they willing to pay?"
          rows={4}
          style={{ ...INPUT_STYLE, resize: "none", lineHeight: 1.6 }}
        />
      </div>

      <div style={{ marginBottom: 28 }}>
        <label style={LABEL_STYLE}>Signal lookback</label>
        <div style={{ display: "flex", gap: 6 }}>
          {LOOKBACK.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLookbackDays(opt.value)}
              style={{
                padding: "5px 12px",
                background: lookbackDays === opt.value ? "rgba(96,165,250,0.12)" : "transparent",
                border: `1px solid ${lookbackDays === opt.value ? "var(--accent)" : "var(--border-strong)"}`,
                borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit",
                fontSize: "0.80rem",
                color: lookbackDays === opt.value ? "var(--accent)" : "var(--fg-subtle)",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="primary" size="md" disabled={busy || !name.trim()} onClick={advance}>
          {busy ? "Saving…" : "Next: Select Communities →"}
        </Button>
      </div>
    </>
  );
}

// ── Step 2: Communities ───────────────────────────────────────────────────────

function StepCommunities({ idea, onAnalyze }: { idea: Idea; onAnalyze: (updated: Idea) => void }) {
  const [selected, setSelected] = useState<string[]>(idea.selectedCommunities ?? []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ name: string; subscribers: number; description: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  function formatSubs(n: number) {
    if (n < 1000) return String(n);
    if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await discoverSubreddits({
        data: {
          keywords: [query.trim()],
          extraKeywords: [],
          projectName: idea.name,
          existingSubreddits: selected,
        },
      });
      setResults(res.filter(r => !selected.includes(r.name)));
    } finally {
      setSearching(false);
    }
  }

  function toggle(name: string) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }

  async function startAnalysis() {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await updateIdea({ data: { id: idea.id, selectedCommunities: selected, status: "analyzing" } });
      const updated = { ...idea, selectedCommunities: selected, status: "analyzing" as const };
      onAnalyze(updated);
      // Fire off analysis (non-blocking - polling will pick up result)
      analyzeIdea({ data: { id: idea.id } }).catch(console.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: "1.10rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          Select communities
        </h2>
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
          Choose 2–5 subreddits where your target users are active. The analysis pulls real signals from these communities.
        </p>
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") search(); }}
          placeholder="e.g. SaaS founders, indie hackers, web scraping…"
          style={{ ...INPUT_STYLE, flex: 1 }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={search}
          disabled={searching || !query.trim()}
          style={{
            gap: 5, flexShrink: 0,
            border: "1px solid rgba(0,255,136,0.25)",
            color: "rgba(0,255,136,0.7)",
            fontSize: "0.72rem",
          }}
        >
          {searching ? (
            <><span style={{ display: "inline-block", animation: "bd-spin 0.9s linear infinite", width: 8, height: 8, border: "1.5px solid transparent", borderTopColor: "var(--accent)", borderRadius: "50%" }} />Searching…</>
          ) : (
            <><Sparkles size={9} />Search</>
          )}
        </Button>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          {results.map(r => (
            <div
              key={r.name}
              onClick={() => { toggle(r.name); setResults(prev => prev.filter(x => x.name !== r.name)); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", cursor: "pointer",
                borderBottom: "1px solid var(--border)",
              }}
              className="hover-row"
            >
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--fg)" }}>r/{r.name}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", marginLeft: 8 }}>{formatSubs(r.subscribers)} members</span>
                {r.description && (
                  <div style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", marginTop: 2 }}>
                    {r.description.slice(0, 100)}{r.description.length > 100 ? "…" : ""}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" style={{ fontSize: "0.72rem", flexShrink: 0 }}>Add</Button>
            </div>
          ))}
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <label style={LABEL_STYLE}>Selected ({selected.length})</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {selected.map(sub => (
              <span
                key={sub}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 20,
                  background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)",
                  fontSize: "0.80rem", color: "var(--accent)",
                }}
              >
                r/{sub}
                <button
                  type="button"
                  onClick={() => toggle(sub)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", padding: 0, lineHeight: 1, fontSize: "0.80rem" }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selected.length === 0 && (
        <p style={{ fontSize: "0.78rem", color: "var(--fg-subtle)", marginBottom: 20 }}>
          Search and select at least 2 communities above.
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <Button
          variant="primary"
          size="md"
          disabled={busy || selected.length < 1}
          onClick={startAnalysis}
        >
          {busy ? "Starting…" : `Analyze ${selected.length > 0 ? `${selected.length} ` : ""}communities →`}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={async () => {
            await updateIdea({ data: { id: idea.id, status: "setup" } });
            window.location.reload();
          }}
        >
          ← Back
        </Button>
      </div>

      <style>{`
        .hover-row:hover { background: var(--bg-elevated); }
        @keyframes bd-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

// ── Step 3: Analyzing ─────────────────────────────────────────────────────────

function StepAnalyzing({ idea, onDone }: { idea: Idea; onDone: (updated: Idea) => void }) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const updated = await getIdea({ data: { id: idea.id } });
      if (updated && (updated.status === "ready" || updated.status === "killed")) {
        if (pollRef.current) clearInterval(pollRef.current);
        onDone(updated);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [idea.id, onDone]);

  const n = idea.selectedCommunities?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 260, gap: 20 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: "3px solid var(--border-strong)",
        borderTopColor: "var(--accent)",
        animation: "bd-spin 0.9s linear infinite",
      }} />
      <div style={{ textAlign: "center" }}>
        <p style={{ margin: "0 0 6px", fontSize: "1.0rem", fontWeight: 600, color: "var(--fg)" }}>
          Analyzing {n} {n === 1 ? "community" : "communities"}…
        </p>
        <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--fg-subtle)" }}>
          Pulling signals, scoring buyer intent, generating insights. This takes 30–60 seconds.
        </p>
      </div>
      <style>{`@keyframes bd-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Step 4: Results ───────────────────────────────────────────────────────────

function StepReady({ idea, onKill, onPromote }: {
  idea: Idea;
  onKill: () => void;
  onPromote: (projectId: number) => void;
}) {
  const [busy, setBusy] = useState<"promote" | "kill" | null>(null);
  const a = idea.analysisJson!;

  const VERDICT_STYLES = {
    go: { color: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.3)" },
    maybe: { color: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.3)" },
    kill: { color: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)" },
  };
  const vs = VERDICT_STYLES[a.verdict];

  const COMPLEXITY_COLORS = { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" };

  async function handlePromote() {
    setBusy("promote");
    try {
      const { projectId } = await promoteIdeaToProject({ data: { id: idea.id } });
      window.dispatchEvent(new Event("projects:changed"));
      onPromote(projectId);
    } finally {
      setBusy(null);
    }
  }

  async function handleKill() {
    setBusy("kill");
    try {
      await updateIdea({ data: { id: idea.id, status: "killed" } });
      onKill();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {/* Verdict block */}
      <div style={{
        padding: "20px 22px", borderRadius: "var(--radius)",
        background: vs.bg, border: `1px solid ${vs.border}`,
        marginBottom: 24,
        display: "flex", alignItems: "flex-start", gap: 18,
      }}>
        <div style={{
          fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em",
          color: vs.color, lineHeight: 1, flexShrink: 0,
          textTransform: "uppercase",
        }}>
          {a.verdict}
        </div>
        <div>
          <div style={{ fontSize: "0.80rem", color: "var(--fg-subtle)", marginBottom: 4 }}>
            Confidence: <strong style={{ color: "var(--fg)" }}>{a.confidence}/10</strong>
          </div>
          <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--fg)", lineHeight: 1.6 }}>
            {a.verdictReason}
          </p>
        </div>
      </div>

      {/* Top opportunity */}
      <div style={{ marginBottom: 20, padding: "14px 16px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
        <label style={LABEL_STYLE}>Top opportunity</label>
        <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.topOpportunity}</p>
      </div>

      {/* User persona */}
      <div style={{ marginBottom: 20 }}>
        <label style={LABEL_STYLE}>User persona</label>
        <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.userPersona}</p>
      </div>

      {/* Distribution strategy */}
      <div style={{ marginBottom: 20 }}>
        <label style={LABEL_STYLE}>Distribution strategy</label>
        <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.distributionStrategy}</p>
      </div>

      {/* Messaging */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ padding: "12px 14px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "var(--radius)" }}>
          <label style={{ ...LABEL_STYLE, color: "#22c55e" }}>Messaging that works</label>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.messagingThatWorks}</p>
        </div>
        <div style={{ padding: "12px 14px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)" }}>
          <label style={{ ...LABEL_STYLE, color: "#ef4444" }}>Messaging to avoid</label>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg)", lineHeight: 1.6 }}>{a.messagingToAvoid}</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
        {[
          { label: "Est. MRR range", value: a.estimatedMrrRange },
          { label: "Build complexity", value: a.buildComplexity, color: COMPLEXITY_COLORS[a.buildComplexity] },
          { label: "Time to first revenue", value: a.timeToFirstRevenue },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: "12px 14px", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
          }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--fg-subtle)", marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "0.90rem", fontWeight: 700, color: stat.color ?? "var(--fg)" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Community insights */}
      {a.communityInsights && a.communityInsights.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL_STYLE}>Community insights</label>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg)" }}>
                  {["Community", "Urgency", "Pain", "Purchase intent", "Top insights"].map(h => (
                    <th key={h} style={{
                      padding: "7px 12px", textAlign: "left", fontSize: "0.62rem",
                      fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
                      color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.communityInsights.map(ci => (
                  <tr key={ci.subreddit} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", fontSize: "0.82rem", fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap" }}>
                      r/{ci.subreddit}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: "0.80rem", color: scoreColor(ci.urgencyScore) }}>
                      {ci.urgencyScore}/10
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: "0.80rem", color: scoreColor(ci.painScore) }}>
                      {ci.painScore}/10
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: "0.80rem", color: scoreColor(ci.purchaseIntentScore) }}>
                      {ci.purchaseIntentScore}/10
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: "0.76rem", color: "var(--fg-subtle)" }}>
                      {ci.topInsights.slice(0, 2).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <Button
          variant="primary"
          size="md"
          disabled={busy !== null}
          onClick={handlePromote}
        >
          {busy === "promote" ? "Creating project…" : "Create Project →"}
        </Button>
        <Button
          variant="ghost"
          size="md"
          disabled={busy !== null}
          onClick={handleKill}
          style={{ color: "#ef4444" }}
        >
          {busy === "kill" ? "Killing…" : "Kill Idea"}
        </Button>
      </div>
    </>
  );
}

function scoreColor(n: number) {
  if (n >= 7) return "#22c55e";
  if (n >= 4) return "#f59e0b";
  return "#ef4444";
}

// ── Step 5: Promoted / Killed ─────────────────────────────────────────────────

function StepFinal({ idea, onReanalyze }: { idea: Idea; onReanalyze: () => void }) {
  const router = useRouter();
  const promoted = idea.status === "promoted";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: "20px 22px", borderRadius: "var(--radius)",
        background: promoted ? "rgba(167,139,250,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${promoted ? "rgba(167,139,250,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}>
        <p style={{ margin: "0 0 8px", fontSize: "1.0rem", fontWeight: 700, color: promoted ? "#a78bfa" : "#ef4444" }}>
          {promoted ? "Promoted to project" : "Idea killed"}
        </p>
        <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)" }}>
          {promoted
            ? "This idea has been promoted to a full project. Head to the project to start building."
            : "This idea was marked as not worth pursuing. You can re-analyze with different communities."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        {promoted && idea.projectId && (
          <Button
            variant="primary"
            size="md"
            onClick={() => router.navigate({ to: "/i/$id/channels", params: { id: String(idea.projectId) } })}
          >
            Open project →
          </Button>
        )}
        <Button
          variant="ghost"
          size="md"
          onClick={onReanalyze}
          style={{ gap: 5 }}
        >
          <RotateCcw size={13} />
          Re-analyze
        </Button>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  display: "block", fontSize: "0.66rem", fontWeight: 700,
  letterSpacing: "0.10em", textTransform: "uppercase",
  color: "var(--fg-subtle)", marginBottom: 6,
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)", color: "var(--fg)", fontSize: "0.88rem",
  padding: "9px 12px", fontFamily: "inherit", outline: "none",
};

// ── Main page ─────────────────────────────────────────────────────────────────

function IdeaDetailPage() {
  const loaderIdea = Route.useLoaderData();
  const router = useRouter();
  const [idea, setIdea] = useState<Idea>(loaderIdea);

  async function handleReanalyze() {
    await updateIdea({ data: { id: idea.id, status: "communities" } });
    setIdea(prev => ({ ...prev, status: "communities" }));
  }

  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 640, padding: "40px 28px" }}>

        {/* Back link */}
        <Link
          to="/ideas"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--fg-subtle)", textDecoration: "none", fontSize: "0.78rem", marginBottom: 28 }}
        >
          <ArrowLeft size={12} />
          All ideas
        </Link>

        {/* Idea name */}
        <h1 style={{ margin: "0 0 4px", fontSize: "1.20rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          {idea.name}
        </h1>
        {idea.hypothesis && (
          <p style={{ margin: "0 0 28px", fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
            {idea.hypothesis}
          </p>
        )}

        <StepIndicator current={idea.status} />

        {idea.status === "setup" && (
          <StepSetup idea={idea} onNext={setIdea} />
        )}

        {idea.status === "communities" && (
          <StepCommunities idea={idea} onAnalyze={setIdea} />
        )}

        {idea.status === "analyzing" && (
          <StepAnalyzing idea={idea} onDone={setIdea} />
        )}

        {idea.status === "ready" && idea.analysisJson && (
          <StepReady
            idea={idea}
            onKill={() => setIdea(prev => ({ ...prev, status: "killed" }))}
            onPromote={(projectId) => {
              setIdea(prev => ({ ...prev, status: "promoted", projectId }));
              window.dispatchEvent(new Event("projects:changed"));
            }}
          />
        )}

        {(idea.status === "killed" || idea.status === "promoted") && (
          <StepFinal idea={idea} onReanalyze={handleReanalyze} />
        )}

      </div>
    </div>
  );
}
