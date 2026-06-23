import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { updateProject } from "~/lib/project-fns";
import { useProjectContext } from "~/lib/project-context";
import { CHART_TOOLTIP } from "../$id";
import { Button } from "~/components/ui/Button";
import { Textarea } from "~/components/ui/Input";
import { ProjectConfigModal, ProjectConfigSummary } from "~/components/ui/ProjectConfigModal";
import { Radio, Target, Zap, BarChart2, Edit2, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export const Route = createFileRoute("/i/$id/")({
  pendingMs: 0,
  pendingComponent: () => null,
  component: OverviewPage,
});

const HUNCH_LIMIT = 280;

// ── Shared section label style ─────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em",
  textTransform: "uppercase", color: "rgba(165,182,214,0.35)",
};

// ── Health check types ─────────────────────────────────────────────────────────

type HealthResult =
  | { ok: true; statusCode: number; latencyMs: number }
  | { ok: false; statusCode: number; error: string };

// ── Live overview ──────────────────────────────────────────────────────────────

function LiveOverview({
  project,
  product,
  setProject,
  stats,
  id,
}: {
  project: ReturnType<typeof useProjectContext>["project"];
  product: ReturnType<typeof useProjectContext>["product"];
  setProject: ReturnType<typeof useProjectContext>["setProject"];
  stats: ReturnType<typeof useProjectContext>["stats"];
  id: string;
}) {
  const navigate = useNavigate();
  const [configOpen, setConfigOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<HealthResult | null>(null);

  const [editingHunch, setEditingHunch] = useState(false);
  const [hunch, setHunch] = useState(project.hypothesis ?? "");
  const [hunchBusy, setHunchBusy] = useState(false);
  const [hunchExpanded, setHunchExpanded] = useState(false);

  useEffect(() => {
    setHunch(project.hypothesis ?? "");
    setEditingHunch(false);
    setHunchExpanded(false);
    setHealth(null);
  }, [project.id]);

  async function checkHealth() {
    if (!product?.domain) return;
    setChecking(true);
    setHealth(null);
    try {
      const res = await fetch(`/api/health-check?domain=${encodeURIComponent(product?.domain)}`);
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ ok: false, statusCode: 0, error: "network error" });
    } finally {
      setChecking(false);
    }
  }

  async function saveHunch() {
    setHunchBusy(true);
    try {
      await updateProject({ data: { id: project.id, hypothesis: hunch } });
      setProject((p) => ({ ...p, hypothesis: hunch }));
      setEditingHunch(false);
    } finally {
      setHunchBusy(false);
    }
  }

  const displayHunch = project.hypothesis ?? "";
  const hunchTruncated = !hunchExpanded && displayHunch.length > HUNCH_LIMIT;
  const hunchDisplay = hunchTruncated ? displayHunch.slice(0, HUNCH_LIMIT) + "…" : displayHunch;

  const daysSince = project.createdAt
    ? Math.floor((Date.now() - new Date(project.createdAt).getTime()) / 86_400_000)
    : null;

  const configChecks = [
    { label: "Domain set", done: !!product?.domain, value: product?.domain },
    { label: "Repository linked", done: !!product?.repoUrl, value: product?.repoUrl },
    { label: "Twitter / X handle", done: !!product?.twitterHandle, value: product?.twitterHandle },
    { label: "Stripe / Polar checkout URL", done: !!product?.checkoutUrl, value: product?.checkoutUrl },
    { label: "Design direction set", done: !!product?.designDirection, value: null },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 680, padding: "36px 32px 80px" }}>

        {/* ── Domain Health ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <span style={sectionLabel}>Domain health</span>
          <div style={{
            marginTop: 12,
            padding: "16px 18px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            {product?.domain ? (
              <>
                {/* Status indicator */}
                <div style={{ flexShrink: 0 }}>
                  {health === null && !checking ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "rgba(165,182,214,0.25)",
                    }} />
                  ) : checking ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--accent)", opacity: 0.6,
                      animation: "pulse 1.2s ease-in-out infinite",
                    }} />
                  ) : health?.ok ? (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--success)",
                    }} />
                  ) : (
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "var(--danger)",
                    }} />
                  )}
                </div>

                {/* Domain + result */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.88rem", fontWeight: 600, color: "var(--fg)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {product?.domain}
                    <a
                      href={`https://${product?.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "rgba(165,182,214,0.35)", display: "flex", alignItems: "center" }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  {health !== null && (
                    <div style={{
                      fontSize: "0.78rem", marginTop: 3,
                      color: health.ok ? "var(--success)" : "var(--danger)",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {health.ok
                        ? `Live · ${health.statusCode} · ${health.latencyMs}ms`
                        : `Down · ${health.error}`}
                    </div>
                  )}
                  {health === null && !checking && (
                    <div style={{ fontSize: "0.74rem", marginTop: 2, color: "rgba(165,182,214,0.30)" }}>
                      Not checked yet
                    </div>
                  )}
                  {checking && (
                    <div style={{ fontSize: "0.74rem", marginTop: 2, color: "rgba(165,182,214,0.45)" }}>
                      Checking…
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkHealth}
                  disabled={checking}
                  style={{ flexShrink: 0 }}
                >
                  {checking ? "Checking…" : "Check"}
                </Button>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontSize: "0.84rem", color: "rgba(165,182,214,0.40)", fontStyle: "italic" }}>
                  No domain configured
                </span>
                <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                  Configure →
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Configuration Status ─────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <span style={sectionLabel}>Configuration</span>
          <div style={{
            marginTop: 12,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}>
            {configChecks.map(({ label, done }, i) => (
              <div
                key={label}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 16px",
                  borderTop: i > 0 ? "1px solid rgba(100,130,180,0.07)" : "none",
                  background: "var(--bg-elevated)",
                }}
              >
                {done ? (
                  <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0 }} />
                ) : (
                  <Circle size={14} style={{ color: "rgba(165,182,214,0.22)", flexShrink: 0 }} />
                )}
                <span style={{
                  flex: 1, fontSize: "0.84rem",
                  color: done ? "var(--fg)" : "rgba(165,182,214,0.50)",
                }}>
                  {label}
                </span>
                {!done && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfigOpen(true)}
                    style={{ fontSize: "0.74rem", color: "var(--accent)", padding: 0, height: "auto" }}
                  >
                    Configure →
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Quick stats ──────────────────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <span style={sectionLabel}>Stats</span>
          <div style={{
            marginTop: 12,
            display: "flex", gap: 0,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}>
            {[
              {
                value: stats.opportunityCount,
                label: "Opportunities",
                to: `/i/${id}/opportunities`,
                icon: Target,
              },
              {
                value: stats.signalCount,
                label: "Signals",
                to: `/i/${id}/channels`,
                icon: Zap,
              },
              {
                value: daysSince ?? 0,
                label: "Days live",
                to: null,
                icon: Radio,
              },
            ].map(({ value, label, to, icon: Icon }, i, arr) => (
              <div
                key={label}
                onClick={() => to && navigate({ to: to as any })}
                style={{
                  flex: 1,
                  padding: "14px 0 14px 18px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: to ? "pointer" : "default",
                  borderRight: i < arr.length - 1 ? "1px solid rgba(100,130,180,0.07)" : "none",
                  background: "var(--bg-elevated)",
                }}
              >
                <Icon size={13} style={{ color: "rgba(165,182,214,0.30)", flexShrink: 0 }} />
                <div>
                  <div style={{
                    fontSize: "1.5rem", fontWeight: 200, letterSpacing: "-0.03em",
                    lineHeight: 1, fontVariantNumeric: "tabular-nums",
                    color: value === 0 ? "rgba(165,182,214,0.25)" : "var(--fg)",
                  }}>
                    {value}
                  </div>
                  <div style={{
                    fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.1em",
                    textTransform: "uppercase", color: "rgba(165,182,214,0.35)", marginTop: 4,
                  }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hypothesis ───────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={sectionLabel}>The hunch</span>
            {!editingHunch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingHunch(true)}
                style={{ gap: 5, color: "rgba(165,182,214,0.30)", padding: "2px 4px" }}
              >
                <Edit2 size={11} /> Edit
              </Button>
            )}
          </div>

          {editingHunch ? (
            <div>
              <Textarea
                autoFocus
                value={hunch}
                onChange={e => setHunch(e.target.value)}
                placeholder="A problem that bothers you, a market you keep thinking about..."
                style={{ minHeight: 120, marginBottom: 10, lineHeight: 1.7 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" size="sm" onClick={saveHunch} disabled={hunchBusy}>
                  {hunchBusy ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingHunch(false); setHunch(project.hypothesis ?? ""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : displayHunch ? (
            <div>
              <p style={{
                margin: 0, fontSize: "0.92rem", lineHeight: 1.72,
                color: "rgba(250,250,250,0.82)", whiteSpace: "pre-line", wordBreak: "break-word",
              }}>
                {hunchDisplay}
              </p>
              {displayHunch.length > HUNCH_LIMIT && (
                <button
                  onClick={() => setHunchExpanded(v => !v)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "0.78rem", color: "rgba(165,182,214,0.38)",
                    padding: "6px 0 0", fontFamily: "inherit",
                  }}
                >
                  {hunchExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setEditingHunch(true)}
              style={{
                background: "none", border: "1px dashed rgba(165,182,214,0.12)",
                cursor: "pointer", padding: "18px 20px", width: "100%",
                textAlign: "left", color: "rgba(165,182,214,0.28)",
                fontSize: "0.88rem", fontStyle: "italic",
                fontFamily: "inherit", lineHeight: 1.5,
              }}
            >
              No hunch yet - click to describe the problem you're exploring
            </button>
          )}
        </div>

      </div>

      <ProjectConfigModal
        open={configOpen}
        project={project}
        onClose={() => setConfigOpen(false)}
        onSaved={() => { /* product/deploy config persists on the product; refresh on navigation */ }}
      />
    </div>
  );
}

// ── Building overview (unchanged) ──────────────────────────────────────────────

function BuildingOverview() {
  const { project, setProject, stats, scores, funnel } = useProjectContext();
  const navigate = useNavigate();
  const { id } = Route.useParams();

  const [editingHunch, setEditingHunch] = useState(false);
  const [hunch, setHunch] = useState(project.hypothesis ?? "");
  const [busy, setBusy] = useState(false);
  const [hunchExpanded, setHunchExpanded] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    setHunch(project.hypothesis ?? "");
    setEditingHunch(false);
    setHunchExpanded(false);
  }, [project.id]);

  async function saveHunch() {
    setBusy(true);
    try {
      await updateProject({ data: { id: project.id, hypothesis: hunch } });
      setProject((p) => ({ ...p, hypothesis: hunch }));
      setEditingHunch(false);
    } finally {
      setBusy(false);
    }
  }

  const hasActivity = stats.signalCount > 0 || stats.opportunityCount > 0;
  const displayHunch = project.hypothesis ?? "";
  const hunchTruncated = !hunchExpanded && displayHunch.length > HUNCH_LIMIT;
  const hunchDisplay = hunchTruncated ? displayHunch.slice(0, HUNCH_LIMIT) + "…" : displayHunch;

  const statItems = [
    { value: stats.signalCount, label: "Signals", icon: Zap, to: `/i/${id}/channels`, dim: stats.signalCount === 0 },
    { value: stats.opportunityCount, label: "Opportunities", icon: Target, to: `/i/${id}/opportunities`, dim: stats.opportunityCount === 0 },
    { value: stats.discoveryRunCount, label: "Runs", icon: Radio, to: null, dim: stats.discoveryRunCount === 0 },
    { value: stats.featureCount, label: "Features", icon: BarChart2, to: null, dim: stats.featureCount === 0 },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 680, padding: "36px 32px 80px" }}>

        {/* ── Hunch ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={sectionLabel}>The hunch</span>
            {!editingHunch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingHunch(true)}
                style={{ gap: 5, color: "rgba(165,182,214,0.3)", padding: "2px 4px" }}
              >
                <Edit2 size={11} /> Edit
              </Button>
            )}
          </div>

          {editingHunch ? (
            <div>
              <Textarea
                autoFocus
                value={hunch}
                onChange={e => setHunch(e.target.value)}
                placeholder="A problem that bothers you, a market you keep thinking about..."
                style={{ minHeight: 120, marginBottom: 10, lineHeight: 1.7 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="primary" size="sm" onClick={saveHunch} disabled={busy}>
                  {busy ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingHunch(false); setHunch(project.hypothesis ?? ""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : displayHunch ? (
            <div>
              <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.72, color: "rgba(250,250,250,0.82)", whiteSpace: "pre-line", wordBreak: "break-word" }}>
                {hunchDisplay}
              </p>
              {displayHunch.length > HUNCH_LIMIT && (
                <button
                  onClick={() => setHunchExpanded(v => !v)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", color: "rgba(165,182,214,0.38)", padding: "6px 0 0", fontFamily: "inherit" }}
                >
                  {hunchExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setEditingHunch(true)}
              style={{ background: "none", border: "1px dashed rgba(165,182,214,0.12)", cursor: "pointer", padding: "18px 20px", width: "100%", textAlign: "left", color: "rgba(165,182,214,0.28)", fontSize: "0.88rem", fontStyle: "italic", fontFamily: "inherit", lineHeight: 1.5 }}
            >
              No hunch yet - click to describe the problem you're exploring
            </button>
          )}
        </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "stretch",
          borderTop: "1px solid rgba(165,182,214,0.08)",
          borderBottom: "1px solid rgba(165,182,214,0.08)",
          marginBottom: 36,
        }}>
          {statItems.map(({ value, label, icon: Icon, to, dim }, i) => (
            <div
              key={label}
              onClick={() => to && navigate({ to: to as any })}
              style={{
                flex: 1, padding: "14px 0 14px 20px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: to ? "pointer" : "default",
                borderRight: i < statItems.length - 1 ? "1px solid rgba(165,182,214,0.08)" : "none",
              }}
            >
              <Icon size={14} style={{ color: dim ? "rgba(165,182,214,0.2)" : "var(--accent)", flexShrink: 0, opacity: dim ? 1 : 0.75 }} />
              <div>
                <div style={{ fontSize: "1.6rem", fontWeight: 200, letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: dim ? "rgba(165,182,214,0.25)" : "var(--fg)" }}>
                  {value}
                </div>
                <div style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(165,182,214,0.35)", marginTop: 4 }}>
                  {label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts (only when there's data) ────────────────────────── */}
        {hasActivity && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 36 }}>
            <div>
              <div style={{ ...sectionLabel, display: "block", marginBottom: 14 }}>Pipeline</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={funnel} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="stage" width={88}
                    tick={{ fill: "rgba(165,182,214,0.45)", fontSize: 11, fontFamily: "'Space Grotesk', sans-serif" }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(165,182,214,0.04)" }} contentStyle={CHART_TOOLTIP} itemStyle={{ color: "var(--fg-muted)" }} formatter={(v: number) => [v, ""]} />
                  <Bar dataKey="count" radius={2} maxBarSize={11}>
                    {funnel.map((entry, i) => (
                      <Cell key={i} fill={entry.count > 0 ? "var(--accent)" : "rgba(100,130,180,0.1)"} fillOpacity={entry.count > 0 ? 1 - i * 0.12 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ ...sectionLabel, display: "block", marginBottom: 14 }}>Score distribution</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={scores} margin={{ left: 0, right: 4, top: 0, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fill: "rgba(165,182,214,0.45)", fontSize: 11, fontFamily: "'Space Grotesk', sans-serif" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: "rgba(165,182,214,0.04)" }} contentStyle={CHART_TOOLTIP} itemStyle={{ color: "var(--fg-muted)" }} formatter={(v: number) => [v, "opportunities"]} />
                  <Bar dataKey="count" radius={2} maxBarSize={24}>
                    {scores.map((entry, i) => (
                      <Cell key={i} fill={entry.count > 0 ? (i >= 3 ? "#4ade80" : "var(--accent)") : "rgba(100,130,180,0.1)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8 }}>
          {!hasActivity ? (
            <>
              <Button variant="primary" size="sm" onClick={() => navigate({ to: `/i/${id}/channels` as any })}>
                Run Discovery →
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: `/i/${id}/opportunities` as any, search: { opp: undefined } as any })}>
                View opportunities
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  await fetch("/api/run-all-channels", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ projectId: project.id }),
                  });
                  navigate({ to: `/i/${id}/channels` as any });
                }}>
                Run all channels →
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate({ to: `/i/${id}/channels` as any })}>
                Manage channels
              </Button>
            </>
          )}
        </div>

        {/* ── Config summary ──────────────────────────────────────────── */}
        <ProjectConfigSummary project={project} onConfigure={() => setConfigOpen(true)} />

      </div>

      <ProjectConfigModal
        open={configOpen}
        project={project}
        onClose={() => setConfigOpen(false)}
        onSaved={() => { /* product/deploy config persists on the product; refresh on navigation */ }}
      />
    </div>
  );
}

// ── Page dispatcher ────────────────────────────────────────────────────────────

function OverviewPage() {
  const { project, product, setProject, stats } = useProjectContext();
  const { id } = Route.useParams();

  if (product?.deployStatus === "deployed") {
    return (
      <LiveOverview
        project={project}
        product={product}
        setProject={setProject}
        stats={stats}
        id={id}
      />
    );
  }

  return <BuildingOverview />;
}
