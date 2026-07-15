import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
import {
    type GuardRow,
    GuardrailLedger,
    defaultRows,
    rowsToGuardrails,
} from "~/components/guardrail-ledger";
import { GuardrailMenu } from "~/components/guardrail-menu";
import type { Guardrails } from "~/config/spin";
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
    // The custom Guardrail Ledger rows (only used/sent when preset === "custom").
    const [rows, setRows] = useState<GuardRow[]>(defaultRows);
    const [busy, setBusy] = useState(false);

    // Build the guardrails to send. For a preset the server re-resolves the canonical values, so we
    // only send the key; for "custom" we serialize the ledger rows into Guardrails.
    const buildGuardrails = (): Guardrails =>
        preset === "custom" ? rowsToGuardrails(rows) : { preset };

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
            <div className="mx-auto flex min-h-[calc(100vh-120px)] w-full max-w-[680px] flex-col justify-center px-5 pb-3.5">
                <div className="text-center">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                        {"// thought → company"}
                    </div>
                    <h1 className="my-2.5 font-display text-[42px] font-light leading-[2.05] tracking-[-0.025em] text-foreground">
                        Start your new AI company
                    </h1>
                    <p className="mx-auto mt-3.5 mb-[30px] max-w-[520px] text-base leading-[1.6] text-muted-foreground">
                        I'll find the opportunities
                    </p>

                    <div className="rounded-xl border border-border bg-card p-5 text-left shadow-e2 transition-colors focus-within:border-primary">
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
                            className="block w-full resize-none border-0 bg-transparent text-base leading-[1.5] text-foreground outline-none placeholder:text-faint"
                        />
                        <div className="mt-2 flex items-center justify-end gap-2.5">
                            <span className="mr-auto">
                                <GuardrailMenu value={preset} onChange={setPreset} />
                            </span>
                            <button
                                type="button"
                                onClick={() => void submit()}
                                disabled={busy || !thought.trim()}
                                aria-label="Send to agent"
                                className="grid size-10 flex-none place-items-center rounded-full bg-primary text-white shadow-[0_2px_8px_-1px_rgba(200,100,60,0.5)] transition hover:-translate-y-px hover:brightness-[1.06] active:translate-y-0 disabled:opacity-40"
                            >
                                {busy ? (
                                    <Loader2 className="size-[18px] animate-spin" />
                                ) : (
                                    <svg
                                        viewBox="0 0 24 24"
                                        className="size-[18px]"
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

                    {preset === "custom" && <GuardrailLedger rows={rows} onChange={setRows} />}
                </div>
            </div>
        </AppShell>
    );
}
