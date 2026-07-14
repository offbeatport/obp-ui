// Chat thread + composer — reproduces the prototype's .msg/.bubble stream (msgHTML) and composer.
// Used by the global /chats thread and the per-company co-pilot. The composer echoes locally
// (there's no send server-fn in the contract yet) so the thread feels live, like the prototype.
import { ArrowUp } from "lucide-react";
import { type FormEvent, useState } from "react";
import { cn } from "~/lib/utils";
import type { ChatMessage } from "~/server/data";

let localSeq = 0;

export function ChatThread({
    messages,
    assistantMark = "C",
    reply = "On it — I'm looking across your portfolio now. I'll keep this thread updated and surface anything that needs a decision in your Inbox.",
    placeholder = "Reply…",
}: {
    messages: ChatMessage[];
    assistantMark?: string;
    reply?: string;
    placeholder?: string;
}) {
    const [log, setLog] = useState<ChatMessage[]>(messages);

    const send = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("msg") as HTMLTextAreaElement;
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        localSeq += 1;
        const id = `local-${localSeq}`;
        setLog((l) => [...l, { id: `${id}-u`, role: "user", content: text, ago: "now" }]);
        window.setTimeout(() => {
            setLog((l) => [...l, { id: `${id}-a`, role: "assistant", content: reply, ago: "now" }]);
        }, 520);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-5 overflow-y-auto px-1 py-2">
                {log.map((m) => (
                    <Bubble key={m.id} m={m} assistantMark={assistantMark} />
                ))}
            </div>
            <form
                onSubmit={send}
                className="mt-3 flex items-end gap-2 rounded-xl border bg-card p-2 shadow-e1"
            >
                <textarea
                    name="msg"
                    rows={1}
                    placeholder={placeholder}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.form?.requestSubmit();
                        }
                    }}
                    className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] outline-none placeholder:text-faint"
                />
                <button
                    type="submit"
                    aria-label="Send"
                    className="grid size-9 flex-none place-items-center rounded-lg bg-primary text-primary-foreground transition hover:brightness-105"
                >
                    <ArrowUp className="size-4" />
                </button>
            </form>
        </div>
    );
}

function Bubble({ m, assistantMark }: { m: ChatMessage; assistantMark: string }) {
    const me = m.role === "user";
    return (
        <div className={cn("flex items-start gap-3", me && "flex-row-reverse")}>
            <span
                className={cn(
                    "grid size-8 flex-none place-items-center rounded-lg text-[11px] font-bold",
                    me
                        ? "bg-foreground text-background"
                        : "bg-primary text-primary-foreground shadow-e1",
                )}
            >
                {me ? "You" : assistantMark}
            </span>
            <div
                className={cn(
                    "max-w-[440px] rounded-xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                    me
                        ? "rounded-tr-sm bg-foreground text-background"
                        : "rounded-tl-sm border border-border-soft bg-card text-foreground",
                )}
            >
                {m.content}
            </div>
        </div>
    );
}
