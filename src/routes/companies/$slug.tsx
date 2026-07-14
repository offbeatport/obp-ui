import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER — one company's workspace: co-pilot chat + its dashboard. Lane: companies.
export const Route = createFileRoute("/companies/$slug")({
    component: CompanyWorkspace,
});

function CompanyWorkspace() {
    const { slug } = Route.useParams();
    return (
        <AppShell active="companies">
            <Placeholder
                kicker="// Company"
                title={slug}
                sub="Co-pilot chat, live product, slices & the company dashboard."
                lane="companies"
            />
        </AppShell>
    );
}
