import "@xyflow/react/dist/base.css";
import { ClientOnly } from "@tanstack/react-router";
import { Background, Controls, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useMemo } from "react";
import { cn } from "~/lib/utils";
import { FLAVORS } from "./flavors";
import { labNodeTypes } from "./nodes";
import { type CanvasVariant, buildCanvasVariant } from "./variants";

// Interaction is fully locked - the user can pan/zoom the infinite canvas but can
// NOT move, connect, or select nodes ("not allowed to move things around").
const LOCKED = {
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

function Flow({ variant }: { variant: CanvasVariant }) {
    const { nodes, edges } = useMemo(() => buildCanvasVariant(variant), [variant]);
    const f = FLAVORS[variant.flavor];
    return (
        <ReactFlow
            key={variant.id}
            nodes={nodes}
            edges={edges}
            nodeTypes={labNodeTypes}
            fitViewOptions={{ padding: 0.18 }}
            {...LOCKED}
        >
            {f.bg && <Background variant={f.bg.variant} gap={f.bg.gap} size={f.bg.size} color={f.bg.color} />}
            <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
    );
}

// One variant, client-only (React Flow measures the DOM at mount). Parent MUST
// have a real height. The dark-flavor variants scope `.dark` locally so token
// bits (chips, controls, borders) read the dark palette inside the panel.
export function LabCanvas({ variant }: { variant: CanvasVariant }) {
    const f = FLAVORS[variant.flavor];
    return (
        <div className={cn("relative h-full w-full overflow-hidden", f.dark && "dark", f.container)}>
            <ClientOnly fallback={<div className="h-full w-full" />}>
                <ReactFlowProvider>
                    <Flow variant={variant} />
                </ReactFlowProvider>
            </ClientOnly>
        </div>
    );
}
