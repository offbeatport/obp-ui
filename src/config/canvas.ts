import type { CompanyDetail } from "../server/data.js";
// CLIENT-SAFE canvas projection (no sqlite/fs, like config/spin.ts). Turns a CompanyDetail into
// the node/edge graph the React Flow Overview renders: the founder's idea → the company → the
// product → each feature (spec slice) + the GTM outline. Pure + deterministic: the same detail
// yields identical nodes/positions, so v1 needs NO saved layout (v2 will overlay slop/canvas.json).
import type { Branding } from "./spin.js";

export type CanvasNodeType = "idea" | "company" | "product" | "feature" | "gtm";

// Discriminated on `kind` so each node renderer narrows without casts.
export type CanvasNodeData =
    | { kind: "idea"; thesis: string }
    | {
          kind: "company";
          name: string;
          domain?: string;
          branding?: Branding;
          status: CompanyDetail["status"];
      }
    | {
          kind: "product";
          product: string;
          tagline: string;
          icp: string;
          pricingUsd: number;
          trialDays: number;
          stack: string[];
      }
    | { kind: "feature"; n: number; title: string; sub: string; doneWhen?: string }
    | {
          kind: "gtm";
          persona: string;
          mrrLow: number;
          mrrHigh: number;
          wtpQuote: string;
          competitorCount: number;
          pricingUsd: number;
          trialDays: number;
      };

export type CanvasNode = {
    id: string;
    type: CanvasNodeType;
    data: CanvasNodeData;
    position: { x: number; y: number };
};
export type CanvasEdge = { id: string; source: string; target: string };
export type Canvas = { nodes: CanvasNode[]; edges: CanvasEdge[] };

// Column-per-depth layout: idea(0) → company(1) → product(2) → [features + gtm](3, stacked).
// The trunk (idea/company/product) is vertically centered on the right-hand stack.
const COL_W = 340;
const ROW_H = 128;

export function buildCanvas(detail: CompanyDetail): Canvas {
    const spec = detail.spec;
    const nodes: CanvasNode[] = [];
    const edges: CanvasEdge[] = [];

    // Column 3 (rightmost): one node per feature slice, then the GTM node - only when specced.
    const right: CanvasNode[] = [];
    if (spec) {
        spec.slices.forEach((s, i) => {
            right.push({
                id: `feature-${i}`,
                type: "feature",
                data: {
                    kind: "feature",
                    n: i + 1,
                    title: s.title,
                    sub: s.sub,
                    doneWhen: s.doneWhen,
                },
                position: { x: 3 * COL_W, y: 0 },
            });
        });
        right.push({
            id: "gtm",
            type: "gtm",
            data: {
                kind: "gtm",
                persona: spec.market.persona,
                mrrLow: spec.market.mrrLow,
                mrrHigh: spec.market.mrrHigh,
                wtpQuote: spec.market.wtpQuote,
                competitorCount: spec.market.competitors.length,
                pricingUsd: spec.pricingUsd,
                trialDays: spec.trialDays,
            },
            position: { x: 3 * COL_W, y: 0 },
        });
    }
    // Center the right column around y=0, then the trunk sits at that center.
    right.forEach((node, i) => {
        node.position.y = (i - (right.length - 1) / 2) * ROW_H;
    });

    nodes.push({
        id: "idea",
        type: "idea",
        data: { kind: "idea", thesis: detail.thesis },
        position: { x: 0, y: 0 },
    });
    nodes.push({
        id: "company",
        type: "company",
        data: {
            kind: "company",
            name: spec?.product ?? detail.name,
            domain: detail.domain ?? detail.branding?.domain,
            branding: detail.branding,
            status: detail.status,
        },
        position: { x: COL_W, y: 0 },
    });
    edges.push({ id: "e-idea-company", source: "idea", target: "company" });

    if (spec) {
        nodes.push({
            id: "product",
            type: "product",
            data: {
                kind: "product",
                product: spec.product,
                tagline: spec.tagline,
                icp: spec.icp,
                pricingUsd: spec.pricingUsd,
                trialDays: spec.trialDays,
                stack: spec.stack,
            },
            position: { x: 2 * COL_W, y: 0 },
        });
        edges.push({ id: "e-company-product", source: "company", target: "product" });
        for (const node of right) {
            edges.push({ id: `e-product-${node.id}`, source: "product", target: node.id });
        }
        nodes.push(...right);
    }

    return { nodes, edges };
}
