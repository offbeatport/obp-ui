import { type Node, type NodeProps, type NodeTypes, Panel } from "@xyflow/react";
import { Button, type Signal, SignalBars, cn, gradientPairFor } from "obp-ui";
import {
    AvatarHeader,
    BRIDGE_STROKE,
    BrowserPreview,
    CANVAS_GLOW,
    CANVAS_VARIANTS,
    COMMAND_BACKDROP,
    CanvasActivityStrip,
    CanvasBackdrop,
    CanvasBoard,
    CanvasCommandBar,
    CanvasControls,
    CanvasCurrentLine,
    CanvasEntityCard,
    type CanvasFlowData,
    type CanvasGraph,
    CanvasHandles,
    CanvasHereBadge,
    CanvasHud,
    CanvasMiniMap,
    CanvasNodeAction,
    CanvasNodeNotice,
    CanvasOpportunityCard,
    CanvasPanel,
    CanvasRegionLabel,
    CanvasRibbon,
    type CanvasStat,
    CanvasSurface,
    type CanvasVariant,
    FLAVORS,
    FlavorDot,
    FlavorShell,
    MESH_STROKE,
    NodeActionsProvider,
    buildCanvasVariant,
    chromeNodeTypes,
    dottedEdge,
    indexGraph,
    useNodeActions,
    withAccentPalette,
} from "obp-ui/canvas";
import { useMemo, useState } from "react";
import { Api, Frame, Note, Row, Spec } from "../kit";

// The optional peer. Everything here comes from the "obp-ui/canvas" entry so an app
// without a board never pulls @xyflow/react into its bundle. The two stylesheets it needs
// (@xyflow/react/dist/base.css, then obp-ui/canvas.css) are imported by app.css - in
// that order, because the paper theming has to land on top.

// ── the logical graph both boards below are drawn from ────────────────────────
// Content-free by contract: the kit never inspects `data`, so this payload is the gallery's.

type CardData = {
    eyebrow: string;
    title: string;
    sub?: string;
    chips?: string[];
    score?: string;
    signals?: Signal[];
    mark?: string;
    palette?: [string, string];
    url?: string;
    headline?: string;
    cta?: string;
};

const SIGNALS: Signal[] = [
    { label: "pain", val: 8.4 },
    { label: "reach", val: 6.1 },
    { label: "moat", val: 4.7 },
];

const GRAPH: CanvasGraph<CardData> = {
    nodes: [
        {
            id: "idea",
            kind: "idea",
            data: { eyebrow: "Idea · you", title: "Freelancers get paid late" },
        },
        {
            id: "opp",
            kind: "opportunity",
            data: {
                eyebrow: "Opportunity spec",
                title: "Invoice chasing",
                sub: "Every tool for this is built for finance teams, not for one person.",
                score: "8.4",
                signals: SIGNALS,
            },
        },
        {
            id: "co",
            kind: "company",
            data: {
                eyebrow: "Company",
                title: "Ledgerly",
                sub: "ledgerly.app",
                mark: "L",
                palette: gradientPairFor("Ledgerly"),
                chips: ["TanStack", "SQLite", "Stripe"],
            },
        },
        {
            id: "landing",
            kind: "landing",
            data: {
                eyebrow: "Landing page",
                title: "Landing",
                url: "ledgerly.app",
                headline: "Stop chasing invoices.",
                cta: "Start free",
            },
        },
        {
            id: "product",
            kind: "product",
            data: { eyebrow: "Product", title: "The app", sub: "9 slices · 3 shipped" },
        },
        { id: "f1", kind: "feature", data: { eyebrow: "Feature", title: "Reminder cron" } },
        { id: "f2", kind: "feature", data: { eyebrow: "Feature", title: "Stripe checkout" } },
        { id: "f3", kind: "feature", data: { eyebrow: "Feature", title: "Client portal" } },
        { id: "c1", kind: "channel", data: { eyebrow: "Channel", title: "Indie Hackers" } },
        { id: "c2", kind: "channel", data: { eyebrow: "Channel", title: "Cold email" } },
    ],
    edges: [
        { id: "e-idea-opp", source: "idea", target: "opp" },
        { id: "e-opp-co", source: "opp", target: "co" },
        { id: "e-co-landing", source: "co", target: "landing" },
        { id: "e-co-product", source: "co", target: "product" },
        { id: "e-product-f1", source: "product", target: "f1" },
        { id: "e-product-f2", source: "product", target: "f2" },
        { id: "e-product-f3", source: "product", target: "f3" },
        { id: "e-landing-c1", source: "landing", target: "c1" },
        { id: "e-landing-c2", source: "landing", target: "c2" },
    ],
};

// A flavor only ships a single default accent; an app layers its own kind → colour palette on
// top. `perFlavor` re-skins the ones that carry their own (blueprint is deliberately cool).
const SKIN = withAccentPalette(
    FLAVORS,
    {
        idea: "var(--primary)",
        opportunity: "var(--warning)",
        company: "var(--info)",
        landing: "var(--success)",
        product: "var(--info)",
        feature: "var(--success)",
        channel: "var(--approval)",
    },
    { blueprint: { company: "var(--info)", opportunity: "var(--info)" } },
);

type NP = NodeProps<Node<CanvasFlowData<CardData>>>;

function CardNode({ data }: NP) {
    const f = SKIN[data.flavor];
    const d = data.node?.data;
    if (!d) return null;
    const a = f.accent(data.node?.kind ?? "");
    return (
        <FlavorShell
            f={f}
            accentColor={a}
            width={244}
            data={data}
            hasTarget={data.node?.kind !== "idea"}
        >
            <div className="flex items-center justify-between gap-2">
                <div className={f.eyebrow} style={{ color: a }}>
                    {d.eyebrow}
                </div>
                {d.score !== undefined && (
                    <span
                        className="rounded-full px-1.5 py-0.5 font-mono text-sm font-bold"
                        style={{
                            background: `color-mix(in srgb, ${a} 18%, transparent)`,
                            color: a,
                        }}
                    >
                        {d.score}
                    </span>
                )}
            </div>
            <div className={cn("mt-1", f.title)}>{d.title}</div>
            {d.sub !== undefined && <p className={cn("mt-1", f.sub)}>{d.sub}</p>}
            {d.chips !== undefined && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {d.chips.map((c) => (
                        <span key={c} className={f.chip}>
                            {c}
                        </span>
                    ))}
                </div>
            )}
            {d.signals !== undefined && (
                <SignalBars signals={d.signals} color={a} className="mt-2" />
            )}
        </FlavorShell>
    );
}

function CompanyNode({ data }: NP) {
    const f = SKIN[data.flavor];
    const d = data.node?.data;
    if (!d) return null;
    const a = f.accent("company");
    return (
        <FlavorShell f={f} accentColor={a} width={248} data={data}>
            <AvatarHeader
                mark={d.mark ?? "?"}
                palette={d.palette ?? gradientPairFor(d.title)}
                title={d.title}
                sub={d.sub}
                titleClassName={f.title}
            />
            <div className="mt-2 flex flex-wrap gap-1">
                {(d.chips ?? []).map((c) => (
                    <span key={c} className={f.chip}>
                        {c}
                    </span>
                ))}
            </div>
        </FlavorShell>
    );
}

function LandingNode({ data }: NP) {
    const f = SKIN[data.flavor];
    const d = data.node?.data;
    if (!d) return null;
    const a = f.accent("landing");
    return (
        <FlavorShell f={f} accentColor={a} width={236} data={data}>
            <div className={f.eyebrow} style={{ color: a }}>
                {d.eyebrow}
            </div>
            <BrowserPreview
                url={d.url}
                headline={d.headline}
                cta={d.cta}
                ctaColor={a}
                titleClassName={f.title}
            />
        </FlavorShell>
    );
}

function LeafNode({ data }: NP) {
    const f = SKIN[data.flavor];
    const d = data.node?.data;
    if (!d) return null;
    const a = f.accent(data.node?.kind ?? "");
    return (
        <FlavorShell f={f} accentColor={a} width={186} data={data} hasSource={false}>
            <div className="flex items-center gap-2">
                <FlavorDot color={a} />
                <div className={f.title}>{d.title}</div>
            </div>
            <div className={cn("mt-0.5", f.eyebrow)} style={{ color: a }}>
                {d.eyebrow}
            </div>
        </FlavorShell>
    );
}

// Must stay a stable module-scope object - React Flow remounts every node otherwise.
const NODE_TYPES: NodeTypes = {
    idea: CardNode,
    opportunity: CardNode,
    product: CardNode,
    company: CompanyNode,
    landing: LandingNode,
    feature: LeafNode,
    channel: LeafNode,
    ...chromeNodeTypes,
};

function VariantBoard({ variant }: { variant: CanvasVariant }) {
    const { nodes, edges } = useMemo(() => buildCanvasVariant(variant, GRAPH), [variant]);
    const f = SKIN[variant.flavor];
    return (
        <CanvasSurface dark={f.dark} className={cn("relative overflow-hidden", f.container)}>
            <CanvasBoard
                key={variant.id}
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                fitViewOptions={{ padding: 0.18 }}
            >
                {f.bg && <CanvasBackdrop layers={[f.bg]} />}
                <CanvasControls position="bottom-right" />
            </CanvasBoard>
        </CanvasSurface>
    );
}

// ── the command surface ───────────────────────────────────────────────────────
// The second vocabulary: a dark, glowing board of entity + opportunity cards under fixed HUD
// panels. These cards render their own handles, so they only work inside a board.

type EntityData = {
    name: string;
    meta: string;
    statusColor: string;
    statusGlow?: string;
    accent?: string;
    ribbon?: string;
    here?: boolean;
    stats: CanvasStat[];
    current: string;
};

type OppData = {
    title: string;
    score: string;
    scoreColor: string;
    thesis: string;
    muted?: boolean;
    killed?: boolean;
};

type RegionData = { label: string; accent: string };

/** The callback bag a node renderer reads - React Flow only hands it `data`. */
type BoardActions = { open: (name: string) => void; promote: (title: string) => void };

function EntityNode({ data }: NodeProps<Node<EntityData>>) {
    const { open } = useNodeActions<BoardActions>();
    return (
        <div onClickCapture={() => open?.(data.name)}>
            <CanvasEntityCard
                name={data.name}
                meta={data.meta}
                statusColor={data.statusColor}
                statusGlow={data.statusGlow}
                accent={data.accent}
                ribbon={data.ribbon ? <CanvasRibbon>{data.ribbon}</CanvasRibbon> : undefined}
                badge={data.here ? <CanvasHereBadge>here</CanvasHereBadge> : undefined}
                stats={data.stats}
                footer={
                    <CanvasCurrentLine
                        color={data.statusColor}
                        text={data.current}
                        pulse={Boolean(data.accent)}
                    />
                }
            />
        </div>
    );
}

function OppNode({ data }: NodeProps<Node<OppData>>) {
    const { promote } = useNodeActions<BoardActions>();
    return (
        <div className="relative">
            <CanvasOpportunityCard
                title={data.title}
                score={data.score}
                scoreColor={data.scoreColor}
                thesis={data.thesis}
                muted={data.muted}
                footer={
                    data.killed ? (
                        <CanvasNodeNotice>killed</CanvasNodeNotice>
                    ) : (
                        <CanvasNodeAction onClick={() => promote?.(data.title)}>
                            ↑ promote to company
                        </CanvasNodeAction>
                    )
                }
            />
            <CanvasHandles />
        </div>
    );
}

function RegionNode({ data }: NodeProps<Node<RegionData>>) {
    return <CanvasRegionLabel label={data.label} accentColor={data.accent} />;
}

const COMMAND_NODE_TYPES: NodeTypes = {
    entity: EntityNode,
    opportunity: OppNode,
    region: RegionNode,
};

const COMMAND_NODES: Node[] = [
    {
        id: "r-portfolio",
        type: "region",
        position: { x: -20, y: -120 },
        data: { label: "01 portfolio", accent: "var(--info)" },
    },
    {
        id: "r-scouting",
        type: "region",
        position: { x: 620, y: -120 },
        data: { label: "02 scouting", accent: "var(--approval)" },
    },
    {
        id: "ledgerly",
        type: "entity",
        position: { x: -20, y: -40 },
        data: {
            name: "Ledgerly",
            meta: "ledgerly.app",
            statusColor: "var(--info)",
            statusGlow: "0 0 10px var(--info)",
            accent: "var(--info)",
            here: true,
            stats: [
                { value: "$1.2k", label: "mrr" },
                { value: "3/9", label: "slices" },
                { value: "$4.10", label: "burn" },
            ],
            current: "writing checkout…",
        } satisfies EntityData,
    },
    {
        id: "harbourline",
        type: "entity",
        position: { x: -20, y: 190 },
        data: {
            name: "Harbourline",
            meta: "harbourline.co",
            statusColor: "var(--success)",
            statusGlow: "0 0 10px var(--success)",
            stats: [
                { value: "$340", label: "mrr" },
                { value: "9/9", label: "slices" },
                { value: "$0.90", label: "burn" },
            ],
            current: "healthy · idle",
        } satisfies EntityData,
    },
    {
        id: "nudge",
        type: "entity",
        position: { x: 300, y: 75 },
        data: {
            name: "Nudge",
            meta: "nudge.email",
            statusColor: "var(--approval)",
            accent: "var(--approval)",
            ribbon: "needs you",
            stats: [
                { value: "$0", label: "mrr" },
                { value: "6/9", label: "slices" },
                { value: "$2.40", label: "burn" },
            ],
            current: "waiting on your approval",
        } satisfies EntityData,
    },
    {
        id: "opp-handover",
        type: "opportunity",
        position: { x: 640, y: -40 },
        data: {
            title: "Handover packets",
            score: "7.1",
            scoreColor: "var(--success)",
            thesis: "Agencies rebuild the same handover doc every project; nobody sells the packet.",
        } satisfies OppData,
    },
    {
        id: "opp-standup",
        type: "opportunity",
        position: { x: 640, y: 190 },
        data: {
            title: "Async standups",
            score: "5.9",
            scoreColor: "var(--warning)",
            thesis: "Six funded incumbents and no wedge a small team can hold.",
            muted: true,
            killed: true,
        } satisfies OppData,
    },
];

const COMMAND_EDGES = [
    dottedEdge({ id: "c-1", source: "ledgerly", target: "nudge" }),
    dottedEdge({ id: "c-2", source: "harbourline", target: "nudge" }),
    dottedEdge({ id: "c-3", source: "nudge", target: "opp-handover", stroke: BRIDGE_STROKE }),
];

const IX = indexGraph(GRAPH);

const HUD_STATS = [
    { label: "cos", value: "3" },
    { label: "specs", value: String(IX.many("opportunity").length) },
    { label: "features", value: String(IX.many("feature").length) },
    { label: "channels", value: String(IX.many("channel").length) },
    { label: "need you", value: "1", alert: true },
];

const ACTIVITY = [
    {
        id: "a1",
        group: "Ledgerly",
        text: "wrote src/routes/checkout.tsx",
        ago: "2m",
        color: "var(--info)",
    },
    {
        id: "a2",
        group: "Nudge",
        text: "waiting on your approval",
        ago: "18m",
        color: "var(--approval)",
    },
    {
        id: "a3",
        group: "Harbourline",
        text: "deploy v31 healthy",
        ago: "1h",
        color: "var(--success)",
    },
];

function CommandBoard() {
    const [log, setLog] = useState("nothing yet");
    const actions = useMemo<BoardActions>(
        () => ({
            open: (name) => setLog(`open(${name})`),
            promote: (title) => setLog(`promote(${title})`),
        }),
        [],
    );
    return (
        <>
            <Frame className="h-[560px]">
                <CanvasSurface dark glow={CANVAS_GLOW} className="relative overflow-hidden">
                    <NodeActionsProvider actions={actions}>
                        <CanvasBoard
                            nodes={COMMAND_NODES}
                            edges={COMMAND_EDGES}
                            nodeTypes={COMMAND_NODE_TYPES}
                            fitViewOptions={{ padding: 0.22 }}
                        >
                            <CanvasBackdrop layers={COMMAND_BACKDROP} />
                            <Panel position="top-left">
                                <CanvasHud
                                    title="cslopslop"
                                    note="// command surface"
                                    stats={HUD_STATS}
                                    moves={[
                                        "Approve Nudge's pricing change",
                                        "Give Ledgerly a live Stripe key",
                                        "Kill or promote the standup spec",
                                    ]}
                                />
                            </Panel>
                            <Panel position="top-center">
                                <CanvasActivityStrip items={ACTIVITY} />
                            </Panel>
                            <Panel position="top-right">
                                <CanvasPanel className="px-3.5 py-2.5">
                                    <span className="font-mono text-sm text-muted-foreground">
                                        mesh · bridge
                                    </span>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span
                                            className="block h-px w-10"
                                            style={{ background: MESH_STROKE }}
                                        />
                                        <span
                                            className="block h-px w-10"
                                            style={{ background: BRIDGE_STROKE }}
                                        />
                                    </div>
                                </CanvasPanel>
                            </Panel>
                            <Panel position="bottom-center">
                                <CanvasCommandBar
                                    placeholder="ask the fleet to do something…"
                                    onSubmit={(v) => setLog(`command: ${v}`)}
                                />
                            </Panel>
                            <CanvasControls position="bottom-left" />
                            <CanvasMiniMap />
                        </CanvasBoard>
                    </NodeActionsProvider>
                </CanvasSurface>
            </Frame>
            <p className="mt-2 font-mono text-sm text-faint">last action: {log}</p>
        </>
    );
}

export function CanvasSection() {
    const [variant, setVariant] = useState(CANVAS_VARIANTS[0]);

    return (
        <>
            <Spec
                name="CanvasSurface · CanvasBoard · CanvasBackdrop · CanvasControls · FLAVORS · CANVAS_VARIANTS"
                note="one graph, ten layout × flavor pairings. Interaction is locked: pan and zoom, but nothing moves."
                bare
            >
                <Row className="mb-3">
                    {CANVAS_VARIANTS.map((v) => (
                        <Button
                            key={v.id}
                            size="sm"
                            variant={v.id === variant.id ? "default" : "outline"}
                            onClick={() => setVariant(v)}
                        >
                            {String(v.id).padStart(2, "0")} {v.name}
                        </Button>
                    ))}
                </Row>
                <Frame className="h-[520px]">
                    <VariantBoard variant={variant} />
                </Frame>
                <Note>
                    <span className="font-mono">{variant.flavor}</span> flavor · {variant.blurb} The
                    node renderers are the gallery's (they read gallery data); the card shell,
                    avatar header, browser preview and lane / column chrome come from the kit.
                </Note>
            </Spec>

            <Spec
                name="CanvasEntityCard · CanvasOpportunityCard · CanvasHud · CanvasActivityStrip · CanvasCommandBar"
                note="the command surface: forced-dark cards under fixed HUD panels. Click a card, promote a spec, type a command."
                bare
            >
                <CommandBoard />
                <Note>
                    Ribbon, "here" badge, current line, the promote CTA and the killed stamp are all
                    separate exports - a card composes the ones it needs.
                </Note>
            </Spec>

            <Spec
                name="The rest of the entry"
                note="layouts, chrome helpers and the constants the boards above are built from."
                bare
            >
                <Api
                    items={[
                        {
                            name: "LOCKED_CANVAS",
                            note: "the interaction config CanvasBoard already applies - no drag, no connect, no select, tight zoom bounds.",
                        },
                        {
                            name: "columns · treeDown · radial · swimlanes · kanban",
                            note: "layouts 1-5. Each arranges the same graph and returns positioned nodes.",
                        },
                        {
                            name: "bento · blueprint · mindmap · timeline · constellation",
                            note: "layouts 6-10, paired with a flavor by CANVAS_VARIANTS.",
                        },
                        {
                            name: "buildCanvasVariant(v, graph)",
                            note: "resolves a variant against a graph to concrete { nodes, edges }.",
                        },
                        {
                            name: "flavorEdges · laneNode · colHeadNode",
                            note: "the pieces a custom layout needs: flavor-styled edges and the two chrome nodes.",
                        },
                        {
                            name: "chromeNodeTypes (LaneNode · ColHeadNode)",
                            note: "the renderers those chrome nodes need - spread into nodeTypes. Swimlanes, Kanban and Stage Timeline above draw them.",
                        },
                        {
                            name: "SWIMLANE_BANDS · KANBAN_COLUMNS · TIMELINE_STAGES · BENTO_ORDER",
                            note: "the band / column / stage tables those four layouts read.",
                        },
                        {
                            name: "indexGraph(graph)",
                            note: "kind → nodes, in graph order. The HUD counts above come from it.",
                            value: `${IX.many("feature").length} features`,
                        },
                        {
                            name: "withAccents · withAccentPalette",
                            note: "layer an app's kind → colour palette onto one flavor, or onto the whole set.",
                        },
                        {
                            name: "CANVAS_PANEL · HIDDEN_HANDLE",
                            note: "the frosted-panel class every HUD overlay is built on, and the invisible handle pair.",
                        },
                        {
                            name: "CanvasGraph · CanvasFlowData · PipelineKind",
                            note: "the logical graph, the React Flow data payload, and the seven roles the built-in layouts arrange.",
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
