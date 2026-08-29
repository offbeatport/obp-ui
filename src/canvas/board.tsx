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

export const CANVAS_GLOW =
    "radial-gradient(1200px 800px at 70% 20%, rgba(37,99,235,.10), transparent 60%), radial-gradient(900px 700px at 15% 85%, rgba(167,139,250,.07), transparent 60%), var(--background)";

export type CanvasSurfaceProps = {
    children: ReactNode;
    dark?: boolean;
    glow?: string;
    fallback?: ReactNode;
    className?: string;
    style?: CSSProperties;
};

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

export function CanvasControls({
    position = "bottom-left",
}: { position?: "bottom-left" | "bottom-right" | "top-left" | "top-right" }) {
    return <Controls showInteractive={false} position={position} />;
}

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
