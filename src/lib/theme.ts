// Light/dark theme, toggled by adding `.dark` to <html> (shadcn convention).
// Persisted to localStorage; a small inline script in __root applies it before
// first paint to avoid a flash. Multiple toggles stay in sync via a window event.
export type Theme = "light" | "dark";

export const THEME_KEY = "cslopslop-theme";
const EVENT = "themechange";

export function getTheme(): Theme {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch {
        /* storage unavailable - non-fatal */
    }
    window.dispatchEvent(new CustomEvent(EVENT));
}

export function toggleTheme(): void {
    applyTheme(getTheme() === "dark" ? "light" : "dark");
}

export function onThemeChange(fn: () => void): () => void {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
}
