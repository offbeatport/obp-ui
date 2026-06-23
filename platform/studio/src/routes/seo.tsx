import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Trash2,
} from "lucide-react";
import { Button } from "~/components/ui/Button";
import { Checkbox } from "~/components/ui/Checkbox";
import { createOpportunityFromKeyword } from "~/lib/server-fns";

export const Route = createFileRoute("/seo")({
  component: ProjectSeoPage,
});

// ── Source config ─────────────────────────────────────────────────────────────

const SOURCE_GROUPS = [
  {
    label: "Core Signals",
    desc: "Start here - highest signal-to-cost ratio",
    keys: ["googleAds", "autocomplete"],
  },
  {
    label: "Intent & Gap Analysis",
    desc: "Runs after or alongside core - enriches results",
    keys: ["searchIntent", "competitorKw", "contentAnalysis"],
  },
  {
    label: "Premium Add-ons",
    desc: "Pay-per-use · requires marketplace activation",
    keys: ["clickstream", "serp", "apps", "aiDemand", "reviews"],
  },
] as const;

const SOURCES = [
  {
    key: "googleAds", label: "Volume / CPC", sub: "Google Ads keyword data", cost: "~$0.002/req", costUsd: 0.002, defaultOn: true,
    tooltip: {
      what: "Pulls related keywords with monthly search volume, cost-per-click, and advertiser competition.",
      api: "DataForSEO - Keywords Data (Google Ads) - base plan included",
      endpoint: "POST /v3/keywords_data/google_ads/keywords_for_keywords/live",
      returns: "~100–500 keyword rows: search volume, CPC in $, competition (LOW/MEDIUM/HIGH), and a WTP score we compute.",
      useFor: "Find commercially-valuable niches. High CPC + LOW competition = buyers with budget and no strong incumbent.",
    },
  },
  {
    key: "autocomplete", label: "Question Discovery", sub: "Google Autocomplete (free)", cost: "Free", costUsd: 0, defaultOn: true,
    tooltip: {
      what: "Expands your seed keyword into ~150 autocomplete suggestions Google shows real users.",
      api: "Google Suggest - free, no key needed",
      endpoint: "GET suggestqueries.google.com/complete/search?q=…&client=firefox",
      returns: "Keywords grouped by type: Questions (how to X, why does X), Comparisons (X vs Y), Prepositions (X for, X with), Alphabetical long-tail.",
      useFor: "Discover exact pain phrasing buyers use. Questions = your landing page copy. Comparisons = who you're competing against in buyers' minds.",
    },
  },
  {
    key: "reviews", label: "Review Mining", sub: "Trustpilot negative reviews", cost: "~$0.05", costUsd: 0.05, defaultOn: false,
    tooltip: {
      what: "Finds companies on Trustpilot matching your niche, then fetches their 1–3 star reviews.",
      api: "DataForSEO - Business Data / Trustpilot (marketplace add-on)",
      endpoint: "POST /v3/business_data/trustpilot/search/live → /v3/business_data/trustpilot/reviews/live",
      returns: "Top 3 companies + up to 30 low-rated reviews each: reviewer name, rating, date, full review text.",
      useFor: "Competitor complaints = your feature list and marketing copy. Verbatim frustrations convert better than any made-up copy.",
    },
  },
  {
    key: "clickstream", label: "True Volume", sub: "Real user behavior (Clickstream)", cost: "$0.01/req", costUsd: 0.01, defaultOn: false,
    tooltip: {
      what: "Returns search volume measured from real browser clickstream data - not modeled estimates.",
      api: "DataForSEO - Keywords Data / Clickstream - base plan included",
      endpoint: "POST /v3/keywords_data/clickstream_data/search_volume/live",
      returns: "Actual search volume per keyword + 3-month trend breakdown. Much more accurate than Google Ads estimates.",
      useFor: "Validate that a keyword's reported volume is real. Google Ads often inflates small-niche volumes. Use this before betting on SEO.",
    },
  },
  {
    key: "serp", label: "Organic Rankings", sub: "Google #1–10 results", cost: "$0.002/req", costUsd: 0.002, defaultOn: false,
    tooltip: {
      what: "Fetches the current top 10 organic Google results for your keyword.",
      api: "DataForSEO - SERP / Google Organic - base plan included",
      endpoint: "POST /v3/serp/google/organic/live/regular",
      returns: "Title, URL, meta description, and domain for each of the top 10 organic results.",
      useFor: "Assess incumbent strength. Generic listicles and 5-year-old content = gap you can rank into. Brand-name SaaS = hard to beat.",
    },
  },
  {
    key: "apps", label: "App Store", sub: "Google Play rankings", cost: "$0.0006/res", costUsd: 0.006, defaultOn: false,
    tooltip: {
      what: "Searches Google Play for apps ranking for your keyword.",
      api: "DataForSEO - App Data / Google Play (marketplace add-on)",
      endpoint: "POST /v3/app_data/google/app_searches/live",
      returns: "App name, developer, rating, install count, icon, and absolute rank position.",
      useFor: "Check if the niche has strong mobile apps. Low-rated or sparse results = mobile opportunity. Strong apps = you need a web angle.",
    },
  },
  {
    key: "aiDemand", label: "AI Search Demand", sub: "What people ask ChatGPT / AIO", cost: "$0.01/req", costUsd: 0.01, defaultOn: false,
    tooltip: {
      what: "Measures how often people search for your keyword via AI assistants (ChatGPT, Perplexity, Google AIO).",
      api: "DataForSEO - AI Optimization / AI Keyword Data (marketplace add-on)",
      endpoint: "POST /v3/ai_optimization/ai_keyword_data/live",
      returns: "AI search volume, monthly trend, and whether the keyword appears in AI-generated answer boxes.",
      useFor: "Decide if this niche has shifted to AI-first search. High AI demand = invest in answer-engine optimization, not just classic SEO.",
    },
  },
  {
    key: "searchIntent", label: "Search Intent", sub: "Buyer vs researcher classification", cost: "~$0.05/run", costUsd: 0.05, defaultOn: true,
    tooltip: {
      what: "Classifies every keyword from the Volume/CPC run as Transactional, Commercial, Informational, or Navigational.",
      api: "DataForSEO Labs - base plan included",
      endpoint: "POST /v3/dataforseo_labs/google/search_intent/live",
      returns: "An intent label per keyword. Transactional/Commercial = buyer is ready to spend.",
      useFor: "Filter keyword table to buyer-intent only. Cuts noise by ~60%. The single most useful WTP signal overlay.",
    },
  },
  {
    key: "competitorKw", label: "Competitor Keywords", sub: "What a rival domain ranks for", cost: "$0.01/run", costUsd: 0.01, defaultOn: false,
    tooltip: {
      what: "Enter a competitor domain and get every keyword they rank for, sorted by CPC.",
      api: "DataForSEO Labs - base plan included",
      endpoint: "POST /v3/dataforseo_labs/google/keywords_for_site/live",
      returns: "Up to 100 keywords: search volume, CPC, competition level, keyword difficulty.",
      useFor: "Fastest WTP proof: someone already built and ranked for these = market exists and buyers found them.",
    },
  },
  {
    key: "contentAnalysis", label: "Web Pain Signals", sub: "Forums, blogs, reviews mentioning keyword", cost: "~$0.02/run", costUsd: 0.02, defaultOn: false,
    tooltip: {
      what: "Searches the open web for your keyword in forum posts, blog articles, news, and reviews, then scores sentiment.",
      api: "DataForSEO Content Analysis",
      endpoint: "POST /v3/content_analysis/search/live",
      returns: "Up to 25 web mentions: page type, title, snippet, domain, date, author, sentiment (positive/negative/neutral).",
      useFor: "Find verbatim pain language in the wild. Negative-sentiment forum posts = real frustrations = your copywriting goldmine.",
    },
  },
] as const;

type SourceKey = typeof SOURCES[number]["key"];

const PREMIUM_KEYS: ReadonlySet<SourceKey> = new Set(["clickstream", "serp", "apps", "aiDemand", "reviews"] as SourceKey[]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeoRun {
  id: number;
  seedKeyword: string;
  totalKeywords: number;
  totalCost: number;
  maxVolume: number;
  minCpc: number;
  createdAt: number;
}

interface KeywordRow {
  id: number;
  runId: number;
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: string | null;
  opportunityScore: number;
  isAiPrompt: boolean;
  impressionsPerDay: number | null;
  searchIntent?: string | null;
}

interface ClickstreamKw {
  keyword: string;
  search_volume: number;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }>;
}

interface ReviewItem {
  rating?: number;
  title?: string;
  review_text?: string;
  publication_date?: string;
  author_name?: string;
}

interface ReviewCompany {
  domain: string;
  title: string;
  rating: number;
  reviews_count: number;
  reviews: ReviewItem[];
}

interface AppItem {
  rank_absolute?: number;
  title?: string;
  app_id?: string;
  icon?: string;
  rating?: number;
  reviews_count?: number;
  installs?: string;
  description?: string;
  developer?: string;
  price?: string;
}

interface SerpItem {
  rank_absolute?: number;
  title?: string;
  url?: string;
  description?: string;
  domain?: string;
}

interface AiDemandKw {
  keyword?: string;
  search_volume?: number;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number }>;
}

interface CompetitorKwRow {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  competition_level: string | null;
  keyword_difficulty: number | null;
}

interface ContentMention {
  type: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  date_published: string | null;
  author: string | null;
  sentiment: "positive" | "negative" | "neutral";
  negative_score: number;
}

type AutocompleteGroups = {
  questions: string[];
  comparisons: string[];
  prepositions: string[];
  alphabetical: string[];
  direct: string[];
};

type SortKey = "opportunityScore" | "searchVolume" | "cpc" | "competition" | "wtpScore";
type SortDir = "asc" | "desc";

const COMP_COLORS: Record<string, string> = {
  LOW: "#00ff88",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(score: number): string {
  if (score >= 100_000) return "#00ff88";
  if (score >= 10_000) return "#86efac";
  if (score >= 1_000) return "#fbbf24";
  return "rgba(250,250,250,0.75)";
}

function cpcColor(cpc: number): string {
  if (cpc >= 10) return "#00ff88";
  if (cpc >= 3) return "#86efac";
  if (cpc >= 1) return "#fbbf24";
  return "rgba(250,250,250,0.45)";
}

function nicheSignal(avgCpc: number, avgVol: number): { label: string; color: string; desc: string } {
  if (avgCpc >= 5 && avgVol <= 5000) return { label: "High WTP Niche", color: "#00ff88", desc: "Low volume + high CPC = buyers pay premium, low ad noise" };
  if (avgCpc >= 3 && avgVol <= 20000) return { label: "Emerging Niche", color: "#86efac", desc: "Moderate demand + solid CPC - growing buyer intent" };
  if (avgCpc >= 1 && avgVol <= 50000) return { label: "Validated Market", color: "#fbbf24", desc: "Broad demand, competitive - needs strong differentiation" };
  return { label: "Mass Market / Low WTP", color: "#ef4444", desc: "High volume + low CPC = commodity buyers, hard to price premium" };
}

function trendDelta(monthly: Array<{ search_volume: number }> | undefined): string | null {
  const last3 = (monthly ?? []).slice(-3);
  if (last3.length < 2) return null;
  const delta = ((last3[last3.length - 1].search_volume - last3[0].search_volume) / (last3[0].search_volume || 1)) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`;
}

function wtpScore(kw: KeywordRow): number {
  const compFactor = 1 - (kw.competition ?? 0);
  const aiBonus = kw.isAiPrompt ? 1.5 : 1;
  return kw.cpc * compFactor * aiBonus * Math.log10(Math.max(kw.searchVolume, 1) + 1) * 1000;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProjectSeoPage() {
  const [seedKeyword, setSeedKeyword] = useState("");
  const [maxVolume, setMaxVolume] = useState(5000);
  const [minCpc, setMinCpc] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [lastRunCost, setLastRunCost] = useState<number | null>(null);
  const [lastRunTotal, setLastRunTotal] = useState<number | null>(null);
  const [lastRunRaw, setLastRunRaw] = useState<number | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);

  const [selectedSources, setSelectedSources] = useState<Set<SourceKey>>(
    new Set(SOURCES.filter((s) => s.defaultOn).map((s) => s.key))
  );
  const [loadingSet, setLoadingSet] = useState<Set<SourceKey>>(new Set());
  const isLoading = loadingSet.size > 0;

  const [acGroups, setAcGroups] = useState<AutocompleteGroups | null>(null);
  const [acTotal, setAcTotal] = useState<number | null>(null);
  const [acFilter, setAcFilter] = useState("");
  const [clickstreamData, setClickstreamData] = useState<{ keywords: ClickstreamKw[]; cost: number } | null>(null);
  const [reviewData, setReviewData] = useState<ReviewCompany[] | null>(null);
  const [reviewAddonInactive, setReviewAddonInactive] = useState(false);
  const [appData, setAppData] = useState<AppItem[] | null>(null);
  const [appAddonInactive, setAppAddonInactive] = useState(false);
  const [serpData, setSerpData] = useState<SerpItem[] | null>(null);
  const [aiDemandData, setAiDemandData] = useState<{ keywords: AiDemandKw[]; cost: number } | null>(null);
  const [aiDemandAddonInactive, setAiDemandAddonInactive] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<Partial<Record<SourceKey, string>>>({});

  const [runs, setRuns] = useState<SeoRun[]>([]);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<number | "all">("all");
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const sidebarDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("wtpScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<SourceKey>("googleAds");
  const [filterAiOnly, setFilterAiOnly] = useState(false);
  const [filterBuyerOnly, setFilterBuyerOnly] = useState(false);
  const [volCustomOpen, setVolCustomOpen] = useState(false);
  const [volCustomInput, setVolCustomInput] = useState("");
  const [cpcCustomOpen, setCpcCustomOpen] = useState(false);
  const [cpcCustomInput, setCpcCustomInput] = useState("");
  const [premiumExpanded, setPremiumExpanded] = useState(false);
  const [competitorDomain, setCompetitorDomain] = useState("");
  const [competitorKws, setCompetitorKws] = useState<CompetitorKwRow[] | null>(null);
  const [contentItems, setContentItems] = useState<ContentMention[] | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"discover" | "history">("discover");
  const [creatingOpp, setCreatingOpp] = useState<number | null>(null);
  const navigate = useNavigate();

  async function loadData() {
    try {
      const r = await fetch("/api/seo-runs");
      const data = await r.json() as { runs: SeoRun[]; keywords: KeywordRow[] };
      setRuns(data.runs ?? []);
      setKeywords(data.keywords ?? []);
    } catch { }
  }

  async function deleteRun(runId: number) {
    await fetch("/api/seo-runs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId }),
    });
    if (selectedRunId === runId) {
      setSelectedRunId("all");
      setLastRunTotal(null);
    }
    await loadData();
  }

  useEffect(() => { loadData(); }, []);

  function toggleSource(key: SourceKey) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function markLoading(keys: SourceKey[]) {
    setLoadingSet((prev) => { const s = new Set(prev); keys.forEach((k) => s.add(k)); return s; });
  }
  function markDone(key: SourceKey) {
    setLoadingSet((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function handleSearch(forceRefresh = false) {
    if (!seedKeyword.trim() || isLoading || selectedSources.size === 0) return;
    setError(null);
    setSourceErrors({});
    setIsCached(false);
    setCachedAt(null);
    const kw = seedKeyword.trim();

    const coreSources = [...selectedSources].filter((k) => !PREMIUM_KEYS.has(k));
    markLoading(coreSources);

    const requests: Promise<void>[] = [];

    if (selectedSources.has("googleAds")) {
      requests.push(
        fetch("/api/seo-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw, maxVolume, minCpc, forceRefresh, purpose: "discovery" }),
        })
          .then((r) => r.json() as Promise<{ error?: string; cost?: number; runId?: number; total?: number; rawTotal?: number; cached?: boolean; cachedAt?: number }>)
          .then(async (data) => {
            if (data.error) { setSourceErrors((e) => ({ ...e, googleAds: data.error })); return; }
            setLastRunCost(data.cost ?? 0);
            setLastRunTotal(data.total ?? 0);
            setLastRunRaw(data.rawTotal ?? null);
            if (data.cached) { setIsCached(true); setCachedAt(data.cachedAt ?? null); }
            await loadData();
            if (data.runId) { setSelectedRunId(data.runId); if ((data.total ?? 0) > 0) setActiveTab("googleAds"); }
            if (data.runId && selectedSources.has("searchIntent")) {
              markLoading(["searchIntent"]);
              fetch("/api/seo-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ runId: data.runId }),
              })
                .then((r) => r.json() as Promise<{ classified: number; error?: string }>)
                .then(async (intentData) => {
                  if (intentData.error) { setSourceErrors((e) => ({ ...e, searchIntent: intentData.error })); return; }
                  await loadData();
                })
                .catch((e) => setSourceErrors((err) => ({ ...err, searchIntent: String(e) })))
                .finally(() => markDone("searchIntent"));
            }
          })
          .catch((e) => setSourceErrors((err) => ({ ...err, googleAds: String(e) })))
          .finally(() => markDone("googleAds"))
      );
    }

    if (selectedSources.has("autocomplete")) {
      requests.push(
        fetch("/api/seo-autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ groups: AutocompleteGroups; total: number }>)
          .then((d) => { setAcGroups(d.groups); setAcTotal(d.total); })
          .catch((e) => setSourceErrors((err) => ({ ...err, autocomplete: String(e) })))
          .finally(() => markDone("autocomplete"))
      );
    }

    if (selectedSources.has("competitorKw") && competitorDomain.trim()) {
      markLoading(["competitorKw"]);
      requests.push(
        fetch("/api/seo-keywords-for-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: competitorDomain.trim() }),
        })
          .then((r) => r.json() as Promise<{ keywords: CompetitorKwRow[]; cost: number; error?: string }>)
          .then((d) => { if (d.error) { setSourceErrors((e) => ({ ...e, competitorKw: d.error })); return; } setCompetitorKws(d.keywords); })
          .catch((e) => setSourceErrors((err) => ({ ...err, competitorKw: String(e) })))
          .finally(() => markDone("competitorKw"))
      );
    }

    if (selectedSources.has("contentAnalysis")) {
      requests.push(
        fetch("/api/seo-content-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ items: ContentMention[]; cost: number; error?: string }>)
          .then((d) => { if (d.error) { setSourceErrors((e) => ({ ...e, contentAnalysis: d.error })); return; } setContentItems(d.items); })
          .catch((e) => setSourceErrors((err) => ({ ...err, contentAnalysis: String(e) })))
          .finally(() => markDone("contentAnalysis"))
      );
    }

    await Promise.allSettled(requests);
  }

  async function handlePremium() {
    if (!seedKeyword.trim() || isLoading) return;
    const kw = seedKeyword.trim();
    const premiumSelected = [...selectedSources].filter((k) => PREMIUM_KEYS.has(k));
    if (premiumSelected.length === 0) return;

    setSourceErrors({});
    markLoading(premiumSelected);

    const requests: Promise<void>[] = [];

    if (selectedSources.has("clickstream")) {
      requests.push(
        fetch("/api/seo-clickstream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ keywords: ClickstreamKw[]; cost: number; error?: string }>)
          .then((d) => { if (d.error) { setSourceErrors((e) => ({ ...e, clickstream: d.error })); return; } setClickstreamData(d); })
          .catch((e) => setSourceErrors((err) => ({ ...err, clickstream: String(e) })))
          .finally(() => markDone("clickstream"))
      );
    }

    if (selectedSources.has("reviews")) {
      requests.push(
        fetch("/api/seo-reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ companies: ReviewCompany[]; error?: string }>)
          .then((d) => {
            if (d.error === "addon_inactive") { setReviewAddonInactive(true); return; }
            if (d.error) { setSourceErrors((e) => ({ ...e, reviews: d.error })); return; }
            setReviewAddonInactive(false);
            setReviewData(d.companies);
          })
          .catch((e) => setSourceErrors((err) => ({ ...err, reviews: String(e) })))
          .finally(() => markDone("reviews"))
      );
    }

    if (selectedSources.has("apps")) {
      requests.push(
        fetch("/api/seo-apps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ apps: AppItem[]; cost: number; error?: string }>)
          .then((d) => { if (d.error === "addon_inactive") { setAppAddonInactive(true); return; } if (d.error) { setSourceErrors((e) => ({ ...e, apps: d.error })); return; } setAppAddonInactive(false); setAppData(d.apps); })
          .catch((e) => setSourceErrors((err) => ({ ...err, apps: String(e) })))
          .finally(() => markDone("apps"))
      );
    }

    if (selectedSources.has("serp")) {
      requests.push(
        fetch("/api/seo-serp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ results: SerpItem[]; cost: number; error?: string }>)
          .then((d) => { if (d.error) { setSourceErrors((e) => ({ ...e, serp: d.error })); return; } setSerpData(d.results); })
          .catch((e) => setSourceErrors((err) => ({ ...err, serp: String(e) })))
          .finally(() => markDone("serp"))
      );
    }

    if (selectedSources.has("aiDemand")) {
      requests.push(
        fetch("/api/seo-ai-demand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw }),
        })
          .then((r) => r.json() as Promise<{ keywords: AiDemandKw[]; cost: number; error?: string }>)
          .then((d) => { if (d.error === "addon_inactive") { setAiDemandAddonInactive(true); return; } if (d.error) { setSourceErrors((e) => ({ ...e, aiDemand: d.error })); return; } setAiDemandAddonInactive(false); setAiDemandData(d); })
          .catch((e) => setSourceErrors((err) => ({ ...err, aiDemand: String(e) })))
          .finally(() => markDone("aiDemand"))
      );
    }

    await Promise.allSettled(requests);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const visibleKeywords = useMemo(() => {
    let rows = selectedRunId === "all" ? keywords : keywords.filter((k) => Number(k.runId) === Number(selectedRunId));
    if (filterAiOnly) rows = rows.filter((k) => k.isAiPrompt);
    if (filterBuyerOnly) rows = rows.filter((k) => k.searchIntent === "transactional" || k.searchIntent === "commercial");
    if (searchText) rows = rows.filter((k) => k.keyword.toLowerCase().includes(searchText.toLowerCase()));
    return [...rows].sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      if (sortKey === "wtpScore") return (wtpScore(a) - wtpScore(b)) * mul;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * mul;
    });
  }, [keywords, selectedRunId, filterAiOnly, filterBuyerOnly, searchText, sortKey, sortDir]);

  const totalCostAllRuns = runs.reduce((s, r) => s + r.totalCost, 0);
  const aiPromptCount = visibleKeywords.filter((k) => k.isAiPrompt).length;
  const avgCpc = visibleKeywords.length > 0
    ? visibleKeywords.reduce((s, k) => s + k.cpc, 0) / visibleKeywords.length
    : 0;
  const avgVol = visibleKeywords.length > 0
    ? visibleKeywords.reduce((s, k) => s + k.searchVolume, 0) / visibleKeywords.length
    : 0;
  const highWtpCount = visibleKeywords.filter((k) => k.cpc >= 3 && (k.competitionLevel === "LOW" || k.competitionLevel === "MEDIUM")).length;
  const niche = visibleKeywords.length > 0 ? nicheSignal(avgCpc, avgVol) : null;

  // When Trustpilot add-on is inactive, derive companies from already-fetched SERP data
  const serpDerivedReviews = useMemo<ReviewCompany[] | null>(() => {
    if (!reviewAddonInactive || !serpData) return null;
    const seen = new Set<string>();
    return serpData
      .filter((it) => it.url?.includes("trustpilot.com/review/"))
      .map((it) => {
        const match = it.url?.match(/trustpilot\.com\/review\/([^/?#]+)/);
        const domain = match?.[1] ?? it.domain ?? "";
        const rawTitle = it.title ?? domain;
        const title = rawTitle.split(/\s*\|\s*/)[0].replace(/\s+Reviews?\s*$/, "").trim();
        return { domain, title, rating: 0, reviews_count: 0, reviews: it.description ? [{ review_text: it.description, rating: undefined as unknown as number, title: undefined, publication_date: undefined, author_name: undefined }] : [] };
      })
      .filter(({ domain }) => { if (!domain || seen.has(domain)) return false; seen.add(domain); return true; })
      .slice(0, 5);
  }, [reviewAddonInactive, serpData]);

  const effectiveReviewData = reviewData ?? serpDerivedReviews;

  const reviewPainPhrases = useMemo(() => {
    if (!effectiveReviewData) return [];
    const phrases: string[] = [];
    for (const company of effectiveReviewData) {
      for (const review of company.reviews ?? []) {
        if (!review.review_text) continue;
        const sentences = review.review_text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20 && s.length < 120);
        phrases.push(...sentences.slice(0, 2));
      }
    }
    return phrases.slice(0, 6);
  }, [effectiveReviewData]);

  const visibleTabs = SOURCES.filter(({ key }) => {
    if (key === "searchIntent") return false; // enriches googleAds table, not a separate tab
    // googleAds visible when there are keywords, or a specific run is selected (to show its error/empty state)
    if (key === "googleAds") return keywords.length > 0 || (selectedRunId !== "all");
    if (!selectedSources.has(key)) return false;
    if (loadingSet.has(key) || sourceErrors[key]) return true;
    switch (key) {
      case "autocomplete": return acGroups !== null;
      case "clickstream": return clickstreamData !== null;
      case "reviews": return effectiveReviewData !== null || reviewAddonInactive;
      case "apps": return appData !== null || appAddonInactive;
      case "serp": return serpData !== null;
      case "aiDemand": return aiDemandData !== null || aiDemandAddonInactive;
      case "competitorKw": return competitorKws !== null;
      case "contentAnalysis": return contentItems !== null;
      default: return false;
    }
  });

  const visibleTabKeys = visibleTabs.map((t) => t.key).join(",");

  // If activeTab has no content, switch to the first tab that does (must be in effect, not render body)
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeTab) && visibleTabs.length > 0 && !isLoading) {
      setActiveTab(visibleTabs[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabKeys, isLoading]);

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null;
    return sortDir === "desc"
      ? <ChevronDown size={11} style={{ display: "inline", marginLeft: 3 }} />
      : <ChevronUp size={11} style={{ display: "inline", marginLeft: 3 }} />;
  };

  const TH = ({ label, sortable, k }: { label: string; sortable?: boolean; k?: SortKey }) => (
    <th
      onClick={sortable && k ? () => toggleSort(k) : undefined}
      style={{
        padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: 600,
        letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid var(--border)",
        color: sortable && k && sortKey === k ? "var(--accent)" : "var(--muted)",
        cursor: sortable ? "pointer" : "default", userSelect: "none", whiteSpace: "nowrap",
      }}
    >
      {label}{sortable && k && <SortIcon k={k} />}
    </th>
  );

  const tdS: React.CSSProperties = {
    padding: "9px 12px", borderBottom: "1px solid var(--border)", fontSize: 13, verticalAlign: "middle",
  };

  const InfoTooltip = ({ lines }: { lines: { label: string; text: string }[] }) => {
    const tipText = lines.map(({ label, text }) => `${label}: ${text}`).join("\n");
    return (
      <span
        title={tipText}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 13, height: 13, borderRadius: "50%",
          border: "1px solid rgba(165,182,214,0.25)",
          fontSize: "0.55rem", color: "rgba(165,182,214,0.4)",
          cursor: "default", flexShrink: 0, userSelect: "none",
        }}
      >
        ?
      </span>
    );
  };

  const EmptyState = ({ msg }: { msg: string }) => (
    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{msg}</div>
  );

  const LoadingState = ({ label }: { label: string }) => (
    <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{label}…</div>
  );

  const SourceCheckbox = ({ s, note }: { s: typeof SOURCES[number]; note?: string }) => {
    const active = selectedSources.has(s.key);
    const isPremiumSource = PREMIUM_KEYS.has(s.key);
    const tipText = [
      s.tooltip.what,
      `API: ${s.tooltip.api}`,
      s.tooltip.endpoint,
      `Returns: ${s.tooltip.returns}`,
      `Use for: ${s.tooltip.useFor}`,
    ].join("\n");
    return (
      <div title={tipText}>
        <div
          onClick={() => toggleSource(s.key)}
          className="seo-source-row"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            cursor: "pointer", padding: "4px 6px",
            borderRadius: 5, margin: "0 -6px",
            background: "transparent",
            transition: "background 0.1s",
          }}
        >
          <Checkbox
            checked={active}
            onClick={(e) => { e.stopPropagation(); toggleSource(s.key); }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{
                fontSize: "0.76rem", fontWeight: 600,
                color: active ? "var(--fg)" : "var(--fg-subtle)",
              }}>
                {s.label}
              </span>
              <span style={{
                fontSize: "0.62rem",
                color: s.costUsd === 0 ? "rgba(34,197,94,0.6)" : isPremiumSource ? "rgba(167,139,250,0.65)" : "rgba(165,182,214,0.45)",
                marginLeft: "auto", flexShrink: 0,
              }}>
                {s.cost}
              </span>
            </div>
            {note && (
              <div style={{ fontSize: "0.62rem", color: "rgba(165,182,214,0.4)", fontStyle: "italic" }}>{note}</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{ width: sidebarWidth, flexShrink: 0, position: "relative", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Drag handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            sidebarDragRef.current = { startX: e.clientX, startW: sidebarWidth };
            const onMove = (ev: MouseEvent) => {
              if (!sidebarDragRef.current) return;
              const delta = ev.clientX - sidebarDragRef.current.startX;
              setSidebarWidth(Math.max(200, Math.min(480, sidebarDragRef.current.startW + delta)));
            };
            const onUp = () => {
              sidebarDragRef.current = null;
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          style={{
            position: "absolute", right: -3, top: 0, bottom: 0, width: 6,
            cursor: "col-resize", zIndex: 10,
          }}
        />
        {/* ── Sidebar tab bar ── */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          background: "rgba(100,130,180,0.03)",
          flexShrink: 0,
        }}>
          {(["discover", "history"] as const).map((tab) => {
            const active = sidebarTab === tab;
            const label = tab === "discover" ? "Discover" : `History${runs.length > 0 ? ` (${runs.length})` : ""}`;
            return (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                style={{
                  flex: 1, padding: "10px 8px 9px",
                  background: "none", border: "none",
                  borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  cursor: "pointer", fontFamily: "inherit",
                  fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? "var(--accent)" : "rgba(165,182,214,0.55)",
                  transition: "color 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable tab content ── */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          {/* ── Discover tab ── */}
          {sidebarTab === "discover" && (
            <div style={{ padding: "14px 14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Context banner - not shown on global page */}

              {/* ── Search form card ── */}
              <div style={{
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                overflow: "hidden",
              }}>
                {/* Keyword */}
                <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{
                    fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "rgba(165,182,214,0.4)", marginBottom: 6,
                  }}>
                    Seed keyword
                  </div>
                  <div style={{ position: "relative" }}>
                    <Search size={11} style={{
                      position: "absolute", left: 9, top: "50%",
                      transform: "translateY(-50%)", color: "rgba(165,182,214,0.35)", pointerEvents: "none",
                    }} />
                    <input
                      value={seedKeyword}
                      onChange={(e) => setSeedKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      placeholder="niche / seed keyword…"
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "transparent",
                        border: "none",
                        color: "var(--fg)", padding: "0 8px 0 26px",
                        fontSize: "0.84rem", outline: "none",
                      }}
                    />
                  </div>
                </div>

                {/* Vol / CPC pill selectors */}
                {selectedSources.has("googleAds") && (
                  <div style={{ borderBottom: selectedSources.has("competitorKw") ? "1px solid var(--border)" : undefined }}>
                    {(
                      [
                        {
                          label: "Max Vol",
                          value: maxVolume,
                          setValue: setMaxVolume,
                          defaultVal: 5000,
                          options: [
                            { v: 1000, label: "1k" },
                            { v: 5000, label: "5k" },
                            { v: 10000, label: "10k" },
                            { v: 25000, label: "25k" },
                            { v: 50000, label: "50k" },
                          ],
                          fmt: (v: number) => v >= 1000 ? `${v / 1000}k` : String(v),
                          prefix: "",
                        },
                        {
                          label: "Min CPC",
                          value: minCpc,
                          setValue: setMinCpc,
                          defaultVal: 1.0,
                          options: [
                            { v: 0, label: "$0" },
                            { v: 0.5, label: "$0.5" },
                            { v: 1, label: "$1" },
                            { v: 2, label: "$2" },
                            { v: 5, label: "$5" },
                            { v: 10, label: "$10" },
                          ],
                          fmt: (v: number) => `$${v % 1 === 0 ? v : v.toFixed(1)}`,
                          prefix: "$",
                        },
                      ] as const
                    ).map(({ label, value, setValue, defaultVal, options, fmt }, fi) => {
                      const isExact = options.some((o) => o.v === value);
                      const tooltip = fi === 0 ? [
                        { label: "What it is", text: "Monthly Google search volume for keywords returned. Lower = more niche, higher = more competitive." },
                        { label: "Go smaller when", text: "You want focused buyers who know exactly what they need. 1k–5k is the niche SaaS sweet spot." },
                        { label: "Go bigger when", text: "You want broad market data first, then filter down. 25k+ will show the full demand landscape." },
                      ] : [
                        { label: "What it is", text: "The min cost-per-click advertisers pay in Google Ads. Higher CPC = buyers have budget and intent to spend." },
                        { label: "Go higher when", text: "You only want proof of commercial intent. $2+ filters out informational queries. $5+ = premium buyers." },
                        { label: "Go lower when", text: "You want to explore the full landscape including early-stage demand. $0.5–$1 captures emerging niches." },
                      ];
                      return (
                        <div
                          key={label}
                          style={{
                            padding: "9px 12px",
                            borderBottom: fi === 0 ? "1px solid var(--border)" : undefined,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.4)" }}>
                                {label}
                              </span>
                              <InfoTooltip lines={tooltip} />
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {!isExact && (
                                <span style={{ fontSize: "0.72rem", color: "rgba(165,182,214,0.5)", fontVariantNumeric: "tabular-nums" }}>
                                  {fmt(value)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => (setValue as (v: number) => void)(defaultVal)}
                                title="Reset to default"
                                style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.28)", padding: "0 2px", height: "auto" }}
                              >
                                default
                              </Button>
                            </div>
                          </div>
                          {(() => {
                            const customOpen = fi === 0 ? volCustomOpen : cpcCustomOpen;
                            const setCustomOpen = fi === 0 ? setVolCustomOpen : setCpcCustomOpen;
                            const customInput = fi === 0 ? volCustomInput : cpcCustomInput;
                            const setCustomInput = fi === 0 ? setVolCustomInput : setCpcCustomInput;

                            function commitCustom() {
                              const raw = parseFloat(customInput);
                              if (!isNaN(raw) && raw >= 0) {
                                (setValue as (v: number) => void)(fi === 0 ? Math.round(raw) : raw);
                              }
                              setCustomOpen(false);
                              setCustomInput("");
                            }

                            return (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                {options.map((opt) => {
                                  const active = value === opt.v;
                                  const isDefault = opt.v === defaultVal;
                                  return (
                                    <button
                                      key={opt.v}
                                      onClick={() => { (setValue as (v: number) => void)(opt.v); setCustomOpen(false); }}
                                      style={{
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        border: active
                                          ? "1px solid var(--accent)"
                                          : isDefault
                                            ? "1px solid rgba(96,165,250,0.2)"
                                            : "1px solid var(--border)",
                                        background: active ? "rgba(96,165,250,0.15)" : "transparent",
                                        color: active
                                          ? "var(--accent)"
                                          : isDefault
                                            ? "rgba(165,182,214,0.6)"
                                            : "rgba(165,182,214,0.4)",
                                        fontSize: "0.72rem",
                                        fontWeight: active ? 700 : 500,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        fontVariantNumeric: "tabular-nums",
                                        transition: "all 0.10s",
                                      }}
                                    >
                                      {opt.label}
                                      {isDefault && !active && (
                                        <span style={{ marginLeft: 2, fontSize: "0.50rem", opacity: 0.5 }}>●</span>
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Custom input / button */}
                                {customOpen ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    value={customInput}
                                    onChange={(e) => setCustomInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") commitCustom();
                                      if (e.key === "Escape") { setCustomOpen(false); setCustomInput(""); }
                                    }}
                                    onBlur={commitCustom}
                                    placeholder={fi === 0 ? "e.g. 8000" : "e.g. 3.5"}
                                    style={{
                                      width: 72, padding: "2px 7px",
                                      borderRadius: 4,
                                      border: "1px solid var(--accent)",
                                      background: "rgba(96,165,250,0.08)",
                                      color: "var(--fg)", fontSize: "0.72rem",
                                      outline: "none", fontFamily: "inherit",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  />
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setCustomOpen(true); setCustomInput(""); }}
                                    style={{
                                      border: "1px dashed rgba(165,182,214,0.2)",
                                      color: "rgba(165,182,214,0.3)",
                                      fontSize: "0.68rem",
                                    }}
                                  >
                                    custom
                                  </Button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Competitor domain */}
                {selectedSources.has("competitorKw") && (
                  <div style={{ padding: "8px 12px" }}>
                    <div style={{ fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(165,182,214,0.4)", marginBottom: 4 }}>
                      Competitor domain
                    </div>
                    <input
                      value={competitorDomain}
                      onChange={(e) => setCompetitorDomain(e.target.value)}
                      placeholder="competitor.com"
                      style={{
                        width: "100%", background: "transparent", border: "none",
                        color: "var(--fg)", padding: 0, fontSize: "0.82rem", outline: "none",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* ── Sources panel ── */}
              <div style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
              }}>
                {/* Header with cost */}
                <div style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(100,130,180,0.03)",
                }}>
                  <span style={{
                    fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "rgba(165,182,214,0.5)",
                  }}>
                    Sources
                  </span>
                  {(() => {
                    const coreCost = SOURCES.filter((s) => selectedSources.has(s.key) && !PREMIUM_KEYS.has(s.key)).reduce((sum, s) => sum + s.costUsd, 0);
                    const premiumCost = SOURCES.filter((s) => selectedSources.has(s.key) && PREMIUM_KEYS.has(s.key)).reduce((sum, s) => sum + s.costUsd, 0);
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.66rem" }}>
                        <span style={{ color: coreCost === 0 ? "rgba(34,197,94,0.7)" : "rgba(250,250,250,0.4)", fontVariantNumeric: "tabular-nums" }}>
                          {coreCost === 0 ? "free" : `~$${coreCost.toFixed(3)}`}
                        </span>
                        {premiumCost > 0 && (
                          <span style={{ color: "rgba(167,139,250,0.6)", fontVariantNumeric: "tabular-nums" }}>
                            + <span style={{ color: "rgba(167,139,250,0.85)" }}>⚡${premiumCost.toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Groups */}
                {SOURCE_GROUPS.map((group, gi) => {
                  const isPremium = group.label === "Premium Add-ons";
                  const isCollapsed = isPremium && !premiumExpanded;
                  const groupSources = SOURCES.filter((s) => (group.keys as readonly string[]).includes(s.key));
                  return (
                    <div key={group.label} style={{ borderBottom: gi < SOURCE_GROUPS.length - 1 ? "1px solid var(--border)" : undefined }}>
                      <div
                        style={{
                          padding: "6px 12px 4px",
                          display: "flex", alignItems: "center", gap: 6,
                          cursor: isPremium ? "pointer" : "default",
                        }}
                        onClick={isPremium ? () => setPremiumExpanded((v) => !v) : undefined}
                      >
                        <span style={{
                          fontSize: "0.56rem", fontWeight: 700, letterSpacing: "0.10em",
                          textTransform: "uppercase",
                          color: isPremium ? "rgba(167,139,250,0.5)" : "rgba(165,182,214,0.38)",
                        }}>
                          {group.label}
                        </span>
                        <span style={{ flex: 1 }} />
                        {isPremium && (
                          <span style={{ fontSize: "0.58rem", color: "rgba(165,182,214,0.3)" }}>
                            {premiumExpanded ? "▲" : "▼"}
                          </span>
                        )}
                      </div>
                      {!isCollapsed && (
                        <div style={{ padding: "2px 12px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
                          {groupSources.map((s) => (
                            <SourceCheckbox key={s.key} s={s} note={s.key === "searchIntent" ? "enriches keywords table" : undefined} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Run buttons */}
              {(() => {
                const premiumSelected = [...selectedSources].filter((k) => PREMIUM_KEYS.has(k));
                const coreRunnable = [...selectedSources].some((k) => !PREMIUM_KEYS.has(k));
                const hasCoreResults = keywords.length > 0 || runs.length > 0;
                const premiumLoading = premiumSelected.some((k) => loadingSet.has(k));
                const coreLoading = isLoading && !premiumLoading;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {/* Core run button */}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSearch()}
                      disabled={isLoading || !seedKeyword.trim() || !coreRunnable}
                      style={{ width: "100%", justifyContent: "center", gap: 6, padding: "9px", fontSize: 12 }}
                    >
                      {coreLoading
                        ? `${loadingSet.size} source${loadingSet.size !== 1 ? "s" : ""} running…`
                        : <><Search size={11} /> Run Search</>}
                    </Button>

                    {/* Premium run button - only after core results exist */}
                    {premiumSelected.length > 0 && hasCoreResults && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePremium}
                        disabled={isLoading || !seedKeyword.trim()}
                        style={{
                          width: "100%", justifyContent: "center", gap: 6,
                          padding: "8px", fontSize: 11,
                          borderColor: "rgba(167,139,250,0.35)",
                          color: premiumLoading ? "rgba(167,139,250,0.6)" : "rgba(167,139,250,0.85)",
                        }}
                      >
                        {premiumLoading
                          ? `${premiumSelected.filter(k => loadingSet.has(k)).length} premium running…`
                          : <>⚡ Run Premium ({premiumSelected.length})</>}
                      </Button>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          {/* ── History tab ── */}
          {sidebarTab === "history" && (
            <div style={{ padding: "12px 0" }}>
              {runs.length === 0 ? (
                <div style={{
                  padding: "48px 20px", textAlign: "center",
                  color: "rgba(165,182,214,0.35)", fontSize: "0.80rem",
                  fontStyle: "italic",
                }}>
                  No runs yet
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {/* All runs option */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRunId("all")}
                    style={{
                      background: selectedRunId === "all" ? "rgba(96,165,250,0.07)" : "transparent",
                      borderLeft: `2px solid ${selectedRunId === "all" ? "var(--accent)" : "transparent"}`,
                      borderRadius: 0,
                      justifyContent: "flex-start",
                      width: "100%",
                      padding: "9px 14px",
                      fontSize: "0.78rem",
                      color: selectedRunId === "all" ? "var(--accent)" : "rgba(165,182,214,0.5)",
                      fontWeight: selectedRunId === "all" ? 600 : 400,
                    }}
                  >
                    All runs
                  </Button>

                  <div style={{ height: 1, background: "var(--border)", margin: "0 14px 4px" }} />

                  {runs.map((run) => {
                    const isSelected = selectedRunId === run.id;
                    const d = new Date(run.createdAt);
                    const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                    return (
                      <div
                        key={run.id}
                        className="seo-run-item group"
                        style={{ position: "relative" }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRunId(run.id);
                            setActiveTab("googleAds");
                            setSeedKeyword(run.seedKeyword);
                            setMaxVolume(run.maxVolume);
                            setMinCpc(run.minCpc);
                            setFilterAiOnly(false); setFilterBuyerOnly(false); setSearchText("");
                            setAcGroups(null); setAcTotal(null);
                            setClickstreamData(null); setReviewData(null); setReviewAddonInactive(false);
                            setAppData(null); setAppAddonInactive(false);
                            setSerpData(null); setAiDemandData(null); setAiDemandAddonInactive(false);
                            setCompetitorKws(null); setContentItems(null);
                            setSourceErrors({});
                            setLastRunTotal(run.totalKeywords);
                            setLastRunRaw(run.totalKeywords === 0 ? 0 : null);
                            setIsCached(false); setCachedAt(null);
                            setLastRunCost(run.totalCost > 0 ? run.totalCost : null);
                          }}
                          className="seo-run-btn"
                          style={{
                            width: "100%",
                            background: isSelected ? "rgba(96,165,250,0.07)" : "transparent",
                            border: "none",
                            borderLeft: `2px solid ${isSelected ? "var(--accent)" : "transparent"}`,
                            cursor: "pointer", padding: "10px 14px",
                            paddingRight: 14,
                            textAlign: "left", fontFamily: "inherit",
                            display: "flex", flexDirection: "column", gap: 4,
                            transition: "background 0.1s, padding-right 0.1s",
                          }}
                        >
                          <span style={{
                            fontSize: "0.84rem", fontWeight: 600, lineHeight: 1.2,
                            color: isSelected ? "var(--accent)" : "var(--fg)",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            display: "block",
                          }}>
                            {run.seedKeyword}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{
                              fontSize: "0.68rem", fontVariantNumeric: "tabular-nums", fontWeight: 600,
                              color: run.totalKeywords > 0 ? "rgba(96,165,250,0.7)" : "rgba(165,182,214,0.3)",
                            }}>
                              {run.totalKeywords > 0 ? `${run.totalKeywords} kw` : "no data"}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "rgba(165,182,214,0.3)" }}>
                              vol≤{run.maxVolume}
                            </span>
                            <span style={{ fontSize: "0.68rem", color: "rgba(165,182,214,0.3)" }}>
                              cpc≥${run.minCpc}
                            </span>
                            <span style={{ marginLeft: "auto", fontSize: "0.68rem", color: "rgba(165,182,214,0.3)" }}>
                              {dateStr}
                            </span>
                          </div>
                        </button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); deleteRun(run.id); }}
                          title="Delete run"
                          className="seo-run-delete"
                          style={{
                            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                            padding: "4px 5px", height: "auto",
                          }}
                        >
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>{/* end scrollable tab content */}
      </div>{/* end left sidebar */}

      {/* ── MAIN AREA ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "14px 20px" }}>

          {/* Errors */}
          {error && (
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 13, marginBottom: 14 }}>{error}</div>
          )}
          {Object.entries(sourceErrors).map(([src, msg]) => msg && (
            <div key={src} style={{ padding: "10px 14px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: 13, marginBottom: 8 }}>
              <strong>{SOURCES.find((s) => s.key === src)?.label ?? src}:</strong> {msg}
            </div>
          ))}

          {/* Search Intent loading indicator */}
          {loadingSet.has("searchIntent") && (
            <div style={{ padding: "10px 14px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.12)", color: "rgba(0,255,136,0.7)", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ animation: "none" }}>●</span> Classifying buyer intent for {keywords.filter(k => k.runId === selectedRunId || selectedRunId === "all").length} keywords…
            </div>
          )}

          {/* Cached banner */}
          {isCached && cachedAt !== null && (
            <div style={{ padding: "10px 14px", background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.18)", color: "rgba(0,255,136,0.85)", fontSize: 13, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>Cached result from {new Date(cachedAt).toLocaleString()} - no API credits used.</span>
              <Button variant="outline" size="sm" onClick={() => handleSearch(true)} disabled={isLoading}
                style={{ border: "1px solid rgba(0,255,136,0.4)", color: "rgba(0,255,136,0.85)", fontSize: 12 }}>
                Re-fetch
              </Button>
            </div>
          )}

          {/* Filter warning */}
          {!isLoading && lastRunTotal === 0 && lastRunRaw !== null && (
            <div style={{ padding: "12px 16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24", fontSize: 13, marginBottom: 14, lineHeight: 1.6 }}>
              {lastRunRaw === 0
                ? <><strong>No keyword data found.</strong> Google Ads has no advertiser data for this phrase - try a broader seed (e.g. "substack pricing" → "newsletter pricing") or check Question Discovery for organic phrasing.</>
                : <><strong>0 keywords matched filters</strong> - DataForSEO returned {lastRunRaw} results but all were filtered out by vol ≤ {maxVolume} and CPC ≥ ${minCpc.toFixed(2)}. Try raising Max Vol or lowering Min CPC.</>
              }
            </div>
          )}

          {/* ── Stats strip ── */}
          {keywords.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 14, border: "1px solid var(--border)", background: "var(--subtle)", flexWrap: "wrap" }}>
              {[
                { label: "runs", value: String(runs.length) },
                { label: "keywords", value: String(visibleKeywords.length) },
                { label: "avg cpc", value: `$${avgCpc.toFixed(2)}`, color: cpcColor(avgCpc) },
                { label: "high wtp", value: String(highWtpCount), color: highWtpCount > 0 ? "var(--accent)" : undefined },
                { label: "ai prompts", value: String(aiPromptCount) },
                ...(lastRunCost !== null ? [{ label: "last cost", value: `$${lastRunCost.toFixed(4)}` }] : []),
              ].map((s, i) => (
                <div key={i} style={{ padding: "8px 16px", borderRight: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: (s as { color?: string }).color ?? "var(--fg)", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
                </div>
              ))}
              {niche && (
                <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 7, marginLeft: "auto" }}>
                  <CheckCircle size={11} style={{ color: niche.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: niche.color }}>{niche.label}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>- {niche.desc}</span>
                </div>
              )}
            </div>
          )}

          {/* Pain phrases - only when review data present, collapsible */}
          {reviewPainPhrases.length > 0 && (
            <div style={{ marginBottom: 14, padding: "10px 14px", border: "1px solid rgba(239,68,68,0.15)", background: "rgba(239,68,68,0.02)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, paddingTop: 1 }}>
                <AlertTriangle size={11} style={{ color: "#ef4444" }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#ef4444" }}>Pain</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                {reviewPainPhrases.map((phrase, i) => (
                  <span key={i} style={{ fontSize: 11, color: "rgba(250,250,250,0.55)", lineHeight: 1.5 }}>"{phrase}"</span>
                ))}
              </div>
            </div>
          )}

          {/* Tab bar */}
          {visibleTabs.length > 0 && (
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 14, overflowX: "auto" }}>
              {visibleTabs.map(({ key, label }) => {
                const loading = loadingSet.has(key);
                const hasErr = !!sourceErrors[key];
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: "8px 16px", gap: 5,
                      borderBottom: `2px solid ${activeTab === key ? "var(--accent)" : "transparent"}`,
                      borderRadius: 0,
                      color: hasErr ? "#fca5a5" : activeTab === key ? "var(--fg)" : "rgba(250,250,250,0.45)",
                      fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", height: "auto", flexShrink: 0,
                    }}
                  >
                    {label}
                    {loading && <span style={{ fontSize: 9, opacity: 0.5 }}>●</span>}
                    {hasErr && <span style={{ fontSize: 11, color: "#ef4444" }}>✕</span>}
                  </Button>
                );
              })}
            </div>
          )}

          {/* ── Volume / CPC tab ── */}
          {activeTab === "googleAds" && (
            <>
              {loadingSet.has("googleAds") && <LoadingState label="Fetching Google Ads keyword data" />}
              {!loadingSet.has("googleAds") && (
                <>
                  {keywords.length > 0 && (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                      <input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Filter keywords…"
                        style={{ background: "var(--subtle)", border: "1px solid var(--border)", color: "var(--fg)", padding: "6px 10px", fontSize: 12, outline: "none", width: 180 }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                        <Checkbox checked={filterAiOnly} onChange={() => setFilterAiOnly((v) => !v)} />
                        AI prompts only
                      </label>
                      {keywords.some((k) => k.searchIntent != null) && (
                        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}>
                          <Checkbox checked={filterBuyerOnly} onChange={() => setFilterBuyerOnly((v) => !v)} />
                          Buyer intent only
                        </label>
                      )}
                      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>{visibleKeywords.length} keywords</span>
                    </div>
                  )}

                  {keywords.length === 0 ? (
                    <EmptyState msg="No keyword data yet. Enter a niche keyword above and click Search." />
                  ) : visibleKeywords.length === 0 ? (
                    <div style={{ padding: "32px 0", textAlign: "center" }}>
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--muted)" }}>
                        No keywords match the current filters for this run.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setFilterAiOnly(false); setFilterBuyerOnly(false); setSearchText(""); }}
                        style={{ border: "1px solid var(--border)", color: "var(--accent)" }}
                      >
                        Clear filters
                      </Button>
                    </div>
                  ) : (
                    <div style={{ overflow: "auto", border: "1px solid var(--border)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--subtle)" }}>
                            <TH label="#" />
                            <TH label="Keyword" />
                            <TH label="Vol/mo" sortable k="searchVolume" />
                            <TH label="CPC" sortable k="cpc" />
                            <TH label="Competition" sortable k="competition" />
                            <TH label="Opp Score" sortable k="opportunityScore" />
                            <TH label="WTP Score" sortable k="wtpScore" />
                            <TH label="Intent" />
                            <TH label="Signals" />
                            <th style={{ padding: "6px 10px", textAlign: "left", borderBottom: "1px solid var(--border)", width: 44 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {visibleKeywords.map((kw, i) => {
                            const wtp = wtpScore(kw);
                            return (
                              <tr key={kw.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                <td style={{ ...tdS, textAlign: "center", color: "var(--muted)", fontSize: 11, width: 36 }}>{i + 1}</td>
                                <td style={{ ...tdS, maxWidth: 300 }}>
                                  <span style={{ color: "var(--fg)", wordBreak: "break-word" }}>{kw.keyword}</span>
                                  {kw.impressionsPerDay && kw.impressionsPerDay > 0 && (
                                    <span style={{ marginLeft: 8, fontSize: 11, color: "var(--muted)" }}>~{fmt(kw.impressionsPerDay)}/day</span>
                                  )}
                                </td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums" }}>{fmt(kw.searchVolume)}</td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: cpcColor(kw.cpc) }}>${kw.cpc.toFixed(2)}</td>
                                <td style={tdS}>
                                  <span style={{ padding: "2px 7px", fontSize: 11, fontWeight: 700, background: kw.competitionLevel ? `${COMP_COLORS[kw.competitionLevel] ?? "#888"}22` : "transparent", color: kw.competitionLevel ? (COMP_COLORS[kw.competitionLevel] ?? "#888") : "var(--muted)" }}>
                                    {kw.competitionLevel ?? "-"}
                                  </span>
                                </td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums", color: scoreColor(kw.opportunityScore) }}>
                                  {Math.round(kw.opportunityScore).toLocaleString()}
                                </td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: scoreColor(wtp) }}>
                                  {Math.round(wtp).toLocaleString()}
                                </td>
                                <td style={tdS}>
                                  {kw.searchIntent ? (
                                    <span style={{
                                      padding: "2px 7px", fontSize: 10, fontWeight: 700,
                                      background: kw.searchIntent === "transactional" ? "rgba(0,255,136,0.12)" : kw.searchIntent === "commercial" ? "rgba(134,239,172,0.1)" : "rgba(255,255,255,0.05)",
                                      color: kw.searchIntent === "transactional" ? "#00ff88" : kw.searchIntent === "commercial" ? "#86efac" : "var(--fg-subtle)",
                                    }}>
                                      {kw.searchIntent}
                                    </span>
                                  ) : <span style={{ color: "var(--fg-subtle)", fontSize: 11 }}>-</span>}
                                </td>
                                <td style={{ ...tdS }}>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {kw.isAiPrompt && (
                                      <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>AI</span>
                                    )}
                                    {kw.cpc >= 5 && (
                                      <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, background: "rgba(0,255,136,0.1)", color: "var(--accent)" }}>High WTP</span>
                                    )}
                                    {kw.competitionLevel === "LOW" && (
                                      <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, background: "rgba(0,255,136,0.08)", color: "#86efac" }}>Gap</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ ...tdS, width: 44, textAlign: "center" }}>
                                  <button
                                    disabled={creatingOpp === kw.id}
                                    onClick={async () => {
                                      setCreatingOpp(kw.id);
                                      try {
                                        const result = await createOpportunityFromKeyword({
                                          data: {
                                            keyword: kw.keyword,
                                            searchVolume: kw.searchVolume,
                                            cpc: kw.cpc,
                                            competitionLevel: kw.competitionLevel ?? null,
                                            opportunityScore: kw.opportunityScore,
                                          },
                                        });
                                        void navigate({ to: "/opportunity/$id", params: { id: String(result.id) } });
                                      } finally {
                                        setCreatingOpp(null);
                                      }
                                    }}
                                    title="Create opportunity from this keyword"
                                    style={{
                                      background: "none",
                                      border: "1px solid rgba(0,255,136,0.25)",
                                      color: creatingOpp === kw.id ? "var(--muted)" : "rgba(0,255,136,0.7)",
                                      cursor: creatingOpp === kw.id ? "not-allowed" : "pointer",
                                      borderRadius: 3,
                                      padding: "2px 6px",
                                      fontSize: 13,
                                      lineHeight: 1,
                                      fontWeight: 700,
                                      transition: "border-color 0.15s, color 0.15s",
                                    }}
                                  >
                                    {creatingOpp === kw.id ? "…" : "+"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {keywords.length > 0 && (
                    <div style={{ marginTop: 16, padding: "12px 16px", border: "1px solid var(--border)", background: "var(--subtle)", fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                      <strong style={{ color: "var(--fg)" }}>WTP Score</strong> = CPC × (1 − competition) × AI prompt bonus × log(volume).
                      Targets high-CPC, low-competition keywords that signal premium buyers.{" "}
                      <strong style={{ color: "#00ff88" }}>High WTP</strong> = CPC ≥ $5 · <strong style={{ color: "#86efac" }}>Gap</strong> = LOW competition · <strong style={{ color: "#a78bfa" }}>AI</strong> = purchase-intent phrasing.
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Question Discovery tab ── */}
          {activeTab === "autocomplete" && (
            <div>
              {loadingSet.has("autocomplete") && <LoadingState label="Fetching Google autocomplete suggestions" />}
              {!loadingSet.has("autocomplete") && acGroups && (() => {
                const GROUP_META: Record<string, { label: string; desc: string; priority: boolean }> = {
                  questions: { label: "Questions", desc: "Buyer pain & intent", priority: true },
                  comparisons: { label: "Comparisons", desc: "Alternatives & rivals", priority: true },
                  direct: { label: "Direct", desc: "Core variations", priority: false },
                  prepositions: { label: "Prepositions", desc: "Use-case modifiers", priority: false },
                  alphabetical: { label: "Alphabetical", desc: "Long-tail sweep", priority: false },
                };
                const GROUP_ORDER = ["questions", "comparisons", "direct", "prepositions", "alphabetical"] as const;
                const filterLower = acFilter.toLowerCase();
                const totalShown = GROUP_ORDER.reduce((n, g) => {
                  const kws = acGroups[g] ?? [];
                  return n + (filterLower ? kws.filter((k) => k.toLowerCase().includes(filterLower)).length : kws.length);
                }, 0);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {/* Summary strip */}
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 24, paddingBottom: 16, borderBottom: "1px solid var(--border)", marginBottom: 16, flexWrap: "wrap" }}>
                      {GROUP_ORDER.map((g) => {
                        const count = (acGroups[g] ?? []).length;
                        if (count === 0) return null;
                        return (
                          <div key={g} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <span style={{ fontSize: "1.6rem", fontWeight: 300, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: GROUP_META[g].priority ? "var(--accent)" : "var(--fg-muted)" }}>
                              {count}
                            </span>
                            <span style={{ fontSize: "0.60rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>
                              {GROUP_META[g].label}
                            </span>
                          </div>
                        );
                      })}
                      <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                        <span style={{ fontSize: "1.6rem", fontWeight: 300, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "var(--fg)" }}>
                          {acTotal}
                        </span>
                        <span style={{ fontSize: "0.60rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--fg-subtle)" }}>
                          Total
                        </span>
                      </div>
                    </div>

                    {/* Filter */}
                    <div style={{ marginBottom: 16 }}>
                      <input
                        value={acFilter}
                        onChange={(e) => setAcFilter(e.target.value)}
                        placeholder="Filter keywords…"
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: "var(--subtle)", border: "1px solid var(--border)",
                          color: "var(--fg)", fontSize: 13, padding: "7px 12px",
                          outline: "none", fontFamily: "inherit",
                        }}
                      />
                    </div>

                    {/* Groups */}
                    {GROUP_ORDER.map((g) => {
                      const all = acGroups[g] ?? [];
                      const kws = filterLower ? all.filter((k) => k.toLowerCase().includes(filterLower)) : all;
                      if (kws.length === 0) return null;
                      const { label, desc, priority } = GROUP_META[g];
                      return (
                        <div key={g} style={{ marginBottom: 20 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
                            <span style={{ fontSize: "0.60rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: priority ? "var(--accent)" : "var(--fg-subtle)" }}>
                              {label}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--fg-subtle)" }}>{kws.length}</span>
                            <span style={{ fontSize: 11, color: "var(--fg-subtle)", marginLeft: "auto", fontStyle: "italic" }}>{desc}</span>
                          </div>
                          {kws.map((kw) => (
                            <div
                              key={kw}
                              style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.025)", gap: 10 }}
                            >
                              <span style={{ flex: 1, fontSize: 13, color: priority ? "var(--fg)" : "var(--fg-muted)", lineHeight: 1.4 }}>
                                {kw}
                              </span>
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => { setSeedKeyword(kw); setAcFilter(""); }}
                                style={{ fontSize: 11, color: "var(--fg-subtle)", padding: "2px 8px", height: "auto", flexShrink: 0 }}
                              >
                                → seed
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })}

                    {totalShown === 0 && filterLower && (
                      <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: "var(--fg-subtle)" }}>
                        No keywords match "{acFilter}"
                      </div>
                    )}
                  </div>
                );
              })()}
              {!loadingSet.has("autocomplete") && !acGroups && <EmptyState msg="Search a keyword to see question discovery." />}
            </div>
          )}

          {/* ── Review Mining tab ── */}
          {activeTab === "reviews" && (
            <div>
              {loadingSet.has("reviews") && <LoadingState label="Mining Trustpilot negative reviews" />}
              {!loadingSet.has("reviews") && reviewAddonInactive && !serpDerivedReviews && (
                <div style={{ padding: "16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 13, lineHeight: 1.6 }}>
                  Trustpilot add-on not active.{" "}
                  Enable <strong>Organic Rankings</strong> as a source and re-run to see Trustpilot companies from SERP - or{" "}
                  <a href="https://app.dataforseo.com/api-access/marketplace" target="_blank" rel="noopener noreferrer" style={{ color: "#fbbf24", textDecoration: "underline" }}>activate the add-on</a> for full 1–3★ reviews.
                </div>
              )}
              {!loadingSet.has("reviews") && effectiveReviewData && (
                effectiveReviewData.length === 0
                  ? <EmptyState msg="No companies found on Trustpilot for this keyword." />
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {serpDerivedReviews && (
                        <div style={{ padding: "8px 14px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 12, lineHeight: 1.55 }}>
                          Trustpilot add-on not active - showing Trustpilot companies from your SERP results. Snippets are Google preview text, not individual reviews.{" "}
                          <a href="https://app.dataforseo.com/api-access/marketplace" target="_blank" rel="noopener noreferrer" style={{ color: "#fbbf24", textDecoration: "underline" }}>Activate the add-on</a> for full 1–3★ reviews.
                        </div>
                      )}
                      {effectiveReviewData.map((company, ci) => (
                        <div key={ci} style={{ border: "1px solid var(--border)" }}>
                          <div style={{ padding: "10px 14px", background: "var(--subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                            <div>
                              <span style={{ fontWeight: 700, color: "var(--fg)", fontSize: 13 }}>{company.title || company.domain}</span>
                              <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 8 }}>{company.domain}</span>
                            </div>
                            <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                              {!serpDerivedReviews && <>
                                <span style={{ color: company.rating < 3 ? "#ef4444" : company.rating < 4 ? "#f59e0b" : "#00ff88", fontWeight: 700 }}>★ {company.rating?.toFixed(1) ?? "?"}</span>
                                <span style={{ color: "var(--muted)" }}>{company.reviews_count?.toLocaleString() ?? "?"} total</span>
                              </>}
                              <span style={{ color: "#f59e0b", fontSize: 11 }}>{company.reviews?.length ?? 0} {serpDerivedReviews ? "snippets" : "low-rated shown"}</span>
                            </div>
                          </div>
                          {(company.reviews ?? []).length > 0 ? (
                            (company.reviews as ReviewItem[]).map((review, ri) => (
                              <div key={ri} style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "48px 1fr", gap: 12 }}>
                                <div style={{ textAlign: "center", paddingTop: 2 }}>
                                  <div style={{ color: (review.rating ?? 3) <= 2 ? "#ef4444" : "#f59e0b", fontWeight: 800, fontSize: 13 }}>
                                    {"★".repeat(review.rating ?? 1)}{"☆".repeat(5 - (review.rating ?? 1))}
                                  </div>
                                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{review.rating ?? "?"}/5</div>
                                </div>
                                <div>
                                  {review.title && <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: 12, marginBottom: 3 }}>{review.title}</div>}
                                  <div style={{ fontSize: 12, color: "rgba(250,250,250,0.72)", lineHeight: 1.6 }}>{review.review_text}</div>
                                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 5 }}>
                                    {review.author_name}{review.author_name && review.publication_date ? " · " : ""}{review.publication_date ? new Date(review.publication_date).toLocaleDateString() : ""}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--muted)" }}>No low-rated reviews retrieved.</div>
                          )}
                        </div>
                      ))}
                      <div style={{ padding: "10px 14px", border: "1px solid var(--border)", background: "var(--subtle)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                        These are your best market research documents - real buyers describing their exact frustrations with the incumbents in your niche.
                      </div>
                    </div>
                  )
              )}
            </div>
          )}

          {/* ── True Volume (Clickstream) tab ── */}
          {activeTab === "clickstream" && (
            <div>
              {loadingSet.has("clickstream") && <LoadingState label="Fetching Clickstream data" />}
              {!loadingSet.has("clickstream") && clickstreamData && (
                clickstreamData.keywords.length === 0
                  ? <EmptyState msg="No clickstream data - this keyword may have insufficient behavioral data." />
                  : (
                    <div style={{ overflow: "auto", border: "1px solid var(--border)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--subtle)" }}>
                            <TH label="Keyword" />
                            <TH label="True Vol/mo" />
                            <TH label="3-month trend" />
                          </tr>
                        </thead>
                        <tbody>
                          {clickstreamData.keywords.map((kw, i) => {
                            const trend = trendDelta(kw.monthly_searches);
                            const pos = trend ? parseFloat(trend) >= 0 : null;
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                <td style={{ ...tdS, color: "var(--fg)", fontWeight: 500 }}>{kw.keyword}</td>
                                <td style={{ ...tdS, color: "var(--accent)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                  {kw.search_volume != null ? fmt(kw.search_volume) : "-"}
                                </td>
                                <td style={{ ...tdS, color: pos === null ? "var(--muted)" : pos ? "#00ff88" : "#ef4444" }}>{trend ?? "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                        Cost: ${clickstreamData.cost.toFixed(4)} · Real user behavior - not Google Ads advertiser estimates
                      </div>
                    </div>
                  )
              )}
            </div>
          )}

          {/* ── Organic Rankings tab ── */}
          {activeTab === "serp" && (
            <div>
              {loadingSet.has("serp") && <LoadingState label="Fetching Google organic rankings" />}
              {!loadingSet.has("serp") && serpData && (
                serpData.length === 0
                  ? <EmptyState msg="No organic results returned." />
                  : (
                    <>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {serpData.map((item, i) => (
                          <div key={i} style={{ padding: "12px 16px", border: "1px solid var(--border)", ...(i > 0 ? { borderTop: "none" } : {}) }}>
                            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                              <div style={{ fontWeight: 800, fontSize: 18, color: i < 3 ? "var(--accent)" : "var(--muted)", minWidth: 26, textAlign: "right", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                                {item.rank_absolute ?? i + 1}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ marginBottom: 3 }}>
                                  <a href={item.url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontWeight: 600, color: "var(--accent)", fontSize: 13, textDecoration: "none" }}>
                                    {item.title ?? item.url}
                                  </a>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{item.domain ?? item.url}</div>
                                {item.description && <div style={{ fontSize: 12, color: "rgba(250,250,250,0.65)", lineHeight: 1.55 }}>{item.description}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)", border: "1px solid var(--border)", borderTop: "none", background: "var(--subtle)" }}>
                        Google organic - top {serpData.length} results · study domain authority and content gaps to find where you can rank
                      </div>
                    </>
                  )
              )}
            </div>
          )}

          {/* ── App Store tab ── */}
          {activeTab === "apps" && (
            <div>
              {loadingSet.has("apps") && <LoadingState label="Fetching Google Play rankings" />}
              {!loadingSet.has("apps") && appAddonInactive && (
                <div style={{ padding: "16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 13, lineHeight: 1.6 }}>
                  App Data add-on not active.{" "}
                  <a href="https://app.dataforseo.com/api-access/marketplace" target="_blank" rel="noopener noreferrer" style={{ color: "#fbbf24", textDecoration: "underline" }}>Activate it at dataforseo.com/marketplace</a> under "App Data".
                </div>
              )}
              {!loadingSet.has("apps") && appData && (
                appData.length === 0
                  ? <EmptyState msg="No app results found for this keyword." />
                  : (
                    <div style={{ overflow: "auto", border: "1px solid var(--border)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--subtle)" }}>
                            <TH label="#" />
                            <TH label="App" />
                            <TH label="Rating" />
                            <TH label="Reviews" />
                            <TH label="Installs" />
                            <TH label="Price" />
                          </tr>
                        </thead>
                        <tbody>
                          {appData.map((app, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                              <td style={{ ...tdS, textAlign: "center", color: "var(--muted)", fontSize: 11, width: 36 }}>{app.rank_absolute ?? i + 1}</td>
                              <td style={tdS}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {app.icon && <img src={app.icon} alt="" style={{ width: 30, height: 30, borderRadius: 6, flexShrink: 0 }} />}
                                  <div>
                                    <div style={{ fontWeight: 600, color: "var(--fg)", fontSize: 12 }}>{app.title ?? "-"}</div>
                                    {app.developer && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{app.developer}</div>}
                                  </div>
                                </div>
                              </td>
                              <td style={{ ...tdS, color: "#f59e0b", fontWeight: 700 }}>{app.rating != null ? `★ ${app.rating.toFixed(1)}` : "-"}</td>
                              <td style={{ ...tdS, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{app.reviews_count != null ? app.reviews_count.toLocaleString() : "-"}</td>
                              <td style={{ ...tdS, color: "var(--muted)" }}>{app.installs ?? "-"}</td>
                              <td style={{ ...tdS, color: app.price === "Free" || app.price === "0" ? "var(--muted)" : "var(--accent)" }}>{app.price ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              )}
            </div>
          )}

          {/* ── AI Search Demand tab ── */}
          {activeTab === "aiDemand" && (
            <div>
              {loadingSet.has("aiDemand") && <LoadingState label="Fetching AI search demand" />}
              {!loadingSet.has("aiDemand") && aiDemandAddonInactive && (
                <div style={{ padding: "16px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", color: "#fbbf24", fontSize: 13, lineHeight: 1.6 }}>
                  AI Optimization add-on not active.{" "}
                  <a href="https://app.dataforseo.com/api-access/marketplace" target="_blank" rel="noopener noreferrer" style={{ color: "#fbbf24", textDecoration: "underline" }}>Activate it at dataforseo.com/marketplace</a> under "AI Optimization".
                </div>
              )}
              {!loadingSet.has("aiDemand") && aiDemandData && (
                aiDemandData.keywords.length === 0
                  ? <EmptyState msg="No AI keyword data returned. This endpoint may require a DataForSEO AI plan add-on." />
                  : (
                    <div style={{ overflow: "auto", border: "1px solid var(--border)" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--subtle)" }}>
                            <TH label="Keyword / Prompt" />
                            <TH label="AI Search Vol" />
                            <TH label="3-month trend" />
                          </tr>
                        </thead>
                        <tbody>
                          {aiDemandData.keywords.map((kw, i) => {
                            const trend = trendDelta(kw.monthly_searches);
                            const pos = trend ? parseFloat(trend) >= 0 : null;
                            return (
                              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                <td style={{ ...tdS, color: "var(--fg)", fontWeight: 500 }}>{kw.keyword ?? "-"}</td>
                                <td style={{ ...tdS, color: "var(--accent)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                  {kw.search_volume != null ? fmt(kw.search_volume) : "-"}
                                </td>
                                <td style={{ ...tdS, color: pos === null ? "var(--muted)" : pos ? "#00ff88" : "#ef4444" }}>{trend ?? "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                        Cost: ${aiDemandData.cost.toFixed(4)} · What people actually ask ChatGPT and Google AIO - highest-intent buyer signals
                      </div>
                    </div>
                  )
              )}
            </div>
          )}

          {/* ── Competitor Keywords tab ── */}
          {activeTab === "competitorKw" && (
            <div>
              {loadingSet.has("competitorKw") && <LoadingState label={`Fetching keywords for ${competitorDomain}`} />}
              {!loadingSet.has("competitorKw") && competitorKws && (
                competitorKws.length === 0
                  ? <EmptyState msg={`No keywords found for ${competitorDomain} matching the filters.`} />
                  : (
                    <>
                      <div style={{ marginBottom: 12, fontSize: 12, color: "var(--muted)" }}>
                        <strong style={{ color: "var(--fg)" }}>{competitorDomain}</strong> - {competitorKws.length} keywords ranked (CPC &gt; $0.50, vol &gt; 10), sorted by CPC
                      </div>
                      <div style={{ overflow: "auto", border: "1px solid var(--border)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "var(--subtle)" }}>
                              <TH label="#" />
                              <TH label="Keyword" />
                              <TH label="Vol/mo" />
                              <TH label="CPC" />
                              <TH label="Competition" />
                              <TH label="Difficulty" />
                            </tr>
                          </thead>
                          <tbody>
                            {competitorKws.map((kw, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                                <td style={{ ...tdS, textAlign: "center", color: "var(--muted)", fontSize: 11, width: 36 }}>{i + 1}</td>
                                <td style={{ ...tdS, maxWidth: 300 }}>
                                  <span style={{ color: "var(--fg)" }}>{kw.keyword}</span>
                                </td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums" }}>{fmt(kw.search_volume)}</td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: cpcColor(kw.cpc) }}>${kw.cpc.toFixed(2)}</td>
                                <td style={tdS}>
                                  <span style={{ padding: "2px 7px", fontSize: 11, fontWeight: 700, background: kw.competition_level ? `${COMP_COLORS[kw.competition_level] ?? "#888"}22` : "transparent", color: kw.competition_level ? (COMP_COLORS[kw.competition_level] ?? "#888") : "var(--muted)" }}>
                                    {kw.competition_level ?? "-"}
                                  </span>
                                </td>
                                <td style={{ ...tdS, fontVariantNumeric: "tabular-nums" }}>
                                  {kw.keyword_difficulty != null ? (
                                    <span style={{ color: kw.keyword_difficulty >= 70 ? "#ef4444" : kw.keyword_difficulty >= 40 ? "#f59e0b" : "#00ff88", fontWeight: 700 }}>
                                      {kw.keyword_difficulty}
                                    </span>
                                  ) : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: 12, padding: "10px 14px", border: "1px solid var(--border)", background: "var(--subtle)", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                        <strong style={{ color: "var(--fg)" }}>Difficulty</strong> 0–100: &lt;40 = rankable with good content · 40–70 = needs backlinks · &gt;70 = established incumbents.
                      </div>
                    </>
                  )
              )}
              {!loadingSet.has("competitorKw") && !competitorKws && <EmptyState msg="Enter a competitor domain above and click Search." />}
            </div>
          )}

          {/* ── Web Pain Signals tab ── */}
          {activeTab === "contentAnalysis" && (
            <div>
              {loadingSet.has("contentAnalysis") && <LoadingState label="Scanning web for pain signals" />}
              {!loadingSet.has("contentAnalysis") && contentItems && (
                contentItems.length === 0
                  ? <EmptyState msg="No web mentions found for this keyword." />
                  : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {contentItems.map((item, i) => {
                        const sentimentColor = item.sentiment === "negative" ? "#ef4444" : item.sentiment === "positive" ? "#00ff88" : "var(--fg-subtle)";
                        const typeColors: Record<string, string> = { forum: "#a78bfa", blog: "#60a5fa", news: "#f59e0b", reviews: "#ef4444", ecommerce: "#34d399" };
                        return (
                          <div key={i} style={{ padding: "12px 16px", border: "1px solid var(--border)", borderTop: i === 0 ? "1px solid var(--border)" : "none", background: item.sentiment === "negative" ? "rgba(239,68,68,0.03)" : "transparent" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                              <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, background: `${typeColors[item.type] ?? "#888"}18`, color: typeColors[item.type] ?? "var(--muted)", flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                {item.type}
                              </span>
                              <span style={{ padding: "2px 6px", fontSize: 10, fontWeight: 700, background: `${sentimentColor}15`, color: sentimentColor, flexShrink: 0 }}>
                                {item.sentiment}
                              </span>
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", textDecoration: "none", flex: 1, lineHeight: 1.4 }}>
                                {item.title || item.domain}
                              </a>
                            </div>
                            {item.snippet && (
                              <p style={{ margin: "0 0 6px", fontSize: 12, color: "rgba(250,250,250,0.65)", lineHeight: 1.6, paddingLeft: 0 }}>
                                {item.snippet.slice(0, 240)}{item.snippet.length > 240 ? "…" : ""}
                              </p>
                            )}
                            <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fg-subtle)" }}>
                              <span>{item.domain}</span>
                              {item.author && <span>by {item.author}</span>}
                              {item.date_published && <span>{new Date(item.date_published).toLocaleDateString()}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
              )}
              {!loadingSet.has("contentAnalysis") && !contentItems && <EmptyState msg="Search a keyword to surface web pain signals." />}
            </div>
          )}

          {/* Empty state */}
          {visibleTabs.length === 0 && !isLoading && (
            <div style={{ padding: "60px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
                No results yet. Search a niche keyword to start discovering demand signals.
              </div>
              <div style={{ fontSize: 12, color: "rgba(250,250,250,0.3)" }}>
                Start with <strong style={{ color: "rgba(0,255,136,0.5)" }}>Volume/CPC</strong> + <strong style={{ color: "rgba(0,255,136,0.5)" }}>Review Mining</strong> + <strong style={{ color: "rgba(0,255,136,0.5)" }}>Question Discovery</strong> for the highest signal-to-cost ratio.
              </div>
            </div>
          )}

        </div>{/* end main inner */}
      </div>{/* end main area */}
    </div>
  );
}
