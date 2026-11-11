"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Badge } from "../primitives/badge";

export type ChatNoticeTone = "warning" | "destructive" | "neutral";

export type ChatNoticeProps = {
    tone?: ChatNoticeTone;
    label?: ReactNode;
    children: ReactNode;
    className?: string;
};

const TEXT: Record<ChatNoticeTone, string> = {
    warning: "text-foreground",
    destructive: "text-destructive",
    neutral: "text-muted-foreground",
};

export function ChatNotice({ tone = "neutral", label, children, className }: ChatNoticeProps) {
    return (
        <div className={cn("flex min-w-0 flex-col items-start gap-1", className)}>
            {label !== undefined && <Badge variant={tone}>{label}</Badge>}
            <p className={cn("break-words", TEXT[tone])}>{children}</p>
        </div>
    );
}

export type ChatPendingProps = {
    children?: ReactNode;
    className?: string;
};

export function ChatPending({ children = "Generating…", className }: ChatPendingProps) {
    return <output className={cn("block text-muted-foreground", className)}>{children}</output>;
}
