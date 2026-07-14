// CLIENT-SAFE spin-up model (no sqlite) — the "thought → company" flow: scout scored
// opportunity candidates, pick one, generate its company spec + branding, then commit it to a
// real company. Shapes mirror design/v2-prototypes/08-chat-spine-pro-v7.html (SPIN flow).

export const SPIN_STATUSES = [
    "scouting", // engine is generating opportunity candidates
    "proposals", // candidates ready — pick one
    "specing", // engine is drafting the picked company's spec + branding
    "spec", // spec + branding ready — review & commit
    "committed", // a real company was created from this draft
    "failed",
] as const;
export type SpinStatus = (typeof SPIN_STATUSES)[number];

// 8-dimension opportunity score (0-10 each), from the prototype's segmented-pip brief.
export type ScoreKey =
    | "buyer"
    | "pain"
    | "wtp"
    | "timing"
    | "build"
    | "legal"
    | "distro"
    | "pricing";
export const SCORE_KEYS: ScoreKey[] = [
    "buyer",
    "pain",
    "wtp",
    "timing",
    "build",
    "legal",
    "distro",
    "pricing",
];
export type OppScores = Record<ScoreKey, number>;
export const SCORE_META: Record<ScoreKey, { label: string; hint: string }> = {
    buyer: { label: "Buyer", hint: "a clear, reachable buyer" },
    pain: { label: "Pain", hint: "how acute the problem is" },
    wtp: { label: "Willingness", hint: "willingness to pay" },
    timing: { label: "Timing", hint: "why now" },
    build: { label: "Buildable", hint: "solo-shippable, software-only" },
    legal: { label: "Legal", hint: "regulatory / liability safety" },
    distro: { label: "Distribution", hint: "you can reach the buyer" },
    pricing: { label: "Pricing", hint: "pricing power" },
};

export type EvidenceKind = "demand" | "gap" | "price";
export const EVIDENCE_META: Record<EvidenceKind, { badge: string; label: string }> = {
    demand: { badge: "D", label: "Demand signal" },
    gap: { badge: "G", label: "Market gap" },
    price: { badge: "$", label: "Willingness-to-pay" },
};
export type Evidence = { kind: EvidenceKind; text: string; source: string };

// One scored opportunity candidate (a bet).
export type Candidate = {
    id: string;
    name: string; // short product angle, e.g. "Auto-Nudge"
    icp: string; // who it's for
    wedge: string; // the specific angle / how it wins
    pain: string; // the problem, one sentence
    scores: OppScores;
    evidence: Evidence[];
    firstSlice: { title: string; doneWhen: string }; // the one sanity-check to ship first
};

export type SpecSlice = { title: string; sub: string; doneWhen?: string };
export type Competitor = { name: string; price: string; weakness: string };
export type Market = {
    persona: string;
    mrrLow: number;
    mrrHigh: number;
    wtpQuote: string; // a real-sounding willingness-to-pay quote
    competitors: Competitor[];
};

// The full company spec generated for the picked candidate.
export type CompanySpec = {
    product: string; // the company name, e.g. "NudgePay"
    tagline: string;
    icp: string;
    pricingUsd: number;
    trialDays: number;
    stack: string[];
    slices: SpecSlice[]; // the roadmap; slices[0] carries the buildable doneWhen
    market: Market;
};

export type Branding = {
    mark: string; // single letter for the logo
    palette: [string, string]; // gradient [from, to]
    domain: string; // e.g. "nudgepay.app"
    style: string; // one-line brand style / voice
};

// The whole spin session's payload (stored as draft.data JSON).
export type DraftData = {
    candidates?: Candidate[];
    pickedId?: string;
    spec?: CompanySpec;
    branding?: Branding;
};

// Guardrails chosen inline in the composer (same presets as the run guardrails).
export type SpinGuardrails = { preset: string };

// avg of the 8 scores (0-10) — the ranking signal for a candidate.
export function scoreTotal(s: OppScores): number {
    let sum = 0;
    for (const k of SCORE_KEYS) sum += s[k] ?? 0;
    return sum / SCORE_KEYS.length;
}

// A small deterministic palette set so branding always has sane gradients (AI may override).
export const PALETTES: [string, string][] = [
    ["#e0794c", "#c05a2f"], // terracotta
    ["#4f8a52", "#356b39"], // green
    ["#5b6ee0", "#3a4bc0"], // indigo
    ["#8b5cf6", "#6d3ecc"], // violet
    ["#c08a2e", "#9a6a1e"], // amber
    ["#2f9c9c", "#1f7c7c"], // teal
];
export function paletteFor(seed: string): [string, string] {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return PALETTES[h % PALETTES.length];
}
