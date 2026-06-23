import { createFileRoute, Link, notFound } from "@tanstack/react-router";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const POSTS: Record<string, {
  title: string;
  description: string;
  date: string;
  readTime: string;
  content: Array<{ type: "p" | "h2" | "h3" | "ul"; text?: string; items?: string[] }>;
}> = {
  "how-ai-recommends-shopify-stores": {
    title: "How AI Models Recommend Shopify Stores",
    description: "When someone asks an AI assistant where to buy a linen blazer, how does it decide which stores to mention? We break down the signals that drive AI shopping recommendations.",
    date: "2026-03-01",
    readTime: "4 min",
    content: [
      { type: "p", text: "AI doesn't go shopping for you. When someone asks Claude or ChatGPT where to buy a linen blazer, the model isn't running a search - it's drawing on text it absorbed during training, which ended months or years ago. The store it mentions is the one that appeared most often, in the most credible places, in all the writing it ever read." },
      { type: "p", text: "That's a strange thing to sit with. Your ranking in AI search has almost nothing to do with what's on your website right now." },
      { type: "h2", text: "Repetition is the mechanism" },
      { type: "p", text: "If your store gets mentioned in a Byrdie roundup, a Reddit thread on r/femalefashionadvice, three Trustpilot reviews, and a sustainable fashion blog - each of those is a data point. The model saw all of them. It learned: this store = linen clothing = good. That association gets reinforced every time it appears in another piece of writing." },
      { type: "p", text: "The frustrating part is that you can't reverse-engineer this after the fact. Training data is frozen. You can't edit yourself into it. What you can do is generate the kind of writing that will be in the next training cycle - editorial placements, community mentions, review content that uses specific product language." },
      { type: "h2", text: "What we actually measure" },
      { type: "p", text: "Every week we run 105 shopping queries across 21 categories - five queries per category - and record which stores appear in the answers. It's not a perfect measure of anything, but it's a real-world proxy. If a store shows up in our queries, it's showing up in the queries real shoppers are typing too." },
      { type: "p", text: "The rankings change week to week as models update, which is why tracking matters. A store that barely appeared six months ago might be climbing now, and you'd have no idea without the data." },
    ],
  },
  "shopify-seo-vs-ai-visibility": {
    title: "Shopify SEO vs AI Visibility: What's Different",
    description: "Traditional SEO optimises for Google's crawler. AI visibility is different - it's about how often language models mention your store in conversational answers. Here's what actually moves the needle.",
    date: "2026-04-01",
    readTime: "5 min",
    content: [
      { type: "p", text: "Search engines rank pages. AI models mention brands. It sounds like a small distinction but it changes almost everything about how you'd approach either one." },
      { type: "p", text: "With SEO, you're trying to get a specific URL to rank for a specific query. Google re-crawls your site constantly. Change your title tag today, see a ranking shift next week. It's slow, but it's responsive. With AI visibility, you're trying to get your store name embedded in the training data of models that will only be updated periodically - and you have no visibility into when or how." },
      { type: "h2", text: "What actually moves the needle for AI" },
      { type: "p", text: "The things that most Shopify merchants spend their time on - product page copy, meta descriptions, page speed, internal linking - have essentially no effect on AI recommendations. The model doesn't visit your site. It doesn't care about your schema markup." },
      { type: "p", text: "What it does care about: how many independent sources mention you by name. A feature in Wirecutter is worth more than a thousand perfectly optimised product pages. A wiki entry in r/malefashionadvice moves the needle more than a full site redesign. The signals are entirely off-site." },
      { type: "h2", text: "One thing that transfers" },
      { type: "p", text: "Backlinks - not because they help AI directly, but because the publications that link to you are also the ones that write about you, and that writing ends up in training data. A strong backlink profile from authoritative niche publications tends to correlate with strong AI visibility, even though the mechanism is completely different." },
      { type: "p", text: "If you've been doing SEO for years and built good editorial relationships, you're probably already in a better AI position than you realise. The question is whether you're systematically tracking it." },
    ],
  },
  "which-shopify-categories-get-most-ai-mentions": {
    title: "Which Shopify Categories Get the Most AI Mentions?",
    description: "We ran 105 shopping queries across 21 categories. Fashion led by a wide margin, but the results in Home & Garden surprised us. Full breakdown inside.",
    date: "2026-05-01",
    readTime: "3 min",
    content: [
      { type: "p", text: "We expected fashion to lead. We didn't expect the gap to be this wide." },
      { type: "p", text: "Across 21 categories, women's clothing consistently produces the most diverse set of AI store recommendations - not just the most mentions, but the highest variety. AI has absorbed so much fashion writing that it knows dozens of stores across every sub-niche. Menswear is similar. Both categories have years of editorial infrastructure: magazines, style blogs, Reddit communities with well-maintained wikis." },
      { type: "h2", text: "The categories where almost nothing shows up" },
      { type: "p", text: "Home & Garden was the surprise. It's a huge e-commerce category by revenue - but ask AI for home goods store recommendations and you tend to get the same three or four household names. Niche home stores are nearly invisible. The same goes for bedding, outdoor camping gear, and stationery." },
      { type: "p", text: "Our read: these categories just haven't generated enough independent, quotable writing about specific stores. Pet supplies was similar - there are vocal communities online, but they tend to discuss products rather than recommend stores by domain name." },
      { type: "h2", text: "What concentration looks like in practice" },
      { type: "p", text: "In electronics and spirits, the top two or three stores capture nearly all AI mentions. In beauty and skincare, the field is more open - indie brands show up alongside major retailers, probably because beauty writing is review-heavy and very specific about brand names. If you're in a concentrated category, even a single Wirecutter mention might be enough to break in." },
      { type: "p", text: "If you're in a diverse category like fashion, the bar is higher but so is the ceiling. The stores at the top of our fashion rankings have built something real - and they're getting traffic from AI that their competitors aren't." },
    ],
  },
  "why-some-shopify-stores-dominate-ai-recommendations": {
    title: "Why Some Shopify Stores Dominate AI Recommendations",
    description: "A handful of stores appear in AI answers again and again. Others never show up at all. We looked at the patterns across 6 months of data to understand what separates them.",
    date: "2026-02-04",
    readTime: "5 min",
    content: [
      { type: "p", text: "Six months of data, and the same stores keep showing up at the top. Not always the same ones - the rankings do shift as models update - but a clear tier has emerged. Some stores appear in AI answers across multiple categories, consistently, week after week. Others with apparently similar products never appear at all." },
      { type: "p", text: "The difference isn't price point. It isn't product quality. It's almost entirely about how much independent writing exists about them on the internet." },
      { type: "h2", text: "Age is the variable nobody talks about" },
      { type: "p", text: "The strongest predictor we've found is how long a store has been online. Stores that launched before 2018 appear in AI recommendations far more often than stores launched after 2022, even in the same category. Training data rewards longevity in a way that Google doesn't - there's simply more text about older stores, accumulated over years of press coverage and community discussion." },
      { type: "p", text: "That's genuinely difficult news for newer stores. You can't buy your way into existing training data." },
      { type: "h2", text: "The citation feedback loop" },
      { type: "p", text: "What the dominant stores share isn't any one thing - it's a self-reinforcing cycle. A Wirecutter mention gets quoted in Reddit threads. Reddit threads get cited in blog posts. Blog posts attract more press. Each link in that chain adds to the model's signal. The stores at the top have been building this graph for years, often without any intention of influencing AI." },
      { type: "p", text: "The practical question for everyone else is how to compress that timeline. One authoritative editorial placement - not twenty SEO blog posts, one real placement in a publication that actually gets read and cited - can do more for your AI visibility than a year of on-site work." },
    ],
  },
  "reddit-influence-on-ai-shopping": {
    title: "Reddit Is Quietly Shaping AI Shopping Recommendations",
    description: "r/malefashionadvice, r/BuyItForLife, r/SkincareAddiction. These communities have an outsized influence on which stores AI recommends - and most Shopify merchants have no idea.",
    date: "2026-01-08",
    readTime: "4 min",
    content: [
      { type: "p", text: "Run the same shopping query through Claude and GPT-4 a few times and you'll notice something: both models have a slight fondness for stores that Reddit likes. That's not an accident." },
      { type: "p", text: "Reddit is massively over-represented in AI training data relative to its share of overall web traffic. The reasons are partly technical (Reddit is easy to scrape, has clear structure, has been around for nearly two decades) and partly qualitative (the content is human, opinionated, and specific in ways that SEO content usually isn't)." },
      { type: "h2", text: "The subreddits that matter" },
      { type: "p", text: "Not all subreddits are equal here. The ones that consistently produce store recommendations that show up in AI answers tend to be the ones with maintained wikis and high-quality recurring discussions: r/malefashionadvice and r/femalefashionadvice both have store lists that read like curated directories. r/BuyItForLife has years of brand mentions with specific reasons. r/SkincareAddiction discusses specific products and brands in exhaustive detail." },
      { type: "p", text: "General lifestyle subreddits matter less. The niche ones - r/coffee, r/Supplements, r/EDC - matter more than their subscriber count would suggest." },
      { type: "h2", text: "You can't game this" },
      { type: "p", text: "Reddit communities are extremely good at detecting brand accounts and planted recommendations, and they have long memories. The stores that appear in AI answers via Reddit got there because real customers went to the effort of recommending them unprompted. That's the only kind of Reddit presence that carries real AI training weight." },
      { type: "p", text: "What you can do: make a product worth recommending. Ask happy customers where they hang out online. Don't tell them what to say. It's slow and it doesn't feel like marketing, which is probably why it works." },
    ],
  },
  "how-reviews-shape-ai-shopping-answers": {
    title: "How Review Platforms Shape AI Shopping Answers",
    description: "Trustpilot, Google Reviews, Yotpo, Bazaarvoice. AI models absorb review content as part of their training data. Here's how your review ecosystem affects what AI says about your store.",
    date: "2025-12-02",
    readTime: "4 min",
    content: [
      { type: "p", text: "Your reviews aren't just for shoppers who are already on the fence. They're training data. The specific words customers use to describe what you sell - the material, the fit, the turnaround time, the packaging - get absorbed by AI models and become part of how those models understand your store." },
      { type: "p", text: "A store with 4,000 Trustpilot reviews that mention 'merino wool' and 'ethically made' has, in effect, tagged itself with those attributes across tens of thousands of training examples. That's not nothing." },
      { type: "h2", text: "Platform choice matters less than you'd think" },
      { type: "p", text: "We've looked at which review platforms seem to have the most AI influence and the honest answer is: probably Google Reviews and Trustpilot, because they're heavily indexed and widely scraped. But the bigger factor is total volume across multiple platforms, not which platform you're on. A store with 500 reviews on one platform and nothing else is worse off than a store with 200 reviews spread across four." },
      { type: "h2", text: "The language in reviews is the signal" },
      { type: "p", text: "A review that says 'great product, will buy again' is nearly useless as training data. A review that says 'the bomber jacket ran true to size, the shell material is noticeably heavier than other brands I've tried' creates a real semantic link between your store and specific product attributes. That's what moves the needle." },
      { type: "p", text: "You can't script this without risking authenticity. But you can ask good questions in post-purchase emails that encourage customers to describe what they bought. Most review platforms let you prompt for specific feedback. Use that." },
    ],
  },
  "ai-shopping-vs-google-shopping": {
    title: "AI Shopping Queries vs Google Shopping: Key Differences",
    description: "When someone asks Google vs asking Claude the same shopping question, the answer - and the stores recommended - are often completely different. Here's why.",
    date: "2025-11-11",
    readTime: "5 min",
    content: [
      { type: "p", text: "We ran an experiment: the same 20 shopping queries through both Google Shopping and three different AI assistants. The overlap in store recommendations was around 15%. Most of the time, the AI was recommending completely different stores than the ones winning on Google." },
      { type: "p", text: "That gap is the business opportunity." },
      { type: "h2", text: "Why the results are so different" },
      { type: "p", text: "Google ranks pages. It's real-time, it's responsive to what's on your site right now, and it rewards spend - both in the organic sense (time spent on SEO) and literally (you can buy your way to the top with Shopping ads). AI recommends brands. It's drawing on a static snapshot of the internet from months ago, and it can't be bought." },
      { type: "p", text: "The signals are almost entirely different. A store can have a perfect Shopify setup, fast load times, excellent structured data, and a strong backlink profile - and still be invisible to AI. Another store can have a mediocre website and rank in the top five for their category in AI answers, because they got a Wirecutter review three years ago." },
      { type: "h2", text: "Which channel to prioritise" },
      { type: "p", text: "Google still drives more shopping traffic today. If you have limited time, fix your SEO first. But AI is growing fast as a starting point for purchase decisions, especially for considered purchases - things people research before buying rather than impulse shop." },
      { type: "p", text: "The stores that will be in the best position in two years are the ones that started building AI visibility now. The investments aren't expensive - editorial outreach, review volume, genuine community engagement - but they take time. You can't accelerate them at the last minute the way you can throw money at Google ads." },
    ],
  },
  "your-shopify-stores-training-data-footprint": {
    title: "Your Shopify Store's Training Data Footprint",
    description: "Every mention of your store across the web contributes to how AI models understand you. Some stores have thousands of training signal data points. Others have almost none.",
    date: "2025-10-07",
    readTime: "3 min",
    content: [
      { type: "p", text: "Here's a quick way to estimate where you stand: open Google, search your domain in quotes, and look at the number of results. Then do the same on Reddit. Then check your Trustpilot and Google Reviews totals. What you're looking at, roughly, is your training data footprint - the volume of text about your store that existed before AI models were trained." },
      { type: "p", text: "If the answer is 'a few hundred mentions across everything', you probably don't appear in AI recommendations much. If it's tens of thousands, you probably do." },
      { type: "h2", text: "Source diversity beats raw volume" },
      { type: "p", text: "One thing that surprised us when we started digging into this: concentration hurts. A store with 2,000 reviews on a single platform is at a disadvantage compared to one with 500 mentions spread across a dozen independent sources. The AI signal from ten different independent sources saying 'this store is good for hiking gear' is stronger than a thousand mentions from one." },
      { type: "p", text: "Our working theory is that models treat source diversity as a proxy for genuine reputation. A single enthusiastic blogger writing about you 50 times doesn't carry the same weight as 50 different bloggers each mentioning you once. That matches how humans evaluate trustworthiness, and AI models apparently learned the same heuristic." },
      { type: "h2", text: "The window you're in right now" },
      { type: "p", text: "Training data has a cutoff. Whatever gets written about your store between now and the next training cutoff will determine your AI visibility in the next generation of models. That's not a scare tactic - it's just the mechanics of how these systems work. The web content you generate and earn in the next year is what shapes your ranking in the AI that shoppers will be using a year from now." },
    ],
  },
};

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = POSTS[params.slug];
    if (!post) throw notFound();
    return { post, slug: params.slug };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.post.title} | LiveAIPulse` },
      { name: "description", content: loaderData?.post.description },
      { property: "og:title", content: loaderData?.post.title },
      { property: "og:description", content: loaderData?.post.description },
      { property: "og:type", content: "article" },
      { name: "robots", content: "index, follow" },
    ],
    links: [{ rel: "canonical", href: `https://liveaipulse.com/blog/${loaderData?.slug}` }],
  }),
  component: BlogPost,
});

function BlogPost() {
  const { post, slug } = Route.useLoaderData();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
      <Link to="/blog" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-azure)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 32 }}>
        ← Blog
      </Link>

      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>{formatDate(post.date)}</span>
          <span style={{ width: 3, height: 3, background: "var(--lb-border-strong)", borderRadius: "50%", display: "inline-block" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)" }}>{post.readTime} read</span>
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 28, color: "var(--lb-fg)", margin: "0 0 12px", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {post.title}
        </h1>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 16, margin: 0, lineHeight: 1.6 }}>
          {post.description}
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--lb-border)", paddingTop: 32 }}>
        {post.content.map((block, i) => {
          if (block.type === "h2") {
            return <h2 key={i} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 20, color: "var(--lb-fg)", margin: "36px 0 12px", letterSpacing: "-0.01em" }}>{block.text}</h2>;
          }
          if (block.type === "h3") {
            return <h3 key={i} style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16, color: "var(--lb-fg)", margin: "24px 0 8px" }}>{block.text}</h3>;
          }
          if (block.type === "ul") {
            return (
              <ul key={i} style={{ margin: "16px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {block.items?.map((item, j) => (
                  <li key={j} style={{ color: "var(--lb-fg-2)", fontSize: 15, lineHeight: 1.6 }}>{item}</li>
                ))}
              </ul>
            );
          }
          return <p key={i} style={{ color: "var(--lb-fg-2)", fontSize: 15, lineHeight: 1.7, margin: "16px 0" }}>{block.text}</p>;
        })}
      </div>

      <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid var(--lb-border)" }}>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, color: "var(--lb-fg)", marginBottom: 8 }}>
          Track your AI visibility
        </p>
        <p style={{ color: "var(--lb-fg-2)", fontSize: 14, margin: "0 0 16px" }}>
          See how often AI recommends your Shopify store across 21 categories.
        </p>
        <Link to="/" style={{ display: "inline-block", padding: "8px 16px", background: "var(--lb-azure)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 500, fontFamily: "inherit" }}>
          View the leaderboard →
        </Link>
      </div>
    </div>
  );
}
