// data-display - the surfaces that render a list of things that happened (or a list that is
// empty), plus the avatar that heads a row. Chrome only: every label, colour decision and piece
// of copy is a prop or a slot, so the same components draw the web app's Build log and the
// desktop app's.

export {
    ExpandableRow,
    ExpandableRowList,
    type ExpandableRowListProps,
    type ExpandableRowProps,
} from "./expandable-row";
export { EmptyState, type EmptyStateProps, type EmptyStateVariant } from "./empty-state";
export {
    GradientMark,
    type GradientMarkBranding,
    gradientPairFor,
} from "./gradient-mark";
export { TaskCard, type TaskCardProps, TaskStateChip, type TaskStateChipProps } from "./task-card";
export {
    Timeline,
    TimelineDot,
    type TimelineDotProps,
    TimelineItem,
    type TimelineItemProps,
    type TimelineProps,
} from "./timeline";
