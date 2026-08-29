"use client";

import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";

export const HIDDEN_HANDLE = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

export function CanvasHandles() {
    return (
        <>
            <Handle id="l" type="target" position={Position.Left} className={HIDDEN_HANDLE} />
            <Handle id="r" type="source" position={Position.Right} className={HIDDEN_HANDLE} />
        </>
    );
}

export type CanvasCurrentLineProps = {
    color: string;
    text: ReactNode;
    pulse?: boolean;
    className?: string;
};

export function CanvasCurrentLine({ color, text, pulse, className }: CanvasCurrentLineProps) {
    return (
        <div
            className={cn("flex items-center gap-2 font-mono text-sm", className)}
            style={{ color }}
        >
            <span
                aria-hidden="true"
                className={cn("size-[7px] flex-none rounded-full", pulse && "animate-pulse")}
                style={{ background: color }}
            />
            {text}
        </div>
    );
}

const RIBBON =
    "absolute -top-2.5 right-3.5 rounded-full px-2 py-[3px] font-mono text-sm font-bold uppercase tracking-[0.12em]";

export type CanvasRibbonProps = {
    children: ReactNode;
    color?: string;
    textColor?: string;
    className?: string;
};

export function CanvasRibbon({
    children,
    color = "var(--approval)",
    textColor = "#160d2e",
    className,
}: CanvasRibbonProps) {
    return (
        <span
            className={cn(RIBBON, className)}
            style={{
                background: color,
                color: textColor,
                boxShadow: `0 0 18px color-mix(in srgb, ${color} 60%, transparent)`,
            }}
        >
            {children}
        </span>
    );
}

export type CanvasStat = { value: ReactNode; label: string };

export type CanvasEntityCardProps = {
    name: ReactNode;
    meta?: ReactNode;
    statusColor: string;
    statusGlow?: string;
    accent?: string;
    hoverAccent?: string;
    ribbon?: ReactNode;
    badge?: ReactNode;
    stats?: CanvasStat[];
    footer?: ReactNode;
    className?: string;
    style?: CSSProperties;
};

export function CanvasEntityCard({
    name,
    meta,
    statusColor,
    statusGlow,
    accent,
    hoverAccent = "var(--info)",
    ribbon,
    badge,
    stats,
    footer,
    className,
    style,
}: CanvasEntityCardProps) {
    const ring = accent ?? hoverAccent;
    return (
        <div
            className={cn(
                "group relative w-[280px] cursor-pointer rounded-[14px] border p-4 transition-[transform,border-color] duration-200 hover:-translate-y-[3px]",
                className,
            )}
            style={{
                background:
                    "linear-gradient(180deg, var(--card), color-mix(in srgb, var(--card) 70%, var(--background)))",
                borderColor: accent ?? "var(--border)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
                ...style,
            }}
        >
            <span
                aria-hidden
                className={cn(
                    "pointer-events-none absolute -inset-px rounded-[15px] transition-opacity",
                    accent ? "animate-pulse opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{
                    boxShadow: `0 0 0 1px ${ring}, 0 0 26px color-mix(in srgb, ${ring} 32%, transparent)`,
                }}
            />
            {ribbon}

            <div className="mb-2.5 flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="size-[9px] flex-none rounded-full"
                    style={{ background: statusColor, boxShadow: statusGlow }}
                />
                <span className="min-w-0 truncate text-base font-bold tracking-[-0.01em] text-foreground">
                    {name}
                </span>
                {badge}
                {meta !== undefined && (
                    <span className="ml-auto flex-none font-mono text-sm text-faint">{meta}</span>
                )}
            </div>

            {stats && stats.length > 0 && (
                <div className="mb-3 flex gap-3.5 border-t border-border pt-2.5">
                    {stats.map((s) => (
                        <div key={s.label} className="flex flex-col gap-px">
                            <b className="font-mono text-sm font-semibold text-foreground">
                                {s.value}
                            </b>
                            <span className="font-mono text-sm uppercase tracking-[0.08em] text-faint">
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {footer}

            <CanvasHandles />
        </div>
    );
}

export function CanvasHereBadge({ children }: { children: ReactNode }) {
    return (
        <span className="flex-none rounded bg-[color:var(--info)]/15 px-1.5 py-px font-mono text-sm font-semibold uppercase tracking-[0.08em] text-[color:var(--info)]">
            {children}
        </span>
    );
}

export type CanvasOpportunityCardProps = {
    title: ReactNode;
    score: ReactNode;
    scoreColor: string;
    thesis: ReactNode;
    muted?: boolean;
    footer?: ReactNode;
    className?: string;
};

export function CanvasOpportunityCard({
    title,
    score,
    scoreColor,
    thesis,
    muted,
    footer,
    className,
}: CanvasOpportunityCardProps) {
    return (
        <div
            className={cn(
                "group relative w-[220px] rounded-[12px] border p-3.5 transition-[transform,border-color] duration-200",
                muted ? "opacity-45" : "hover:-translate-y-[3px]",
                className,
            )}
            style={{
                background: "linear-gradient(180deg, rgba(24,18,40,.92), rgba(16,12,28,.92))",
                borderColor: "color-mix(in srgb, var(--approval) 24%, transparent)",
                boxShadow: "0 10px 30px rgba(0,0,0,.5)",
            }}
        >
            {!muted && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-px rounded-[13px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                        boxShadow:
                            "0 0 0 1px var(--approval), 0 0 28px color-mix(in srgb, var(--approval) 34%, transparent)",
                    }}
                />
            )}
            <div className="mb-1.5 flex items-center gap-2">
                <span className="min-w-0 truncate text-sm font-bold text-foreground">{title}</span>
                <span
                    className="ml-auto flex-none rounded-[7px] px-1.5 py-0.5 font-mono text-sm font-bold"
                    style={{ color: scoreColor, background: "rgba(255,255,255,.04)" }}
                >
                    {score}
                </span>
            </div>
            <p className="text-sm leading-[1.4] text-muted-foreground">{thesis}</p>
            {footer}
        </div>
    );
}

export function CanvasNodeNotice({
    children,
    className,
}: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "mt-2.5 rounded-lg border border-[color:var(--destructive)]/25 bg-[color:var(--destructive)]/8 py-1.5 text-center font-mono text-sm uppercase tracking-[0.05em] text-[color:var(--destructive)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

export function CanvasNodeAction({
    children,
    onClick,
    className,
}: { children: ReactNode; onClick?: () => void; className?: string }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={cn(
                "nodrag nopan mt-2.5 w-full rounded-lg border border-[color:var(--approval)]/30 bg-[color:var(--approval)]/12 py-1.5 font-mono text-sm uppercase tracking-[0.05em] text-[color:var(--approval)] transition-colors hover:bg-[color:var(--approval)]/25",
                className,
            )}
        >
            {children}
        </button>
    );
}

export type CanvasRegionLabelProps = {
    label: string;
    accentColor?: string;
    className?: string;
};

export function CanvasRegionLabel({
    label,
    accentColor = "var(--info)",
    className,
}: CanvasRegionLabelProps) {
    const [tick, ...rest] = label.split(" ");
    return (
        <div
            className={cn(
                "pointer-events-none whitespace-nowrap font-mono text-sm uppercase tracking-[0.35em] text-faint",
                className,
            )}
        >
            <span style={{ color: accentColor }}>{tick}</span> {rest.join(" ")}
        </div>
    );
}
