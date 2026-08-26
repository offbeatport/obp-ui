"use client";

import { User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Markdown } from "../markdown";
import { StatusDot } from "../status";

// The chat message. Two looks, unified - both stay reachable through `variant`:
//
//   "panel"   the docked company co-pilot bubble (prototype `.cpg-chat .msg` / `.bubble`): a real
//             avatar column, a 13.5px body, a tinted primary capsule for the founder and a flat
//             body for the company, with the relative timestamp under the text.
//   "thread"  the full-page spin thread (prototype `.spin-msg` / `.spin-bubble`): NO avatar - the
//             prototype keeps a hidden letter node so the stream body owns the whole column - a
//             16px body, and a staggered entrance animation.
//
// The assistant bubble renders FLAT in BOTH variants: the prototype's
// `.spin-msg.assistant .spin-bubble` override strips the bubble chrome (no bg/border/shadow/
// radius), leaving plain body text. That is load-bearing, not an oversight - the company speaks in
// the page's own voice, only the founder gets a capsule.
//
// Message content is caller data: pass `text` (rendered as Markdown for the assistant, plain for
// the founder) or take full control with `children`.

export type ChatRole = "user" | "assistant" | "system";
export type ChatBubbleVariant = "panel" | "thread";

// The flat assistant body, exported because artifact turns (a drafting line, a retry prompt) need
// to match a real assistant bubble exactly.
export const ASSISTANT_BUBBLE = "max-w-[78%] text-[16px] leading-[1.55] py-[2px]";

// ---- panel ---------------------------------------------------------------------------------
const PANEL_ROW = "flex max-w-full items-start gap-[11px]";
const PANEL_USER_AVATAR =
    "mt-px grid size-7 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-secondary font-display text-sm font-bold text-muted-foreground";
const PANEL_BODY = "text-[13.5px] leading-normal";
const PANEL_USER_BODY =
    "max-w-[300px] rounded-[14px_5px_14px_14px] bg-primary px-3.5 py-2.5 text-white";
const PANEL_ASSISTANT_BODY =
    "max-w-[440px] rounded-[5px_14px_14px_14px] pt-0.5 pb-[3px] text-foreground";
const PANEL_TIME = "mt-[7px] block font-mono text-[10px]";

// ---- thread --------------------------------------------------------------------------------
const THREAD_ROW = "flex gap-[12px] items-start my-10";
const THREAD_COLUMN = "flex-1 min-w-0 flex flex-col gap-[11px]";
const THREAD_BODY = "max-w-[78%] text-[16px] leading-[1.55]";
// entrance: plays once on mount (a stable message-id key → no replay on polls)
const THREAD_USER_BODY =
    "px-[16px] py-[12px] rounded-[16px] rounded-tr-[5px] shadow-e1 bg-foreground text-background animate-[msg-in_0.32s_cubic-bezier(0.22,0.7,0.24,1)_both]";
const THREAD_ASSISTANT_BODY =
    "py-[2px] animate-[msg-reveal_0.45s_cubic-bezier(0.22,0.7,0.24,1)_both]";

export type ChatBubbleProps = {
    role: ChatRole;
    variant?: ChatBubbleVariant;
    /** Message text. Assistant text renders through <Markdown>; founder text renders verbatim. */
    text?: string;
    /** Full control over the body - wins over `text`. */
    children?: ReactNode;
    /** Relative timestamp ("4m ago"). Rendered under the body on "panel", omitted on "thread". */
    timestamp?: ReactNode;
    /** The assistant avatar (a company logo, say) - "panel" only. */
    avatar?: ReactNode;
    /** Override the default person glyph for the founder - "panel" only. */
    userAvatar?: ReactNode;
    /** Entrance stagger in ms - "thread" only. `both` fill-mode keeps a delayed bubble invisible
     *  until its turn. Live messages arriving later pass 0 and animate immediately. */
    delayMs?: number;
    className?: string;
};

export function ChatBubble({
    role,
    variant = "panel",
    text,
    children,
    timestamp,
    avatar,
    userAvatar,
    delayMs = 0,
    className,
}: ChatBubbleProps) {
    if (role === "system") {
        return <ChatSystemLine text={children ?? text} ago={timestamp} className={className} />;
    }

    const me = role === "user";
    const body =
        children ??
        (me ? (
            // The panel bubble wraps founder text in a <p>; the thread bubble sets it raw.
            variant === "panel" ? (
                <p>{text}</p>
            ) : (
                text
            )
        ) : (
            <Markdown content={text ?? ""} />
        ));

    if (variant === "thread") {
        return (
            <div className={cn(THREAD_ROW, me && "flex-row-reverse", className)}>
                {/* The prototype keeps the avatar node but hides it - the stream body is the column. */}
                <div className="hidden">{me ? "V" : "C"}</div>
                <div className={THREAD_COLUMN} style={me ? { alignItems: "flex-end" } : undefined}>
                    <div
                        className={cn(THREAD_BODY, me ? THREAD_USER_BODY : THREAD_ASSISTANT_BODY)}
                        style={delayMs > 0 ? { animationDelay: `${delayMs}ms` } : undefined}
                    >
                        {body}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(PANEL_ROW, me && "flex-row-reverse", className)}>
            {me
                ? (userAvatar ?? (
                      <span className={PANEL_USER_AVATAR}>
                          <User className="size-[15px]" />
                      </span>
                  ))
                : avatar}
            <div className={cn(PANEL_BODY, me ? PANEL_USER_BODY : PANEL_ASSISTANT_BODY)}>
                {body}
                {timestamp !== undefined && (
                    <span className={cn(PANEL_TIME, me ? "text-white/70" : "text-faint")}>
                        {timestamp}
                    </span>
                )}
            </div>
        </div>
    );
}

// A system line: not a bubble at all but a compact mono status row with a live dot, threaded
// in-line with the conversation ("deployed v3", "budget cap raised").
export type ChatSystemLineProps = {
    text: ReactNode;
    ago?: ReactNode;
    className?: string;
};

export function ChatSystemLine({ text, ago, className }: ChatSystemLineProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 px-1.5 py-px font-mono text-[10.5px] text-faint",
                className,
            )}
        >
            <StatusDot
                size="xs"
                colorClassName="bg-success"
                ring="var(--success-soft)"
                className="shrink-0"
            />
            <span className="min-w-0 truncate">{text}</span>
            {ago !== undefined && <span className="ml-auto opacity-[0.65]">{ago}</span>}
        </div>
    );
}
