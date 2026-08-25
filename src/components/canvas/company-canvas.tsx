import "@xyflow/react/dist/base.css";
import {
    Background,
    BackgroundVariant,
    Controls,
    type Edge,
    MiniMap,
    type Node,
    Panel,
    ReactFlow,
    ReactFlowProvider,
    useEdgesState,
    useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";
import {
    type CanvasEdge,
    type CanvasNodeData,
    buildCanvas,
    portfolioSummary,
} from "~/config/canvas";
import type { ActivityItem, CompanySummary, OpportunityItem } from "~/server/data";
import { ActivityStrip, CommandBar, PortfolioHud } from "./hud";
import { CanvasNavContext } from "./nav-context";
import { nodeTypes } from "./nodes";

// Nodes are click-to-open, not draggable; the user pans/zooms the infinite command surface.
const LOCKED = {
    nodesDraggable: false,
    nodesConnectable: false,
    minZoom: 0.25,
    maxZoom: 2.2,
    proOptions: { hideAttribution: true },
} as const;

// Cap the opportunities cluster so the board stays legible (they're score-ordered already).
const MAX_OPPS = 6;

function toEdge(e: CanvasEdge): Edge {
    const bridge = e.variant === "bridge";
    return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "default",
        style: {
            stroke: bridge
                ? "color-mix(in srgb, var(--approval) 40%, transparent)"
                : "color-mix(in srgb, var(--info) 30%, transparent)",
            strokeWidth: 1.4,
            strokeDasharray: "5 7",
        },
    };
}

type FlowProps = {
    companies: CompanySummary[];
    opportunities: OpportunityItem[];
    activity: ActivityItem[];
    currentId?: string;
    onOpenCompany: (slug: string) => void;
};

function Flow({ companies, opportunities, activity, currentId, onOpenCompany }: FlowProps) {
    const opps = useMemo(() => opportunities.slice(0, MAX_OPPS), [opportunities]);
    const graph = useMemo(
        () => buildCanvas(companies, opps, currentId),
        [companies, opps, currentId],
    );
    const summary = useMemo(
        () => portfolioSummary(companies, opportunities),
        [companies, opportunities],
    );
    // Frame the portfolio (companies) on open, leaving opportunities off to the right to pan into
    // (like the prototype). Extra padding keeps the top-left company clear of the HUD.
    const fitViewOptions = useMemo(() => {
        const coNodes = graph.nodes.filter((n) => n.type === "company").map((n) => ({ id: n.id }));
        return { padding: 0.35, ...(coNodes.length ? { nodes: coNodes } : {}) };
    }, [graph.nodes]);

    const [nodes, setNodes] = useNodesState(graph.nodes as Node<CanvasNodeData>[]);
    const [edges, setEdges] = useEdgesState(graph.edges.map(toEdge));
    // Poll freshness: reseed on graph change (nodes are locked, so a full replace is safe).
    useEffect(() => {
        setNodes(graph.nodes as Node<CanvasNodeData>[]);
    }, [graph.nodes, setNodes]);
    useEffect(() => {
        setEdges(graph.edges.map(toEdge));
    }, [graph.edges, setEdges]);

    const onNodeClick = useCallback(
        (_: unknown, node: Node<CanvasNodeData>) => {
            if (node.data.kind === "company") onOpenCompany(node.data.slug);
        },
        [onOpenCompany],
    );

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={fitViewOptions}
            {...LOCKED}
        >
            <Background
                id="dots"
                variant={BackgroundVariant.Dots}
                gap={34}
                size={1.4}
                color="rgba(120,140,200,0.16)"
            />
            <Background
                id="grid"
                variant={BackgroundVariant.Lines}
                gap={340}
                color="rgba(96,165,250,0.05)"
            />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
                pannable
                zoomable
                position="bottom-right"
                className="!rounded-xl !border !border-border !bg-[rgba(8,10,18,0.85)]"
                maskColor="rgba(4,5,9,0.6)"
                nodeColor={(n) =>
                    (n.data as CanvasNodeData).kind === "opportunity"
                        ? "var(--approval)"
                        : (n.data as CanvasNodeData).kind === "company"
                          ? "var(--success)"
                          : "transparent"
                }
            />
            <Panel position="top-left">
                <PortfolioHud stats={summary.stats} moves={summary.moves} />
            </Panel>
            <Panel position="top-center">
                <ActivityStrip activity={activity} />
            </Panel>
            <Panel position="bottom-center">
                <CommandBar onSubmit={() => {}} />
            </Panel>
        </ReactFlow>
    );
}

// The command-surface canvas is always dark (like the prototype) regardless of app theme: the `dark`
// class scopes the neon-on-near-black palette locally, and the container paints the 05 glow field.
export function CompanyCanvas({
    onNewCompany,
    ...props
}: FlowProps & { onNewCompany: () => void }) {
    const nav = useMemo(() => ({ onNewCompany }), [onNewCompany]);
    return (
        <div
            className="dark h-full w-full"
            style={{
                background:
                    "radial-gradient(1200px 800px at 70% 20%, rgba(37,99,235,.10), transparent 60%), radial-gradient(900px 700px at 15% 85%, rgba(167,139,250,.07), transparent 60%), var(--background)",
            }}
        >
            <ReactFlowProvider>
                <CanvasNavContext.Provider value={nav}>
                    <Flow {...props} />
                </CanvasNavContext.Provider>
            </ReactFlowProvider>
        </div>
    );
}
