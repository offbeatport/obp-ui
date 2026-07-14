import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { listChats } from "~/server/data";

export const Route = createFileRoute("/chats/")({
    loader: async () => ({ chats: await listChats() }),
    component: Chats,
});

// Chats — portfolio-level threads that direct the whole operation, not one company.
// Global chat-spine language from design/v2-prototypes/08-chat-spine-pro-v7.html.
function Chats() {
    const { chats } = Route.useLoaderData();
    return (
        <AppShell active="chats">
            <div className="mx-auto w-full max-w-[42rem] px-6 py-9">
                <header className="mb-6">
                    <div className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-faint">
                        {"// Chats"}
                    </div>
                    <h1 className="mt-1.5 font-display text-3xl font-light tracking-tight">
                        Chats
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Portfolio-level threads — direct the whole operation, not one company.
                    </p>
                </header>

                {/* global composer */}
                <div className="relative mb-8">
                    <textarea
                        rows={2}
                        placeholder="Message C Slop Slop · direct your companies…"
                        className="block max-h-[220px] min-h-[84px] w-full resize-none rounded-2xl border bg-card px-4 py-3.5 pr-14 text-[15px] leading-relaxed shadow-e1 outline-none focus:border-primary"
                    />
                    <button
                        type="button"
                        aria-label="Send"
                        className="absolute bottom-3.5 right-3.5 grid size-9 place-items-center rounded-full bg-primary text-lg text-primary-foreground active:scale-95"
                    >
                        ↑
                    </button>
                </div>

                <div className="mb-2 flex items-center gap-2.5">
                    <span className="font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint">
                        Recent
                    </span>
                    <span className="h-px flex-1 bg-border-soft" />
                    <span className="font-mono text-[11px] text-faint">{chats.length}</span>
                </div>
                <div className="flex flex-col">
                    {chats.map((c) => (
                        <Link
                            key={c.slug}
                            to="/chats/$slug"
                            params={{ slug: c.slug }}
                            className="group flex items-center gap-3 rounded-[10px] px-2.5 py-3 transition hover:bg-secondary"
                        >
                            <MessageCircle className="size-4 flex-none text-faint group-hover:text-primary" />
                            <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                                {c.title}
                            </span>
                            <span className="flex-none font-mono text-[11px] text-faint">
                                {c.ago}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
