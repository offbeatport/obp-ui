import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { getAiTaskConfigs, updateAiTaskConfig, AI_TASK_LABELS } from "~/lib/ai-config-fns";
import type { AiTaskConfig } from "~/db/schema";
import { Button } from "~/components/ui/Button";
import { Input } from "~/components/ui/Input";
import { SectionHeader } from "./-_shared";

export const Route = createFileRoute("/settings/ai-models")({
  loader: () => getAiTaskConfigs(),
  staleTime: 30_000,
  component: AiModelsSection,
});

const LABEL: React.CSSProperties = {
  fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--fg-subtle)", display: "block", marginBottom: 5,
};
const CARD: React.CSSProperties = {
  background: "var(--bg-elevated)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "16px 18px", marginBottom: 12,
};

function TaskRow({ cfg }: { cfg: AiTaskConfig }) {
  const meta = AI_TASK_LABELS[cfg.taskKey] ?? { label: cfg.taskKey, desc: "" };
  const [tool, setTool] = useState<"cli" | "openrouter">(cfg.tool);
  const [cliBin, setCliBin] = useState(cfg.cliBin ?? "");
  const [model, setModel] = useState(cfg.model ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateAiTaskConfig({ data: { taskKey: cfg.taskKey, tool, cliBin: cliBin.trim() || null, model: model.trim() || null } });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--fg)" }}>{meta.label}</div>
          <div style={{ fontSize: "0.74rem", color: "var(--fg-subtle)", marginTop: 2 }}>{meta.desc}</div>
        </div>
        <Button variant="primary" size="sm" onClick={save} disabled={saving} style={{ fontSize: "0.74rem" }}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </Button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", gap: 12, alignItems: "end" }}>
        <div>
          <label style={LABEL}>Tool</label>
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as "cli" | "openrouter")}
            style={{ width: "100%", height: 34, padding: "0 8px", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", color: "var(--fg)", fontFamily: "inherit", fontSize: "0.82rem" }}
          >
            <option value="cli">Local CLI (claude -p)</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </div>
        <div>
          <label style={LABEL}>{tool === "cli" ? "CLI binary (optional)" : "Model (optional)"}</label>
          {tool === "cli"
            ? <Input value={cliBin} onChange={(e) => setCliBin(e.target.value)} placeholder="claude (default) · codex" />
            : <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="anthropic/claude-sonnet-4-5" />}
        </div>
        <div>
          <label style={LABEL}>{tool === "cli" ? "CLI model (optional)" : ""}</label>
          {tool === "cli"
            ? <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="--model (default subscription model)" />
            : <span style={{ fontSize: "0.7rem", color: "var(--fg-dim)" }}>Uses OpenRouter API key from API Keys settings.</span>}
        </div>
      </div>
    </div>
  );
}

function AiModelsSection() {
  const configs = Route.useLoaderData();
  return (
    <div style={{ maxWidth: 760 }}>
      <SectionHeader title="AI Models" desc="Route each task category to a local CLI (default: claude -p) or OpenRouter, with an optional model override. Build can use codex; summaries can use a cheap model." />
      {configs.map((c) => <TaskRow key={c.taskKey} cfg={c} />)}
    </div>
  );
}
