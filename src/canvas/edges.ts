import type { Edge } from "@xyflow/react";

export const MESH_STROKE = "color-mix(in srgb, var(--info) 30%, transparent)";
export const BRIDGE_STROKE = "color-mix(in srgb, var(--approval) 40%, transparent)";

export type DottedEdgeInput = {
    id: string;
    source: string;
    target: string;
    stroke?: string;
};

export function dottedEdge({ id, source, target, stroke = MESH_STROKE }: DottedEdgeInput): Edge {
    return {
        id,
        source,
        target,
        type: "default",
        style: { stroke, strokeWidth: 1.4, strokeDasharray: "5 7" },
    };
}
