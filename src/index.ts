// @paperkit/ui - public surface.
//
// Import styles separately (they are not JS):
//   import "@paperkit/ui/fonts.css";    // self-hosted faces          (recommended)
//   import "@paperkit/ui/styles.css";   // tokens + base + keyframes  (required)
//   import "@paperkit/ui/canvas.css";   // React Flow theming         (canvas only)
//   import "@paperkit/ui/desktop.css";  // native-window affordances  (Tauri only)
//
// The canvas kit is deliberately NOT re-exported here: it lives at "@paperkit/ui/canvas" so
// apps without a board never pull the optional @xyflow/react peer into their bundle.

// ── foundations ───────────────────────────────────────────────────────────────
export { cn } from "./lib/cn";
export { ClientOnly } from "./lib/client-only";
export { createDomClassPref, type DomClassPref } from "./lib/dom-class-pref";
export { consoleTabPref, type PrePaintClassPref, prePaintScript } from "./lib/prepaint";
export { configureStorage, type PrefStorage, prefStorage } from "./lib/storage";
export {
    createTheme,
    DEFAULT_NAMESPACE,
    getTheme,
    getThemePref,
    initTheme,
    onThemeChange,
    setThemePref,
    type Theme,
    theme,
    type ThemeController,
    type ThemePref,
    themeKey,
    toggleTheme,
} from "./lib/theme";

// ── primitives (shadcn, themed with paperkit tokens) ──────────────────────────
export * from "./primitives";

// ── navigation seam ───────────────────────────────────────────────────────────
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

// ── composed presentational kits ──────────────────────────────────────────────
export * from "./brand";
export * from "./chat";
export * from "./console";
export * from "./data-display";
export * from "./nav-ui";
export * from "./shell";
export * from "./status";

// ── standalone components ─────────────────────────────────────────────────────
export { ConfirmDialog } from "./confirm-dialog";
export { Markdown } from "./markdown";
export * from "./provider-logos";
export { ThemeToggle } from "./theme-toggle";
