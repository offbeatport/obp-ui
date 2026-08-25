// The one place the design system touches persistent storage.
//
// Defaults to localStorage, which is what both a browser app and a Tauri webview have.
// A host that wants preferences in a real config file (tauri-plugin-store, an OS
// keychain, a server) calls configureStorage() once at boot and everything in the
// package follows - no component ever reaches for localStorage itself.
//
// Reads must be synchronous: the theme is resolved before first paint.

export type PrefStorage = {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
};

const localStorageAdapter: PrefStorage = {
    get(key) {
        try {
            return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
        } catch {
            return null; // storage disabled (private mode, file:// origin) - non-fatal
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            /* non-fatal */
        }
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            /* non-fatal */
        }
    },
};

let current: PrefStorage = localStorageAdapter;

/** Swap the backing store for every preference the package persists. Call once, at boot. */
export function configureStorage(storage: PrefStorage): void {
    current = storage;
}

export function prefStorage(): PrefStorage {
    return current;
}
