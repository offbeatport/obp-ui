import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@offbeatport/blocks/layouts";

export const Route = createFileRoute("/settings/messages")({
  component: MessagesSettings,
});

const TONES = [
  {
    id: "helpful",
    label: "Helpful",
    description: "Warm and conversational. Feels like a knowledgeable friend.",
    preview: "Hey Sarah! Quick note before we ship - this jacket runs slim. Most customers go one size up. Want to swap before we send it out? 😊",
  },
  {
    id: "concise",
    label: "Concise",
    description: "Short and direct. Best for SMS where every character counts.",
    preview: "Hi - your jacket runs slim. Swap size before we ship? Reply YES or NO.",
  },
  {
    id: "premium",
    label: "Premium",
    description: "Elevated and refined. Suited to luxury or high-AOV brands.",
    preview: "A note from our team: the Linen Blazer is cut close. We'd love to ensure the perfect fit before we dispatch - shall we arrange an exchange?",
  },
];

function ToneCard({ tone, selected, onSelect }: {
  tone: typeof TONES[0]; selected: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={`w-full text-left rounded-lg border p-4 transition-all ${selected ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-fg-muted"}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${selected ? "border-primary" : "border-fg-muted"}`}>
          {selected && <span className="w-2 h-2 rounded-full bg-primary" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-fg">{tone.label}</p>
          </div>
          <p className="text-xs text-fg-muted mb-3">{tone.description}</p>
          <div className="rounded-lg bg-bg border border-border p-3">
            <p className="text-xs text-fg-muted font-mono leading-relaxed">"{tone.preview}"</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function LivePreview({ tone }: { tone: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/generate-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: "Linen Blazer",
        signals: ["Ordered S, M & L simultaneously", "First-time buyer"],
        channel: "sms",
        buyerName: "Sarah",
        tone,
      }),
    });
    const data = await res.json() as { message?: string };
    setMessage(data.message ?? null);
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-fg">Live preview</p>
          <p className="text-xs text-fg-muted">Generate a real message with the selected tone</p>
        </div>
        <button type="button" onClick={generate} disabled={loading}
          className="text-xs font-medium text-primary-fg bg-primary rounded px-3 py-1.5 hover:brightness-110 disabled:opacity-50 transition">
          {loading ? "Generating…" : "Generate sample"}
        </button>
      </div>
      {message && (
        <div className="mt-2 rounded-lg bg-surface border border-border p-3 text-sm text-fg leading-relaxed">
          {message}
        </div>
      )}
    </div>
  );
}

function MessagesSettings() {
  const { loaderData } = useRouteContext({ from: "/settings" }) as any;
  const s = loaderData?.settings;

  const [tone, setTone] = useState<"helpful" | "concise" | "premium">(s?.tone ?? "helpful");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone }),
    });
    setSaving(false);
    toast.success("Message settings saved");
  }

  return (
    <>
      <SettingsSection
        title="Message tone"
        description="Controls how the AI agent writes every intervention message. Each buyer gets a personalised version."
      >
        <div className="space-y-3">
          {TONES.map((t) => (
            <ToneCard
              key={t.id}
              tone={t}
              selected={tone === t.id}
              onSelect={() => setTone(t.id as typeof tone)}
            />
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Preview"
        description="See exactly what the agent would say on a real high-risk order."
      >
        <LivePreview tone={tone} />
      </SettingsSection>

      <SettingsSection
        title="SMS guidelines"
        description="What the agent follows when sending text messages."
      >
        <div className="rounded-lg border border-border bg-surface divide-y divide-border">
          {[
            { label: "Max length", value: "160 characters (1 SMS credit per message)" },
            { label: "Sender", value: "Masked number - replies route back to the agent" },
            { label: "Opt-out", value: "Buyer can reply STOP at any time" },
            { label: "Timing", value: "Sent within 2 hours of order placement" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-fg-muted">{row.label}</p>
              <p className="text-sm text-fg font-medium">{row.value}</p>
            </div>
          ))}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button type="button" onClick={save} disabled={saving}
          className="text-sm font-medium text-primary-fg bg-primary rounded px-5 py-2 hover:brightness-110 disabled:opacity-50 transition">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
