import { Badge, Button, GradientMark, cn } from "obp-ui";
import {
    ASSISTANT_BUBBLE,
    AssistantTurn,
    ChatBubble,
    ChatComposer,
    ChatEmptyState,
    ChatPanel,
    ChatPanelHeader,
    type ChatRole,
    ChatSystemLine,
    ENTRANCE_MAX_STEPS,
    ENTRANCE_STEP_MS,
    TypingIndicator,
    useEntranceStagger,
} from "obp-ui/chat";
import { useState } from "react";
import { Api, Frame, Note, Row, Spec } from "../kit";

type Msg = { id: string; role: ChatRole; text: string; ago: string };

const PANEL_SEED: Msg[] = [
    {
        id: "m1",
        role: "assistant",
        text: "Slice 3 is blocked: I need a **live Stripe key** before checkout can be wired.",
        ago: "6m ago",
    },
    {
        id: "m2",
        role: "user",
        text: "Use the test key for now, we can swap it later.",
        ago: "5m ago",
    },
    {
        id: "m3",
        role: "assistant",
        text: "Done - `sk_test_…` is in the sandbox env only. I'll flag it again before launch.",
        ago: "4m ago",
    },
    { id: "m4", role: "system", text: "deployed v12 · preview is healthy", ago: "2m ago" },
];

const THREAD_SEED: Msg[] = [
    {
        id: "t1",
        role: "user",
        text: "Freelancers keep getting paid late. Is there a business in that?",
        ago: "",
    },
    {
        id: "t2",
        role: "assistant",
        text: "There is, and the wedge is narrow enough to hold.\n\n- Every invoice tool is built for finance teams\n- Freelancers just want the chase automated\n- Willingness to pay is proven by the late-fee workarounds\n\nI scored it **8.4** and drafted a spec.",
        ago: "",
    },
];

export function ChatSection() {
    const [panelMsgs, setPanelMsgs] = useState<Msg[]>(PANEL_SEED);
    const [threadMsgs, setThreadMsgs] = useState<Msg[]>(THREAD_SEED);
    const delayFor = useEntranceStagger(THREAD_SEED.length);

    const reply = (text: string, from: Msg[]): Msg[] => [
        ...from,
        { id: `u${from.length}`, role: "user", text, ago: "just now" },
        {
            id: `a${from.length}`,
            role: "assistant",
            text: "Noted - I'll pick that up on the next run.",
            ago: "just now",
        },
    ];

    return (
        <>
            <Spec
                name='ChatPanel variant="panel" · ChatPanelHeader · ChatBubble · ChatSystemLine · ChatComposer'
                note="Docked co-pilot column. Type and press Enter."
                bare
            >
                <Frame className="h-[520px] w-full max-w-lg">
                    <ChatPanel
                        className="h-full border-r-0"
                        header={
                            <ChatPanelHeader
                                avatar={<GradientMark name="Ledgerly" size={38} />}
                                title="Ledgerly"
                                badge={
                                    <span className="inline-flex flex-none items-center gap-1.5 font-mono text-sm font-bold uppercase tracking-[0.05em] text-muted-foreground">
                                        <span
                                            aria-hidden="true"
                                            className="size-1.5 rounded-full bg-success"
                                            style={{
                                                boxShadow: "0 0 0 3px var(--success-soft)",
                                            }}
                                        />
                                        live
                                    </span>
                                }
                                subtitle="$1.2k MRR · slice 3 of 9 · building"
                            />
                        }
                        composer={
                            <ChatComposer
                                placeholder="Tell Ledgerly what to do next…"
                                onSend={(text) => setPanelMsgs((m) => reply(text, m))}
                            />
                        }
                    >
                        {panelMsgs.map((m) => (
                            <ChatBubble
                                key={m.id}
                                role={m.role}
                                text={m.text}
                                timestamp={m.ago}
                                avatar={<GradientMark name="Ledgerly" size={28} />}
                            />
                        ))}
                        <TypingIndicator />
                    </ChatPanel>
                </Frame>
                <Note>
                    A <code>system</code> role renders as a <code>ChatSystemLine</code> instead of a
                    bubble - the fourth message above.
                </Note>
            </Spec>

            <Spec
                name='ChatPanel variant="thread" · ChatBubble variant="thread" · AssistantTurn'
                note="Full-page thread, floating composer."
                bare
            >
                <Frame className="h-[680px]">
                    <ChatPanel
                        variant="thread"
                        maxWidth={720}
                        composer={
                            <ChatComposer
                                variant="dock"
                                placeholder="What should this company do next?"
                                textareaClassName="font-display text-2xl font-light"
                                onSend={(text) => setThreadMsgs((m) => reply(text, m))}
                            />
                        }
                    >
                        {threadMsgs.map((m, i) => (
                            <ChatBubble
                                key={m.id}
                                role={m.role}
                                variant="thread"
                                text={m.text}
                                delayMs={delayFor(i)}
                            />
                        ))}
                        <AssistantTurn>
                            <div className={cn(ASSISTANT_BUBBLE, "text-muted-foreground")}>
                                An artifact turn - anything the company "says" that is not prose
                                hangs off the same stream body:
                            </div>
                            <div className="rounded-xl border border-border bg-card p-4 shadow-e1">
                                <Row>
                                    <Badge variant="approval">spec drafted</Badge>
                                    <span className="font-mono text-sm text-faint">
                                        invoice-chasing · 8.4
                                    </span>
                                </Row>
                                <Row className="mt-3">
                                    <Button size="sm">Start building</Button>
                                    <Button size="sm" variant="outline">
                                        Rescore
                                    </Button>
                                </Row>
                            </div>
                            <TypingIndicator />
                        </AssistantTurn>
                    </ChatPanel>
                </Frame>
            </Spec>

            <Spec
                name="ChatEmptyState · TypingIndicator"
                note="Empty state and the typing dots."
                bare
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <Frame className="h-56 bg-secondary/40">
                        <ChatEmptyState
                            avatar={<GradientMark name="Ledgerly" size={40} />}
                            title="Say something to Ledgerly"
                            description="It answers with what it is doing and what it needs from you."
                        />
                    </Frame>
                    <div className="rounded-xl border border-border bg-card p-5 shadow-e1">
                        <p className="font-mono text-sm text-faint">bare</p>
                        <TypingIndicator />
                        <p className="mt-4 font-mono text-sm text-faint">turn</p>
                        <TypingIndicator turn />
                        <p className="mt-4 font-mono text-sm text-faint">ChatSystemLine</p>
                        <ChatSystemLine text="budget cap raised to $40" ago="1m" />
                    </div>
                </div>
            </Spec>

            <Spec
                name="useEntranceStagger"
                note="Mount staggers; live messages animate at once."
                bare
            >
                <Api
                    items={[
                        {
                            name: "ENTRANCE_STEP_MS",
                            note: "ms between two consecutive entrances.",
                            value: String(ENTRANCE_STEP_MS),
                        },
                        {
                            name: "ENTRANCE_MAX_STEPS",
                            note: "the highest index that still earns a longer delay.",
                            value: String(ENTRANCE_MAX_STEPS),
                        },
                        {
                            name: "delayFor(i)",
                            note: "the delay applied to the thread above.",
                            value: threadMsgs.map((_, i) => `${delayFor(i)}ms`).join(" · "),
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
