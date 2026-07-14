import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER — the needs-you inbox (approvals, blocks, decisions). Lane: surfaces.
export const Route = createFileRoute("/inbox")({
    component: () => (
        <AppShell active="inbox">
            <Placeholder
                kicker="// Inbox"
                title="Needs you"
                sub="Approvals, blocked companies & decisions waiting on you."
                lane="surfaces"
            />
        </AppShell>
    ),
});
