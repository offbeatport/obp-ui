import { useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
    approveCompany,
    continueWithoutResearch,
    messageCompany,
    pickOpportunity,
    reSpin,
    resetPick,
} from "~/server/actions";
import type { CompanyDetail } from "~/server/data";
import { Bubble, CreatingView, FailedView, ProposalsView, ScoutingView, SpecView, SpecingView } from "./spin-views";
import { Button } from "./ui/button";

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
    // How many messages existed when this chat first mounted - those get the staggered entrance.
    const initialCount = useRef(detail.messages.length);

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
    // Re-pick from the (still-visible) list at the specing/spec stage: reset the current pick, then
    // pick the new one so the engine re-drafts the spec for it. No-op if it's already the pick.
    const repick = useCallback(
        (candidateId: string) =>
            run(async () => {
                if (spin?.pickedId === candidateId) return;
                await resetPick({ data: { companyId } });
                await pickOpportunity({ data: { companyId, candidateId } });
            }),
        [run, companyId, spin?.pickedId],
    );
    const skipResearch = useCallback(
        () => run(() => continueWithoutResearch({ data: { companyId } })),
        [run, companyId],
    );

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
        // Land on the graduated company's NAME slug (id still resolves as a fallback).
        const [res] = await Promise.all([
            approveCompany({ data: { companyId } }),
            new Promise((r) => setTimeout(r, 3700)),
        ]);
        await navigate({
            to: "/companies/$slug",
            params: { slug: res?.slug ?? companyId },
        });
        await router.invalidate();
        setCreating(false);
    }, [creating, companyId, navigate, router]);

    if (creating) {
        return <CreatingView product={spin?.spec?.product ?? detail.name} />;
    }

    const lastIsUser = detail.messages.at(-1)?.role === "user";
    const working = stage === "scouting" || stage === "specing";
    const showTyping = (working || lastIsUser) && stage !== "scouting";

    // "Continue without market research" - a trailing option that flows in continuation of the
    // opportunities list (and the scouting loader), not a floating control above the composer.
    const skipRow =
        stage === "scouting" || stage === "proposals" ? (
            <div className="mt-3 pl-[52px] text-[13px] text-center p-5">
                <Button onClick={skipResearch} disabled={busy} variant="ghost">
                    Continue without market research →
                </Button>
            </div>
        ) : null;

    // The interactive artifact (proposals / spec) is anchored INLINE, right after the assistant
    // message that announced it, so the founder's later questions continue the conversation BELOW
    // it instead of pushing above it. Loaders (scouting/specing/failed) stay at the bottom.
    const anchoredArtifact =
        (stage === "proposals" || stage === "specing" || stage === "spec") && spin ? (
            <>
                <ProposalsView
                    candidates={spin.candidates}
                    pickedId={spin.pickedId}
                    // The list stays VISIBLE through specing + spec with the picked line marked.
                    // 'proposals' → pick to advance; 'spec' → click another row to re-pick (the
                    // spec panel below updates). Locked only while the spec is drafting.
                    onPick={stage === "proposals" ? pick : repick}
                    busy={busy || stage === "specing"}
                />
                {stage === "proposals" && skipRow}
                {/* The drafted spec sits BELOW its opportunity list, not replacing it. */}
                {stage === "spec" && <SpecView spin={spin} onCreate={approve} busy={busy} />}
            </>
        ) : null;
    const anchorId = anchoredArtifact ? announcementId(detail.messages, stage) : undefined;

    // Build the thread, injecting the artifact right after its anchor message (or at the end if the
    // anchor isn't found - e.g. an offline run that skipped the announcement).
    // Messages already present at FIRST mount get a staggered entrance delay (the whole page swaps
    // in at once on navigation, so without the cascade the opening exchange reads as static).
    // Later (live) messages get 0 delay and animate the moment they arrive.
    const thread: ReactNode[] = [];
    let injected = false;
    let idx = 0;
    for (const m of detail.messages) {
        if (m.role === "system") continue;
        const delayMs = idx < initialCount.current ? Math.min(idx, 6) * 260 : 0;
        thread.push(
            <Bubble key={m.id} m={{ id: m.id, role: m.role, content: m.content, ago: m.ago }} delayMs={delayMs} />,
        );
        idx += 1;
        if (anchoredArtifact && m.id === anchorId) {
            thread.push(<div key={`${m.id}-artifact`}>{anchoredArtifact}</div>);
            injected = true;
        }
    }
    if (anchoredArtifact && !injected) thread.push(<div key="artifact">{anchoredArtifact}</div>);

    return (
        <div className="relative flex h-full flex-col">
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                {/* bottom padding clears the floating composer so the last message isn't hidden */}
                <div className="mx-auto w-full" style={{ maxWidth: 840, padding: "22px 20px 148px" }}>
                    <h1 className="font-display font-light text-4xl w-full p-20 text-center">
                        Start your new AI Company
                    </h1>
                    {thread}
                    {showTyping && <Typing />}
                    {stage === "scouting" && (
                        // Cascades in AFTER the seeded opening messages (their stagger ends ~700ms).
                        // Delay is inline style so it can't lose the cascade to the animate shorthand.
                        <div
                            className="animate-[msg-in_0.4s_cubic-bezier(0.22,0.7,0.24,1)_both]"
                            style={{ animationDelay: "640ms" }}
                        >
                            <ScoutingView thought={detail.thesis} />
                            {skipRow}
                        </div>
                    )}
                    {stage === "specing" && spin && (
                        <SpecingView name={spin.candidates.find((c) => c.id === spin.pickedId)?.name ?? "your pick"} />
                    )}
                    {stage === "failed" && <FailedView onRetry={reroll} busy={busy} />}
                </div>
            </div>

            {/* Floating composer - absolute at the bottom, over the thread. The gradient fades the
                scrolling content out behind it; pointer-events pass through the transparent zone. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent pt-8">
                <div className="pointer-events-auto mx-auto w-full" style={{ maxWidth: 840 }}>
                    <ChatComposer onSend={sendChat} stage={stage} />
                </div>
            </div>
        </div>
    );
}

// The id of the assistant message that announced the current artifact (the scout's "I found …
// opportunities:" line, or the spec's "… spec - …" line) - the anchor the artifact renders after.
function announcementId(messages: CompanyDetail["messages"], stage?: string): string | undefined {
    const marker = stage === "proposals" || stage === "specing" || stage === "spec" ? "opportunities:" : null;
    if (!marker) return undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role === "assistant" && m.content.includes(marker)) return m.id;
    }
    return undefined;
}

// Assistant "typing" turn - matches spin-views' AssistantTurn (hidden avatar + flat stream body).
function Typing() {
    return (
        <div className="flex items-start gap-[12px]">
            <div className="hidden">C</div>
            <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
                <div className="py-[2px]">
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
function ChatComposer({ onSend, stage }: { onSend: (text: string) => Promise<void>; stage?: string }) {
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
        <div className="px-5 pb-10 pt-2">
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
                    // Big Space Grotesk title input (echoes the .spin-hero-q hero: display font,
                    // light weight, tight tracking).
                    className="block max-h-48 min-h-14 w-full resize-none rounded-xl bg-transparent px-5 py-4 pr-14 leading-snug tracking-tight outline-none placeholder:text-muted-foreground/45"
                />
                <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={sending || !text.trim()}
                    aria-label="Send"
                    className="absolute right-3 bottom-2 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
                >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : "↑"}
                </button>
            </div>
        </div>
    );
}
