import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { createIdea } from "~/lib/project-fns";
import { Button } from "~/components/ui/Button";

export const Route = createFileRoute("/ideas/new")({
  component: NewIdeaPage,
});

const LOOKBACK_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
  { label: "365 days", value: 365 },
];

function NewIdeaPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [lookbackDays, setLookbackDays] = useState(90);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { id } = await createIdea({
        data: {
          name: name.trim(),
          hypothesis: hypothesis.trim() || undefined,
          lookbackDays,
        },
      });
      router.navigate({ to: "/ideas/$id", params: { id: String(id) } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      height: "calc(100vh - 40px)", display: "flex",
      justifyContent: "center", alignItems: "flex-start", overflowY: "auto",
    }}>
      <div style={{ width: "100%", maxWidth: 560, padding: "52px 28px" }}>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "1.15rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
            New idea
          </h2>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--fg-subtle)", lineHeight: 1.6 }}>
            Define your hypothesis. You will select communities and run analysis next.
          </p>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 18 }}>
          <label style={{
            display: "block", fontSize: "0.72rem", fontWeight: 700,
            letterSpacing: "0.09em", textTransform: "uppercase",
            color: "var(--fg-subtle)", marginBottom: 6,
          }}>
            Idea name
          </label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim()) submit(); }}
            placeholder="e.g. Reddit alert tool for SaaS founders"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)", color: "var(--fg)", fontSize: "0.90rem",
              padding: "10px 12px", fontFamily: "inherit", outline: "none",
            }}
          />
        </div>

        {/* Hypothesis */}
        <div style={{ marginBottom: 18 }}>
          <label style={{
            display: "block", fontSize: "0.72rem", fontWeight: 700,
            letterSpacing: "0.09em", textTransform: "uppercase",
            color: "var(--fg-subtle)", marginBottom: 6,
          }}>
            Hypothesis
          </label>
          <textarea
            value={hypothesis}
            onChange={e => setHypothesis(e.target.value)}
            placeholder="What problem does this solve? Who has it? Why now?"
            rows={4}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "var(--bg-elevated)", border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)", color: "var(--fg)", fontSize: "0.88rem",
              padding: "10px 12px", fontFamily: "inherit", outline: "none",
              resize: "none", lineHeight: 1.6,
            }}
          />
        </div>

        {/* Lookback */}
        <div style={{ marginBottom: 28 }}>
          <label style={{
            display: "block", fontSize: "0.72rem", fontWeight: 700,
            letterSpacing: "0.09em", textTransform: "uppercase",
            color: "var(--fg-subtle)", marginBottom: 8,
          }}>
            Signal lookback period
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {LOOKBACK_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLookbackDays(opt.value)}
                style={{
                  padding: "5px 12px",
                  background: lookbackDays === opt.value ? "rgba(96,165,250,0.12)" : "transparent",
                  border: `1px solid ${lookbackDays === opt.value ? "var(--accent)" : "var(--border-strong)"}`,
                  borderRadius: "var(--radius)", cursor: "pointer", fontFamily: "inherit",
                  fontSize: "0.80rem",
                  color: lookbackDays === opt.value ? "var(--accent)" : "var(--fg-subtle)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Button
            variant="primary"
            size="md"
            disabled={busy || !name.trim()}
            onClick={submit}
          >
            {busy ? "Creating…" : "Create idea →"}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => router.history.back()}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
