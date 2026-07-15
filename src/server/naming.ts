import { randomUUID } from "node:crypto";
import { companies, db } from "../db/index.js";
import { slugify } from "../lib/slug.js";

// Company-name uniqueness. Touches the db (so it stays OUT of the client bundle - never re-export
// from data.ts), but no react-start, so both the web server fns and the executor's spin logic can
// share it. The pure slugify lives in lib/slug.ts.

// Make a company name unique across the platform so both the name AND its slug are collision-free
// (routing defaults to the slug). If `base`'s slug is already taken it appends " 2", " 3", …
// `excludeId` lets a company keep/re-check its own name (e.g. a draft graduating in place).
export function uniqueName(base: string, excludeId?: string): string {
    const b = base.trim() || "Company";
    const rows = db.select({ id: companies.id, name: companies.name }).from(companies).all();
    const taken = new Set(rows.filter((r) => r.id !== excludeId).map((r) => slugify(r.name)));
    if (!taken.has(slugify(b))) return b;
    for (let n = 2; n < 1000; n++) {
        const candidate = `${b} ${n}`;
        if (!taken.has(slugify(candidate))) return candidate;
    }
    return `${b} ${randomUUID().slice(0, 8)}`; // unreachable in practice - guaranteed-unique fallback
}
