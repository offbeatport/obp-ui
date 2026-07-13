import { createFileRoute } from "@tanstack/react-router";
import { AgentsProvidersPanel } from "~/components/agents-panel";

export const Route = createFileRoute("/settings/agents")({
    component: () => <AgentsProvidersPanel mode="settings" />,
});
