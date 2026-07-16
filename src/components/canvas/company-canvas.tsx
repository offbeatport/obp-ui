import "@xyflow/react/dist/base.css";
import {
    Background,
    BackgroundVariant,
    Controls,
    type Edge,
    type Node,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import { useEffect, useMemo } from "react";
import { type Canvas, type CanvasNodeData, buildCanvas } from "~/config/canvas";
import type { CompanyDetail } from "~/server/data";
import { nodeTypes } from "./nodes";

// The dotted connectors (idea → company → product → features/gtm). One dash value, owned here +
// globals.css .react-flow__edge-path; buildCanvas edges carry no per-edge style (would override).
const defaultEdgeOptions = {
    type: "smoothstep" as const,
    style: { stroke: "var(--rf-edge)", strokeWidth: 1.4, strokeDasharray: "5 7" },
};

function Flow({ graph }: { graph: Canvas }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes as Node<CanvasNodeData>[]);
    const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges as Edge[]);

    // `useNodesState` seeds ONLY at mount. The company page polls every 2.5s (router.invalidate →
    // fresh CompanyDetail → a new `graph`), so without this the node content (status dot, domain,
    // MRR, new/removed feature slices) would render stale until a tab switch. Merge fresh data +
    // node set into RF state, but KEEP each existing node's live object (its dragged position, RF
    // measurements, selection) - only swap `data`. Added nodes come in fresh; removed ones drop.
    useEffect(() => {
        setNodes((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            return graph.nodes.map((g) => {
                const cur = byId.get(g.id);
                return cur ? { ...cur, data: g.data } : (g as Node<CanvasNodeData>);
            });
        });
    }, [graph.nodes, setNodes]);
    useEffect(() => {
        setEdges(graph.edges as Edge[]);
    }, [graph.edges, setEdges]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            minZoom={0.4}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
        >
            <Background
                variant={BackgroundVariant.Dots}
                gap={34}
                size={1.4}
                color="var(--rf-dot)"
            />
            <Controls showInteractive={false} />
        </ReactFlow>
    );
}

// Wrapped in its own provider so pan/zoom state is isolated to this canvas.
export function CompanyCanvas({ detail }: { detail: CompanyDetail }) {
    const graph = useMemo(() => buildCanvas(detail), [detail]);
    return (
        <ReactFlowProvider>
            <Flow graph={graph} />
        </ReactFlowProvider>
    );
}
