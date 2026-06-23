import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  totalQueries: number;
  activeQueries: number;
  topDomains: string[];
};

type RunRow = {
  id: string;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  model: string;
  totalQueries: number;
  completedQueries: number;
  createdAt: Date;
};

const saveRankingsLimit = createServerFn()
  .handler(async ({ data: limit }: { data: number }) => {
    const { setSetting } = await import("../../lib/settings");
    await setSetting("rankings_limit", String(Math.max(1, Math.min(100, limit))));
  });

const getAdminDashboard = createServerFn().handler(async () => {
  const { seedIfEmpty } = await import("../../lib/seed");
  await seedIfEmpty();

  const { db } = await import("../../db/client");
  const { categories, queries, runs, rankings } = await import("../../db/schema");
  const { desc, eq } = await import("drizzle-orm");
  const { getRankingsLimit } = await import("../../lib/settings");
  const rankingsLimit = await getRankingsLimit();

  const allCategories = await db.select().from(categories);
  const allQueries = await db.select().from(queries);
  const allRankings = await db.select().from(rankings);

  const categoryRows: CategoryRow[] = allCategories.map((cat) => {
    const catQueries = allQueries.filter((q) => q.categoryId === cat.id);
    const catRankings = allRankings
      .filter((r) => r.categoryId === cat.id)
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 5)
      .map((r) => r.domain);

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      totalQueries: catQueries.length,
      activeQueries: catQueries.filter((q) => q.active).length,
      topDomains: catRankings,
    };
  });

  const recentRuns = await db
    .select()
    .from(runs)
    .orderBy(desc(runs.createdAt))
    .limit(10);

  const runRows: RunRow[] = recentRuns.map((r) => ({
    id: r.id,
    status: r.status,
    model: r.model,
    totalQueries: r.totalQueries,
    completedQueries: r.completedQueries,
    createdAt: r.createdAt,
  }));

  const lastRun = runRows.find((r) => r.status === "done") ?? null;

  return { categoryRows, runRows, lastRun, rankingsLimit };
});

export const Route = createFileRoute("/admin/")({
  loader: () => getAdminDashboard(),
  component: AdminDashboard,
});

function faviconColor(domain: string) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) | 0;
  const hues = [212, 28, 142, 268, 340, 168, 48, 312, 198, 8, 110, 240];
  return `oklch(0.56 0.14 ${hues[Math.abs(h) % hues.length]})`;
}

function StatusBadge({ status }: { status: RunRow["status"] }) {
  return <span className={`lb-badge ${status}`}>{status}</span>;
}

function AdminDashboard() {
  const { categoryRows, runRows, lastRun, rankingsLimit } = Route.useLoaderData();
  const [limitInput, setLimitInput] = useState(String(rankingsLimit));
  const [savingLimit, setSavingLimit] = useState(false);
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [reseeding, setReseeding] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [togglingCat, setTogglingCat] = useState<string | null>(null);
  const [deletingRun, setDeletingRun] = useState<string | null>(null);
  const [localActive, setLocalActive] = useState<Record<string, boolean>>({});

  const isCatActive = (cat: CategoryRow) => {
    if (localActive[cat.id] !== undefined) return localActive[cat.id];
    return cat.activeQueries === cat.totalQueries;
  };

  async function handleStartRun() {
    setStarting(true);
    try {
      const res = await fetch("/api/admin/run", { method: "POST" });
      const data = await res.json();
      if (data.runId) {
        await router.navigate({ to: "/admin/runs/$runId", params: { runId: data.runId } });
      }
    } catch {
      alert("Failed to start run.");
    } finally {
      setStarting(false);
    }
  }

  async function handleReseed() {
    if (!confirm("Wipe all categories, queries, and rankings and re-seed from scratch?")) return;
    setReseeding(true);
    try {
      await fetch("/api/admin/seed", { method: "POST" });
      router.invalidate();
    } catch {
      alert("Failed to re-seed.");
    } finally {
      setReseeding(false);
    }
  }

  async function handleToggleCategory(cat: CategoryRow) {
    setTogglingCat(cat.id);
    const newActive = !isCatActive(cat);
    setLocalActive((prev) => ({ ...prev, [cat.id]: newActive }));
    try {
      await fetch(`/api/admin/categories/${cat.id}/toggle`, { method: "POST" });
      router.invalidate();
    } catch {
      setLocalActive((prev) => ({ ...prev, [cat.id]: !newActive }));
    } finally {
      setTogglingCat(null);
    }
  }

  async function handleDeleteRun(runId: string) {
    if (!confirm("Delete this run and all its results?")) return;
    setDeletingRun(runId);
    try {
      await fetch(`/api/admin/runs/${runId}`, { method: "DELETE" });
      router.invalidate();
    } catch {
      alert("Failed to delete run.");
    } finally {
      setDeletingRun(null);
    }
  }

  const [stoppingRun, setStoppingRun] = useState<string | null>(null);
  async function handleStopRun(runId: string) {
    setStoppingRun(runId);
    try {
      await fetch(`/api/admin/runs/${runId}/cancel`, { method: "POST" });
      router.invalidate();
    } catch {
      alert("Failed to stop run.");
    } finally {
      setStoppingRun(null);
    }
  }

  const activeCount = categoryRows.filter(isCatActive).length;
  const totalQueries = categoryRows.reduce((s, c) => s + c.totalQueries, 0);
  const activeQueries = categoryRows.reduce((s, c) => s + (isCatActive(c) ? c.activeQueries : 0), 0);

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 24px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Internal · Admin Dashboard
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "4px 0 0", color: "var(--lb-fg)" }}>
            LiveAIPulse Admin
          </h1>
          {lastRun && (
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", marginTop: 4 }}>
              Last run: {new Date(lastRun.createdAt).toLocaleString()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleReseed}
            disabled={reseeding}
            style={{ height: 32, padding: "0 12px", background: "var(--lb-bg)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: reseeding ? 0.5 : 1, fontFamily: "inherit" }}
          >
            {reseeding ? "Reseeding..." : "Re-seed"}
          </button>
          <button
            onClick={handleStartRun}
            disabled={starting}
            style={{ height: 32, padding: "0 12px", background: "var(--lb-azure)", border: "1px solid var(--lb-azure)", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: starting ? 0.5 : 1, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}
          >
            ▶ {starting ? "Starting..." : "Start new run"}
          </button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-tile">
          <div className="kpi-label">Active categories</div>
          <div className="kpi-value">
            {activeCount}
            <span style={{ fontSize: 14, color: "var(--lb-fg-3)", fontFamily: "'JetBrains Mono', monospace" }}>/ {categoryRows.length}</span>
          </div>
          <div className="kpi-sub">{categoryRows.length - activeCount} paused</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Queries per run</div>
          <div className="kpi-value">
            {activeQueries}
            <span style={{ fontSize: 14, color: "var(--lb-fg-3)", fontFamily: "'JetBrains Mono', monospace" }}>/ {totalQueries}</span>
          </div>
          <div className="kpi-sub">{totalQueries - activeQueries} disabled</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Total runs</div>
          <div className="kpi-value">{runRows.length}</div>
          <div className="kpi-sub">all time</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Last status</div>
          <div className="kpi-value" style={{ fontSize: 16, marginTop: 6 }}>
            {runRows[0] ? <span className={`lb-badge ${runRows[0].status}`}>{runRows[0].status}</span> : "-"}
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="lb-panel" style={{ marginBottom: 24 }}>
        <div className="lb-panel-head">
          <h3>Settings</h3>
        </div>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 16 }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lb-fg-3)", flexShrink: 0 }}>
            Rankings per category
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={limitInput}
            onChange={(e) => setLimitInput(e.target.value)}
            style={{ width: 72, height: 30, padding: "0 8px", border: "1px solid var(--lb-border-strong)", background: "var(--lb-bg)", color: "var(--lb-fg)", fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono', monospace", textAlign: "center" }}
          />
          <button
            onClick={async () => {
              const n = parseInt(limitInput, 10);
              if (!Number.isFinite(n) || n < 1) return;
              setSavingLimit(true);
              await saveRankingsLimit({ data: n });
              setSavingLimit(false);
              router.invalidate();
            }}
            disabled={savingLimit || parseInt(limitInput, 10) === rankingsLimit}
            style={{ height: 30, padding: "0 12px", background: "var(--lb-azure)", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: savingLimit || parseInt(limitInput, 10) === rankingsLimit ? 0.5 : 1, fontFamily: "inherit" }}
          >
            {savingLimit ? "Saving…" : "Save"}
          </button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>
            Currently showing top {rankingsLimit} per category on the public leaderboard
          </span>
        </div>
      </div>

      {/* Categories panel */}
      <div className="lb-panel" style={{ marginBottom: 24 }}>
        <div className="lb-panel-head">
          <h3>Categories</h3>
          <span className="lb-panel-meta">{categoryRows.length} rows · click to expand</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>Category</th>
              <th style={{ width: 110 }}>Queries</th>
              <th>Top 5 ranked domains</th>
              <th className="right" style={{ width: 90 }}>Status</th>
              <th className="right" style={{ width: 56 }} />
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((cat) => {
              const isActive = isCatActive(cat);
              const isExpanded = expandedCat === cat.id;
              return (
                <>
                  <tr
                    key={cat.id}
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <span style={{ display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--lb-fg-3)" }}>
                        <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 4 4 4-4 4" />
                        </svg>
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: "var(--lb-fg)" }}>{cat.name}</td>
                    <td className="num" style={{ color: "var(--lb-fg-2)" }}>
                      <span style={{ color: "var(--lb-fg)", fontWeight: 600 }}>{cat.activeQueries}</span>
                      <span style={{ color: "var(--lb-fg-3)" }}> / {cat.totalQueries}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                        {cat.topDomains.length === 0 ? (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-4)" }}>no data yet</span>
                        ) : cat.topDomains.map((domain, i) => (
                          <span key={domain} className="top5-pill">
                            <span className="pill-idx">#{i + 1}</span>
                            <span style={{ width: 16, height: 16, background: faviconColor(domain), display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                              {domain.charAt(0).toUpperCase()}
                            </span>
                            {domain.replace(/\.(com|co|shop|coffee|net|org)$/, "")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="right">
                      <span className={`lb-badge ${isActive ? "active" : "paused"}`}>
                        {isActive ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="right" onClick={(e) => e.stopPropagation()}>
                      <span
                        className={`lb-toggle ${isActive ? "on" : ""}`}
                        onClick={() => handleToggleCategory(cat)}
                        style={{ opacity: togglingCat === cat.id ? 0.5 : 1 }}
                      />
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${cat.id}-exp`} style={{ background: "var(--lb-bg-1)" }}>
                      <td colSpan={6} style={{ padding: "12px 14px 16px 50px" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lb-fg-3)", marginBottom: 8 }}>
                          Top domains
                        </div>
                        {cat.topDomains.length === 0 ? (
                          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-fg-4)", margin: 0 }}>No rankings yet - start a run.</p>
                        ) : (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {cat.topDomains.map((domain, i) => (
                              <Link
                                key={domain}
                                to="/store/$domain"
                                params={{ domain }}
                                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", border: "1px solid var(--lb-border)", background: "var(--lb-bg)", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-azure)", textDecoration: "none" }}
                              >
                                <span style={{ color: "var(--lb-fg-3)" }}>#{i + 1}</span>
                                {domain}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Runs panel */}
      <div className="lb-panel">
        <div className="lb-panel-head">
          <h3>Recent Runs</h3>
          <span className="lb-panel-meta">{runRows.length} runs · auto at 02:00 UTC</span>
        </div>
        {runRows.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-fg-3)" }}>
            No runs yet. Start one above.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Status</th>
                <th>Model</th>
                <th style={{ minWidth: 180 }}>Progress</th>
                <th>Created</th>
                <th className="right" />
              </tr>
            </thead>
            <tbody>
              {runRows.map((run) => {
                const pct = run.totalQueries > 0 ? (run.completedQueries / run.totalQueries) * 100 : 0;
                return (
                  <tr key={run.id}>
                    <td>
                      <Link
                        to="/admin/runs/$runId"
                        params={{ runId: run.id }}
                        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-azure)", fontWeight: 500 }}
                      >
                        {run.id.slice(0, 12)}
                      </Link>
                    </td>
                    <td><StatusBadge status={run.status} /></td>
                    <td className="num" style={{ color: "var(--lb-fg-2)", fontSize: 12 }}>{run.model}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className={`lb-progress ${run.status}`} style={{ width: 120 }}>
                          <div className="lb-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="num" style={{ color: "var(--lb-fg-2)", fontSize: 12 }}>
                          {run.completedQueries}/{run.totalQueries}
                        </span>
                      </div>
                    </td>
                    <td className="num" style={{ color: "var(--lb-fg-2)", fontSize: 12 }}>
                      {new Date(run.createdAt).toLocaleString()}
                    </td>
                    <td className="right">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <Link
                          to="/admin/runs/$runId"
                          params={{ runId: run.id }}
                          style={{ fontSize: 12, color: "var(--lb-azure)" }}
                        >
                          Detail
                        </Link>
                        {run.status === "running" && (
                          <button
                            onClick={() => handleStopRun(run.id)}
                            disabled={stoppingRun === run.id}
                            style={{ fontSize: 12, color: "var(--lb-amber)", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: stoppingRun === run.id ? 0.5 : 1, fontFamily: "inherit", fontWeight: 600 }}
                          >
                            {stoppingRun === run.id ? "..." : "Stop"}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRun(run.id)}
                          disabled={deletingRun === run.id || run.status === "running"}
                          style={{ fontSize: 12, color: "var(--lb-fg-3)", background: "none", border: "none", cursor: "pointer", padding: 0, opacity: (deletingRun === run.id || run.status === "running") ? 0.3 : 1, fontFamily: "inherit" }}
                          onMouseEnter={(e) => { if (run.status !== "running") (e.target as HTMLElement).style.color = "var(--lb-red)"; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "var(--lb-fg-3)"; }}
                        >
                          {deletingRun === run.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
