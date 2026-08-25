// status - the small visual atoms that express state.
//
// Colour/tone decisions that carry cslopslop meaning (which tone a company has, which chip a
// slice state gets) stay in the app: these ship the shape, the app supplies the content.

export { ActivityRow, type ActivityRowProps } from "./activity-row";
export { LiveDot, type LiveDotProps, type LiveDotVariant } from "./live-dot";
export { PulsePill, type PulsePillProps } from "./pulse-pill";
export { type Signal, SignalBars, type SignalBarsProps } from "./signal-bars";
export { StatTile, type StatTileProps, type StatTileVariant } from "./stat-tile";
export { StatusDot, type StatusDotProps, type StatusDotSize } from "./status-dot";
export { StatusPill, type StatusPillProps, type StatusPillVariant } from "./status-pill";
export { TONE, TONE_VAR, type Tone, type ToneClasses } from "./tone";
