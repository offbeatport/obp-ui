import { createFileRoute } from "@tanstack/react-router";

const STATIC_PAGES = [
  { url: "https://liveaipulse.com/", priority: "1.0", changefreq: "weekly" },
  { url: "https://liveaipulse.com/how-it-works", priority: "0.8", changefreq: "monthly" },
  { url: "https://liveaipulse.com/best-ai-recommended-shopify-stores", priority: "0.9", changefreq: "weekly" },
  { url: "https://liveaipulse.com/blog", priority: "0.8", changefreq: "weekly" },
  { url: "https://liveaipulse.com/blog/how-ai-recommends-shopify-stores", priority: "0.7", changefreq: "monthly" },
  { url: "https://liveaipulse.com/blog/shopify-seo-vs-ai-visibility", priority: "0.7", changefreq: "monthly" },
  { url: "https://liveaipulse.com/blog/which-shopify-categories-get-most-ai-mentions", priority: "0.7", changefreq: "monthly" },
  { url: "https://liveaipulse.com/monitor", priority: "0.6", changefreq: "monthly" },
  { url: "https://liveaipulse.com/privacy", priority: "0.3", changefreq: "yearly" },
  { url: "https://liveaipulse.com/terms", priority: "0.3", changefreq: "yearly" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { db } = await import("../db/client");
        const { categories, rankings } = await import("../db/schema");
        const { desc } = await import("drizzle-orm");

        const cats = await db.select().from(categories);
        const topDomains = await db
          .select({ domain: rankings.domain })
          .from(rankings)
          .orderBy(desc(rankings.mentionCount))
          .limit(500);

        const uniqueDomains = [...new Set(topDomains.map((r) => r.domain))];

        const today = new Date().toISOString().split("T")[0];

        const urls = [
          ...STATIC_PAGES.map(
            (p) => `  <url><loc>${p.url}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
          ),
          ...cats.map(
            (c) => `  <url><loc>https://liveaipulse.com/category/${c.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${today}</lastmod></url>`
          ),
          ...uniqueDomains.map(
            (d) => `  <url><loc>https://liveaipulse.com/store/${d}</loc><changefreq>weekly</changefreq><priority>0.6</priority><lastmod>${today}</lastmod></url>`
          ),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
  component: () => null,
} as any);
