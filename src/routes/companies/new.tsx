import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "~/components/app-shell";
import { GuardrailMenu } from "~/components/guardrail-menu";
import {
    CreatingView,
    FailedView,
    ProposalsView,
    ScoutingView,
    SpecView,
    SpecingView,
} from "~/components/spin-views";
import { Textarea } from "~/components/ui/textarea";
import { commitDraft, pickOpportunity, reSpin, resetPick, startSpin } from "~/server/actions";
import { getBootState } from "~/server/agents";
import { getDraft } from "~/server/data";

// A few evocative starters for "Surprise me" — the client picks one when the founder wants the
// agent to choose the bet. (Random is fine in a browser component; not a workflow script.)
const LUCKY_THOUGHTS = [
    "help freelancers get paid on time",
    "a tiny tool that saves indie makers an hour a week",
    "turn messy CSVs into clean dashboards",
    "help small Shopify stores cut refund fraud",
    "auto-summarize long meeting recordings into action items",
    "a calm way for tutors to schedule and bill students",
];

export const Route = createFileRoute("/companies/new")({
    // ?draft=<id> drives the whole flow: absent → composer; present → the spin session's
    // current state (scouting → proposals → spec → committed), polled live.
    validateSearch: (s: Record<string, unknown>): { draft?: string } => ({
        draft: typeof s.draft === "string" ? s.draft : undefined,
    }),
    beforeLoad: async () => {
        const boot = await getBootState();
        if (boot.deployment === "self-host" && !boot.onboarded) {
            throw redirect({ to: "/onboarding" });
        }
    },
    loaderDeps: ({ search }) => ({ draft: search.draft }),
    loader: async ({ deps }) => ({
        draft: deps.draft ? await getDraft({ data: deps.draft }) : null,
    }),
    component: SpinCompany,
});

// The "spin up a company" chat: thought → scouted opportunities → pick → company spec + branding
// → create. Web fns only flip draft status; the engine's spin passes (src/engine/spin.ts) do the
// AI and fill draft.data, which this page polls via getDraft. Mirrors the prototype SPIN flow.
function SpinCompany() {
    const navigate = useNavigate();
    const router = useRouter();
    const { draft: draftId } = Route.useSearch();
    const { draft } = Route.useLoaderData();
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);

    // Poll only while the engine is actively working a pass (scouting / specing) — proposals and
    // spec are settled states that wait on the founder, so they don't need to poll.
    const working = draft?.status === "scouting" || draft?.status === "specing";
    useEffect(() => {
        if (!working) return;
        const t = setInterval(() => void router.invalidate(), 2000);
        return () => clearInterval(t);
    }, [working, router]);

    // Reload landed on an already-committed draft → jump to its company.
    useEffect(() => {
        if (draft?.status === "committed" && draft.companyId) {
            navigate({ to: "/companies/$slug", params: { slug: draft.companyId } });
        }
    }, [draft?.status, draft?.companyId, navigate]);

    const start = useCallback(
        async (thought: string, preset: string) => {
            const t = thought.trim();
            if (!t || busy) return;
            setBusy(true);
            try {
                const { id } = await startSpin({ data: { thought: t, preset } });
                await navigate({ to: "/companies/new", search: { draft: id } });
            } finally {
                setBusy(false);
            }
        },
        [busy, navigate],
    );

    const pick = useCallback(
        async (candidateId: string) => {
            if (!draftId || busy) return;
            setBusy(true);
            try {
                await pickOpportunity({ data: { draftId, candidateId } });
                await router.invalidate();
            } finally {
                setBusy(false);
            }
        },
        [draftId, busy, router],
    );

    const reroll = useCallback(async () => {
        if (!draftId || busy) return;
        setBusy(true);
        try {
            await reSpin({ data: { draftId } });
            await router.invalidate();
        } finally {
            setBusy(false);
        }
    }, [draftId, busy, router]);

    const back = useCallback(async () => {
        if (!draftId || busy) return;
        setBusy(true);
        try {
            await resetPick({ data: { draftId } });
            await router.invalidate();
        } finally {
            setBusy(false);
        }
    }, [draftId, busy, router]);

    const create = useCallback(async () => {
        if (!draftId || creating) return;
        setCreating(true);
        // Let the 5-step create animation (5 × 720ms ≈ 3.6s) play while the (fast) commit write
        // runs, so the reveal never feels instant.
        const [res] = await Promise.all([
            commitDraft({ data: { draftId } }),
            new Promise((r) => setTimeout(r, 3700)),
        ]);
        if (res.ok && res.id) {
            navigate({ to: "/companies/$slug", params: { slug: res.id } });
        } else {
            setCreating(false); // commit failed (stale state) — let the founder retry
        }
    }, [draftId, creating, navigate]);

    // ---- creating overlay wins over everything ----
    if (creating) {
        return (
            <AppShell active="companies">
                <CreatingView product={draft?.spec?.product ?? "your company"} />
            </AppShell>
        );
    }

    // ---- composer (no draft yet, or a stale/missing draft id) ----
    if (!draftId || !draft || draft.status === "committed") {
        return (
            <AppShell active="companies">
                <Composer onStart={start} busy={busy} />
            </AppShell>
        );
    }

    // ---- active spin session ----
    return (
        <AppShell active="companies">
            <div className="mx-auto flex min-h-full max-w-2xl flex-col px-6 py-10">
                <header className="mb-6">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Thought → Company"}
                    </div>
                    <h1 className="mt-1 font-display text-2xl font-light tracking-tight">
                        Start your new AI company
                    </h1>
                    <p className="mt-1 truncate text-sm text-muted-foreground">“{draft.thought}”</p>
                </header>

                {draft.status === "scouting" && <ScoutingView thought={draft.thought} />}
                {draft.status === "proposals" && (
                    <ProposalsView
                        candidates={draft.candidates}
                        onPick={pick}
                        onReroll={reroll}
                        busy={busy}
                    />
                )}
                {draft.status === "specing" && (
                    <SpecingView
                        name={
                            draft.candidates.find((c) => c.id === draft.pickedId)?.name ??
                            "your pick"
                        }
                    />
                )}
                {draft.status === "spec" && (
                    <SpecView draft={draft} onCreate={create} onBack={back} busy={busy} />
                )}
                {draft.status === "failed" && <FailedView onRetry={reroll} busy={busy} />}
            </div>
        </AppShell>
    );
}

// The start screen: hero + thought box with an inline guardrail preset, send, and "Surprise me".
function Composer({
    onStart,
    busy,
}: {
    onStart: (thought: string, preset: string) => void;
    busy: boolean;
}) {
    const [thought, setThought] = useState("");
    const [preset, setPreset] = useState("lean");

    const lucky = () => {
        const t = LUCKY_THOUGHTS[Math.floor(Math.random() * LUCKY_THOUGHTS.length)];
        onStart(t, "lean");
    };

    return (
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-16">
            <div className="mb-2 text-center font-mono text-xs uppercase tracking-[0.14em] text-faint">
                {"// Thought → Company"}
            </div>
            <h1 className="text-center font-display text-4xl font-light tracking-tight">
                Start your new AI company
            </h1>
            <p className="mt-4 text-center text-lg text-muted-foreground">
                Tell me a thought — I’ll scout the opportunities and draft the company.
            </p>

            <div className="mt-9 rounded-[1.25rem] border bg-card p-2 shadow-e1 transition focus-within:ring-2 focus-within:ring-primary/50">
                <Textarea
                    value={thought}
                    onChange={(e) => setThought(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onStart(thought, preset);
                        }
                    }}
                    placeholder="What are you passionate about?"
                    className="min-h-24 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <div className="flex items-center justify-between px-2 pb-1">
                    <GuardrailMenu value={preset} onChange={setPreset} />
                    <button
                        type="button"
                        onClick={() => onStart(thought, preset)}
                        disabled={busy || !thought.trim()}
                        aria-label="Spin up"
                        className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                    >
                        {busy ? (
                            <Loader2 className="size-5 animate-spin" />
                        ) : (
                            <ArrowUp className="size-5" />
                        )}
                    </button>
                </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                    or
                </span>
                <button
                    type="button"
                    onClick={lucky}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:brightness-95 active:scale-95 disabled:opacity-40"
                >
                    <Sparkles className="size-4" />
                    Surprise me
                </button>
            </div>
        </div>
    );
}
