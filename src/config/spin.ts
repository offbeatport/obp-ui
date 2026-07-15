// CLIENT-SAFE spin-up model (no sqlite) - the "thought → company" flow. A company is created
// immediately in status 'draft'; its spin sub-stage (company.spinStatus) walks scouting →
// proposals → specing → spec, then approving graduates it to an 'active' company. Shapes mirror
// design/v2-prototypes/08-chat-spine-pro-v7.html (SPIN flow).

// The draft company's incubation sub-stage (company.spinStatus; null once graduated to active).
export const SPIN_STATUSES = [
    "scouting", // engine is generating opportunity candidates
    "proposals", // candidates ready - pick one
    "specing", // engine is drafting the picked company's spec + branding
    "spec", // spec + branding ready - review & approve to build
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
// One home for the 8 signals: `lab` = the short pip label, `full` = the long name, `hint` = the
// tooltip reason. Both the engine and the UI read this (no separate copy in the components).
export const SCORE_META: Record<ScoreKey, { label: string; full: string; hint: string }> = {
    buyer: { label: "Buyer", full: "Buyer Quality", hint: "a clear, reachable buyer" },
    pain: { label: "Pain", full: "Pain Urgency", hint: "how acute the problem is" },
    wtp: { label: "WTP", full: "Willingness to Pay", hint: "willingness to pay" },
    timing: { label: "Timing", full: "Timing Signal", hint: "why now" },
    build: { label: "Build", full: "Build Simplicity", hint: "solo-shippable, software-only" },
    legal: { label: "Legal", full: "Legal Safety", hint: "regulatory / liability safety" },
    distro: { label: "Reach", full: "Distribution Ready", hint: "you can reach the buyer" },
    pricing: { label: "Ceiling", full: "Pricing Ceiling", hint: "pricing power" },
};
// The order the signals are shown in the breakdown (prototype SR_ORDER: legal last).
export const SCORE_DISPLAY_ORDER: ScoreKey[] = [
    "buyer",
    "pain",
    "wtp",
    "timing",
    "build",
    "distro",
    "pricing",
    "legal",
];

export type EvidenceKind = "demand" | "gap" | "price";
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

// The draft company's incubation payload (stored as company.spin JSON).
export type SpinData = {
    preset?: string; // guardrail preset chosen in the composer
    candidates?: Candidate[];
    pickedId?: string;
    spec?: CompanySpec;
    branding?: Branding;
    // Chat-driven refinement: extra criteria the scout must honor on the next re-scout, and an
    // edit note the spec pass must apply on the next re-draft. Cleared once consumed.
    criteria?: string;
    editNote?: string;
};

// A message in the spin chat (the "start your company" conversation).
export type SpinMessage = { id: string; role: "user" | "assistant"; content: string; ago: string };

// The overall opportunity score (0-10) - the ONE ranking signal, used by both the engine
// (ranking + demand) and the UI (the .ql-sig chip). Weighted: willingness-to-pay counts 2×,
// divisor 9 (the prototype's formula).
export function scoreTotal(s: OppScores): number {
    const t =
        ((s.buyer ?? 0) +
            (s.pain ?? 0) +
            (s.wtp ?? 0) * 2 +
            (s.timing ?? 0) +
            (s.build ?? 0) +
            (s.legal ?? 0) +
            (s.distro ?? 0) +
            (s.pricing ?? 0)) /
        9;
    return Math.round(t * 10) / 10;
}

// Per-signal band (a 0-10 score → green/amber/gray tier). Shared by the UI's .sig chips.
export function sigBand(v: number): "sig-green" | "sig-amber" | "sig-gray" {
    return v >= 8 ? "sig-green" : v >= 5 ? "sig-amber" : "sig-gray";
}
// Overall-score band (the .ql-sig chip: hi/mid/lo at 7.5/6.5).
export function scoreBand(total: number): "hi" | "mid" | "lo" {
    return total >= 7.5 ? "hi" : total >= 6.5 ? "mid" : "lo";
}
// Compact money ("4200" → "4.2k").
export function fmtK(n: number): string {
    return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
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
