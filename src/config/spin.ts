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

// One row of the opportunity's competitor analysis: how buyers solve it today, why they pay,
// and the gap we exploit.
export type OppCompetitor = {
    tool: string; // the competing tool / current workaround
    whyPay: string; // why people pay for it today
    gap: string; // the gap / critical weakness we win on
};

// A FULL opportunity spec (a bet) - the market-research pass produces 5 of these. The first
// block is always present (also synthesized by fallbacks + the "skip research" path); the
// second block is the rich detail the AI fills in and the "full spec" modal + the .md file
// render. All rich fields are optional so a deterministic/offline spec stays valid.
export type Candidate = {
    id: string;
    name: string; // the opportunity title / product angle, e.g. "Auto-Nudge"
    icp: string; // ICP buyer - who it's for
    wedge: string; // the winning insight / specific angle it wins on
    pain: string; // the problem, one sentence
    scores: OppScores; // the 8 numeric signals (ranking + the score pips)
    evidence: Evidence[];
    firstSlice: { title: string; doneWhen: string }; // the first buildable, testable slice
    // ---- full spec (optional: absent on deterministic fallbacks / skip-research) ----------
    scoreWhy?: Partial<Record<ScoreKey, string>>; // per-signal justification (why this score)
    description?: string; // the opportunity in 2-3 sentences (what the bet is)
    whyBuy?: string; // why the buyer pays for this
    whyNow?: string; // timing - why this window is open now
    risk?: string; // the key risk / what could kill it
    distribution?: string; // how you reach the buyer (channels)
    mrr?: { low: number; high: number; basis: string }; // expected MRR + how it's estimated
    competitors?: OppCompetitor[]; // the competitor-analysis table
};
// The richer, self-documenting name for the same shape - used where we mean the full spec.
export type OpportunitySpec = Candidate;

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

// Guardrails the agent must respect while scouting + building the company. Chosen in the
// composer: a preset, or "custom" with the fields set inline.
export type Guardrails = {
    preset: string; // lean | fast | boot | custom
    budgetUsd?: number; // monthly budget cap (undefined = unset; 0 = free tools only)
    mode?: "test" | "live"; // start in Stripe test-mode, or charge from day one
    constraints?: string[]; // free-form rules ("target agencies", "no Stripe", "GDPR-safe")
};

// Canonical guardrails per preset. "custom" is a blank slate the founder fills in.
export const GUARDRAIL_PRESETS: Record<string, Guardrails> = {
    lean: {
        preset: "lean",
        budgetUsd: 500,
        mode: "test",
        constraints: ["avoid regulated industries"],
    },
    fast: { preset: "fast", budgetUsd: 2000, mode: "live", constraints: ["ship within a week"] },
    boot: { preset: "boot", budgetUsd: 0, mode: "test", constraints: ["keep running costs at $0"] },
    custom: { preset: "custom" },
};

// Resolve the chosen preset into concrete guardrails; for "custom", merge the founder's overrides.
export function resolveGuardrails(preset: string, custom?: Partial<Guardrails>): Guardrails {
    if (preset === "custom") {
        return {
            preset: "custom",
            budgetUsd: custom?.budgetUsd,
            mode: custom?.mode,
            constraints: (custom?.constraints ?? []).map((c) => c.trim()).filter(Boolean),
        };
    }
    return GUARDRAIL_PRESETS[preset] ?? GUARDRAIL_PRESETS.lean;
}

// A compact one-line summary the AI must honor (fed into the scout + spec prompts).
export function guardrailsText(g: Guardrails | undefined): string {
    if (!g) return "balanced";
    const parts: string[] = [];
    if (g.budgetUsd != null)
        parts.push(
            g.budgetUsd === 0 ? "$0 budget (free tools only)" : `budget ≤ $${g.budgetUsd}/mo`,
        );
    if (g.mode)
        parts.push(g.mode === "test" ? "test-mode (no real charges yet)" : "charge from day one");
    for (const c of g.constraints ?? []) if (c.trim()) parts.push(c.trim());
    return parts.length ? parts.join("; ") : g.preset;
}

// The draft company's incubation payload (stored as company.spin JSON).
export type SpinData = {
    guardrails?: Guardrails; // preset + custom options chosen in the composer
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

// ---- markdown serialization: the .md files persisted in git per pipeline step ---------------
// Client-safe (no fs) so the same renderer drives the UI preview and the engine's file write.

function mdSlug(s: string): string {
    return (
        s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48) || "opportunity"
    );
}
// Escape a value for a single markdown table cell - pipes and newlines would break the row.
function cell(s: string): string {
    const t = (s || "")
        .replace(/\|/g, "\\|")
        .replace(/\s*\n\s*/g, " ")
        .trim();
    return t || "-";
}

// Stable, human filename for an opportunity's .md (e.g. "01-auto-nudge.md").
export function opportunitySpecFilename(c: Candidate, rank: number): string {
    return `${String(rank).padStart(2, "0")}-${mdSlug(c.name)}.md`;
}

// Render a full opportunity spec as a standalone markdown doc (slop/opportunities/NN-slug.md,
// and the "full spec" modal reads the same fields). Empty sections are omitted.
export function opportunitySpecMd(c: Candidate): string {
    const L: string[] = [`# ${c.name}`, ""];
    if (c.wedge) L.push(`**${c.wedge}**`, "");
    L.push(`> Overall score: **${scoreTotal(c.scores).toFixed(1)} / 10**`, "");
    const section = (title: string, body?: string) => {
        if (body?.trim()) L.push(`## ${title}`, "", body.trim(), "");
    };
    section("Opportunity", c.description);
    section("The pain", c.pain);
    section("ICP — who buys", c.icp);
    section("Why they buy", c.whyBuy);
    section("Why now", c.whyNow);
    L.push("## Scores", "", "| Signal | Score | Why |", "| --- | :---: | --- |");
    for (const k of SCORE_DISPLAY_ORDER) {
        L.push(
            `| ${SCORE_META[k].full} | ${c.scores[k] ?? 0}/10 | ${cell(c.scoreWhy?.[k] ?? "")} |`,
        );
    }
    L.push("");
    if (c.competitors?.length) {
        L.push(
            "## Competitor analysis",
            "",
            "| Tool | Why people pay | Gap / critical weakness |",
            "| --- | --- | --- |",
        );
        for (const comp of c.competitors) {
            L.push(`| ${cell(comp.tool)} | ${cell(comp.whyPay)} | ${cell(comp.gap)} |`);
        }
        L.push("");
    }
    section("Distribution", c.distribution);
    if (c.mrr) {
        section(
            "Expected MRR",
            `$${c.mrr.low.toLocaleString()}–$${c.mrr.high.toLocaleString()}/mo — ${c.mrr.basis}`,
        );
    }
    section("Risk", c.risk);
    if (c.firstSlice?.title) {
        section("First slice", `**${c.firstSlice.title}** — done when ${c.firstSlice.doneWhen}`);
    }
    if (c.evidence?.length) {
        L.push("## Evidence", "");
        for (const e of c.evidence) L.push(`- \`${e.kind}\` ${e.text} — _${e.source}_`);
        L.push("");
    }
    return `${L.join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()}\n`;
}

// Render the full COMPANY spec as slop/spec.md (replaces the seed placeholder at 'specing').
export function companySpecMd(
    spec: CompanySpec,
    branding?: Branding,
    guardrails?: Guardrails,
): string {
    const L: string[] = [`# ${spec.product}`, ""];
    if (spec.tagline) L.push(`**${spec.tagline}**`, "");
    L.push(
        `- **Pricing:** $${spec.pricingUsd}/mo${spec.trialDays ? ` · ${spec.trialDays}-day trial` : ""}`,
    );
    L.push(`- **ICP:** ${spec.icp}`);
    if (branding?.domain) L.push(`- **Domain:** ${branding.domain}`);
    if (guardrails) L.push(`- **Guardrails:** ${guardrailsText(guardrails)}`);
    L.push(
        "",
        "## Stack",
        "",
        spec.stack.map((s) => `- ${s}`).join("\n"),
        "",
        "## Roadmap slices",
        "",
    );
    spec.slices.forEach((s, i) => {
        const sub = s.sub ? ` — ${s.sub}` : "";
        const dw = s.doneWhen ? ` _(done when ${s.doneWhen})_` : "";
        L.push(`${i + 1}. **${s.title}**${sub}${dw}`);
    });
    const m = spec.market;
    L.push(
        "",
        "## Market",
        "",
        `- **Persona:** ${m.persona}`,
        `- **Expected MRR:** $${m.mrrLow.toLocaleString()}–$${m.mrrHigh.toLocaleString()}/mo`,
        `- **WTP:** ${m.wtpQuote}`,
        "",
    );
    if (m.competitors.length) {
        L.push("### Competitors", "", "| Tool | Price | Weakness |", "| --- | --- | --- |");
        for (const comp of m.competitors) {
            L.push(`| ${cell(comp.name)} | ${cell(comp.price)} | ${cell(comp.weakness)} |`);
        }
        L.push("");
    }
    if (branding) {
        L.push(
            "## Branding",
            "",
            `- **Mark:** ${branding.mark}`,
            `- **Palette:** ${branding.palette.join(" → ")}`,
        );
        if (branding.style) L.push(`- **Style:** ${branding.style}`);
        L.push("");
    }
    return `${L.join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()}\n`;
}

// Render the initial GTM outline as slop/gtm.md (step 5, seeded at 'specing' from the spec's
// market/pricing). A scaffold the growth work refines post-launch, not a full campaign plan.
export function gtmOutlineMd(spec: CompanySpec, branding?: Branding): string {
    const m = spec.market;
    const site = branding?.domain ?? `${mdSlug(spec.product)}.app`;
    const L: string[] = [
        `# ${spec.product} — Go-to-market`,
        "",
        `**Target buyer:** ${m.persona || spec.icp}`,
        "",
        "## Positioning",
        "",
        spec.tagline || `The fastest way to solve this for ${spec.icp}.`,
        "",
        "## Pricing",
        "",
        `- $${spec.pricingUsd}/mo${spec.trialDays ? ` · ${spec.trialDays}-day free trial` : ""}`,
        `- Willingness-to-pay signal: ${m.wtpQuote}`,
        `- Revenue target: $${m.mrrLow.toLocaleString()}–$${m.mrrHigh.toLocaleString()} MRR`,
        "",
        "## Channels (first moves)",
        "",
        "1. Post the wedge where the buyer already complains (niche subreddits, Slack/Discord, forums).",
        `2. A one-page site with the promise + email capture, live at ${site}.`,
        "3. Direct outreach to 20 ideal buyers for the first conversations.",
        "",
        "## First week",
        "",
        "- [ ] Landing page live and collecting emails",
        "- [ ] 3 posts / 20 outreach messages sent",
        "- [ ] First 5 conversations booked",
        "",
        "_Seeded from the company spec; refine as real signal comes in._",
    ];
    return `${L.join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()}\n`;
}
