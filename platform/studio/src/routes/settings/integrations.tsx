import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getFounderProfile, upsertFounderProfile } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";

export const Route = createFileRoute("/settings/integrations")({
  loader: () => getFounderProfile(),
  staleTime: 60_000,
  component: IntegrationsSection,
});

const LABEL: React.CSSProperties = {
  fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 6,
};
const HINT: React.CSSProperties = {
  margin: "5px 0 0", fontSize: "0.70rem", color: "var(--fg-subtle)", lineHeight: 1.55,
};
const CARD: React.CSSProperties = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "20px 24px", marginBottom: 16,
};

function IntegrationsSection() {
  const initial = Route.useLoaderData();
  const [openRouterKey, setOpenRouterKey] = useState(initial?.openRouterKey ?? "");
  const [globalVpsIp, setGlobalVpsIp] = useState(initial?.globalVpsIp ?? "");
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState(initial?.stripeWebhookSecret ?? "");
  const [showKey, setShowKey] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await upsertFounderProfile({
        data: {
          openRouterKey: openRouterKey.trim() || undefined,
          globalVpsIp: globalVpsIp.trim() || undefined,
          stripeWebhookSecret: stripeWebhookSecret.trim() || undefined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 80px" }}>
      <div style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: "1.0rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
            Integrations
          </h3>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--fg-subtle)", lineHeight: 1.55 }}>
            API keys and webhooks for external services. Stored locally in your database.
          </p>
        </div>

        {/* OpenRouter */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>
            AI - OpenRouter
          </div>
          <label style={LABEL}>API Key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              type={showKey ? "text" : "password"}
              value={openRouterKey}
              onChange={e => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-v1-..."
              style={{ flex: 1, fontFamily: "var(--font-mono)" }}
            />
            <Button variant="ghost" size="sm" onClick={() => setShowKey(v => !v)}>
              {showKey ? "Hide" : "Show"}
            </Button>
          </div>
          <p style={HINT}>
            Used for all AI features - opportunity scoring, brief generation, content creation, gap analysis.
            Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>openrouter.ai/keys</a>.
            {initial?.openRouterKey ? "" : " Falls back to OPENROUTER_API_KEY env var if not set."}
          </p>
        </div>

        {/* VPS IP */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>
            Infrastructure - VPS
          </div>
          <label style={LABEL}>VPS IP Address</label>
          <Input
            type="text"
            value={globalVpsIp}
            onChange={e => setGlobalVpsIp(e.target.value)}
            placeholder="192.168.1.1"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <p style={HINT}>
            Your server's public IP. Used to generate DNS A-record instructions in the Build tab when deploying a new project.
          </p>
        </div>

        {/* Stripe */}
        <div style={CARD}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(250,250,250,0.4)", marginBottom: 14 }}>
            Payments - Stripe
          </div>
          <label style={LABEL}>Webhook Secret</label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              type={showStripe ? "text" : "password"}
              value={stripeWebhookSecret}
              onChange={e => setStripeWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              style={{ flex: 1, fontFamily: "var(--font-mono)" }}
            />
            <Button variant="ghost" size="sm" onClick={() => setShowStripe(v => !v)}>
              {showStripe ? "Hide" : "Show"}
            </Button>
          </div>
          <p style={HINT}>
            Used to automatically record MRR snapshots when Stripe payments succeed.
            Create a webhook in Stripe pointing to <code style={{ fontSize: "0.78rem", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>
              /api/stripe-webhook
            </code> with the <code style={{ fontSize: "0.78rem", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 3 }}>checkout.session.completed</code> event.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && (
            <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
