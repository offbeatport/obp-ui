import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { ArrowUp, Loader2 } from "lucide-react";
import { useState } from "react";
import { AppShell } from "~/components/app-shell";
import { GuardrailMenu } from "~/components/guardrail-menu";
import { Textarea } from "~/components/ui/textarea";
import { createCompany } from "~/server/actions";
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

// The thought → company composer (was the old home). Lane: home.
function NewCompany() {
    const navigate = useNavigate();
    const [thought, setThought] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const t = thought.trim();
        if (!t || busy) return;
        setBusy(true);
        try {
            await createCompany({ data: { thought: t } });
            navigate({ to: "/companies" });
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell active="companies">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16">
                <div className="mb-2 text-center font-mono text-xs uppercase tracking-[0.14em] text-faint">
                    {"// Thought → Company"}
                </div>
                <h1 className="text-center font-display text-4xl font-light tracking-tight">
                    Start your new AI company
                </h1>
                <p className="mt-4 text-center text-lg text-muted-foreground">
                    I'll find the opportunities
                </p>

                {/* composer */}
                <div className="mt-9 rounded-[1.25rem] border bg-card p-2 shadow-e1 transition focus-within:ring-2 focus-within:ring-primary/50">
                    <Textarea
                        value={thought}
                        onChange={(e) => setThought(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void submit();
                            }
                        }}
                        placeholder="What are you passionate about?"
                        className="min-h-24 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                        <GuardrailMenu />
                        <button
                            type="button"
                            onClick={() => void submit()}
                            disabled={busy || !thought.trim()}
                            aria-label="Create company"
                            className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
                        >
                            {busy ? (
                                <Loader2 className="size-5 animate-spin" />
                            ) : (
                                <ArrowUp className="size-5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
