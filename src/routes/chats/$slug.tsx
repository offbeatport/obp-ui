import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "~/components/app-shell";
import { Placeholder } from "~/components/placeholder";

// PLACEHOLDER - one global chat thread. Lane: chats.
export const Route = createFileRoute("/chats/$slug")({
    component: Chat,
});

function Chat() {
    const { slug } = Route.useParams();
    return (
        <AppShell active="chats">
            <Placeholder kicker="// Chat" title={slug} sub="A single global thread." lane="chats" />
        </AppShell>
    );
}
