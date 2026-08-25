// shell - the application frame.
//
// The pieces an app arranges into a window: the two-column AppShell, the collapsible Rail and
// its contents (nav items, section labels, entity rows, an empty state), the account button +
// menu, and the desktop-only titlebar and window controls.
//
// Every one of them is content-free. Nav arrays, company rows, menu entries and copy are
// domain data: they arrive as props. Links are plain `href` strings resolved through the nav
// context, and native window calls arrive through WindowControlsProvider - so nothing in here
// imports a router or a desktop runtime.

export { AppShell, type AppShellProps } from "./app-shell";
export { AccountButton, type AccountButtonProps } from "./account-button";
export { AccountMenu, type AccountMenuItem, type AccountMenuProps } from "./account-menu";
export { EmptyStateCard, type EmptyStateCardProps } from "./empty-state-card";
export { EntityRow, type EntityRowAction, type EntityRowProps } from "./entity-row";
export { type IconComponent, NavItem, type NavItemProps } from "./nav-item";
export { Rail, type RailProps } from "./rail";
export { RailProvider, type RailState, useRail, useRailCollapsed } from "./rail-context";
export { SectionLabel, type SectionLabelProps } from "./section-label";
export { TitleBar, type TitleBarProps } from "./title-bar";
export { WindowControls, type WindowControlsProps } from "./window-controls";
export {
    type WindowControlsApi,
    WindowControlsProvider,
    type WindowPlatform,
    useWindowControls,
} from "./window-controls-context";
