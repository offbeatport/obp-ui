import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { RunLogView, STATUS_VARIANT } from "~/components/run-log";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
    approveAction,
    enqueueDemo,
    listActionRuns,
    listQueue,
    rejectAction,
    resetDemo,
} from "~/server/actions";

export const Route = createFileRoute("/admin/queue")({
    component: QueuePage,
});

type QueueState = Awaited<ReturnType<typeof listQueue>>;

function QueuePage() {
    const [state, setState] = useState<QueueState | null>(null);
    const [busy, setBusy] = useState(false);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    // Pinned = you clicked a row; stops the newest-run auto-follow from stealing the view.
    const [pinned, setPinned] = useState(false);

    const refresh = useCallback(async () => {
        setState(await listQueue());
    }, []);

    useEffect(() => {
        void refresh();
        const iv = setInterval(refresh, 1000);
        return () => clearInterval(iv);
    }, [refresh]);

    useEffect(() => {
        if (pinned) return;
        const newest = state?.runs[0]?.id ?? null;
        if (newest && newest !== activeRunId) setActiveRunId(newest);
    }, [state, activeRunId, pinned]);

    const select = (runId: string) => {
        setPinned(true);
        setActiveRunId(runId);
    };
    // Actions don't carry a run id - resolve the newest attempt, then show its log.
    const selectAction = async (actionId: string) => {
        const h = await listActionRuns({ data: actionId });
        if (h.runs[0]) select(h.runs[0].id);
    };

    const doEnqueue = async () => {
        setBusy(true);
        try {
            await enqueueDemo();
            setPinned(false);
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
            setPinned(false);
            await refresh();
        } finally {
            setBusy(false);
        }
    };
    const doApprove = async (actionId: string) => {
        await approveAction({ data: actionId });
        await refresh();
    };
    const doReject = async (actionId: string) => {
        const feedback = window.prompt("Reject - feedback for the next attempt (optional):") ?? "";
        await rejectAction({ data: { actionId, feedback } });
        await refresh();
    };

    const companyName = (id: string) =>
        state?.companies.find((c) => c.id === id)?.name ?? id.slice(0, 8);

    return (
        <>
            <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    run-executor spine · click a row to watch its log
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
                        <div
                            key={a.id}
                            className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm"
                        >
                            <button
                                type="button"
                                onClick={() => void selectAction(a.id)}
                                className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
                                title="View this action's run log"
                            >
                                <Badge
                                    variant={STATUS_VARIANT[a.status] ?? "neutral"}
                                    className="w-28 justify-start"
                                >
                                    {a.status}
                                </Badge>
                                <span className="flex-1 truncate">{a.title}</span>
                            </button>
                            {a.status === "awaiting_approval" && (
                                <span className="flex gap-1.5">
                                    <Button
                                        size="xs"
                                        variant="success"
                                        onClick={() => void doApprove(a.id)}
                                    >
                                        Approve
                                    </Button>
                                    <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => void doReject(a.id)}
                                    >
                                        Reject
                                    </Button>
                                </span>
                            )}
                            <span className="font-mono text-xs text-faint">{a.type}</span>
                            <span className="w-24 text-right text-xs text-faint">
                                {companyName(a.companyId)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <Empty>Queue empty - enqueue the demo action to drive the executor.</Empty>
            )}

            <SectionLabel>Live runs</SectionLabel>
            {state?.runs.length ? (
                <div className="flex flex-col gap-1.5">
                    {state.runs.map((r) => (
                        <Row key={r.id} active={r.id === activeRunId} onClick={() => select(r.id)}>
                            <Badge
                                variant={STATUS_VARIANT[r.status] ?? "neutral"}
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

            <div className="mt-8 mb-2.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
                    {activeRunId ? `Run log · ${activeRunId.slice(0, 8)}` : "Run log"}
                </span>
                {pinned && (
                    <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                            setPinned(false);
                            setActiveRunId(state?.runs[0]?.id ?? null);
                        }}
                    >
                        Follow latest
                    </Button>
                )}
            </div>
            <RunLogView runId={activeRunId} className="h-56" />
        </>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="mb-2.5 mt-8 text-[11px] font-semibold uppercase tracking-[0.1em] text-faint">
            {children}
        </div>
    );
}

function Row({
    children,
    onClick,
    active,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
                active ? "border-primary bg-accent" : "bg-card"
            }`}
        >
            {children}
        </button>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <div className="px-1 py-2 text-xs text-faint">{children}</div>;
}
