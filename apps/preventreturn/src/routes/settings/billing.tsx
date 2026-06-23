import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@offbeatport/blocks/layouts";

export const Route = createFileRoute("/settings/billing")({
  component: BillingSettings,
});

const PLANS = [
  {
    id: "performance",
    name: "Performance",
    price: "15% of net savings",
    description: "Pay nothing until the agent saves you money. Zero risk.",
    features: ["Unlimited orders monitored", "SMS + email interventions", "A/B proof built in", "Pay $0 in months with no net gain"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$199 / month",
    description: "Flat monthly fee. Better for high-volume stores.",
    features: ["Everything in Performance", "Priority message delivery", "Custom tone per product tag", "Weekly digest + Slack alerts", "Dedicated onboarding call"],
    highlighted: true,
  },
];

function BillingSettings() {
  const [loading, setLoading] = useState<string | null>(null);

  async function startCheckout(plan: "performance" | "pro") {
    setLoading(plan);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast.error(data.error ?? "Could not start checkout. Add POLAR_PRODUCT_IDs to .env first.");
      setLoading(null);
    }
  }

  return (
    <>
      <SettingsSection title="Current plan" description="You're on the free tier. Upgrade to unlock flat-rate billing.">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-fg">Free / Performance</p>
              <p className="text-xs text-fg-muted mt-0.5">No charge until the agent saves you money</p>
            </div>
            <span className="text-xs text-success font-medium bg-success/10 border border-success/20 px-2 py-1 rounded">Active</span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Upgrade" description="Switch to a flat monthly rate once your savings are predictable.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PLANS.map((plan) => (
            <div key={plan.id}
              className={`rounded-lg border p-5 flex flex-col relative ${plan.highlighted ? "border-primary bg-primary/3" : "border-border bg-surface"}`}
            >
              {plan.highlighted && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-mono uppercase tracking-widest bg-primary text-primary-fg px-3 py-0.5 rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <div className="mb-4">
                <p className="text-sm font-semibold text-fg">{plan.name}</p>
                <p className="text-lg font-bold text-primary mt-1">{plan.price}</p>
                <p className="text-xs text-fg-muted mt-1">{plan.description}</p>
              </div>
              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-fg">
                    <svg viewBox="0 0 12 12" className="w-3 h-3 mt-0.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 6L5 9L10 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button type="button"
                onClick={() => startCheckout(plan.id as "performance" | "pro")}
                disabled={loading === plan.id}
                className={`w-full py-2 rounded text-sm font-semibold transition disabled:opacity-50 ${plan.highlighted ? "bg-primary text-primary-fg hover:brightness-110" : "bg-surface border border-border text-fg hover:bg-hover"}`}
              >
                {loading === plan.id ? "Redirecting…" : `Switch to ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="How billing works" description="Transparent, no surprises.">
        <div className="rounded-lg border border-border bg-surface divide-y divide-border">
          {[
            { q: "When do I get charged?", a: "Performance plan: end of each month, 15% of net savings only. Pro plan: monthly on your renewal date." },
            { q: "What is 'net savings'?", a: "Returns prevented × avg return cost, minus any cancellations your interventions caused × order margin. If cancellations exceed savings, you pay $0." },
            { q: "How do I cancel?", a: "Cancel any time from this page or your Polar billing portal. No lock-in, no penalties." },
          ].map((item) => (
            <div key={item.q} className="px-4 py-4">
              <p className="text-sm font-medium text-fg mb-1">{item.q}</p>
              <p className="text-xs text-fg-muted leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </>
  );
}
