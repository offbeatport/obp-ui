import { useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    approveCompany,
    messageCompany,
    pickOpportunity,
    reSpin,
    resetPick,
} from "~/server/actions";
import type { CompanyDetail } from "~/server/data";
import {
    Bubble,
    CreatingView,
    FailedView,
    ProposalsView,
    ScoutingView,
    SpecView,
    SpecingView,
} from "./spin-views";

// The "spin up a company" chat, rendered INSIDE the company page while status='draft'. It's the
// company's own message thread (Bubbles) + the current-stage artifact card + a chat composer.
// Approving graduates the company → the page re-renders as the normal workspace (same id).
export function SpinChat({ detail }: { detail: CompanyDetail }) {
    const router = useRouter();
    const navigate = useNavigate();
    const companyId = detail.id;
    const spin = detail.spin;
    const stage = spin?.stage;
    const [busy, setBusy] = useState(false);
    const [creating, setCreating] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any thread change
    useEffect(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [detail.messages.length, stage]);

    const run = useCallback(
        async (fn: () => Promise<unknown>) => {
            if (busy) return;
            setBusy(true);
            try {
                await fn();
                await router.invalidate();
            } finally {
                setBusy(false);
            }
        },
        [busy, router],
    );

    const pick = useCallback(
        (candidateId: string) => run(() => pickOpportunity({ data: { companyId, candidateId } })),
        [run, companyId],
    );
    const reroll = useCallback(() => run(() => reSpin({ data: { companyId } })), [run, companyId]);
    const back = useCallback(() => run(() => resetPick({ data: { companyId } })), [run, companyId]);

    const sendChat = useCallback(
        async (text: string) => {
            await messageCompany({ data: { companyId, text } });
            await router.invalidate();
        },
        [companyId, router],
    );

    const approve = useCallback(async () => {
        if (creating) return;
        setCreating(true);
        // Let the 5-step create animation (~3.6s) play while the (instant) graduate write runs.
        await Promise.all([
            approveCompany({ data: { companyId } }),
            new Promise((r) => setTimeout(r, 3700)),
        ]);
        await navigate({ to: "/companies/$slug", params: { slug: companyId } });
        await router.invalidate();
        setCreating(false);
    }, [creating, companyId, navigate, router]);

    if (creating) {
        return <CreatingView product={spin?.spec?.product ?? detail.name} />;
    }

    const lastIsUser = detail.messages.at(-1)?.role === "user";
    const working = stage === "scouting" || stage === "specing";
    const showTyping = (working || lastIsUser) && stage !== "scouting";

    return (
        <div className="flex h-full flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                <div
                    className="spin mx-auto w-full"
                    style={{ maxWidth: 840, padding: "22px 20px 8px" }}
                >
                    {detail.messages.map((m) =>
                        m.role === "system" ? null : (
                            <Bubble
                                key={m.id}
                                m={{ id: m.id, role: m.role, content: m.content, ago: m.ago }}
                            />
                        ),
                    )}
                    {showTyping && <Typing />}

                    {stage === "scouting" && <ScoutingView thought={detail.thesis} />}
                    {stage === "proposals" && spin && (
                        <ProposalsView
                            candidates={spin.candidates}
                            pickedId={spin.pickedId}
                            onPick={pick}
                            busy={busy}
                        />
                    )}
                    {stage === "specing" && spin && (
                        <SpecingView
                            name={
                                spin.candidates.find((c) => c.id === spin.pickedId)?.name ??
                                "your pick"
                            }
                        />
                    )}
                    {stage === "spec" && spin && (
                        <SpecView spin={spin} onCreate={approve} onBack={back} busy={busy} />
                    )}
                    {stage === "failed" && <FailedView onRetry={reroll} busy={busy} />}
                </div>
            </div>

            <div className="mx-auto w-full" style={{ maxWidth: 840 }}>
                <ChatComposer onSend={sendChat} stage={stage} />
            </div>
        </div>
    );
}

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
    spec: "“drop Stripe”, “raise price to $29”, “build it”, or ask anything…",
    failed: "Tell me what to try instead…",
};
function ChatComposer({
    onSend,
    stage,
}: {
    onSend: (text: string) => Promise<void>;
    stage?: string;
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
                    placeholder={HINTS[stage ?? ""] ?? "Message…"}
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
