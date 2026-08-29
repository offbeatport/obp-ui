import type { Node, Position } from "@xyflow/react";
import type { FlavorKey } from "./flavors";

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

export type CanvasFlowData<D = unknown> = {
    node?: CanvasGraphNode<D>;
    flavor: FlavorKey;
    ht?: Position;
    hs?: Position;
    label?: string;
    w?: number;
    h?: number;
    accent?: string;
};

export type CanvasFlowNode<D = unknown> = Node<CanvasFlowData<D>>;

export type PipelineKind =
    | "idea"
    | "opportunity"
    | "company"
    | "landing"
    | "product"
    | "feature"
    | "channel";

export type CanvasGraphIndex<D = unknown> = {
    one: (kind: string) => CanvasGraphNode<D> | undefined;
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
