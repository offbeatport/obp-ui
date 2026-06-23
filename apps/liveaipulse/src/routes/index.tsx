import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

type RankedDomain = {
  id: string;
  domain: string;
  brandName: string | null;
  mentionCount: number;
  lastSeen: string | null;
  sparkline: number[];
};

type CategoryWithRankings = {
  id: string;
  name: string;
  slug: string;
  rankings: RankedDomain[];
};

const getLeaderboard = createServerFn().handler(async () => {
  const { db } = await import("../db/client");
  const { categories, rankings, domainSnapshots, runs, domainNames } = await import("../db/schema");
  const { eq, desc, inArray } = await import("drizzle-orm");
  const { getRankingsLimit } = await import("../lib/settings");
  const limit = await getRankingsLimit();

  const cats = await db.select().from(categories);

  // Fetch last 10 completed runs for sparklines
  const recentRuns = await db
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.status, "done"))
    .orderBy(desc(runs.createdAt))
    .limit(10);
  const runIds = recentRuns.map((r) => r.id).reverse(); // oldest first

  // Fetch all snapshots for those runs in one query
  const allSnapshots = runIds.length > 0
    ? await db.select().from(domainSnapshots).where(inArray(domainSnapshots.runId, runIds))
    : [];

  // Build map: domain -> runId -> mentionCount
  const snapMap: Record<string, Record<string, number>> = {};
  for (const s of allSnapshots) {
    if (!snapMap[s.domain]) snapMap[s.domain] = {};
    snapMap[s.domain][s.runId] = (snapMap[s.domain][s.runId] ?? 0) + s.mentionCount;
  }

  const result: CategoryWithRankings[] = await Promise.all(
    cats.map(async (cat) => {
      const topRankings = await db
        .select()
        .from(rankings)
        .where(eq(rankings.categoryId, cat.id))
        .orderBy(desc(rankings.mentionCount))
        .limit(limit);

      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        rankings: topRankings.map((r) => ({
          id: r.id,
          domain: r.domain,
          mentionCount: r.mentionCount,
          lastSeen: r.lastSeen,
          sparkline: runIds.map((rid) => snapMap[r.domain]?.[rid] ?? 0),
        })),
      };
    }),
  );

  // Fetch all known brand names in one query
  const allNames = await db.select().from(domainNames);
  const brandNameMap: Record<string, string> = {};
  for (const n of allNames) brandNameMap[n.domain] = n.brandName;

  // Build category lookup: domain -> best category name (by total mentionCount)
  const domainBestCat: Record<string, { name: string; slug: string }> = {};
  for (const cat of result) {
    for (const r of cat.rankings) {
      if (!domainBestCat[r.domain] || r.mentionCount > (result.find((c) => c.slug === domainBestCat[r.domain]?.slug)?.rankings.find((x) => x.domain === r.domain)?.mentionCount ?? 0)) {
        domainBestCat[r.domain] = { name: cat.name, slug: cat.slug };
      }
    }
  }

  type MoverRow = { domain: string; brandName: string | null; delta: number; pctChange: number; current: number; sparkline: number[]; categoryName: string | null; categorySlug: string | null };

  const newThisWeek: MoverRow[] = [];
  const biggestMovers: MoverRow[] = [];
  const trending: MoverRow[] = [];

  if (runIds.length >= 2) {
    const lastId = runIds[runIds.length - 1];
    const prevId = runIds[runIds.length - 2];
    const domains = new Set(allSnapshots.map((s) => s.domain));

    for (const domain of domains) {
      const current = snapMap[domain]?.[lastId] ?? 0;
      const prev = snapMap[domain]?.[prevId] ?? 0;
      const delta = current - prev;
      const sparkline = runIds.map((rid) => snapMap[domain]?.[rid] ?? 0);
      const cat = domainBestCat[domain] ?? null;
      const row: MoverRow = { domain, brandName: brandNameMap[domain] ?? null, delta, pctChange: prev > 0 ? Math.round((delta / prev) * 100) : 0, current, sparkline, categoryName: cat?.name ?? null, categorySlug: cat?.slug ?? null };

      if (delta > 0) trending.push(row);

      const hadPrior = runIds.slice(0, -1).some((rid) => (snapMap[domain]?.[rid] ?? 0) > 0);
      if (current > 0 && !hadPrior) newThisWeek.push(row);

      if (prev > 0 && delta > 0) biggestMovers.push(row);
    }

    trending.sort((a, b) => b.delta - a.delta);
    trending.splice(20);
    newThisWeek.sort((a, b) => b.current - a.current);
    newThisWeek.splice(20);
    biggestMovers.sort((a, b) => b.delta - a.delta); // absolute delta, not %
    biggestMovers.splice(20);
  }


  // All domains for global search
  const allDomains = [...new Set(allSnapshots.map((s) => s.domain))].map((domain) => ({
    domain,
    brandName: brandNameMap[domain] ?? null,
    mentionCount: Object.values(snapMap[domain] ?? {}).reduce((s, v) => s + v, 0),
    sparkline: runIds.map((rid) => snapMap[domain]?.[rid] ?? 0),
  })).sort((a, b) => b.mentionCount - a.mentionCount);

  return {
    categories: result
      .filter((c) => c.rankings.length > 0)
      .map((c) => ({
        ...c,
        rankings: c.rankings.map((r) => ({ ...r, brandName: brandNameMap[r.domain] ?? null })),
      })),
    hasRuns: runIds.length > 0,
    trending,
    newThisWeek,
    biggestMovers,
    allDomains,
  };
});

export const Route = createFileRoute("/")({
  loader: () => getLeaderboard(),
  component: LeaderboardPage,
});

function hashColor(slug: string) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  const hues = [212, 28, 142, 268, 340, 168, 48, 312, 198, 8, 110, 240];
  return `oklch(0.56 0.14 ${hues[Math.abs(h) % hues.length]})`;
}

function faviconColor(domain: string) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) | 0;
  const hues = [212, 28, 142, 268, 340, 168, 48, 312, 198, 8, 110, 240];
  const hue = hues[Math.abs(h) % hues.length];
  return `oklch(0.56 0.14 ${hue})`;
}

function Favicon({ domain }: { domain: string }) {
  const letter = domain.replace(/^www\./, "").charAt(0).toUpperCase();
  const color = faviconColor(domain);
  return (
    <span
      className="domain-favicon"
      style={{ background: color }}
      aria-hidden
    >
      {letter}
    </span>
  );
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <span className="rank-delta up">↑{delta}</span>;
  if (delta < 0) return <span className="rank-delta down">↓{Math.abs(delta)}</span>;
  return <span className="rank-delta flat">-</span>;
}

function seededSparkline(domain: string): number[] {
  let h = 0;
  for (let i = 0; i < domain.length; i++) h = (h * 31 + domain.charCodeAt(i)) | 0;
  return Array.from({ length: 10 }, () => {
    h = (h * 1664525 + 1013904223) | 0;
    return 2 + (Math.abs(h) % 9);
  });
}

function Sparkline({ points, fake }: { points: number[]; fake?: boolean }) {
  if (!points.length) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const w = 120, h = 36;
  const pad = 4;
  const denom = points.length > 1 ? points.length - 1 : 1;
  const coords = points.map((v, i) => ({
    x: pad + (i / denom) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2 - 2),
  }));
  const linePts = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const areaPath = [
    `M ${coords[0].x},${h - pad}`,
    ...coords.map((c) => `L ${c.x},${c.y}`),
    `L ${coords[coords.length - 1].x},${h - pad}`,
    "Z",
  ].join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", opacity: fake ? 0.25 : 1 }}>
      <defs>
        <linearGradient id={`sg-${fake ? "f" : "r"}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--lb-azure)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--lb-azure)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${fake ? "f" : "r"})`} />
      <polyline
        points={linePts}
        fill="none"
        style={{ stroke: "var(--lb-azure)", strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }}
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill="var(--lb-azure)" />
    </svg>
  );
}

function AlertBar() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ borderBottom: "1px solid var(--lb-border)", background: "var(--lb-green-bg)", padding: "32px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "var(--lb-green)", margin: 0 }}>
          ✓ You're in. Rankings land every Monday morning.
        </p>
      </div>
    );
  }

  return (
    <div style={{ borderBottom: "1px solid var(--lb-border)", background: "var(--lb-bg-1)", padding: "40px 24px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, color: "var(--lb-fg)", margin: "0 0 8px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
          Get the weekly AI ranking update
        </h2>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 15, margin: "0 0 20px", lineHeight: 1.5 }}>
          Which stores moved up, which dropped, and what changed. Free, every Monday.
        </p>
        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{ flex: 1, height: 40, padding: "0 12px", background: "var(--lb-bg)", border: "1px solid var(--lb-border-strong)", color: "var(--lb-fg)", fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", minWidth: 0 }}
          />
          <button
            type="submit"
            disabled={loading || !email}
            style={{ height: 40, padding: "0 18px", background: "var(--lb-azure)", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading || !email ? 0.5 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
          >
            {loading ? "..." : "Subscribe"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LeaderboardPage() {
  const { categories, hasRuns, trending, newThisWeek, biggestMovers, allDomains } = Route.useLoaderData();
  const navigate = useNavigate();
  const [activeSlug, setActiveSlug] = useState("__new");
  const [catSearch, setCatSearch] = useState("");
  const [search, setSearch] = useState("");

  const allRankings = categories.flatMap((c) =>
    c.rankings.map((r) => ({ ...r, categoryName: c.name, categorySlug: c.slug }))
  );

  const isTrending   = activeSlug === "__trending";
  const isNew        = activeSlug === "__new";
  const isMovers     = activeSlug === "__movers";
  const isCompetitive = false;
  const isSearch     = activeSlug === "__search";
  const isSpecial    = isTrending || isNew || isMovers || isCompetitive || isSearch;

  const activeCategory = categories.find((c) => c.slug === activeSlug);

  const moversSource = isTrending ? trending : isNew ? newThisWeek : isMovers ? biggestMovers : [];

  const displayRows = isCompetitive || isSearch
    ? []
    : isSpecial
    ? moversSource.map((t) => ({ id: t.domain, domain: t.domain, brandName: t.brandName, mentionCount: t.current, lastSeen: null, sparkline: t.sparkline, delta: t.delta, pctChange: t.pctChange }))
    : activeSlug === "all"
    ? Object.values(
      allRankings.reduce((acc, r) => {
        if (!acc[r.domain]) acc[r.domain] = { ...r, mentionCount: 0 };
        acc[r.domain].mentionCount += r.mentionCount;
        return acc;
      }, {} as Record<string, typeof allRankings[0]>)
    ).sort((a, b) => b.mentionCount - a.mentionCount).map((r) => ({ ...r, delta: undefined, pctChange: undefined }))
    : (activeCategory?.rankings ?? []).map((r) => ({ ...r, delta: undefined, pctChange: undefined }));

  const searchQuery = search.toLowerCase();
  const searchResults = isSearch && searchQuery.length > 0
    ? allDomains.filter((d) => d.domain.includes(searchQuery) || (d.brandName ?? "").toLowerCase().includes(searchQuery)).slice(0, 20)
    : [];

  const filteredRows = isSearch
    ? searchResults.map((d) => ({ id: d.domain, domain: d.domain, brandName: d.brandName, mentionCount: d.mentionCount, lastSeen: null, sparkline: d.sparkline, delta: undefined, pctChange: undefined }))
    : search.length > 1
    ? displayRows.filter((r) => r.domain.includes(searchQuery) || (r.brandName ?? "").toLowerCase().includes(searchQuery))
    : displayRows;

  const maxMentions = filteredRows[0]?.mentionCount ?? 1;
  const totalStores = new Set(allRankings.map((r) => r.domain)).size;
  const totalMentions = allRankings.reduce((s, r) => s + r.mentionCount, 0);

  return (
    <>
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-grid-bg" />
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
          <div className="hero-inner">
            <div className="hero-eyebrow">
              21 categories · 105 queries
            </div>
            <h1 className="hero-title">
              Which Shopify stores does <em>AI recommend</em> most?
            </h1>
            <p className="hero-subtitle">
              Every day we run {categories.length > 0 ? "105" : "-"} shopping queries across 21 categories through AI models
              and count how often each store appears in the answers. Public, daily, no SEO required.
            </p>
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-label">Stores Tracked</div>
                <div className="hero-stat-value">
                  <span>{totalStores.toLocaleString()}</span>
                  {totalStores > 0 && <span className="hero-stat-delta">live</span>}
                </div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-label">Total Score</div>
                <div className="hero-stat-value">
                  <span>{totalMentions.toLocaleString()}</span>
                </div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-label">Queries / day</div>
                <div className="hero-stat-value">
                  <span>105</span>
                  <span className="hero-stat-delta neutral">21 cats</span>
                </div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-label">Categories live</div>
                <div className="hero-stat-value">
                  <span>{categories.length}</span>
                  <span className="hero-stat-delta neutral">/ 21</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AlertBar />

      {/* Category picker */}
      <div className="cat-picker">
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px" }}>
          <div className="cat-picker-head">
            <div className="cat-picker-label">
              Category
              <span className="cat-picker-meta">{categories.length + 1} total · pick one</span>
            </div>
            <div className="cat-picker-search">
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="4.5" /><path d="m11 11 3 3" />
              </svg>
              <input
                className="cat-picker-input"
                placeholder="Filter categories…"
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="cat-grid">
            {newThisWeek.length > 0 && (
              <button className={`cat-chip${isNew ? " active" : ""}`} onClick={() => { setActiveSlug("__new"); setSearch(""); }}>
                <span className="cat-chip-dot" style={{ background: "var(--lb-azure)" }} />
                <span className="cat-chip-name">New this week</span>
              </button>
            )}
            {trending.length > 0 && (
              <button className={`cat-chip${isTrending ? " active" : ""}`} onClick={() => { setActiveSlug("__trending"); setSearch(""); }}>
                <span className="cat-chip-dot" style={{ background: "var(--lb-green)" }} />
                <span className="cat-chip-name">Trending</span>
              </button>
            )}
            {biggestMovers.length > 0 && (
              <button className={`cat-chip${isMovers ? " active" : ""}`} onClick={() => { setActiveSlug("__movers"); setSearch(""); }}>
                <span className="cat-chip-dot" style={{ background: "var(--lb-amber)" }} />
                <span className="cat-chip-name">Biggest movers</span>
              </button>
            )}
            <button className={`cat-chip${isSearch ? " active" : ""}`} onClick={() => { setActiveSlug("__search"); }}>
              <span className="cat-chip-dot" style={{ background: "var(--lb-fg-4)" }} />
              <span className="cat-chip-name">Search</span>
            </button>
            <button
              className={`cat-chip${activeSlug === "all" ? " active" : ""}`}
              onClick={() => { setActiveSlug("all"); setSearch(""); }}
            >
              <span className="cat-chip-dot all" />
              <span className="cat-chip-name">All</span>
            </button>
            {categories
              .filter((c) => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))
              .map((cat) => (
                <button
                  key={cat.slug}
                  className={`cat-chip${activeSlug === cat.slug ? " active" : ""}`}
                  onClick={() => setActiveSlug(cat.slug)}
                >
                  <span className="cat-chip-dot" style={{ background: hashColor(cat.slug) }} />
                  <span className="cat-chip-name">{cat.name}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 24px 64px" }}>
        {/* Toolbar */}
        <div className="lb-toolbar">
          <div className="lb-toolbar-title">
            <h2>
              {isNew ? "New this week" : isTrending ? "Trending" : isMovers ? "Biggest movers" : isCompetitive ? "Most competitive" : isSearch ? "Search" : activeSlug === "all" ? "All categories" : (activeCategory?.name ?? "")}
            </h2>
            {!isSearch && !isCompetitive && (
              <span className="lb-toolbar-meta" style={{ marginLeft: 10 }}>
                {isNew ? `${filteredRows.length} new stores` : isTrending || isMovers ? `${filteredRows.length} stores` : `${filteredRows.length} stores · ${filteredRows.reduce((s, r) => s + r.mentionCount, 0)} score`}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isSearch ? "Type a domain or brand name…" : "Filter…"}
              autoFocus={isSearch}
              style={{ height: 30, width: isSearch ? 260 : 160, padding: "0 10px", background: "var(--lb-bg-1)", border: `1px solid ${isSearch ? "var(--lb-azure)" : "var(--lb-border-strong)"}`, color: "var(--lb-fg)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", transition: "width 0.15s, border-color 0.15s" }}
            />
          </div>
        </div>


        {/* Search empty prompt */}
        {isSearch && search.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 20px", border: "1px dashed var(--lb-border-strong)", background: "var(--lb-bg-1)", color: "var(--lb-fg-2)", fontSize: 14 }}>
            Type a domain or brand name to search across all tracked stores
          </div>
        )}

        {!isCompetitive && !(isSearch && search.length === 0) && filteredRows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "64px 20px", border: "1px dashed var(--lb-border-strong)", background: "var(--lb-bg-1)" }}>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, margin: "0 0 6px", color: "var(--lb-fg)" }}>
              {isNew ? "No new stores this week" : search ? "No results" : "Nothing here yet"}
            </p>
            <p style={{ color: "var(--lb-fg-2)", margin: 0, fontSize: 14 }}>
              {search ? `No stores matching "${search}"` : isNew || isTrending || isMovers ? "Run the weekly job to see movers." : "Start a run from the admin dashboard to populate rankings."}
            </p>
          </div>
        ) : !isCompetitive && !(isSearch && search.length === 0) && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>#</th>
                  <th>Brand</th>
                  <th style={{ width: "25%" }}>Domain</th>
                  {isMovers && <th style={{ width: 100 }}>Category</th>}
                  <th style={{ minWidth: 220 }}>{isNew || isTrending || isMovers ? "This week" : "AI Score"}</th>
                  {(isTrending || isNew || isMovers) && <th style={{ width: 80 }}>+Mentions</th>}
                  <th style={{ width: 148 }}>10-week trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, i) => {
                  const rank = i + 1;
                  const pct = Math.round((r.mentionCount / maxMentions) * 100);
                  const rankClass = rank === 1 ? "top1" : rank <= 3 ? "top3" : "";
                  const medal = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
                  const sparkPoints = (r.sparkline && r.sparkline.some((v) => v > 0))
                    ? r.sparkline
                    : null;
                  const fakePoints = seededSparkline(r.domain);
                  return (
                    <tr
                      key={r.domain}
                      onClick={() => navigate({ to: "/store/$domain", params: { domain: r.domain } })}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="td-inner">
                          <div className="rank-cell">
                            <span className={`rank-num${rankClass ? ` ${rankClass}` : ""}`}>
                              {rank}
                            </span>
                            {medal && <span className={`rank-medal ${medal}`} />}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="td-inner">
                          <div className="domain-cell">
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=32`}
                              alt=""
                              width={20}
                              height={20}
                              style={{ flexShrink: 0 }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).replaceWith(
                                  Object.assign(document.createElement("span"), {
                                    className: "domain-favicon",
                                    textContent: r.domain.charAt(0).toUpperCase(),
                                    style: `background:${faviconColor(r.domain)}`,
                                  })
                                );
                              }}
                            />
                            <span className="domain-name" style={{ fontWeight: 600 }}>
                              {r.brandName ?? r.domain}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td style={{ width: "25%" }}>
                        <div className="td-inner">
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.domain}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="td-inner">
                          <div className="mentions-bar">
                            <div className="mentions-bar-track">
                              <div
                                className="mentions-bar-fill"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="mentions-val">{r.mentionCount}</span>
                            <span className="mentions-pct">{pct}%</span>
                          </div>
                        </div>
                      </td>
                      {isMovers && (r as any).categorySlug && (
                        <td style={{ width: 100 }}>
                          <div className="td-inner">
                            <button onClick={(e) => { e.stopPropagation(); setActiveSlug((r as any).categorySlug); }} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--lb-azure)", background: "var(--lb-azure-soft)", border: "none", padding: "2px 6px", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 92 }}>
                              {(r as any).categoryName}
                            </button>
                          </div>
                        </td>
                      )}
                      {(isTrending || isNew || isMovers) && (
                        <td style={{ width: 80 }}>
                          <div className="td-inner">
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: "var(--lb-green)" }}>
                              +{(r as any).delta ?? (r as any).mentionCount}
                            </span>
                          </div>
                        </td>
                      )}
                      <td style={{ width: 148 }}>
                        <div className="td-inner">
                          {sparkPoints
                            ? <Sparkline points={sparkPoints} />
                            : <Sparkline points={fakePoints} fake />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="lb-methodology">
          <span>Score = total appearances across all runs. Each store counted once per query response.</span>
          <span>
            {activeSlug === "all"
              ? `All ${categories.length} categories · ${105} daily queries`
              : `${activeCategory?.name} · ${activeCategory?.rankings.length} stores ranked`}
          </span>
        </div>
      </div>
    </>
  );
}
