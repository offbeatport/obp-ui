import { createServerFn } from "@tanstack/react-start";
import { desc, eq, inArray } from "drizzle-orm";
import {
    type Action,
    type Metrics,
    actions,
    companies,
    db,
    messages,
    opportunities,
    runs,
} from "~/db";

// ============================================================================
// DATA CONTRACT — the read seam the UI renders. Bodies read the real DB and
// flatten rows into display view-models (derived from src/db/schema.ts):
//   company (+ its actions) → CompanySummary / CompanyDetail
//   action(current)         → Slice          run/action → ActivityItem
//   opportunity             → OpportunityItem action(awaiting/blocked) → InboxItem
//
// RULE: don't change a shape without coordinating the lanes — this is the seam.
// ============================================================================

export type Tone = "green" | "blue" | "violet" | "slate" | "amber" | "red";
export type CompanyStatus = "active" | "paused" | "archived";
export type SliceState = "building" | "awaiting_approval" | "blocked" | "todo" | "shipped";

export type Slice = { n: number; title: string; state: SliceState };

export type CompanySummary = {
    slug: string; // URL key (derived from the company name)
    name: string;
    tone: Tone; // avatar tint
    status: CompanyStatus;
    mrr: number;
    users: number;
    shipped: number; // shipped slice count
    slice?: Slice; // current slice
    needsYou?: boolean;
};

export type ChatMessage = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    ago: string;
};

export type CompanyDetail = CompanySummary & {
    thesis: string;
    domain?: string;
    liveUrl?: string;
    messages: ChatMessage[];
};

export type ActivityItem = {
    id: string;
    tone: Tone;
    companySlug?: string;
    companyName?: string;
    text: string; // prose (companyName is embedded for display flexibility)
    ago: string;
};

export type OpportunityItem = {
    id: string;
    title: string;
    thesis: string;
    score: number; // demand 0-100
    status: "candidate" | "promoted" | "killed";
};

export type InboxKind = "approval" | "blocked" | "decision";
export type InboxItem = {
    id: string;
    kind: InboxKind;
    companySlug: string;
    companyName: string;
    tone: Tone;
    title: string;
    sub: string;
    sliceN?: number;
    liveUrl?: string;
};

export type PortfolioMetrics = {
    mrr: number;
    users: number;
    active: number;
    shipped: number;
    needsYou: number;
};

export type ChatSummary = { slug: string; title: string; ago: string };

// ---------------------------------------------------------------------------
// Row → view-model helpers
// ---------------------------------------------------------------------------

export function slugify(s: string): string {
    return (
        s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "company"
    );
}

const TONES: Tone[] = ["green", "blue", "violet", "slate", "amber", "red"];
// Deterministic avatar tint from a stable key (the company id) — no tone column.
function toneFor(key: string): Tone {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return TONES[h % TONES.length];
}

function ago(d: Date | number): string {
    const t = typeof d === "number" ? d : d.getTime();
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 4) return "now";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

function sliceState(status: Action["status"]): SliceState {
    switch (status) {
        case "running":
        case "approved":
            return "building";
        case "awaiting_approval":
            return "awaiting_approval";
        case "blocked":
            return "blocked";
        case "done":
            return "shipped";
        default:
            return "todo"; // queued
    }
}

// The "current" action = the one that most wants attention (needs-you first, then
// running, then queued), highest priority breaking ties.
const STATUS_RANK: Record<string, number> = {
    awaiting_approval: 0,
    blocked: 1,
    running: 2,
    approved: 3,
    queued: 4,
};
function currentAction(list: Action[]): Action | undefined {
    return list
        .filter((a) => a.status !== "done")
        .sort(
            (a, b) =>
                (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
                b.priority - a.priority,
        )[0];
}

// Plain (non-server-fn) builder so getCompany can reuse it without an RPC hop.
function buildSummaries(): CompanySummary[] {
    const comps = db.select().from(companies).orderBy(desc(companies.createdAt)).all();
    const acts = db.select().from(actions).all();
    const byCo = new Map<string, Action[]>();
    for (const a of acts) {
        const arr = byCo.get(a.companyId);
        if (arr) arr.push(a);
        else byCo.set(a.companyId, [a]);
    }
    return comps.map((c): CompanySummary => {
        const list = byCo.get(c.id) ?? [];
        const shipped = list.filter((a) => a.type === "code" && a.status === "done").length;
        const cur = currentAction(list);
        const m = (c.metrics ?? {}) as Metrics;
        return {
            slug: slugify(c.name),
            name: c.name,
            tone: toneFor(c.id),
            status: c.status,
            mrr: m.mrr ?? 0,
            users: m.users ?? 0,
            shipped,
            slice: cur
                ? { n: shipped + 1, title: cur.title, state: sliceState(cur.status) }
                : undefined,
            needsYou:
                list.some((a) => a.status === "awaiting_approval" || a.status === "blocked") ||
                undefined,
        };
    });
}

function activityText(status: (typeof runs.$inferSelect)["status"], title: string): string {
    switch (status) {
        case "running":
            return `building · ${title}`;
        case "awaiting_approval":
            return `awaiting approval · ${title}`;
        case "succeeded":
            return `shipped · ${title}`;
        case "failed":
            return `failed · ${title}`;
        case "cancelled":
            return `cancelled · ${title}`;
        default:
            return `${status} · ${title}`;
    }
}

// ---------------------------------------------------------------------------
// Read server-fns (the contract surface) — all real DB reads.
// ---------------------------------------------------------------------------

export const listCompanies = createServerFn({ method: "GET" }).handler(
    async (): Promise<CompanySummary[]> => buildSummaries(),
);

export const getCompany = createServerFn({ method: "GET" })
    .validator((slug: string) => slug)
    .handler(async ({ data: slug }): Promise<CompanyDetail | null> => {
        const c = db
            .select()
            .from(companies)
            .all()
            .find((x) => slugify(x.name) === slug);
        if (!c) return null;
        const summary = buildSummaries().find((s) => s.slug === slug);
        if (!summary) return null;
        const msgs = db
            .select()
            .from(messages)
            .where(eq(messages.companyId, c.id))
            .orderBy(messages.createdAt)
            .all();
        return {
            ...summary,
            thesis: c.thesis,
            domain: c.domain ?? undefined,
            messages: msgs.map((mm) => ({
                id: mm.id,
                role: mm.role,
                content: mm.content,
                ago: ago(mm.createdAt),
            })),
        };
    });

export const listActivity = createServerFn({ method: "GET" }).handler(
    async (): Promise<ActivityItem[]> => {
        const rows = db
            .select({ run: runs, co: companies, act: actions })
            .from(runs)
            .innerJoin(companies, eq(runs.companyId, companies.id))
            .innerJoin(actions, eq(runs.actionId, actions.id))
            .orderBy(desc(runs.createdAt))
            .limit(24)
            .all();
        return rows.map((r) => ({
            id: r.run.id,
            tone: toneFor(r.co.id),
            companySlug: slugify(r.co.name),
            companyName: r.co.name,
            text: activityText(r.run.status, r.act.title),
            ago: ago(r.run.createdAt),
        }));
    },
);

export const listOpportunities = createServerFn({ method: "GET" }).handler(
    async (): Promise<OpportunityItem[]> => {
        const rows = db.select().from(opportunities).orderBy(desc(opportunities.score)).all();
        return rows.map((o) => ({
            id: o.id,
            title: o.title,
            thesis: o.thesis,
            score: Math.round(o.score ?? 0),
            status: o.status,
        }));
    },
);

export const listInbox = createServerFn({ method: "GET" }).handler(
    async (): Promise<InboxItem[]> => {
        const rows = db
            .select({ act: actions, co: companies })
            .from(actions)
            .innerJoin(companies, eq(actions.companyId, companies.id))
            .where(inArray(actions.status, ["awaiting_approval", "blocked"]))
            .orderBy(desc(actions.priority))
            .all();
        return rows.map((r) => {
            const blocked = r.act.status === "blocked";
            return {
                id: r.act.id,
                kind: blocked ? "blocked" : "approval",
                companySlug: slugify(r.co.name),
                companyName: r.co.name,
                tone: toneFor(r.co.id),
                title: blocked ? `Unblock: ${r.act.title}` : `Approve: ${r.act.title}`,
                sub: blocked ? "Needs a decision." : "Check is green — approve to ship.",
            };
        });
    },
);

// No chat-thread model yet (messages are flat) — return none until one exists.
export const listChats = createServerFn({ method: "GET" }).handler(
    async (): Promise<ChatSummary[]> => [],
);

export const getPortfolioMetrics = createServerFn({ method: "GET" }).handler(
    async (): Promise<PortfolioMetrics> => {
        const s = buildSummaries();
        return {
            mrr: s.reduce((n, c) => n + c.mrr, 0),
            users: s.reduce((n, c) => n + c.users, 0),
            active: s.filter((c) => c.status === "active").length,
            shipped: s.reduce((n, c) => n + c.shipped, 0),
            needsYou: s.filter((c) => c.needsYou).length,
        };
    },
);
