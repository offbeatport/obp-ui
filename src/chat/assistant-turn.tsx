"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

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
