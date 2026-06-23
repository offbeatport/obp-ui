import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { ExternalLink, ChevronDown, ChevronRight, Square, Play, Trash2, Pencil } from "lucide-react";
import type { BuildEntry, BuildStatus } from "../../vite.config";
import { Button } from "~/components/ui/Button";
import { useConfirm } from "~/components/ui/Confirm";

export const Route = createFileRoute("/projects")({
  component: ProjectsPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elapsed(startedAt: number, endedAt?: number): string {
  const ms = (endedAt ?? Date.now()) - startedAt;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

const STATUS_DOT: Record<BuildStatus, string> = {
  running: "#f59e0b",
  "dev:starting": "#3b82f6",
  "dev:ready": "var(--accent)",
  done: "rgba(250,250,250,0.52)",
  failed: "#ef4444",
  "rate-limited": "#f59e0b",
};

const STATUS_LABEL: Record<BuildStatus, string> = {
  running: "building",
  "dev:starting": "starting dev",
  "dev:ready": "live",
  done: "built",
  failed: "failed",
  "rate-limited": "rate limited",
};

function statusIsActive(s: BuildStatus) {
  return s === "running" || s === "dev:starting";
}

// ---------------------------------------------------------------------------
// Log line renderer
// ---------------------------------------------------------------------------

function colorFor(line: string): string {
  if (line.startsWith("═") || line.startsWith("BUILD ") || line.startsWith("IMPL")) return "#f59e0b";
  if (/^\[(\d+)\/\d+\]/.test(line) || /^> /.test(line)) return "rgba(250,250,250,0.85)";
  if (line.startsWith("✓")) return "var(--accent)";
  if (line.startsWith("✗") || line.includes("[error") || line.includes("FAILED")) return "#ef4444";
  if (line.startsWith("  →")) return "rgba(250,250,250,0.80)";
  if (/http:\/\/localhost:\d+/.test(line)) return "var(--accent)";
  return "rgba(250,250,250,0.58)";
}

// ---------------------------------------------------------------------------
// Build row component
// ---------------------------------------------------------------------------

function BuildRow({ build, onStopDev, onStartDev, onDelete, onRename }: {
  build: BuildEntry;
  onStopDev: (id: string) => void;
  onStartDev: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(statusIsActive(build.status));
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(build.title);
  const logEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const prevStatusRef = useRef(build.status);

  useEffect(() => { setEditValue(build.title); }, [build.title]);

  function startEdit(e: { stopPropagation(): void }) {
    e.stopPropagation();
    setEditValue(build.title);
    setEditing(true);
    setTimeout(() => editInputRef.current?.select(), 0);
  }

  function commitEdit() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== build.title) onRename(build.id, trimmed);
    setEditing(false);
  }

  function cancelEdit() {
    setEditValue(build.title);
    setEditing(false);
  }

  // auto-expand when status changes to active
  useEffect(() => {
    if (statusIsActive(build.status) && prevStatusRef.current !== build.status) {
      setExpanded(true);
    }
    prevStatusRef.current = build.status;
  }, [build.status]);

  // auto-scroll when expanded + running
  useEffect(() => {
    if (expanded && statusIsActive(build.status)) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [build.logs.length, expanded, build.status]);

  const [tick, setTick] = useState(0);
  const lastLogAt = useRef<number>(Date.now());
  const prevLogsLen = useRef(build.logs.length);

  if (build.logs.length !== prevLogsLen.current) {
    lastLogAt.current = Date.now();
    prevLogsLen.current = build.logs.length;
  }

  useEffect(() => {
    if (!statusIsActive(build.status)) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [build.status]);

  // Countdown to auto-resume for rate-limited builds
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (build.status !== "rate-limited" || !build.rateResetAt) {
      setResumeCountdown(null);
      return;
    }
    const update = () => {
      const remaining = Math.ceil((build.rateResetAt! - Date.now()) / 1000);
      if (remaining <= 0) {
        setResumeCountdown(0);
        fetch(`/api/builds/resume?buildId=${build.id}`).catch(() => { });
      } else {
        setResumeCountdown(remaining);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [build.status, build.rateResetAt, build.id]);

  const dotColor = STATUS_DOT[build.status];
  const label = STATUS_LABEL[build.status];
  const isActive = statusIsActive(build.status);
  const logs = build.logs;

  return (
    <div style={{
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Header row */}
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "14px 20px", cursor: "pointer",
          background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
          transition: "background 0.1s",
        }}
      >
        {/* Expand chevron */}
        <span style={{ color: "var(--border)", flexShrink: 0 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>

        {/* Status dot */}
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: dotColor,
          flexShrink: 0,
          boxShadow: isActive ? `0 0 6px ${dotColor}` : "none",
          animation: isActive ? "pulse 1.5s ease-in-out infinite" : "none",
        }} />

        {/* Title - inline editable */}
        <div
          className="project-title-wrapper"
          style={{ flex: 1, display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}
        >
          {editing ? (
            <input
              ref={editInputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
              }}
              onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid var(--accent)",
                color: "var(--fg)", fontSize: "0.88rem", fontWeight: 500, fontFamily: "inherit",
                padding: "2px 6px", outline: "none", minWidth: 0,
              }}
            />
          ) : (
            <>
              <span style={{ fontSize: "0.88rem", fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {build.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={startEdit}
                className="edit-pencil-btn"
                style={{
                  color: "rgba(250,250,250,0.38)", padding: "0 2px",
                  flexShrink: 0, height: "auto",
                  opacity: 0, transition: "opacity 0.1s",
                }}
              >
                <Pencil size={10} />
              </Button>
            </>
          )}
        </div>

        {/* Status label */}
        <span style={{
          fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: dotColor, minWidth: "80px", textAlign: "right",
        }}>
          {label}
        </span>

        {/* Rate limit info */}
        {build.status === "rate-limited" && (
          <span style={{ fontSize: "0.76rem", color: "#f59e0b", letterSpacing: "0.04em", minWidth: "180px", textAlign: "right" }}>
            {resumeCountdown !== null && resumeCountdown > 0
              ? `auto-resume in ${Math.floor(resumeCountdown / 60)}m ${resumeCountdown % 60}s`
              : build.rateResetLabel
                ? `resets ${build.rateResetLabel}`
                : "rate limited"}
          </span>
        )}

        {/* Elapsed */}
        <span style={{
          fontSize: "0.88rem", color: "rgba(250,250,250,0.52)",
          fontVariantNumeric: "tabular-nums", minWidth: "48px", textAlign: "right",
          display: tick >= 0 ? "block" : "block",
        }}>
          {elapsed(build.startedAt, build.endedAt)}
        </span>

        {/* Last log activity - only shown when active */}
        {isActive && (() => {
          const silentSec = Math.floor((Date.now() - lastLogAt.current) / 1000);
          const isStale = silentSec >= 30;
          return (
            <span style={{
              fontSize: "0.73rem", fontVariantNumeric: "tabular-nums",
              minWidth: "72px", textAlign: "right",
              color: isStale ? "#f59e0b" : "rgba(250,250,250,0.45)",
              fontWeight: isStale ? 700 : 400,
            }}>
              {silentSec < 5 ? "active" : `silent ${silentSec}s`}
            </span>
          );
        })()}

        {/* Log count */}
        <span style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.45)", minWidth: "48px", textAlign: "right" }}>
          {logs.length} lines
        </span>

        {/* Actions */}
        <div
          style={{ display: "flex", gap: "8px", flexShrink: 0, marginLeft: "8px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Delete build */}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const ok = await confirm(`Delete "${build.title}"?`, { variant: "danger", confirmLabel: "Delete" });
              if (ok) onDelete(build.id);
            }}
            style={{
              border: "1px solid rgba(239,68,68,0.2)",
              color: "rgba(239,68,68,0.45)", padding: "3px 7px",
              height: "auto",
            }}
          >
            <Trash2 size={10} />
          </Button>

          {/* View opportunity */}
          <Link
            to="/opportunity/$id"
            params={{ id: String(build.opportunityId) }}
            style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              fontSize: "0.76rem", color: "rgba(250,250,250,0.58)",
              textDecoration: "none", padding: "3px 8px",
              border: "1px solid var(--border)",
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            opp <ExternalLink size={8} />
          </Link>

          {/* Open dev server */}
          {build.status === "dev:ready" && build.devUrl && (
            <a
              href={build.devUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                fontSize: "0.88rem", fontWeight: 700, letterSpacing: "0.08em",
                textTransform: "uppercase", padding: "4px 14px",
                color: "#000", background: "var(--accent)",
                textDecoration: "none", border: "1px solid var(--accent)",
              }}
            >
              <ExternalLink size={10} />
              Open App
            </a>
          )}

          {/* Stop dev server */}
          {(build.status === "dev:ready" || build.status === "dev:starting") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStopDev(build.id)}
              style={{
                gap: "4px",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "rgba(239,68,68,0.6)", padding: "3px 8px",
                fontSize: "0.76rem",
                letterSpacing: "0.06em", textTransform: "uppercase",
                height: "auto",
              }}
            >
              <Square size={8} /> stop
            </Button>
          )}

          {/* Resume rate-limited build */}
          {build.status === "rate-limited" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetch(`/api/builds/resume?buildId=${build.id}`)}
              style={{
                gap: "4px",
                border: "1px solid rgba(245,158,11,0.4)",
                color: "rgba(245,158,11,0.8)", padding: "3px 8px",
                fontSize: "0.76rem",
                letterSpacing: "0.06em", textTransform: "uppercase",
                height: "auto",
              }}
            >
              <Play size={8} /> resume now
            </Button>
          )}

          {/* Start dev server */}
          {build.status === "done" && build.buildDir && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStartDev(build.id)}
              style={{
                gap: "4px",
                border: "1px solid rgba(0,255,136,0.2)",
                color: "rgba(0,255,136,0.6)", padding: "3px 8px",
                fontSize: "0.76rem",
                letterSpacing: "0.06em", textTransform: "uppercase",
                height: "auto",
              }}
            >
              <Play size={8} /> run
            </Button>
          )}
        </div>
      </div>

      {/* Dev URL banner */}
      {build.status === "dev:ready" && build.devUrl && (
        <div style={{
          padding: "8px 20px 8px 52px",
          borderTop: "1px solid rgba(0,255,136,0.1)",
          background: "rgba(0,255,136,0.04)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "0.88rem", color: "rgba(0,255,136,0.5)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Running at
          </span>
          <a
            href={build.devUrl}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
          >
            {build.devUrl}
          </a>
          <span style={{ fontSize: "0.76rem", color: "rgba(250,250,250,0.45)" }}>
            - click to open in new tab
          </span>
        </div>
      )}

      {/* Log panel */}
      {expanded && logs.length > 0 && (
        <div style={{
          margin: "0 20px 16px 44px",
          background: "rgba(0,0,0,0.5)",
          border: "1px solid var(--border)",
          borderLeft: `2px solid ${dotColor}`,
          padding: "12px 14px",
          maxHeight: "360px",
          overflowY: "auto",
          fontFamily: "inherit",
          fontSize: "0.82rem",
          lineHeight: 1.65,
        }}>
          {logs.map((line, i) => (
            <div key={i} style={{ color: colorFor(line), whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}

      {expanded && logs.length === 0 && (
        <div style={{
          margin: "0 20px 16px 44px",
          padding: "12px 14px",
          fontSize: "0.82rem",
          color: "rgba(250,250,250,0.45)",
        }}>
          No logs yet...
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ProjectsPage() {
  const [builds, setBuilds] = useState<BuildEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const applyBuild = useCallback((incoming: BuildEntry) => {
    setBuilds((prev) => {
      const idx = prev.findIndex((b) => b.id === incoming.id);
      if (idx === -1) return [incoming, ...prev];
      const next = [...prev];
      next[idx] = incoming;
      return next;
    });
  }, []);

  useEffect(() => {
    // Load snapshot
    fetch("/api/builds-list")
      .then((r) => r.json())
      .then((list: BuildEntry[]) => setBuilds(list))
      .catch(() => { });

    // Subscribe to stream
    function connect() {
      const es = new EventSource("/api/builds-stream");
      esRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(connect, 3000); // reconnect after 3s
      };
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.build) applyBuild(msg.build);
          if (msg.deleted) setBuilds((prev) => prev.filter((b) => b.id !== msg.deleted));
        } catch { }
      };
    }
    connect();

    return () => { esRef.current?.close(); };
  }, [applyBuild]);

  async function stopDev(buildId: string) {
    await fetch(`/api/builds/stop-dev?buildId=${buildId}`);
  }

  async function startDev(buildId: string) {
    await fetch(`/api/builds/start-dev?buildId=${buildId}`);
  }

  async function deleteBuild(buildId: string) {
    setBuilds((prev) => prev.filter((b) => b.id !== buildId));
    await fetch(`/api/builds/delete?buildId=${buildId}`);
  }

  async function renameBuild(buildId: string, title: string) {
    await fetch("/api/builds/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildId, title }),
    });
  }

  const running = builds.filter((b) => statusIsActive(b.status));
  const live = builds.filter((b) => b.status === "dev:ready");

  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "0 20px", height: "44px", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
      }}>
        <span style={{ fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(250,250,250,0.68)" }}>
          Projects
        </span>

        <div style={{ display: "flex", gap: "12px" }}>
          {running.length > 0 && (
            <span style={{ fontSize: "0.76rem", color: "#f59e0b", letterSpacing: "0.06em" }}>
              {running.length} running
            </span>
          )}
          {live.length > 0 && (
            <span style={{ fontSize: "0.76rem", color: "var(--accent)", letterSpacing: "0.06em" }}>
              {live.length} live
            </span>
          )}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "var(--accent)" : "#ef4444",
            boxShadow: connected ? "0 0 4px var(--accent)" : "none",
          }} />
          <span style={{ fontSize: "0.73rem", color: "rgba(250,250,250,0.52)", letterSpacing: "0.06em" }}>
            {connected ? "connected" : "reconnecting..."}
          </span>
        </div>
      </div>

      {/* Build list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {builds.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <p style={{ color: "rgba(250,250,250,0.45)", fontSize: "0.82rem", marginBottom: "8px" }}>
              No builds yet.
            </p>
            <p style={{ color: "rgba(250,250,250,0.30)", fontSize: "0.84rem" }}>
              Click "Build" on any opportunity to start the pipeline.
            </p>
          </div>
        ) : (
          builds.map((b) => (
            <BuildRow
              key={b.id}
              build={b}
              onStopDev={stopDev}
              onStartDev={startDev}
              onDelete={deleteBuild}
              onRename={renameBuild}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
