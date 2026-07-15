import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AgentsProvidersPanel, type PanelReady } from "~/components/agents-panel";
import { Logo } from "~/components/logo";
import { Button } from "~/components/ui/button";
import { completeOnboarding, saveConfig } from "~/server/agents";

// Chromeless first-run gate (self-host). Reuses the SAME AgentsProvidersPanel as Settings.
export const Route = createFileRoute("/onboarding")({
    component: Onboarding,
});

function Onboarding() {
    const router = useRouter();
    const [finishing, setFinishing] = useState(false);
    const [ready, setReady] = useState<PanelReady>({ claudeReady: false, canFinish: false });

    // The app is useless without a builder or a key, so entry is gated: no dead "skip".
    const { claudeReady, canFinish } = ready;

    const finish = async () => {
        setFinishing(true);
        await completeOnboarding();
        router.navigate({ to: "/" });
    };

    // Adopt the Claude subscription for build + thinking (the keyless default), then finish.
    const useClaude = async () => {
        setFinishing(true);
        await Promise.all([
            saveConfig({ data: { key: "ai.simple", value: "claude" } }),
            saveConfig({ data: { key: "ai.task.build.provider", value: "claude" } }),
        ]);
        await completeOnboarding();
        router.navigate({ to: "/" });
    };

    return (
        <div className="min-h-screen bg-background">
            <div className="mx-auto max-w-3xl px-6 py-16">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                    Welcome
                </div>
                <Logo className="py-3" />
                <h1 className="mt-6 font-display text-4xl font-light tracking-tight">
                    Pick your coding agent
                </h1>
                <p className="mt-3 max-w-xl font-serif text-[17px] italic text-muted-foreground">
                    C~Slop~Slop builds companies with a coding agent on your machine. Choose what
                    runs the work; you can change this anytime in Settings.
                </p>

                <div className="mt-10">
                    <AgentsProvidersPanel mode="onboarding" onReady={setReady} />
                </div>

                <div className="mt-10 flex items-center justify-between gap-4 border-t pt-6">
                    <div className="max-w-md text-xs text-muted-foreground">
                        {claudeReady
                            ? "Claude is detected & logged in - one click and you're ready."
                            : canFinish
                              ? "Your OpenRouter key is set - you're ready."
                              : "Log in to Claude Code on this host, or add an OpenRouter key above. C~Slop~Slop can't run without one."}
                    </div>
                    {claudeReady ? (
                        <Button onClick={useClaude} disabled={finishing}>
                            Use Claude Code
                        </Button>
                    ) : (
                        <Button onClick={finish} disabled={finishing || !canFinish}>
                            Finish
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
