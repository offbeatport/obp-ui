import { Button, Card, CopyButton, Label, Markdown, Textarea } from "obp-ui";
import {
    ChatActions,
    ChatBubble,
    ChatComposer,
    ChatEmptyState,
    ChatMeta,
    type ChatModel,
    ChatModelPicker,
    ChatNotice,
    ChatPanel,
    ChatPending,
    ChatReasoning,
    ChatToolCall,
} from "obp-ui/chat";
import { useEffect, useRef, useState } from "react";
import { Api, Note, Spec } from "../kit";

type Turn =
    | { id: string; role: "user"; text: string }
    | { id: string; role: "assistant"; text: string; streaming: boolean; stopped: boolean };

const ANSWER =
    "Retry with a doubling delay and give up after a few tries:\n\n```python\nfor attempt in range(5):\n    try:\n        return call()\n    except TimeoutError:\n        time.sleep(0.5 * 2 ** attempt)\n```\n\nKeep the count small where a person is waiting.";

const REASONING =
    "The question is about retries. A fixed delay hammers a struggling service, so the answer should double the delay and cap the number of tries.";

const MODELS: ChatModel[] = [
    {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        provider: "anthropic",
        group: "Anthropic",
        detail: "1M context · $5 / $25",
    },
    {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        provider: "anthropic",
        group: "Anthropic",
        detail: "1M context · $3 / $15",
    },
    {
        id: "claude-haiku-5-5",
        name: "Claude Haiku 5.5",
        provider: "anthropic",
        group: "Anthropic",
        detail: "200K context · $1 / $5",
    },
    {
        id: "gpt-5",
        name: "GPT-5",
        provider: "openai",
        group: "OpenAI",
        detail: "400K context · $1.25 / $10",
    },
    {
        id: "gpt-5-mini",
        name: "GPT-5 mini",
        provider: "openai",
        group: "OpenAI",
        detail: "400K context · $0.25 / $2",
    },
    {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        provider: "google",
        group: "Google",
        detail: "1M context · $1.25 / $10",
    },
    {
        id: "deepseek-v3",
        name: "DeepSeek V3",
        provider: "deepseek",
        group: "Open weights",
        detail: "128K context",
    },
    {
        id: "qwen3-235b",
        name: "Qwen3 235B",
        provider: "qwen",
        group: "Open weights",
        detail: "128K context",
    },
    {
        id: "llama-4-maverick",
        name: "Llama 4 Maverick",
        provider: "meta",
        group: "Open weights",
        detail: "Unavailable in this region",
        disabled: true,
    },
];

function useFakeStream(onDone: () => void) {
    const timer = useRef<number | null>(null);
    useEffect(
        () => () => {
            if (timer.current !== null) window.clearInterval(timer.current);
        },
        [],
    );
    const start = (onWords: (text: string) => void) => {
        const words = ANSWER.split(/(?<=\s)/);
        let at = 0;
        timer.current = window.setInterval(() => {
            at += 3;
            onWords(words.slice(0, at).join(""));
            if (at >= words.length) stop();
        }, 60);
    };
    const stop = () => {
        if (timer.current !== null) window.clearInterval(timer.current);
        timer.current = null;
        onDone();
    };
    return { start, stop };
}

function LiveTranscript() {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [busy, setBusy] = useState(false);
    const [model, setModel] = useState("claude-sonnet-5-5");
    const patchLast = (change: Partial<Extract<Turn, { role: "assistant" }>>) =>
        setTurns((all) =>
            all.map((turn, index) =>
                index === all.length - 1 && turn.role === "assistant"
                    ? { ...turn, ...change }
                    : turn,
            ),
        );
    const stream = useFakeStream(() => {
        setBusy(false);
        patchLast({ streaming: false });
    });
    const send = (text: string) => {
        const id = String(turns.length);
        setTurns((all) => [
            ...all,
            { id: `u${id}`, role: "user", text },
            { id: `a${id}`, role: "assistant", text: "", streaming: true, stopped: false },
        ]);
        setBusy(true);
        stream.start((words) => patchLast({ text: words }));
    };
    const stop = () => {
        patchLast({ stopped: true });
        stream.stop();
    };
    return (
        <Card className="flex h-[480px] flex-col p-0">
            <ChatPanel
                variant="inset"
                busy={busy}
                isEmpty={turns.length === 0}
                empty={
                    <ChatEmptyState
                        title="Send a message to the model"
                        description="Answers stream in as the model writes them."
                    />
                }
                composer={
                    <ChatComposer
                        variant="dock"
                        sendOn="mod-enter"
                        placeholder="Type a message"
                        busy={busy}
                        onStop={stop}
                        onSend={send}
                        tools={
                            <ChatModelPicker
                                models={MODELS}
                                value={model}
                                onValueChange={setModel}
                                disabled={busy}
                            />
                        }
                    />
                }
            >
                {turns.map((turn) =>
                    turn.role === "user" ? (
                        <ChatBubble key={turn.id} variant="plain" role="user" text={turn.text} />
                    ) : (
                        <ChatBubble
                            key={turn.id}
                            variant="plain"
                            role="assistant"
                            busy={turn.streaming}
                        >
                            {turn.text ? <Markdown content={turn.text} /> : <ChatPending />}
                            {turn.stopped && <ChatNotice tone="destructive">Stopped.</ChatNotice>}
                            {!turn.streaming && turn.text && (
                                <ChatActions>
                                    <CopyButton
                                        text={turn.text}
                                        label="Copy the answer"
                                        variant="ghost"
                                        size="icon"
                                    />
                                </ChatActions>
                            )}
                        </ChatBubble>
                    ),
                )}
            </ChatPanel>
        </Card>
    );
}

function ToolResultForm() {
    const [draft, setDraft] = useState("");
    return (
        <div className="flex flex-col gap-label">
            <Label htmlFor="gallery-tool-result">Tool result</Label>
            <Textarea
                id="gallery-tool-result"
                rows={2}
                value={draft}
                placeholder='{"temperature": 18}'
                className="font-mono"
                onChange={(event) => setDraft(event.target.value)}
            />
            <Button size="sm" className="w-fit" disabled={!draft.trim()}>
                Send result
            </Button>
        </div>
    );
}

function StaticTranscript() {
    return (
        <Card className="flex flex-col p-0">
            <ChatPanel variant="inset">
                <ChatBubble variant="plain" role="user" text="Which plan fits 40 seats?" />
                <ChatBubble variant="plain" role="assistant">
                    <ChatReasoning text={REASONING} />
                    <Markdown content="The **Team** plan: it covers up to 50 seats." />
                    <ChatMeta items={["base-4b", "812 ms", "64 in · 18 out", "stop"]} />
                    <ChatActions>
                        <CopyButton
                            text="The Team plan: it covers up to 50 seats."
                            label="Copy the answer"
                            variant="ghost"
                            size="icon"
                        />
                        <Button variant="ghost">Save as example</Button>
                    </ChatActions>
                </ChatBubble>
                <ChatBubble variant="plain" role="user" text="And the weather in Paris?" />
                <ChatBubble variant="plain" role="assistant">
                    <ChatToolCall
                        name="get_weather"
                        id="call_7f3a"
                        args='{"city":"Paris","unit":"celsius"}'
                        result='{"temperature":18,"sky":"clear"}'
                    />
                    <ChatToolCall name="get_time" id="call_8b21" args='{"city":"Paris"}'>
                        <ToolResultForm />
                    </ChatToolCall>
                </ChatBubble>
                <ChatBubble variant="plain" role="user" text="Tell me how to pick a lock." />
                <ChatBubble variant="plain" role="assistant">
                    <ChatNotice tone="warning" label="Blocked">
                        The safety model blocked this answer.
                    </ChatNotice>
                </ChatBubble>
                <ChatBubble variant="plain" role="assistant">
                    <ChatNotice tone="destructive">The model is not loaded.</ChatNotice>
                </ChatBubble>
            </ChatPanel>
        </Card>
    );
}

export function TranscriptSpecs() {
    return (
        <>
            <Spec
                name='ChatPanel variant="inset" · ChatBubble variant="plain" · ChatComposer variant="dock" sendOn="mod-enter" · ChatModelPicker'
                note="A model transcript inside a card. Enter adds a line, Ctrl or ⌘ Enter sends; the ↑ turns to Stop while it streams."
                bare
            >
                <LiveTranscript />
                <Note>
                    The panel fills its card: the log scrolls, the composer sits under a 1px rule
                    and grows with what is typed up to 12rem. The log is <code>role="log"</code> and{" "}
                    <code>aria-busy</code> while an answer streams, so a screen reader reads the
                    answer once it is whole.
                </Note>
                <Api
                    items={[
                        {
                            name: "ChatComposer tools",
                            note: "a row under the dock field, left of Send: the model picker, then the app's own controls.",
                        },
                        {
                            name: "ChatModelPicker",
                            note: "provider logo and name as a ghost trigger; opens upward to a list grouped by group, with a search past six models. detail is one muted line (context, price).",
                        },
                    ]}
                />
            </Spec>
            <Spec
                name="ChatReasoning · ChatToolCall · ChatNotice · ChatMeta · ChatActions"
                note="The parts of an answer, in the order an answer stacks them."
                bare
            >
                <StaticTranscript />
                <Api
                    items={[
                        {
                            name: "ChatReasoning",
                            note: "open while streaming, closed after with a word count; a person's toggle wins.",
                        },
                        {
                            name: "ChatToolCall",
                            note: "name, id, arguments as JSON; the result, or children (a result form) while it is pending.",
                        },
                        {
                            name: "ChatNotice",
                            note: "warning (a refusal, with a label), destructive (an error), neutral.",
                        },
                        {
                            name: "ChatMeta",
                            note: "model, latency, tokens, finish reason: one muted tabular line.",
                        },
                        {
                            name: "ChatActions",
                            note: "the answer's buttons: CopyButton first, then the app's own.",
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
