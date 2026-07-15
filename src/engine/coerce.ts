// Defensive coercion for LLM output — shared by the thinking passes (scope.ts, spin.ts) so the
// parser + `str` live in one place (no pass importing a util from another pass).

// Strip code fences, take the first balanced {…} (or […] for arrays), JSON.parse or null.
function extract(text: string, open: "{" | "[", close: "}" | "]"): unknown {
    let t = text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
    const i = t.indexOf(open);
    const j = t.lastIndexOf(close);
    if (i >= 0 && j > i) t = t.slice(i, j + 1);
    try {
        return JSON.parse(t);
    } catch {
        return null;
    }
}

export function extractJson(text: string): Record<string, unknown> | null {
    const v = extract(text, "{", "}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function extractJsonArray(text: string): unknown[] {
    const v = extract(text, "[", "]");
    return Array.isArray(v) ? v : [];
}

// A trimmed, length-capped string field, or the fallback if `v` isn't a non-empty string.
export function str(v: unknown, fb: string, max: number): string {
    return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fb;
}
