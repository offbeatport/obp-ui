import type { DoneWhenSpec, Validator } from "./types.js";

// HttpValidator - the v1 Validator: the DISTINCT step that certifies a code action by
// exercising the live URL over real HTTP (never trusting the builder's word). For the
// spine's one archetype ("a visitor can sign up on a live URL") it drives the full
// capability: the form renders, a POST is accepted, and the record actually persisted
// (it shows up on /admin). All-or-nothing green, with a detail naming the first failure.
//
// Playwright is available for richer, JS-driven checks later; plain fetch is enough (and
// deterministic, no browser download) for the header-less form flow this archetype needs.
export class HttpValidator implements Validator {
    async check(spec: DoneWhenSpec): Promise<{ green: boolean; detail: string }> {
        // v1 has a single archetype; unknown kinds fall through to the signup flow.
        return this.httpSignup(spec.url);
    }

    private async httpSignup(base: string): Promise<{ green: boolean; detail: string }> {
        const root = base.replace(/\/$/, "");
        const probe = `probe-${Date.now()}@example.com`;
        try {
            // 1) GET / → 200 with a signup form that POSTs to /signup and takes an email.
            const home = await get(`${root}/`);
            if (home.status !== 200) return red(`GET / returned ${home.status}, want 200`);
            const html = home.body.toLowerCase();
            if (!html.includes("<form")) return red("GET / has no <form>");
            if (!html.includes("/signup")) return red("form does not POST to /signup");
            if (
                !html.includes('name="email"') &&
                !html.includes("name='email'") &&
                !html.includes('type="email"')
            )
                return red("form has no email field");

            // 2) POST /signup accepts the submission (2xx or a redirect).
            const signup = await fetch(`${root}/signup`, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ email: probe }).toString(),
                redirect: "manual",
                signal: AbortSignal.timeout(5000),
            });
            if (signup.status >= 400)
                return red(`POST /signup returned ${signup.status}, want 2xx/3xx`);

            // 3) GET /admin → 200 and the record persisted (proves it wasn't just accepted).
            const admin = await get(`${root}/admin`);
            if (admin.status !== 200) return red(`GET /admin returned ${admin.status}, want 200`);
            if (!admin.body.includes(probe))
                return red("signup did not persist - probe email missing from /admin");

            return { green: true, detail: "signup flow green: form → POST → persisted on /admin" };
        } catch (e) {
            return red(`request error: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
}

function red(detail: string): { green: boolean; detail: string } {
    return { green: false, detail };
}

async function get(url: string): Promise<{ status: number; body: string }> {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, body: await res.text() };
}
