import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button } from "@offbeatport/ui/ui/button";
import { Input } from "@offbeatport/ui/ui/input";
import { useState } from "react";

const getCategoryData = createServerFn()
  .handler(async ({ data: slug }: { data: string }) => {
    const { db } = await import("../db/client");
    const { categories, rankings } = await import("../db/schema");
    const { eq, desc } = await import("drizzle-orm");

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) throw new Error("Category not found");

    const topRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.categoryId, category.id))
      .orderBy(desc(rankings.mentionCount))
      .limit(50);

    return {
      category,
      rankings: topRankings.map((r) => ({
        id: r.id,
        domain: r.domain,
        mentionCount: r.mentionCount,
        lastSeen: r.lastSeen,
      })),
    };
  });

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => getCategoryData({ data: params.slug }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.category.name} - AI Shopping Rankings | LiveAIPulse` },
      { name: "description", content: `See which ${loaderData?.category.name} stores AI recommends most. Updated weekly across 21 shopping categories.` },
      { property: "og:title", content: `${loaderData?.category.name} - AI Shopping Rankings | LiveAIPulse` },
      { property: "og:description", content: `See which ${loaderData?.category.name} stores AI recommends most. Updated weekly.` },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: `https://liveaipulse.com/category/${loaderData?.category.slug}` }],
    scripts: loaderData ? [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Dataset",
        name: `${loaderData.category.name} AI Shopping Rankings`,
        description: `Weekly AI recommendation rankings for ${loaderData.category.name} stores, tracked by LiveAIPulse.`,
        url: `https://liveaipulse.com/category/${loaderData.category.slug}`,
        creator: { "@type": "Organization", name: "LiveAIPulse", url: "https://liveaipulse.com" },
        temporalCoverage: new Date().getFullYear().toString(),
      }),
    }] : [],
  }),
  component: CategoryPage,
});

function AlertForm({ category }: { category: string }) {
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

  if (submitted) return <p className="text-sm text-green-600">You're subscribed to {category} ranking updates.</p>;

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1"
      />
      <Button
        type="submit"
        variant="primary"
        disabled={loading || !email}
      >
        {loading ? "..." : "Notify me"}
      </Button>
    </form>
  );
}

function CategoryPage() {
  const { category, rankings } = Route.useLoaderData();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm text-fg-muted hover:text-fg transition-colors">← All categories</Link>
        <h1 className="text-2xl font-semibold text-fg mt-4 mb-1">{category.name}</h1>
        <p className="text-sm text-fg-muted">
          Stores most recommended by AI. Updated daily.
        </p>
      </div>

      {rankings.length === 0 ? (
        <div className="py-16 text-center border border-border">
          <p className="text-fg-muted text-sm">No rankings yet - check back after the first run.</p>
        </div>
      ) : (
        <div className="border border-border mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-fg/[0.02]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-fg-muted w-12">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-fg-muted">Store</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Mentions</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-fg-muted">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((r, i) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-fg/[0.02] transition-colors">
                  <td className="px-4 py-2.5 text-fg-muted font-mono">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${r.domain}&sz=32`}
                        alt=""
                        className="w-4 h-4 flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <Link
                        to="/store/$domain"
                        params={{ domain: r.domain }}
                        className="text-primary hover:underline font-medium"
                      >
                        {r.domain}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-fg">{r.mentionCount}</td>
                  <td className="px-4 py-2.5 text-right text-fg-muted text-xs">
                    {r.lastSeen ? new Date(r.lastSeen).toLocaleDateString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border border-border p-5">
        <h3 className="text-sm font-semibold text-fg mb-1">Get weekly {category.name} rankings</h3>
        <p className="text-xs text-fg-muted mb-4">We'll email you when the {category.name} rankings update.</p>
        <AlertForm category={category.name} />
      </div>
    </div>
  );
}
