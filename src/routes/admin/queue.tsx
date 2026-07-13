import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { enqueueDemo, listQueue, resetDemo } from "~/server/actions";

export const Route = createFileRoute("/admin/queue")({
    component: QueuePage,
});

type QueueState = Awaited<ReturnType<typeof listQueue>>;
type LogLine = { t: number; type: string; msg?: string; status?: string; error?: string };

// action/run status → Badge variant (the shared status language)
const VARIANT: Record<string, "neutral" | "info" | "approval" | "success" | "destructive"> = {
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

function QueuePage() {
    const [state, setState] = useState<QueueState | null>(null);
    const [busy, setBusy] = useState(false);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogLine[]>([]);
    const logBoxRef = useRef<HTMLDivElement | null>(null);

    const refresh = useCallback(async () => {
        setState(await listQueue());
    }, []);

    useEffect(() => {
        void refresh();
        const iv = setInterval(refresh, 1000);
        return () => clearInterval(iv);
    }, [refresh]);

    useEffect(() => {
        const newest = state?.runs[0]?.id ?? null;
        if (newest && newest !== activeRunId) setActiveRunId(newest);
    }, [state, activeRunId]);

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
        return () => es.close();
    }, [activeRunId]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new log lines
    useEffect(() => {
        const el = logBoxRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [logs]);

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
        <>
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    run-executor spine · control plane (NO-OP harness)
                </p>
                <div className="flex gap-2">
                    <Button onClick={doEnqueue} disabled={busy}>
                        + Enqueue demo action
                    </Button>
                    <Button variant="outline" onClick={doReset} disabled={busy}>
                        Reset
                    </Button>
                </div>
            </div>

            <SectionLabel>Actions</SectionLabel>
            {state?.actions.length ? (
                <div className="flex flex-col gap-1.5">
                    {state.actions.map((a) => (
                        <Row key={a.id}>
                            <Badge
                                variant={VARIANT[a.status] ?? "neutral"}
                                className="w-28 justify-start"
                            >
                                {a.status}
                            </Badge>
                            <span className="flex-1 truncate">{a.title}</span>
                            <span className="font-mono text-xs text-faint">{a.type}</span>
                            <span className="w-24 text-right text-xs text-faint">
                                {companyName(a.companyId)}
                            </span>
                        </Row>
                    ))}
                </div>
            ) : (
                <Empty>Queue empty — enqueue the demo action to drive the executor.</Empty>
            )}

            <SectionLabel>Live runs</SectionLabel>
            {state?.runs.length ? (
                <div className="flex flex-col gap-1.5">
                    {state.runs.map((r) => (
                        <Row key={r.id}>
                            <Badge
                                variant={VARIANT[r.status] ?? "neutral"}
                                className="w-28 justify-start"
                            >
                                {r.status}
                            </Badge>
                            <span className="flex-1 truncate font-mono text-xs text-faint">
                                {r.id}
                            </span>
                            <span className="text-xs text-faint">attempt {r.attempt}</span>
                        </Row>
                    ))}
                </div>
            ) : (
                <Empty>No active runs.</Empty>
            )}

            <SectionLabel>
                {activeRunId ? `Run log · ${activeRunId.slice(0, 8)}` : "Run log"}
            </SectionLabel>
            <Card
                ref={logBoxRef}
                className="h-56 gap-0 overflow-y-auto rounded-xl border bg-secondary p-3 font-mono text-xs leading-relaxed"
            >
                {logs.length ? (
                    logs.map((l, i) => (
                        <div key={`${l.t}-${i}`} className={logClass(l)}>
                            <span className="mr-2 text-faint">
                                {new Date(l.t).toLocaleTimeString()}
                            </span>
                            {l.type === "end"
                                ? `▪ run ${l.status}${l.error ? `: ${l.error}` : ""}`
                                : l.msg}
                        </div>
                    ))
                ) : (
                    <span className="text-faint">waiting for a run…</span>
                )}
            </Card>
        </>
    );
}

function logClass(l: LogLine): string {
    if (l.type === "status") return "text-primary";
    if (l.type === "end") return l.status === "succeeded" ? "text-success" : "text-destructive";
    return "text-muted-foreground";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-2.5 mt-8 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {children}
        </div>
    );
}

function Row({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm">
            {children}
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <div className="px-1 py-2 text-xs text-faint">{children}</div>;
}
