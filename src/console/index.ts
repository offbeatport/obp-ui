// console - the bottom-docked live agent console and the log surfaces it shares with the
// rest of the app.
//
// Transport-free: <ConsoleDock> takes a `fetchDigest` function and <LogView> takes `lines`,
// so the same UI runs over a TanStack server function, an SSE tail, or a Tauri command.
// What each pane SAYS (avatar, state chip wording and colour) stays in the app.

export {
    ConsoleDock,
    type ConsoleDigest,
    type ConsoleDigestLine,
    type ConsoleDockPane,
    type ConsoleDockProps,
} from "./console-dock";
export { ConsolePane, type ConsolePaneProps, type ConsoleStatusChip } from "./console-pane";
export { ConsoleTabToggle, type ConsoleTabToggleProps } from "./console-tab-toggle";
export {
    LogLine,
    type LogKind,
    type LogLineData,
    type LogLineProps,
    type LogVariant,
    STATUS_VARIANT,
    type StatusVariant,
} from "./log-line";
export { LogView, type LogViewProps } from "./log-view";
export { ago, hms, localeTime } from "./time";
export {
    NEAR_BOTTOM_PX,
    type NearBottomOptions,
    useNearBottomScroll,
} from "./use-near-bottom";
