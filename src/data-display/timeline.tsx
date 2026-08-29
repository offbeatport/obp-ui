"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type TimelineProps = {
    children: ReactNode;
    spine?: boolean;
    className?: string;
};

export function Timeline({ children, spine = true, className }: TimelineProps) {
    return (
        <ol className={cn("relative m-0 list-none p-0", className)}>
            {spine && <span className="absolute bottom-3 left-[11px] top-3 w-px bg-border" />}
            {children}
        </ol>
    );
}

export type TimelineItemProps = {
    dot?: ReactNode;
    children: ReactNode;
    className?: string;
};

export function TimelineItem({ dot, children, className }: TimelineItemProps) {
    return (
        <li className={cn("relative flex gap-4 pb-5 pl-0 last:pb-0", className)}>
            {dot}
            {children}
        </li>
    );
}

export type TimelineDotProps = {
    color: string;
    pulse?: boolean;
    icon?: LucideIcon;
    children?: ReactNode;
    className?: string;
};

export function TimelineDot({ color, pulse, icon: Icon, children, className }: TimelineDotProps) {
    return (
        <span className="relative z-10 mt-1 flex-none">
            <span
                className={cn(
                    "grid size-[23px] place-items-center rounded-full",
                    pulse && "animate-pulse",
                    className,
                )}
                style={{
                    background: `color-mix(in srgb, ${color} 16%, var(--card))`,
                    boxShadow: `0 0 0 4px var(--background), inset 0 0 0 1.5px ${color}`,
                    color,
                }}
            >
                {children ?? (Icon ? <Icon className="size-3" strokeWidth={2.4} /> : null)}
            </span>
        </span>
    );
}
