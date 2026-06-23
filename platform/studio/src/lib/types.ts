export type ScoreCriteria =
  | "buyer_quality"
  | "pain_urgency"
  | "willingness_to_pay"
  | "timing_signal"
  | "build_simplicity"
  | "distribution_ready"
  | "pricing_ceiling"
  | "legal_safety";

export type WtpSignalType =
  | "workaround"           // describing a manual/hacky process they currently do
  | "budget_spend"         // explicit $ they're already spending
  | "job_posting"          // hiring someone to do this manually
  | "already_paying"       // paying for a competitor that doesn't fully solve it
  | "repeated_attempts"    // tried multiple tools/approaches, none work
  | "competitor_complaint"; // upset about competitor pricing or missing feature

export interface WtpSignal {
  source: string;      // "reddit" | "hn" | "g2" | "jobs" | etc.
  type: WtpSignalType;
  excerpt: string;     // verbatim quote, max ~120 chars
  url?: string | null; // link back to the original post/review
}

export const SCORE_CRITERIA: { key: ScoreCriteria; label: string; description: string; weight?: number }[] = [
  {
    key: "buyer_quality",
    label: "Buyer Quality",
    description: "Named professional with real budget authority",
  },
  {
    key: "pain_urgency",
    label: "Pain Urgency",
    description: "Costs real money or hours TODAY, not hypothetically",
  },
  {
    key: "willingness_to_pay",
    label: "Willingness to Pay",
    description: "Direct money evidence: workarounds, job postings, competitor spend",
    weight: 2,
  },
  {
    key: "timing_signal",
    label: "Timing Signal",
    description: "Is this problem growing? New platform, regulation, or trend creating new pain",
  },
  {
    key: "build_simplicity",
    label: "Build Simplicity",
    description: "Solo engineer ships useful V1 in 5 days",
  },
  {
    key: "distribution_ready",
    label: "Distribution Ready",
    description: "One community, one post reaches the exact buyer",
  },
  {
    key: "pricing_ceiling",
    label: "Pricing Ceiling",
    description: "Realistic monthly price: 1-2=$<10, 4-5=$50-200, 7-8=$200-500, 9-10=$500+",
  },
  {
    key: "legal_safety",
    label: "Legal Safety",
    description: "Regulatory and liability exposure - 10 = trivially safe SaaS, 1 = needs a lawyer",
  },
];

export type OpportunityStatus = "new" | "interesting" | "validated" | "building" | "built" | "launched" | "measuring" | "killed" | "parked" | "pass" | "discovered";

export interface ValidationChecklist {
  searched_competition: boolean;
  posted_community: boolean;
  talked_users: boolean;
  confirmed_wtp: boolean;
  built_mvp: boolean;
}

export interface OpportunityResult {
  title: string;
  pain_summary: string;
  community: string;
  community_url: string | null;
  scores: Record<ScoreCriteria, number>;
  brief_md: string;
}

export type FeatureFeasibility = "Proven" | "Plausible" | "Speculative" | "Impossible";

export interface FeatureSpec {
  feature: string;        // 3-5 word name
  problem: string;        // named pain/signal it solves
  example: string;        // concrete instance, ideally input → output
  priority: "Must" | "Should" | "Could";
  effort: "S" | "M" | "L";
  feasibility: FeatureFeasibility;
  mechanism: string;      // one sentence: the real technical approach (empty/hand-wavy = fantasy)
  constraint: string;     // the one thing that sets the ceiling / makes it hard or impossible
  done_when?: string;     // one-line acceptance test (shown on hover / narrow view)
}

export interface OpportunityInsights {
  hidden_need?: string;
  mrr_low?: number;
  mrr_high?: number;
  mrr_avg?: number;
  self_growth?: string;
  v1_features?: string[];
  feature_table?: FeatureSpec[];  // structured, feasibility-checked feature spec
  risks?: string[];
  distribution_primary?: string;
  price_anchor?: string;        // What buyers currently spend or explicit $ signals
  buyer_persona?: string;       // Specific buyer: role, company size, current workaround
  competitors?: string[];       // e.g. ["Fivetran ($500/mo) - no custom transforms"]
  wtp_evidence?: WtpSignal[];
  source_platforms?: string[];  // distinct sources that contributed signals, e.g. ["reddit","hn","g2"]
  niche_signal?: string;        // 1-sentence verdict: how tightly scoped this niche is + why it's better to target it first
  contrarian?: boolean;         // true = looks boring on surface but has strong WTP evidence
  pricing_model?: "outcome-based" | "usage-based" | "per-seat" | "freemium" | "one-time";
  outcome_metric?: string;      // when outcome-based: e.g. "per invoice sent", "per lead generated"
}

export interface OpportunityWithSignals {
  id: number;
  projectId: number | null;
  title: string;
  painSummary: string;
  sector: string;
  community: string;
  communityUrl: string | null;
  scoreTotal: number;
  scoresJson: Record<string, number>;
  briefMd: string;
  description: string | null;
  insightsJson: OpportunityInsights | null;
  status: OpportunityStatus;
  pass: boolean;
  notes: string | null;
  validateJson: ValidationChecklist | null;
  signalCount: number;
  seoRunId: number | null;
  topKeyword: string | null;
  seoVolume: number | null;
  seoCpc: number | null;
  seoKeywordCount: number | null;
  demandScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  signals?: Array<{
    id: number;
    source: string;
    rawText: string;
    url: string;
    category: string;
    toolName: string | null;
    postedAt: Date | null;
    scrapedAt: Date;
  }>;
}
