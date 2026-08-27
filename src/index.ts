// obp-ui - public surface.
//
// Import styles separately (they are not JS):
//   import "obp-ui/fonts.css";    // self-hosted faces          (recommended)
//   import "obp-ui/fonts-alt.css";// the faces the non-default theme presets name
//   import "obp-ui/styles.css";   // tokens + base + keyframes  (required)
//   import "obp-ui/canvas.css";   // React Flow theming         (canvas only)
//   import "obp-ui/desktop.css";  // native-window affordances  (Tauri only)
//
// ── what is NOT re-exported here, and why ─────────────────────────────────────
//
// "obp-ui/canvas" is separate for a DEPENDENCY reason: apps without a board must never pull
// the optional @xyflow/react peer into their bundle.
//
// "obp-ui/shell", "obp-ui/console", "obp-ui/chat" and "obp-ui/nav-ui" are separate for an
// IDENTITY reason. They are not generic layout parts - they are one product's archetype: a
// rail-and-canvas frame, a bottom-docked agent console, a co-pilot thread, ten tab looks.
// Import them and your app looks like cslopslop. That is a fine thing to choose, but it is a
// CHOICE, so it has to be visible at the import line instead of arriving by default.
//
// The measurement that forced the split: across the five consuming repos those four layers
// have exactly ONE consumer (cslopslop). Two others (buydiff, webinvoke) carry the whole
// shell/ directory in their forks and mount zero files of it - they hand-rolled page frames
// rather than inherit someone else's identity, and the flat barrel gave them no signal that
// inheriting it was the decision they were making.
//
// What stays below is the anonymous layer - primitives, cn, UIProvider, ThemeToggle,
// EmptyState, StatTile, Timeline - the parts that genuinely cross product boundaries.
// The test for adding something here: would a second product import it WITHOUT also
// adopting the first product's look? If not, it belongs behind its own entry point.

// ── foundations ───────────────────────────────────────────────────────────────
export { cn } from "./lib/cn";
export { ClientOnly } from "./lib/client-only";
export { createDomClassPref, type DomClassPref } from "./lib/dom-class-pref";
export { consoleTabPref, type PrePaintClassPref, prePaintScript } from "./lib/prepaint";
export {
    contrastRatio,
    hexToHsv,
    hexToRgb,
    type Hsv,
    hsvToHex,
    hsvToRgb,
    luminance,
    readableOn,
    type Rgb,
    rgbToHex,
    rgbToHsv,
} from "./lib/color";
// The colour axis on its own - the ten palettes a preset picks from.
export {
    DEFAULT_PALETTE_ID,
    THEME_PALETTES,
    type ThemePalette,
    type ThemePaletteColors,
    themePaletteFor,
} from "./lib/palette";
// The four-axis theme: colour · type · radius · space. "Theme" below still means light/dark -
// that is the MODE, and it is a separate controller (./lib/theme). A PRESET renders in either.
export {
    applyThemePreset,
    createThemePresets,
    CUSTOM_PRESET_ID,
    DEFAULT_PRESET_ID,
    DEFAULT_RADIUS_ID,
    DEFAULT_SPACE_ID,
    getCustomTheme,
    getThemePreset,
    getThemePresetId,
    initThemePreset,
    onThemePresetChange,
    RADIUS_STEPS,
    type RadiusStep,
    radiusStepFor,
    setCustomTheme,
    setThemePresetId,
    SPACE_STEPS,
    type SpaceStep,
    spaceStepFor,
    THEME_PRESETS,
    type ThemePreset,
    type ThemePresetController,
    themePresetFor,
    themePresets,
    themePresetStyle,
    themePresetSwatch,
    TYPE_PAIRINGS,
    type TypePairing,
    typePairingFor,
} from "./lib/theme-preset";
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

// ── primitives (shadcn, themed with obp-ui tokens) ──────────────────────────
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
// chat, console, nav-ui and shell are NOT here on purpose - see the header.
export * from "./data-display";
export * from "./status";

// ── standalone components ─────────────────────────────────────────────────────
export { ConfirmDialog } from "./confirm-dialog";
export { Markdown } from "./markdown";
export * from "./provider-logos";
export { ThemePicker, type ThemePickerProps } from "./theme-picker";
export { ThemeToggle } from "./theme-toggle";
