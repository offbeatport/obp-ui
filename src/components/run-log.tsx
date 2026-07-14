import { useEffect, useRef, useState } from "react";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";

// One NDJSON log line as streamed by the executor (see src/engine/log.ts).
export type LogLine = {
    t: number;
    type: string;
    msg?: string;
    stream?: "stdout" | "stderr";
    status?: string;
    error?: string;
};

// action/run status → Badge variant — the shared status language across queue + runs.
export const STATUS_VARIANT: Record<
    string,
    "neutral" | "info" | "approval" | "success" | "destructive"
> = {
    queued: "neutral",
    running: "info",
    awaiting_approval: "approval",
    approved: "approval",
    done: "success",
    blocked: "destructive",
    succeeded: "success",
    failed: "destructive",
    cancelled: "neutral",
};

// Live-tail a run's log over SSE (`/api/runs/<id>/logs`). Re-subscribes when runId changes;
// the endpoint replays the whole file, so selecting a finished run shows its complete log.
export function RunLogView({ runId, className }: { runId: string | null; className?: string }) {
    const [logs, setLogs] = useState<LogLine[]>([]);
    const boxRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setLogs([]);
        if (!runId) return;
        const es = new EventSource(`/api/runs/${runId}/logs`);
        es.onmessage = (e) => {
            try {
                const line = JSON.parse(e.data) as LogLine;
                setLogs((prev) => [...prev, line]);
                if (line.type === "end") es.close();
            } catch {
                /* ignore non-JSON keep-alives */
            }
        };
        return () => es.close();
    }, [runId]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new lines
    useEffect(() => {
        const el = boxRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [logs]);

    return (
        <Card
            ref={boxRef}
            className={cn(
                "gap-0 overflow-y-auto rounded-xl border bg-secondary p-3 font-mono text-xs leading-relaxed",
                className,
            )}
        >
            {runId && logs.length ? (
                logs.map((l, i) => (
                    <div key={`${l.t}-${i}`} className={lineClass(l)}>
                        <span className="mr-2 text-faint">
                            {new Date(l.t).toLocaleTimeString()}
                        </span>
                        {l.type === "end"
                            ? `▪ run ${l.status}${l.error ? `: ${l.error}` : ""}`
                            : l.msg}
                    </div>
                ))
            ) : (
                <span className="text-faint">{runId ? "waiting for output…" : "select a run"}</span>
            )}
        </Card>
    );
}

function lineClass(l: LogLine): string {
    if (l.type === "status") return "text-primary";
    if (l.type === "end") return l.status === "succeeded" ? "text-success" : "text-destructive";
    if (l.stream === "stderr") return "text-warning";
    return "text-muted-foreground";
}

// Compact relative time for run rows.
export function ago(ts: number): string {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 5) return "now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}
