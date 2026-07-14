import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { getBootState } from "~/server/agents";

export const Route = createFileRoute("/")({
    // Self-host first-run gate → onboarding (until an agent is picked).
    beforeLoad: async () => {
        const boot = await getBootState();
        if (boot.deployment === "self-host" && !boot.onboarded) {
            throw redirect({ to: "/onboarding" });
        }
    },
    component: Home,
});

// PLACEHOLDER — the command center (portfolio metrics · needs-you hero · companies · activity),
// per design/v2-prototypes/08-chat-spine-pro-v7.html (dashTpl1). Lane: home.
function Home() {
    return (
        <AppShell active="home">
            <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16 text-center">
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                    {"// Command center"}
                </div>
                <h1 className="mt-2 font-display text-4xl font-light tracking-tight">Home</h1>
                <p className="mt-3 text-muted-foreground">
                    Portfolio metrics, the one thing that needs you, companies & live activity land
                    here.
                </p>
                <p className="mt-1 font-mono text-xs text-faint">placeholder · lane: home</p>
            </div>
        </AppShell>
    );
}
