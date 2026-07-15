import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER - portfolio-wide guardrails (budget caps, test/live mode, constraints the agents
// must respect across every company). Lane: guardrails.
export const Route = createFileRoute("/guardrails")({
    component: () => (
        <AppShell active="guardrails">
            <Placeholder
                kicker="// Guardrails"
                title="Guardrails"
                sub="The budget caps, spend limits and rules every company's agents must respect."
                lane="guardrails"
            />
        </AppShell>
    ),
});
