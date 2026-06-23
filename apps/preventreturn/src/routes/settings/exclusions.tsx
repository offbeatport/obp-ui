import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@offbeatport/blocks/layouts";
import { Switch } from "@offbeatport/ui/ui/switch";
import { Input } from "@offbeatport/ui/ui/input";
import { Label } from "@offbeatport/ui/ui/label";

export const Route = createFileRoute("/settings/exclusions")({
  component: ExclusionsSettings,
});

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

function TagInput({ label, description, value, onChange, placeholder }: {
  label: string; description: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const tags = value.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium text-fg">{label}</Label>
        <p className="text-xs text-fg-muted mt-0.5">{description}</p>
      </div>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs bg-surface border border-border rounded px-2 py-0.5 text-fg">
              {tag}
              <button type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag).join(", "))}
                className="text-fg-muted hover:text-danger ml-0.5">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ExclusionsSettings() {
  const { loaderData } = useRouteContext({ from: "/settings" }) as any;
  const s = loaderData?.settings;

  const [excludeGifts, setExcludeGifts] = useState(s?.excludeGifts ?? false);
  const [excludeSale, setExcludeSale] = useState(s?.excludeSale ?? true);
  const [excludedProductTags, setExcludedProductTags] = useState("");
  const [excludedCustomerTags, setExcludedCustomerTags] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludeGifts, excludeSale }),
    });
    setSaving(false);
    toast.success("Exclusions saved");
  }

  return (
    <>
      <SettingsSection
        title="Order types"
        description="The agent will never send a message for these order types."
      >
        <div className="rounded-lg border border-border bg-surface px-5">
          <ToggleRow
            label="Skip gift orders"
            description="Orders shipping to a different address than billing - likely a gift"
            checked={excludeGifts}
            onCheckedChange={setExcludeGifts}
          />
          <ToggleRow
            label="Skip discounted orders"
            description="Products already on sale or discounted over 30% - buyer knowingly accepted the deal"
            checked={excludeSale}
            onCheckedChange={setExcludeSale}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Product tags"
        description="Skip intervention for products with these Shopify tags. Useful for digital products, pre-orders, or made-to-order items."
      >
        <TagInput
          label="Excluded product tags"
          description="Comma-separated. Matches any Shopify product tag."
          value={excludedProductTags}
          onChange={setExcludedProductTags}
          placeholder="digital, pre-order, custom, made-to-order"
        />
      </SettingsSection>

      <SettingsSection
        title="Customer tags"
        description="Skip intervention for customers with these Shopify tags. Useful for VIP or wholesale customers who shouldn't receive automated messages."
      >
        <TagInput
          label="Excluded customer tags"
          description="Comma-separated. Matches any Shopify customer tag."
          value={excludedCustomerTags}
          onChange={setExcludedCustomerTags}
          placeholder="vip, wholesale, staff, influencer"
        />
      </SettingsSection>

      <SettingsSection
        title="Repeat customers"
        description="Customers with a strong purchase history are lower-risk and may not need intervention."
      >
        <div className="rounded-lg border border-border bg-surface px-5">
          <ToggleRow
            label="Skip buyers with 5+ previous orders"
            description="Long-term customers know your sizing and are unlikely to return based on surprise"
            checked={false}
            onCheckedChange={() => { }}
          />
          <ToggleRow
            label="Skip buyers with 0% historical return rate"
            description="Buyers who have never returned are low-risk regardless of order signals"
            checked={false}
            onCheckedChange={() => { }}
          />
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
