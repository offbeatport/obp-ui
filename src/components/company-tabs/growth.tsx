import { AtSign, FileText, type LucideIcon, MessageCircle, Minus, Plus, Rocket, Sprout, Target } from "lucide-react";
import { useState } from "react";
import type { CompanyTabProps } from "~/components/company-tabs/types";
import type { Channel } from "~/db/schema";

// The "Growth" tab: turn acquisition channels on/off and configure each. Five strategy rows,
// each a pill toggle; a switched-on row expands to reveal its config fields. On/off + config are
// derived from co.channels (Channel[]) and every change rebuilds the full channels array and
// persists via onUpdate. Local state mirrors co.channels for snappy UI.

type Field =
    | { f: string; lab: string; type: "seg"; opts: string[] }
    | { f: string; lab: string; type: "txt"; ph?: string }
    | { f: string; lab: string; type: "money"; def?: string }
    | { f: string; lab: string; type: "step"; min: number; max: number; def?: string };

type Strat = {
    key: string;
    kind: Channel["kind"]; // "seo" | "ads" | "content" | "outbound" | "referral"
    name: string;
    Icon: LucideIcon;
    rec?: boolean;
    status: string; // one-line pitch shown on the collapsed row
    doing: string; // "Live" line shown when the row is on
    primary: string; // field whose value round-trips through Channel.status
    fields: Field[];
};

// The five UI strategies mapped onto the Channel.kind enum.
const STRATS: Strat[] = [
    {
        key: "reddit",
        kind: "content",
        name: "Reddit",
        Icon: MessageCircle,
        rec: true,
        status: "Genuinely helpful replies in buyer-intent threads.",
        doing: "Replied in 3 buyer-intent threads this week.",
        primary: "cadence",
        fields: [
            { f: "cadence", lab: "Cadence", type: "seg", opts: ["Daily", "3× / week", "Weekly"] },
            { f: "subs", lab: "Subreddits", type: "txt", ph: "r/sales, r/SaaS" },
        ],
    },
    {
        key: "x",
        kind: "outbound",
        name: "Twitter / X",
        Icon: AtSign,
        status: "Share build-in-public wins & tips daily - compounding reach.",
        doing: "Sharing build-in-public updates this week.",
        primary: "cadence",
        fields: [
            { f: "cadence", lab: "Cadence", type: "seg", opts: ["Daily", "3× / week", "Weekly"] },
            { f: "focus", lab: "Focus", type: "txt", ph: "wins, tips, launches" },
        ],
    },
    {
        key: "seo",
        kind: "seo",
        name: "SEO pages",
        Icon: FileText,
        status: "Auto-write comparison & how-to pages that rank.",
        doing: "Publishing pages that rank for your keywords.",
        primary: "keywords",
        fields: [
            { f: "perWeek", lab: "Pages / week", type: "step", min: 1, max: 7, def: "3" },
            { f: "keywords", lab: "Target keywords", type: "txt", ph: "best lead scoring tool" },
        ],
    },
    {
        key: "ads",
        kind: "ads",
        name: "Paid ads",
        Icon: Target,
        status: "Buy clicks on your highest-intent keywords.",
        doing: "Running ads on your highest-intent keywords.",
        primary: "channels",
        fields: [
            { f: "budget", lab: "Budget / mo", type: "money", def: "150" },
            {
                f: "channels",
                lab: "Channels",
                type: "seg",
                opts: ["Google + Reddit", "Google", "Meta"],
            },
        ],
    },
    {
        key: "launch",
        kind: "referral",
        name: "Launch & PR",
        Icon: Rocket,
        status: "Schedule Product Hunt bursts for signup spikes.",
        doing: "Lining up the next launch moment.",
        primary: "channel",
        fields: [
            {
                f: "channel",
                lab: "Launch channel",
                type: "seg",
                opts: ["Product Hunt", "Hacker News", "BetaList"],
            },
        ],
    },
];

type StratState = { on: boolean; values: Record<string, string> };
type GrowthState = Record<string, StratState>;

function defaultVal(f: Field): string {
    if (f.type === "seg") return f.opts[0];
    if (f.type === "step") return f.def ?? String(f.min);
    if (f.type === "money") return f.def ?? "";
    return "";
}

// Derive local UI state from the persisted channels: presence = on; budget round-trips through
// budgetIntentUsd; the "primary" field round-trips through Channel.status; the rest fall back to
// sensible defaults (the flat Channel shape can't hold every field).
function initState(channels: Channel[]): GrowthState {
    const out: GrowthState = {};
    for (const st of STRATS) {
        const ch = channels.find((c) => c.kind === st.kind);
        const values: Record<string, string> = {};
        for (const f of st.fields) values[f.f] = defaultVal(f);
        if (ch) {
            const money = st.fields.find((f) => f.type === "money");
            if (money && ch.budgetIntentUsd != null) values[money.f] = String(ch.budgetIntentUsd);
            const primary = st.fields.find((f) => f.f === st.primary);
            if (primary && ch.status) {
                if (primary.type === "seg" && primary.opts.includes(ch.status)) values[primary.f] = ch.status;
                else if (primary.type === "txt") values[primary.f] = ch.status;
            }
        }
        out[st.key] = { on: !!ch, values };
    }
    return out;
}

// Rebuild the full Channel[] from current UI state - one entry per enabled strategy.
function toChannels(state: GrowthState): Channel[] {
    const out: Channel[] = [];
    for (const st of STRATS) {
        const s = state[st.key];
        if (!s?.on) continue;
        const ch: Channel = { kind: st.kind, status: s.values[st.primary] || st.status };
        const money = st.fields.find((f) => f.type === "money");
        if (money) {
            const n = Number(s.values[money.f]);
            if (Number.isFinite(n) && n > 0) ch.budgetIntentUsd = n;
        }
        out.push(ch);
    }
    return out;
}

export function GrowthTab(props: CompanyTabProps) {
    const { co, onUpdate } = props;
    const [state, setState] = useState<GrowthState>(() => initState(co.channels ?? []));

    const persist = (next: GrowthState) => {
        setState(next);
        void onUpdate({ channels: toChannels(next) });
    };
    const toggle = (key: string) => persist({ ...state, [key]: { ...state[key], on: !state[key].on } });
    const setField = (key: string, f: string, v: string) =>
        persist({
            ...state,
            [key]: { ...state[key], values: { ...state[key].values, [f]: v } },
        });

    const activeCount = STRATS.filter((st) => state[st.key]?.on).length;

    const control = (st: Strat, f: Field) => {
        const v = state[st.key].values[f.f];
        if (f.type === "seg")
            return (
                <div className="flex flex-wrap gap-1.5">
                    {f.opts.map((o) => (
                        <button
                            key={o}
                            type="button"
                            onClick={() => setField(st.key, f.f, o)}
                            className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                                o === v
                                    ? "border-primary bg-accent font-medium text-accent-foreground"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {o}
                        </button>
                    ))}
                </div>
            );
        if (f.type === "money")
            return (
                <div className="flex items-center rounded-lg border border-border bg-secondary focus-within:border-primary">
                    <span className="pl-3 pr-1 font-mono text-sm text-muted-foreground">$</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={v}
                        onChange={(e) => setField(st.key, f.f, e.target.value)}
                        className="w-full bg-transparent py-1.5 pr-3 text-sm text-foreground outline-none"
                    />
                </div>
            );
        if (f.type === "step") {
            const n = Number.parseInt(v, 10) || f.min;
            const dec = Math.max(f.min, n - 1);
            const inc = Math.min(f.max, n + 1);
            return (
                <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5">
                    <button
                        type="button"
                        onClick={() => setField(st.key, f.f, String(dec))}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                        <Minus className="size-3.5" />
                    </button>
                    <span className="w-8 text-center font-mono text-sm text-foreground">{n}</span>
                    <button
                        type="button"
                        onClick={() => setField(st.key, f.f, String(inc))}
                        className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                        <Plus className="size-3.5" />
                    </button>
                </div>
            );
        }
        return (
            <input
                type="text"
                value={v}
                placeholder={f.ph}
                onChange={(e) => setField(st.key, f.f, e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none placeholder:text-faint focus:border-primary"
            />
        );
    };

    return (
        <div className="mx-auto flex max-w-[680px] flex-col gap-4">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                        {co.name} · Growth
                    </div>
                    <h1 className="mt-1 font-display text-2xl font-semibold text-foreground">Growth strategies</h1>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                    <span className={`size-1.5 rounded-full ${activeCount ? "bg-success" : "bg-neutral"}`} />
                    <b className="font-semibold text-foreground">{activeCount}</b>
                    <span className="text-muted-foreground">active</span>
                </div>
            </header>

            <div className="flex items-center gap-3 rounded-xl border border-border-soft bg-secondary px-4 py-3 text-sm text-muted-foreground">
                <Sprout className="size-4 shrink-0 text-success" />
                <span>
                    <b className="font-medium text-foreground">Start with one - it's usually all you need.</b> Add more
                    whenever you want.
                </span>
            </div>

            <div className="flex flex-col gap-3">
                {STRATS.map((st) => {
                    const on = state[st.key]?.on;
                    return (
                        <div key={st.key} className="overflow-hidden rounded-xl border border-border bg-card">
                            <div className="flex items-center gap-3 p-4">
                                <span
                                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                                        on ? "bg-accent text-primary" : "bg-secondary text-muted-foreground"
                                    }`}
                                >
                                    <st.Icon className="size-[18px]" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-display font-semibold text-foreground">{st.name}</span>
                                        {st.rec && (
                                            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-foreground">
                                                Recommended
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{st.status}</div>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={on}
                                    aria-label={`${st.name} strategy`}
                                    onClick={() => toggle(st.key)}
                                    className={`relative h-[26px] w-11 shrink-0 rounded-full transition-colors ${
                                        on ? "bg-success" : "bg-neutral"
                                    }`}
                                >
                                    <span
                                        className={`absolute left-0.5 top-0.5 size-[22px] rounded-full bg-white shadow transition-transform ${
                                            on ? "translate-x-[18px]" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>

                            {on && (
                                <div className="flex flex-col gap-3 border-t border-border-soft px-4 py-4">
                                    {st.fields.map((f) => (
                                        <div key={f.f} className="grid grid-cols-[110px_1fr] items-center gap-3">
                                            <span className="text-xs font-medium text-muted-foreground">{f.lab}</span>
                                            {control(st, f)}
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-2 text-xs text-success">
                                        <span className="size-1.5 animate-pulse rounded-full bg-success" />
                                        <span className="font-mono uppercase tracking-wide">Live</span>
                                        <span className="text-muted-foreground">{st.doing}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
