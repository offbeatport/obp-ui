import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueDemo, listQueue, resetDemo } from "../server/actions";

export const Route = createFileRoute("/")({
  component: Home,
});

type QueueState = Awaited<ReturnType<typeof listQueue>>;
type LogLine = { t: number; type: string; msg?: string; status?: string; error?: string };

const STATUS_COLOR: Record<string, string> = {
  queued: "var(--muted)",
  running: "var(--accent)",
  awaiting_approval: "var(--warning)",
  approved: "var(--purple)",
  done: "var(--success)",
  blocked: "var(--danger)",
  succeeded: "var(--success)",
  failed: "var(--danger)",
  cancelled: "var(--muted)",
};

function Home() {
  const [state, setState] = useState<QueueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setState(await listQueue());
  }, []);

  // Poll the queue every second.
  useEffect(() => {
    void refresh();
    const iv = setInterval(refresh, 1000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Latch onto the newest live run for log streaming.
  useEffect(() => {
    const newest = state?.runs[0]?.id ?? null;
    if (newest && newest !== activeRunId) setActiveRunId(newest);
  }, [state, activeRunId]);

  // Stream the active run's logs over SSE; resumes from offset on reconnect.
  useEffect(() => {
    if (!activeRunId) return;
    setLogs([]);
    const es = new EventSource(`/api/runs/${activeRunId}/logs`);
    es.onmessage = (e) => {
      try {
        const line = JSON.parse(e.data) as LogLine;
        setLogs((prev) => [...prev, line]);
        if (line.type === "end") es.close();
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnects with Last-Event-ID */
    };
    return () => es.close();
  }, [activeRunId]);

  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const doEnqueue = async () => {
    setBusy(true);
    try {
      await enqueueDemo();
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  const doReset = async () => {
    setBusy(true);
    try {
      await resetDemo();
      setActiveRunId(null);
      setLogs([]);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const companyName = (id: string) =>
    state?.companies.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "40px 24px 80px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Action Queue</h2>
          <p style={{ margin: "6px 0 0", color: "var(--fg-subtle)", fontSize: 12 }}>
            run-executor spine · control plane (NO-OP harness)
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={doEnqueue} disabled={busy} kind="primary">
            + Enqueue demo action
          </Btn>
          <Btn onClick={doReset} disabled={busy}>
            Reset
          </Btn>
        </div>
      </header>

      <Section title="Actions">
        {state?.actions.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {state.actions.map((a) => (
              <Row key={a.id}>
                <Pill status={a.status} />
                <span style={{ flex: 1, color: "var(--fg-muted)" }}>{a.title}</span>
                <span style={{ color: "var(--fg-dim)", fontSize: 11 }}>{a.type}</span>
                <span
                  style={{ color: "var(--fg-dim)", fontSize: 11, width: 90, textAlign: "right" }}
                >
                  {companyName(a.companyId)}
                </span>
              </Row>
            ))}
          </div>
        ) : (
          <Empty>Queue empty — enqueue the demo action to drive the executor.</Empty>
        )}
      </Section>

      <Section title="Live runs">
        {state?.runs.length ? (
          state.runs.map((r) => (
            <Row key={r.id}>
              <Pill status={r.status} />
              <span style={{ flex: 1, color: "var(--fg-dim)", fontSize: 11 }}>{r.id}</span>
              <span style={{ color: "var(--fg-dim)", fontSize: 11 }}>attempt {r.attempt}</span>
            </Row>
          ))
        ) : (
          <Empty>No active runs.</Empty>
        )}
      </Section>

      <Section title={activeRunId ? `Run log · ${activeRunId.slice(0, 8)}` : "Run log"}>
        <div
          ref={logBoxRef}
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 12,
            height: 220,
            overflowY: "auto",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          {logs.length ? (
            logs.map((l, i) => (
              <div key={`${l.t}-${i}`} style={{ color: logColor(l), whiteSpace: "pre-wrap" }}>
                <span style={{ color: "var(--fg-faint)", marginRight: 8 }}>
                  {new Date(l.t).toLocaleTimeString()}
                </span>
                {l.type === "end" ? `▪ run ${l.status}${l.error ? `: ${l.error}` : ""}` : l.msg}
              </div>
            ))
          ) : (
            <span style={{ color: "var(--fg-faint)" }}>waiting for a run…</span>
          )}
        </div>
      </Section>
    </div>
  );
}

function logColor(l: LogLine): string {
  if (l.type === "status") return "var(--accent)";
  if (l.type === "end") return STATUS_COLOR[l.status ?? ""] ?? "var(--fg-muted)";
  return "var(--fg-subtle)";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--fg-dim)",
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "var(--muted)";
  const live = status === "running";
  return (
    <span
      className={live ? "pulse" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color,
        fontSize: 11,
        width: 132,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {status}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--fg-faint)", fontSize: 12, padding: "8px 2px" }}>{children}</div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  kind,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  kind?: "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        padding: "7px 12px",
        borderRadius: "var(--radius)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        color: kind === "primary" ? "#050d1e" : "var(--fg-muted)",
        background: kind === "primary" ? "var(--accent)" : "transparent",
        border: `1px solid ${kind === "primary" ? "var(--accent)" : "var(--border-strong)"}`,
      }}
    >
      {children}
    </button>
  );
}
