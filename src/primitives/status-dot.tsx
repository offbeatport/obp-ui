import type * as React from "react";

import { cn } from "../lib/cn";

export type StatusDotTone = "success" | "warning" | "destructive" | "info" | "neutral" | "muted";

export type StatusDotSize = "sm" | "md";

const TONE: Record<StatusDotTone, string> = {
    success: "[--tone:var(--success)]",
    warning: "[--tone:var(--warning)]",
    destructive: "[--tone:var(--destructive)]",
    info: "[--tone:var(--info)]",
    neutral: "[--tone:var(--neutral)]",
    muted: "[--tone:var(--faint)]",
};

const SIZE: Record<StatusDotSize, string> = {
    sm: "size-2.5",
    md: "size-3",
};

const RADIUS = 4.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TRACK =
    "fill-none stroke-[color-mix(in_srgb,var(--tone)_22%,transparent)] [stroke-width:2.5]";
const FULL = "fill-none stroke-[var(--tone)]";

type StatusDotProps = Omit<React.ComponentProps<"svg">, "children"> & {
    tone?: StatusDotTone;
    active?: boolean;
    waiting?: boolean;
    progress?: number | null;
    size?: StatusDotSize;
    label?: string;
};

function clampPercent(value: number): number {
    return Math.min(100, Math.max(0, value));
}

function spokenLabel(label: string | undefined, progress: number | null): string | undefined {
    if (!label) {
        return undefined;
    }
    return progress === null ? label : `${label}, ${Math.round(progress)}%`;
}

function Mark({
    tone,
    active,
    waiting,
    progress,
}: { tone: StatusDotTone; active: boolean; waiting: boolean; progress: number | null }) {
    if (waiting) {
        return (
            <circle
                cx="6"
                cy="6"
                r={RADIUS}
                className={cn(FULL, "[stroke-width:2.5] [stroke-dasharray:2_2.1]")}
            />
        );
    }
    if (progress !== null) {
        return (
            <>
                <circle cx="6" cy="6" r={RADIUS} className={TRACK} />
                <circle
                    cx="6"
                    cy="6"
                    r={RADIUS}
                    strokeDasharray={`${(CIRCUMFERENCE * progress) / 100} ${CIRCUMFERENCE}`}
                    className={cn(
                        FULL,
                        "origin-center -rotate-90 [stroke-linecap:round] [stroke-width:2.5]",
                    )}
                />
            </>
        );
    }
    if (tone === "muted") {
        return <circle cx="6" cy="6" r={RADIUS} className={cn(FULL, "[stroke-width:1.5]")} />;
    }
    return (
        <>
            <circle cx="6" cy="6" r={RADIUS} className={TRACK} />
            {active && (
                <circle
                    cx="6"
                    cy="6"
                    r="3.2"
                    className="fill-[var(--tone)] opacity-0 [transform-box:fill-box] origin-center motion-safe:animate-[status-dot-ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"
                />
            )}
            <circle cx="6" cy="6" r="3.2" className="fill-[var(--tone)]" />
        </>
    );
}

function StatusDot({
    tone = "neutral",
    active = false,
    waiting = false,
    progress = null,
    size = "md",
    label,
    className,
    ...props
}: StatusDotProps) {
    const percent = progress === null || waiting ? null : clampPercent(progress);
    const spoken = spokenLabel(label, percent);
    return (
        <svg
            data-slot="status-dot"
            data-tone={tone}
            data-active={(active && percent === null && !waiting) || undefined}
            data-waiting={waiting || undefined}
            data-progress={percent ?? undefined}
            viewBox="0 0 12 12"
            role={spoken ? "img" : undefined}
            aria-label={spoken}
            aria-hidden={spoken ? undefined : true}
            className={cn(
                "inline-block shrink-0 overflow-visible",
                SIZE[size],
                TONE[tone],
                className,
            )}
            {...props}
        >
            <Mark tone={tone} active={active} waiting={waiting} progress={percent} />
        </svg>
    );
}

export { StatusDot, type StatusDotProps };
