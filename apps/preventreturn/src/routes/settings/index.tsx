import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@offbeatport/blocks/layouts";
import { Switch } from "@offbeatport/ui/ui/switch";
import { Label } from "@offbeatport/ui/ui/label";

export const Route = createFileRoute("/settings/")({
  component: AgentSettings,
});

function SliderField({ label, description, value, min, max, step = 1, format, onChange }: {
  label: string; description: string; value: number; min: number; max: number;
  step?: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium text-fg">{label}</Label>
          <p className="text-xs text-fg-muted mt-0.5">{description}</p>
        </div>
        <span className="text-sm font-semibold text-primary tabular-nums min-w-[3rem] text-right">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-1.5 rounded-full bg-border cursor-pointer" />
      <div className="flex justify-between text-[10px] text-fg-muted">
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onCheckedChange }: {
  label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-muted mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function AgentSettings() {
  const { loaderData } = useRouteContext({ from: "/settings" }) as any;
  const s = loaderData?.settings;

  const [riskThreshold, setRiskThreshold] = useState(s?.riskThreshold ?? 70);
  const [minOrderValue, setMinOrderValue] = useState(s?.minOrderValue ?? 40);
  const [useSms, setUseSms] = useState(s?.channelSms ?? true);
  const [useEmail, setUseEmail] = useState(s?.channelEmail ?? false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskThreshold, minOrderValue, channelSms: useSms, channelEmail: useEmail }),
    });
    setSaving(false);
    toast.success("Agent settings saved");
  }

  const estimatedDaily = Math.round(((100 - riskThreshold) / 100) * 14);

  return (
    <>
      <SettingsSection title="Sensitivity" description="How aggressively the agent intervenes.">
        <div className="rounded-lg border border-border bg-surface p-5 space-y-6">
          <SliderField
            label="Risk threshold"
            description={`Intervene when risk score is above this. Currently ~${estimatedDaily} orders/day.`}
            value={riskThreshold} min={50} max={95}
            format={(v) => `${v}+`} onChange={setRiskThreshold}
          />
          <SliderField
            label="Minimum order value"
            description="Skip orders below this - not worth the intervention risk."
            value={minOrderValue} min={0} max={200} step={5}
            format={(v) => `$${v}`} onChange={setMinOrderValue}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Channels" description="Where the agent reaches out. SMS has higher open rates.">
        <div className="rounded-lg border border-border bg-surface px-5">
          <ToggleRow label="SMS" description="Texts the buyer's phone number from a masked number" checked={useSms} onCheckedChange={setUseSms} />
          <ToggleRow label="Email" description="Sends from your store's reply-to address" checked={useEmail} onCheckedChange={setUseEmail} />
        </div>
        {!useSms && !useEmail && (
          <p className="text-xs text-danger">At least one channel must be enabled for the agent to send messages.</p>
        )}
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
