import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER - the portfolio grid (company tiles w/ status + slice). Lane: companies.
export const Route = createFileRoute("/companies/")({
    component: () => (
        <AppShell active="companies">
            <Placeholder
                kicker="// Companies"
                title="Portfolio"
                sub="Every company you've started - status, MRR, current slice."
                lane="companies"
            />
        </AppShell>
    ),
});
