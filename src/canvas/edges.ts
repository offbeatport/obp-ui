import type { Edge } from "@xyflow/react";

// The command surface's connectors are decorative: faint dotted hairlines that make the
// board read as one wired system. The colour says which KIND of link it is; the app owns
// that decision and passes the stroke in.

/** Links inside one region (company → company). */
export const MESH_STROKE = "color-mix(in srgb, var(--info) 30%, transparent)";
/** Links that jump between regions (portfolio → opportunities). */
export const BRIDGE_STROKE = "color-mix(in srgb, var(--approval) 40%, transparent)";

export type DottedEdgeInput = {
    id: string;
    source: string;
    target: string;
    /** Any CSS colour. Defaults to MESH_STROKE. */
    stroke?: string;
};

/** One dotted connector, at the board's fixed weight and dash rhythm. */
export function dottedEdge({ id, source, target, stroke = MESH_STROKE }: DottedEdgeInput): Edge {
    return {
        id,
        source,
        target,
        type: "default",
        style: { stroke, strokeWidth: 1.4, strokeDasharray: "5 7" },
    };
}
