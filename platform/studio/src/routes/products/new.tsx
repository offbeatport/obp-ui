import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { checkDomainAvailability, getTechStacks } from "~/lib/project-fns";
import type { DomainAvailabilityResult } from "~/lib/project-fns";
import { getOpportunityById } from "~/lib/server-fns";
import { provisionProduct } from "~/lib/product-fns";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { Check, Circle, Loader2, Search, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/products/new")({
  validateSearch: (s: Record<string, unknown>) => ({
    opportunityId: s.opportunityId ? Number(s.opportunityId) : undefined,
  }),
  loaderDeps: ({ search }) => ({ opportunityId: search.opportunityId }),
  loader: async ({ deps }) => {
    const stacks = await getTechStacks();
    const opp = deps.opportunityId ? await getOpportunityById({ data: { id: deps.opportunityId } }) : null;
    return { stacks, opp };
  },
  component: NewProductPage,
});

const TLDS = [".com", ".io", ".app", ".dev", ".co"];

function NewProductPage() {
  const { stacks, opp } = Route.useLoaderData();
  const { opportunityId } = Route.useSearch();
  const navigate = useNavigate();

  const [name, setName] = useState(opp?.title ?? "");
  const [domainBase, setDomainBase] = useState("");
  const [results, setResults] = useState<DomainAvailabilityResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [chosenDomain, setChosenDomain] = useState<string | null>(null);
  const [techStackId, setTechStackId] = useState<number | null>(stacks.find((s) => s.isDefault)?.id ?? stacks[0]?.id ?? null);
  const [creating, setCreating] = useState(false);

  const slug = (domainBase || name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 30);

  async function searchDomains() {
    if (!slug) return;
    setSearching(true);
    setResults(null);
    try {
      const domains = TLDS.map((t) => `${slug}${t}`);
      const res = await checkDomainAvailability({ data: { domains } });
      setResults(res);
    } finally {
      setSearching(false);
    }
  }

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const { productId } = await provisionProduct({
        data: {
          name: name.trim(),
          opportunityId,
          domain: chosenDomain ?? undefined,
          techStackId: techStackId ?? undefined,
        },
      });
      window.dispatchEvent(new Event("projects:changed"));
      navigate({ to: "/products/$id/spec", params: { id: String(productId) } });
    } finally {
      setCreating(false);
    }
  }

  const LABEL: React.CSSProperties = { fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 8 };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 32px 80px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.4rem", fontWeight: 700 }}>New Product</h1>
        <p style={{ margin: "0 0 28px", fontSize: "0.86rem", color: "var(--fg-subtle)" }}>
          Step 1 — Name &amp; domain. {opp ? <>Building from opportunity <strong style={{ color: "var(--fg)" }}>{opp.title}</strong>.</> : "Then you'll configure & build."}
        </p>

        {/* Name */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL}>Product name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. InvoiceFlow" autoFocus />
        </div>

        {/* Domain search */}
        <div style={{ marginBottom: 24 }}>
          <label style={LABEL}>Domain</label>
          <div style={{ display: "flex", gap: 8 }}>
            <Input value={domainBase} onChange={(e) => setDomainBase(e.target.value)} placeholder={slug || "yourbrand"} onKeyDown={(e) => { if (e.key === "Enter") searchDomains(); }} />
            <Button variant="outline" size="sm" onClick={searchDomains} disabled={searching || !slug}>
              {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Check
            </Button>
          </div>
          {results && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {results.map((r) => {
                const chosen = chosenDomain === r.domain;
                const selectable = r.available;
                return (
                  <button
                    key={r.domain}
                    onClick={() => selectable && setChosenDomain(chosen ? null : r.domain)}
                    disabled={!selectable}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                      background: chosen ? "rgba(0,255,136,0.08)" : "var(--bg-elevated)",
                      border: `1px solid ${chosen ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: "var(--radius)", cursor: selectable ? "pointer" : "default",
                      fontFamily: "inherit", textAlign: "left", opacity: selectable ? 1 : 0.5,
                    }}
                  >
                    {chosen ? <Check size={14} style={{ color: "var(--accent)" }} /> : <Circle size={14} style={{ color: "var(--fg-dim)" }} />}
                    <span style={{ flex: 1, fontSize: "0.86rem", color: "var(--fg)" }}>{r.domain}</span>
                    <span style={{ fontSize: "0.76rem", color: r.available ? "var(--success)" : "var(--fg-dim)" }}>
                      {r.unknown ? "unknown" : r.available ? `available · ${r.price ?? ""}` : "taken"}
                    </span>
                  </button>
                );
              })}
              <p style={{ margin: "4px 0 0", fontSize: "0.7rem", color: "var(--fg-dim)" }}>
                Domain is recorded as intent — purchase happens separately.
              </p>
            </div>
          )}
        </div>

        {/* Tech stack */}
        <div style={{ marginBottom: 32 }}>
          <label style={LABEL}>Tech stack</label>
          <select
            value={techStackId ?? ""}
            onChange={(e) => setTechStackId(e.target.value ? Number(e.target.value) : null)}
            style={{ width: "100%", height: 38, padding: "0 10px", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg)", fontFamily: "inherit", fontSize: "0.86rem" }}
          >
            {stacks.map((s) => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>)}
          </select>
        </div>

        <Button variant="primary" onClick={create} disabled={creating || !name.trim()} style={{ gap: 8 }}>
          {creating ? "Creating…" : <>Create &amp; configure build <ArrowRight size={15} /></>}
        </Button>
      </div>
    </div>
  );
}
