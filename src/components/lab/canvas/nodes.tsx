import { Handle, type Node, type NodeProps, type NodeTypes, Position } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { LabNode } from "~/lab/graph";
import { cn } from "~/lib/utils";
import { FLAVORS, type Flavor, type FlavorKey, STATE_DOT } from "./flavors";

// ============================================================================
// Shared, flavor-driven node renderers for the lab canvases. ONE set of
// renderers; the `flavor` in each node's data restyles the frame/text so all
// 10 canvas variants reuse them. nodeTypes is a stable module-scope object.
// ============================================================================

export type RFData = {
    n?: LabNode; // the logical node (absent for lane/colhead chrome)
    flavor: FlavorKey;
    ht?: Position; // target handle side
    hs?: Position; // source handle side
    // lane / colhead chrome:
    label?: string;
    w?: number;
    h?: number;
    accent?: string;
};

type NP = NodeProps<Node<RFData>>;
const HANDLE = "!size-1.5 !min-h-0 !min-w-0 !rounded-full !border-0 !bg-transparent";

// Card shell: applies the flavor frame + width + both handles.
function Shell({
    f,
    accentColor,
    width,
    children,
    data,
    hasTarget = true,
    hasSource = true,
}: {
    f: Flavor;
    accentColor: string;
    width: number;
    children: React.ReactNode;
    data: RFData;
    hasTarget?: boolean;
    hasSource?: boolean;
}) {
    const ht = data.ht ?? Position.Left;
    const hs = data.hs ?? Position.Right;
    return (
        <div
            className={cn("px-4 py-3", f.radius)}
            style={{ width, ...f.frame(accentColor) } as CSSProperties}
        >
            {hasTarget && <Handle type="target" position={ht} className={HANDLE} />}
            {children}
            {hasSource && <Handle type="source" position={hs} className={HANDLE} />}
        </div>
    );
}

function Dot({ color }: { color: string }) {
    return (
        <span
            className="size-[7px] flex-none rounded-full"
            style={{ background: color, boxShadow: `0 0 8px -1px ${color}` }}
        />
    );
}

function IdeaNode({ data }: NP) {
    if (data.n?.data.kind !== "idea") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("idea");
    return (
        <Shell f={f} accentColor={a} width={232} data={data} hasTarget={false}>
            <div className={f.eyebrow} style={{ color: a }}>
                Idea · {d.author}
            </div>
            <p className={cn("mt-1.5 line-clamp-4", f.sub)}>{d.thesis}</p>
        </Shell>
    );
}

function OpportunityNode({ data }: NP) {
    if (data.n?.data.kind !== "opportunity") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("opportunity");
    return (
        <Shell f={f} accentColor={a} width={272} data={data}>
            <div className="flex items-center justify-between">
                <div className={f.eyebrow} style={{ color: a }}>
                    Opportunity spec
                </div>
                <span
                    className="rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    style={{ background: `color-mix(in srgb, ${a} 18%, transparent)`, color: a }}
                >
                    {d.score.toFixed(1)}
                </span>
            </div>
            <div className={cn("mt-1", f.title)}>{d.title}</div>
            <p className={cn("mt-1 line-clamp-2", f.sub)}>{d.pain}</p>
            <div className="mt-2 grid grid-cols-3 gap-1">
                {d.signals.map((s) => (
                    <div key={s.label} className="flex flex-col gap-0.5">
                        <div className="h-1 overflow-hidden rounded-full bg-[color:var(--border-soft)]">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${s.val * 10}%`, background: a }}
                            />
                        </div>
                        <span className="font-mono text-[8.5px] uppercase tracking-wide text-faint">
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-2 font-mono text-[10.5px] text-faint">
                ${(d.mrrLow / 1000).toFixed(0)}k–${(d.mrrHigh / 1000).toFixed(0)}k MRR · specced
            </div>
        </Shell>
    );
}

function CompanyNode({ data }: NP) {
    if (data.n?.data.kind !== "company") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("company");
    return (
        <Shell f={f} accentColor={a} width={246} data={data}>
            <div className="flex items-center gap-3">
                <span
                    className="grid size-9 flex-none place-items-center rounded-[9px] font-display text-[15px] font-bold text-white"
                    style={{
                        background: `linear-gradient(145deg, ${d.palette[0]}, ${d.palette[1]})`,
                    }}
                >
                    {d.mark}
                </span>
                <div className="min-w-0">
                    <div className={cn("truncate", f.title)}>{d.name}</div>
                    <div className="truncate font-mono text-[11px] text-faint">{d.domain}</div>
                </div>
            </div>
            <p className={cn("mt-2", f.sub)}>{d.tagline}</p>
            <div className="mt-2 flex flex-wrap gap-1">
                {d.stack.slice(0, 4).map((s) => (
                    <span key={s} className={f.chip}>
                        {s}
                    </span>
                ))}
            </div>
            <div className="mt-2 font-mono text-[10.5px] text-faint">
                ${d.pricingUsd}/mo · {d.trialDays}d trial · {d.status}
            </div>
        </Shell>
    );
}

function LandingNode({ data }: NP) {
    if (data.n?.data.kind !== "landing") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("landing");
    return (
        <Shell f={f} accentColor={a} width={238} data={data}>
            <div className={f.eyebrow} style={{ color: a }}>
                Landing page
            </div>
            {/* miniature browser chrome */}
            <div className="mt-1.5 overflow-hidden rounded-[7px] border border-border-soft">
                <div className="flex items-center gap-1 bg-secondary px-2 py-1">
                    <span className="size-1.5 rounded-full bg-destructive/60" />
                    <span className="size-1.5 rounded-full bg-warning/60" />
                    <span className="size-1.5 rounded-full bg-success/60" />
                    <span className="ml-1 truncate font-mono text-[9px] text-faint">{d.url}</span>
                </div>
                <div className="px-2.5 py-2">
                    <div className={cn("line-clamp-2 text-[12px] font-semibold", f.title)}>
                        {d.headline}
                    </div>
                    <div
                        className="mt-1.5 inline-block rounded-[5px] px-2 py-0.5 text-[9px] font-semibold text-white"
                        style={{ background: a }}
                    >
                        {d.cta}
                    </div>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
                {d.sections.slice(0, 4).map((s) => (
                    <span key={s} className={f.chip}>
                        {s}
                    </span>
                ))}
            </div>
        </Shell>
    );
}

function ProductNode({ data }: NP) {
    if (data.n?.data.kind !== "product") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("product");
    return (
        <Shell f={f} accentColor={a} width={252} data={data}>
            <div className={f.eyebrow} style={{ color: a }}>
                Product
            </div>
            <div className={cn("mt-1", f.title)}>{d.product}</div>
            <p className={cn("mt-1 line-clamp-2", f.sub)}>{d.tagline}</p>
            <div className="mt-2 rounded-[7px] bg-secondary/60 px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-mono text-[9px] uppercase tracking-wide text-faint">ICP</span>{" "}
                {d.icp}
            </div>
            <div className="mt-2 font-mono text-[10.5px] text-faint">
                ${d.pricingUsd}/mo · {d.trialDays}d trial
            </div>
        </Shell>
    );
}

function FeatureNode({ data }: NP) {
    if (data.n?.data.kind !== "feature") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("feature");
    return (
        <Shell f={f} accentColor={a} width={214} data={data} hasSource={false}>
            <div className="flex items-center gap-2">
                <Dot color={STATE_DOT[d.state]} />
                <span className="flex-none font-mono text-[10px] font-bold" style={{ color: a }}>
                    F{d.n}
                </span>
                <span className={cn("truncate text-[12.5px] font-semibold", f.title)}>
                    {d.title}
                </span>
            </div>
            <p className={cn("mt-1 line-clamp-2", f.sub)}>{d.sub}</p>
            <div className="mt-1.5 font-mono text-[9.5px] uppercase tracking-wide text-faint">
                {d.state}
            </div>
        </Shell>
    );
}

function ChannelNode({ data }: NP) {
    if (data.n?.data.kind !== "channel") return null;
    const f = FLAVORS[data.flavor];
    const d = data.n.data;
    const a = f.accent("channel");
    return (
        <Shell f={f} accentColor={a} width={226} data={data} hasSource={false}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Dot color={STATE_DOT[d.state]} />
                    <span className={cn("text-[13px] font-semibold", f.title)}>{d.platform}</span>
                </div>
                <span className="font-mono text-[9.5px] text-faint">{d.cadence}</span>
            </div>
            <div className="mt-0.5 font-mono text-[10px]" style={{ color: a }}>
                {d.handle}
            </div>
            <p className={cn("mt-1 line-clamp-2", f.sub)}>{d.tactic}</p>
            <div className="mt-1.5 font-mono text-[9.5px] text-faint">reach {d.reach}</div>
        </Shell>
    );
}

// Section panel behind a group of nodes (swimlanes / clustered layouts).
function LaneNode({ data }: NP) {
    const f = FLAVORS[data.flavor];
    const a = data.accent ?? "var(--faint)";
    return (
        <div
            className="rounded-[18px]"
            style={{
                width: data.w ?? 300,
                height: data.h ?? 200,
                background: f.dark
                    ? "rgba(255,255,255,0.03)"
                    : `color-mix(in srgb, ${a} 5%, transparent)`,
                border: `1px dashed color-mix(in srgb, ${a} 40%, var(--border))`,
            }}
        >
            <div
                className="px-4 pt-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: a }}
            >
                {data.label}
            </div>
        </div>
    );
}

// Column header chip (kanban).
function ColHeadNode({ data }: NP) {
    const a = data.accent ?? "var(--foreground)";
    return (
        <div
            className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
                width: data.w ?? 200,
                background: `color-mix(in srgb, ${a} 12%, var(--card))`,
                color: a,
                border: `1px solid color-mix(in srgb, ${a} 30%, var(--border))`,
            }}
        >
            <span className="size-2 rounded-full" style={{ background: a }} />
            {data.label}
        </div>
    );
}

export const labNodeTypes: NodeTypes = {
    idea: IdeaNode,
    opportunity: OpportunityNode,
    company: CompanyNode,
    landing: LandingNode,
    product: ProductNode,
    feature: FeatureNode,
    channel: ChannelNode,
    lane: LaneNode,
    colhead: ColHeadNode,
};
