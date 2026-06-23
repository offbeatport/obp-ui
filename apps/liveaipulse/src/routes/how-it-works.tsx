import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works - LiveAIPulse" },
      {
        name: "description",
        content:
          "How LiveAIPulse tracks which Shopify stores AI recommends most. Updated daily across 21 shopping categories.",
      },
    ],
  }),
  component: HowItWorks,
});

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 32, paddingTop: 40, paddingBottom: 40, borderBottom: "1px solid var(--lb-border)" }}>
      <div style={{ flexShrink: 0, width: 48 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-fg-3)", fontWeight: 600, letterSpacing: "0.06em" }}>
          {n}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: "var(--lb-fg)", margin: "0 0 14px", letterSpacing: "-0.01em" }}>
          {title}
        </h2>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--lb-fg-2)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 12px" }}>{children}</p>;
}

function HowItWorks() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--lb-azure)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          Methodology
        </span>
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: "var(--lb-fg)", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
        How It Works
      </h1>
      <p style={{ fontSize: 15, color: "var(--lb-fg-2)", lineHeight: 1.6, margin: "0 0 48px", maxWidth: 560 }}>
        When people shop online today, many of them ask AI assistants like ChatGPT or Google Gemini where to buy things. LiveAIPulse tracks which stores those AI assistants recommend.
      </p>

      <Section n="01" title="We ask AI the same questions shoppers ask">
        <P>
          Every day, we send 105 shopping questions to an AI assistant. Things like "Where can I buy good skincare products online?" or "What are the best places to buy a quality watch?" These are the same kinds of questions real shoppers type into AI every day.
        </P>
        <P>
          We cover 21 categories, from Coffee and Skincare to Watches, Dog Supplies, and Outdoor Gear, with 5 questions per category. We keep the questions natural and conversational, exactly the way a real person would ask.
        </P>
      </Section>

      <Section n="02" title="We record which stores the AI recommends">
        <P>
          When the AI answers, it names specific stores and their websites. We record every store it mentions. If the AI says "you should check out allbirds.com" in response to a footwear question, that counts as one appearance for Allbirds in the Sneakers category.
        </P>
        <P>
          Each store can only be counted once per question, no matter how many times it appears in a single answer. This keeps the results fair.
        </P>
      </Section>

      <Section n="03" title="Scores build up over time">
        <P>
          A store's score is the total number of times it has appeared in AI responses across all our daily runs. A store that has been recommended consistently for weeks will have a higher score than one that appeared for the first time yesterday.
        </P>
        <P>
          This rewards stores with a lasting presence in AI recommendations, not just a good day. The trend chart on each store's page shows whether their AI visibility is growing, stable, or declining over time.
        </P>
      </Section>

      <Section n="04" title="Results update every day">
        <P>
          We run all 105 questions automatically every morning. Rankings update as soon as the run finishes. You can also see when each category was last updated on the leaderboard.
        </P>
        <P>
          Because AI models learn from what is written about stores across the internet, rankings shift gradually over time as stores gain or lose coverage in reviews, articles, forums, and social media.
        </P>
      </Section>

      <Section n="05" title="What a high score actually means">
        <P>
          A high score means AI assistants consistently bring up your store when people ask where to shop in your category. This matters because a growing number of shoppers now start their search by asking an AI rather than typing into Google.
        </P>
        <P>
          A low score does not mean your store is bad. It most likely means AI has not seen enough mentions of your store across the web to confidently recommend it. The good news is that this can change. Check the store profile page for specific steps you can take to improve your visibility.
        </P>
      </Section>

      <Section n="06" title="We do not take money to change rankings">
        <P>
          Every result on this site reflects what the AI actually said. We have no way to pay the AI to recommend a particular store, and we would not do so even if we could. The rankings are a neutral observation, not an endorsement.
        </P>
        <P>
          If you spot something that looks wrong, a store in the wrong category or a domain that should not be there, get in touch and we will look into it.
        </P>
      </Section>

    </div>
  );
}
