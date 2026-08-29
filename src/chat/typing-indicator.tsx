"use client";

import { cn } from "../lib/cn";
import { AssistantTurn } from "./assistant-turn";

const DOT = "size-1.5 animate-bounce rounded-full bg-faint";

export type TypingIndicatorProps = {
    turn?: boolean;
    className?: string;
};

export function TypingIndicator({ turn, className }: TypingIndicatorProps) {
    const dots = (
        <span className={cn("inline-flex items-center gap-1", !turn && className)}>
            {[0, 1, 2].map((i) => (
                <span key={i} className={DOT} style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
        </span>
    );
    if (!turn) return dots;
    return (
        <AssistantTurn className={className}>
            <div className="py-[2px]">{dots}</div>
        </AssistantTurn>
    );
}
