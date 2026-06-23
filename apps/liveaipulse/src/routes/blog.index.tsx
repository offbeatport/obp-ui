import { createFileRoute, Link } from "@tanstack/react-router";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const POSTS = [
  {
    slug: "which-shopify-categories-get-most-ai-mentions",
    title: "Which Shopify Categories Get the Most AI Mentions?",
    description: "We ran 105 shopping queries across 21 categories. Fashion led by a wide margin, but the results in Home & Garden surprised us. Full breakdown inside.",
    date: "2026-05-01",
    readTime: "3 min",
  },
  {
    slug: "shopify-seo-vs-ai-visibility",
    title: "Shopify SEO vs AI Visibility: What's Different",
    description: "Traditional SEO optimises for Google's crawler. AI visibility is different - it's about how often language models mention your store in conversational answers. Here's what actually moves the needle.",
    date: "2026-04-01",
    readTime: "5 min",
  },
  {
    slug: "how-ai-recommends-shopify-stores",
    title: "How AI Models Recommend Shopify Stores",
    description: "When someone asks an AI assistant where to buy a linen blazer, how does it decide which stores to mention? We break down the signals that drive AI shopping recommendations.",
    date: "2026-03-01",
    readTime: "4 min",
  },
  {
    slug: "why-some-shopify-stores-dominate-ai-recommendations",
    title: "Why Some Shopify Stores Dominate AI Recommendations",
    description: "A handful of stores appear in AI answers again and again. Others never show up at all. We looked at the patterns across 6 months of data to understand what separates them.",
    date: "2026-02-04",
    readTime: "5 min",
  },
  {
    slug: "reddit-influence-on-ai-shopping",
    title: "Reddit Is Quietly Shaping AI Shopping Recommendations",
    description: "r/malefashionadvice, r/BuyItForLife, r/SkincareAddiction. These communities have an outsized influence on which stores AI recommends - and most Shopify merchants have no idea.",
    date: "2026-01-08",
    readTime: "4 min",
  },
  {
    slug: "how-reviews-shape-ai-shopping-answers",
    title: "How Review Platforms Shape AI Shopping Answers",
    description: "Trustpilot, Google Reviews, Yotpo, Bazaarvoice. AI models absorb review content as part of their training data. Here's how your review ecosystem affects what AI says about your store.",
    date: "2025-12-02",
    readTime: "4 min",
  },
  {
    slug: "ai-shopping-vs-google-shopping",
    title: "AI Shopping Queries vs Google Shopping: Key Differences",
    description: "When someone asks Google vs asking Claude the same shopping question, the answer - and the stores recommended - are often completely different. Here's why.",
    date: "2025-11-11",
    readTime: "5 min",
  },
  {
    slug: "your-shopify-stores-training-data-footprint",
    title: "Your Shopify Store's Training Data Footprint",
    description: "Every mention of your store across the web contributes to how AI models understand you. Some stores have thousands of training signal data points. Others have almost none.",
    date: "2025-10-07",
    readTime: "3 min",
  },
];

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog - AI Shopping Rankings | LiveAIPulse" },
      { name: "description", content: "Insights on AI-driven shopping recommendations, Shopify store visibility, and how AI models choose which brands to mention." },
      { property: "og:title", content: "Blog - LiveAIPulse" },
      { property: "og:description", content: "Insights on AI-driven shopping recommendations and Shopify store visibility." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: "https://liveaipulse.com/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-azure)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
          Blog
        </p>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 32, color: "var(--lb-fg)", margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          AI Shopping Insights
        </h1>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 16, margin: 0, lineHeight: 1.6 }}>
          How language models recommend stores, what drives AI visibility, and what the data shows.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 1, border: "1px solid var(--lb-border)" }}>
        {POSTS.map((post, i) => (
          <Link
            key={post.slug}
            to="/blog/$slug"
            params={{ slug: post.slug }}
            style={{
              display: "block",
              padding: "28px 24px",
              background: "var(--lb-bg)",
              borderBottom: i < POSTS.length - 1 ? "1px solid var(--lb-border)" : "none",
              textDecoration: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>{formatDate(post.date)}</span>
              <span style={{ width: 3, height: 3, background: "var(--lb-border-strong)", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>{post.readTime} read</span>
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: "var(--lb-fg)", margin: "0 0 8px", lineHeight: 1.3 }}>
              {post.title}
            </h2>
            <p style={{ color: "var(--lb-fg-2)", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
              {post.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
