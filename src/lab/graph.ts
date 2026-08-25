// ============================================================================
// LAB GRAPH - the shared, mock logical model that every canvas variant renders.
// One founder idea → full opportunity spec → full company spec → landing page →
// product → each feature (one square) → each go-to-market channel (reddit, X …).
// Modeled after cofounder.ai's build board. PURE + client-safe (no DB/fs). Every
// canvas variant reads THIS list and only re-positions / re-skins it - so the 10
// versions differ by layout + flavor, never by content.
// ============================================================================

export type LabKind = "idea" | "opportunity" | "company" | "landing" | "product" | "feature" | "channel";

// Semantic column/band a node belongs to - layouts use this to group.
export type LabGroup = "seed" | "core" | "features" | "growth";

export type LabState = "shipped" | "building" | "queued" | "planned";

export type LabNodeData =
    | { kind: "idea"; thesis: string; author: string }
    | {
          kind: "opportunity";
          title: string;
          wedge: string;
          pain: string;
          score: number; // 0–10 overall demand
          signals: { label: string; val: number }[];
          whyNow: string;
          mrrLow: number;
          mrrHigh: number;
      }
    | {
          kind: "company";
          name: string;
          mark: string;
          palette: [string, string];
          domain: string;
          tagline: string;
          stack: string[];
          pricingUsd: number;
          trialDays: number;
          status: string;
      }
    | {
          kind: "landing";
          url: string;
          headline: string;
          sub: string;
          sections: string[];
          cta: string;
      }
    | {
          kind: "product";
          product: string;
          tagline: string;
          icp: string;
          pricingUsd: number;
          trialDays: number;
          stack: string[];
      }
    | {
          kind: "feature";
          n: number;
          title: string;
          sub: string;
          doneWhen: string;
          state: LabState;
      }
    | {
          kind: "channel";
          platform: string;
          handle: string;
          tactic: string;
          cadence: string;
          state: LabState;
          reach: string;
      };

export type LabNode = {
    id: string;
    kind: LabKind;
    group: LabGroup;
    data: LabNodeData;
};

export type LabEdge = { id: string; source: string; target: string };

// ---------------------------------------------------------------------------
// The mock company: "InboxZero for founders" flavoured demo, rich enough that
// every layout has real content to arrange (6 features + 6 GTM channels).
// ---------------------------------------------------------------------------

const PALETTE: [string, string] = ["#c8643c", "#7a5ea8"];

const FEATURES: { title: string; sub: string; doneWhen: string; state: LabState }[] = [
    {
        title: "Magic-link auth",
        sub: "Passwordless sign-in, zero-friction onboarding.",
        doneWhen: "a new user lands in the app from an emailed link",
        state: "shipped",
    },
    {
        title: "Inbox triage engine",
        sub: "Classifies threads into act / defer / archive automatically.",
        doneWhen: "80% of a seeded inbox is auto-sorted correctly",
        state: "shipped",
    },
    {
        title: "Daily digest",
        sub: "One 8am email with the 5 threads that actually need a reply.",
        doneWhen: "a test account receives a correctly-ranked digest",
        state: "building",
    },
    {
        title: "Snooze & nudge",
        sub: "Resurface a thread at the right moment, chase silent replies.",
        doneWhen: "a snoozed thread reappears on schedule",
        state: "queued",
    },
    {
        title: "Team shared views",
        sub: "Route support-shaped mail to a shared, assignable queue.",
        doneWhen: "two seats see the same queue with assignment",
        state: "planned",
    },
    {
        title: "Stripe billing",
        sub: "$19/mo plan, 14-day trial, self-serve upgrade.",
        doneWhen: "a card is charged in test mode end-to-end",
        state: "planned",
    },
];

const CHANNELS: {
    platform: string;
    handle: string;
    tactic: string;
    cadence: string;
    state: LabState;
    reach: string;
}[] = [
    {
        platform: "Reddit",
        handle: "r/Entrepreneur · r/SaaS",
        tactic: "Build-in-public teardowns of messy founder inboxes.",
        cadence: "2× / week",
        state: "building",
        reach: "180k",
    },
    {
        platform: "X / Twitter",
        handle: "@inboxzero",
        tactic: "Before/after inbox screenshots, reply-guy in founder threads.",
        cadence: "daily",
        state: "building",
        reach: "on-demand",
    },
    {
        platform: "Product Hunt",
        handle: "launch day",
        tactic: "Coordinated launch, top-5 goal, lifetime-deal for hunters.",
        cadence: "one-shot",
        state: "queued",
        reach: "40k",
    },
    {
        platform: "SEO",
        handle: "programmatic",
        tactic: '"How to reach inbox zero with <tool>" comparison pages.',
        cadence: "10 pages / wk",
        state: "queued",
        reach: "compounding",
    },
    {
        platform: "Cold email",
        handle: "YC / indie founders",
        tactic: "50/day hand-picked, one-line personalized opener.",
        cadence: "50 / day",
        state: "planned",
        reach: "1.5k/mo",
    },
    {
        platform: "Community",
        handle: "Indie Hackers · Slack",
        tactic: "Answer inbox-overwhelm posts, soft-link the digest.",
        cadence: "3× / week",
        state: "planned",
        reach: "25k",
    },
];

function buildNodes(): LabNode[] {
    const nodes: LabNode[] = [
        {
            id: "idea",
            kind: "idea",
            group: "seed",
            data: {
                kind: "idea",
                author: "You",
                thesis: "Founders drown in email. What if an agent triaged the inbox and only surfaced the 5 threads that actually need a human reply today?",
            },
        },
        {
            id: "opportunity",
            kind: "opportunity",
            group: "seed",
            data: {
                kind: "opportunity",
                title: "Agent-triaged founder inbox",
                wedge: "Wins on trust: read-only triage first, never sends without an OK.",
                pain: "Founders lose ~1.5h/day to inbox and still miss the threads that matter.",
                score: 8.4,
                signals: [
                    { label: "Buyer", val: 9 },
                    { label: "Pain", val: 9 },
                    { label: "WTP", val: 8 },
                    { label: "Timing", val: 9 },
                    { label: "Build", val: 7 },
                    { label: "Distro", val: 8 },
                ],
                whyNow: "LLMs finally classify intent well enough to trust triage; inbox fatigue is at an all-time high.",
                mrrLow: 4000,
                mrrHigh: 18000,
            },
        },
        {
            id: "company",
            kind: "company",
            group: "core",
            data: {
                kind: "company",
                name: "InboxZero",
                mark: "I",
                palette: PALETTE,
                domain: "inboxzero.app",
                tagline: "The inbox that reads itself.",
                stack: ["TanStack Start", "SQLite", "Stripe", "Resend"],
                pricingUsd: 19,
                trialDays: 14,
                status: "active",
            },
        },
        {
            id: "landing",
            kind: "landing",
            group: "core",
            data: {
                kind: "landing",
                url: "inboxzero.app",
                headline: "Reach inbox zero before your coffee's cold.",
                sub: "An agent triages every thread and hands you the 5 that need you.",
                sections: ["Hero + demo", "How it works", "Trust & privacy", "Pricing", "FAQ"],
                cta: "Start free · 14 days",
            },
        },
        {
            id: "product",
            kind: "product",
            group: "core",
            data: {
                kind: "product",
                product: "InboxZero",
                tagline: "Read-only triage that earns the right to act.",
                icp: "Solo founders & small teams living in Gmail",
                pricingUsd: 19,
                trialDays: 14,
                stack: ["TanStack Start", "SQLite", "Stripe", "Resend"],
            },
        },
    ];

    FEATURES.forEach((f, i) => {
        nodes.push({
            id: `feature-${i}`,
            kind: "feature",
            group: "features",
            data: { kind: "feature", n: i + 1, ...f },
        });
    });
    CHANNELS.forEach((c, i) => {
        nodes.push({
            id: `channel-${i}`,
            kind: "channel",
            group: "growth",
            data: { kind: "channel", ...c },
        });
    });
    return nodes;
}

function buildEdges(nodes: LabNode[]): LabEdge[] {
    const edges: LabEdge[] = [
        { id: "e-idea-opp", source: "idea", target: "opportunity" },
        { id: "e-opp-company", source: "opportunity", target: "company" },
        { id: "e-company-landing", source: "company", target: "landing" },
        { id: "e-company-product", source: "company", target: "product" },
    ];
    for (const n of nodes) {
        if (n.kind === "feature") edges.push({ id: `e-prod-${n.id}`, source: "product", target: n.id });
        if (n.kind === "channel") edges.push({ id: `e-co-${n.id}`, source: "company", target: n.id });
    }
    return edges;
}

export const LAB_NODES: LabNode[] = buildNodes();
export const LAB_EDGES: LabEdge[] = buildEdges(LAB_NODES);

export const LAB_GRAPH = { nodes: LAB_NODES, edges: LAB_EDGES };

// Convenience selectors used by several layouts.
export const labBy = (kind: LabKind) => LAB_NODES.filter((n) => n.kind === kind);
export const labFeatures = () => labBy("feature");
export const labChannels = () => labBy("channel");
