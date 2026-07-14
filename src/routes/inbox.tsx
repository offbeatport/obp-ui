import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "~/components/app-shell";
import { TONE_VAR } from "~/components/command-center/tone";
import { approveAction, rejectAction } from "~/server/actions";
import { type InboxItem, listInbox } from "~/server/data";
import "~/components/command-center/proto.css";

// The needs-you inbox — every action awaiting your call. Wired to listInbox() with real
// Approve/Reject controls (was a dead placeholder). Lane: surfaces.
export const Route = createFileRoute("/inbox")({
    loader: async () => ({ items: await listInbox() }),
    component: Inbox,
});

const KIND: Record<InboxItem["kind"], string> = {
    approval: "Awaiting approval",
    blocked: "Blocked",
    decision: "Decision",
};

function Inbox() {
    const { items } = Route.useLoaderData();
    const router = useRouter();

    // Poll so shipped/blocked items clear (and new ones arrive) without a manual reload.
    useEffect(() => {
        const t = setInterval(() => void router.invalidate(), 3000);
        return () => clearInterval(t);
    }, [router]);

    const approve = async (id: string) => {
        await approveAction({ data: id });
        await router.invalidate();
    };
    const reject = async (id: string) => {
        const feedback = window.prompt("Reject — what should change on the next attempt?") ?? "";
        await rejectAction({ data: { actionId: id, feedback } });
        await router.invalidate();
    };

    return (
        <AppShell active="inbox">
            <div className="mx-auto max-w-3xl px-6 py-10">
                <div className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-faint">
                    {"// Inbox"}
                </div>
                <h1 className="font-display text-3xl font-light tracking-tight">Needs you</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Approvals, blocks and decisions waiting on your call.
                </p>

                {items.length === 0 ? (
                    <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        Nothing needs you right now — the agents are running clear.
                    </div>
                ) : (
                    <div className="mt-6 space-y-2.5">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-start gap-3 rounded-xl border bg-card p-3.5"
                            >
                                <span
                                    className="grid size-9 flex-none place-items-center rounded-lg font-display text-sm font-bold text-white"
                                    style={{ background: TONE_VAR[item.tone] }}
                                >
                                    {item.companyName.charAt(0)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            to="/companies/$slug"
                                            params={{ slug: item.companyId }}
                                            className="truncate text-sm font-semibold hover:underline"
                                        >
                                            {item.companyName}
                                        </Link>
                                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-foreground">
                                            {KIND[item.kind]}
                                        </span>
                                    </div>
                                    <div className="mt-0.5 text-sm">{item.title}</div>
                                    <div className="text-xs text-muted-foreground">{item.sub}</div>
                                </div>
                                <div className="flex flex-none gap-1.5">
                                    {item.kind === "approval" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => void reject(item.id)}
                                                className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:border-destructive hover:text-destructive"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void approve(item.id)}
                                                className="rounded-md bg-success px-2.5 py-1.5 text-xs font-semibold text-success-foreground hover:brightness-105"
                                            >
                                                Approve &amp; ship
                                            </button>
                                        </>
                                    ) : (
                                        <Link
                                            to="/companies/$slug"
                                            params={{ slug: item.companyId }}
                                            className="rounded-md border px-2.5 py-1.5 text-xs font-medium hover:border-primary hover:text-primary"
                                        >
                                            Review →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
