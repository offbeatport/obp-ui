import {
    Ban,
    Boxes,
    Clock,
    DollarSign,
    type LucideIcon,
    Plug,
    Plus,
    Shield,
    ShieldCheck,
    Users,
    X,
} from "lucide-react";
import { useId, useState } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { type Guardrails, resolveGuardrails } from "~/config/spin";
import { cn } from "~/lib/utils";

// The "Guardrail Ledger" - the prototype's Custom-guardrails editor (design/08-chat-spine-pro-v7,
// .spin-hero-ledger / .spin-guards). A categorized list of rules the agent must respect: each row
// is a color-coded category + a curated-value select (or free text), addable/removable, plus
// free-form "custom" rows. Unlike the prototype (which never serialized), this feeds Guardrails.

type Cat = "budget" | "mode" | "audience" | "avoid" | "timeline" | "integrations" | "stack" | "compliance" | "custom";

type Meta = {
    label: string;
    icon: LucideIcon;
    ic: string; // icon swatch classes (soft bg + tint)
    def: string; // default value
    opts: string[]; // curated options; last is always "Custom…"
};

const CUSTOM = "Custom…";

// The 8 categories + their curated options (prototype GUARD_CATS + CONSTRAINT_OPTS).
const META: Record<Exclude<Cat, "custom">, Meta> = {
    budget: {
        label: "Budget",
        icon: DollarSign,
        ic: "bg-success-soft text-success",
        def: "≤ $500 / month",
        opts: ["$0 / month", "≤ $500 / month", "≤ $2k / month", "≤ $10k / month", CUSTOM],
    },
    mode: {
        label: "Mode",
        icon: ShieldCheck,
        ic: "bg-info-soft text-info",
        def: "Test-mode first · no real money",
        opts: ["Test-mode first · no real money", "Real money from day one", "Free · no monetization yet", CUSTOM],
    },
    audience: {
        label: "Audience",
        icon: Users,
        ic: "bg-approval-soft text-approval",
        def: "Freelancer subreddits & Discords",
        opts: [
            "Freelancer subreddits & Discords",
            "Indie Hackers",
            "Twitter / X",
            "LinkedIn",
            "Reddit (broad)",
            "My existing list",
            CUSTOM,
        ],
    },
    avoid: {
        label: "Avoid",
        icon: Ban,
        ic: "bg-destructive-soft text-destructive",
        def: "Banking-license products",
        opts: [
            "Banking-license products",
            "Hardware / inventory",
            "Heavily regulated spaces",
            "Crypto / web3",
            "Nothing · open",
            CUSTOM,
        ],
    },
    timeline: {
        label: "Timeline",
        icon: Clock,
        ic: "bg-warning-soft text-warning",
        def: "Ship v1 in 1 month",
        opts: ["Ship v1 in 1 week", "Ship v1 in 1 month", "No hard deadline", CUSTOM],
    },
    integrations: {
        label: "Integrations",
        icon: Plug,
        ic: "bg-approval-soft text-approval",
        def: "Stripe",
        opts: ["Stripe", "Google / Gmail", "Slack", "None required", CUSTOM],
    },
    stack: {
        label: "Stack",
        icon: Boxes,
        ic: "bg-accent text-accent-foreground",
        def: "Agent's choice",
        opts: ["Agent's choice", "Next.js + Supabase", "No preference", CUSTOM],
    },
    compliance: {
        label: "Compliance",
        icon: Shield,
        ic: "bg-neutral-soft text-neutral",
        def: "None needed",
        opts: ["None needed", "GDPR-ready", "SOC 2 (later)", CUSTOM],
    },
};

const ALL_CATS = Object.keys(META) as Exclude<Cat, "custom">[];
const DEFAULT_CATS: Exclude<Cat, "custom">[] = ["budget", "mode", "audience", "avoid"];

export type GuardRow = {
    id: string;
    cat: Cat;
    label: string; // editable only for custom rows
    value: string;
    freeText: boolean; // value is a typed override ("Custom…") or a custom-row value
};

// The default ledger shown when "Custom" is first chosen (mirrors ensureHeroLedger).
export function defaultRows(): GuardRow[] {
    return DEFAULT_CATS.map((cat, i) => ({
        id: `${cat}-${i}`,
        cat,
        label: META[cat].label,
        value: META[cat].def,
        freeText: false,
    }));
}

// Rows → Guardrails: budget/mode map to their fields, everything else joins constraints[].
export function rowsToGuardrails(rows: GuardRow[]): Guardrails {
    let budgetUsd: number | undefined;
    let mode: "test" | "live" | undefined;
    const constraints: string[] = [];
    for (const r of rows) {
        const v = r.value.trim();
        if (r.cat === "budget") {
            budgetUsd = parseBudget(v);
        } else if (r.cat === "mode") {
            mode = /test/i.test(v) ? "test" : /real money|day one|live/i.test(v) ? "live" : undefined;
            if (v) constraints.push(`Mode: ${v}`);
        } else if (v) {
            const label = r.label.trim() || "Rule";
            constraints.push(`${label}: ${v}`);
        }
    }
    return resolveGuardrails("custom", { budgetUsd, mode, constraints });
}

function parseBudget(v: string): number | undefined {
    if (/\$?0\b/.test(v) && !/[1-9]/.test(v.replace(/\$?0/, ""))) return 0;
    const m = v.match(/([\d.]+)\s*k/i);
    if (m) return Math.round(Number.parseFloat(m[1]) * 1000);
    const n = v.match(/(\d[\d,]*)/);
    return n ? Number.parseInt(n[1].replace(/,/g, ""), 10) : undefined;
}

// The value control: a curated dropdown (chevron), with "Custom…" flipping to a free-text input.
function ValueControl({ row, onChange }: { row: GuardRow; onChange: (patch: Partial<GuardRow>) => void }) {
    if (row.cat === "custom" || row.freeText) {
        return (
            <input
                value={row.value}
                spellCheck={false}
                placeholder="Type your rule…"
                onChange={(e) => onChange({ value: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2.5 py-1.5 font-mono text-[12.5px] text-foreground outline-none placeholder:text-faint hover:border-border focus:border-primary/40 focus:bg-card"
            />
        );
    }
    const opts = META[row.cat].opts;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-left font-mono text-[12.5px] text-foreground transition-colors hover:border-border hover:bg-secondary"
                >
                    <span className="min-w-0 flex-1 truncate">{row.value}</span>
                    <span className="size-1.5 flex-none rotate-45 border-r border-b border-faint" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                {opts.map((o) =>
                    o === CUSTOM ? (
                        <DropdownMenuItem
                            key={o}
                            className="text-[13px] text-muted-foreground"
                            onSelect={() => onChange({ freeText: true, value: "" })}
                        >
                            {CUSTOM} <span className="ml-1 text-faint">write your own</span>
                        </DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem key={o} className="text-[13px]" onSelect={() => onChange({ value: o })}>
                            {o}
                        </DropdownMenuItem>
                    ),
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function GuardrailLedger({ rows, onChange }: { rows: GuardRow[]; onChange: (rows: GuardRow[]) => void }) {
    const uid = useId();
    const [seq, setSeq] = useState(0);
    const present = new Set(rows.map((r) => r.cat));

    const patchRow = (id: string, patch: Partial<GuardRow>) =>
        onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id));
    const addRow = (cat: Exclude<Cat, "custom">) =>
        onChange([
            ...rows,
            {
                id: `${uid}-${seq}`,
                cat,
                label: META[cat].label,
                value: META[cat].def,
                freeText: false,
            },
        ]);
    const addCustom = () =>
        onChange([...rows, { id: `${uid}-c${seq}`, cat: "custom", label: "", value: "", freeText: true }]);
    const bump = () => setSeq((s) => s + 1);

    return (
        <div className="mx-auto mt-3.5 w-full max-w-[640px] border-t border-border pt-3.5 text-left">
            <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-foreground">
                    Guardrails
                </span>
                <span className="rounded-full border border-border-soft bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-faint">
                    {rows.length} {rows.length === 1 ? "guardrail" : "guardrails"}
                </span>
                <span className="ml-auto text-[11px] text-faint">the agent must respect these</span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-secondary/50">
                {rows.map((r) => {
                    const meta = r.cat === "custom" ? null : META[r.cat];
                    const Icon = meta?.icon ?? Plus;
                    return (
                        <div
                            key={r.id}
                            className="flex items-center gap-3 border-b border-border-soft px-2.5 py-2 transition-colors last:border-b-0 hover:bg-card"
                        >
                            <span className="flex w-[112px] min-w-[112px] flex-none items-center gap-2">
                                <span
                                    className={cn(
                                        "grid size-6 flex-none place-items-center rounded-lg",
                                        meta?.ic ?? "bg-secondary text-faint",
                                    )}
                                >
                                    <Icon className="size-[13px]" />
                                </span>
                                {r.cat === "custom" ? (
                                    <input
                                        value={r.label}
                                        spellCheck={false}
                                        placeholder="Label"
                                        onChange={(e) => patchRow(r.id, { label: e.target.value })}
                                        className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground outline-none placeholder:text-faint hover:border-border focus:border-primary/40"
                                    />
                                ) : (
                                    <span className="truncate font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-foreground">
                                        {meta?.label}
                                    </span>
                                )}
                            </span>

                            <ValueControl row={r} onChange={(patch) => patchRow(r.id, patch)} />

                            <button
                                type="button"
                                onClick={() => removeRow(r.id)}
                                aria-label={`Remove ${r.label || "constraint"}`}
                                className="grid size-6 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-destructive-soft hover:text-destructive"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    );
                })}

                {/* add row */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            onClick={bump}
                            className="flex w-full items-center gap-3 px-2.5 py-2.5 text-left text-muted-foreground transition-colors hover:bg-card"
                        >
                            <span className="grid size-6 flex-none place-items-center rounded-lg border border-dashed border-border bg-secondary text-faint">
                                <Plus className="size-3.5" />
                            </span>
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em]">
                                Add constraint
                            </span>
                            <span className="ml-auto hidden flex-wrap justify-end gap-1.5 sm:flex">
                                {ALL_CATS.filter((c) => !present.has(c))
                                    .slice(0, 4)
                                    .map((c) => (
                                        <span
                                            key={c}
                                            className="rounded-full border border-border-soft bg-secondary px-2 py-0.5 font-mono text-[9.5px] uppercase text-faint"
                                        >
                                            {META[c].label}
                                        </span>
                                    ))}
                            </span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                        {ALL_CATS.map((c) => (
                            <DropdownMenuItem
                                key={c}
                                disabled={present.has(c)}
                                onSelect={() => addRow(c)}
                                className="gap-2 text-[13px]"
                            >
                                <span className={cn("grid size-5 flex-none place-items-center rounded-md", META[c].ic)}>
                                    {(() => {
                                        const I = META[c].icon;
                                        return <I className="size-3" />;
                                    })()}
                                </span>
                                {META[c].label}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onSelect={addCustom} className="gap-2 text-[13px] text-muted-foreground">
                            <span className="grid size-5 flex-none place-items-center rounded-md bg-secondary text-faint">
                                <Plus className="size-3" />
                            </span>
                            {CUSTOM} <span className="text-faint">write your own rule</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
