import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Switch } from "~/components/ui/switch";
import { getAgentConfig, saveConfig } from "~/server/agents";

export const Route = createFileRoute("/settings/guardrails")({
    component: Guardrails,
});

// Same keys as the composer's guardrail presets (do not fork).
const PRESETS = [
    { key: "lean", label: "Lean & safe", desc: "≤ $500 cap · test-mode · avoid regulated" },
    { key: "fast", label: "Move fast", desc: "≤ $2k cap · charge day one" },
    { key: "boot", label: "Bootstrap", desc: "$0 spend · no deadline" },
    { key: "custom", label: "Custom", desc: "Set the cap yourself" },
];

function Guardrails() {
    const [cfg, setCfg] = useState<Awaited<ReturnType<typeof getAgentConfig>> | null>(null);
    useEffect(() => {
        void getAgentConfig().then(setCfg);
    }, []);
    const save = (key: string, value: unknown) => {
        setCfg((c) => (c ? { ...c, [key.split(".")[1]]: value } : c));
        void saveConfig({ data: { key, value } });
    };
    if (!cfg) return null;

    return (
        <div className="max-w-lg space-y-8">
            <section>
                <h3 className="mb-1 text-[15px] font-semibold">Default preset</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                    Applied to new companies. Every message/money action still waits for your
                    approval.
                </p>
                <RadioGroup
                    value={cfg.guardrailPreset}
                    onValueChange={(v) => save("guardrails.preset", v)}
                    className="gap-2"
                >
                    {PRESETS.map((p) => (
                        <Label
                            key={p.key}
                            htmlFor={`g-${p.key}`}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 hover:bg-primary/[0.04]"
                        >
                            <RadioGroupItem id={`g-${p.key}`} value={p.key} className="mt-0.5" />
                            <span>
                                <span className="block text-[13px] font-semibold">{p.label}</span>
                                <span className="block text-xs text-muted-foreground">
                                    {p.desc}
                                </span>
                            </span>
                        </Label>
                    ))}
                </RadioGroup>
            </section>

            <section className="grid gap-2">
                <Label htmlFor="cap">Budget cap (USD, per-company cumulative)</Label>
                <Input
                    id="cap"
                    type="number"
                    defaultValue={cfg.budgetCapUsd ?? ""}
                    placeholder="e.g. 500"
                    onBlur={(e) =>
                        save(
                            "guardrails.budget_cap_usd",
                            e.target.value ? Number(e.target.value) : null,
                        )
                    }
                />
                <span className="text-xs text-muted-foreground">
                    Sum of run costs on a company; hitting it pauses autopilot back to L0.
                </span>
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4">
                <div>
                    <div className="text-[13px] font-semibold">Autopilot (L1)</div>
                    <div className="text-xs text-muted-foreground">
                        Reversible code actions auto-ship on green. Message/money always wait for
                        you.
                    </div>
                </div>
                <Switch
                    checked={cfg.autopilot === "on"}
                    onCheckedChange={(v) => save("guardrails.autopilot", v ? "on" : "off")}
                />
            </section>

            <section className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4 opacity-70">
                <div>
                    <div className="text-[13px] font-semibold">Payments - test-mode</div>
                    <div className="text-xs text-muted-foreground">
                        Stripe test-mode only in v1. Going live is a separate money action (later).
                    </div>
                </div>
                <Switch checked disabled />
            </section>
        </div>
    );
}
