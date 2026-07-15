// Whether the agent-console launcher tab shows at the bottom-right. A per-device
// UI preference (like the theme): persisted to localStorage and applied before
// first paint via an inline script in __root (class on <html>), so there's no
// flash. Hiding the tab does NOT disable the console - Ctrl+` still opens it.
export const CONSOLE_TAB_KEY = "cslopslop-console-tab";
const CLASS = "console-tab-off";
const EVENT = "consoletabchange";

export function getConsoleTabHidden(): boolean {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains(CLASS);
}

export function setConsoleTabHidden(hidden: boolean): void {
    document.documentElement.classList.toggle(CLASS, hidden);
    try {
        localStorage.setItem(CONSOLE_TAB_KEY, hidden ? "off" : "on");
    } catch {
        /* storage unavailable - non-fatal */
    }
    window.dispatchEvent(new CustomEvent(EVENT));
}

export function onConsoleTabChange(fn: () => void): () => void {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
}
