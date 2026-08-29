"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { FLAVORS, type Flavor } from "./flavors";
import type { CanvasFlowData } from "./graph";

const HANDLE = "!size-1.5 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent";

export type FlavorShellProps = {
    f: Flavor;
    accentColor: string;
    width: number;
    children: ReactNode;
    data: Pick<CanvasFlowData, "ht" | "hs">;
    hasTarget?: boolean;
    hasSource?: boolean;
    className?: string;
};

export function FlavorShell({
    f,
    accentColor,
    width,
    children,
    data,
    hasTarget = true,
    hasSource = true,
    className,
}: FlavorShellProps) {
    const ht = data.ht ?? Position.Left;
    const hs = data.hs ?? Position.Right;
    return (
        <div
            className={cn("px-4 py-3", f.radius, className)}
            style={{ width, ...f.frame(accentColor) } as CSSProperties}
        >
            {hasTarget && <Handle type="target" position={ht} className={HANDLE} />}
            {children}
            {hasSource && <Handle type="source" position={hs} className={HANDLE} />}
        </div>
    );
}

export function FlavorDot({ color }: { color: string }) {
    return (
        <span
            aria-hidden="true"
            className="size-[7px] flex-none rounded-full"
            style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }}
        />
    );
}

export type AvatarHeaderProps = {
    mark: ReactNode;
    palette: [string, string];
    title: ReactNode;
    sub?: ReactNode;
    titleClassName?: string;
    className?: string;
};

export function AvatarHeader({
    mark,
    palette,
    title,
    sub,
    titleClassName,
    className,
}: AvatarHeaderProps) {
    return (
        <div className={cn("flex items-center gap-3", className)}>
            <span
                className="grid size-9 flex-none place-items-center rounded-[9px] font-display text-base font-bold text-white"
                style={{ background: `linear-gradient(145deg, ${palette[0]}, ${palette[1]})` }}
            >
                {mark}
            </span>
            <div className="min-w-0">
                <div className={cn("truncate", titleClassName)}>{title}</div>
                {sub !== undefined && (
                    <div className="truncate font-mono text-sm text-faint">{sub}</div>
                )}
            </div>
        </div>
    );
}

export type BrowserPreviewProps = {
    url: ReactNode;
    headline: ReactNode;
    cta?: ReactNode;
    ctaColor?: string;
    titleClassName?: string;
    className?: string;
};

export function BrowserPreview({
    url,
    headline,
    cta,
    ctaColor,
    titleClassName,
    className,
}: BrowserPreviewProps) {
    return (
        <div
            className={cn(
                "mt-1.5 overflow-hidden rounded-[7px] border border-border-soft",
                className,
            )}
        >
            <div className="flex items-center gap-1 bg-secondary px-2 py-1">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive/60" />
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning/60" />
                <span aria-hidden="true" className="size-1.5 rounded-full bg-success/60" />
                <span className="ml-1 truncate font-mono text-sm text-faint">{url}</span>
            </div>
            <div className="px-2.5 py-2">
                <div className={cn("line-clamp-2 text-sm font-semibold", titleClassName)}>
                    {headline}
                </div>
                {cta !== undefined && (
                    <div
                        className="mt-1.5 inline-block rounded-[5px] px-2 py-0.5 text-sm font-semibold text-white"
                        style={{ background: ctaColor }}
                    >
                        {cta}
                    </div>
                )}
            </div>
        </div>
    );
}

type ChromeProps = NodeProps<Node<CanvasFlowData>>;

export function LaneNode({ data }: ChromeProps) {
    const f = FLAVORS[data.flavor];
    const a = data.accent ?? "var(--faint)";
    return (
        <div
            className="rounded-[18px]"
            style={{
                width: data.w ?? 300,
                height: data.h ?? 200,
                background: f.dark
                    ? "rgba(255,255,255,0.03)"
                    : `color-mix(in srgb, ${a} 5%, transparent)`,
                border: `1px dashed color-mix(in srgb, ${a} 40%, var(--border))`,
            }}
        >
            <div
                className="px-4 pt-3 font-mono text-sm font-bold uppercase tracking-[0.16em]"
                style={{ color: a }}
            >
                {data.label}
            </div>
        </div>
    );
}

export function ColHeadNode({ data }: ChromeProps) {
    const a = data.accent ?? "var(--foreground)";
    return (
        <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-[0.14em]"
            style={{
                width: data.w ?? 200,
                background: `color-mix(in srgb, ${a} 12%, var(--card))`,
                color: a,
                border: `1px solid color-mix(in srgb, ${a} 30%, var(--border))`,
            }}
        >
            <span aria-hidden="true" className="size-2 rounded-full" style={{ background: a }} />
            {data.label}
        </div>
    );
}

export const chromeNodeTypes = {
    lane: LaneNode,
    colhead: ColHeadNode,
};
