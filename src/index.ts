// @paperkit/ui - public surface.
//
// Import styles separately (they are not JS):
//   import "@paperkit/ui/styles.css";   // tokens + base + keyframes  (required)
//   import "@paperkit/ui/fonts.css";    // self-hosted faces          (recommended)
//   import "@paperkit/ui/canvas.css";   // React Flow theming         (canvas only)
//   import "@paperkit/ui/desktop.css";  // native-window affordances  (Tauri only)
//
// The canvas kit is a separate entry (`@paperkit/ui/canvas`) so apps that don't ship a
// React Flow board never pull @xyflow/react in.

export { cn } from "./lib/cn";
export { ClientOnly } from "./lib/client-only";
export { createDomClassPref, type DomClassPref } from "./lib/dom-class-pref";
export {
    consoleTabPref,
    type PrePaintClassPref,
    prePaintScript,
} from "./lib/prepaint";
export { configureStorage, type PrefStorage } from "./lib/storage";
export {
    createTheme,
    DEFAULT_NAMESPACE,
    getTheme,
    getThemePref,
    initTheme,
    onThemeChange,
    setThemePref,
    theme,
    type Theme,
    type ThemeController,
    type ThemePref,
    themeKey,
    toggleTheme,
} from "./lib/theme";

export * from "./primitives";

export { Link } from "./nav/link";
export { SegmentedTabs, type SegTab } from "./nav/segmented-tabs";
export { TabNav, type TabNavItem } from "./nav/tab-nav";
export {
    type UILinkComponent,
    type UILinkProps,
    type UINav,
    type UIPaths,
    UIProvider,
    useIsActive,
    useNav,
} from "./nav/ui-provider";

export { ConfirmDialog } from "./confirm-dialog";
export { Markdown } from "./markdown";
export * from "./provider-logos";
export { ThemeToggle } from "./theme-toggle";
