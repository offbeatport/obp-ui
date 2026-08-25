// The inline script that resolves persisted <html> classes BEFORE first paint, so the
// app never flashes the wrong theme. It must run synchronously in <head>, before any
// stylesheet-dependent paint - which means it can't be a React effect and can't import
// anything. It is a string.
//
// One source of truth for both hosts:
//   TanStack Start:  head: () => ({ scripts: [{ children: prePaintScript() }] })
//   Tauri / Vite:    inject into index.html (see the README) with the same call
//
// It intentionally duplicates the tiny bit of logic in theme.ts / dom-class-pref.ts.
// The keys are derived from the same namespace, so they cannot drift.

import { DEFAULT_NAMESPACE } from "./theme";

/** Extra "<html> class remembered in storage" preferences to resolve before paint. */
export type PrePaintClassPref = {
    /** Storage key, e.g. "cslopslop-console-tab". */
    key: string;
    /** Class added to <html> when the stored value matches `whenValue`. */
    className: string;
    /** Stored value that means "add the class". */
    whenValue: string;
};

/** The console launcher tab, hidden via a class the console component reads. */
export const consoleTabPref = (ns: string = DEFAULT_NAMESPACE): PrePaintClassPref => ({
    key: `${ns}-console-tab`,
    className: "console-tab-off",
    whenValue: "off",
});

/**
 * Build the pre-paint script. Pass the same namespace you pass to createTheme().
 * `extra` defaults to the console-tab preference; pass [] for an app without a console.
 */
export function prePaintScript(
    ns: string = DEFAULT_NAMESPACE,
    extra: PrePaintClassPref[] = [consoleTabPref(ns)],
): string {
    const extras = extra
        .map(
            (p) =>
                `if(localStorage.getItem(${JSON.stringify(p.key)})===${JSON.stringify(p.whenValue)})d.classList.add(${JSON.stringify(p.className)});`,
        )
        .join("");
    const themeKeyLiteral = JSON.stringify(`${ns}-theme`);
    return `try{var d=document.documentElement;var t=localStorage.getItem(${themeKeyLiteral});if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches))d.classList.add('dark');${extras}}catch(e){}`;
}
