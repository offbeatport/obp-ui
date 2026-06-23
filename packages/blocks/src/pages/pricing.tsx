import * as React from "react";
import { cn } from "@offbeatport/core/utils";
import { Button } from "../ui/button";
import { Card, CardDescription, CardTitle } from "../ui/card";

/**
 * Reusable pricing-page LAYOUT. Per-app the actual tiers, prices, and
 * features vary, so apps pass them in as props. The layout, FAQ rendering,
 * billing-period toggle, "Compare features" pattern stays consistent
 * across the portfolio.
 */

export interface PricingPrice {
  /** Headline price label (e.g. "$0", "$29", "Custom"). */
  monthly: string;
  /** Optional annual price. If provided, the page renders a billing toggle. */
  annual?: string;
  /** Discount label shown on the annual chip (e.g. "save 20%"). */
  annualSaving?: string;
  /** Sub-line under the price, e.g. "per month". Defaults sensibly. */
  cadence?: string;
  cadenceAnnual?: string;
}

export interface PricingTier {
  name: string;
  price: PricingPrice;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  /** Highlight this tier with the brand outline + "Most popular" badge. */
  highlighted?: boolean;
  /** Optional small badge text next to the tier name (e.g. "Best value"). */
  badge?: string;
}

export interface PricingFaqItem {
  q: string;
  a: React.ReactNode;
}

export interface PricingPageProps {
  className?: string;
  title?: string;
  subtitle?: string;
  /** Optional eyebrow shown above the title. */
  eyebrow?: string;
  tiers: PricingTier[];
  faq?: PricingFaqItem[];
  /** Trailing reassurance line above the FAQ (e.g. "30-day money-back"). */
  reassurance?: React.ReactNode;
  /** Toggle default. "monthly" or "annual". Defaults to monthly. */
  defaultBilling?: "monthly" | "annual";
}

export function PricingPage({
  className,
  eyebrow,
  title = "Simple pricing",
  subtitle = "Start free. Upgrade when it's worth it.",
  tiers,
  faq = [],
  reassurance,
  defaultBilling = "monthly",
}: PricingPageProps) {
  const hasAnnual = tiers.some((t) => Boolean(t.price.annual));
  const [billing, setBilling] = React.useState<"monthly" | "annual">(defaultBilling);
  const showToggle = hasAnnual;

  return (
    <div className={cn("max-w-5xl mx-auto px-6 py-16", className)}>
      <header className="text-center mb-10">
        {eyebrow && (
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-3">
            {eyebrow}
          </div>
        )}
        <h1 className="mb-3">{title}</h1>
        <p className="text-fg-muted text-[15px] leading-[1.55] max-w-xl mx-auto">{subtitle}</p>
      </header>

      {showToggle && (
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center p-1 border border-border bg-field rounded-full">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-medium",
                billing === "monthly"
                  ? "bg-fg text-bg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-medium flex items-center gap-1.5",
                billing === "annual"
                  ? "bg-fg text-bg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              Annual
              <span
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded",
                  billing === "annual"
                    ? "bg-bg/20 text-bg"
                    : "bg-primary/12 text-primary",
                )}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid gap-6 mb-12",
          tiers.length === 1 && "grid-cols-1 max-w-md mx-auto",
          tiers.length === 2 && "grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto",
          tiers.length === 3 && "grid-cols-1 md:grid-cols-3",
          tiers.length >= 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {tiers.map((tier) => {
          const usingAnnual = billing === "annual" && tier.price.annual;
          const priceLabel = usingAnnual ? tier.price.annual ?? tier.price.monthly : tier.price.monthly;
          const cadence = usingAnnual
            ? tier.price.cadenceAnnual ?? "per month, billed annually"
            : tier.price.cadence ?? "per month";

          return (
            <Card
              key={tier.name}
              variant={tier.highlighted ? "shadow" : "bordered"}
              className={cn(
                "flex flex-col relative",
                tier.highlighted && "border-primary",
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-fg font-mono text-[10px] uppercase tracking-[0.1em] rounded-full whitespace-nowrap">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-2 mb-4">
                <CardTitle>{tier.name}</CardTitle>
                {tier.badge && !tier.highlighted && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-subtle">
                    · {tier.badge}
                  </span>
                )}
              </div>
              <div className="mb-2 flex items-baseline gap-2">
                <span className="font-display text-[44px] font-light leading-none tracking-[-0.02em]">
                  {priceLabel}
                </span>
                {priceLabel !== "Custom" && priceLabel !== "$0" && (
                  <span className="text-[13px] text-fg-muted">{cadence}</span>
                )}
              </div>
              <CardDescription className="mb-6">{tier.description}</CardDescription>
              <ul className="flex-1 space-y-2.5 mb-6 text-[14px]">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-fg">
                    <svg
                      viewBox="0 0 12 12"
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M2 6 L5 9 L10 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {tier.ctaHref ? (
                <Button asChild variant={tier.highlighted ? "primary" : "secondary"} size="lg">
                  <a href={tier.ctaHref}>{tier.ctaLabel}</a>
                </Button>
              ) : (
                <Button
                  onClick={tier.ctaOnClick}
                  variant={tier.highlighted ? "primary" : "secondary"}
                  size="lg"
                >
                  {tier.ctaLabel}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {reassurance && (
        <p className="text-center text-fg-muted text-[13px] mb-16">{reassurance}</p>
      )}

      {faq.length > 0 && (
        <section>
          <div className="text-center mb-10">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-3">
              Frequently asked
            </div>
            <h2>Questions, answered</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 max-w-3xl mx-auto">
            {faq.map((item, i) => (
              <div key={i}>
                <h3 className="mb-2">{item.q}</h3>
                <div className="text-fg-muted text-[14px] leading-[1.6]">{item.a}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
