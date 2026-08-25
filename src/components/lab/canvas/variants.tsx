import { type Edge, type Node, Position } from "@xyflow/react";
import { LAB_EDGES, LAB_NODES, type LabNode, labChannels, labFeatures } from "~/lab/graph";
import { FLAVORS, type Flavor, type FlavorKey } from "./flavors";
import type { RFData } from "./nodes";

// ============================================================================
// The 10 canvas variants. Every variant renders the SAME logical graph
// (LAB_NODES / LAB_EDGES); they differ only in layout (positions + handle
// sides) and flavor (skin). Each layout returns React Flow nodes; edges are
// derived from the flavor. Movement is disabled at the <ReactFlow> level (see
// lab-canvas.tsx), so these positions are final.
// ============================================================================

type Layout = (flavor: FlavorKey) => Node<RFData>[];
type EdgeOverride = Partial<Flavor["edge"]>;

const byId = new Map(LAB_NODES.map((n) => [n.id, n]));
const get = (id: string) => byId.get(id) as LabNode;
const FEATURES = labFeatures();
const CHANNELS = labChannels();

// One RF node from a logical node.
function mk(
    n: LabNode,
    x: number,
    y: number,
    flavor: FlavorKey,
    handles?: { ht?: Position; hs?: Position },
): Node<RFData> {
    return {
        id: n.id,
        type: n.kind,
        position: { x, y },
        data: { n, flavor, ht: handles?.ht, hs: handles?.hs },
        draggable: false,
        selectable: false,
        connectable: false,
    };
}

// Chrome nodes (lane panels / column headers) that sit behind the cards.
function lane(
    id: string,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: string,
    flavor: FlavorKey,
): Node<RFData> {
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
function colhead(
    id: string,
    x: number,
    y: number,
    w: number,
    label: string,
    accent: string,
    flavor: FlavorKey,
): Node<RFData> {
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

// Edges styled by the flavor (with optional per-variant override).
function edges(flavor: FlavorKey, o?: EdgeOverride): Edge[] {
    const e = { ...FLAVORS[flavor].edge, ...o };
    return LAB_EDGES.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: e.type,
        animated: e.animated,
        style: { stroke: e.stroke, strokeWidth: e.width, strokeDasharray: e.dash },
    }));
}

// Vertically stack the i-th of `count` items around a centre y.
const stackY = (i: number, count: number, gap: number, center = 0) => center + (i - (count - 1) / 2) * gap;

// ------------------------------------------------------------------ 1. Columns
const columns: Layout = (flavor) => {
    const C = 320;
    return [
        mk(get("idea"), 0, 0, flavor),
        mk(get("opportunity"), C, 0, flavor),
        mk(get("company"), 2 * C, 0, flavor),
        mk(get("landing"), 3 * C, -110, flavor),
        mk(get("product"), 3 * C, 110, flavor),
        ...FEATURES.map((n, i) => mk(n, 4 * C, stackY(i, FEATURES.length, 116, 110), flavor)),
        ...CHANNELS.map((n, i) => mk(n, 5 * C, stackY(i, CHANNELS.length, 120, -40), flavor)),
    ];
};

// ------------------------------------------------------------------ 2. Tree ↓
const treeDown: Layout = (flavor) => {
    const R = 168;
    const h = { ht: Position.Top, hs: Position.Bottom };
    const featBase = 380;
    const chanBase = -380;
    return [
        mk(get("idea"), 0, 0, flavor, h),
        mk(get("opportunity"), 0, R, flavor, h),
        mk(get("company"), 0, 2 * R, flavor, h),
        mk(get("landing"), chanBase, 3 * R, flavor, h),
        mk(get("product"), featBase, 3 * R, flavor, h),
        ...FEATURES.map((n, i) => mk(n, featBase + stackY(i, FEATURES.length, 236), 4.1 * R, flavor, h)),
        ...CHANNELS.map((n, i) => mk(n, chanBase + stackY(i, CHANNELS.length, 246), 4.1 * R, flavor, h)),
    ];
};

// ------------------------------------------------------------------ 3. Radial
const radial: Layout = (flavor) => {
    // Handle side that faces the hub at (0,0).
    const facing = (x: number, y: number) => {
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
    const place = (n: LabNode, r: number, deg: number) => {
        const rad = (deg * Math.PI) / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        return mk(n, x - 120, y - 40, flavor, facing(x, y));
    };
    const inner = [
        place(get("idea"), 360, 200),
        place(get("opportunity"), 360, 340),
        place(get("product"), 360, 20),
        place(get("landing"), 360, 160),
    ];
    const ring = [...FEATURES, ...CHANNELS];
    const outer = ring.map((n, i) => place(n, 700, (360 / ring.length) * i - 90));
    return [mk(get("company"), -123, -40, flavor), ...inner, ...outer];
};

// ------------------------------------------------------------------ 4. Swimlanes
const swimlanes: Layout = (flavor) => {
    const laneH = 250;
    const y0 = 0;
    const y1 = laneH + 40;
    const y2 = 2 * (laneH + 40);
    return [
        lane("lane-opp", -20, y0, 760, laneH, "Opportunity", "var(--warning)", flavor),
        lane("lane-prod", -20, y1, 2500, laneH, "Product", "var(--primary)", flavor),
        lane("lane-growth", -20, y2, 1580, laneH, "Go-to-market", "var(--approval)", flavor),
        mk(get("idea"), 20, y0 + 70, flavor),
        mk(get("opportunity"), 340, y0 + 46, flavor),
        mk(get("company"), 20, y1 + 60, flavor),
        mk(get("landing"), 320, y1 + 50, flavor),
        mk(get("product"), 620, y1 + 62, flavor),
        ...FEATURES.map((n, i) => mk(n, 940 + i * 250, y1 + 76, flavor)),
        ...CHANNELS.map((n, i) => mk(n, 20 + i * 258, y2 + 70, flavor)),
    ];
};

// ------------------------------------------------------------------ 5. Kanban
const kanban: Layout = (flavor) => {
    const cols: { key: string; label: string; accent: string; ids: string[] }[] = [
        { key: "idea", label: "Idea", accent: "var(--primary)", ids: ["idea"] },
        { key: "opp", label: "Opportunity", accent: "var(--warning)", ids: ["opportunity"] },
        {
            key: "build",
            label: "Build",
            accent: "var(--info)",
            ids: ["company", "landing", "product"],
        },
        {
            key: "feat",
            label: "Features",
            accent: "var(--success)",
            ids: FEATURES.map((f) => f.id),
        },
        { key: "grow", label: "Growth", accent: "var(--approval)", ids: CHANNELS.map((c) => c.id) },
    ];
    const CW = 300;
    const nodes: Node<RFData>[] = [];
    cols.forEach((col, ci) => {
        const x = ci * CW;
        nodes.push(colhead(`head-${col.key}`, x, -70, 230, col.label, col.accent, flavor));
        let y = 0;
        for (const id of col.ids) {
            nodes.push(mk(get(id), x, y, flavor));
            y += get(id).kind === "opportunity" ? 210 : 150;
        }
    });
    return nodes;
};

// ------------------------------------------------------------------ 6. Bento
const bento: Layout = (flavor) => {
    const order = [
        "idea",
        "opportunity",
        "company",
        "landing",
        "product",
        ...FEATURES.map((f) => f.id),
        ...CHANNELS.map((c) => c.id),
    ];
    const COLS = 4;
    const CW = 268;
    const RH = 184;
    return order.map((id, i) => mk(get(id), (i % COLS) * CW, Math.floor(i / COLS) * RH, flavor));
};

// ------------------------------------------------------------------ 7. Blueprint
const blueprint: Layout = (flavor) => {
    const C = 300;
    return [
        mk(get("idea"), 0, 0, flavor),
        mk(get("opportunity"), C, 0, flavor),
        mk(get("company"), 2 * C, -90, flavor),
        mk(get("landing"), 2 * C, 150, flavor),
        mk(get("product"), 3 * C, 150, flavor),
        ...FEATURES.map((n, i) => mk(n, 4 * C, stackY(i, FEATURES.length, 106, 150), flavor)),
        ...CHANNELS.map((n, i) => mk(n, 3 * C, stackY(i, CHANNELS.length, 110, -260), flavor)),
    ];
};

// ------------------------------------------------------------------ 8. Mind map
const mindmap: Layout = (flavor) => [
    mk(get("idea"), 0, 0, flavor),
    mk(get("opportunity"), 330, 0, flavor),
    mk(get("company"), 660, 0, flavor),
    mk(get("landing"), 980, -150, flavor),
    mk(get("product"), 980, 150, flavor),
    ...FEATURES.map((n, i) => mk(n, 1300, 40 + i * 116, flavor)),
    ...CHANNELS.map((n, i) => mk(n, 1300, -80 - i * 120, flavor)),
];

// ------------------------------------------------------------------ 9. Timeline
const timeline: Layout = (flavor) => {
    const stages: { key: string; label: string; accent: string; ids: string[] }[] = [
        { key: "idea", label: "01 · Idea", accent: "var(--primary)", ids: ["idea"] },
        { key: "val", label: "02 · Validate", accent: "var(--warning)", ids: ["opportunity"] },
        {
            key: "build",
            label: "03 · Build",
            accent: "var(--info)",
            ids: ["company", "product", ...FEATURES.map((f) => f.id)],
        },
        { key: "launch", label: "04 · Launch", accent: "var(--success)", ids: ["landing"] },
        {
            key: "grow",
            label: "05 · Grow",
            accent: "var(--approval)",
            ids: CHANNELS.map((c) => c.id),
        },
    ];
    const SW = 300;
    const nodes: Node<RFData>[] = [lane("spine", -30, -8, stages.length * SW, 4, "", "var(--primary)", flavor)];
    stages.forEach((st, si) => {
        const x = si * SW;
        nodes.push(colhead(`t-${st.key}`, x, -70, 240, st.label, st.accent, flavor));
        st.ids.forEach((id, i) => nodes.push(mk(get(id), x, 40 + i * 128, flavor)));
    });
    return nodes;
};

// ------------------------------------------------------------------ 10. Constellation
const constellation: Layout = (flavor) => {
    // Deterministic clustered scatter (no RNG - index-driven trig offsets).
    const scatter = (list: LabNode[], cx: number, cy: number, spread: number, seed: number) =>
        list.map((n, i) => {
            const a = seed + i * 2.3999; // ~golden angle
            const r = spread * (0.45 + 0.55 * ((i % 3) / 2));
            return mk(n, cx + Math.cos(a) * r, cy + Math.sin(a) * r, flavor);
        });
    return [
        mk(get("company"), 0, 0, flavor),
        mk(get("idea"), -560, -260, flavor),
        mk(get("opportunity"), -300, -300, flavor),
        mk(get("landing"), 320, -260, flavor),
        mk(get("product"), 300, 220, flavor),
        ...scatter(FEATURES, 720, 300, 320, 1.2),
        ...scatter(CHANNELS, 620, -320, 320, 4.0),
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
    layout: Layout;
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

// Resolve a variant to concrete { nodes, edges }.
export function buildCanvasVariant(v: CanvasVariant): { nodes: Node<RFData>[]; edges: Edge[] } {
    return { nodes: v.layout(v.flavor), edges: edges(v.flavor, v.edgeOverride) };
}
