import { useRouter } from "@tanstack/react-router";
import { User } from "lucide-react";
import { useCallback, useState } from "react";
import { CompanyLogo } from "~/components/company-logo";
import { Markdown } from "~/components/markdown";
import { cn } from "~/lib/utils";
import { messageCompany } from "~/server/actions";
import type { ChatMessage, CompanyDetail } from "~/server/data";

// The company's left co-pilot chat panel (prototype .cl-head / .cpg-chat): a company-identity
// header, the message thread, and a composer to steer the company. Self-contained - it owns the
// composer state + posts via messageCompany, then invalidates the route so the reply streams in.
// Extracted from routes/companies/$slug.tsx (this surface grows with richer chat features).
export function CompanyChat({ co }: { co: CompanyDetail }) {
    const router = useRouter();
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const messages = co.messages ?? [];

    const send = useCallback(async () => {
        const t = text.trim();
        if (!t || sending) return;
        setSending(true);
        try {
            await messageCompany({ data: { companyId: co.id, text: t } });
            setText(""); // clear only after the write succeeds - don't lose text on failure
            await router.invalidate();
        } catch {
            /* keep the text so the founder can retry; a transient RPC failure isn't data loss */
        } finally {
            setSending(false);
        }
    }, [text, sending, co.id, router]);

    return (
        <aside className="flex min-h-0 flex-col border-r bg-secondary/40 lg:h-full">
            {/* Borderless, open identity header (prototype .cl-head): the chat IS the company. */}
            <div className="flex items-start gap-3 px-[18px] py-[15px]">
                <CompanyLogo
                    name={co.name}
                    branding={co.branding}
                    size={40}
                    radius={12}
                    style={{
                        boxShadow: "inset 0 1px 1px rgba(255,255,255,.22), 0 2px 8px rgba(0,0,0,.12)",
                    }}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                        <span className="truncate font-display text-lg font-semibold tracking-[-0.01em]">
                            {co.name}
                        </span>
                        <LiveStatus co={co} />
                    </div>
                    {co.thesis && (
                        <p className="mt-1 truncate text-xs leading-[1.45] text-muted-foreground">{co.thesis}</p>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {messages.length > 0 ? (
                    <div className="flex flex-col gap-4 px-1.5 pt-2 pb-2.5">
                        {messages.map((m) => (
                            <Bubble key={m.id} m={m} co={co} />
                        ))}
                    </div>
                ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <CompanyLogo name={co.name} branding={co.branding} size={44} radius={12} />
                        <p className="mt-3 text-sm font-medium">Message {co.name}</p>
                        <p className="mt-1 text-xs text-faint">
                            Steer this company - ask for changes, approve slices, set direction.
                        </p>
                    </div>
                )}
            </div>

            <div className="relative px-3.5 pb-3.5 pt-2">
                <textarea
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                    placeholder={`Message ${co.name}…`}
                    className="block max-h-[260px] min-h-[120px] w-full resize-none rounded-xl border bg-card px-3.5 py-[13px] pr-12 text-sm leading-relaxed outline-none focus:border-primary"
                />
                <button
                    type="button"
                    aria-label="Send"
                    onClick={() => void send()}
                    disabled={sending || !text.trim()}
                    className="absolute right-6 bottom-6 grid size-[30px] place-items-center rounded-full bg-primary text-[15px] text-primary-foreground active:scale-95 disabled:opacity-40"
                >
                    ↑
                </button>
            </div>
        </aside>
    );
}

// The company's live-status pill (prototype .cl-live): a tone dot with a soft ring + a mono
// uppercase label. "building" while a slice is in flight, else "live"/"paused"/"archived".
function LiveStatus({ co }: { co: CompanyDetail }) {
    const building =
        co.slice?.state === "building" || co.slice?.state === "awaiting_approval" || co.slice?.state === "blocked";
    const s =
        co.status === "paused"
            ? { label: "paused", dot: "bg-warning", ring: "var(--warning-soft)" }
            : co.status === "archived"
              ? { label: "archived", dot: "bg-neutral", ring: "var(--neutral-soft)" }
              : building
                ? { label: "building", dot: "bg-info", ring: "var(--info-soft)" }
                : { label: "live", dot: "bg-success", ring: "var(--success-soft)" };
    return (
        <span className="inline-flex flex-none items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            <span className={cn("size-1.5 rounded-full", s.dot)} style={{ boxShadow: `0 0 0 3px ${s.ring}` }} />
            {s.label}
        </span>
    );
}

// Chat bubble (prototype .cpg-chat .msg / .bubble). Assistant avatar = the company logo; user = a
// person glyph. System lines render as a compact live-dot status row.
function Bubble({ m, co }: { m: ChatMessage; co: CompanyDetail }) {
    if (m.role === "system") {
        return (
            <div className="flex items-center gap-2 px-1.5 py-px font-mono text-[10.5px] text-faint">
                <span className="size-[5px] shrink-0 rounded-full bg-success shadow-[0_0_0_3px_var(--success-soft)]" />
                <span className="min-w-0 truncate">{m.content}</span>
                <span className="ml-auto opacity-[0.65]">{m.ago}</span>
            </div>
        );
    }
    const me = m.role === "user";
    return (
        <div className={cn("flex max-w-full items-start gap-[11px]", me && "flex-row-reverse")}>
            {me ? (
                <span className="mt-px grid size-7 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-secondary font-display text-xs font-bold text-muted-foreground">
                    <User className="size-[15px]" />
                </span>
            ) : (
                <CompanyLogo name={co.name} branding={co.branding} size={28} radius={9} />
            )}
            <div
                className={cn(
                    "text-[13.5px] leading-normal",
                    me
                        ? "max-w-[300px] rounded-[14px_5px_14px_14px] bg-primary px-3.5 py-2.5 text-white"
                        : "max-w-[440px] rounded-[5px_14px_14px_14px] pt-0.5 pb-[3px] text-foreground",
                )}
            >
                {me ? <p>{m.content}</p> : <Markdown content={m.content} />}
                <span className={cn("mt-[7px] block font-mono text-[10px]", me ? "text-white/70" : "text-faint")}>
                    {m.ago}
                </span>
            </div>
        </div>
    );
}
