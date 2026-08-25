"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// A bare assistant turn: the (hidden) avatar column plus the stream body that hosts anything the
// company "says" that is not prose - an artifact card, a loader, a typing indicator, an approve
// row. Matches the prototype's "assistant turn = avatar + stream-body(bubble? + card)".
//
// Same geometry as ChatBubble's "thread" variant minus the vertical message rhythm (`my-10`), so a
// card can sit tight under the message that announced it.

export type AssistantTurnProps = {
    children: ReactNode;
    className?: string;
};

export function AssistantTurn({ children, className }: AssistantTurnProps) {
    return (
        <div className={cn("flex gap-[12px] items-start", className)}>
            <div className="hidden">C</div>
            <div className="flex-1 min-w-0 flex flex-col gap-[11px]">{children}</div>
        </div>
    );
}
