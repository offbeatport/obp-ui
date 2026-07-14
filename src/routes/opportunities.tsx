import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER — the opportunities feed (ranked bets → promote to a company). Lane: surfaces.
export const Route = createFileRoute("/opportunities")({
    component: () => (
        <AppShell active="opportunities">
            <Placeholder
                kicker="// Opportunities"
                title="Opportunities"
                sub="Ranked demand signals — promote one to start a company."
                lane="surfaces"
            />
        </AppShell>
    ),
});
