"use client";

import { Handle, Position } from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";
import { StatusDot } from "../status/status-dot";

// The "Infinite Canvas · command surface" card vocabulary (v2 prototype 05): a dark,
// glowing board of entity cards, opportunity cards and region labels. The board forces
// `.dark`, so app tokens resolve to the neon-on-near-black palette (info=blue,
// approval=violet, success=green, warning=amber).
//
// These are PRESENTATIONAL: they take colours and copy as props. The app's React Flow
// renderers unwrap `data`, decide which colour/copy each state gets, and render one of
// these - which also keeps every hook above the renderer's `data.kind` guard.

// Hidden connection handles (edges are decorative; we don't want visible dots).
export const HIDDEN_HANDLE = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

/** The invisible left-target / right-source pair every wired card carries. */
export function CanvasHandles() {
    return (
        <>
            <Handle id="l" type="target" position={Position.Left} className={HIDDEN_HANDLE} />
            <Handle id="r" type="source" position={Position.Right} className={HIDDEN_HANDLE} />
        </>
    );
}

// ---------------------------------------------------------------- current line
export type CanvasCurrentLineProps = {
    /** Any CSS colour - tints the dot and the text together. */
    color: string;
    text: ReactNode;
    pulse?: boolean;
    className?: string;
};

/** The one-line "what this entity is doing right now" strip at the foot of a card. */
export function CanvasCurrentLine({ color, text, pulse, className }: CanvasCurrentLineProps) {
    return (
        <div
            className={cn("flex items-center gap-2 font-mono text-[11px]", className)}
            style={{ color }}
        >
            <StatusDot size="md" color={color} pulse={pulse} className="flex-none" />
            {text}
        </div>
    );
}

// -------------------------------------------------------------------- ribbon
const RIBBON =
    "absolute -top-2.5 right-3.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]";

export type CanvasRibbonProps = {
    children: ReactNode;
    /** Capsule fill + the colour its glow is mixed from. */
    color?: string;
    /** Ink on the capsule - a near-black that reads on the violet default. */
    textColor?: string;
    className?: string;
};

/** The attention tab that overhangs a card's top-right corner ("needs you"). */
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

// ---------------------------------------------------------------- entity card
export type CanvasStat = { value: ReactNode; label: string };

export type CanvasEntityCardProps = {
    name: ReactNode;
    /** Right-aligned mono key (the slug / handle). */
    meta?: ReactNode;
    /** Fill of the leading state dot. */
    statusColor: string;
    /** Its glow, as a raw box-shadow ("0 0 10px var(--success)" or "none"). */
    statusGlow?: string;
    /**
     * Persistent aura colour + border tint (building / needs-you). When unset the card
     * keeps the neutral border and only lights the ring up on hover.
     */
    accent?: string;
    /** Ring colour used for the hover-only glow when `accent` is unset. */
    hoverAccent?: string;
    /** Overhanging corner tab - typically a <CanvasRibbon />. */
    ribbon?: ReactNode;
    /** Inline chip after the name ("here"). */
    badge?: ReactNode;
    /** The stat row under the hairline. */
    stats?: CanvasStat[];
    /** Foot of the card - typically a <CanvasCurrentLine />. */
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
                "group relative w-[260px] cursor-pointer rounded-[14px] border p-4 transition-[transform,border-color] duration-200 hover:-translate-y-[3px]",
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
            {/* glow ring: persistent for building/needs-you, on hover otherwise */}
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
                <StatusDot size="xl" color={statusColor} glow={statusGlow} className="flex-none" />
                <span className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
                    {name}
                </span>
                {badge}
                {meta !== undefined && (
                    <span className="ml-auto font-mono text-[10.5px] text-faint">{meta}</span>
                )}
            </div>

            {stats && stats.length > 0 && (
                <div className="mb-3 flex gap-3.5 border-t border-border pt-2.5">
                    {stats.map((s) => (
                        <div key={s.label} className="flex flex-col gap-px">
                            <b className="font-mono text-[14px] font-semibold text-foreground">
                                {s.value}
                            </b>
                            <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
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

/** The inline "you are here" chip that sits after an entity card's name. */
export function CanvasHereBadge({ children }: { children: ReactNode }) {
    return (
        <span className="rounded bg-[color:var(--info)]/15 px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--info)]">
            {children}
        </span>
    );
}

// ----------------------------------------------------------- opportunity card
export type CanvasOpportunityCardProps = {
    title: ReactNode;
    score: ReactNode;
    /** Colour of the score chip's numerals - the app owns the threshold decision. */
    scoreColor: string;
    thesis: ReactNode;
    /** Dim the card and drop the hover lift (a killed / archived candidate). */
    muted?: boolean;
    /** Bottom slot - a <CanvasNodeAction /> or a <CanvasNodeNotice />. */
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
                <span className="text-[13.5px] font-bold text-foreground">{title}</span>
                <span
                    className="ml-auto rounded-[7px] px-1.5 py-0.5 font-mono text-[13px] font-bold"
                    style={{ color: scoreColor, background: "rgba(255,255,255,.04)" }}
                >
                    {score}
                </span>
            </div>
            <p className="text-[11px] leading-[1.4] text-muted-foreground">{thesis}</p>
            {footer}
        </div>
    );
}

/** A dead-end state stamp at the foot of a card ("killed"). */
export function CanvasNodeNotice({
    children,
    className,
}: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "mt-2.5 rounded-lg border border-[color:var(--destructive)]/25 bg-[color:var(--destructive)]/8 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.05em] text-[color:var(--destructive)]",
                className,
            )}
        >
            {children}
        </div>
    );
}

/**
 * The full-width CTA at the foot of a card ("↑ promote to company"). `nodrag nopan`
 * keeps the click from being swallowed by the pan/zoom surface, and the click is
 * stopped from bubbling so the board's onNodeClick doesn't also fire.
 */
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
                "nodrag nopan mt-2.5 w-full rounded-lg border border-[color:var(--approval)]/30 bg-[color:var(--approval)]/12 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.05em] text-[color:var(--approval)] transition-colors hover:bg-[color:var(--approval)]/25",
                className,
            )}
        >
            {children}
        </button>
    );
}

// -------------------------------------------------------------- region label
export type CanvasRegionLabelProps = {
    /** The whole caption; its FIRST whitespace-delimited token is accented. */
    label: string;
    accentColor?: string;
    className?: string;
};

/** The big tracked-out caption that names a region of the board. */
export function CanvasRegionLabel({
    label,
    accentColor = "var(--info)",
    className,
}: CanvasRegionLabelProps) {
    const [tick, ...rest] = label.split(" ");
    return (
        <div
            className={cn(
                "pointer-events-none whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.35em] text-faint",
                className,
            )}
        >
            <span style={{ color: accentColor }}>{tick}</span> {rest.join(" ")}
        </div>
    );
}
