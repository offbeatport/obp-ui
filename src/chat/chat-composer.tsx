"use client";

import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";

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
    rows?: number;
    disabled?: boolean;
    optimisticClear?: boolean;
    refocus?: boolean;
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
            if (!clearEarly) setText("");
        } catch {
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
