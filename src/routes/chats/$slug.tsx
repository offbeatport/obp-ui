import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { ChatThread } from "~/components/command-center/chat";
import { type ChatMessage, listChats } from "~/server/data";

// A single global thread. The contract exposes thread summaries only, so we open on the
// user's question and let the co-pilot reply — the thread stays live from there.
export const Route = createFileRoute("/chats/$slug")({
    loader: async ({ params }) => {
        const chats = await listChats();
        return { chat: chats.find((c) => c.slug === params.slug) ?? null };
    },
    component: Chat,
});

function Chat() {
    const { slug } = Route.useParams();
    const { chat } = Route.useLoaderData();
    const title = chat?.title ?? slug;
    const messages: ChatMessage[] = [
        { id: "q", role: "user", content: title, ago: chat?.ago ?? "now" },
    ];

    return (
        <AppShell active="chats">
            <div className="mx-auto flex h-full max-w-[720px] flex-col px-6 py-6">
                <Link
                    to="/chats"
                    className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition hover:text-foreground"
                >
                    <ArrowLeft className="size-3.5" /> Chats
                </Link>
                <header className="mb-4 border-b border-border-soft pb-3">
                    <h1 className="text-[18px] font-semibold leading-snug">{title}</h1>
                    {chat && (
                        <p className="mt-0.5 font-mono text-[11px] text-faint">Chat · {chat.ago}</p>
                    )}
                </header>
                <ChatThread messages={messages} placeholder="Reply…" />
            </div>
        </AppShell>
    );
}
