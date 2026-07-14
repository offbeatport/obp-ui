import { createServerFn } from "@tanstack/react-start";

// ============================================================================
// DATA CONTRACT — the read seam between the `engine` lane (fills bodies from the
// DB) and the `ui` lane (renders these shapes). Bodies return MOCK data today so
// UI can build against the real prototype layout; engine swaps them for actual
// DB reads without changing a single type.
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

export type Slice = { n: number; title: string; state: SliceState };

export type CompanySummary = {
    slug: string; // URL key (engine maps from company id/name)
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
// MOCK fixtures (faithful to design/v2-prototypes/08-chat-spine-pro-v7.html).
// Engine lane deletes these and reads the DB instead.
// ---------------------------------------------------------------------------

const COMPANIES: CompanySummary[] = [
    {
        slug: "leadsift",
        name: "LeadSift",
        tone: "green",
        status: "active",
        mrr: 180,
        users: 12,
        shipped: 4,
        needsYou: true,
        slice: { n: 5, title: "Daily email digest of top leads", state: "awaiting_approval" },
    },
    {
        slug: "quietinbox",
        name: "QuietInbox",
        tone: "blue",
        status: "active",
        mrr: 420,
        users: 38,
        shipped: 8,
        slice: { n: 9, title: "Snooze a thread until tomorrow", state: "building" },
    },
    {
        slug: "translatorbill",
        name: "TranslatorBill",
        tone: "violet",
        status: "active",
        mrr: 0,
        users: 0,
        shipped: 4,
        slice: { n: 6, title: "Digest scheduler UI", state: "building" },
    },
    {
        slug: "datadrop",
        name: "DataDrop",
        tone: "slate",
        status: "active",
        mrr: 95,
        users: 6,
        shipped: 5,
        slice: { n: 6, title: "Saved chart views", state: "todo" },
    },
    {
        slug: "redditpainbot",
        name: "RedditPainBot",
        tone: "amber",
        status: "paused",
        mrr: 0,
        users: 0,
        shipped: 1,
        slice: { n: 8, title: "Dedupe near-identical pains", state: "blocked" },
    },
];

const DETAILS: Record<string, CompanyDetail> = {
    leadsift: {
        ...(COMPANIES[0] as CompanySummary),
        thesis: "Freelancers drown in inbound; surface the few leads worth replying to.",
        domain: "leadsift.app",
        liveUrl: "http://localhost:4019",
        messages: [
            {
                id: "m1",
                role: "assistant",
                content: "Slice 5 is live and the doneWhen check passed. Approve to ship?",
                ago: "2m",
            },
        ],
    },
};

const ACTIVITY: ActivityItem[] = [
    {
        id: "a1",
        tone: "blue",
        companySlug: "translatorbill",
        companyName: "TranslatorBill",
        text: "building slice 6 · writing DigestScheduler.tsx",
        ago: "now",
    },
    {
        id: "a2",
        tone: "green",
        companySlug: "quietinbox",
        companyName: "QuietInbox",
        text: "deployed to localhost:4021",
        ago: "12s",
    },
    {
        id: "a3",
        tone: "violet",
        companySlug: "leadsift",
        companyName: "LeadSift",
        text: "slice 5 awaiting approval",
        ago: "2m",
    },
    {
        id: "a4",
        tone: "green",
        companySlug: "leadsift",
        companyName: "LeadSift",
        text: "doneWhen passed",
        ago: "2m",
    },
    {
        id: "a5",
        tone: "slate",
        companySlug: "datadrop",
        companyName: "DataDrop",
        text: "re-prioritized backlog",
        ago: "5m",
    },
    {
        id: "a6",
        tone: "red",
        companySlug: "redditpainbot",
        companyName: "RedditPainBot",
        text: "slice 8 blocked · no progress ×3",
        ago: "18m",
    },
];

const OPPORTUNITIES: OpportunityItem[] = [
    {
        id: "o1",
        title: "PayoutReconciler",
        thesis: "Match Stripe payouts to invoices for agencies.",
        score: 82,
        status: "candidate",
    },
    {
        id: "o2",
        title: "ChurnPing",
        thesis: "Alert when a paying account goes quiet.",
        score: 74,
        status: "candidate",
    },
    {
        id: "o3",
        title: "DeckDiff",
        thesis: "Track what changed between pitch-deck versions.",
        score: 61,
        status: "candidate",
    },
];

const INBOX: InboxItem[] = [
    {
        id: "i1",
        kind: "approval",
        companySlug: "leadsift",
        companyName: "LeadSift",
        tone: "green",
        title: "Approve slice 5 — daily email digest of top leads",
        sub: "Check is green and it's live · approve to ship.",
        sliceN: 5,
        liveUrl: "http://localhost:4019",
    },
    {
        id: "i2",
        kind: "blocked",
        companySlug: "redditpainbot",
        companyName: "RedditPainBot",
        tone: "amber",
        title: "Unblock slice 8, or pause the company",
        sub: "No progress ×3 — needs a decision.",
        sliceN: 8,
    },
];

const CHATS: ChatSummary[] = [
    { slug: "portfolio-health", title: "How is my portfolio doing?", ago: "3d ago" },
    { slug: "solo-saas-ideas", title: "Ideas for a solo-founder SaaS", ago: "yesterday" },
    { slug: "double-down", title: "Which company should I double down on?", ago: "2h ago" },
];

const METRICS: PortfolioMetrics = { mrr: 695, users: 56, active: 5, shipped: 22, needsYou: 1 };

// ---------------------------------------------------------------------------
// Read server-fns (the contract surface). Engine fills bodies from the DB.
// ---------------------------------------------------------------------------

export const listCompanies = createServerFn({ method: "GET" }).handler(
    async (): Promise<CompanySummary[]> => COMPANIES,
);

export const getCompany = createServerFn({ method: "GET" })
    .validator((slug: string) => slug)
    .handler(async ({ data: slug }): Promise<CompanyDetail | null> => DETAILS[slug] ?? null);

export const listActivity = createServerFn({ method: "GET" }).handler(
    async (): Promise<ActivityItem[]> => ACTIVITY,
);

export const listOpportunities = createServerFn({ method: "GET" }).handler(
    async (): Promise<OpportunityItem[]> => OPPORTUNITIES,
);

export const listInbox = createServerFn({ method: "GET" }).handler(
    async (): Promise<InboxItem[]> => INBOX,
);

export const listChats = createServerFn({ method: "GET" }).handler(
    async (): Promise<ChatSummary[]> => CHATS,
);

export const getPortfolioMetrics = createServerFn({ method: "GET" }).handler(
    async (): Promise<PortfolioMetrics> => METRICS,
);
