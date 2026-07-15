import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
// Prototype-faithful CSS for the .spin-start hero (proto.css supplies the .cc token aliases).
import "~/components/command-center/proto.css";
import "~/components/command-center/spin-proto.css";
import { GuardrailMenu } from "~/components/guardrail-menu";
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
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const t = thought.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            const { id } = await startSpin({ data: { thought: t, preset } });
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
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
