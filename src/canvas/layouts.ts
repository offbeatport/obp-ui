import { type Edge, Position } from "@xyflow/react";
import { FLAVORS, type Flavor, type FlavorKey } from "./flavors";
import {
    type CanvasFlowNode,
    type CanvasGraph,
    type CanvasGraphIndex,
    type CanvasGraphNode,
    indexGraph,
} from "./graph";

// ============================================================================
// The 10 canvas layouts. Every layout arranges the SAME logical graph; they
// differ only in positions + handle sides. A layout takes the graph as an
// ARGUMENT (there is no module-scope content here) and pairs with a flavor to
// make a variant. Movement is disabled at the <ReactFlow> level (LOCKED_CANVAS),
// so these positions are final.
// ============================================================================

export type CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => CanvasFlowNode<D>[];

export type EdgeOverride = Partial<Flavor["edge"]>;

type Handles = { ht?: Position; hs?: Position };

// One RF node from a logical node.
function mk<D>(
    n: CanvasGraphNode<D>,
    x: number,
    y: number,
    flavor: FlavorKey,
    handles?: Handles,
): CanvasFlowNode<D> {
    return {
        id: n.id,
        type: n.kind,
        position: { x, y },
        data: { node: n, flavor, ht: handles?.ht, hs: handles?.hs },
        draggable: false,
        selectable: false,
        connectable: false,
    };
}

// `mk` for a role that may be missing from the graph - yields 0 or 1 node so a
// layout can spread it inline and stay a single expression.
function at<D>(
    ix: CanvasGraphIndex<D>,
    kind: string,
    x: number,
    y: number,
    flavor: FlavorKey,
    handles?: Handles,
): CanvasFlowNode<D>[] {
    const n = ix.one(kind);
    return n ? [mk(n, x, y, flavor, handles)] : [];
}

// Chrome nodes (lane panels / column headers) that sit behind the cards.
export function laneNode<D>(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: string,
    flavor: FlavorKey,
): CanvasFlowNode<D> {
    return {
        id,
        type: "lane",
        position: { x, y },
        data: { flavor, label, w, h, accent },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: 0,
        style: { pointerEvents: "none", zIndex: 0 },
    };
}

export function colHeadNode<D>(
    id: string,
    x: number,
    y: number,
    w: number,
    label: string,
    accent: string,
    flavor: FlavorKey,
): CanvasFlowNode<D> {
    return {
        id,
        type: "colhead",
        position: { x, y },
        data: { flavor, label, w, accent },
        draggable: false,
        selectable: false,
        connectable: false,
        style: { pointerEvents: "none" },
    };
}

/** Edges styled by the flavor (with an optional per-variant override). */
export function flavorEdges(
    graph: CanvasGraph<unknown>,
    flavor: FlavorKey,
    o?: EdgeOverride,
): Edge[] {
    const e = { ...FLAVORS[flavor].edge, ...o };
    return graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: e.type,
        animated: e.animated,
        style: { stroke: e.stroke, strokeWidth: e.width, strokeDasharray: e.dash },
    }));
}

// Vertically stack the i-th of `count` items around a centre y.
const stackY = (i: number, count: number, gap: number, center = 0) =>
    center + (i - (count - 1) / 2) * gap;

// ------------------------------------------------------------------ 1. Columns
export const columns: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const features = ix.many("feature");
    const channels = ix.many("channel");
    const C = 320;
    return [
        ...at(ix, "idea", 0, 0, flavor),
        ...at(ix, "opportunity", C, 0, flavor),
        ...at(ix, "company", 2 * C, 0, flavor),
        ...at(ix, "landing", 3 * C, -110, flavor),
        ...at(ix, "product", 3 * C, 110, flavor),
        ...features.map((n, i) => mk(n, 4 * C, stackY(i, features.length, 116, 110), flavor)),
        ...channels.map((n, i) => mk(n, 5 * C, stackY(i, channels.length, 120, -40), flavor)),
    ];
};

// ------------------------------------------------------------------ 2. Tree ↓
export const treeDown: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const features = ix.many("feature");
    const channels = ix.many("channel");
    const R = 168;
    const h = { ht: Position.Top, hs: Position.Bottom };
    const featBase = 380;
    const chanBase = -380;
    return [
        ...at(ix, "idea", 0, 0, flavor, h),
        ...at(ix, "opportunity", 0, R, flavor, h),
        ...at(ix, "company", 0, 2 * R, flavor, h),
        ...at(ix, "landing", chanBase, 3 * R, flavor, h),
        ...at(ix, "product", featBase, 3 * R, flavor, h),
        ...features.map((n, i) =>
            mk(n, featBase + stackY(i, features.length, 236), 4.1 * R, flavor, h),
        ),
        ...channels.map((n, i) =>
            mk(n, chanBase + stackY(i, channels.length, 246), 4.1 * R, flavor, h),
        ),
    ];
};

// ------------------------------------------------------------------ 3. Radial
export const radial: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    // Handle side that faces the hub at (0,0).
    const facing = (x: number, y: number): Handles => {
        const ht =
            Math.abs(x) > Math.abs(y)
                ? x > 0
                    ? Position.Left
                    : Position.Right
                : y > 0
                  ? Position.Top
                  : Position.Bottom;
        const hs =
            ht === Position.Left
                ? Position.Right
                : ht === Position.Right
                  ? Position.Left
                  : ht === Position.Top
                    ? Position.Bottom
                    : Position.Top;
        return { ht, hs };
    };
    const place = (n: CanvasGraphNode<D> | undefined, r: number, deg: number) => {
        if (!n) return [];
        const rad = (deg * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        return [mk(n, x - 120, y - 40, flavor, facing(x, y))];
    };
    const inner = [
        ...place(ix.one("idea"), 360, 200),
        ...place(ix.one("opportunity"), 360, 340),
        ...place(ix.one("product"), 360, 20),
        ...place(ix.one("landing"), 360, 160),
    ];
    const ring = [...ix.many("feature"), ...ix.many("channel")];
    const outer = ring.flatMap((n, i) => place(n, 700, (360 / ring.length) * i - 90));
    return [...at(ix, "company", -123, -40, flavor), ...inner, ...outer];
};

// ------------------------------------------------------------------ 4. Swimlanes
/** The three bands the swimlane layout draws behind the cards. */
export const SWIMLANE_BANDS: { id: string; label: string; accent: string; w: number }[] = [
    { id: "lane-opp", label: "Opportunity", accent: "var(--warning)", w: 760 },
    { id: "lane-prod", label: "Product", accent: "var(--primary)", w: 2500 },
    { id: "lane-growth", label: "Go-to-market", accent: "var(--approval)", w: 1580 },
];

export const swimlanes: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const laneH = 250;
    const y0 = 0;
    const y1 = laneH + 40;
    const y2 = 2 * (laneH + 40);
    const [opp, prod, growth] = SWIMLANE_BANDS;
    return [
        laneNode<D>(opp.id, -20, y0, opp.w, laneH, opp.label, opp.accent, flavor),
        laneNode<D>(prod.id, -20, y1, prod.w, laneH, prod.label, prod.accent, flavor),
        laneNode<D>(growth.id, -20, y2, growth.w, laneH, growth.label, growth.accent, flavor),
        ...at(ix, "idea", 20, y0 + 70, flavor),
        ...at(ix, "opportunity", 340, y0 + 46, flavor),
        ...at(ix, "company", 20, y1 + 60, flavor),
        ...at(ix, "landing", 320, y1 + 50, flavor),
        ...at(ix, "product", 620, y1 + 62, flavor),
        ...ix.many("feature").map((n, i) => mk(n, 940 + i * 250, y1 + 76, flavor)),
        ...ix.many("channel").map((n, i) => mk(n, 20 + i * 258, y2 + 70, flavor)),
    ];
};

// ------------------------------------------------------------------ 5. Kanban
/** The kanban columns, each a list of KINDS expanded in graph order. */
export const KANBAN_COLUMNS: { key: string; label: string; accent: string; kinds: string[] }[] = [
    { key: "idea", label: "Idea", accent: "var(--primary)", kinds: ["idea"] },
    { key: "opp", label: "Opportunity", accent: "var(--warning)", kinds: ["opportunity"] },
    {
        key: "build",
        label: "Build",
        accent: "var(--info)",
        kinds: ["company", "landing", "product"],
    },
    { key: "feat", label: "Features", accent: "var(--success)", kinds: ["feature"] },
    { key: "grow", label: "Growth", accent: "var(--approval)", kinds: ["channel"] },
];

export const kanban: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const CW = 300;
    const nodes: CanvasFlowNode<D>[] = [];
    KANBAN_COLUMNS.forEach((col, ci) => {
        const x = ci * CW;
        nodes.push(colHeadNode<D>(`head-${col.key}`, x, -70, 230, col.label, col.accent, flavor));
        let y = 0;
        for (const kind of col.kinds) {
            for (const n of ix.many(kind)) {
                nodes.push(mk(n, x, y, flavor));
                // The opportunity card is the tall one - give it more room below.
                y += kind === "opportunity" ? 210 : 150;
            }
        }
    });
    return nodes;
};

// ------------------------------------------------------------------ 6. Bento
/** Reading order of the bento grid: one cell per node, kinds expanded in turn. */
export const BENTO_ORDER: string[] = [
    "idea",
    "opportunity",
    "company",
    "landing",
    "product",
    "feature",
    "channel",
];

export const bento: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const order = BENTO_ORDER.flatMap((kind) => ix.many(kind));
    const COLS = 4;
    const CW = 268;
    const RH = 184;
    return order.map((n, i) => mk(n, (i % COLS) * CW, Math.floor(i / COLS) * RH, flavor));
};

// ------------------------------------------------------------------ 7. Blueprint
export const blueprint: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const features = ix.many("feature");
    const channels = ix.many("channel");
    const C = 300;
    return [
        ...at(ix, "idea", 0, 0, flavor),
        ...at(ix, "opportunity", C, 0, flavor),
        ...at(ix, "company", 2 * C, -90, flavor),
        ...at(ix, "landing", 2 * C, 150, flavor),
        ...at(ix, "product", 3 * C, 150, flavor),
        ...features.map((n, i) => mk(n, 4 * C, stackY(i, features.length, 106, 150), flavor)),
        ...channels.map((n, i) => mk(n, 3 * C, stackY(i, channels.length, 110, -260), flavor)),
    ];
};

// ------------------------------------------------------------------ 8. Mind map
export const mindmap: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    return [
        ...at(ix, "idea", 0, 0, flavor),
        ...at(ix, "opportunity", 330, 0, flavor),
        ...at(ix, "company", 660, 0, flavor),
        ...at(ix, "landing", 980, -150, flavor),
        ...at(ix, "product", 980, 150, flavor),
        ...ix.many("feature").map((n, i) => mk(n, 1300, 40 + i * 116, flavor)),
        ...ix.many("channel").map((n, i) => mk(n, 1300, -80 - i * 120, flavor)),
    ];
};

// ------------------------------------------------------------------ 9. Timeline
/** The five numbered stages along the timeline spine, each a list of KINDS. */
export const TIMELINE_STAGES: { key: string; label: string; accent: string; kinds: string[] }[] = [
    { key: "idea", label: "01 · Idea", accent: "var(--primary)", kinds: ["idea"] },
    { key: "val", label: "02 · Validate", accent: "var(--warning)", kinds: ["opportunity"] },
    {
        key: "build",
        label: "03 · Build",
        accent: "var(--info)",
        kinds: ["company", "product", "feature"],
    },
    { key: "launch", label: "04 · Launch", accent: "var(--success)", kinds: ["landing"] },
    { key: "grow", label: "05 · Grow", accent: "var(--approval)", kinds: ["channel"] },
];

export const timeline: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    const SW = 300;
    const nodes: CanvasFlowNode<D>[] = [
        laneNode<D>("spine", -30, -8, TIMELINE_STAGES.length * SW, 4, "", "var(--primary)", flavor),
    ];
    TIMELINE_STAGES.forEach((st, si) => {
        const x = si * SW;
        nodes.push(colHeadNode<D>(`t-${st.key}`, x, -70, 240, st.label, st.accent, flavor));
        let i = 0;
        for (const kind of st.kinds) {
            for (const n of ix.many(kind)) {
                nodes.push(mk(n, x, 40 + i * 128, flavor));
                i += 1;
            }
        }
    });
    return nodes;
};

// ------------------------------------------------------------------ 10. Constellation
export const constellation: CanvasLayout = <D>(graph: CanvasGraph<D>, flavor: FlavorKey) => {
    const ix = indexGraph(graph);
    // Deterministic clustered scatter (no RNG - index-driven trig offsets).
    const scatter = (
        list: CanvasGraphNode<D>[],
        cx: number,
        cy: number,
        spread: number,
        seed: number,
    ) =>
        list.map((n, i) => {
            const a = seed + i * 2.3999; // ~golden angle
            const r = spread * (0.45 + 0.55 * ((i % 3) / 2));
            return mk(n, cx + Math.cos(a) * r, cy + Math.sin(a) * r, flavor);
        });
    return [
        ...at(ix, "company", 0, 0, flavor),
        ...at(ix, "idea", -560, -260, flavor),
        ...at(ix, "opportunity", -300, -300, flavor),
        ...at(ix, "landing", 320, -260, flavor),
        ...at(ix, "product", 300, 220, flavor),
        ...scatter(ix.many("feature"), 720, 300, 320, 1.2),
        ...scatter(ix.many("channel"), 620, -320, 320, 4.0),
    ];
};

// ---------------------------------------------------------------------------
// Registry. Each entry pairs a layout with a flavor + optional edge override.
// ---------------------------------------------------------------------------
export type CanvasVariant = {
    id: number;
    name: string;
    blurb: string;
    flavor: FlavorKey;
    layout: CanvasLayout;
    edgeOverride?: EdgeOverride;
};

export const CANVAS_VARIANTS: CanvasVariant[] = [
    {
        id: 1,
        name: "Pipeline Columns",
        blurb: "Left→right depth: idea → spec → company → build → growth.",
        flavor: "paper",
        layout: columns,
    },
    {
        id: 2,
        name: "Org Tree",
        blurb: "Top-down hierarchy, two subtrees for build & distribution.",
        flavor: "editorial",
        layout: treeDown,
    },
    {
        id: 3,
        name: "Radial Hub",
        blurb: "Company at the core, everything orbiting outward.",
        flavor: "neon",
        layout: radial,
    },
    {
        id: 4,
        name: "Swimlanes",
        blurb: "Opportunity / Product / Go-to-market bands.",
        flavor: "paper",
        layout: swimlanes,
    },
    {
        id: 5,
        name: "Kanban Board",
        blurb: "Idea → Opportunity → Build → Features → Growth columns.",
        flavor: "soft",
        layout: kanban,
    },
    {
        id: 6,
        name: "Bento Grid",
        blurb: "Every square in a tight, quiet grid.",
        flavor: "mono",
        layout: bento,
        edgeOverride: { dash: "3 5" },
    },
    {
        id: 7,
        name: "Blueprint",
        blurb: "Schematic wireframe on a technical cross-grid.",
        flavor: "blueprint",
        layout: blueprint,
    },
    {
        id: 8,
        name: "Mind Map",
        blurb: "Root on the left, branches fanning to the right.",
        flavor: "editorial",
        layout: mindmap,
        edgeOverride: { type: "bezier" },
    },
    {
        id: 9,
        name: "Stage Timeline",
        blurb: "Five numbered stages along a horizontal spine.",
        flavor: "paper",
        layout: timeline,
    },
    {
        id: 10,
        name: "Constellation",
        blurb: "cofounder-style dark board, organic clusters, glowing links.",
        flavor: "neon",
        layout: constellation,
        edgeOverride: { animated: true },
    },
];

/** Resolve a variant against a graph to concrete { nodes, edges }. */
export function buildCanvasVariant<D>(
    v: CanvasVariant,
    graph: CanvasGraph<D>,
): { nodes: CanvasFlowNode<D>[]; edges: Edge[] } {
    return {
        nodes: v.layout(graph, v.flavor),
        edges: flavorEdges(graph, v.flavor, v.edgeOverride),
    };
}
