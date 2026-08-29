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
            return null;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {}
    },
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch {}
    },
};

let current: PrefStorage = localStorageAdapter;

export function configureStorage(storage: PrefStorage): void {
    current = storage;
}

export function prefStorage(): PrefStorage {
    return current;
}
