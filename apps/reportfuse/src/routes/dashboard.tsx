import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { FileText, Settings, Upload, ChevronRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "../lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const { getSession } = await import("../lib/auth-client");
    const session = await getSession();
    if (!session?.data?.user) throw redirect({ to: "/login" });
  },
  component: DashboardLayout,
});

interface RunMeta {
  id: string;
  inputFileNames: string[];
  rowCount: number;
  prevRowCount: number | null;
  platformsDetected: string[];
  schemaChanges: Array<{ platform: string; message: string }>;
  createdAt: string | number;
}

function DashboardLayout() {
  const { data: session } = useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/runs/")
      .then((r) => r.json())
      .then((d) => { setRuns(d.runs ?? []); setLoadingRuns(false); })
      .catch(() => setLoadingRuns(false));
  }, []);

  function fmtDate(ts: string | number) {
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function fmtDiff(run: RunMeta) {
    if (run.prevRowCount === null || run.prevRowCount === undefined) return null;
    const diff = run.rowCount - run.prevRowCount;
    if (diff === 0) return null;
    return diff;
  }

  const filteredRuns = runs.filter(r => filter === "" || r.inputFileNames.join(" ").toLowerCase().includes(filter.toLowerCase()) || r.platformsDetected.join(" ").toLowerCase().includes(filter.toLowerCase()));

  const activeRunId = pathname.startsWith("/dashboard/run/")
    ? pathname.split("/dashboard/run/")[1]
    : null;

  return (
    <div className="flex min-h-[calc(100vh-60px)]">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border bg-bg-elevated flex flex-col">
        <div className="p-3 border-b border-border">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-medium text-primary-fg bg-primary border border-primary hover:brightness-110 transition-all"
          >
            <Upload size={12} />
            New normalization
          </Link>
        </div>

        {/* Filter input */}
        <div className="px-3 py-2.5 border-b border-border">
          <input
            type="text"
            placeholder="Filter runs"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full font-mono text-xs px-3 py-1.5 border border-border bg-bg text-fg placeholder:text-fg-muted outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Run count header */}
        <div className="px-3 py-2 border-b border-border">
          <span className="font-mono text-[10px] text-fg-subtle uppercase tracking-widest">Runs · {filteredRuns.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingRuns && <div className="px-3 py-2 text-xs text-fg-muted">Loading...</div>}
          {!loadingRuns && runs.length === 0 && <div className="px-3 py-2 text-xs text-fg-muted">No runs yet.</div>}
          {!loadingRuns && runs.length > 0 && filteredRuns.length === 0 && <div className="px-3 py-2 text-xs text-fg-muted">No runs match filter.</div>}

          {filteredRuns.map((run) => {
            const isActive = activeRunId === run.id;
            const diff = fmtDiff(run);
            const hasSchemaChange = run.schemaChanges?.length > 0;

            return (
              <Link
                key={run.id}
                to="/dashboard/run/$runId"
                params={{ runId: run.id }}
                className={`flex items-start gap-2 px-4 py-3 text-left hover:bg-hover transition-colors border-l-2 ${
                  isActive ? "border-primary bg-primary/5" : "border-transparent"
                }`}
              >
                <FileText size={13} className="text-fg-muted shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap mb-0.5">
                    {run.platformsDetected.slice(0, 2).map((p) => (
                      <span key={p} className="text-xs font-mono text-primary">{p}</span>
                    ))}
                    {run.platformsDetected.length > 2 && (
                      <span className="text-xs text-fg-muted">+{run.platformsDetected.length - 2}</span>
                    )}
                    {run.platformsDetected.length === 0 && <span className="text-xs text-fg-muted">Unknown</span>}
                    {hasSchemaChange && (
                      <AlertTriangle size={10} className="text-warning ml-auto shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                    <span>{run.rowCount.toLocaleString()} rows</span>
                    {diff !== null && (
                      <span className={`flex items-center gap-0.5 font-mono ${diff > 0 ? "text-success" : "text-danger"}`}>
                        {diff > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {diff > 0 ? "+" : ""}{diff.toLocaleString()}
                      </span>
                    )}
                    <span>&middot; {fmtDate(run.createdAt)}</span>
                  </div>
                </div>
                {isActive && <ChevronRight size={12} className="text-primary shrink-0 mt-1" />}
              </Link>
            );
          })}
        </div>

        <div className="border-t border-border">
          <Link
            to="/dashboard/settings"
            className={`flex items-center gap-2 px-3 py-3 text-xs hover:bg-hover transition-colors ${
              pathname === "/dashboard/settings" ? "text-fg font-medium" : "text-fg-muted"
            }`}
          >
            <Settings size={13} />
            Settings
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
