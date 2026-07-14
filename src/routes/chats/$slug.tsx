import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "~/components/app-shell";
import { listChats } from "~/server/data";

export const Route = createFileRoute("/chats/$slug")({
    loader: async ({ params }) => {
        const chats = await listChats();
        const chat = chats.find((c) => c.slug === params.slug);
        if (!chat) throw notFound();
        return { chat };
    },
    component: Chat,
});

// One global thread — spine layout: header · stream · global composer.
// Bubbles from design/v2-prototypes/08-chat-spine-pro-v7.html (.msg / .bubble).
function Chat() {
    const { chat } = Route.useLoaderData();
    return (
        <AppShell active="chats">
            <div className="flex h-full flex-col">
                <div className="flex items-center gap-3 border-b px-6 py-3.5">
                    <Link
                        to="/chats"
                        aria-label="Back to chats"
                        className="grid size-8 place-items-center rounded-md text-faint hover:bg-secondary hover:text-foreground"
                    >
                        <ArrowLeft className="size-4" />
                    </Link>
                    <div className="min-w-0">
                        <div className="truncate font-display text-[15px] font-semibold">
                            {chat.title}
                        </div>
                        <div className="font-mono text-[10.5px] text-faint">{chat.ago}</div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="mx-auto flex max-w-[42rem] flex-col gap-[18px] px-6 py-7">
                        {/* seed: the thread title is the operator's opening question */}
                        <div className="flex flex-row-reverse items-start gap-3">
                            <span className="mt-0.5 grid size-[30px] flex-none place-items-center rounded-[9px] bg-foreground text-[13px] font-semibold text-background">
                                You
                            </span>
                            <div className="max-w-[78%] rounded-2xl rounded-tr-[5px] bg-foreground px-4 py-3 text-[16px] leading-[1.55] text-background shadow-e1">
                                {chat.title}
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="mt-0.5 grid size-[30px] flex-none place-items-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground shadow-e1">
                                C
                            </span>
                            <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-[5px] border bg-card px-4 py-4 shadow-e1">
                                <Dot d="0s" />
                                <Dot d="0.2s" />
                                <Dot d="0.4s" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t px-6 py-3.5">
                    <div className="relative mx-auto max-w-[42rem]">
                        <textarea
                            rows={1}
                            placeholder="Reply · direct your companies…"
                            className="block max-h-[220px] min-h-[52px] w-full resize-none rounded-2xl border bg-card px-4 py-3.5 pr-14 text-[15px] leading-relaxed outline-none focus:border-primary"
                        />
                        <button
                            type="button"
                            aria-label="Send"
                            className="absolute bottom-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-primary text-lg text-primary-foreground active:scale-95"
                        >
                            ↑
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

const Dot = ({ d }: { d: string }) => (
    <span
        className="size-1.5 rounded-full bg-faint pulse"
        style={{ animationDelay: d }}
        aria-hidden="true"
    />
);
