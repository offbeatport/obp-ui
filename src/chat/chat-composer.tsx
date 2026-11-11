"use client";

import { Loader2 } from "lucide-react";
import { type FormEvent, type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";
import { KbdHint } from "../primitives/kbd";
import { Textarea } from "../primitives/textarea";

export type ChatComposerVariant = "panel" | "dock" | "form";
export type ChatComposerSendOn = "enter" | "mod-enter";

const PANEL_SHELL = "relative px-3.5 pb-3.5 pt-2";
const PANEL_TEXTAREA =
    "block max-h-[260px] min-h-[120px] w-full resize-none rounded-xl border bg-card px-3.5 py-[13px] pr-12 text-base leading-relaxed outline-none focus:border-primary";
const PANEL_SEND =
    "absolute right-6 bottom-6 grid size-[30px] place-items-center rounded-full bg-primary text-base text-primary-foreground active:scale-95 disabled:opacity-40";

const DOCK_SHELL = "px-5 pb-10 pt-2";
const DOCK_FIELD =
    "relative rounded-lg border bg-card focus-within:border-ring focus-within:ring-1 focus-within:ring-ring";
const DOCK_TEXTAREA =
    "block max-h-48 min-h-14 w-full resize-none rounded-xl bg-transparent px-5 py-4 pr-14 leading-snug tracking-tight outline-none placeholder:text-muted-foreground/45";
const DOCK_SEND =
    "absolute right-3 bottom-2 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40";

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
    hint?: ReactNode;
    optimisticClear?: boolean;
    refocus?: boolean;
    spinner?: boolean;
    className?: string;
    textareaClassName?: string;
};

function modKey(): string {
    return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent)
        ? "⌘"
        : "Ctrl";
}

function sends(event: KeyboardEvent<HTMLTextAreaElement>, sendOn: ChatComposerSendOn): boolean {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return false;
    if (sendOn === "mod-enter") return event.metaKey || event.ctrlKey;
    return !event.shiftKey;
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
    sendOn,
    hint,
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
    const form = variant === "form";
    const clearEarly = optimisticClear ?? (dock || form);
    const focusAfter = refocus ?? dock;
    const showSpinner = spinner ?? dock;
    const keys = sendOn ?? (form ? "mod-enter" : "enter");
    const blocked = sending || busy || disabled;

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
        if (sends(event, keys)) {
            event.preventDefault();
            void submit();
        }
    };

    if (form) {
        const onSubmit = (event: FormEvent) => {
            event.preventDefault();
            void submit();
        };
        const shownHint =
            hint ??
            (keys === "mod-enter" ? (
                <KbdHint keys={[modKey(), "Enter"]}>sends</KbdHint>
            ) : (
                <KbdHint keys={["Shift", "Enter"]}>adds a line</KbdHint>
            ));
        return (
            <form onSubmit={onSubmit} className={cn("flex flex-col gap-2 p-4", className)}>
                <Textarea
                    ref={ref}
                    value={text}
                    rows={rows ?? 3}
                    disabled={disabled}
                    placeholder={placeholder}
                    aria-label={label}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={onKeyDown}
                    className={cn("max-h-64 resize-none", textareaClassName)}
                />
                <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">{shownHint}</span>
                    {busy && onStop ? (
                        <Button type="button" variant="outline" onClick={onStop}>
                            Stop
                        </Button>
                    ) : (
                        <Button type="submit" disabled={blocked || !text.trim()}>
                            Send
                        </Button>
                    )}
                </div>
            </form>
        );
    }

    const field = (
        <>
            <textarea
                ref={ref}
                rows={rows ?? 1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                aria-label={label}
                className={cn(dock ? DOCK_TEXTAREA : PANEL_TEXTAREA, textareaClassName)}
            />
            <button
                type="button"
                aria-label="Send"
                onClick={() => void submit()}
                disabled={blocked || !text.trim()}
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
