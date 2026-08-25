"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { StatusDot } from "../status/status-dot";
import { FLAVORS, type Flavor } from "./flavors";
import type { CanvasFlowData } from "./graph";

// ============================================================================
// The flavor-driven card parts. ONE shell + a handful of inner lockups; the
// `flavor` in each node's data restyles the frame/text so every layout × flavor
// pairing reuses them. The app owns the per-kind renderers (they read app data);
// these supply the chrome those renderers hang content on.
// ============================================================================

const HANDLE = "!size-1.5 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent";

export type FlavorShellProps = {
    f: Flavor;
    accentColor: string;
    width: number;
    children: ReactNode;
    /** The node's `data` - only its `ht`/`hs` handle sides are read. */
    data: Pick<CanvasFlowData, "ht" | "hs">;
    hasTarget?: boolean;
    hasSource?: boolean;
    className?: string;
};

/** Card shell: applies the flavor frame + width + both handles. */
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

/** The small glowing state dot used by the leaf cards (features, channels). */
export function FlavorDot({ color }: { color: string }) {
    return (
        <StatusDot size="md" color={color} glow={`0 0 8px -1px ${color}`} className="flex-none" />
    );
}

// ------------------------------------------------------------- avatar header
export type AvatarHeaderProps = {
    /** One or two characters drawn inside the gradient tile. */
    mark: ReactNode;
    /** The two stops of the tile's 145° gradient. */
    palette: [string, string];
    title: ReactNode;
    /** Mono sub-line under the title (a domain, a handle). */
    sub?: ReactNode;
    /** The flavor's `title` classes - the header inherits the card's type scale. */
    titleClassName?: string;
    className?: string;
};

/** Gradient mark + name/sub lockup at the top of an entity card. */
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
                className="grid size-9 flex-none place-items-center rounded-[9px] font-display text-[15px] font-bold text-white"
                style={{ background: `linear-gradient(145deg, ${palette[0]}, ${palette[1]})` }}
            >
                {mark}
            </span>
            <div className="min-w-0">
                <div className={cn("truncate", titleClassName)}>{title}</div>
                {sub !== undefined && (
                    <div className="truncate font-mono text-[11px] text-faint">{sub}</div>
                )}
            </div>
        </div>
    );
}

// ------------------------------------------------------------ browser preview
export type BrowserPreviewProps = {
    /** Address-bar text. */
    url: ReactNode;
    headline: ReactNode;
    /** The call-to-action pill under the headline. */
    cta?: ReactNode;
    /** CTA fill - the node's accent. */
    ctaColor?: string;
    /** The flavor's `title` classes for the headline. */
    titleClassName?: string;
    className?: string;
};

/** Miniature browser chrome around a page preview (the landing card). */
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
                <StatusDot size="sm" colorClassName="bg-destructive/60" />
                <StatusDot size="sm" colorClassName="bg-warning/60" />
                <StatusDot size="sm" colorClassName="bg-success/60" />
                <span className="ml-1 truncate font-mono text-[9px] text-faint">{url}</span>
            </div>
            <div className="px-2.5 py-2">
                <div className={cn("line-clamp-2 text-[12px] font-semibold", titleClassName)}>
                    {headline}
                </div>
                {cta !== undefined && (
                    <div
                        className="mt-1.5 inline-block rounded-[5px] px-2 py-0.5 text-[9px] font-semibold text-white"
                        style={{ background: ctaColor }}
                    >
                        {cta}
                    </div>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- chrome nodes
type ChromeProps = NodeProps<Node<CanvasFlowData>>;

/** Section panel behind a group of nodes (swimlanes / clustered layouts). */
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
                className="px-4 pt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: a }}
            >
                {data.label}
            </div>
        </div>
    );
}

/** Column header chip (kanban / timeline stages). */
export function ColHeadNode({ data }: ChromeProps) {
    const a = data.accent ?? "var(--foreground)";
    return (
        <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
                width: data.w ?? 200,
                background: `color-mix(in srgb, ${a} 12%, var(--card))`,
                color: a,
                border: `1px solid color-mix(in srgb, ${a} 30%, var(--border))`,
            }}
        >
            <StatusDot size="lg" color={a} />
            {data.label}
        </div>
    );
}

/**
 * The chrome renderers every layout needs. Spread this into an app's `nodeTypes`
 * next to its own per-kind renderers - it MUST stay a stable module-scope object.
 */
export const chromeNodeTypes = {
    lane: LaneNode,
    colhead: ColHeadNode,
};
