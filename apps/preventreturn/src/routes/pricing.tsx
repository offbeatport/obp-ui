import { createFileRoute } from "@tanstack/react-router";
import { Card, CardTitle, CardDescription } from "@offbeatport/ui/ui/card";
import { useState } from "react";
import { toast } from "sonner";

async function startCheckout(plan: "performance" | "pro") {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (res.status === 401) { window.location.href = "/login"; return; }
  const data = await res.json() as { url?: string; error?: string };
  if (data.url) { window.location.href = data.url; }
  else { toast.error(data.error ?? "Could not start checkout"); }
}

export const Route = createFileRoute("/pricing")({
  component: Pricing,
});

const TIERS = [
  {
    name: "Performance",
    price: { monthly: "15%", annual: "12%" },
    cadence: "of net savings only",
    description: "Pay nothing until the agent saves you money. Zero risk to try.",
    features: [
      "Unlimited orders monitored",
      "SMS + email interventions",
      "Real-time risk scoring",
      "14-day watch mode",
      "A/B proof built in",
      "Pay $0 in months with no net gain",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: { monthly: "$199", annual: "$159" },
    cadence: "per month",
    description: "Flat monthly fee. Better for high-volume stores once you've validated the ROI.",
    features: [
      "Everything in Performance",
      "Priority message delivery",
      "Custom message tone per product tag",
      "Slack / email weekly digest",
      "Dedicated onboarding call",
      "Cancel anytime",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
];

const FAQ = [
  {
    q: "Can the agent cause unnecessary cancellations?",
    a: "Yes - this is the real risk and we're transparent about it. That's why the A/B control group is built in from day one. The dashboard shows you 'returns prevented' minus 'cancellations caused' as a single net benefit number. If it goes negative, you pay $0 that month.",
  },
  {
    q: "How is net savings calculated?",
    a: "Returns prevented × (return shipping cost + order margin) minus any cancellations caused × order margin. You see this number in real time on the dashboard. No black box.",
  },
  {
    q: "What channels does it use?",
    a: "SMS via Twilio (higher open rates) and email via your store's reply-to address. You control which channels and the tone in Settings.",
  },
  {
    q: "Does it work with my Shopify plan?",
    a: "Yes - all Shopify plans. We use the Orders webhook which is available on every plan including Basic.",
  },
  {
    q: "What if I want to switch tiers?",
    a: "Swap anytime from the billing page. No contracts, no penalties.",
  },
  {
    q: "How long before I see results?",
    a: "Most merchants see measurable return rate improvement within 2 weeks. The watch mode shows predicted accuracy before you go live.",
  },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <p className="text-xs font-mono uppercase tracking-widest text-fg-muted mb-3">Pricing</p>
        <h1 className="text-3xl font-semibold text-fg mb-3">Pay when it works</h1>
        <p className="text-fg-muted max-w-md mx-auto text-[15px] leading-relaxed">
          Start on Performance - zero upfront, you only pay a cut of what we save you.
          Switch to Pro when the numbers make sense.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center p-1 border border-border bg-surface rounded-full gap-0.5">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${!annual ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${annual ? "bg-fg text-bg" : "text-fg-muted hover:text-fg"}`}
          >
            Annual
            <span className={`text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded ${annual ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"}`}>
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
        {TIERS.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col relative p-6 ${tier.highlighted ? "border-primary" : "border-border"}`}
          >
            {tier.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-fg font-mono text-[10px] uppercase tracking-widest rounded-full whitespace-nowrap">
                Most popular
              </span>
            )}

            <CardTitle className="mb-1">{tier.name}</CardTitle>

            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-bold text-fg tabular-nums">
                {annual ? tier.price.annual : tier.price.monthly}
              </span>
              <span className="text-sm text-fg-muted">{tier.cadence}</span>
            </div>

            <CardDescription className="mb-6 text-[13px]">{tier.description}</CardDescription>

            <ul className="flex-1 space-y-2.5 mb-6">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-fg">
                  <CheckIcon />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => startCheckout(tier.highlighted ? "pro" : "performance")}
              className={`w-full py-2.5 rounded text-sm font-semibold transition ${tier.highlighted
                  ? "bg-primary text-primary-fg hover:brightness-110"
                  : "bg-surface border border-border text-fg hover:bg-hover"
                }`}
            >
              {tier.cta}
            </button>
          </Card>
        ))}
      </div>

      {/* Net benefit explainer */}
      <div className="rounded-lg border border-border bg-surface p-5 mb-16 text-center">
        <p className="text-sm font-medium text-fg mb-1">How the Performance tier charges</p>
        <p className="text-xs text-fg-muted max-w-lg mx-auto leading-relaxed">
          At end of month: <span className="text-success font-medium">(returns prevented × avg return cost)</span>{" "}
          − <span className="text-fg font-medium">(cancellations caused × avg order margin)</span>{" "}
          = net savings. We take 15% of that. If net savings ≤ $0, you pay $0.
        </p>
      </div>

      {/* FAQ */}
      <div>
        <p className="text-center text-xs font-mono uppercase tracking-widest text-fg-muted mb-8">
          Frequently asked
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
          {FAQ.map((item) => (
            <div key={item.q}>
              <p className="text-sm font-semibold text-fg mb-2">{item.q}</p>
              <p className="text-xs text-fg-muted leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
