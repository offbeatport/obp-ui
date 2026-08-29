import { prefStorage } from "./storage";

export type DomClassPref = {
    get(): boolean;
    set(on: boolean): void;
    subscribe(fn: () => void): () => void;
};

export function createDomClassPref(opts: {
    storageKey: string;
    className: string;
    onValue?: string;
    offValue?: string;
    event?: string;
}): DomClassPref {
    const { storageKey, className, onValue = "off", offValue = "on" } = opts;
    const event = opts.event ?? `obp:pref:${storageKey}`;

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
