import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg)", marginBottom: 12 }}>Pricing</h1>
      <p style={{ color: "var(--fg-muted)" }}>Pricing tiers go here.</p>
    </div>
  );
}
