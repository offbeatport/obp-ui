"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import type { LogLineData } from "./log-line";
import { LogLine } from "./log-line";
import { LogView } from "./log-view";
import { useNearBottomScroll } from "./use-near-bottom";

const HEADER = "flex flex-none items-center gap-2 border-b border-border px-3 py-[9px]";
const TITLE =
    "overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-foreground";
const CHIP = "ml-auto flex-none rounded-md px-1.5 font-mono text-sm leading-5 font-medium";

export type ConsoleStatusChip = {
    label: ReactNode;
    className?: string;
};

export type ConsolePaneProps = {
    title: ReactNode;
    logo?: ReactNode;
    status?: ConsoleStatusChip;
    lines: readonly LogLineData[];
    active?: boolean;
    activeLabel?: ReactNode;
    className?: string;
};

export function ConsolePane({
    title,
    logo,
    status,
    lines,
    active,
    activeLabel = "● working…",
    className,
}: ConsolePaneProps) {
    const scrollRef = useNearBottomScroll<HTMLDivElement>(lines);
    return (
        <section className={cn("flex min-h-[210px] min-w-0 flex-col bg-card", className)}>
            <div className={HEADER}>
                {logo}
                <span className={TITLE}>{title}</span>
                {status && <span className={cn(CHIP, status.className)}>{status.label}</span>}
            </div>
            <LogView
                ref={scrollRef}
                lines={lines}
                footer={active ? <LogLine line={{ msg: activeLabel, kind: "act" }} /> : undefined}
            />
        </section>
    );
}
