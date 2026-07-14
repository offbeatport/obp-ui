import { createServerFn } from "@tanstack/react-start";
import { desc, eq, isNull, sql } from "drizzle-orm";
import type { Branding, Candidate, CompanySpec, SpinStatus } from "../config/spin.js";
import {
    type Action,
    type Company,
    type Message,
    actions,
    companies,
    db,
    drafts,
    messages,
    opportunities,
    runs,
} from "../db/index.js";

// ============================================================================
// DATA CONTRACT — the read seam between the `engine` lane (fills bodies from the
// DB) and the `ui` lane (renders these shapes). Bodies now read the REAL DB and
// project rows into these view-models; the exported TYPES are frozen — the seam.
//
// RULE: don't change a shape without coordinating both lanes — this is the seam.
// View-models are flattened/enriched for display (derived from src/db/schema.ts):
//   company → CompanySummary/CompanyDetail   action(current) → Slice
//   run/action → ActivityItem                opportunity → OpportunityItem
//   action(awaiting/blocked) → InboxItem
// ============================================================================

export type Tone = "green" | "blue" | "violet" | "slate" | "amber" | "red";
export type CompanyStatus = "active" | "paused" | "archived";
export type SliceState = "building" | "awaiting_approval" | "blocked" | "todo" | "shipped";

export type Slice = { n: number; title: string; state: SliceState; actionId: string };

export type CompanySummary = {
    id: string; // immutable company id — the collision-proof routing key
    slug: string; // human URL key (slugify(name)); may collide, so prefer id for routing
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
    id: string; // the action id (approve/reject target)
    kind: InboxKind;
    companyId: string; // immutable routing key
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

// The whole spin session projected for the chat UI (polled while the engine fills it).
export type DraftView = {
    id: string;
    thought: string;
    status: SpinStatus;
    preset: string;
    candidates: Candidate[];
    pickedId?: string;
    spec?: CompanySpec;
    branding?: Branding;
    companyId?: string; // set once committed → the UI routes to /companies/<id>
    ago: string;
};

// ---------------------------------------------------------------------------
// Projection helpers — pure row → view-model mapping (no DB access).
// ---------------------------------------------------------------------------

const TONES: Tone[] = ["green", "blue", "violet", "slate", "amber", "red"];

// URL key from the company name; getCompany reverses it by re-slugifying candidates.
// Readable + stable for the few companies a local instance has (collisions resolve to
// the first match — acceptable at v1's scale).
export function slugify(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "company"
    );
}

// Stable avatar tint from the company id (deterministic, no stored column).
function toneFor(id: string): Tone {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return TONES[h % TONES.length];
}

function ago(ts: Date | number | null | undefined): string {
    if (ts == null) return "";
    const ms = Date.now() - (ts instanceof Date ? ts.getTime() : ts);
    const s = Math.max(0, Math.floor(ms / 1000));
    if (s < 5) return "now";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}

const byCreated = (a: Action, b: Action) => a.createdAt.getTime() - b.createdAt.getTime();

function previewUrlOf(a: Action): string | undefined {
    return (a.payload as { previewUrl?: string })?.previewUrl;
}

// action.status → the UI's slice lifecycle. approved = shipping imminently (still "building").
export function sliceState(status: Action["status"]): SliceState {
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

// The "current slice" = what's happening now: in-flight first, else blocked, else the next
// queued, else the most recently shipped.
export function pickCurrent(code: Action[]): Action | undefined {
    return (
        code.find(
            (a) =>
                a.status === "running" ||
                a.status === "awaiting_approval" ||
                a.status === "approved",
        ) ??
        code.find((a) => a.status === "blocked") ??
        code.find((a) => a.status === "queued") ??
        [...code].reverse().find((a) => a.status === "done")
    );
}

function toSummary(c: Company, acts: Action[]): CompanySummary {
    const code = acts.filter((a) => a.type === "code").sort(byCreated);
    const current = pickCurrent(code);
    const metrics = c.metrics ?? {};
    const needsYou = acts.some((a) => a.status === "awaiting_approval" || a.status === "blocked");
    return {
        id: c.id,
        slug: slugify(c.name),
        name: c.name,
        tone: toneFor(c.id),
        status: c.status,
        mrr: metrics.mrr ?? 0,
        users: metrics.users ?? 0,
        shipped: code.filter((a) => a.status === "done").length,
        slice: current
            ? {
                  n: code.indexOf(current) + 1,
                  title: current.title,
                  state: sliceState(current.status),
                  actionId: current.id,
              }
            : undefined,
        needsYou: needsYou || undefined,
    };
}

function toChatMessage(m: Message): ChatMessage {
    return { id: m.id, role: m.role, content: m.content, ago: ago(m.createdAt) };
}

const RUN_TONE: Record<string, Tone> = {
    running: "blue",
    succeeded: "green",
    awaiting_approval: "violet",
    failed: "red",
    cancelled: "slate",
    queued: "slate",
};

function runText(status: string, title: string, error: string | null): string {
    switch (status) {
        case "running":
            return `building · ${title}`;
        case "awaiting_approval":
            return `${title} · awaiting approval`;
        case "succeeded":
            return `shipped · ${title}`;
        case "failed":
            return `run failed${error ? ` · ${error}` : ""}`;
        case "cancelled":
            return `run cancelled · ${title}`;
        default:
            return `queued · ${title}`;
    }
}

// 1-based slice number per action (its position among its company's code actions).
function sliceIndex(all: Action[]): Map<string, number> {
    const byCompany = new Map<string, Action[]>();
    for (const a of all) {
        if (a.type !== "code") continue;
        const list = byCompany.get(a.companyId) ?? [];
        list.push(a);
        byCompany.set(a.companyId, list);
    }
    const idx = new Map<string, number>();
    for (const list of byCompany.values()) {
        list.sort(byCreated).forEach((a, i) => idx.set(a.id, i + 1));
    }
    return idx;
}

// ---------------------------------------------------------------------------
// Read server-fns (the contract surface) — real DB reads. An empty DB yields
// empty collections, which the UI renders as its empty states.
// ---------------------------------------------------------------------------

export const listCompanies = createServerFn({ method: "GET" }).handler(
    async (): Promise<CompanySummary[]> => {
        const comps = db.select().from(companies).all();
        const acts = db.select().from(actions).all();
        return comps.map((c) =>
            toSummary(
                c,
                acts.filter((a) => a.companyId === c.id),
            ),
        );
    },
);

export const getCompany = createServerFn({ method: "GET" })
    .validator((slug: string) => slug)
    .handler(async ({ data: slug }): Promise<CompanyDetail | null> => {
        // Resolve by immutable id FIRST (createCompany navigates by id → collision-proof),
        // then fall back to slugify(name) for human/portfolio links.
        const all = db.select().from(companies).all();
        const c = all.find((x) => x.id === slug) ?? all.find((x) => slugify(x.name) === slug);
        if (!c) return null;
        const acts = db.select().from(actions).where(eq(actions.companyId, c.id)).all();
        const msgs = db
            .select()
            .from(messages)
            .where(eq(messages.companyId, c.id))
            .orderBy(messages.createdAt, sql`rowid`)
            .all();
        const liveUrl = acts.slice().sort(byCreated).map(previewUrlOf).filter(Boolean).pop();
        return {
            ...toSummary(c, acts),
            thesis: c.thesis,
            domain: c.domain ?? undefined,
            liveUrl: liveUrl ?? undefined,
            messages: msgs.map(toChatMessage),
        };
    });

export const listActivity = createServerFn({ method: "GET" }).handler(
    async (): Promise<ActivityItem[]> => {
        const rs = db.select().from(runs).orderBy(desc(runs.createdAt)).limit(30).all();
        const actById = new Map(
            db
                .select()
                .from(actions)
                .all()
                .map((a) => [a.id, a]),
        );
        const compById = new Map(
            db
                .select()
                .from(companies)
                .all()
                .map((c) => [c.id, c]),
        );
        return rs.map((r) => {
            const c = compById.get(r.companyId);
            const title = actById.get(r.actionId)?.title ?? "action";
            return {
                id: r.id,
                tone: RUN_TONE[r.status] ?? "slate",
                companySlug: c ? slugify(c.name) : undefined,
                companyName: c?.name,
                text: runText(r.status, title, r.error),
                ago: ago(r.createdAt),
            };
        });
    },
);

export const listOpportunities = createServerFn({ method: "GET" }).handler(
    async (): Promise<OpportunityItem[]> =>
        db
            .select()
            .from(opportunities)
            .orderBy(desc(opportunities.score))
            .all()
            .map((o) => ({
                id: o.id,
                title: o.title,
                thesis: o.thesis,
                score: Math.round(o.score ?? 0),
                status: o.status,
            })),
);

export const listInbox = createServerFn({ method: "GET" }).handler(
    async (): Promise<InboxItem[]> => {
        const all = db.select().from(actions).all();
        const idx = sliceIndex(all);
        const compById = new Map(
            db
                .select()
                .from(companies)
                .all()
                .map((c) => [c.id, c]),
        );
        return all
            .filter((a) => a.status === "awaiting_approval" || a.status === "blocked")
            .map((a) => {
                const c = compById.get(a.companyId);
                const blocked = a.status === "blocked";
                const kind: InboxKind = blocked
                    ? "blocked"
                    : a.type === "code"
                      ? "approval"
                      : "decision";
                return {
                    id: a.id,
                    kind,
                    companyId: a.companyId,
                    companySlug: c ? slugify(c.name) : "",
                    companyName: c?.name ?? "",
                    tone: c ? toneFor(c.id) : "slate",
                    title: blocked
                        ? `Unblock "${a.title}", or pause the company`
                        : a.type === "code"
                          ? `Approve "${a.title}"`
                          : `Authorize "${a.title}"`,
                    sub: blocked
                        ? "No progress — needs a decision."
                        : "Check is green and it's live · approve to ship.",
                    sliceN: idx.get(a.id),
                    liveUrl: previewUrlOf(a),
                };
            });
    },
);

export const listChats = createServerFn({ method: "GET" }).handler(
    async (): Promise<ChatSummary[]> =>
        db
            .select()
            .from(messages)
            .where(isNull(messages.companyId))
            .orderBy(desc(messages.createdAt))
            .all()
            .filter((m) => m.role === "user")
            .map((m) => ({ slug: m.id, title: m.content.slice(0, 80), ago: ago(m.createdAt) })),
);

// One read for the whole spin chat (polled). An empty/missing draft → null → the UI shows
// the composer. All the shape-y bits live in draft.data (JSON), projected 1:1 here.
export const getDraft = createServerFn({ method: "GET" })
    .validator((id: string) => id)
    .handler(async ({ data: id }): Promise<DraftView | null> => {
        const d = db.select().from(drafts).where(eq(drafts.id, id)).get();
        if (!d) return null;
        return {
            id: d.id,
            thought: d.thought,
            status: d.status,
            preset: d.guardrails?.preset ?? "balanced",
            candidates: d.data.candidates ?? [],
            pickedId: d.data.pickedId,
            spec: d.data.spec,
            branding: d.data.branding,
            companyId: d.companyId ?? undefined,
            ago: ago(d.createdAt),
        };
    });

export const getPortfolioMetrics = createServerFn({ method: "GET" }).handler(
    async (): Promise<PortfolioMetrics> => {
        const comps = db.select().from(companies).all();
        const acts = db.select().from(actions).all();
        return {
            mrr: comps.reduce((n, c) => n + (c.metrics?.mrr ?? 0), 0),
            users: comps.reduce((n, c) => n + (c.metrics?.users ?? 0), 0),
            active: comps.filter((c) => c.status === "active").length,
            shipped: acts.filter((a) => a.type === "code" && a.status === "done").length,
            needsYou: acts.filter((a) => a.status === "awaiting_approval" || a.status === "blocked")
                .length,
        };
    },
);
