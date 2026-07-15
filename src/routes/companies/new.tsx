import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
// Prototype-faithful CSS for the .spin-start hero (proto.css supplies the .cc token aliases).
import "~/components/command-center/proto.css";
import "~/components/command-center/spin-proto.css";
import { GuardrailMenu } from "~/components/guardrail-menu";
import { type Guardrails, resolveGuardrails } from "~/config/spin";
import { startSpin } from "~/server/actions";
import { getBootState } from "~/server/agents";

export const Route = createFileRoute("/companies/new")({
    beforeLoad: async () => {
        const boot = await getBootState();
        if (boot.deployment === "self-host" && !boot.onboarded) {
            throw redirect({ to: "/onboarding" });
        }
    },
    component: NewCompany,
});

// The composer — the ONLY step at /companies/new. "Spin up" creates a DRAFT company and routes to
// its page (/companies/<id>), where the incubation chat (scout → proposals → spec → approve) lives.
function NewCompany() {
    const navigate = useNavigate();
    const [thought, setThought] = useState("");
    const [preset, setPreset] = useState("lean");
    // Custom-guardrail fields (only used/sent when preset === "custom"). budget "" = unset.
    const [budget, setBudget] = useState("");
    const [mode, setMode] = useState<"test" | "live">("test");
    const [constraints, setConstraints] = useState("");
    const [busy, setBusy] = useState(false);

    // Build the guardrails to send. For a preset the server re-resolves the canonical values, so we
    // only send the key; for "custom" we send the founder's fields (resolveGuardrails trims them).
    const buildGuardrails = (): Guardrails =>
        preset === "custom"
            ? resolveGuardrails("custom", {
                  budgetUsd: budget.trim() === "" ? undefined : Number(budget),
                  mode,
                  constraints: constraints.split("\n"),
              })
            : { preset };

    const submit = async () => {
        const t = thought.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            const { id } = await startSpin({ data: { thought: t, guardrails: buildGuardrails() } });
            await navigate({ to: "/companies/$slug", params: { slug: id } });
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell active="companies">
            <div className="cc dash-mode">
                <div className="spin spin-start">
                    <div className="spin-hero">
                        <div className="spin-hero-eyebrow mono">{"// thought → company"}</div>
                        <h1 className="spin-hero-q">Start your new AI company</h1>
                        <p className="spin-hero-sub">I'll find the opportunities</p>

                        <div className="spin-hero-box">
                            <textarea
                                id="spin-thought"
                                rows={2}
                                value={thought}
                                onChange={(e) => setThought(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        void submit();
                                    }
                                }}
                                placeholder="What are you passionate about?"
                            />
                            <div className="spin-hero-actions">
                                <span style={{ marginRight: "auto" }}>
                                    <GuardrailMenu value={preset} onChange={setPreset} />
                                </span>
                                <button
                                    className="spin-hero-send"
                                    type="button"
                                    onClick={() => void submit()}
                                    disabled={busy || !thought.trim()}
                                    aria-label="Send to agent"
                                >
                                    {busy ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 19V5M5 12l7-7 7 7" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {preset === "custom" && (
                            <CustomGuardrails
                                budget={budget}
                                setBudget={setBudget}
                                mode={mode}
                                setMode={setMode}
                                constraints={constraints}
                                setConstraints={setConstraints}
                            />
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

// The "Custom…" guardrail editor — revealed under the composer when that preset is picked. Budget
// cap, test/live start mode, and free-form constraints, all fed to the scout + spec AI prompts.
function CustomGuardrails({
    budget,
    setBudget,
    mode,
    setMode,
    constraints,
    setConstraints,
}: {
    budget: string;
    setBudget: (v: string) => void;
    mode: "test" | "live";
    setMode: (v: "test" | "live") => void;
    constraints: string;
    setConstraints: (v: string) => void;
}) {
    return (
        <div className="mx-auto mt-3 grid w-full max-w-[640px] gap-4 rounded-xl border border-border bg-card/60 p-4 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Monthly budget</span>
                    <span className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 focus-within:border-primary">
                        <span className="text-sm text-muted-foreground">$</span>
                        <input
                            type="number"
                            min={0}
                            step={50}
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            placeholder="unset"
                            className="w-full bg-transparent py-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-muted-foreground">/mo</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                        Leave blank for no cap · 0 = free tools only
                    </span>
                </label>

                <div className="grid gap-1.5">
                    <span className="text-xs font-semibold text-foreground">Start mode</span>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
                        {(["test", "live"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition-colors ${
                                    mode === m
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {m === "test" ? "Test-mode" : "Charge day one"}
                            </button>
                        ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                        {mode === "test"
                            ? "Stripe test-mode — no real charges yet"
                            : "Real payments from launch"}
                    </span>
                </div>
            </div>

            <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-foreground">Constraints</span>
                <textarea
                    rows={3}
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                    placeholder={
                        "One rule per line, e.g.\ntarget agencies, not consumers\nno regulated industries"
                    }
                    className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-primary"
                />
                <span className="text-[11px] text-muted-foreground">
                    The agent must honor these while scouting and building.
                </span>
            </label>
        </div>
    );
}
