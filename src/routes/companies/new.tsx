import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "~/components/app-shell";
// Prototype-faithful CSS: proto.css supplies the .cc token aliases; spin-proto.css the spin rules.
import "~/components/command-center/proto.css";
import "~/components/command-center/spin-proto.css";
import { GuardrailMenu } from "~/components/guardrail-menu";
import {
    Bubble,
    CreatingView,
    FailedView,
    ProposalsView,
    ScoutingView,
    SpecView,
    SpecingView,
} from "~/components/spin-views";
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

// The "spin up a company" chat — the design prototype's SPIN flow (08-chat-spine-pro-v7.html).
// A .spin thread of chat turns + inline artifact cards (scout / proposals / spec). The composer
// writes a user turn; the engine's spinChat pass replies AND routes intent to scout/spec/commit.
function SpinCompany() {
    const navigate = useNavigate();
    const router = useRouter();
    const { draft: draftId } = Route.useSearch();
    const { draft } = Route.useLoaderData();
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const active = !!draft && draft.status !== "committed";
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => void router.invalidate(), 1800);
        return () => clearInterval(t);
    }, [active, router]);

    // Keep the thread pinned to the latest turn.
    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any thread change
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [draft?.messages.length, draft?.status]);

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
                <div className="cc dash-mode">
                    <CreatingView product={draft?.spec?.product ?? "your company"} />
                </div>
            </AppShell>
        );
    }

    if (!draftId || !draft || draft.status === "committed") {
        return (
            <AppShell active="companies">
                <div className="cc dash-mode">
                    <Composer onStart={start} busy={busy} />
                </div>
            </AppShell>
        );
    }

    const lastIsUser = draft.messages.at(-1)?.role === "user";
    const showTyping = (draft.working || lastIsUser) && draft.status !== "scouting";

    return (
        <AppShell active="companies">
            <div className="cc dash-mode flex h-full flex-col">
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                    <div
                        className="spin mx-auto w-full"
                        style={{ maxWidth: 840, padding: "22px 20px 8px" }}
                    >
                        {draft.messages.map((m) => (
                            <Bubble key={m.id} m={m} />
                        ))}
                        {showTyping && <Typing />}

                        {draft.status === "scouting" && <ScoutingView thought={draft.thought} />}
                        {draft.status === "proposals" && (
                            <ProposalsView
                                candidates={draft.candidates}
                                pickedId={draft.pickedId}
                                onPick={pick}
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
                </div>

                <div className="mx-auto w-full" style={{ maxWidth: 840 }}>
                    <ChatComposer onSend={sendChat} status={draft.status} />
                </div>
            </div>
        </AppShell>
    );
}

// A typing indicator styled as an assistant chat turn.
function Typing() {
    return (
        <div className="spin-msg assistant">
            <div className="spin-av">C</div>
            <div className="spin-stream-body">
                <div className="spin-bubble">
                    <span className="inline-flex items-center gap-1">
                        {[0, 1, 2].map((i) => (
                            <span
                                key={i}
                                className="size-1.5 animate-bounce rounded-full bg-faint"
                                style={{ animationDelay: `${i * 0.15}s` }}
                            />
                        ))}
                    </span>
                </div>
            </div>
        </div>
    );
}

const HINTS: Record<string, string> = {
    scouting: "Ask a question while I scout…",
    proposals: "“target agencies”, “make it cheaper”, “go with 1”, or ask anything…",
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
        setText("");
        try {
            await onSend(t);
        } catch {
            setText(t);
        } finally {
            setSending(false);
            ref.current?.focus();
        }
    };

    return (
        <div className="px-5 pb-5 pt-2">
            <div className="relative rounded-2xl border bg-card shadow-e1 transition focus-within:ring-2 focus-within:ring-primary/40">
                <textarea
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
                    className="block max-h-40 min-h-11 w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-12 text-sm outline-none"
                />
                <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={sending || !text.trim()}
                    aria-label="Send"
                    className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
                >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : "↑"}
                </button>
            </div>
        </div>
    );
}

// The start screen — the prototype's .spin-start hero (thought box + guardrail preset + send).
function Composer({
    onStart,
    busy,
}: {
    onStart: (thought: string, preset: string) => void;
    busy: boolean;
}) {
    const [thought, setThought] = useState("");
    const [preset, setPreset] = useState("lean");
    const submit = () => onStart(thought, preset);

    return (
        <div className="spin spin-start">
            <div className="spin-hero">
                <div className="spin-hero-eyebrow mono">{"// thought → company"}</div>
                <h1 className="spin-hero-q">Start your new AI company</h1>
                <p className="spin-hero-sub">I'll find the opportunities</p>

                <div className="spin-hero-box">
                    <textarea
                        id="spin-thought"
                        rows={2}
                        value={thought}
                        onChange={(e) => setThought(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submit();
                            }
                        }}
                        placeholder="What are you passionate about?"
                    />
                    <div className="spin-hero-actions">
                        <span style={{ marginRight: "auto" }}>
                            <GuardrailMenu value={preset} onChange={setPreset} />
                        </span>
                        <button
                            className="spin-hero-send"
                            type="button"
                            onClick={submit}
                            disabled={busy || !thought.trim()}
                            aria-label="Send to agent"
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M12 19V5M5 12l7-7 7 7" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
