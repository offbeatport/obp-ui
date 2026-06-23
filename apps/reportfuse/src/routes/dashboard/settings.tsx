import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "../../lib/auth-client";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session } = useSession();

  return (
    <div className="max-w-lg px-8 py-8">
      <h2 className="text-base font-semibold text-fg mb-6">Settings</h2>

      <section className="mb-8">
        <h3 className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-3">Account</h3>
        <div className="border border-border divide-y divide-border">
          <Row label="Email" value={session?.user.email ?? "-"} />
          <Row label="Name" value={session?.user.name ?? "-"} />
          <Row label="Plan" value="Free" />
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xs font-mono text-fg-subtle uppercase tracking-widest mb-3">Usage</h3>
        <div className="border border-border divide-y divide-border">
          <Row label="Your daily limit" value="10 normalizations / day" />
          <Row label="Anonymous (no account)" value="3 / day" />
          <Row label="Pro" value="Unlimited" />
        </div>
        <p className="text-xs text-fg-subtle mt-3 font-mono">
          <a href="/pricing" className="text-primary hover:underline">Upgrade to Pro</a> for unlimited runs and a full year of history.
        </p>
      </section>

    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-xs text-fg">{value}</span>
    </div>
  );
}
