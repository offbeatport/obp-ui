import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useProjectContext } from "~/lib/project-context";
import { Button } from "~/components/ui/Button";
import { SectionLabel } from "../$id";
import { Hammer, Send, BarChart2, CheckCircle2, Circle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/products/$id/")({
  pendingMs: 0,
  pendingComponent: () => null,
  component: ProductOverview,
});

type HealthResult =
  | { ok: true; statusCode: number; latencyMs: number }
  | { ok: false; statusCode: number; error: string };

function ProductOverview() {
  const { product, project } = useProjectContext();
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [checking, setChecking] = useState(false);

  if (!product) return null;

  async function checkHealth() {
    if (!product?.domain) return;
    setChecking(true);
    setHealth(null);
    try {
      const res = await fetch(`/api/health-check?domain=${encodeURIComponent(product.domain)}`);
      setHealth(await res.json());
    } catch {
      setHealth({ ok: false, statusCode: 0, error: "network error" });
    } finally {
      setChecking(false);
    }
  }

  const checks = [
    { label: "Domain set", done: !!product.domain, value: product.domain },
    { label: "Repository linked", done: !!product.repoUrl, value: product.repoUrl },
    { label: "Deployed", done: product.deployStatus === "deployed", value: product.deployStatus ?? "draft" },
    { label: "Checkout URL", done: !!product.checkoutUrl, value: product.checkoutUrl },
    { label: "Design direction", done: !!product.designDirection, value: null },
  ];

  const id = String(product.id);

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 680, padding: "32px" }}>
        <SectionLabel>Product</SectionLabel>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>{product.name}</div>
        {project?.hypothesis && <div style={{ fontSize: "0.84rem", color: "var(--fg-subtle)", marginBottom: 20 }}>{project.hypothesis}</div>}

        {/* Domain health */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Domain health</SectionLabel>
          <div style={{ padding: "16px 18px", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", gap: 14 }}>
            {product.domain ? (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 6 }}>
                    {product.domain}
                    <a href={`https://${product.domain}`} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(165,182,214,0.35)", display: "flex" }}><ExternalLink size={11} /></a>
                  </div>
                  {health !== null && (
                    <div style={{ fontSize: "0.78rem", marginTop: 3, color: health.ok ? "var(--success)" : "var(--danger)" }}>
                      {health.ok ? `Live · ${health.statusCode} · ${health.latencyMs}ms` : `Down · ${health.error}`}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={checkHealth} disabled={checking}>{checking ? "Checking…" : "Check"}</Button>
              </>
            ) : (
              <span style={{ fontSize: "0.84rem", color: "var(--fg-subtle)" }}>No domain set yet.</span>
            )}
          </div>
        </div>

        {/* Config checklist */}
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Setup</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {checks.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.84rem" }}>
                {c.done ? <CheckCircle2 size={15} style={{ color: "var(--success)" }} /> : <Circle size={15} style={{ color: "rgba(165,182,214,0.3)" }} />}
                <span style={{ color: c.done ? "var(--fg)" : "var(--fg-subtle)" }}>{c.label}</span>
                {c.value && <span style={{ color: "var(--fg-dim)", fontSize: "0.78rem", marginLeft: "auto" }}>{String(c.value).slice(0, 40)}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="primary" size="sm" onClick={() => navigate({ to: "/products/$id/build", params: { id } })}><Hammer size={13} /> Build</Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/products/$id/distribution", params: { id } })}><Send size={13} /> Distribution</Button>
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/products/$id/measure", params: { id } })}><BarChart2 size={13} /> Monitor</Button>
        </div>
      </div>
    </div>
  );
}
