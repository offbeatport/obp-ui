import { ArrowRight, Check, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import {
    type Candidate,
    type CompanySpec,
    EVIDENCE_META,
    type EvidenceKind,
    type OppScores,
    SCORE_KEYS,
    SCORE_META,
    scoreTotal,
} from "~/config/spin";
import type { DraftView } from "~/server/data";
import { Button } from "./ui/button";

// The spin-flow view surfaces (scouting → proposals → spec → creating). Pure presentation -
// the route (companies/new.tsx) owns state + server calls and passes them as callbacks. Built
// from design tokens per DESIGN.md; the only inline colors are the AI-generated brand palette
// (data, like an avatar tint - not UI chrome).

// ---- score band → semantic token family --------------------------------------------------
type Band = "hi" | "mid" | "lo";
function band(v0to10: number): Band {
    return v0to10 >= 8 ? "hi" : v0to10 >= 5 ? "mid" : "lo";
}
const BAND_CHIP: Record<Band, string> = {
    hi: "bg-success-soft text-success",
    mid: "bg-warning-soft text-warning",
    lo: "bg-neutral-soft text-neutral",
};
const BAND_PIP: Record<Band, string> = {
    hi: "bg-success",
    mid: "bg-warning",
    lo: "bg-neutral",
};

// ---- scouting: the scout is scanning for demand -------------------------------------------

// The phases the scout narrates while it works. It cycles until the engine returns candidates.
const SCOUT_PHASES = [
    "Scanning communities for demand signals",
    "Reading competitor pricing pages",
    "Measuring willingness to pay",
    "Spotting gaps the incumbents miss",
    "Scoring the strongest bets",
];
const SCOUT_SOURCES = ["reddit", "search trends", "pricing pages", "forums", "review sites"];

export function ScoutingView({ thought }: { thought: string }) {
    const [phase, setPhase] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setPhase((p) => p + 1), 1600);
        return () => clearInterval(t);
    }, []);
    const step = phase % SCOUT_PHASES.length;
    // Sources "light up" progressively as the scout advances through phases.
    const lit = Math.min(SCOUT_SOURCES.length, phase + 1);

    return (
        <div className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-e1">
            <div className="flex items-center gap-3 px-5 pt-5">
                <span className="grid size-9 flex-none place-items-center rounded-xl bg-accent text-accent-foreground">
                    <Search className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Scouting opportunities</p>
                    <p className="truncate text-xs text-muted-foreground">around “{thought}”</p>
                </div>
                <Loader2 className="size-4 flex-none animate-spin text-primary" />
            </div>

            {/* cycling status line */}
            <div className="px-5 py-3.5">
                <div className="flex items-center gap-2.5 text-[13px]">
                    <span className="relative flex size-2 flex-none">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                    {/* key on step so React remounts → the fade/slide re-triggers each phase */}
                    <span
                        key={step}
                        className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                    >
                        {SCOUT_PHASES[step]}…
                    </span>
                </div>
            </div>

            {/* indeterminate shimmer bar */}
            <div className="mx-5 h-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-1/3 rounded-full bg-primary animate-[scout-slide_1.4s_ease-in-out_infinite]" />
            </div>

            {/* sources lighting up */}
            <div className="flex flex-wrap gap-1.5 px-5 pt-3.5 pb-5">
                {SCOUT_SOURCES.map((s, i) => (
                    <span
                        key={s}
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors duration-500 ${
                            i < lit ? "bg-accent text-accent-foreground" : "bg-muted text-faint"
                        }`}
                    >
                        {s}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---- one dimension's 5-pip score row ------------------------------------------------------
function ScorePips({ scores }: { scores: OppScores }) {
    return (
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {SCORE_KEYS.map((k) => {
                const v = scores[k] ?? 0;
                const b = band(v);
                const pips = Math.max(0, Math.min(5, Math.round(v / 2)));
                return (
                    <div key={k} className="flex items-center gap-2" title={SCORE_META[k].hint}>
                        <span className="w-24 flex-none truncate text-xs text-muted-foreground">
                            {SCORE_META[k].label}
                        </span>
                        <span className="flex flex-1 gap-1">
                            {[0, 1, 2, 3, 4].map((i) => (
                                <span
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full ${i < pips ? BAND_PIP[b] : "bg-muted"}`}
                                />
                            ))}
                        </span>
                        <span className="w-4 flex-none text-right font-mono text-[11px] text-faint">
                            {v}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function EvidenceBadge({ kind }: { kind: EvidenceKind }) {
    const tone =
        kind === "price"
            ? "bg-success-soft text-success"
            : kind === "gap"
              ? "bg-neutral-soft text-neutral"
              : "bg-accent text-accent-foreground";
    return (
        <span
            className={`grid size-5 flex-none place-items-center rounded-md text-[11px] font-bold ${tone}`}
            title={EVIDENCE_META[kind].label}
        >
            {EVIDENCE_META[kind].badge}
        </span>
    );
}

// ---- proposals: ranked candidate cards, expand for the breakdown --------------------------
export function ProposalsView({
    candidates,
    onPick,
    onReroll,
    busy,
}: {
    candidates: Candidate[];
    onPick: (id: string) => void;
    onReroll: () => void;
    busy: boolean;
}) {
    const [open, setOpen] = useState<string | null>(candidates[0]?.id ?? null);
    return (
        <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    I scouted the demand and found{" "}
                    <b className="font-semibold text-foreground">
                        {candidates.length} software-only {candidates.length === 1 ? "bet" : "bets"}
                    </b>
                    , scored on 8 signals. Expand any one, then pick the one to build.
                </p>
                <Button variant="ghost" size="sm" onClick={onReroll} disabled={busy}>
                    <RefreshCw className="size-3.5" />
                    Re-roll
                </Button>
            </div>
            <div className="space-y-3">
                {candidates.map((c, i) => (
                    <CandidateCard
                        key={c.id}
                        c={c}
                        rank={i + 1}
                        open={open === c.id}
                        onToggle={() => setOpen(open === c.id ? null : c.id)}
                        onPick={() => onPick(c.id)}
                        busy={busy}
                    />
                ))}
            </div>
        </div>
    );
}

function CandidateCard({
    c,
    rank,
    open,
    onToggle,
    onPick,
    busy,
}: {
    c: Candidate;
    rank: number;
    open: boolean;
    onToggle: () => void;
    onPick: () => void;
    busy: boolean;
}) {
    const total = scoreTotal(c.scores);
    const b = band(total);
    return (
        <article className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-e1">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-secondary/50"
            >
                <span className="grid size-7 flex-none place-items-center rounded-lg bg-secondary font-mono text-xs font-bold text-muted-foreground">
                    {rank}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] font-semibold">
                        {c.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{c.wedge}</span>
                </span>
                <span
                    className={`flex-none rounded-full px-2.5 py-1 font-mono text-xs font-bold ${BAND_CHIP[b]}`}
                    title="Overall score (avg of 8 signals)"
                >
                    {total.toFixed(1)}
                </span>
            </button>
            {open && (
                <div className="space-y-4 border-t px-4 py-4">
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Who: </span>
                        {c.icp}
                    </p>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">Pain: </span>
                        {c.pain}
                    </p>
                    <ScorePips scores={c.scores} />
                    {c.evidence.length > 0 && (
                        <ul className="space-y-2">
                            {c.evidence.map((e) => (
                                <li
                                    key={`${e.kind}-${e.text}`}
                                    className="flex items-start gap-2.5"
                                >
                                    <EvidenceBadge kind={e.kind} />
                                    <span className="text-[13px] leading-snug">
                                        {e.text}
                                        <span className="ml-1.5 text-xs text-faint">
                                            · {e.source}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="rounded-xl border border-dashed bg-secondary/40 px-3.5 py-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                            First slice · the sanity-check
                        </p>
                        <p className="mt-1 text-[13px] font-medium">{c.firstSlice.title}</p>
                        {c.firstSlice.doneWhen && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Done when: {c.firstSlice.doneWhen}
                            </p>
                        )}
                    </div>
                    <Button onClick={onPick} disabled={busy} className="w-full sm:w-auto">
                        Select this opportunity
                        <ArrowRight className="size-4" />
                    </Button>
                </div>
            )}
        </article>
    );
}

// ---- specing: drafting the picked company's spec ------------------------------------------
export function SpecingView({ name }: { name: string }) {
    return (
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border bg-card p-5 shadow-e1">
            <Loader2 className="size-4 flex-none animate-spin text-primary" />
            <p className="text-sm">
                Drafting the company spec &amp; branding for <b className="font-semibold">{name}</b>
                …
            </p>
        </div>
    );
}

// ---- spec: the full company spec + branding, ready to commit -------------------------------
export function SpecView({
    draft,
    onCreate,
    onBack,
    busy,
}: {
    draft: DraftView;
    onCreate: () => void;
    onBack: () => void;
    busy: boolean;
}) {
    const spec = draft.spec;
    if (!spec) return null;
    const brand = draft.branding;
    const gradient: CSSProperties = brand
        ? { background: `linear-gradient(150deg, ${brand.palette[0]}, ${brand.palette[1]})` }
        : {};
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Here’s the full company spec. Create it and I’ll start the build loop - the first
                slice is your one sanity-check.
            </p>
            <article className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-e1">
                {/* brand header */}
                <div className="flex items-center gap-4 border-b px-5 py-5">
                    <span
                        className="grid size-14 flex-none place-items-center rounded-2xl font-display text-2xl font-bold text-white shadow-e1"
                        style={gradient}
                    >
                        {brand?.mark ?? spec.product.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate font-display text-2xl font-semibold tracking-tight">
                            {spec.product}
                        </h2>
                        <p className="mt-0.5 font-serif text-[15px] italic text-muted-foreground">
                            {spec.tagline}
                        </p>
                    </div>
                </div>

                <div className="space-y-5 px-5 py-5">
                    {/* facts row */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Fact label="Price" value={`$${spec.pricingUsd}`} sub="/ mo" />
                        <Fact label="Trial" value={`${spec.trialDays}`} sub="days" />
                        <Fact
                            label="Est. MRR"
                            value={`$${fmtK(spec.market.mrrLow)}–${fmtK(spec.market.mrrHigh)}`}
                        />
                        <Fact label="Domain" value={brand?.domain ?? "-"} mono />
                    </div>

                    <Field label="Who it’s for">{spec.icp}</Field>

                    {/* stack */}
                    {spec.stack.length > 0 && (
                        <div>
                            <SectionLabel>Stack</SectionLabel>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {spec.stack.map((s) => (
                                    <span
                                        key={s}
                                        className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground"
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* roadmap */}
                    <div>
                        <SectionLabel>Roadmap · {spec.slices.length} slices</SectionLabel>
                        <ol className="mt-2 space-y-2">
                            {spec.slices.map((s, i) => (
                                <li key={s.title} className="flex gap-3">
                                    <span
                                        className={`grid size-6 flex-none place-items-center rounded-lg font-mono text-[11px] font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                                    >
                                        {i + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[13px] font-medium">
                                            {s.title}
                                        </span>
                                        {s.sub && (
                                            <span className="block text-xs text-muted-foreground">
                                                {s.sub}
                                            </span>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* market brief */}
                    <div className="rounded-xl border bg-secondary/40 px-4 py-3.5">
                        <SectionLabel>Market</SectionLabel>
                        {spec.market.wtpQuote && (
                            <p className="mt-1.5 font-serif text-[15px] italic leading-relaxed">
                                “{spec.market.wtpQuote.replace(/^["“]|["”]$/g, "")}”
                            </p>
                        )}
                        {spec.market.competitors.length > 0 && (
                            <ul className="mt-3 space-y-1.5">
                                {spec.market.competitors.map((cp) => (
                                    <li
                                        key={cp.name}
                                        className="flex items-baseline gap-2 text-[13px]"
                                    >
                                        <span className="font-medium">{cp.name}</span>
                                        <span className="font-mono text-xs text-faint">
                                            {cp.price}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                            {cp.weakness}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* branding */}
                    {brand && (
                        <div>
                            <SectionLabel>Branding</SectionLabel>
                            <div className="mt-2 flex items-center gap-4">
                                <div className="flex gap-1.5">
                                    {brand.palette.map((hex) => (
                                        <span
                                            key={hex}
                                            className="flex flex-col items-center gap-1"
                                        >
                                            <span
                                                className="size-8 rounded-lg border"
                                                style={{ background: hex }}
                                            />
                                            <span className="font-mono text-[9px] text-faint">
                                                {hex.toUpperCase()}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                                    {brand.style}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t px-5 py-4">
                    <Button onClick={onCreate} disabled={busy} size="lg">
                        {busy ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Sparkles className="size-4" />
                        )}
                        Create {spec.product}
                    </Button>
                    <Button variant="ghost" onClick={onBack} disabled={busy}>
                        Choose a different angle
                    </Button>
                </div>
            </article>
        </div>
    );
}

function Fact({
    label,
    value,
    sub,
    mono,
}: {
    label: string;
    value: string;
    sub?: string;
    mono?: boolean;
}) {
    return (
        <div className="rounded-xl border bg-background px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                {label}
            </div>
            <div
                className={`mt-0.5 truncate text-[15px] font-semibold ${mono ? "font-mono text-[13px]" : ""}`}
            >
                {value}
                {sub && (
                    <span className="ml-0.5 text-xs font-normal text-muted-foreground">{sub}</span>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <SectionLabel>{label}</SectionLabel>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{children}</p>
        </div>
    );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
            {children}
        </span>
    );
}

function fmtK(n: number): string {
    return n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n);
}

// ---- creating: the "spinning up your company" animation overlay ---------------------------
const CREATE_STEPS = [
    "Registering the domain",
    "Scaffolding the repository",
    "Wiring Stripe & email",
    "Shipping the walking skeleton",
    "Bringing the company online",
];
export function CreatingView({ product }: { product: string }) {
    const [done, setDone] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setDone((x) => Math.min(CREATE_STEPS.length, x + 1)), 720);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
            <Loader2 className="size-9 animate-spin text-primary" />
            <h2 className="mt-5 font-display text-2xl font-light tracking-tight">
                Creating {product}…
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Spinning up everything it needs to go live.
            </p>
            <ul className="mt-7 w-full space-y-2.5 text-left">
                {CREATE_STEPS.map((s, i) => (
                    <li key={s} className="flex items-center gap-3">
                        {i < done ? (
                            <Check className="size-4 flex-none text-success" />
                        ) : i === done ? (
                            <Loader2 className="size-4 flex-none animate-spin text-primary" />
                        ) : (
                            <span className="size-4 flex-none rounded-full border border-border-soft" />
                        )}
                        <span className={i <= done ? "text-sm" : "text-sm text-faint"}>{s}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// ---- failed: the scout / spec pass errored ------------------------------------------------
export function FailedView({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
    return (
        <div className="rounded-[var(--radius-card)] border border-dashed bg-card p-6 text-center shadow-e1">
            <p className="text-sm font-medium">The scout hit a snag.</p>
            <p className="mt-1 text-xs text-muted-foreground">
                Something went wrong generating this. Give it another go.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry} disabled={busy} className="mt-4">
                <RefreshCw className="size-3.5" />
                Try again
            </Button>
        </div>
    );
}
