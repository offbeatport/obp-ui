// Light/dark theme, toggled by adding `.dark` to <html> (shadcn convention).
// Preference is one of light | dark | system; "system" follows the OS and isn't
// persisted (absence of the key == system). A small inline script in __root applies
// the resolved theme before first paint to avoid a flash. Toggles stay in sync via
// a window event, and OS changes are followed live while in system mode.
export type Theme = "light" | "dark"; // resolved / applied
export type ThemePref = "light" | "dark" | "system"; // user preference

export const THEME_KEY = "cslopslop-theme";
const EVENT = "themechange";

function systemPrefersDark(): boolean {
    return (
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
    );
}

/** The user's preference (light | dark | system). Absence of the stored key == system. */
export function getThemePref(): ThemePref {
    if (typeof localStorage === "undefined") return "system";
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
}

/** The theme actually applied to <html> right now. */
export function getTheme(): Theme {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyResolved(): void {
    const pref = getThemePref();
    const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
    document.documentElement.classList.toggle("dark", dark);
}

/** Set the preference; "system" clears the stored key so the OS decides. */
export function setThemePref(pref: ThemePref): void {
    try {
        if (pref === "system") localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, pref);
    } catch {
        /* storage unavailable - non-fatal */
    }
    applyResolved();
    window.dispatchEvent(new CustomEvent(EVENT));
}

/** Quick chrome toggle: flip the resolved theme and pin it explicitly (leaves system). */
export function toggleTheme(): void {
    setThemePref(getTheme() === "dark" ? "light" : "dark");
}

export function onThemeChange(fn: () => void): () => void {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
}

// Follow OS changes live while in system mode.
if (typeof window !== "undefined" && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (getThemePref() === "system") {
            applyResolved();
            window.dispatchEvent(new CustomEvent(EVENT));
        }
    });
}
