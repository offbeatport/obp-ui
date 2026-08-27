// Light/dark theme, toggled by adding `.dark` to <html> (shadcn convention).
// Preference is one of light | dark | system; "system" follows the OS and isn't
// persisted (absence of the key == system). The pre-paint script from ./prepaint
// applies the resolved theme before first paint to avoid a flash. Toggles stay in
// sync via a window event, and OS changes are followed live while in system mode.
//
// Extracted from the web app so the desktop app shares it. Two deliberate changes:
//   - the storage key is a parameter, so two apps on the same origin (or a Tauri
//     webview with a stale store) don't fight over one preference;
//   - the matchMedia listener is no longer a module-scope side effect. Importing a
//     component must not register a global listener; hosts call initTheme() once.

import { prefStorage } from "./storage";

export type Theme = "light" | "dark"; // resolved / applied
export type ThemePref = "light" | "dark" | "system"; // user preference

/**
 * Preference namespace used when a host doesn't pick one.
 *
 * Every app SHOULD pass its own via createTheme({ namespace }) - two apps on the same origin
 * (or a Tauri webview with a stale store) would otherwise fight over one key. This is only the
 * fallback for a host that has not bothered.
 */
export const DEFAULT_NAMESPACE = "obp";

export const themeKey = (ns: string = DEFAULT_NAMESPACE) => `${ns}-theme`;

const EVENT = "obp:themechange";

function systemPrefersDark(): boolean {
    return (
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
    );
}

export type ThemeController = {
    /** The user's preference (light | dark | system). Absence of the stored key == system. */
    getThemePref(): ThemePref;
    /** The theme actually applied to <html> right now. */
    getTheme(): Theme;
    /** Set the preference; "system" clears the stored key so the OS decides. */
    setThemePref(pref: ThemePref): void;
    /** Quick chrome toggle: flip the resolved theme and pin it explicitly (leaves system). */
    toggleTheme(): void;
    onThemeChange(fn: () => void): () => void;
    /**
     * Apply the stored preference and start following the OS while in system mode.
     * Call once at boot. Returns a teardown.
     */
    initTheme(): () => void;
};

export function createTheme(opts: { namespace?: string } = {}): ThemeController {
    const key = themeKey(opts.namespace ?? DEFAULT_NAMESPACE);

    function getThemePref(): ThemePref {
        const v = prefStorage().get(key);
        return v === "light" || v === "dark" ? v : "system";
    }

    function getTheme(): Theme {
        if (typeof document === "undefined") return "light";
        return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }

    function applyResolved(): void {
        if (typeof document === "undefined") return;
        const pref = getThemePref();
        const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
        document.documentElement.classList.toggle("dark", dark);
    }

    function setThemePref(pref: ThemePref): void {
        if (pref === "system") prefStorage().remove(key);
        else prefStorage().set(key, pref);
        applyResolved();
        window.dispatchEvent(new CustomEvent(EVENT));
    }

    function toggleTheme(): void {
        setThemePref(getTheme() === "dark" ? "light" : "dark");
    }

    function onThemeChange(fn: () => void): () => void {
        window.addEventListener(EVENT, fn);
        return () => window.removeEventListener(EVENT, fn);
    }

    function initTheme(): () => void {
        if (typeof window === "undefined" || !window.matchMedia) return () => {};
        applyResolved();
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onSystemChange = () => {
            if (getThemePref() !== "system") return;
            applyResolved();
            window.dispatchEvent(new CustomEvent(EVENT));
        };
        mq.addEventListener("change", onSystemChange);
        return () => mq.removeEventListener("change", onSystemChange);
    }

    return { getThemePref, getTheme, setThemePref, toggleTheme, onThemeChange, initTheme };
}

/**
 * Default controller on the shared `obp` namespace. An app with real users should create its
 * own with createTheme({ namespace }) rather than share this one.
 */
export const theme: ThemeController = createTheme();

export const { getTheme, getThemePref, setThemePref, toggleTheme, onThemeChange, initTheme } =
    theme;
