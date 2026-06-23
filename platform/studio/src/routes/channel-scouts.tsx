import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ChannelIcon } from "~/lib/channel-icons";
import type { ChannelType } from "~/lib/channels";
import { CHANNEL_LABELS } from "~/lib/channels";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { pruneOrphanedSignals } from "~/lib/server-fns";
import { Button } from "~/components/ui/Button";

export const Route = createFileRoute("/channel-scouts")({
  component: ChannelScoutsPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface SerializedJob {
  id: string;
  channelId: number;
  channelType: string;
  projectId: number;
  projectName: string;
  status: "running" | "completed" | "failed";
  logs: string[];
  startedAt: number;
  endedAt?: number;
  exitCode?: number;
}

type JobEvent =
  | { type: "snapshot"; jobs: SerializedJob[] }
  | { type: "created"; job: SerializedJob }
  | { type: "log"; jobId: string; line: string }
  | { type: "ended"; jobId: string; status: "completed" | "failed"; exitCode: number; endedAt: number };

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(startedAt: number, endedAt?: number): string {
  const ms = (endedAt ?? Date.now()) - startedAt;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function parseSummary(logs: string[]): { count: number; label: string } | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    if (!line.startsWith("Done.")) continue;
    // "Done. Created: 5 opportunities | Skipped: 2"
    const oppMatch = line.match(/Created:\s*(\d+)\s*opportunit/);
    if (oppMatch) return { count: parseInt(oppMatch[1], 10), label: "opportunities" };
    // "Done. Inserted 23 new Reddit signals."
    const insertedMatch = line.match(/Inserted\s+(\d+)\s+new/);
    if (insertedMatch) return { count: parseInt(insertedMatch[1], 10), label: "signals" };
    // "Done. 23 new Dev.to signals."
    const newMatch = line.match(/^Done\.\s+(\d+)\s+new/);
    if (newMatch) return { count: parseInt(newMatch[1], 10), label: "signals" };
    // Fallback: first number in the Done line
    const numMatch = line.match(/(\d+)/);
    if (numMatch) return { count: parseInt(numMatch[1], 10), label: "signals" };
  }
  return null;
}

// ── Job row ───────────────────────────────────────────────────────────────────

function JobRow({ job }: { job: SerializedJob }) {
  const [expanded, setExpanded] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded && job.status === "running") {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [job.logs.length, expanded, job.status]);

  const lastLog = job.logs[job.logs.length - 1];
  const summary = job.status !== "running" ? parseSummary(job.logs) : null;

  const statusColor =
    job.status === "running" ? "var(--accent)" :
      job.status === "completed" ? "#22c55e" :
        "#ef4444";

  const statusIcon =
    job.status === "running" ? (
      <Loader2 size={13} style={{ color: statusColor, animation: "spin 1s linear infinite" }} />
    ) : job.status === "completed" ? (
      <CheckCircle2 size={13} style={{ color: statusColor }} />
    ) : (
      <XCircle size={13} style={{ color: statusColor }} />
    );

  return (
    <div style={{
      borderBottom: "1px solid var(--border)",
      background: expanded ? "rgba(255,255,255,0.015)" : undefined,
    }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 160px 110px 90px 80px",
          alignItems: "center",
          gap: 12,
          padding: "0 20px",
          height: 44,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {/* Expand chevron */}
        <span style={{ color: "var(--fg-subtle)", display: "flex", alignItems: "center" }}>
          {expanded
            ? <ChevronDown size={12} />
            : <ChevronRight size={12} />}
        </span>

        {/* Channel + project */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <ChannelIcon type={job.channelType as ChannelType} size={14} style={{ flexShrink: 0, color: "var(--fg-muted)" }} />
          <span style={{ fontSize: "0.84rem", color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {CHANNEL_LABELS[job.channelType as ChannelType] ?? job.channelType}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {job.projectName}
          </span>
        </div>

        {/* Summary (completed) or last log preview (running) */}
        {summary ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              fontSize: "0.82rem", fontWeight: 700,
              color: summary.count > 0 ? (summary.label === "opportunities" ? "var(--accent)" : "#22c55e") : "var(--fg-subtle)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {summary.count}
            </span>
            <span style={{ fontSize: "0.70rem", color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {summary.label}
            </span>
          </span>
        ) : (
          <span style={{
            fontSize: "0.74rem", color: "var(--fg-subtle)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            fontFamily: "inherit",
          }}>
            {lastLog ?? "-"}
          </span>
        )}

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {statusIcon}
          <span style={{ fontSize: "0.78rem", color: statusColor, fontWeight: 500 }}>
            {job.status === "running" ? "running" : job.status === "completed" ? "done" : "failed"}
          </span>
        </div>

        {/* Duration */}
        <span style={{ fontSize: "0.78rem", color: "var(--fg-muted)", textAlign: "right" }}>
          {job.status === "running"
            ? <LiveElapsed startedAt={job.startedAt} />
            : elapsed(job.startedAt, job.endedAt)}
        </span>

        {/* Start time */}
        <span style={{ fontSize: "0.74rem", color: "var(--fg-subtle)", textAlign: "right" }}>
          {timeStr(job.startedAt)}
        </span>
      </div>

      {/* Expanded log panel - split: errors left, full log right */}
      {expanded && (
        <div style={{
          margin: "0 20px 12px",
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 1,
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          overflow: "hidden",
          fontFamily: "inherit",
          fontSize: "0.76rem",
        }}>
          {/* ── Left: errors only ── */}
          <div style={{ background: "#050607", display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "5px 10px",
              borderBottom: "1px solid var(--border)",
              background: "#070c12",
              fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "rgba(239,68,68,0.6)",
            }}>
              Errors
            </div>
            <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "8px 10px", flex: 1 }}>
              {(() => {
                const errors = job.logs.filter((l) =>
                  /\[error|\[FAILED|\b(4\d\d|5\d\d)\b|error:|exception|ECONNREFUSED|ETIMEDOUT|ENOTFOUND/i.test(l)
                );
                return errors.length === 0 ? (
                  <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.72rem" }}>No errors</span>
                ) : errors.map((line, i) => (
                  <div key={i} style={{ color: "#ef4444", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {line}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* ── Right: full log ── */}
          <div style={{ background: "#050607", display: "flex", flexDirection: "column" }}>
            <div style={{
              padding: "5px 10px",
              borderBottom: "1px solid var(--border)",
              background: "#070c12",
              fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--fg-subtle)",
            }}>
              Output
            </div>
            <div style={{ maxHeight: "60vh", overflowY: "auto", padding: "8px 10px", flex: 1 }}>
              {job.logs.length === 0 ? (
                <span style={{ color: "var(--fg-subtle)" }}>No output yet…</span>
              ) : job.logs.map((line, i) => (
                <div key={i} style={{
                  color: /\[error|\[FAILED|\b(4\d\d|5\d\d)\b/i.test(line) ? "#ef4444" :
                    line.startsWith(">") ? "var(--accent)" : "var(--fg-muted)",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}>
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LiveElapsed({ startedAt }: { startedAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{elapsed(startedAt)}</>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ChannelScoutsPage() {
  const [jobs, setJobs] = useState<Map<string, SerializedJob>>(new Map());
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<number | null>(null);

  async function handlePrune() {
    setPruning(true);
    setPruneResult(null);
    try {
      const { pruned } = await pruneOrphanedSignals();
      setPruneResult(pruned);
      setTimeout(() => setPruneResult(null), 5000);
    } finally {
      setPruning(false);
    }
  }

  useEffect(() => {
    const es = new EventSource("/api/channel-jobs/stream");
    es.onmessage = (e) => {
      try {
        const event: JobEvent = JSON.parse(e.data);
        setJobs((prev) => {
          const next = new Map(prev);
          if (event.type === "snapshot") {
            for (const j of event.jobs) next.set(j.id, j);
          } else if (event.type === "created") {
            next.set(event.job.id, event.job);
          } else if (event.type === "log") {
            const j = next.get(event.jobId);
            if (j) next.set(event.jobId, { ...j, logs: [...j.logs, event.line] });
          } else if (event.type === "ended") {
            const j = next.get(event.jobId);
            if (j) next.set(event.jobId, { ...j, status: event.status, exitCode: event.exitCode, endedAt: event.endedAt });
          }
          return next;
        });
      } catch { }
    };
    es.onerror = () => { };
    return () => es.close();
  }, []);

  const sorted = [...jobs.values()]
    .filter((j) => j.channelType in CHANNEL_LABELS)
    .sort((a, b) => b.startedAt - a.startedAt);
  const running = sorted.filter((j) => j.status === "running").length;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "20px 24px 0",
        borderBottom: "1px solid var(--border)",
        paddingBottom: 16,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--fg)" }}>Channel Scouts</h1>
          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--fg-subtle)" }}>
            Scrape jobs across all projects
          </p>
        </div>
        {running > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px",
            background: "rgba(0,255,136,0.08)",
            border: "1px solid rgba(0,255,136,0.2)",
            borderRadius: 4,
            fontSize: "0.76rem", color: "var(--accent)",
          }}>
            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
            {running} running
          </div>
        )}

        {/* Prune button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrune}
          disabled={pruning}
          title="Delete signals not linked to any opportunity"
          style={{
            color: pruneResult != null ? "#22c55e" : "var(--fg-subtle)",
            borderRadius: 4,
          }}
        >
          {pruning ? (
            <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Trash2 size={11} />
          )}
          {pruning
            ? "Pruning…"
            : pruneResult != null
              ? `Pruned ${pruneResult} signals`
              : "Prune orphans"}
        </Button>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div style={{ padding: "60px 24px", textAlign: "center", color: "var(--fg-subtle)", fontSize: "0.84rem" }}>
          No scout jobs yet. Run a channel from the Channels page.
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr 160px 110px 90px 80px",
            gap: 12, padding: "0 20px",
            height: 36,
            alignItems: "center",
            borderBottom: "1px solid var(--border)",
          }}>
            <span />
            <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Channel / Project</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Result</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Status</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", textAlign: "right" }}>Duration</span>
            <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-subtle)", textAlign: "right" }}>Started</span>
          </div>

          {sorted.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
