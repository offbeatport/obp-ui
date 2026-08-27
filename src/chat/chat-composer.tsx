"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";

// The composer: an auto-growing textarea with a round send affordance. Two looks, unified - both
// stay reachable through `variant`:
//
//   "panel"  the docked co-pilot composer: a tall bordered card that sits in the panel's flow.
//   "dock"   the floating thread composer: a rounded, elevated shell with a focus ring, sized for
//            the big Space Grotesk title input (echoes the `.spin-hero-q` hero: display font,
//            light weight, tight tracking).
//
// Sending is a prop. `onSend` MUST throw (or reject) on failure - that is what tells the composer
// to put the text back instead of eating the founder's message.
//
// The two surfaces also differ in three behaviours, kept as props that default per variant:
//   optimisticClear  clear the box the moment we submit ("dock") vs only once the write lands
//                    ("panel", so a transient RPC failure isn't data loss).
//   refocus          put the caret back in the box after a send ("dock" - it's the page's only
//                    input, so the founder keeps typing).
//   spinner          swap the arrow for a spinner while in flight ("dock").

export type ChatComposerVariant = "panel" | "dock";

const PANEL_SHELL = "relative px-3.5 pb-3.5 pt-2";
const PANEL_TEXTAREA =
    "block max-h-[260px] min-h-[120px] w-full resize-none rounded-xl border bg-card px-3.5 py-[13px] pr-12 text-sm leading-relaxed outline-none focus:border-primary";
const PANEL_SEND =
    "absolute right-6 bottom-6 grid size-[30px] place-items-center rounded-full bg-primary text-base text-primary-foreground active:scale-95 disabled:opacity-40";

const DOCK_SHELL = "px-5 pb-10 pt-2";
const DOCK_FIELD =
    "relative rounded-2xl border bg-card shadow-e1 transition focus-within:ring-2 focus-within:ring-primary/40";
const DOCK_TEXTAREA =
    "block max-h-48 min-h-14 w-full resize-none rounded-xl bg-transparent px-5 py-4 pr-14 leading-snug tracking-tight outline-none placeholder:text-muted-foreground/45";
const DOCK_SEND =
    "absolute right-3 bottom-2 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40";

export type ChatComposerProps = {
    onSend: (text: string) => Promise<void> | void;
    variant?: ChatComposerVariant;
    placeholder?: string;
    /** Starting height in rows - both surfaces size through min-h, so this stays 1. */
    rows?: number;
    /** Block sending (a busy parent, a read-only thread). */
    disabled?: boolean;
    /** Clear on submit rather than on success. Defaults to true on "dock". */
    optimisticClear?: boolean;
    /** Refocus the textarea after a send. Defaults to true on "dock". */
    refocus?: boolean;
    /** Show a spinner in the send button while in flight. Defaults to true on "dock". */
    spinner?: boolean;
    className?: string;
    textareaClassName?: string;
};

export function ChatComposer({
    onSend,
    variant = "panel",
    placeholder,
    rows = 1,
    disabled,
    optimisticClear,
    refocus,
    spinner,
    className,
    textareaClassName,
}: ChatComposerProps) {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const ref = useRef<HTMLTextAreaElement>(null);

    const dock = variant === "dock";
    const clearEarly = optimisticClear ?? dock;
    const focusAfter = refocus ?? dock;
    const showSpinner = spinner ?? dock;

    const submit = async () => {
        const t = text.trim();
        if (!t || sending || disabled) return;
        setSending(true);
        if (clearEarly) setText("");
        try {
            await onSend(t);
            // clear only after the write succeeds - don't lose text on failure
            if (!clearEarly) setText("");
        } catch {
            // keep the text so the founder can retry; a transient RPC failure isn't data loss
            if (clearEarly) setText(t);
        } finally {
            setSending(false);
            if (focusAfter) ref.current?.focus();
        }
    };

    const field = (
        <>
            <textarea
                ref={ref}
                rows={rows}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                    }
                }}
                placeholder={placeholder}
                className={cn(dock ? DOCK_TEXTAREA : PANEL_TEXTAREA, textareaClassName)}
            />
            <button
                type="button"
                aria-label="Send"
                onClick={() => void submit()}
                disabled={disabled || sending || !text.trim()}
                className={dock ? DOCK_SEND : PANEL_SEND}
            >
                {sending && showSpinner ? <Loader2 className="size-4 animate-spin" /> : "↑"}
            </button>
        </>
    );

    if (dock) {
        return (
            <div className={cn(DOCK_SHELL, className)}>
                <div className={DOCK_FIELD}>{field}</div>
            </div>
        );
    }
    return <div className={cn(PANEL_SHELL, className)}>{field}</div>;
}
