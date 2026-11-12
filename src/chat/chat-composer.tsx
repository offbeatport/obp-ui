"use client";

import { Loader2 } from "lucide-react";
import { type KeyboardEvent, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export type ChatComposerVariant = "panel" | "dock";
export type ChatComposerSendOn = "enter" | "mod-enter";

const PANEL_SHELL = "relative px-3.5 pb-3.5 pt-2";
const PANEL_TEXTAREA =
    "block max-h-[260px] min-h-[120px] w-full resize-none rounded-xl border bg-card px-3.5 py-[13px] pr-12 text-base leading-relaxed outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60";
const PANEL_BUTTON =
    "absolute right-6 bottom-6 grid size-[30px] place-items-center rounded-full bg-primary text-base text-primary-foreground active:scale-95 disabled:opacity-40";

const DOCK_SHELL = "px-5 pb-10 pt-2";
const DOCK_FIELD =
    "relative rounded-lg border bg-card focus-within:border-ring focus-within:ring-1 focus-within:ring-ring";
const DOCK_TEXTAREA =
    "block max-h-48 min-h-14 w-full resize-none rounded-xl bg-transparent px-5 py-4 pr-14 leading-snug tracking-tight outline-none placeholder:text-muted-foreground/45 disabled:cursor-not-allowed disabled:opacity-60";
const DOCK_BUTTON =
    "absolute right-3 bottom-2 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40";

const SEND_SHORTCUTS: Record<ChatComposerSendOn, string> = {
    enter: "Enter",
    "mod-enter": "Meta+Enter Control+Enter",
};

export type ChatComposerProps = {
    onSend: (text: string) => Promise<void> | void;
    variant?: ChatComposerVariant;
    placeholder?: string;
    label?: string;
    rows?: number;
    disabled?: boolean;
    busy?: boolean;
    onStop?: () => void;
    sendOn?: ChatComposerSendOn;
    optimisticClear?: boolean;
    refocus?: boolean;
    spinner?: boolean;
    className?: string;
    textareaClassName?: string;
};

function sends(event: KeyboardEvent<HTMLTextAreaElement>, sendOn: ChatComposerSendOn): boolean {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return false;
    if (sendOn === "mod-enter") return event.metaKey || event.ctrlKey;
    return !event.shiftKey;
}

function fitToContent(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

export function ChatComposer({
    onSend,
    variant = "panel",
    placeholder,
    label = "Message",
    rows,
    disabled,
    busy = false,
    onStop,
    sendOn = "enter",
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
    const blocked = sending || busy || disabled;
    const stoppable = busy && onStop !== undefined;
    const buttonClass = dock ? DOCK_BUTTON : PANEL_BUTTON;

    useLayoutEffect(() => fitToContent(ref.current));

    const submit = async () => {
        const t = text.trim();
        if (!t || blocked) return;
        setSending(true);
        if (clearEarly) setText("");
        try {
            await onSend(t);
            if (!clearEarly) setText("");
        } catch {
            if (clearEarly) setText(t);
        } finally {
            setSending(false);
            if (focusAfter) ref.current?.focus();
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (sends(event, sendOn)) {
            event.preventDefault();
            void submit();
        }
    };

    const field = (
        <>
            <textarea
                ref={ref}
                rows={rows ?? 1}
                value={text}
                disabled={disabled}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label={label}
                className={cn(dock ? DOCK_TEXTAREA : PANEL_TEXTAREA, textareaClassName)}
            />
            {stoppable ? (
                <button type="button" aria-label="Stop" onClick={onStop} className={buttonClass}>
                    <span aria-hidden="true" className="size-3 rounded-md bg-current" />
                </button>
            ) : (
                <button
                    type="button"
                    aria-label="Send"
                    aria-keyshortcuts={SEND_SHORTCUTS[sendOn]}
                    onClick={() => void submit()}
                    disabled={blocked || !text.trim()}
                    className={buttonClass}
                >
                    {sending && showSpinner ? <Loader2 className="size-4 animate-spin" /> : "↑"}
                </button>
            )}
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
