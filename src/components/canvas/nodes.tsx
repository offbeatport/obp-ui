import { Handle, type Node, type NodeProps, type NodeTypes, Position } from "@xyflow/react";
import type { CanvasNodeData, SliceState } from "~/config/canvas";
import { cn } from "~/lib/utils";
import { useCanvasNav } from "./nav-context";

// Custom React Flow nodes for the "Infinite Canvas · command surface" (v2 prototype 05). A dark,
// glowing portfolio board: company nodes (with building / needs-you auras), opportunity nodes, and
// region labels. The canvas forces `.dark`, so app tokens resolve to the neon-on-near-black palette
// (info=blue, approval=violet, success=green, warning=amber). nodeTypes MUST be module-scope stable.

type NP = NodeProps<Node<CanvasNodeData>>;

// Hidden connection handles (edges are decorative; we don't want visible dots).
const HANDLE = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !opacity-0";

const STATUS_DOT: Record<string, { bg: string; glow: string }> = {
    active: { bg: "var(--success)", glow: "0 0 10px var(--success)" },
    paused: { bg: "var(--warning)", glow: "0 0 10px var(--warning)" },
    archived: { bg: "var(--neutral)", glow: "none" },
    draft: { bg: "var(--neutral)", glow: "none" },
};

const SLICE_COLOR: Record<SliceState, string> = {
    building: "var(--info)",
    awaiting_approval: "var(--approval)",
    blocked: "var(--destructive)",
    todo: "var(--neutral)",
    shipped: "var(--success)",
};

function CompanyNode({ data }: NP) {
    if (data.kind !== "company") return null;
    const dot = STATUS_DOT[data.status] ?? STATUS_DOT.draft;
    const building = data.current?.state === "building";
    const accent = data.needsYou ? "var(--approval)" : building ? "var(--info)" : undefined;

    return (
        <div
            className="group relative w-[260px] cursor-pointer rounded-[14px] border p-4 transition-[transform,border-color] duration-200 hover:-translate-y-[3px]"
            style={{
                background:
                    "linear-gradient(180deg, var(--card), color-mix(in srgb, var(--card) 70%, var(--background)))",
                borderColor: accent ?? "var(--border)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
            }}
        >
            {/* glow ring: persistent for building/needs-you, on hover otherwise */}
            <span
                aria-hidden
                className={cn(
                    "pointer-events-none absolute -inset-px rounded-[15px] transition-opacity",
                    accent ? "animate-pulse opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
                style={{
                    boxShadow: `0 0 0 1px ${accent ?? "var(--info)"}, 0 0 26px color-mix(in srgb, ${accent ?? "var(--info)"} 32%, transparent)`,
                }}
            />
            {data.needsYou && (
                <span
                    className="absolute -top-2.5 right-3.5 rounded-full px-2 py-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]"
                    style={{
                        background: "var(--approval)",
                        color: "#160d2e",
                        boxShadow: "0 0 18px color-mix(in srgb, var(--approval) 60%, transparent)",
                    }}
                >
                    needs you
                </span>
            )}

            <div className="mb-2.5 flex items-center gap-2">
                <span
                    className="size-[9px] flex-none rounded-full"
                    style={{ background: dot.bg, boxShadow: dot.glow }}
                />
                <span className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
                    {data.name}
                </span>
                {data.isCurrent && (
                    <span className="rounded bg-[color:var(--info)]/15 px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--info)]">
                        here
                    </span>
                )}
                <span className="ml-auto font-mono text-[10.5px] text-faint">{data.slug}</span>
            </div>

            <div className="mb-3 flex gap-3.5 border-t border-border pt-2.5">
                {[
                    [`$${data.mrr}`, "mrr"],
                    [String(data.users), "users"],
                    [String(data.shipped), "shipped"],
                ].map(([v, l]) => (
                    <div key={l} className="flex flex-col gap-px">
                        <b className="font-mono text-[14px] font-semibold text-foreground">{v}</b>
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-faint">
                            {l}
                        </span>
                    </div>
                ))}
            </div>

            {data.needsYou ? (
                <CurrentLine
                    color="var(--approval)"
                    pulse
                    text={`slice ${data.current?.n ?? ""} awaiting your approval`}
                />
            ) : data.current && data.current.state !== "shipped" ? (
                <CurrentLine
                    color={SLICE_COLOR[data.current.state]}
                    pulse={building}
                    text={`slice ${data.current.n} · ${data.current.state.replace("_", " ")}`}
                />
            ) : (
                <CurrentLine color="var(--faint)" text="on autopilot · queue clear" />
            )}

            <Handle id="l" type="target" position={Position.Left} className={HANDLE} />
            <Handle id="r" type="source" position={Position.Right} className={HANDLE} />
        </div>
    );
}

function CurrentLine({ color, text, pulse }: { color: string; text: string; pulse?: boolean }) {
    return (
        <div className="flex items-center gap-2 font-mono text-[11px]" style={{ color }}>
            <span
                className={cn("size-[7px] flex-none rounded-full", pulse && "animate-pulse")}
                style={{ background: color }}
            />
            {text}
        </div>
    );
}

function OpportunityNode({ data }: NP) {
    if (data.kind !== "opportunity") return null;
    const killed = data.status === "killed";
    const scoreCol =
        data.score >= 70
            ? "var(--success)"
            : data.score >= 50
              ? "var(--warning)"
              : "var(--destructive)";
    const nav = useCanvasNav();
    return (
        <div
            className={cn(
                "group relative w-[220px] rounded-[12px] border p-3.5 transition-[transform,border-color] duration-200",
                killed ? "opacity-45" : "hover:-translate-y-[3px]",
            )}
            style={{
                background: "linear-gradient(180deg, rgba(24,18,40,.92), rgba(16,12,28,.92))",
                borderColor: "color-mix(in srgb, var(--approval) 24%, transparent)",
                boxShadow: "0 10px 30px rgba(0,0,0,.5)",
            }}
        >
            {!killed && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute -inset-px rounded-[13px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                        boxShadow:
                            "0 0 0 1px var(--approval), 0 0 28px color-mix(in srgb, var(--approval) 34%, transparent)",
                    }}
                />
            )}
            <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13.5px] font-bold text-foreground">{data.title}</span>
                <span
                    className="ml-auto rounded-[7px] px-1.5 py-0.5 font-mono text-[13px] font-bold"
                    style={{ color: scoreCol, background: "rgba(255,255,255,.04)" }}
                >
                    {data.score}
                </span>
            </div>
            <p className="text-[11px] leading-[1.4] text-muted-foreground">{data.thesis}</p>
            {killed ? (
                <div className="mt-2.5 rounded-lg border border-[color:var(--destructive)]/25 bg-[color:var(--destructive)]/8 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.05em] text-[color:var(--destructive)]">
                    killed
                </div>
            ) : (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        nav.onNewCompany?.();
                    }}
                    className="nodrag nopan mt-2.5 w-full rounded-lg border border-[color:var(--approval)]/30 bg-[color:var(--approval)]/12 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.05em] text-[color:var(--approval)] transition-colors hover:bg-[color:var(--approval)]/25"
                >
                    ↑ promote to company
                </button>
            )}
        </div>
    );
}

function RegionNode({ data }: NP) {
    if (data.kind !== "region") return null;
    const [tick, ...rest] = data.label.split(" ");
    return (
        <div className="pointer-events-none whitespace-nowrap font-mono text-[13px] uppercase tracking-[0.35em] text-faint">
            <span className="text-[color:var(--info)]">{tick}</span> {rest.join(" ")}
        </div>
    );
}

export const nodeTypes: NodeTypes = {
    company: CompanyNode,
    opportunity: OpportunityNode,
    region: RegionNode,
};
