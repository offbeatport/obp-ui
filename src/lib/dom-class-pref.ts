// A boolean preference that lives as a class on <html>: persisted to storage and applied
// before first paint by the pre-paint script, so it never flashes. The class is the source
// of truth at runtime, which is what lets CSS react to it without a re-render.
//
// Generalised from the web app's console-tab preference.

import { prefStorage } from "./storage";

export type DomClassPref = {
    get(): boolean;
    set(on: boolean): void;
    subscribe(fn: () => void): () => void;
};

export function createDomClassPref(opts: {
    /** Storage key, e.g. "cslopslop-console-tab". */
    storageKey: string;
    /** Class toggled on <html>. */
    className: string;
    /** Stored value written when the class is on / off. */
    onValue?: string;
    offValue?: string;
    /** Window event name used to keep multiple toggles in sync. */
    event?: string;
}): DomClassPref {
    const { storageKey, className, onValue = "off", offValue = "on" } = opts;
    const event = opts.event ?? `paperkit:pref:${storageKey}`;

    return {
        get() {
            if (typeof document === "undefined") return false;
            return document.documentElement.classList.contains(className);
        },
        set(on) {
            document.documentElement.classList.toggle(className, on);
            prefStorage().set(storageKey, on ? onValue : offValue);
            window.dispatchEvent(new CustomEvent(event));
        },
        subscribe(fn) {
            window.addEventListener(event, fn);
            return () => window.removeEventListener(event, fn);
        },
    };
}
