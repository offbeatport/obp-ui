import { prefStorage } from "./storage";

export type Theme = "light" | "dark";
export type ThemePref = "light" | "dark" | "system";

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
    getThemePref(): ThemePref;
    getTheme(): Theme;
    setThemePref(pref: ThemePref): void;
    toggleTheme(): void;
    onThemeChange(fn: () => void): () => void;
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

export const theme: ThemeController = createTheme();

export const { getTheme, getThemePref, setThemePref, toggleTheme, onThemeChange, initTheme } =
    theme;
