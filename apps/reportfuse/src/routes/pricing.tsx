import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20 text-center">
      <p className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-4">Pricing</p>
      <h1
        className="font-display font-light text-fg tracking-tight mb-4"
        style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
      >
        Simple. Honest.
      </h1>
      <p className="text-base text-fg-muted font-light mb-14 max-w-sm mx-auto">
        Try it free. Upgrade when it saves you more than it costs.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 text-left mb-10">
        {/* Free */}
        <div className="border border-border p-7">
          <div className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-4">Free</div>
          <div className="font-display font-light text-5xl text-fg tracking-tight mb-1">$0</div>
          <p className="text-xs text-fg-muted mb-8">No card required. 3 runs/day without signup, 10 with a free account.</p>
          <ul className="space-y-2.5 mb-8">
            {[
              "Any platform, any CSV",
              "AI column mapping",
              "CSV + XLSX download",
              "Last 10 runs saved (with account)",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <span className="text-fg-subtle mt-0.5 shrink-0">+</span> {f}
              </li>
            ))}
          </ul>
          <Link
            to="/"
            className="flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-border text-fg hover:bg-hover transition-colors"
          >
            Start now
          </Link>
        </div>

        {/* Pro */}
        <div className="border border-primary p-7 relative">
          <div className="absolute top-4 right-4 text-[10px] font-mono px-2 py-0.5 bg-primary text-primary-fg">
            POPULAR
          </div>
          <div className="text-xs font-mono text-primary uppercase tracking-widest mb-4">Pro</div>
          <div className="font-display font-light text-5xl text-fg tracking-tight mb-1">$29</div>
          <p className="text-xs text-fg-muted mb-8">per month, cancel anytime</p>
          <ul className="space-y-2.5 mb-8">
            {[
              "Unlimited normalizations",
              "Everything in Free",
              "A full year of run history",
              "Saved column mappings",
              "Re-normalize any past run",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <span className="text-primary mt-0.5 shrink-0">+</span> {f}
              </li>
            ))}
          </ul>
          <Link
            to="/login"
            className="flex items-center justify-center px-4 py-2.5 text-sm font-medium text-primary-fg bg-primary border border-primary hover:brightness-110 transition-all"
          >
            Get Pro
          </Link>
        </div>

        {/* Custom */}
        <div className="border border-border p-7 flex flex-col">
          <div className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-4">Custom</div>
          <div className="font-display font-light text-5xl text-fg tracking-tight mb-1">-</div>
          <p className="text-xs text-fg-muted mb-8">Volume, teams, custom integrations.</p>
          <ul className="space-y-2.5 mb-8 flex-1">
            {[
              "Everything in Pro",
              "High-volume normalizations",
              "Multiple team members",
              "Priority support",
              "Custom integrations",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-fg-muted">
                <span className="text-fg-subtle mt-0.5 shrink-0">+</span> {f}
              </li>
            ))}
          </ul>
          <a
            href="mailto:hello@reportfuse.com"
            className="flex items-center justify-center px-4 py-2.5 text-sm font-medium border border-border text-fg hover:bg-hover transition-colors"
          >
            Email us
          </a>
        </div>
      </div>

      <p className="text-xs text-fg-subtle">
        Questions? <a href="mailto:hello@reportfuse.com" className="text-fg-muted hover:text-fg transition-colors">hello@reportfuse.com</a>
      </p>
    </div>
  );
}
