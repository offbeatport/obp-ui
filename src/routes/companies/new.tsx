import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { SpinMessage } from "~/config/spin";
import {
    commitDraft,
    messageDraft,
    pickOpportunity,
    reSpin,
    resetPick,
    startSpin,
} from "~/server/actions";
import { getBootState } from "~/server/agents";
import { getDraft } from "~/server/data";

const LUCKY_THOUGHTS = [
    "help freelancers get paid on time",
    "a tiny tool that saves indie makers an hour a week",
    "turn messy CSVs into clean dashboards",
    "help small Shopify stores cut refund fraud",
    "auto-summarize long meeting recordings into action items",
    "a calm way for tutors to schedule and bill students",
];

export const Route = createFileRoute("/companies/new")({
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

// The "spin up a company" CHAT: a real conversation (ask anything, refine, pick, create). The
// composer writes a user turn; the engine's spinChat pass (src/engine/spin.ts) replies AND routes
// intent to the scout/spec/commit machinery. The candidate/spec cards render inline as artifacts.
function SpinCompany() {
    const navigate = useNavigate();
    const router = useRouter();
    const { draft: draftId } = Route.useSearch();
    const { draft } = Route.useLoaderData();
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);

    // Poll the draft while it's live: the engine may be scouting/spec'ing OR composing a chat
    // reply. Stop once committed (we navigate away).
    const active = !!draft && draft.status !== "committed";
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => void router.invalidate(), 1800);
        return () => clearInterval(t);
    }, [active, router]);

    // Chat-driven commit ("create it") flips the draft to committed → jump to the company.
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

    const sendChat = useCallback(
        async (text: string) => {
            if (!draftId) return;
            await messageDraft({ data: { draftId, text } });
            await router.invalidate();
        },
        [draftId, router],
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
        const [res] = await Promise.all([
            commitDraft({ data: { draftId } }),
            new Promise((r) => setTimeout(r, 3700)),
        ]);
        if (res.ok && res.id) {
            navigate({ to: "/companies/$slug", params: { slug: res.id } });
        } else {
            setCreating(false);
        }
    }, [draftId, creating, navigate]);

    if (creating) {
        return (
            <AppShell active="companies">
                <CreatingView product={draft?.spec?.product ?? "your company"} />
            </AppShell>
        );
    }

    if (!draftId || !draft || draft.status === "committed") {
        return (
            <AppShell active="companies">
                <Composer onStart={start} busy={busy} />
            </AppShell>
        );
    }

    // ---- active spin session: a chat with inline artifacts ----
    const lastIsUser = draft.messages.at(-1)?.role === "user";
    const showTyping = draft.working || lastIsUser;

    return (
        <AppShell active="companies">
            <div className="mx-auto flex h-full max-w-2xl flex-col px-6">
                <header className="flex-none py-5">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Start your company"}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">“{draft.thought}”</p>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
                    {/* transcript */}
                    {draft.messages.map((m) => (
                        <Bubble key={m.id} m={m} />
                    ))}
                    {showTyping && <Typing />}

                    {/* inline artifact for the current stage */}
                    {draft.status === "scouting" && draft.messages.length === 0 && (
                        <ScoutingView thought={draft.thought} />
                    )}
                    {draft.status === "proposals" && (
                        <ProposalsView
                            candidates={draft.candidates}
                            onPick={pick}
                            onReroll={reroll}
                            busy={busy}
                        />
                    )}
                    {draft.status === "spec" && (
                        <SpecView draft={draft} onCreate={create} onBack={back} busy={busy} />
                    )}
                    {draft.status === "specing" && draft.messages.length === 0 && (
                        <SpecingView
                            name={
                                draft.candidates.find((c) => c.id === draft.pickedId)?.name ??
                                "your pick"
                            }
                        />
                    )}
                    {draft.status === "failed" && <FailedView onRetry={reroll} busy={busy} />}
                </div>

                <ChatComposer onSend={sendChat} status={draft.status} />
            </div>
        </AppShell>
    );
}

// ---- chat bubbles -------------------------------------------------------------------------
function Bubble({ m }: { m: SpinMessage }) {
    const me = m.role === "user";
    return (
        <div className={`flex ${me ? "justify-end" : "justify-start"}`}>
            <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                    me
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border bg-card"
                }`}
            >
                {m.content}
            </div>
        </div>
    );
}

function Typing() {
    return (
        <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border bg-card px-3.5 py-3">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-1.5 animate-bounce rounded-full bg-faint"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
        </div>
    );
}

// ---- chat composer (pinned) ---------------------------------------------------------------
const HINTS: Record<string, string> = {
    scouting: "Ask a question while I scout…",
    proposals: "“target agencies”, “make #2 cheaper”, “go with 1”, or ask anything…",
    specing: "Ask a question while I draft the spec…",
    spec: "“drop Stripe”, “raise price to $29”, “create it”, or ask anything…",
    failed: "Tell me what to try instead…",
};
function ChatComposer({
    onSend,
    status,
}: {
    onSend: (text: string) => Promise<void>;
    status: string;
}) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const ref = useRef<HTMLTextAreaElement>(null);

    const submit = async () => {
        const t = text.trim();
        if (!t || sending) return;
        setSending(true);
        setText(""); // optimistic clear; the poll shows the turn
        try {
            await onSend(t);
        } catch {
            setText(t); // restore on failure
        } finally {
            setSending(false);
            ref.current?.focus();
        }
    };

    return (
        <div className="flex-none pb-5 pt-2">
            <div className="relative rounded-2xl border bg-card shadow-e1 transition focus-within:ring-2 focus-within:ring-primary/40">
                <Textarea
                    ref={ref}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void submit();
                        }
                    }}
                    placeholder={HINTS[status] ?? "Message…"}
                    className="max-h-40 min-h-11 resize-none border-0 bg-transparent px-4 py-3 pr-12 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={sending || !text.trim()}
                    aria-label="Send"
                    className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
                >
                    {sending ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <ArrowUp className="size-4" />
                    )}
                </button>
            </div>
        </div>
    );
}

// ---- the start screen (unchanged composer) ------------------------------------------------
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
                Tell me a thought — I’ll scout the opportunities, and we’ll take it from there.
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
