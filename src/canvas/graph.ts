import type { Node, Position } from "@xyflow/react";
import type { FlavorKey } from "./flavors";

// ============================================================================
// The logical graph a layout arranges, and the React Flow `data` payload the
// flavor-driven renderers read. Both are deliberately content-free: a node
// carries an app-shaped `data` payload the package never inspects, so the
// layouts and the card shells work for any node vocabulary.
// ============================================================================

/** One logical node. `kind` is a plain string - it also becomes the RF node `type`. */
export type CanvasGraphNode<D = unknown> = {
    id: string;
    kind: string;
    data: D;
};

export type CanvasGraphEdge = { id: string; source: string; target: string };

export type CanvasGraph<D = unknown> = {
    nodes: CanvasGraphNode<D>[];
    edges: CanvasGraphEdge[];
};

/**
 * The `data` every node the layouts emit carries. `node` is absent on the chrome
 * nodes (lane panels, column heads) which have no logical counterpart.
 */
export type CanvasFlowData<D = unknown> = {
    node?: CanvasGraphNode<D>;
    flavor: FlavorKey;
    ht?: Position; // target handle side
    hs?: Position; // source handle side
    // lane / colhead chrome:
    label?: string;
    w?: number;
    h?: number;
    accent?: string;
};

export type CanvasFlowNode<D = unknown> = Node<CanvasFlowData<D>>;

/**
 * The pipeline roles the built-in layouts arrange. Re-declared here as a small
 * local union rather than imported from an app: a graph whose `kind` strings are
 * these words gets the built-in layouts for free, and any other kind is simply
 * ignored by them.
 */
export type PipelineKind =
    | "idea"
    | "opportunity"
    | "company"
    | "landing"
    | "product"
    | "feature"
    | "channel";

/** kind → nodes, in graph order. Layouts read the graph only through this. */
export type CanvasGraphIndex<D = unknown> = {
    /** The first node of a kind (the singleton roles: idea, company, product …). */
    one: (kind: string) => CanvasGraphNode<D> | undefined;
    /** Every node of a kind, in graph order (the repeated roles: feature, channel). */
    many: (kind: string) => CanvasGraphNode<D>[];
};

export function indexGraph<D>(graph: CanvasGraph<D>): CanvasGraphIndex<D> {
    const byKind = new Map<string, CanvasGraphNode<D>[]>();
    for (const n of graph.nodes) {
        const list = byKind.get(n.kind);
        if (list) list.push(n);
        else byKind.set(n.kind, [n]);
    }
    return {
        one: (kind) => byKind.get(kind)?.[0],
        many: (kind) => byKind.get(kind) ?? [],
    };
}
