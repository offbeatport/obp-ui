import { CreditCard, Globe, Mail, RefreshCw, Server, Trash2, Wallet } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { CompanyTabProps } from "~/components/company-tabs/types";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog";

// The "Setup" tab — wire a company to the outside world (Connections) and cap its spend (Budget).
// Prototype ref: 08-chat-spine-pro-v7.html `setupTabHTML` / `.set2-*`. Only Domain, spend cap and
// autopilot are persisted via onUpdate; Email / Payment / Hosting are cosmetic local-only seams.

const HOSTS = ["Vercel", "Netlify", "Fly.io", "Cloudflare", "Render"] as const;
const CAPS = [50, 100, 250, 500] as const;

// A connection/budget row: icon chip + label/sub on the left, control(s) on the right.
function Row({
    icon,
    label,
    sub,
    children,
}: {
    icon: ReactNode;
    label: string;
    sub: string;
    children: ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-t border-border-soft px-4 py-4 first:border-t-0">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid size-9 flex-none place-items-center rounded-lg bg-accent text-primary">
                    {icon}
                </span>
                <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <span className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</span>
                </span>
            </div>
            <div className="flex flex-none flex-wrap items-center justify-end gap-2">
                {children}
            </div>
        </div>
    );
}

// Mono uppercase status pill: success ("ok") vs warning ("pending").
function Pill({ ok, okLabel, pendLabel }: { ok: boolean; okLabel: string; pendLabel: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
                ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
            }`}
        >
            <span className="size-1.5 rounded-full bg-current" />
            {ok ? okLabel : pendLabel}
        </span>
    );
}

const inputCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";
const primaryBtn =
    "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const ghostBtn =
    "rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50";

export function SetupTab(props: CompanyTabProps) {
    const { co, busy, onUpdate, onDelete, onRebuild } = props;
    const [confirming, setConfirming] = useState(false);

    // Local state seeded from props. Domain + budget cap + autopilot persist through onUpdate;
    // email / payment / hosting are cosmetic (no server field) and stay client-side.
    const [domain, setDomain] = useState(co.domain ?? "");
    const [email, setEmail] = useState("");
    const [emailConnected, setEmailConnected] = useState(false);
    const [payConnected, setPayConnected] = useState(co.autopilot === "on");
    const [host, setHost] = useState<string>(HOSTS[0]);

    const domainOk = !!co.domain;
    const hostOk = true; // a provider is always selected in the dropdown
    const connected = [domainOk, emailConnected, payConnected, hostOk].filter(Boolean).length;

    const cap = co.budgetCapUsd ?? 100;
    const autopilotOn = co.autopilot === "on";
    // Spend is display-only: a derived slice of MRR clamped to the cap.
    const spend = Math.min(cap, Math.round((co.mrr ?? 0) * 0.15));

    return (
        <div className="mx-auto max-w-[640px] px-4 py-6">
            <header className="mb-6 flex items-end justify-between gap-4">
                <div>
                    <h2 className="font-display text-xl font-semibold text-foreground">Setup</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Wire {co.name} to the outside world.
                    </p>
                </div>
                <span className="font-mono text-xs text-faint">{connected} of 4 connected</span>
            </header>

            {/* ---- Connections ---- */}
            <section>
                <h3 className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                    Connections
                </h3>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <Row
                        icon={<Globe className="size-4" />}
                        label="Domain"
                        sub={`The customer-facing domain for ${co.name}.`}
                    >
                        <input
                            type="text"
                            className={`${inputCls} min-w-[150px]`}
                            placeholder="example.com"
                            value={domain}
                            disabled={busy}
                            onChange={(e) => setDomain(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    void onUpdate({ domain });
                                }
                            }}
                        />
                        <button
                            type="button"
                            className={primaryBtn}
                            disabled={busy}
                            onClick={() => void onUpdate({ domain })}
                        >
                            Apply
                        </button>
                        <Pill ok={domainOk} okLabel="Connected" pendLabel="Pending" />
                    </Row>

                    <Row
                        icon={<Mail className="size-4" />}
                        label="Email"
                        sub="Transactional & outreach mail from your domain."
                    >
                        <input
                            type="text"
                            className={`${inputCls} min-w-[150px]`}
                            placeholder="hello@example.com"
                            value={email}
                            disabled={busy}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button
                            type="button"
                            className={emailConnected ? ghostBtn : primaryBtn}
                            disabled={busy}
                            onClick={() => setEmailConnected((v) => !v)}
                        >
                            {emailConnected ? "Disconnect" : "Connect"}
                        </button>
                        <Pill ok={emailConnected} okLabel="Connected" pendLabel="Not connected" />
                    </Row>

                    <Row
                        icon={<CreditCard className="size-4" />}
                        label="Payment"
                        sub="Charge customers and collect revenue via Stripe."
                    >
                        <span className="font-mono text-xs text-muted-foreground">
                            {payConnected ? "acct_live" : "Test mode · no account"}
                        </span>
                        <button
                            type="button"
                            className={payConnected ? ghostBtn : primaryBtn}
                            disabled={busy}
                            onClick={() => setPayConnected((v) => !v)}
                        >
                            {payConnected ? "Disconnect" : "Connect Stripe"}
                        </button>
                        <Pill ok={payConnected} okLabel="Live" pendLabel="Test mode" />
                    </Row>

                    <Row
                        icon={<Server className="size-4" />}
                        label="Hosting"
                        sub={`Where ${co.name} deploys and serves traffic.`}
                    >
                        <select
                            className={inputCls}
                            value={host}
                            disabled={busy}
                            onChange={(e) => setHost(e.target.value)}
                        >
                            {HOSTS.map((h) => (
                                <option key={h} value={h}>
                                    {h}
                                </option>
                            ))}
                        </select>
                        <Pill ok={hostOk} okLabel="Connected" pendLabel="Not set" />
                    </Row>
                </div>
            </section>

            {/* ---- Budget ---- */}
            <section className="mt-6">
                <h3 className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                    Budget
                </h3>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <Row
                        icon={<Wallet className="size-4" />}
                        label="Monthly spend cap"
                        sub={`The most ${co.name} can spend per month.`}
                    >
                        <div className="flex flex-wrap gap-1.5">
                            {CAPS.map((v) => {
                                const on = v === cap;
                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        disabled={busy}
                                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                                            on
                                                ? "border-transparent bg-accent text-accent-foreground"
                                                : "border-border bg-background text-foreground"
                                        }`}
                                        onClick={() => void onUpdate({ budgetCapUsd: v })}
                                    >
                                        ${v}
                                    </button>
                                );
                            })}
                        </div>
                    </Row>

                    <Row
                        icon={<Wallet className="size-4" />}
                        label="Autopilot"
                        sub="Approved work runs without asking you."
                    >
                        <button
                            type="button"
                            role="switch"
                            aria-checked={autopilotOn}
                            disabled={busy}
                            onClick={() => void onUpdate({ autopilot: autopilotOn ? "off" : "on" })}
                            className={`relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-50 ${
                                autopilotOn ? "bg-primary" : "bg-secondary"
                            }`}
                        >
                            <span
                                className={`absolute top-0.5 size-5 rounded-full bg-card shadow-sm transition-all ${
                                    autopilotOn ? "left-[22px]" : "left-0.5"
                                }`}
                            />
                        </button>
                        <span className="font-mono text-xs text-muted-foreground">
                            {autopilotOn ? "on" : "off"}
                        </span>
                    </Row>

                    <Row
                        icon={<Wallet className="size-4" />}
                        label="Spend this month"
                        sub="Cost so far against the cap."
                    >
                        <span className="font-mono text-xs text-muted-foreground">
                            ${spend} / ${cap}
                        </span>
                    </Row>
                </div>
            </section>

            {/* ---- Build ---- */}
            <section className="mt-6">
                <h3 className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-faint">
                    Build
                </h3>
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <Row
                        icon={<RefreshCw className="size-4" />}
                        label="Rebuild"
                        sub="Re-queue the build so the engine re-runs it through the current agent."
                    >
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onRebuild()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                        >
                            <RefreshCw className="size-4" /> {busy ? "Queuing…" : "Rebuild"}
                        </button>
                    </Row>
                </div>
            </section>

            {/* ---- Danger zone ---- */}
            <section className="mt-6">
                <h3 className="mb-2.5 font-mono text-[11px] uppercase tracking-wider text-destructive">
                    Danger zone
                </h3>
                <div className="overflow-hidden rounded-xl border border-destructive/40 bg-card">
                    <Row
                        icon={<Trash2 className="size-4" />}
                        label="Delete company"
                        sub={`Permanently remove ${co.name} and all its work — chat, tasks, runs. Can't be undone.`}
                    >
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirming(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive-soft px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive hover:text-white disabled:opacity-50"
                        >
                            <Trash2 className="size-4" /> Delete company
                        </button>
                    </Row>
                </div>
            </section>

            {/* Confirmation modal */}
            <Dialog open={confirming} onOpenChange={(o) => !busy && setConfirming(o)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete {co.name}?</DialogTitle>
                        <DialogDescription>
                            This permanently removes <b className="text-foreground">{co.name}</b>{" "}
                            and everything it owns — its chat, tasks, run history, and deploy. This
                            can't be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirming(false)}
                            className="rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void onDelete()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
                        >
                            <Trash2 className="size-4" />
                            {busy ? "Deleting…" : "Delete forever"}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
