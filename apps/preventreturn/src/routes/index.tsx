import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@offbeatport/ui/ui/footer";

export const Route = createFileRoute("/")({
  component: Marketing,
});

// --- Marketing nav ---

function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 h-[52px] flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 mr-auto">
          <span className="w-7 h-7 rounded bg-primary flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" stroke="rgb(var(--primary-fg))" strokeWidth="1.5" fill="none" />
              <circle cx="7" cy="7" r="2" fill="rgb(var(--primary-fg))" />
            </svg>
          </span>
          <span className="font-semibold tracking-tight text-fg text-sm">PreventReturn</span>
        </Link>
        <Link to="/pricing" className="text-sm text-fg-muted hover:text-fg transition-colors">Pricing</Link>
        <Link to="/app" className="text-sm text-fg-muted hover:text-fg transition-colors">Sign in</Link>
        <Link to="/app" className="text-sm font-semibold text-primary-fg bg-primary rounded px-4 py-1.5 hover:brightness-110 transition">
          Get started free
        </Link>
      </div>
    </header>
  );
}

// --- SMS thread visual ---

function SMSThread() {
  const messages = [
    { from: "agent", text: "Hey Sarah! Quick note before we ship your Linen Blazer - you ordered S, M, and L. This style runs true to size. Which fit are you going for? We can ship just one right now 😊", time: "11:44 PM" },
    { from: "buyer", text: "Oh wow I didn't realise! I usually wear M. Can you just send the M?", time: "11:47 PM" },
    { from: "agent", text: "Done! Updated to Medium and refunded S and L. Ships tomorrow 🎉", time: "11:47 PM" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl max-w-sm w-full">
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
        <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-fg">PS</span>
        <div>
          <p className="text-xs font-semibold text-fg">PreventReturn Agent</p>
          <p className="text-[10px] text-success">● Online</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "agent" ? "justify-start" : "justify-end"}`}>
            <div className="max-w-[85%]">
              <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${msg.from === "agent" ? "bg-bg border border-border text-fg rounded-tl-sm" : "bg-primary text-primary-fg rounded-tr-sm"}`}>
                {msg.text}
              </div>
              <p className={`text-[9px] text-fg-muted mt-0.5 ${msg.from === "agent" ? "text-left" : "text-right"}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5">
        <span className="text-[10px] text-success font-medium">✓ Return prevented - $22 saved</span>
      </div>
    </div>
  );
}

// --- Risk signal visual ---

function RiskCard() {
  const signals = [
    { label: "Ordered S, M & L simultaneously", level: "high" },
    { label: "First-time buyer", level: "high" },
    { label: "Purchase at 11:42 PM", level: "med" },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-4 max-w-xs w-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-fg">Order #4821</p>
        <span className="text-[11px] font-semibold text-danger bg-danger/10 px-2 py-0.5 rounded">96 High risk</span>
      </div>
      {signals.map((s) => (
        <div key={s.label} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0 text-xs text-fg-muted">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.level === "high" ? "bg-danger" : "bg-warning"}`} />
          {s.label}
        </div>
      ))}
    </div>
  );
}

function Marketing() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingNav />

      {/* Hero */}
      <section className="px-6 py-24 md:py-32">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-fg-muted mb-5">
              AI agent for Shopify merchants
            </div>
            <h1 className="text-[44px] md:text-[56px] font-semibold leading-[1.05] tracking-tight text-fg mb-6">
              Stop returns{" "}
              <span className="text-primary">before the box ships.</span>
            </h1>
            <p className="text-fg-muted text-[17px] leading-relaxed mb-8 max-w-md">
              PreventReturn scores every order the moment it's placed, spots the ones likely to come back, and sends a personalised message before you fulfil - automatically.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/app" className="text-sm font-semibold text-primary-fg bg-primary rounded-lg px-5 py-2.5 hover:brightness-110 transition">
                Start free - no card required
              </Link>
              <Link to="/pricing" className="text-sm font-semibold text-fg border border-border rounded-lg px-5 py-2.5 hover:bg-hover transition">
                See pricing
              </Link>
            </div>
            <p className="text-xs text-fg-muted mt-4 font-mono">
              15% of savings only · Pay $0 if it doesn't work
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <RiskCard />
            <div className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Agent fires intervention within 2 hours
            </div>
            <SMSThread />
          </div>
        </div>
      </section>

      {/* Social proof bar */}
      <section className="border-y border-border px-6 py-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { stat: "28% → 11%", label: "Avg return rate drop" },
            { stat: "$14,820", label: "Avg monthly savings" },
            { stat: "75%", label: "Intervention success rate" },
            { stat: "< 2 hrs", label: "Time to first intervention" },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-2xl font-bold text-primary tabular-nums">{item.stat}</p>
              <p className="text-xs text-fg-muted mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted mb-3">How it works</p>
            <h2 className="text-3xl font-semibold text-fg">Three steps. Zero effort.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              {
                step: "01",
                title: "Order placed",
                body: "The agent scores the order within seconds using signals like bracketing, first-time buyers, late-night purchases, and high-return SKUs.",
                color: "text-fg-muted",
              },
              {
                step: "02",
                title: "Message sent",
                body: "High-risk orders get a personalised SMS or email - framed as white-glove service, never suspicion. \"Quick note before we ship your order…\"",
                color: "text-primary",
              },
              {
                step: "03",
                title: "Return prevented",
                body: "The buyer confirms the right size, cancels before shipping, or swaps the variant. The return that would have cost you $22 never happens.",
                color: "text-success",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col gap-3">
                <span className={`font-mono text-[11px] font-bold ${s.color}`}>{s.step}</span>
                <h3 className="text-[17px] font-semibold text-fg">{s.title}</h3>
                <p className="text-sm text-fg-muted leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built-in proof section */}
      <section className="border-y border-border bg-surface/50 px-6 py-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted mb-4">Zero trust required</p>
            <h2 className="text-3xl font-semibold text-fg mb-4">
              Proof is built in - not promised.
            </h2>
            <p className="text-fg-muted leading-relaxed mb-6">
              Every account starts in Watch Mode. The agent silently scores orders for 14 days - no messages sent. You see exactly which orders it would have intervened on, and which ones actually returned.
            </p>
            <p className="text-fg-muted leading-relaxed mb-8">
              When you go live, 50% of flagged orders get the intervention. 50% don't. After 30 days you see the split - returns prevented vs. control group - with dollar amounts attached. If the net benefit is zero, you pay zero.
            </p>
            <Link to="/app" className="text-sm font-semibold text-primary-fg bg-primary rounded-lg px-5 py-2.5 hover:brightness-110 transition inline-block">
              See the dashboard →
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "Returns prevented", value: "+$14,820", color: "text-success" },
              { label: "Cancellations caused", value: "−$180", color: "text-fg-muted" },
              { label: "Net gain this month", value: "$14,640", color: "text-primary", large: true },
            ].map((row) => (
              <div key={row.label} className={`rounded-lg border border-border bg-surface px-5 py-4 flex items-center justify-between ${row.large ? "border-primary/30 bg-primary/5" : ""}`}>
                <p className="text-sm text-fg-muted">{row.label}</p>
                <p className={`font-bold tabular-nums ${row.large ? "text-2xl" : "text-lg"} ${row.color}`}>{row.value}</p>
              </div>
            ))}
            <p className="text-xs text-fg-muted text-center pt-1">You pay 15% of net gain · $0 in months with no net gain</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-mono text-[11px] uppercase tracking-widest text-fg-muted mb-3">Merchants</p>
            <h2 className="text-3xl font-semibold text-fg">Returns are down. Margin is up.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                quote: "We went from 31% returns to 13% in six weeks. The bracketing detection alone saved us thousands - we had no idea how many customers were ordering three sizes.",
                name: "Mia C.",
                role: "Founder, women's apparel brand",
              },
              {
                quote: "The watch mode sold it for me. I saw the predictions before I committed to anything. When 11 of the 14 'would have returned' orders actually did return, I turned it on immediately.",
                name: "James R.",
                role: "Owner, online sneaker store",
              },
              {
                quote: "What I love is that buyers thank us for the messages. They genuinely think it's amazing that we reach out to double-check. It's made our post-purchase experience look premium.",
                name: "Emma T.",
                role: "Co-founder, DTC homeware brand",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
                <p className="text-sm text-fg-muted leading-relaxed flex-1">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-fg">{t.name}</p>
                  <p className="text-xs text-fg-muted">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border px-6 py-20 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-semibold text-fg mb-4">
            Your next return is preventable.
          </h2>
          <p className="text-fg-muted mb-8 leading-relaxed">
            Connect your Shopify store in 2 minutes. Watch Mode runs for free. You only pay when the agent saves you money.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/app" className="text-sm font-semibold text-primary-fg bg-primary rounded-lg px-6 py-3 hover:brightness-110 transition">
              Get started free
            </Link>
            <Link to="/pricing" className="text-sm font-semibold text-fg border border-border rounded-lg px-6 py-3 hover:bg-hover transition">
              View pricing
            </Link>
          </div>
          <p className="text-xs text-fg-muted mt-4 font-mono">No card required · Cancel anytime</p>
        </div>
      </section>

      <Footer
        brandName="PreventReturn"
        tagline="The AI agent that stops Shopify returns before they happen."
        columns={[
          {
            title: "Product",
            links: [
              { label: "Dashboard", href: "/app" },
              { label: "Settings", href: "/settings" },
              { label: "Pricing", href: "/pricing" },
            ],
          },
          {
            title: "Legal",
            links: [
              { label: "Privacy policy", href: "/privacy" },
              { label: "Terms of service", href: "/terms" },
            ],
          },
        ]}
        legal={[
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
        ]}
      />
    </div>
  );
}
