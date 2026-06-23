import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getDistributionPlaybooks, updateDistributionPlaybook } from "~/lib/project-fns";
import type { DistributionPlaybook } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { SectionHeader, LABEL, CARD } from "./-_shared";

export const Route = createFileRoute("/settings/distribution-playbooks")({
  loader: async () => ({ playbooks: await getDistributionPlaybooks() }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => null,
  component: DistributionPlaybooksPage,
});

const EFFORT_COLORS: Record<string, string> = {
  "one-time": "rgba(96,165,250,0.6)",
  "ongoing": "rgba(245,158,11,0.7)",
};

function PlaybookEditor({ playbook, onSave, onCancel, busy }: {
  playbook: DistributionPlaybook;
  onSave: (data: { description: string; whyItWorks: string }) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [description, setDescription] = useState(playbook.description);
  const [whyItWorks, setWhyItWorks] = useState(playbook.whyItWorks);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={LABEL}>Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.84rem", padding: "7px 10px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "rgba(250,250,250,0.25)" }}>
          One-line summary shown on the strategy card.
        </p>
      </div>
      <div>
        <label style={LABEL}>Why it works</label>
        <textarea value={whyItWorks} onChange={e => setWhyItWorks(e.target.value)} rows={3}
          style={{ width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg-muted)", fontSize: "0.82rem", padding: "7px 10px", fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }} />
        <p style={{ margin: "5px 0 0", fontSize: "0.70rem", color: "rgba(250,250,250,0.25)" }}>
          Your reasoning for including this strategy - shown when reviewing generated content.
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" size="sm" onClick={() => onSave({ description, whyItWorks })} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function DistributionPlaybooksPage() {
  const { playbooks: initial } = Route.useLoaderData() as { playbooks: DistributionPlaybook[] };
  const [playbooks, setPlaybooks] = useState(initial);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(id: number, data: { description: string; whyItWorks: string }) {
    setBusy(true);
    try {
      await updateDistributionPlaybook({ data: { id, ...data } });
      setPlaybooks(prev => prev.map(p => p.id === id ? { ...p, ...data, updatedAt: new Date() } : p));
      setEditingId(null);
    } finally { setBusy(false); }
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px 60px" }}>
      <div style={{ maxWidth: 720 }}>
        <SectionHeader
          title="Distribution Playbooks"
          desc="Global distribution strategies. Names are fixed - they identify the AI generation logic. Edit descriptions and reasoning to match your approach."
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {playbooks.map(p => {
            return (
              <div key={p.id} style={CARD}>
                {editingId === p.id ? (
                  <PlaybookEditor playbook={p} busy={busy}
                    onSave={(data) => handleSave(p.id, data)}
                    onCancel={() => setEditingId(null)} />
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: "0.90rem", fontWeight: 600, color: "var(--fg)" }}>{p.name}</span>
                          <span style={{
                            fontSize: "0.60rem", fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                            color: EFFORT_COLORS[p.effort] ?? "var(--fg-subtle)",
                            border: `1px solid ${EFFORT_COLORS[p.effort] ?? "var(--border)"}44`,
                            background: `${EFFORT_COLORS[p.effort] ?? "var(--border)"}10`,
                          }}>
                            {p.effort}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.80rem", color: "var(--fg-subtle)", lineHeight: 1.5 }}>{p.description}</p>
                        {p.whyItWorks && (
                          <p style={{ margin: "6px 0 0", fontSize: "0.74rem", color: "rgba(250,250,250,0.3)", lineHeight: 1.55, fontStyle: "italic" }}>
                            {p.whyItWorks.length > 180 ? p.whyItWorks.slice(0, 178) + "…" : p.whyItWorks}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditingId(p.id)} style={{ flexShrink: 0 }}>
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
