import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { listChats } from "~/server/data";

// Portfolio-level chat threads — direct the whole operation, not one company.
export const Route = createFileRoute("/chats/")({
    loader: async () => ({ chats: await listChats() }),
    component: Chats,
});

function Chats() {
    const { chats } = Route.useLoaderData();
    return (
        <AppShell active="chats">
            <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-6 py-8">
                <header className="flex items-end justify-between">
                    <div>
                        <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                            {"// Chats"}
                        </div>
                        <h1 className="mt-2 font-display text-3xl font-light tracking-tight">
                            Chats
                        </h1>
                        <p className="mt-1 text-[14px] text-muted-foreground">
                            Portfolio-level threads — ask across every company.
                        </p>
                    </div>
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground transition hover:brightness-105"
                    >
                        <Plus className="size-4" /> New chat
                    </Link>
                </header>

                <div className="flex flex-col gap-2">
                    {chats.map((c) => (
                        <Link
                            key={c.slug}
                            to="/chats/$slug"
                            params={{ slug: c.slug }}
                            className="flex items-center gap-3.5 rounded-xl border bg-card px-4 py-3.5 shadow-e1 transition hover:border-faint"
                        >
                            <span className="grid size-9 flex-none place-items-center rounded-lg bg-secondary text-faint">
                                <MessageCircle className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium">
                                    {c.title}
                                </span>
                                <span className="block font-mono text-[11px] text-faint">
                                    {c.ago}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
