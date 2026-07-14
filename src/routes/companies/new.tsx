import { createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { GuardrailMenu } from "~/components/guardrail-menu";
import { Textarea } from "~/components/ui/textarea";
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
                        placeholder="What are you passionate about?"
                        className="min-h-24 resize-none border-0 bg-transparent px-4 py-3 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                        <GuardrailMenu />
                        <button
                            type="button"
                            aria-label="Find opportunities"
                            className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground transition hover:scale-105 active:scale-95"
                        >
                            <ArrowUp className="size-5" />
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
