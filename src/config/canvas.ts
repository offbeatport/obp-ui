import type { CompanySummary, OpportunityItem } from "../server/data.js";
import type { Branding } from "./spin.js";

// CLIENT-SAFE canvas projection (no sqlite/fs). Turns the PORTFOLIO (all companies + opportunities)
// into the node/edge graph the React Flow Overview renders as the "Infinite Canvas · command
// surface" (v2 prototype design/v2-prototypes/05-infinite-canvas.html): a dark, glowing board where
// every company is a node in the PORTFOLIO region and every opportunity sits in the OPPORTUNITIES
// cluster, wired with faint connectors. Pure + deterministic (same input → identical layout).

export type SliceState = "building" | "awaiting_approval" | "blocked" | "todo" | "shipped";

export type CanvasNodeData =
    | {
          kind: "company";
          id: string;
          slug: string;
          name: string;
          branding?: Branding;
          status: CompanySummary["status"];
          mrr: number;
          users: number;
          shipped: number;
          needsYou: boolean;
          current?: { n: number; title: string; state: SliceState };
          isCurrent: boolean; // the company whose page we're on → "you are here"
      }
    | {
          kind: "opportunity";
          id: string;
          title: string;
          thesis: string;
          score: number;
          status: OpportunityItem["status"];
      }
    | { kind: "region"; label: string };

export type CanvasNodeType = "company" | "opportunity" | "region";
export type CanvasNode = {
    id: string;
    type: CanvasNodeType;
    data: CanvasNodeData;
    position: { x: number; y: number };
};
export type CanvasEdge = {
    id: string;
    source: string;
    target: string;
    variant: "mesh" | "bridge";
};
export type Canvas = { nodes: CanvasNode[]; edges: CanvasEdge[] };

// Portfolio region: a staggered 2-column grid on the left. Opportunities cluster to the right.
const CO_COLS = 2;
const CO_COL_W = 322;
const CO_ROW_H = 214;
const CO_STAGGER = 70;
const OPP_X = 1040;
const OPP_COL_W = 250;
const OPP_ROW_H = 156;

export function buildCanvas(
    companies: CompanySummary[],
    opportunities: OpportunityItem[] = [],
    currentId?: string,
): Canvas {
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    nodes.push({
        id: "region-portfolio",
        type: "region",
        data: { kind: "region", label: "// portfolio · companies" },
        position: { x: 0, y: -56 },
    });
    if (opportunities.length)
        nodes.push({
            id: "region-opps",
            type: "region",
            data: { kind: "region", label: "// opportunities · inbox" },
            position: { x: OPP_X, y: -56 },
        });

    companies.forEach((c, i) => {
        const col = i % CO_COLS;
        const row = Math.floor(i / CO_COLS);
        nodes.push({
            id: `co-${c.id}`,
            type: "company",
            data: {
                kind: "company",
                id: c.id,
                slug: c.slug,
                name: c.name,
                branding: c.branding,
                status: c.status,
                mrr: c.mrr,
                users: c.users,
                shipped: c.shipped,
                needsYou: !!c.needsYou,
                current: c.slice ? { n: c.slice.n, title: c.slice.title, state: c.slice.state } : undefined,
                isCurrent: c.id === currentId,
            },
            position: { x: col * CO_COL_W + (row % 2) * CO_STAGGER, y: row * CO_ROW_H },
        });
        if (i > 0) {
            edges.push({
                id: `mesh-${i}`,
                source: `co-${companies[i - 1].id}`,
                target: `co-${c.id}`,
                variant: "mesh",
            });
        }
    });

    opportunities.forEach((o, i) => {
        nodes.push({
            id: `opp-${o.id}`,
            type: "opportunity",
            data: {
                kind: "opportunity",
                id: o.id,
                title: o.title,
                thesis: o.thesis,
                score: o.score,
                status: o.status,
            },
            position: { x: OPP_X + (i % 2) * OPP_COL_W, y: i * OPP_ROW_H + 40 },
        });
    });
    // Bridge the two regions so the board reads as one wired system.
    if (companies.length && opportunities.length) {
        edges.push({
            id: "bridge",
            source: `co-${companies[0].id}`,
            target: `opp-${opportunities[0].id}`,
            variant: "bridge",
        });
    }

    return { nodes, edges };
}

// The top-left portfolio HUD: headline stats + the 3 most useful next moves.
export function portfolioSummary(companies: CompanySummary[], opportunities: OpportunityItem[]) {
    const stats = {
        mrr: companies.reduce((s, c) => s + c.mrr, 0),
        users: companies.reduce((s, c) => s + c.users, 0),
        active: companies.filter((c) => c.status === "active").length,
        shipped: companies.reduce((s, c) => s + c.shipped, 0),
        needsYou: companies.filter((c) => c.needsYou).length,
    };

    const moves: string[] = [];
    for (const c of companies) {
        if (c.needsYou && c.slice) moves.push(`Approve ${c.name} - ${c.slice.title}`);
    }
    for (const c of companies) {
        if (c.slice?.state === "blocked") moves.push(`Unblock ${c.name} slice ${c.slice.n}, or pause it`);
    }
    const topOpp = opportunities.find((o) => o.status === "candidate");
    if (topOpp) moves.push(`Promote “${topOpp.title}” (score ${topOpp.score}) to a company`);

    return { stats, moves: moves.slice(0, 3) };
}
