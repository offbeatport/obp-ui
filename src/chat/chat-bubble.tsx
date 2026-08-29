"use client";

import { User } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Markdown } from "../markdown";

export type ChatRole = "user" | "assistant" | "system";
export type ChatBubbleVariant = "panel" | "thread";

export const ASSISTANT_BUBBLE = "max-w-[78%] text-base leading-[1.55] py-[2px]";

const PANEL_ROW = "flex max-w-full items-start gap-[11px]";
const PANEL_USER_AVATAR =
    "mt-px grid size-7 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-secondary font-display text-sm font-bold text-muted-foreground";
const PANEL_BODY = "text-sm leading-normal";
const PANEL_USER_BODY =
    "max-w-[300px] rounded-[14px_5px_14px_14px] bg-primary px-3.5 py-2.5 text-primary-foreground";
const PANEL_ASSISTANT_BODY =
    "max-w-[440px] rounded-[5px_14px_14px_14px] pt-0.5 pb-[3px] text-foreground";
const PANEL_TIME = "mt-[7px] block font-mono text-sm";

const THREAD_ROW = "flex gap-[12px] items-start my-10";
const THREAD_COLUMN = "flex-1 min-w-0 flex flex-col gap-[11px]";
const THREAD_BODY = "max-w-[78%] text-base leading-[1.55]";
const THREAD_USER_BODY =
    "px-[16px] py-[12px] rounded-[16px] rounded-tr-[5px] shadow-e1 bg-foreground text-background animate-[msg-in_0.32s_cubic-bezier(0.22,0.7,0.24,1)_both]";
const THREAD_ASSISTANT_BODY =
    "py-[2px] animate-[msg-reveal_0.45s_cubic-bezier(0.22,0.7,0.24,1)_both]";

export type ChatBubbleProps = {
    role: ChatRole;
    variant?: ChatBubbleVariant;
    text?: string;
    children?: ReactNode;
    timestamp?: ReactNode;
    avatar?: ReactNode;
    userAvatar?: ReactNode;
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
        (me ? variant === "panel" ? <p>{text}</p> : text : <Markdown content={text ?? ""} />);

    if (variant === "thread") {
        return (
            <div className={cn(THREAD_ROW, me && "flex-row-reverse", className)}>
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
                    <span
                        className={cn(PANEL_TIME, me ? "text-primary-foreground/70" : "text-faint")}
                    >
                        {timestamp}
                    </span>
                )}
            </div>
        </div>
    );
}

export type ChatSystemLineProps = {
    text: ReactNode;
    ago?: ReactNode;
    className?: string;
};

export function ChatSystemLine({ text, ago, className }: ChatSystemLineProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-2 px-1.5 py-px font-mono text-sm text-faint",
                className,
            )}
        >
            <span
                aria-hidden="true"
                className="size-[5px] shrink-0 rounded-full bg-success"
                style={{ boxShadow: "0 0 0 3px var(--success-soft)" }}
            />
            <span className="min-w-0 truncate">{text}</span>
            {ago !== undefined && <span className="ml-auto opacity-[0.65]">{ago}</span>}
        </div>
    );
}
