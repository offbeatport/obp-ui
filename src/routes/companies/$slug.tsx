import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { User } from "lucide-react";
import { type CSSProperties, type ReactNode, useCallback, useState } from "react";
import { AppShell } from "~/components/app-shell";
import { TONE_VAR } from "~/components/command-center/tone";
import { CompanyLogo } from "~/components/company-logo";
import { GrowthTab } from "~/components/company-tabs/growth";
import { PipelineTab } from "~/components/company-tabs/pipeline";
import { ProductTab } from "~/components/company-tabs/product";
import { SetupTab } from "~/components/company-tabs/setup";
import { SourceCodeTab } from "~/components/company-tabs/source-code";
import type { CompanySettingsPatch, CompanyTabProps } from "~/components/company-tabs/types";
import { WorkspaceTab } from "~/components/company-tabs/workspace";
import { SpinChat } from "~/components/spin-chat";
import { usePollInvalidate } from "~/lib/use-poll-invalidate";
import { cn } from "~/lib/utils";
import {
    approveAction,
    messageCompany,
    rejectAction,
    updateCompanySettings,
} from "~/server/actions";
import type { ActivityItem, ChatMessage, CompanyDetail } from "~/server/data";
import { getCompany, listActivity, listCompanies, listCompanyActions } from "~/server/data";

export const Route = createFileRoute("/companies/$slug")({
    loader: async ({ params }) => {
        // params.slug is usually the immutable company id (create navigates by id), but may
        // be a human slug from a portfolio link - resolve either.
        const [detail, companies, activity] = await Promise.all([
            getCompany({ data: params.slug }),
            listCompanies(),
            listActivity(),
        ]);
        const summary =
            companies.find((c) => c.id === params.slug || c.slug === params.slug) ?? null;
        const co = detail ?? summary;
        // The full task list powers the Pipeline/Product tabs (skip for a draft / not-found).
        const actions =
            co && co.status !== "draft" ? await listCompanyActions({ data: co.id }) : [];
        return {
            detail,
            summary,
            actions,
            activity: co ? activity.filter((a) => a.companySlug === co.slug) : [],
        };
    },
    component: CompanyWorkspace,
});

const CO_TABS = ["Overview", "Pipeline", "Workspace", "Product", "Growth", "Setup", "Source Code"];
// The 6 non-Overview tabs → their component. Overview is bespoke (has extra props); these all
// take the same CompanyTabProps.
const TAB_COMPONENT: Record<string, (p: CompanyTabProps) => ReactNode> = {
    Pipeline: PipelineTab,
    Workspace: WorkspaceTab,
    Product: ProductTab,
    Growth: GrowthTab,
    Setup: SetupTab,
    "Source Code": SourceCodeTab,
};

// Company workspace - the live prototype: left co-pilot chat (renderCompanyLeft / .cpg-chat)
// + center tabbed company view (renderCompanyView / .co-tabs + .co-ov3 Overview).
// design/v2-prototypes/08-chat-spine-pro-v7.html.
function CompanyWorkspace() {
    const { slug } = Route.useParams();
    const router = useRouter();
    const { detail, summary, actions, activity } = Route.useLoaderData();
    const base = detail ?? summary;
    const companyId = base?.id;
    const [tab, setTab] = useState("Overview");
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [busy, setBusy] = useState(false);

    // Poll the loader so the engine's scope narration, chat replies and build/run status
    // stream in without a manual reload.
    usePollInvalidate(2500);

    const send = useCallback(async () => {
        const t = text.trim();
        if (!t || sending || !companyId) return;
        setSending(true);
        try {
            await messageCompany({ data: { companyId, text: t } });
            setText(""); // clear only after the write succeeds - don't lose text on failure
            await router.invalidate();
        } catch {
            /* keep the text so the founder can retry; a transient RPC failure isn't data loss */
        } finally {
            setSending(false);
        }
    }, [text, sending, companyId, router]);

    const approve = useCallback(
        async (actionId: string) => {
            await approveAction({ data: actionId });
            await router.invalidate();
        },
        [router],
    );
    const reject = useCallback(
        async (actionId: string) => {
            const feedback =
                window.prompt("Reject - what should change on the next attempt?") ?? "";
            await rejectAction({ data: { actionId, feedback } });
            await router.invalidate();
        },
        [router],
    );
    // Setup/Growth tabs persist company config; a shared busy flag disables their controls in-flight.
    const onUpdate = useCallback(
        async (patch: CompanySettingsPatch) => {
            if (!companyId || busy) return;
            setBusy(true);
            try {
                await updateCompanySettings({ data: { companyId, ...patch } });
                await router.invalidate();
            } finally {
                setBusy(false);
            }
        },
        [companyId, busy, router],
    );

    if (!base) {
        return (
            <AppShell active="companies">
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-16 text-center">
                    <div className="font-mono text-xs uppercase tracking-[0.14em] text-faint">
                        {"// Not found"}
                    </div>
                    <h1 className="mt-2 font-display text-4xl font-light tracking-tight">{slug}</h1>
                    <Link to="/companies" className="mt-4 text-sm text-primary hover:underline">
                        ← Back to portfolio
                    </Link>
                </div>
            </AppShell>
        );
    }

    const co = base as CompanyDetail;
    const TabComp = TAB_COMPONENT[tab];

    // A draft company is still incubating: render the spin-up chat (scout → proposals → spec →
    // approve) as its page. Approving graduates it and this same page becomes the workspace below.
    if (co.status === "draft" && detail) {
        return (
            <AppShell active="companies">
                <div className="h-full">
                    <SpinChat detail={detail} />
                </div>
            </AppShell>
        );
    }

    const messages = detail?.messages ?? [];
    const url = co.domain ?? co.liveUrl?.replace(/^https?:\/\//, "") ?? "not deployed";
    const href = co.domain ? `https://${co.domain}` : (co.liveUrl ?? "#");

    return (
        <AppShell active="companies">
            <div className="grid h-full grid-cols-1 lg:grid-cols-[minmax(360px,420px)_1fr]">
                {/* ============ LEFT · co-pilot chat ============ */}
                <aside className="flex min-h-0 flex-col border-r bg-secondary/40 lg:h-full">
                    {/* Borderless, open identity header (prototype .cl-head): the chat IS the company. */}
                    <div className="flex items-start gap-3 px-[18px] py-[15px]">
                        <CompanyLogo
                            name={co.name}
                            branding={co.branding}
                            size={40}
                            radius={12}
                            style={{
                                boxShadow:
                                    "inset 0 1px 1px rgba(255,255,255,.22), 0 2px 8px rgba(0,0,0,.12)",
                            }}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2.5">
                                <span className="truncate font-display text-[17px] font-semibold tracking-[-0.01em]">
                                    {co.name}
                                </span>
                                <LiveStatus co={co} />
                            </div>
                            {detail?.thesis && (
                                <p className="mt-1 truncate text-xs leading-[1.45] text-muted-foreground">
                                    {detail.thesis}
                                </p>
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
                                <CompanyLogo
                                    name={co.name}
                                    branding={co.branding}
                                    size={44}
                                    radius={12}
                                />
                                <p className="mt-3 text-sm font-medium">Message {co.name}</p>
                                <p className="mt-1 text-xs text-faint">
                                    Steer this company - ask for changes, approve slices, set
                                    direction.
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

                {/* ============ RIGHT · company view ============ */}
                <div className="min-h-0 overflow-y-auto bg-background px-6">
                    <div className="mx-auto flex max-w-[820px] flex-col">
                        <div className="sticky top-0 z-[4] mb-[18px] flex items-end gap-0.5 border-b border-border bg-[linear-gradient(var(--background)_68%,transparent)] pt-2">
                            {CO_TABS.map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTab(t)}
                                    className={cn(
                                        "relative inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-t-[8px] px-[15px] pt-[9px] pb-[13px] text-[13px] transition-colors after:absolute after:-bottom-px after:right-[15px] after:left-[15px] after:h-0.5 after:rounded-t-[2px] after:bg-primary after:transition-[opacity,transform] after:duration-200 after:content-['']",
                                        t === tab
                                            ? "font-semibold text-foreground after:opacity-100 after:[transform:scaleX(1)]"
                                            : "font-medium text-faint after:opacity-0 after:[transform:scaleX(0.35)] hover:text-muted-foreground",
                                    )}
                                >
                                    {t}
                                    {t === "Overview" && co.needsYou && (
                                        <span className="rounded-[10px] bg-approval-soft px-1.5 py-px font-mono text-[9.5px] font-bold text-approval">
                                            1
                                        </span>
                                    )}
                                </button>
                            ))}
                            <span className="mb-1.5 ml-auto inline-flex items-center gap-2.5 self-center">
                                <a
                                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11.5px] text-faint no-underline transition hover:bg-card hover:text-muted-foreground"
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <svg
                                        className="size-[13px]"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    </svg>
                                    {url}
                                </a>
                            </span>
                        </div>

                        <div className="py-2">
                            {tab === "Overview" ? (
                                <Overview
                                    co={co}
                                    thesis={detail?.thesis}
                                    activity={activity}
                                    onApprove={approve}
                                    onReject={reject}
                                />
                            ) : TabComp ? (
                                <TabComp
                                    co={co}
                                    actions={actions}
                                    busy={busy}
                                    onApprove={approve}
                                    onReject={reject}
                                    onUpdate={onUpdate}
                                />
                            ) : (
                                <div className="mx-auto max-w-[760px] px-[26px] pt-1 pb-[46px] text-foreground">
                                    <div className="px-3 py-2 text-[13px] text-faint">
                                        The {tab} surface is generated and maintained by {co.name}'s
                                        build loop.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

// Now-building task dot tone by slice state (todo / other → neutral).
const OV3_DOT: Record<string, string> = {
    building: "bg-warning",
    awaiting_approval: "bg-approval",
    blocked: "bg-destructive",
};

// Overview tab (co-ov3) - stats · mission · now-building · up-next · recent activity.
function Overview({
    co,
    thesis,
    activity,
    onApprove,
    onReject,
}: {
    co: CompanyDetail;
    thesis?: string;
    activity: ActivityItem[];
    onApprove: (actionId: string) => Promise<void>;
    onReject: (actionId: string) => Promise<void>;
}) {
    const slice = co.slice;
    const building =
        slice &&
        (slice.state === "building" ||
            slice.state === "awaiting_approval" ||
            slice.state === "blocked")
            ? slice
            : null;
    // "Up next" is only genuinely-pending work - never a finished (shipped) slice.
    const queued = slice && slice.state === "todo" ? slice : null;

    return (
        <div className="mx-auto max-w-[760px] px-[26px] pt-1 pb-[46px] text-foreground">
            <div className="mb-1 flex flex-wrap items-end gap-x-10 gap-y-[26px]">
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                        ${co.mrr}
                    </span>
                    <span className="text-[11.5px] text-faint">MRR / mo</span>
                    <span
                        className={cn(
                            "min-h-[14px] font-mono text-[11px]",
                            co.mrr > 0 ? "text-success" : "text-faint",
                        )}
                    >
                        {co.mrr > 0 ? "live revenue" : "pre-revenue"}
                    </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                        {co.users}
                    </span>
                    <span className="text-[11.5px] text-faint">paying users</span>
                    <span className="min-h-[14px] font-mono text-[11px] text-faint"> </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                        {co.shipped}
                    </span>
                    <span className="text-[11.5px] text-faint">slices shipped</span>
                    <span className="min-h-[14px] font-mono text-[11px] text-faint"> </span>
                </div>
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] text-foreground">
                        {co.status}
                    </span>
                    <span className="text-[11.5px] text-faint">status</span>
                    <span className="min-h-[14px] font-mono text-[11px] text-faint"> </span>
                </div>
            </div>

            {thesis && (
                <p className="mt-4 mb-2 max-w-[60ch] text-[14.5px] leading-normal text-muted-foreground">
                    {thesis}
                </p>
            )}

            <div className="mt-[26px]">
                <div className="mb-2 flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                    <span className="size-[7px] rounded-full bg-primary" />
                    Now building
                    <span className="text-[10px] text-faint">{building ? 1 : 0}</span>
                </div>
                <div className="flex flex-col">
                    {building ? (
                        <div className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors">
                            <span
                                className={cn(
                                    "size-[7px] flex-none rounded-full",
                                    OV3_DOT[building.state] ?? "bg-neutral",
                                )}
                            />
                            <span className="min-w-10 flex-none font-mono text-[11px] font-semibold text-faint">
                                S{building.n}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium text-foreground">
                                    {building.title}
                                </span>
                            </span>
                            {building.state === "awaiting_approval" ? (
                                <span className="flex flex-none gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => void onReject(building.actionId)}
                                        className="rounded-md border px-2.5 py-1 text-xs font-medium hover:border-destructive hover:text-destructive"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void onApprove(building.actionId)}
                                        className="rounded-md bg-success px-2.5 py-1 text-xs font-semibold text-success-foreground hover:brightness-105"
                                    >
                                        Approve &amp; ship
                                    </button>
                                </span>
                            ) : (
                                <span
                                    className={cn(
                                        "flex-none font-mono text-[9.5px] uppercase tracking-[0.05em]",
                                        building.state === "building"
                                            ? "text-warning"
                                            : "text-faint",
                                    )}
                                >
                                    {building.state.replace("_", " ")}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-[13px] text-faint">
                            Nothing building right now - the queue is clear.
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-[26px]">
                <div className="mb-2 flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                    Up next<span className="text-[10px] text-faint">{queued ? 1 : 0}</span>
                </div>
                <div className="flex flex-col">
                    {queued ? (
                        <div className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors">
                            <span
                                className={cn(
                                    "size-[7px] flex-none rounded-full",
                                    OV3_DOT[queued.state] ?? "bg-neutral",
                                )}
                            />
                            <span className="min-w-10 flex-none font-mono text-[11px] font-semibold text-faint">
                                S{queued.n}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium text-foreground">
                                    {queued.title}
                                </span>
                            </span>
                            <span className="flex-none font-mono text-[9.5px] uppercase tracking-[0.05em] text-faint">
                                {queued.state}
                            </span>
                        </div>
                    ) : (
                        <div className="px-3 py-2 text-[13px] text-faint">Nothing queued.</div>
                    )}
                </div>
            </div>

            <div className="mt-[26px]">
                <div className="mb-2 flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                    Recent activity
                </div>
                <ul className="m-0 list-none p-0">
                    {activity.length > 0 ? (
                        activity.slice(0, 6).map((a) => (
                            <li
                                key={a.id}
                                className="flex items-start gap-[11px] px-3 py-[9px] text-[13px] leading-[1.4] text-muted-foreground"
                            >
                                <i
                                    className="mt-1.5 size-[7px] flex-none rounded-full"
                                    style={{ background: TONE_VAR[a.tone] }}
                                />
                                <span>{a.text}</span>
                            </li>
                        ))
                    ) : (
                        <li className="flex items-start gap-[11px] px-3 py-[9px] text-[13px] leading-[1.4] text-muted-foreground">
                            <i
                                className="mt-1.5 size-[7px] flex-none rounded-full"
                                style={{ background: TONE_VAR.violet }}
                            />
                            <span>Agent is warming up - first activity soon.</span>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}

// The company's live-status pill (prototype .cl-live): a tone dot with a soft ring + a mono
// uppercase label. "building" while a slice is in flight, else "live"/"paused"/"archived".
function LiveStatus({ co }: { co: CompanyDetail }) {
    const building =
        co.slice?.state === "building" ||
        co.slice?.state === "awaiting_approval" ||
        co.slice?.state === "blocked";
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
            <span
                className={cn("size-1.5 rounded-full", s.dot)}
                style={{ boxShadow: `0 0 0 3px ${s.ring}` }}
            />
            {s.label}
        </span>
    );
}

// Left-rail chat bubble (.cpg-chat .msg / .bubble). Assistant avatar = the company logo; user = a
// person glyph (prototype CPG_ICON_USER on a cream .av).
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
                <p>{m.content}</p>
                <span
                    className={cn(
                        "mt-[7px] block font-mono text-[10px]",
                        me ? "text-white/70" : "text-faint",
                    )}
                >
                    {m.ago}
                </span>
            </div>
        </div>
    );
}
