import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@offbeatport/ui/ui/button";
import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";

type QueryResultRow = {
  id: string;
  queryText: string;
  status: "pending" | "done" | "error";
  extractedDomains: string[] | null;
  response: string | null;
  error: string | null;
};

type RunDetail = {
  id: string;
  status: "pending" | "running" | "done" | "error";
  model: string;
  totalQueries: number;
  completedQueries: number;
  createdAt: Date;
  results: QueryResultRow[];
};

const getRunDetail = createServerFn()
  .handler(async ({ data: runId }: { data: string }) => {
    const { db } = await import("../../db/client");
    const { runs, queryResults } = await import("../../db/schema");
    const { eq } = await import("drizzle-orm");

    const [run] = await db.select().from(runs).where(eq(runs.id, runId));
    if (!run) throw new Error("Run not found");

    const results = await db
      .select()
      .from(queryResults)
      .where(eq(queryResults.runId, runId));

    const detail: RunDetail = {
      id: run.id,
      status: run.status,
      model: run.model,
      totalQueries: run.totalQueries,
      completedQueries: run.completedQueries,
      createdAt: run.createdAt,
      results: results.map((r) => ({
        id: r.id,
        queryText: r.queryText,
        status: r.status,
        extractedDomains: r.extractedDomains ?? null,
        response: r.response ?? null,
        error: r.error ?? null,
      })),
    };

    return { run: detail };
  });

export const Route = createFileRoute("/admin/runs_/$runId")({
  loader: ({ params }) => getRunDetail({ data: params.runId }),
  component: RunDetailPage,
});

const statusColor = {
  pending: "text-fg-muted bg-fg/5",
  running: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  done: "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20",
  error: "text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
};

function RunDetailPage() {
  const { run } = Route.useLoaderData();
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (run.status !== "running") return;
    const interval = setInterval(() => {
      router.invalidate();
    }, 3000);
    return () => clearInterval(interval);
  }, [run.status, router]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const progress =
    run.totalQueries > 0
      ? Math.round((run.completedQueries / run.totalQueries) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin" className="text-sm text-fg-muted hover:text-fg">
          ← Admin
        </Link>
        <span className="text-fg-muted">/</span>
        <span className="text-sm text-fg font-mono">{run.id.slice(0, 8)}</span>
      </div>

      {/* Run summary */}
      <div className="border border-border p-5 space-y-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Status</p>
            <span
              className={`inline-flex px-2 py-0.5 text-xs font-medium ${statusColor[run.status]}`}
            >
              {run.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Model</p>
            <p className="text-sm text-fg font-mono">{run.model}</p>
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Created</p>
            <p className="text-sm text-fg">
              {new Date(run.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-fg-muted mb-0.5">Progress</p>
            <p className="text-sm text-fg font-mono">
              {run.completedQueries}/{run.totalQueries} queries
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-border h-1.5">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Results table */}
      <div>
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">
          Query Results
        </h2>
        {run.results.length === 0 ? (
          <p className="text-sm text-fg-muted">No results yet.</p>
        ) : (
          <div className="border border-border">
            {run.results.map((result, i) => (
              <div
                key={result.id}
                className={`${i < run.results.length - 1 ? "border-b border-border" : ""}`}
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 inline-flex px-1.5 py-0.5 text-xs font-medium shrink-0 ${statusColor[result.status]}`}
                  >
                    {result.status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg">{result.queryText}</p>
                    {result.extractedDomains &&
                      result.extractedDomains.length > 0 && (
                        <p className="text-xs text-fg-muted mt-1">
                          {result.extractedDomains.join(", ")}
                        </p>
                      )}
                    {result.error && (
                      <p className="text-xs text-red-600 mt-1">
                        {result.error}
                      </p>
                    )}
                  </div>
                  {result.response && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => toggleExpand(result.id)}
                      className="shrink-0 text-xs"
                    >
                      {expandedIds.has(result.id) ? "Hide" : "View response"}
                    </Button>
                  )}
                </div>
                {expandedIds.has(result.id) && result.response && (
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-fg-muted bg-fg/[0.03] border border-border p-3 whitespace-pre-wrap overflow-auto max-h-48">
                      {result.response}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
