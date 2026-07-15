import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER - global/portfolio-level chat threads. Lane: chats.
export const Route = createFileRoute("/chats/")({
    component: () => (
        <AppShell active="chats">
            <Placeholder
                kicker="// Chats"
                title="Chats"
                sub="Portfolio-level threads - direct the whole operation, not one company."
                lane="chats"
            />
        </AppShell>
    ),
});
