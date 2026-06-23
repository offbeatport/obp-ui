import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getTopStores = createServerFn().handler(async () => {
  const { db } = await import("../db/client");
  const { rankings } = await import("../db/schema");
  const { desc } = await import("drizzle-orm");

  const top = await db
    .select({ domain: rankings.domain, mentionCount: rankings.mentionCount })
    .from(rankings)
    .orderBy(desc(rankings.mentionCount))
    .limit(20);

  const unique = Object.values(
    top.reduce((acc, r) => {
      if (!acc[r.domain]) acc[r.domain] = { domain: r.domain, mentionCount: 0 };
      acc[r.domain].mentionCount += r.mentionCount;
      return acc;
    }, {} as Record<string, { domain: string; mentionCount: number }>)
  ).sort((a, b) => b.mentionCount - a.mentionCount).slice(0, 10);

  return unique;
});

export const Route = createFileRoute("/best-ai-recommended-shopify-stores")({
  loader: () => getTopStores(),
  head: () => ({
    meta: [
      { title: "Best AI-Recommended Shopify Stores (2026) | LiveAIPulse" },
      { name: "description", content: "Which Shopify stores do AI assistants recommend most? See the top stores across fashion, electronics, beauty, and more - updated weekly." },
      { property: "og:title", content: "Best AI-Recommended Shopify Stores (2026)" },
      { property: "og:description", content: "Which Shopify stores do AI assistants recommend most? Updated weekly data across 21 shopping categories." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://liveaipulse.com/best-ai-recommended-shopify-stores" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Best AI-Recommended Shopify Stores",
        description: "Weekly rankings of Shopify stores most recommended by AI shopping assistants.",
        url: "https://liveaipulse.com/best-ai-recommended-shopify-stores",
        publisher: { "@type": "Organization", name: "LiveAIPulse", url: "https://liveaipulse.com" },
      }),
    }],
  }),
  component: BestStoresPage,
});

function BestStoresPage() {
  const stores = Route.useLoaderData();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-azure)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          Updated weekly · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, color: "var(--lb-fg)", margin: "0 0 16px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          Best AI-Recommended Shopify Stores
        </h1>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 16, margin: "0 0 12px", lineHeight: 1.6 }}>
          When shoppers ask AI assistants like ChatGPT, Claude, or Gemini for shopping recommendations, these are the stores that appear most often. Data from {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
        </p>
        <p style={{ color: "var(--lb-fg-3)", fontSize: 13, margin: 0 }}>
          Based on 105 shopping queries across 21 categories, run weekly.
        </p>
      </div>

      {stores.length > 0 ? (
        <div style={{ border: "1px solid var(--lb-border)" }}>
          {stores.map((store, i) => (
            <Link
              key={store.domain}
              to="/store/$domain"
              params={{ domain: store.domain }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 20px",
                borderBottom: i < stores.length - 1 ? "1px solid var(--lb-border)" : "none",
                textDecoration: "none",
                background: "var(--lb-bg)",
              }}
            >
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: "var(--lb-fg-3)", width: 28, flexShrink: 0 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <img
                src={`https://www.google.com/s2/favicons?domain=${store.domain}&sz=32`}
                alt=""
                width={20}
                height={20}
                style={{ flexShrink: 0 }}
              />
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: 15, color: "var(--lb-fg)", flex: 1 }}>
                {store.domain}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--lb-fg-3)" }}>
                {store.mentionCount} mentions
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ padding: "48px 24px", textAlign: "center", border: "1px dashed var(--lb-border-strong)", color: "var(--lb-fg-2)" }}>
          Rankings are being generated. Check back soon.
        </div>
      )}

      <div style={{ marginTop: 40, padding: "24px", background: "var(--lb-bg-1)", border: "1px solid var(--lb-border)" }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "var(--lb-fg)", margin: "0 0 8px" }}>
          How these rankings work
        </h2>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 14, margin: "0 0 16px", lineHeight: 1.6 }}>
          Every week, LiveAIPulse runs 105 standardised shopping queries across 21 categories through AI models and counts how often each store appears in the answers. The stores above have the highest total mention counts across all categories.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link to="/" style={{ fontSize: 13, color: "var(--lb-azure)", textDecoration: "none", fontWeight: 500 }}>
            View full leaderboard →
          </Link>
          <Link to="/how-it-works" style={{ fontSize: 13, color: "var(--lb-fg-2)", textDecoration: "none" }}>
            Methodology
          </Link>
          <Link to="/blog" style={{ fontSize: 13, color: "var(--lb-fg-2)", textDecoration: "none" }}>
            Read the blog
          </Link>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: "var(--lb-fg)", margin: "0 0 12px" }}>
          Browse by category
        </h2>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 14, margin: "0 0 16px" }}>
          See AI recommendations broken down by product category.
        </p>
        <Link to="/" style={{ fontSize: 13, color: "var(--lb-azure)", textDecoration: "none", fontWeight: 500 }}>
          View all 21 categories →
        </Link>
      </div>
    </div>
  );
}
