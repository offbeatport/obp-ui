import { Handle, type Node, type NodeProps, type NodeTypes, Position } from "@xyflow/react";
import { CompanyLogo } from "~/components/company-logo";
import type { CanvasNodeData } from "~/config/canvas";
import { fmtK } from "~/config/spin";
import { cn } from "~/lib/utils";

// Custom React Flow nodes for the company Overview canvas. Themed to the editorial "paper" tokens
// (globals.css) so they read in light + dark; the graph shape/data comes from buildCanvas().
// nodeTypes MUST be a stable module-scope object (a fresh one per render remounts every node).

// Small, subtle connection handles (override React Flow's default dot chrome).
const HANDLE = "!size-2 !min-h-0 !min-w-0 !rounded-full !border-0";
type NP = NodeProps<Node<CanvasNodeData>>;

const STATUS_DOT: Record<string, string> = {
    active: "bg-success",
    paused: "bg-warning",
    archived: "bg-neutral",
    draft: "bg-neutral",
};

function IdeaNode({ data }: NP) {
    if (data.kind !== "idea") return null;
    return (
        <div className="w-[228px] rounded-[14px] border border-border bg-card px-4 py-3 shadow-e1">
            <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-faint">
                Idea
            </div>
            <p className="line-clamp-4 text-[13px] leading-[1.5] text-foreground">
                {data.thesis || "No thesis yet."}
            </p>
            <Handle type="source" position={Position.Right} className={cn(HANDLE, "!bg-primary")} />
        </div>
    );
}

function CompanyNode({ data }: NP) {
    if (data.kind !== "company") return null;
    return (
        <div className="flex w-[230px] items-center gap-3 rounded-[14px] border border-border bg-card px-4 py-3 shadow-e1">
            <Handle type="target" position={Position.Left} className={cn(HANDLE, "!bg-border")} />
            <CompanyLogo name={data.name} branding={data.branding} size={34} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span
                        className={cn(
                            "size-[7px] flex-none rounded-full",
                            STATUS_DOT[data.status] ?? "bg-neutral",
                        )}
                    />
                    <span className="truncate text-[14px] font-semibold text-foreground">
                        {data.name}
                    </span>
                </div>
                {data.domain && (
                    <div className="truncate font-mono text-[11px] text-faint">{data.domain}</div>
                )}
            </div>
            <Handle type="source" position={Position.Right} className={cn(HANDLE, "!bg-primary")} />
        </div>
    );
}

function ProductNode({ data }: NP) {
    if (data.kind !== "product") return null;
    return (
        <div className="w-[252px] rounded-[14px] border border-border bg-card px-4 py-3.5 shadow-e1">
            <Handle type="target" position={Position.Left} className={cn(HANDLE, "!bg-border")} />
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                Product
            </div>
            <div className="text-[15px] font-semibold text-foreground">{data.product}</div>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.45] text-muted-foreground">
                {data.tagline}
            </p>
            {data.stack.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {data.stack.slice(0, 4).map((s) => (
                        <span
                            key={s}
                            className="rounded-[6px] bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-faint"
                        >
                            {s}
                        </span>
                    ))}
                </div>
            )}
            <div className="mt-2 font-mono text-[11px] text-faint">
                ${data.pricingUsd}/mo · {data.trialDays}d trial
            </div>
            <Handle type="source" position={Position.Right} className={cn(HANDLE, "!bg-primary")} />
        </div>
    );
}

function FeatureNode({ data }: NP) {
    if (data.kind !== "feature") return null;
    return (
        <div className="w-[222px] rounded-[12px] border border-border-soft bg-card px-3.5 py-2.5 shadow-e1">
            <Handle type="target" position={Position.Left} className={cn(HANDLE, "!bg-border")} />
            <div className="flex items-center gap-2">
                <span className="flex-none font-mono text-[10px] font-bold text-faint">
                    S{data.n}
                </span>
                <span className="truncate text-[13px] font-medium text-foreground">
                    {data.title}
                </span>
            </div>
            {data.sub && (
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-[1.4] text-muted-foreground">
                    {data.sub}
                </p>
            )}
        </div>
    );
}

function GtmNode({ data }: NP) {
    if (data.kind !== "gtm") return null;
    return (
        <div className="w-[230px] rounded-[12px] border border-approval-soft bg-card px-3.5 py-3 shadow-e1">
            <Handle type="target" position={Position.Left} className={cn(HANDLE, "!bg-border")} />
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-approval">
                GTM
            </div>
            <p className="line-clamp-2 text-[12.5px] leading-[1.4] text-muted-foreground">
                {data.persona}
            </p>
            <div className="mt-2 font-mono text-[11px] text-foreground">
                ${fmtK(data.mrrLow)}–${fmtK(data.mrrHigh)} MRR
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-faint">
                {data.competitorCount} competitors · ${data.pricingUsd}/mo
            </div>
        </div>
    );
}

export const nodeTypes: NodeTypes = {
    idea: IdeaNode,
    company: CompanyNode,
    product: ProductNode,
    feature: FeatureNode,
    gtm: GtmNode,
};
