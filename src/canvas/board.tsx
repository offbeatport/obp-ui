"use client";

import {
    Background,
    BackgroundVariant,
    Controls,
    type Edge,
    MiniMap,
    type MiniMapProps,
    type Node,
    ReactFlow,
    type ReactFlowProps,
    ReactFlowProvider,
} from "@xyflow/react";
import type { CSSProperties, ReactNode } from "react";
import { ClientOnly } from "../lib/client-only";
import { cn } from "../lib/cn";

// The board: the locked React Flow surface plus the chrome that always rides with it
// (dual background, controls, minimap). Import the stylesheets yourself - they are not
// JS and this package can't import them for you:
//
//   import "@xyflow/react/dist/base.css";   // un-themed React Flow primitives
//   import "@paperkit/ui/canvas.css";       // the paper theming on top

/**
 * Interaction is fully locked - the user can pan/zoom the infinite canvas but can NOT
 * move, connect, select or focus nodes. `onNodeClick` still fires (React Flow attaches
 * it independently of selectability), so click-to-open boards keep working; a board
 * with NO click/hover handler gets `pointer-events: none` on its nodes, which is what
 * makes a purely decorative board un-pokeable.
 *
 * Zoom bounds are deliberately tight; a board that wants more range overrides
 * `minZoom` / `maxZoom` on <CanvasBoard>.
 */
export const LOCKED_CANVAS = {
    nodesDraggable: false,
    nodesConnectable: false,
    elementsSelectable: false,
    nodesFocusable: false,
    edgesFocusable: false,
    zoomOnDoubleClick: false,
    fitView: true,
    minZoom: 0.15,
    maxZoom: 1.8,
    proOptions: { hideAttribution: true },
} as const;

/** The command surface's radial glow field (prototype 05). */
export const CANVAS_GLOW =
    "radial-gradient(1200px 800px at 70% 20%, rgba(37,99,235,.10), transparent 60%), radial-gradient(900px 700px at 15% 85%, rgba(167,139,250,.07), transparent 60%), var(--background)";

export type CanvasSurfaceProps = {
    children: ReactNode;
    /**
     * Scope `.dark` locally so tokens (chips, controls, borders) read the dark palette
     * inside the board regardless of the app's theme.
     */
    dark?: boolean;
    /** Painted as the container's background - pass CANVAS_GLOW for the command surface. */
    glow?: string;
    /** Shown until hydration; defaults to an empty full-size box. */
    fallback?: ReactNode;
    className?: string;
    style?: CSSProperties;
};

/**
 * The board's container. React Flow measures the DOM (ResizeObserver/d3-zoom) at mount,
 * which an SSR pass can't do, so everything inside mounts CLIENT-ONLY. The PARENT must
 * have a real height (h-full inside a flex-1/min-h-0 cell) or React Flow collapses to 0
 * and the canvas renders blank.
 */
export function CanvasSurface({
    children,
    dark,
    glow,
    fallback,
    className,
    style,
}: CanvasSurfaceProps) {
    return (
        <div
            className={cn("h-full w-full", dark && "dark", className)}
            style={glow ? { background: glow, ...style } : style}
        >
            <ClientOnly fallback={fallback ?? <div className="h-full w-full" />}>
                <ReactFlowProvider>{children}</ReactFlowProvider>
            </ClientOnly>
        </div>
    );
}

/** <ReactFlow> with the locked interaction config already applied. */
export function CanvasBoard<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
    props: ReactFlowProps<NodeType, EdgeType>,
) {
    return <ReactFlow<NodeType, EdgeType> {...LOCKED_CANVAS} {...props} />;
}

export type CanvasBackdropLayer = {
    id?: string;
    variant: BackgroundVariant;
    gap: number;
    size?: number;
    color: string;
};

/** The command surface's two-layer field: a fine dot grid under a wide guide grid. */
export const COMMAND_BACKDROP: CanvasBackdropLayer[] = [
    {
        id: "dots",
        variant: BackgroundVariant.Dots,
        gap: 34,
        size: 1.4,
        color: "rgba(120,140,200,0.16)",
    },
    { id: "grid", variant: BackgroundVariant.Lines, gap: 340, color: "rgba(96,165,250,0.05)" },
];

/** Stacked <Background> layers. React Flow needs a distinct `id` per layer. */
export function CanvasBackdrop({ layers }: { layers: CanvasBackdropLayer[] }) {
    return (
        <>
            {layers.map((l, i) => (
                <Background
                    key={l.id ?? `${l.variant}-${i}`}
                    id={l.id}
                    variant={l.variant}
                    gap={l.gap}
                    size={l.size}
                    color={l.color}
                />
            ))}
        </>
    );
}

/** The zoom/fit control cluster, without the "toggle interactivity" lock (it's locked). */
export function CanvasControls({
    position = "bottom-left",
}: { position?: "bottom-left" | "bottom-right" | "top-left" | "top-right" }) {
    return <Controls showInteractive={false} position={position} />;
}

/** The dark, pannable minimap of the command surface. */
export function CanvasMiniMap<NodeType extends Node = Node>(props: MiniMapProps<NodeType>) {
    return (
        <MiniMap<NodeType>
            pannable
            zoomable
            position="bottom-right"
            className="!rounded-xl !border !border-border !bg-[rgba(8,10,18,0.85)]"
            maskColor="rgba(4,5,9,0.6)"
            {...props}
        />
    );
}
