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
export {
    DEFAULT_PALETTE_ID,
    makePalette,
    type PaletteSpec,
    THEME_PALETTES,
    type ThemePalette,
    type ThemePaletteColors,
    themePaletteFor,
} from "./lib/palette";
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
    makePreset,
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
export { TONE, TONE_VAR, type Tone, type ToneClasses } from "./lib/tone";
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

export * from "./data-display";

export { ConfirmDialog } from "./confirm-dialog";
export { Markdown } from "./markdown";
export * from "./provider-logos";
export { ThemePicker, type ThemePickerProps } from "./theme-picker";
export { ThemeToggle } from "./theme-toggle";
