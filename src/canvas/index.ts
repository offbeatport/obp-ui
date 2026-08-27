// obp-ui/canvas - the React Flow visual vocabulary.
//
// A separate entry point so apps that don't ship a board never pull @xyflow/react in
// (it is an OPTIONAL peer). This is the only subtree in the package allowed to import it.
//
// The stylesheets are not JS - import them yourself, in this order:
//   import "@xyflow/react/dist/base.css";   // un-themed React Flow primitives
//   import "obp-ui/canvas.css";       // the paper theming on top
//
// What ships here: the board (locked interaction config, backdrop, controls, minimap),
// the card vocabulary, the flavor skins, and the 10 layouts. What does NOT ship here:
// the projection from an app's own model to a graph - that stays in the app, which
// feeds `CanvasGraph` in and renders its own per-kind node renderers out of these parts.

export {
    CANVAS_GLOW,
    CanvasBackdrop,
    type CanvasBackdropLayer,
    CanvasBoard,
    CanvasControls,
    CanvasMiniMap,
    CanvasSurface,
    type CanvasSurfaceProps,
    COMMAND_BACKDROP,
    LOCKED_CANVAS,
} from "./board";

export { BRIDGE_STROKE, type DottedEdgeInput, dottedEdge, MESH_STROKE } from "./edges";

export {
    AvatarHeader,
    type AvatarHeaderProps,
    BrowserPreview,
    type BrowserPreviewProps,
    chromeNodeTypes,
    ColHeadNode,
    FlavorDot,
    FlavorShell,
    type FlavorShellProps,
    LaneNode,
} from "./flavor-nodes";

export {
    type Flavor,
    type FlavorAccent,
    type FlavorEdge,
    type FlavorKey,
    FLAVORS,
    withAccentPalette,
    withAccents,
} from "./flavors";

export {
    type CanvasFlowData,
    type CanvasFlowNode,
    type CanvasGraph,
    type CanvasGraphEdge,
    type CanvasGraphIndex,
    type CanvasGraphNode,
    indexGraph,
    type PipelineKind,
} from "./graph";

export {
    CANVAS_PANEL,
    type CanvasActivityItem,
    CanvasActivityStrip,
    type CanvasActivityStripProps,
    CanvasCommandBar,
    type CanvasCommandBarProps,
    CanvasHud,
    type CanvasHudProps,
    type CanvasHudStat,
    CanvasPanel,
} from "./hud";

export {
    BENTO_ORDER,
    bento,
    blueprint,
    buildCanvasVariant,
    CANVAS_VARIANTS,
    type CanvasLayout,
    type CanvasVariant,
    colHeadNode,
    columns,
    constellation,
    type EdgeOverride,
    flavorEdges,
    KANBAN_COLUMNS,
    kanban,
    laneNode,
    mindmap,
    radial,
    SWIMLANE_BANDS,
    swimlanes,
    TIMELINE_STAGES,
    timeline,
    treeDown,
} from "./layouts";

export {
    NodeActionsProvider,
    type NodeActionsProviderProps,
    useNodeActions,
} from "./node-actions";

export {
    CanvasCurrentLine,
    type CanvasCurrentLineProps,
    CanvasEntityCard,
    type CanvasEntityCardProps,
    CanvasHandles,
    CanvasHereBadge,
    CanvasNodeAction,
    CanvasNodeNotice,
    CanvasOpportunityCard,
    type CanvasOpportunityCardProps,
    CanvasRegionLabel,
    type CanvasRegionLabelProps,
    CanvasRibbon,
    type CanvasRibbonProps,
    type CanvasStat,
    HIDDEN_HANDLE,
} from "./nodes";
