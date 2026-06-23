import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

const getStoreData = createServerFn()
  .handler(async ({ data: domain }: { data: string }) => {
    const { db } = await import("../db/client");
    const { rankings, categories, domainSnapshots, runs, domainNames } = await import("../db/schema");
    const { eq, desc, and, ne, inArray } = await import("drizzle-orm");

    const storeRankings = await db
      .select({ rank: rankings, category: categories })
      .from(rankings)
      .innerJoin(categories, eq(rankings.categoryId, categories.id))
      .where(eq(rankings.domain, domain))
      .orderBy(desc(rankings.mentionCount));

    // All categories (for gap analysis)
    const allCategories = await db.select().from(categories);

    // Per-category data: rank, competitors, share of voice
    type CompetitorRow = { domain: string; mentionCount: number; rank: number };
    const rankPositions: Record<string, number> = {};
    const competitors: Record<string, CompetitorRow[]> = {};
    const shareOfVoice: Record<string, number> = {};

    for (const { category } of storeRankings) {
      const allInCategory = await db
        .select()
        .from(rankings)
        .where(eq(rankings.categoryId, category.id))
        .orderBy(desc(rankings.mentionCount));

      const pos = allInCategory.findIndex((r) => r.domain === domain);
      if (pos !== -1) rankPositions[category.id] = pos + 1;

      // Top 3 rivals (excluding this domain)
      competitors[category.id] = allInCategory
        .filter((r) => r.domain !== domain)
        .slice(0, 3)
        .map((r, i) => ({ domain: r.domain, mentionCount: r.mentionCount, rank: allInCategory.findIndex((x) => x.domain === r.domain) + 1 }));

      // Share of voice vs category leader
      const topScore = allInCategory[0]?.mentionCount ?? 1;
      const myScore = allInCategory.find((r) => r.domain === domain)?.mentionCount ?? 0;
      shareOfVoice[category.id] = topScore > 0 ? Math.round((myScore / topScore) * 100) : 0;
    }

    // Trend: last 20 completed runs
    const recentRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.status, "done"))
      .orderBy(desc(runs.createdAt))
      .limit(20);

    const runsChron = [...recentRuns].reverse();
    const trend: Array<{ date: string; mentions: number }> = [];
    for (const run of runsChron) {
      const snaps = await db
        .select()
        .from(domainSnapshots)
        .where(and(eq(domainSnapshots.runId, run.id), eq(domainSnapshots.domain, domain)));
      const total = snaps.reduce((sum, s) => sum + s.mentionCount, 0);
      trend.push({
        date: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
        mentions: total,
      });
    }

    // Momentum: compare last two runs per category
    const momentum: Record<string, "up" | "down" | "flat" | "new"> = {};
    if (runsChron.length >= 2) {
      const lastRun = runsChron[runsChron.length - 1];
      const prevRun = runsChron[runsChron.length - 2];
      for (const { category } of storeRankings) {
        const [lastSnap] = await db.select().from(domainSnapshots)
          .where(and(eq(domainSnapshots.runId, lastRun.id), eq(domainSnapshots.domain, domain), eq(domainSnapshots.categoryId, category.id)));
        const [prevSnap] = await db.select().from(domainSnapshots)
          .where(and(eq(domainSnapshots.runId, prevRun.id), eq(domainSnapshots.domain, domain), eq(domainSnapshots.categoryId, category.id)));
        const last = lastSnap?.mentionCount ?? 0;
        const prev = prevSnap?.mentionCount ?? 0;
        if (!prevSnap) momentum[category.id] = "new";
        else if (last > prev) momentum[category.id] = "up";
        else if (last < prev) momentum[category.id] = "down";
        else momentum[category.id] = "flat";
      }
    }

    const nameRow = await db.select().from(domainNames).where(eq(domainNames.domain, domain)).limit(1);
    const brandName = nameRow[0]?.brandName ?? null;

    const totalMentions = storeRankings.reduce((sum, r) => sum + r.rank.mentionCount, 0);

    // Peak week — best single-run total mentions from all snapshots
    const allDomainSnaps = await db.select().from(domainSnapshots).where(eq(domainSnapshots.domain, domain));
    const snapsByRun: Record<string, number> = {};
    for (const s of allDomainSnaps) {
      snapsByRun[s.runId] = (snapsByRun[s.runId] ?? 0) + s.mentionCount;
    }
    const peakWeekMentions = Math.max(0, ...Object.values(snapsByRun));
    const currentWeekMentions = trend.length > 0 ? trend[trend.length - 1].mentions : 0;

    // Overall share of voice vs global #1
    const { sql } = await import("drizzle-orm");
    const topOverall = await db
      .select({ domain: rankings.domain, total: sql<number>`sum(${rankings.mentionCount})` })
      .from(rankings)
      .groupBy(rankings.domain)
      .orderBy(desc(sql<number>`sum(${rankings.mentionCount})`))
      .limit(1);
    const leaderTotal = topOverall[0]?.total ?? 1;
    const overallShareOfVoice = leaderTotal > 0 ? Math.round((totalMentions / leaderTotal) * 100) : 0;
    const leaderDomain = topOverall[0]?.domain ?? null;

    // Visibility score (0-100)
    // 40pts: share of voice vs leader; 30pts: best rank; 30pts: category breadth
    const bestRank = Math.min(...Object.values(rankPositions), 99);
    const rankScore = Math.round(30 / Math.max(bestRank, 1));
    const sovScore = Math.round(overallShareOfVoice * 0.4);
    const breadthScore = Math.round((storeRankings.length / Math.max(allCategories.length, 1)) * 30);
    const visibilityScore = Math.min(100, rankScore + sovScore + breadthScore);

    return {
      domain,
      brandName,
      rankings: storeRankings.map(({ rank, category }) => ({
        categoryId: category.id,
        categoryName: category.name,
        categorySlug: category.slug,
        mentionCount: rank.mentionCount,
        lastSeen: rank.lastSeen,
        rank: rankPositions[category.id] ?? 0,
        competitors: competitors[category.id] ?? [],
        shareOfVoice: shareOfVoice[category.id] ?? 0,
        momentum: momentum[category.id] ?? "flat",
      })),
      trend,
      gaps: [],
      totalMentions,
      peakWeekMentions,
      currentWeekMentions,
      overallShareOfVoice,
      leaderDomain,
      visibilityScore,
    };
  });

export const Route = createFileRoute("/store/$domain")({
  loader: ({ params }) => getStoreData({ data: params.domain }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.domain} - AI Visibility Rankings | LiveAIPulse` },
      { name: "description", content: `See how often AI recommends ${loaderData?.domain} across shopping categories. Updated weekly.` },
      { property: "og:title", content: `${loaderData?.domain} - AI Visibility | LiveAIPulse` },
      { property: "og:description", content: `How often AI recommends ${loaderData?.domain} vs competitors. Track AI shopping visibility weekly.` },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: `https://liveaipulse.com/store/${loaderData?.domain}` }],
    scripts: loaderData ? [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${loaderData.domain} AI Shopping Visibility`,
        description: `AI recommendation rankings for ${loaderData.domain} tracked by LiveAIPulse.`,
        url: `https://liveaipulse.com/store/${loaderData.domain}`,
        about: { "@type": "Organization", name: loaderData.domain, url: `https://${loaderData.domain}` },
      }),
    }] : [],
  }),
  component: StorePage,
});

const CATEGORY_STRATEGIES: Record<string, [string, string, string]> = {
  skincare: ["get editorial coverage on Into The Gloss or Byrdie", "build organic presence in r/SkincareAddiction", "rewrite product pages with ingredient-specific language"],
  "hair-care": ["get featured on NaturallyCurly or Glamour", "build presence in r/HairCare and r/curlyhair", "create ingredient and routine-focused blog content"],
  "mens-grooming": ["get coverage in GQ or AskMen grooming guides", "build presence in r/wicked_edge and r/malegrooming", "target barbershop and wet shaving community sites"],
  supplements: ["get cited on Examine.com or Healthline", "build organic presence in r/Supplements", "pursue Labdoor or NSF third-party testing and publicise it"],
  "coffee-tea": ["get reviewed on Sprudge or Perfect Daily Grind", "build presence in r/coffee", "get listed in specialty coffee directories like RoasterList"],
  "food-snacks": ["get placed in Bon Appetit or Food52 gift guides", "build presence in r/snacking and food communities", "pursue Serious Eats or Tasting Table editorial coverage"],
  candles: ["get featured in Apartment Therapy or Better Homes & Gardens", "build presence in r/candlemaking and lifestyle blogs", "pursue The Strategist or Oprah Daily gift guide placement"],
  "home-decor": ["get featured in Apartment Therapy or Architectural Digest", "build presence in r/malelivingspace or r/femalelivingspace", "pursue Forbes Home or Business Insider Home coverage"],
  sneakers: ["get covered by Sneaker News, Highsnobiety, or Hypebeast", "build presence in r/Sneakers and r/RunningShoeGeeks", "pursue Runner's World or Outside Magazine gear guide placement"],
  clothing: ["get listed in r/malefashionadvice or r/femalefashionadvice wikis", "pursue mid-tier sustainable fashion blog roundups", "get placed in Nordstrom alternative editorial content"],
  activewear: ["get featured in Well+Good, Women's Health, or Men's Health", "build presence in r/xxfitness and r/running", "pursue mid-tier fitness YouTuber review coverage"],
  "bags-accessories": ["get featured in Wirecutter or The Strategist", "build presence in r/BuyItForLife and r/EDC", "target r/leathergoods and craftsmanship communities"],
  watches: ["get reviewed on Hodinkee or aBlogtoWatch", "build presence in r/Watches and WatchSeek forums", "pursue Time+Tide or Worn & Wound editorial coverage"],
  "outdoor-camping": ["get tested by Wirecutter or Outside Magazine", "build presence in r/CampingGear and r/ultralight", "pursue hiking and adventure travel blog roundups"],
  "tech-accessories": ["get featured in Wirecutter or The Verge", "build presence in r/battlestations and r/MechanicalKeyboards", "pursue MKBHD or major tech YouTuber review coverage"],
  jewelry: ["get featured in Brides, Vogue, or The Knot", "build presence in r/Jewelry and r/Diamonds", "pursue engagement and anniversary gift guide editorial"],
  "baby-kids": ["get listed on Babylist registry recommendations", "build presence in r/beyondthebump and r/BabyBumps", "pursue BabyCenter or What to Expect editorial coverage"],
  "stationery-gifts": ["get featured in The Strategist or The Cut gift guides", "build presence in r/Journaling, r/pens, and r/fountainpens", "pursue Wirecutter gift guide placement"],
  "dog-supplies": ["build presence in r/dogs and r/DogAdvice", "get coverage in Whole Dog Journal or The Spruce Pets", "pursue veterinarian blog and PetMD citations"],
  "spirits-cocktails": ["get reviewed on Difford's Guide or Punch Drink", "build presence in r/cocktails", "pursue Imbibe Magazine or Tales of the Cocktail coverage"],
  "bedding-towels": ["get tested by Wirecutter or Sleep Foundation", "build presence in r/BuyItForLife for bedding", "pursue Apartment Therapy or Good Housekeeping placement"],
};

function buildVerdictQuestion(domain: string, rank: number, categoryName: string, categorySlug: string): string {
  const strategies = CATEGORY_STRATEGIES[categorySlug] ?? [
    "get editorial coverage on authoritative review sites",
    "build organic presence in relevant Reddit communities",
    "improve product pages with natural shopping language",
  ];
  return `My Shopify store ${domain} ranks #${rank} in ${categoryName} on LiveAIPulse, which tracks how often AI assistants recommend stores when shoppers ask where to buy things. I want to improve my AI visibility and climb the rankings. Which should I prioritize: (A) ${strategies[0]}, (B) ${strategies[1]}, or (C) ${strategies[2]}? I have limited time and want the highest ROI move first.`;
}

function ColdVerdictCTA({ domain, rank, categoryName, categorySlug }: {
  domain: string; rank: number; categoryName: string; categorySlug: string;
}) {
  const question = buildVerdictQuestion(domain, rank, categoryName, categorySlug);
  const url = `https://coldverdict.com/ask?q=${encodeURIComponent(question)}`;

  const f = "'Space Grotesk', sans-serif";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", border: "1px solid var(--lb-border)", marginBottom: 24, background: "var(--lb-bg-1)", transition: "border-color 0.12s, background 0.12s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--lb-azure)"; e.currentTarget.style.background = "var(--lb-azure-soft)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--lb-border)"; e.currentTarget.style.background = "var(--lb-bg-1)"; }}
    >
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 20 }}>
        {/* Horizontal logo */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" width={140} viewBox="0 0 100 20" aria-label="Cold Verdict logo" style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="cvh-berg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lb-azure)" stopOpacity="1" />
              <stop offset="90%" stopColor="var(--lb-azure)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="var(--lb-azure)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polyline points="4,14 7.5,11 10,7 12.5,11 16,14" fill="none" stroke="url(#cvh-berg)" strokeWidth="0.5" strokeLinejoin="round" />
          <circle cx="10"  cy="7"    r="1.6" fill="var(--lb-azure)" opacity="0.25" />
          <circle cx="10"  cy="7"    r="1.0" fill="var(--lb-azure)" opacity="0.9" />
          <circle cx="4"   cy="14"   r="1.6" fill="var(--lb-azure)" opacity="0.25" />
          <circle cx="4"   cy="14"   r="1.0" fill="var(--lb-azure)" opacity="0.9" />
          <circle cx="10"  cy="13.5" r="1.6" fill="var(--lb-azure)" opacity="0.25" />
          <circle cx="10"  cy="13.5" r="1.0" fill="var(--lb-azure)" opacity="0.9" />
          <circle cx="16"  cy="14"   r="1.6" fill="var(--lb-azure)" opacity="0.25" />
          <circle cx="16"  cy="14"   r="1.0" fill="var(--lb-azure)" opacity="0.9" />
          <text x="21" y="14" fontFamily={f} fontSize="10" fontWeight="600" letterSpacing="1" fill="var(--lb-fg)">COLD</text>
          <text x="51" y="14" fontFamily={f} fontSize="10" fontWeight="700" letterSpacing="1" fill="var(--lb-azure)">VERDICT</text>
        </svg>

        {/* Divider */}
        <div style={{ width: 1, height: 32, background: "var(--lb-border)", flexShrink: 0 }} />

        {/* Copy */}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--lb-fg)", margin: "0 0 2px", fontFamily: f }}>
            Not sure which move to make first?
          </p>
          <p style={{ fontSize: 12, color: "var(--lb-fg-3)", margin: 0, lineHeight: 1.5 }}>
            The best AI models help you decide the highest-ROI move for your {categoryName} ranking.
          </p>
        </div>

        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-azure)", flexShrink: 0, fontWeight: 600 }}>Ask →</span>
      </div>
    </a>
  );
}

function MonitorCTA({ domain, brandName }: { domain: string; brandName: string | null }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const inputStyle: React.CSSProperties = {
    flex: 1, height: 36, padding: "0 10px",
    background: "var(--lb-bg-1)", border: "1px solid var(--lb-border-strong)",
    color: "var(--lb-fg)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/monitor/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, domain }),
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid var(--lb-border)", marginBottom: 24 }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--lb-border)", background: "var(--lb-bg-1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--lb-fg)", margin: 0 }}>Brand Monitor</h3>
          <p style={{ fontSize: 12, color: "var(--lb-fg-3)", margin: "2px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>Free weekly ranking updates for this store</p>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: "var(--lb-azure)", letterSpacing: "0.08em", background: "var(--lb-azure-soft)", padding: "3px 8px" }}>FREE</span>
      </div>
      <div style={{ padding: "16px 20px" }}>
        {done ? (
          <p style={{ fontSize: 13, color: "var(--lb-green)", fontFamily: "'JetBrains Mono', monospace", margin: 0 }}>
            Subscribed. Check your inbox for confirmation.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: "var(--lb-fg-2)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Get a weekly email showing{" "}
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, color: "var(--lb-fg)", letterSpacing: "-0.01em", background: "var(--lb-azure-soft)", padding: "1px 5px" }}>
                {brandName ?? domain}
              </span>
              {" "}'s AI ranking position and whether it moved up or down.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={loading || !email}
                style={{ height: 36, padding: "0 14px", background: "var(--lb-azure)", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, fontFamily: "inherit", cursor: loading || !email ? "not-allowed" : "pointer", opacity: loading || !email ? 0.5 : 1 }}
              >
                {loading ? "..." : "Monitor"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

type Tip = { n: string; title: string; body: string };

const CATEGORY_TIPS: Record<string, Tip[]> = {
  skincare: [
    { n: "01", title: "Get featured on Into The Gloss or Byrdie", body: "AI models surface stores that appear in editorial skincare roundups. A single placement on Into The Gloss, Byrdie, or Allure with your domain cited by name is worth more than any on-site optimization." },
    { n: "02", title: "Show up in r/SkincareAddiction recommendations", body: "Reddit's skincare community is heavily indexed by AI training data. Organic mentions in threads like 'where to buy X ingredient' or 'dupe for [luxury product]' drive outsized mention rates." },
    { n: "03", title: "Make ingredient transparency a content pillar", body: "Queries like 'best vitamin C serum online' favor stores whose product pages explain ingredient percentages and formulation rationale. Answer the science questions, not just the marketing ones." },
    { n: "04", title: "Earn a review on Paula's Choice Ingredient Dictionary context", body: "When ingredient-education sites reference stores as examples, AI models pick that up. Partner with or be cited by ingredient-focused review sites." },
    { n: "05", title: "Make your domain easy to cite", body: "Short, memorable domains get cited more in AI responses. Ensure your store name and domain are consistent everywhere - Google profile, press mentions, Reddit comments." },
  ],
  "hair-care": [
    { n: "01", title: "Target NaturallyCurly and texture-specific communities", body: "AI queries about hair care skew toward specific hair types. Getting mentioned on NaturallyCurly, CurlTalk, or r/curlyhair for relevant products reaches the exact query context we test." },
    { n: "02", title: "Show up in r/HairCare and r/curlyhair product threads", body: "Reddit hair communities are highly indexed. Organic recommendations in 'what do you use for X' threads are picked up directly by AI models and carry strong credibility signals." },
    { n: "03", title: "Get placements in Glamour or Cosmopolitan hair roundups", body: "Editorial 'best of' lists in major beauty publications are a reliable source for AI training data. A single 'best shampoo for dry hair' list placement can add significant mention volume." },
    { n: "04", title: "Lead with ingredient and routine content", body: "Queries like 'best shampoo for scalp health' favor stores with content about formulation and hair routines. Blog posts that answer 'what ingredients to look for' outperform product-only pages." },
    { n: "05", title: "Ensure your domain is clean and consistent", body: "Short, memorable domains get cited more in AI responses. Make sure your brand name and URL match across all channels and review sites." },
  ],
  "mens-grooming": [
    { n: "01", title: "Build presence in r/wicked_edge and r/malegrooming", body: "These subreddits are the highest-signal source for men's grooming recommendations. AI models surface stores that appear in organic 'where to buy' and gear review threads here repeatedly." },
    { n: "02", title: "Get featured in GQ, AskMen, or Esquire grooming guides", body: "Men's editorial grooming content is a primary AI training source. A 'best beard oil' or 'best aftershave' placement in a major men's publication carries disproportionate weight." },
    { n: "03", title: "Appear on barbershop and wet shaving community sites", body: "Badger & Blade and similar wet shaving forums are niche but highly specific to our query set. Mentions in product review threads there drive targeted AI mentions." },
    { n: "04", title: "Use the language men actually search with", body: "Queries we run use plain language: 'face wash for men', 'beard grooming kit'. Pages that use the same natural language rather than marketing jargon match more precisely." },
    { n: "05", title: "Keep your domain easy to remember and cite", body: "Short brand names and matching domains get cited more frequently in AI responses across all channels." },
  ],
  supplements: [
    { n: "01", title: "Get cited on Examine.com or Healthline", body: "AI supplements queries heavily favor stores mentioned in the context of science-backed resources. Being cited as an example store on Examine.com or Healthline is extremely high-signal." },
    { n: "02", title: "Build organic presence in r/Supplements", body: "The supplements subreddit is directly indexed by AI training data. Genuine product recommendations in 'where do you buy your X' threads consistently show up in AI responses." },
    { n: "03", title: "Earn third-party testing credibility (Labdoor, NSF)", body: "AI answers about supplements often include trust-and-safety context. Stores with Labdoor grades, NSF certification, or Informed Sport status appear in queries about 'safe supplements to buy online'." },
    { n: "04", title: "Create transparent dosage and formulation content", body: "Queries like 'best creatine monohydrate online' favor stores that explain their formulations. Blog posts breaking down doses, forms, and quality markers outperform catalog pages." },
    { n: "05", title: "Target Bodybuilding.com and fitness community editorial", body: "Bodybuilding.com's product reviews and comparisons are indexed by AI. Getting a store or product featured there (via reviews or editorial) generates lasting mention exposure." },
  ],
  "coffee-tea": [
    { n: "01", title: "Get reviewed on Sprudge or Perfect Daily Grind", body: "These are the two highest-authority coffee editorial sites. AI coffee queries almost always surface stores mentioned in Sprudge reviews or PDG 'best roasters' lists - a placement here is the single highest-leverage action." },
    { n: "02", title: "Show up in r/coffee recommendations", body: "r/coffee is the most-indexed coffee community for AI training. Being recommended in threads like 'best place to buy single origin' or 'good subscription roaster' drives consistent mention volume." },
    { n: "03", title: "Appear in James Hoffmann or Scott Rao adjacent content", body: "The specialty coffee world orbits a few influential educators. Getting mentioned in content that cites their methodology or appears in their community circles is very high signal for AI." },
    { n: "04", title: "List your roastery in coffee directories", body: "Sites like RoasterList and Coffeereview.com are indexed by AI. Being present in curated roaster directories is a simple, durable signal." },
    { n: "05", title: "Use specialty coffee vocabulary naturally", body: "Queries include terms like 'single origin', 'natural process', 'freshly roasted'. Product pages and blog posts using this language precisely match what AI models are looking for." },
  ],
  "food-snacks": [
    { n: "01", title: "Earn placement in gift guide roundups (Bon Appétit, Food52)", body: "AI food and snack queries heavily source from editorial gift guides. A Bon Appétit 'best food gifts' or Food52 list placement with your domain cited generates lasting AI mentions." },
    { n: "02", title: "Get reviewed in specialty food communities", body: "r/snacking, r/EatCheapAndHealthy, and r/Cooking are indexed by AI. Organic store recommendations in product threads carry more weight than any sponsored placement." },
    { n: "03", title: "Build a blog with specific flavor and use-case content", body: "Queries like 'best healthy snacks to buy online' favor stores with content that answers 'why these ingredients' or 'best for X diet'. Match the question, not just the product." },
    { n: "04", title: "Pursue niche food publication coverage", body: "Specialty food press (Serious Eats, The Takeout, Tasting Table) is a primary AI training source for this category. A single editorial mention with your store name drives consistent mention volume." },
    { n: "05", title: "Make subscriptions and gifting the lead offer", body: "AI queries often include 'food gift' or 'subscription snack box'. Stores that clearly present subscription and gift formats appear more often in those query responses." },
  ],
  candles: [
    { n: "01", title: "Get featured in Apartment Therapy or Better Homes & Gardens candle guides", body: "These are primary AI sources for home fragrance queries. A 'best scented candles' placement with your store domain cited is the single most effective action in this category." },
    { n: "02", title: "Show up in gift guide editorial (The Strategist, Oprah Daily)", body: "Candles are heavily gift-driven. AI gift queries surface stores from The Cut, The Strategist, and Oprah Daily gift guides more than almost any other source." },
    { n: "03", title: "Build presence in r/candlemaking and home fragrance forums", body: "Reddit candle communities discuss both making and buying. Organic brand recommendations in these spaces are indexed by AI and carry strong authenticity signals." },
    { n: "04", title: "Lead with scent family and mood-based content", body: "Queries include 'best candle for relaxation' or 'warm cozy scented candles'. Pages that use scent-family language (woody, floral, gourmand) and mood context match these queries precisely." },
    { n: "05", title: "Make burn time and wax type explicit everywhere", body: "AI models pick up factual claims. Stores that clearly state '60-hour burn time', 'coconut wax', 'hand-poured' appear more reliably in quality-focused shopping queries." },
  ],
  "home-decor": [
    { n: "01", title: "Get featured on Apartment Therapy or Architectural Digest", body: "These are the highest-authority home editorial sources indexed by AI. A store mention in an Apartment Therapy product roundup drives more AI mentions than most other actions combined." },
    { n: "02", title: "Show up in r/malelivingspace and r/femalelivingspace", body: "These subreddits are heavily indexed by AI training data. Organic store recommendations in room makeover and 'where did you get that' threads are very high signal." },
    { n: "03", title: "Build presence in interior design blog roundups", body: "Mid-tier interior design blogs that publish 'best places to shop for home decor' posts are consistently indexed. Getting listed in 5-10 of them is more durable than one big placement." },
    { n: "04", title: "Use style and aesthetic language explicitly", body: "Queries include 'modern minimalist home decor', 'Scandinavian style furniture'. Pages that clearly identify aesthetic style (not just 'affordable home goods') match these queries precisely." },
    { n: "05", title: "Pursue press coverage with domain in the URL", body: "A Forbes Home, Business Insider Home, or trade publication mention with your store name cited creates lasting high-authority signal for AI models." },
  ],
  sneakers: [
    { n: "01", title: "Get covered by Sneaker News, Highsnobiety, or Hypebeast", body: "These are the primary AI training sources for sneaker queries. A brand or product feature with your store domain cited is the highest-leverage single action in this category." },
    { n: "02", title: "Build presence in r/Sneakers and r/RunningShoeGeeks", body: "Sneaker and running subreddits are heavily indexed. Organic 'where to buy' recommendations and store reviews in these communities generate consistent AI mentions." },
    { n: "03", title: "Get placements in running and fitness editorial (Runner's World, Outside)", body: "AI running shoe queries source heavily from Runner's World, Outside Magazine, and similar editorial. A 'best running shoes' list placement is directly cited in AI responses." },
    { n: "04", title: "Be present on niche brand discovery sites", body: "Sites like SneakerNews brand directories and independent sneaker blogs are indexed. Getting your store listed as a destination for specific brands or styles adds cumulative mention weight." },
    { n: "05", title: "Make your specialty explicit in copy", body: "Queries are specific: 'best place to buy wide-fit running shoes', 'premium sneaker store online'. Stores that state their specialty clearly match more precise queries." },
  ],
  clothing: [
    { n: "01", title: "Get featured in r/malefashionadvice or r/femalefashionadvice wikis", body: "These subreddit wikis are directly indexed and frequently cited by AI models in clothing recommendation queries. Getting included as a recommended store in these community resources has lasting impact." },
    { n: "02", title: "Earn editorial placement in Nordstrom or major retailer comparisons", body: "AI clothing queries often source from editorial 'best indie clothing brands' or 'alternatives to [major retailer]' lists. Appearing in those comparisons puts you in the direct query context." },
    { n: "03", title: "Build content around fabric quality and fit specificity", body: "Queries like 'where to buy heavyweight t-shirts' or 'best linen shirts online' favor stores whose product pages specify fabric weight, origin, and fit notes. Answer the specifics." },
    { n: "04", title: "Pursue mid-tier fashion blog coverage", body: "Dozens of 'sustainable clothing brands' or 'ethical fashion' roundup blogs get indexed by AI. Getting listed in 10 of them is often more effective than one major publication." },
    { n: "05", title: "Maintain consistent brand identity across channels", body: "Short, memorable brand names that appear consistently across editorial, social, and community mentions get cited more reliably in AI responses." },
  ],
  activewear: [
    { n: "01", title: "Build presence in r/xxfitness and r/running communities", body: "These subreddits are primary AI sources for activewear recommendations. Organic store mentions in 'what do you wear for X' threads are indexed and generate direct AI citation." },
    { n: "02", title: "Get featured in Well+Good, Women's Health, or Men's Health gear guides", body: "Fitness editorial gear roundups are a top AI training source. A 'best leggings' or 'best workout gear' list placement with your domain cited drives measurable mention increases." },
    { n: "03", title: "Partner with fitness YouTubers for review content", body: "YouTube fitness reviews are increasingly indexed by AI. A product review from a mid-tier fitness channel (50K-500K subs) with your store name mentioned creates indexed content that AI surfaces." },
    { n: "04", title: "Lead with performance specifications", body: "Queries include 'moisture-wicking leggings', 'four-way stretch shorts'. Stores with explicit performance specs on product pages match these queries more precisely than lifestyle-only descriptions." },
    { n: "05", title: "Target niche sport-specific communities", body: "Crossfit, yoga, running, and cycling communities each have their own indexed forums and sites. A store recommendation from r/crossfit or a cycling gear blog is highly targeted." },
  ],
  "bags-accessories": [
    { n: "01", title: "Get featured in r/BuyItForLife and r/EDC", body: "These subreddits are the highest-indexed sources for bag and everyday carry queries. Organic store mentions in gear recommendations and 'what do you carry' threads are directly cited by AI." },
    { n: "02", title: "Earn Wirecutter or The Strategist placements", body: "These are the two most-cited product recommendation sources in AI training data. A bag or accessory review with your store name is extremely durable citation signal." },
    { n: "03", title: "Target r/leathergoods and craft communities", body: "Leather and craftsmanship forums discuss quality brands extensively. AI training data from these niche communities carries high authenticity weight for 'quality bag' queries." },
    { n: "04", title: "Lead with material and construction specifics", body: "Queries like 'full-grain leather wallet', 'waxed canvas backpack' favor stores that specify materials and construction methods on product pages rather than vague 'premium quality' claims." },
    { n: "05", title: "Make your specialty obvious in every channel", body: "Stores known for a specific thing (minimalist wallets, technical daypacks) get cited more precisely. Breadth is a disadvantage when AI queries are specific." },
  ],
  watches: [
    { n: "01", title: "Get reviewed on Hodinkee or aBlogtoWatch", body: "Hodinkee is the single highest-authority source for watch AI queries. A brand or store mention here is the most valuable citation possible. aBlogtoWatch, Time+Tide, and Worn & Wound are strong alternatives." },
    { n: "02", title: "Build presence in r/Watches and WatchSeek forums", body: "r/Watches is heavily indexed. Organic store recommendations in 'where to buy' threads and brand reputation discussions generate consistent AI mentions with high specificity." },
    { n: "03", title: "Target 'best watches under $X' editorial content", body: "AI watch queries are extremely price-bracket specific. Getting your store or brand featured in '10 best watches under $500' articles is the most targeted content type for our query set." },
    { n: "04", title: "Make movement and specification detail a priority", body: "Watch queries include technical terms: 'automatic movement', 'sapphire crystal', 'ETA calibre'. Product pages that include this language match the queries precisely." },
    { n: "05", title: "Pursue watch media across all tiers", body: "Beyond Hodinkee, dozens of mid-tier watch blogs publish brand reviews that are indexed by AI. Getting into 10 mid-tier reviews is often more durable than chasing one top placement." },
  ],
  "outdoor-camping": [
    { n: "01", title: "Get tested by Wirecutter or Outside Magazine", body: "These are the primary AI sources for camping and outdoor gear queries. A Wirecutter 'best camping stove' or Outside 'best tent' pick with your store or brand cited is the highest-leverage action." },
    { n: "02", title: "Build presence in r/CampingGear and r/ultralight", body: "These subreddits are extensively indexed for outdoor gear queries. Organic store recommendations in gear review and 'where to buy' threads generate consistent AI citation." },
    { n: "03", title: "Get listed in REI comparison and alternative content", body: "AI often frames queries as 'alternatives to REI' or 'like REI but smaller'. Appearing in editorial content that compares independent outdoor retailers to REI puts you directly in that query context." },
    { n: "04", title: "Lead with gear specifications and use-case matching", body: "Outdoor queries are specific: '3-season backpacking tent', 'ultralight sleeping pad'. Product pages with weight, temperature rating, and use-case details match precisely." },
    { n: "05", title: "Target hiking and adventure travel blogs", body: "Outdoor adventure blogs publish gear roundups that are indexed by AI. Getting your store into '10 best places to buy camping gear' posts from a dozen mid-tier blogs creates cumulative mention weight." },
  ],
  "tech-accessories": [
    { n: "01", title: "Get featured in Wirecutter or The Verge reviews", body: "Wirecutter and The Verge are the top-indexed tech product sources. A store mention in any category review is extremely high-signal. CNET and Tom's Guide are strong secondary sources." },
    { n: "02", title: "Build presence in r/battlestations and r/MechanicalKeyboards", body: "These subreddits dominate AI desk setup and accessories queries. Organic store recommendations in 'where did you get that' threads are indexed and cited frequently." },
    { n: "03", title: "Pursue MKBHD-tier YouTube review coverage", body: "Tech accessory YouTube reviews are indexed by AI. A product review from a significant tech YouTuber with your store name mentioned creates durable, indexed content." },
    { n: "04", title: "Make compatibility and specs explicit", body: "Queries are highly specific: 'USB-C hub for MacBook Pro', 'MagSafe compatible wallet'. Product pages that specify device compatibility and technical specs match these queries precisely." },
    { n: "05", title: "Target setup-focused editorial content", body: "Articles like 'best home office setup accessories' or 'best desk accessories for productivity' are primary sources for AI. Getting your store cited in this content type is directly on-query." },
  ],
  jewelry: [
    { n: "01", title: "Get featured in Brides, Vogue, or The Knot jewelry guides", body: "AI jewelry queries heavily source from wedding and lifestyle editorial. A placement in Brides 'best engagement ring stores' or Vogue jewelry roundup with your domain cited is the highest-leverage action." },
    { n: "02", title: "Build presence in r/Jewelry and r/Diamonds", body: "These subreddits are indexed for jewelry queries. Organic recommendations in 'where to buy' and 'good jeweler online' threads are picked up directly by AI models." },
    { n: "03", title: "Earn gem lab certification context (GIA, IGI)", body: "AI jewelry queries include trust and certification context. Stores that sell GIA or IGI certified stones and make this explicit appear in quality-focused shopping queries significantly more." },
    { n: "04", title: "Create content around stone education and comparison", body: "Queries include 'best place to buy diamond online', 'moissanite vs diamond where to buy'. Stores with educational content about gem quality, cuts, and comparisons match these queries." },
    { n: "05", title: "Pursue engagement and anniversary gift guide editorial", body: "Gift guide editorial is a primary AI source. Getting your store into 'best jewelry gifts for her' or 'top online jewelry stores for engagement rings' posts creates lasting citation signal." },
  ],
  "baby-kids": [
    { n: "01", title: "Get listed on Babylist registry recommendations", body: "Babylist is the highest-authority baby product source for AI. Getting your products recommended on Babylist, or appearing in 'what to add to Babylist' content, places you directly in the query context." },
    { n: "02", title: "Build presence in r/beyondthebump and r/BabyBumps", body: "These subreddits are the primary community source for baby product queries. Organic store recommendations in 'what do you actually use' threads carry strong AI citation weight." },
    { n: "03", title: "Get featured in BabyCenter or What to Expect editorial", body: "These are the most-indexed parenting content sites. A store mention in a 'best baby products' or 'where to shop for baby' article is extremely durable." },
    { n: "04", title: "Lead with safety certifications and materials transparency", body: "Queries about baby products heavily include safety context: 'non-toxic baby toys', 'BPA-free'. Stores that lead with certifications and material safety information appear in those queries." },
    { n: "05", title: "Target mom blog and parenting influencer coverage", body: "Parenting blogs and influencer content is extensively indexed. Getting your store recommended in a 'my favorite places to shop for baby' post from a mid-tier parenting blog creates cumulative AI citations." },
  ],
  "stationery-gifts": [
    { n: "01", title: "Get featured in The Strategist or The Cut gift guides", body: "The Strategist is the single most-cited gift recommendation source in AI training data. A gift guide placement here is the highest-leverage action for stationery and gift stores." },
    { n: "02", title: "Build presence in r/Journaling, r/pens, and r/fountainpens", body: "These subreddits are heavily indexed for stationery queries. Organic store recommendations in 'where to buy' threads and product reviews generate consistent AI mention volume." },
    { n: "03", title: "Pursue Wirecutter and gift editorial placements", body: "Wirecutter publishes gift guides that are extensively indexed. Getting your store into 'best gifts for writers' or 'best stationery stores' editorial creates lasting citation signal." },
    { n: "04", title: "Make gifting the primary frame in your content", body: "Many of our queries include gifting context. Stores that explicitly frame products as gifts (occasion-based landing pages, gift sets, gift wrapping) match those queries more precisely." },
    { n: "05", title: "Target niche stationery review blogs", body: "The Goulet Pen Company blog, Pen Addict, and similar niche stationery media are indexed by AI. Getting reviewed in these communities carries high specificity for stationery queries." },
  ],
  "dog-supplies": [
    { n: "01", title: "Build presence in r/dogs and r/DogAdvice", body: "These subreddits are the primary AI source for dog supply queries. Organic store recommendations in 'where do you buy your dog food' or 'best dog collar brand' threads are directly cited by AI." },
    { n: "02", title: "Get coverage in Whole Dog Journal or The Spruce Pets", body: "These are the highest-authority editorial sources for dog product queries. A store or product review with your domain cited in Whole Dog Journal or Spruce Pets is extremely high-signal." },
    { n: "03", title: "Get veterinarian blog and PetMD citations", body: "AI dog queries often include vet-recommended context. Being cited or mentioned by veterinarian bloggers or on PetMD as an example store for quality products is very high-authority signal." },
    { n: "04", title: "Lead with ingredient quality and sourcing content", body: "Dog food queries include 'grain-free', 'limited ingredient', 'human-grade' terms. Stores that explain ingredient sourcing and quality philosophy on product pages match these queries precisely." },
    { n: "05", title: "Earn Chewy alternative positioning in editorial", body: "AI queries often include 'alternatives to Chewy' context. Appearing in editorial comparisons of independent pet stores vs. Chewy places you directly in those query results." },
  ],
  "spirits-cocktails": [
    { n: "01", title: "Get reviewed on Difford's Guide or Punch Drink", body: "These are the two highest-authority cocktail editorial sources indexed by AI. A store or product feature with your domain cited in Difford's Guide or Punch is the most effective single action." },
    { n: "02", title: "Build presence in r/cocktails and r/cocktailrecipes", body: "These subreddits are the primary community source for cocktail ingredient and spirits queries. Organic 'where to buy' recommendations and ingredient reviews generate consistent AI mention volume." },
    { n: "03", title: "Pursue Tales of the Cocktail and bar industry editorial", body: "Trade industry coverage (Tales of the Cocktail, Imbibe Magazine, Bar Business) is indexed by AI for professional-context queries. Getting featured positions you in both consumer and trade query contexts." },
    { n: "04", title: "Create cocktail recipe content featuring your products", body: "Queries like 'best bitters for old fashioned' or 'craft syrup for cocktails' favor stores with recipe content. Blog posts pairing your products with specific cocktails match these queries precisely." },
    { n: "05", title: "List products in spirits and cocktail directories", body: "Sites like The Whisky Exchange, Master of Malt, and cocktail ingredient directories are indexed. Distributing through or being listed alongside these destinations adds cumulative AI mention weight." },
  ],
  "bedding-towels": [
    { n: "01", title: "Get tested by Wirecutter or Sleep Foundation", body: "Wirecutter's bedding reviews and Sleep Foundation's brand comparisons are the most-cited sources in AI bedding queries. A tested and reviewed placement is the single highest-leverage action." },
    { n: "02", title: "Build presence in r/BuyItForLife for bedding recommendations", body: "r/BuyItForLife is heavily indexed for quality-focused bedding queries. Organic store recommendations for long-lasting sheets and towels in this community generate strong AI citation." },
    { n: "03", title: "Earn Apartment Therapy and Good Housekeeping placements", body: "These home editorial sources are primary AI training data for bedding queries. A 'best bed sheets' or 'best towels' placement with your store domain cited creates lasting mentions." },
    { n: "04", title: "Lead with thread count, material, and durability specifics", body: "Queries include 'percale vs sateen sheets', 'long-staple cotton towels', '300 thread count'. Stores with explicit material and weave details on product pages match these queries precisely." },
    { n: "05", title: "Pursue gifting editorial content", body: "Bedding is a major gift category. Getting into 'best housewarming gifts' or 'luxury bed sheet gift' editorial content taps into a query set that runs parallel to our daily queries." },
  ],
};

const GENERIC_TIPS: Tip[] = [
  { n: "01", title: "Use natural, question-style language on your site", body: "AI models surface stores whose content answers shopping questions directly. Pages that contain phrases like 'best [category] for [use case]' match the queries we ask - and what real shoppers ask AI." },
  { n: "02", title: "Get coverage on authoritative review sites", body: "AI recommendations are heavily influenced by editorial content from sites like Wirecutter, Good Housekeeping, Reddit r/BuyItForLife, and Trustpilot. A single placement on a high-authority review page can add significantly more mentions than any on-site change." },
  { n: "03", title: "Build a strong Reddit and community presence", body: "AI models trained on web data over-index on Reddit, Quora, and niche forums. Getting organically recommended in threads like 'where to buy X' is extremely high-signal." },
  { n: "04", title: "Make your domain easy to cite", body: "Short, memorable domains get cited more often in AI responses. Ensure your store name and domain are consistent across all channels." },
  { n: "05", title: "Earn press coverage with your domain in the URL", body: "AI training data favors sites that are cited by name in news articles and blog posts. A Forbes, Business Insider, or trade publication mention with your domain name can meaningfully boost how often AI surfaces you." },
];

function getTips(categorySlug: string | undefined): Tip[] {
  if (!categorySlug) return GENERIC_TIPS;
  return CATEGORY_TIPS[categorySlug] ?? GENERIC_TIPS;
}

function MomentumBadge({ m }: { m: "up" | "down" | "flat" | "new" }) {
  if (m === "up")   return <span style={{ color: "var(--lb-green)",  fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>↑ up</span>;
  if (m === "down") return <span style={{ color: "var(--lb-red)",    fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>↓ down</span>;
  if (m === "new")  return <span style={{ color: "var(--lb-azure)",  fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>★ new</span>;
  return <span style={{ color: "var(--lb-fg-4)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>— flat</span>;
}

function TrendChart({ trend }: { trend: Array<{ date: string; mentions: number }> }) {
  if (trend.length < 2) return null;
  const w = 600, h = 120, pad = { t: 12, r: 8, b: 28, l: 36 };
  const max = Math.max(...trend.map((t) => t.mentions), 1);
  const coords = trend.map((t, i) => ({
    x: pad.l + (i / (trend.length - 1)) * (w - pad.l - pad.r),
    y: pad.t + (1 - t.mentions / max) * (h - pad.t - pad.b),
    ...t,
  }));
  const linePts = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath = [`M ${coords[0].x},${h - pad.b}`, ...coords.map((c) => `L ${c.x},${c.y}`), `L ${coords[coords.length - 1].x},${h - pad.b}`, "Z"].join(" ");
  const yTicks = [0, Math.round(max / 2), max];

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="store-trend-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lb-azure)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--lb-azure)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Y axis ticks */}
      {yTicks.map((v) => {
        const y = pad.t + (1 - v / max) * (h - pad.t - pad.b);
        return (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--lb-border)" strokeWidth={0.5} />
            <text x={pad.l - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="var(--lb-fg-4)" fontFamily="'JetBrains Mono', monospace">{v}</text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#store-trend-grad)" />
      <polyline points={linePts} fill="none" stroke="var(--lb-azure)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="var(--lb-azure)" />
      ))}
      {/* X axis date labels — first, middle, last */}
      {[0, Math.floor(trend.length / 2), trend.length - 1].map((i) => (
        <text key={i} x={coords[i].x} y={h - 4} textAnchor="middle" fontSize={9} fill="var(--lb-fg-4)" fontFamily="'JetBrains Mono', monospace">
          {new Date(trend[i].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}

function StorePage() {
  const { domain, brandName, rankings, trend, totalMentions, peakWeekMentions, currentWeekMentions, overallShareOfVoice, leaderDomain, visibilityScore } = Route.useLoaderData();

  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  if (rankings.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="text-fg-muted text-sm mb-2">{domain} hasn't appeared in AI recommendations yet.</p>
        <Link to="/" className="text-primary text-sm hover:underline">← Back to leaderboard</Link>
      </div>
    );
  }

  const topRank = Math.min(...rankings.map((r) => r.rank));
  const topCategory = rankings.find((r) => r.rank === topRank);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src={logoUrl}
          alt={domain}
          className="w-12 h-12 border border-border"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <div>
          {brandName && (
            <h1 className="text-2xl font-semibold text-fg leading-tight">{brandName}</h1>
          )}
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-fg-muted hover:text-primary transition-colors"
          >
            {brandName ? domain : <span className="text-2xl font-semibold text-fg">{domain}</span>}
            {brandName && " →"}
          </a>
        </div>
      </div>

      {/* Visibility score + vs leader */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {/* Visibility score */}
        <div style={{ border: "1px solid var(--lb-border)", padding: "20px 20px 16px", background: "var(--lb-bg-1)" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Visibility score</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 40, color: "var(--lb-fg)", letterSpacing: "-0.04em", lineHeight: 1 }}>{visibilityScore}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--lb-fg-3)" }}>/100</span>
          </div>
          <div style={{ height: 4, background: "var(--lb-bg-3)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${visibilityScore}%`, background: visibilityScore >= 60 ? "var(--lb-green)" : visibilityScore >= 30 ? "var(--lb-azure)" : "var(--lb-amber)" }} />
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-4)", marginTop: 6 }}>Based on rank, reach & mention volume</p>
        </div>

        {/* vs leader */}
        <div style={{ border: "1px solid var(--lb-border)", padding: "20px 20px 16px", background: "var(--lb-bg-1)" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>vs. overall leader</p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 40, color: "var(--lb-fg)", letterSpacing: "-0.04em", lineHeight: 1 }}>{overallShareOfVoice}%</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>share of voice</span>
          </div>
          <div style={{ height: 4, background: "var(--lb-bg-3)", position: "relative", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${overallShareOfVoice}%`, background: "var(--lb-azure)" }} />
          </div>
          {leaderDomain && leaderDomain !== domain && (
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-4)" }}>
              Leader: <Link to="/store/$domain" params={{ domain: leaderDomain }} style={{ color: "var(--lb-fg-3)", textDecoration: "none" }}>{leaderDomain}</Link>
            </p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-0 mb-10 border border-border">
        <div className="border-r border-border p-4">
          <p className="text-xs text-fg-muted mb-1">Best rank</p>
          <p className="text-2xl font-mono font-semibold text-fg">#{topRank}</p>
          <p className="text-xs text-fg-muted mt-0.5">{topCategory?.categoryName}</p>
        </div>
        <div className="border-r border-border p-4">
          <p className="text-xs text-fg-muted mb-1">Categories</p>
          <p className="text-2xl font-mono font-semibold text-fg">{rankings.length}</p>
        </div>
        <div className="border-r border-border p-4">
          <p className="text-xs text-fg-muted mb-1">Peak week</p>
          <p className="text-2xl font-mono font-semibold text-fg">{peakWeekMentions}</p>
          <p className="text-xs text-fg-muted mt-0.5">
            {currentWeekMentions < peakWeekMentions
              ? <span style={{ color: "var(--lb-amber)" }}>↓ {peakWeekMentions - currentWeekMentions} from peak</span>
              : currentWeekMentions > 0
              ? <span style={{ color: "var(--lb-green)" }}>at peak</span>
              : "-"}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-fg-muted mb-1">This week</p>
          <p className="text-2xl font-mono font-semibold text-fg">{currentWeekMentions}</p>
          <p className="text-xs text-fg-muted mt-0.5">mentions</p>
        </div>
      </div>

      {/* History chart */}
      {trend.length > 1 && (
        <div className="mb-10">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide">AI mention history</h2>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-4)" }}>{trend.length} runs</span>
          </div>
          <div className="border border-border" style={{ padding: "16px 12px 8px" }}>
            <TrendChart trend={trend} />
          </div>
        </div>
      )}

      {/* Rankings by category */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Rankings by category</h2>
        <div className="border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-fg/[0.02]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-fg-muted">Category</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Rank</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Share of voice</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Trend</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rankings.sort((a, b) => a.rank - b.rank).map((r) => (
                <tr key={r.categoryId} className="border-b border-border/50 last:border-0 hover:bg-fg/[0.02]">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/category/$slug"
                      params={{ slug: r.categorySlug }}
                      className="text-primary hover:underline"
                    >
                      {r.categoryName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-fg">#{r.rank}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                      <div style={{ width: 48, height: 4, background: "var(--lb-bg-3)", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${r.shareOfVoice}%`, background: r.shareOfVoice >= 80 ? "var(--lb-green)" : "var(--lb-azure)" }} />
                      </div>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-2)", minWidth: 28, textAlign: "right" }}>{r.shareOfVoice}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right"><MomentumBadge m={r.momentum} /></td>
                  <td className="px-4 py-2.5 text-right text-fg-muted text-xs">
                    {r.lastSeen ? new Date(r.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Competitors per category */}
      {rankings.some((r) => r.competitors.length > 0) && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">Competitors by category</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--lb-border)" }}>
            {rankings.filter((r) => r.competitors.length > 0).sort((a, b) => a.rank - b.rank).map((r) => (
              <div key={r.categoryId} style={{ padding: "14px 16px", borderBottom: "1px solid var(--lb-border-faint)", background: "var(--lb-bg)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <Link to="/category/$slug" params={{ slug: r.categorySlug }} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, color: "var(--lb-fg)", textDecoration: "none" }}>
                    {r.categoryName}
                  </Link>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-3)" }}>You: #{r.rank}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {r.competitors.map((c) => (
                    <Link key={c.domain} to="/store/$domain" params={{ domain: c.domain }} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-4)", width: 20 }}>#{c.rank}</span>
                      <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`} alt="" width={14} height={14} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--lb-fg-2)", flex: 1 }}>{c.domain}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-fg-4)" }}>{c.mentionCount} mentions</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* How to rank higher */}
      <div className="border border-border mb-6">
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--lb-border)", background: "var(--lb-bg-1)" }}>
          <h3 className="text-sm font-semibold text-fg">How to rank higher in {topCategory?.categoryName ?? "AI recommendations"}</h3>
          <p className="text-xs text-fg-muted mt-0.5">Practical steps to appear more often in AI shopping recommendations for this category.</p>
        </div>
        <div style={{ padding: "4px 0" }}>
          {getTips(topCategory?.categorySlug).map((tip) => (
            <div key={tip.n} style={{ display: "flex", gap: 16, padding: "14px 20px", borderBottom: "1px solid var(--lb-border-faint)" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--lb-fg-3)", fontWeight: 600, flexShrink: 0, paddingTop: 2 }}>{tip.n}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--lb-fg)", margin: "0 0 4px" }}>{tip.title}</p>
                <p style={{ fontSize: 12.5, color: "var(--lb-fg-2)", lineHeight: 1.55, margin: 0 }}>{tip.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ColdVerdict CTA */}
      <ColdVerdictCTA
        domain={domain}
        rank={topRank}
        categoryName={topCategory?.categoryName ?? "your category"}
        categorySlug={topCategory?.categorySlug ?? ""}
      />

      {/* Brand Monitor CTA */}
      <MonitorCTA domain={domain} brandName={brandName} />

      <div className="mt-6">
        <Link to="/" className="text-sm text-fg-muted hover:text-fg transition-colors">← Back to leaderboard</Link>
      </div>
    </div>
  );
}
