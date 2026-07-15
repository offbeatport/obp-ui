import { sqlite } from "../db/index.js";

// Server-only KV over app_config (non-secret) + secret (server-only key store; client sees
// only last4). Values are JSON-encoded. Used by web server fns AND the engine.
const GET = sqlite.prepare("SELECT value FROM app_config WHERE scope = 'global' AND key = ?");
const SET = sqlite.prepare(
    `INSERT INTO app_config (scope, key, value, updated_at) VALUES ('global', ?, ?, ?)
     ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
);
const GET_SECRET = sqlite.prepare(
    "SELECT value, last4 FROM secret WHERE scope = 'global' AND key = ?",
);
const SET_SECRET = sqlite.prepare(
    `INSERT INTO secret (scope, key, value, last4, updated_at) VALUES ('global', ?, ?, ?, ?)
     ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value, last4 = excluded.last4, updated_at = excluded.updated_at`,
);
const DEL_SECRET = sqlite.prepare("DELETE FROM secret WHERE scope = 'global' AND key = ?");

export function getConfig<T = unknown>(key: string): T | undefined {
    const row = GET.get(key) as { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
}

export function setConfig(key: string, value: unknown): void {
    SET.run(key, JSON.stringify(value), Date.now());
}

/** RAW secret value - SERVER ONLY, never return to the client. */
export function getSecret(key: string): string | undefined {
    return (GET_SECRET.get(key) as { value: string } | undefined)?.value;
}

/** Safe-to-display suffix of a stored secret. */
export function secretLast4(key: string): string | undefined {
    return (GET_SECRET.get(key) as { last4: string | null } | undefined)?.last4 ?? undefined;
}

export function setSecret(key: string, value: string): void {
    if (!value) {
        DEL_SECRET.run(key);
        return;
    }
    SET_SECRET.run(key, value, value.slice(-4), Date.now());
}
