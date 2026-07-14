import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RunLogView, STATUS_VARIANT, ago } from "~/components/run-log";
import { Badge } from "~/components/ui/badge";
import { listActionRuns, listQueue } from "~/server/actions";

export const Route = createFileRoute("/admin/runs")({
    component: Runs,
});

type QueueState = Awaited<ReturnType<typeof listQueue>>;
type History = Awaited<ReturnType<typeof listActionRuns>>;

function Runs() {
    const [q, setQ] = useState<QueueState | null>(null);
    const [openAction, setOpenAction] = useState<string | null>(null);
    const [history, setHistory] = useState<History | null>(null);
    const [runId, setRunId] = useState<string | null>(null);

    // Actions (all statuses — listQueue.actions is unfiltered).
    useEffect(() => {
        const load = () => listQueue().then(setQ);
        void load();
        const iv = setInterval(load, 2000);
        return () => clearInterval(iv);
    }, []);

    // Run history for the opened action; poll while open so live attempts refresh.
    const loadHistory = useCallback(async (actionId: string) => {
        setHistory(await listActionRuns({ data: actionId }));
    }, []);
    useEffect(() => {
        if (!openAction) {
            setHistory(null);
            return;
        }
        void loadHistory(openAction);
        const iv = setInterval(() => void loadHistory(openAction), 1500);
        return () => clearInterval(iv);
    }, [openAction, loadHistory]);

    const companyName = (id: string) =>
        q?.companies.find((c) => c.id === id)?.name ?? id.slice(0, 8);

    const toggle = (actionId: string) => {
        setRunId(null);
        setOpenAction((cur) => (cur === actionId ? null : actionId));
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
                <SectionLabel>Actions & their runs</SectionLabel>
                {q?.actions.length ? (
                    <div className="flex flex-col gap-1.5">
                        {q.actions.map((a) => (
                            <div key={a.id} className="rounded-xl border bg-card">
                                <button
                                    type="button"
                                    onClick={() => toggle(a.id)}
                                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-accent ${
                                        openAction === a.id ? "bg-accent" : ""
                                    }`}
                                >
                                    <Badge
                                        variant={STATUS_VARIANT[a.status] ?? "neutral"}
                                        className="w-28 justify-start"
                                    >
                                        {a.status}
                                    </Badge>
                                    <span className="flex-1 truncate">{a.title}</span>
                                    <span className="w-24 text-right text-xs text-faint">
                                        {companyName(a.companyId)}
                                    </span>
                                </button>

                                {openAction === a.id && (
                                    <div className="border-t px-2 py-2">
                                        {history?.runs.length ? (
                                            <div className="flex flex-col gap-1">
                                                {history.runs.map((r) => (
                                                    <button
                                                        key={r.id}
                                                        type="button"
                                                        onClick={() => setRunId(r.id)}
                                                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent ${
                                                            runId === r.id
                                                                ? "bg-accent ring-1 ring-primary"
                                                                : ""
                                                        }`}
                                                    >
                                                        <Badge
                                                            variant={
                                                                STATUS_VARIANT[r.status] ??
                                                                "neutral"
                                                            }
                                                            className="w-24 justify-start"
                                                        >
                                                            {r.status}
                                                        </Badge>
                                                        <span className="text-faint">
                                                            attempt {r.attempt}
                                                        </span>
                                                        {r.costUsd > 0 && (
                                                            <span className="text-faint">
                                                                ${r.costUsd.toFixed(4)}
                                                            </span>
                                                        )}
                                                        <span className="ml-auto text-faint">
                                                            {ago(r.createdAt)}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="px-2 py-1.5 text-xs text-faint">
                                                No runs yet for this action.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <Empty>No actions yet — enqueue one from the Queue tab.</Empty>
                )}
            </div>

            <div>
                <div className="mb-2.5 mt-8 flex items-center justify-between lg:mt-0">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                        {runId ? `Run log · ${runId.slice(0, 8)}` : "Run log"}
                    </span>
                    {history?.previewUrl && (
                        <a
                            href={history.previewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                        >
                            Open live app ↗
                        </a>
                    )}
                </div>
                <RunLogView runId={runId} className="h-[28rem]" />
            </div>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {children}
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <div className="px-1 py-2 text-xs text-faint">{children}</div>;
}
