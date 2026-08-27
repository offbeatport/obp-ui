"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// The "needs you" attention pill from the company card (prototype `.co-pip`): a solid primary
// capsule whose leading pip fires the co-pip ring-pulse. The pip is a ::before rather than an
// element so the pill stays a single inline node, and the expanding ring is a box-shadow (it
// must not affect layout). motion-reduce stills it.

const PULSE_PILL =
    "inline-flex flex-none items-center gap-[5px] rounded-full bg-primary px-2 py-[3px] font-mono text-sm font-semibold tracking-[0.03em] text-primary-foreground before:size-1.5 before:animate-[co-pip_1.6s_ease-out_infinite] before:rounded-full before:bg-current before:content-[''] motion-reduce:before:animate-none";

export type PulsePillProps = { children: ReactNode; className?: string };

export function PulsePill({ children, className }: PulsePillProps) {
    return <span className={cn(PULSE_PILL, className)}>{children}</span>;
}
