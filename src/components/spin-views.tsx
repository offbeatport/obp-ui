import { useEffect, useState } from "react";
import { CompanyLogo } from "~/components/company-logo";
import { Markdown } from "~/components/markdown";
import {
    type Branding,
    type Candidate,
    type CompanySpec,
    SCORE_DISPLAY_ORDER,
    SCORE_META,
    type SpinMessage,
    fmtK,
    scoreBand,
    scoreTotal,
    sigBand,
} from "~/config/spin";
import { cn } from "~/lib/utils";
import type { CompanyDetail } from "~/server/data";

type Spin = NonNullable<CompanyDetail["spin"]>;

// The spin-flow view surfaces, ported to the design prototype's EXACT markup (08-chat-spine-pro-v7)
// but with the styling INLINED as Tailwind v4 utilities (the old command-center/*.css files are no
// longer needed for this file). Tokens map to the app theme in globals.css; keyframes (spin-rot,
// spin-pulse, spin-blink, cc-rot) are registered globally there. Score math + labels come from
// config/spin.ts (one source of truth for engine + UI).

// The assistant chat bubble renders flat: the prototype's .spin-msg.assistant .spin-bubble override
// strips the bubble chrome (no bg/border/shadow/radius), leaving plain 16px body text.
const ASSISTANT_BUBBLE = "max-w-[78%] text-[16px] leading-[1.55] py-[2px]";
// Every <p> inside a spec section: .bf-sec-body p wins the cascade over the per-class p rules
// (higher specificity), so all inner paragraphs render at this one body size.
const SPEC_P = "mt-[7px] text-[15.3px] leading-[1.62] text-muted-foreground";

// ---- chat bubble (spin-msg / spin-av / spin-stream-body / spin-bubble) -----------------------
export function Bubble({ m }: { m: SpinMessage }) {
    const me = m.role === "user";
    return (
        <div className={cn("flex gap-[12px] items-start", me && "flex-row-reverse")}>
            <div className="hidden">{me ? "V" : "C"}</div>
            <div
                className="flex-1 min-w-0 flex flex-col gap-[11px]"
                style={me ? { alignItems: "flex-end" } : undefined}
            >
                <div
                    className={cn(
                        "max-w-[78%] text-[16px] leading-[1.55]",
                        me
                            ? "px-[16px] py-[12px] rounded-[16px] rounded-tr-[5px] shadow-e1 bg-foreground text-background"
                            : "py-[2px]",
                    )}
                >
                    {me ? m.content : <Markdown content={m.content} />}
                </div>
            </div>
        </div>
    );
}

// A bare assistant avatar column that hosts an artifact card (scouting/proposals/spec) as its
// stream body — matches the prototype's "assistant turn = avatar + stream-body(bubble? + card)".
function AssistantTurn({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex gap-[12px] items-start">
            <div className="hidden">C</div>
            <div className="flex-1 min-w-0 flex flex-col gap-[11px]">{children}</div>
        </div>
    );
}

// ---- scouting: an HONEST live-research indicator. The scout is a single AI research pass (no web
// scraping), so we show only what's real: the idea, a live elapsed clock, and the actual rubric the
// model scores every candidate on (config/spin SCORE_META). No fabricated "sources scanned".
export function ScoutingView({ thought }: { thought: string }) {
    const [secs, setSecs] = useState(0);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const t = setInterval(() => setSecs((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, []);
    const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    return (
        <AssistantTurn>
            <div className={ASSISTANT_BUBBLE}>
                Researching your idea now — I'll propose a few distinct opportunities and score each
                on real demand signals, then bring back the strongest bets.
            </div>
            <article className="overflow-hidden opacity-90">
                <div className="pt-0 px-[2px] pb-[2px]">
                    <button
                        type="button"
                        className="group flex items-center gap-[10px] w-full py-[6px] px-[2px] bg-transparent border-none cursor-pointer text-left text-[13px] text-muted-foreground"
                        aria-expanded={open}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <span className="w-[13px] h-[13px] shrink-0 rounded-full border-2 border-border border-t-faint animate-[spin-rot_0.7s_linear_infinite]" />
                        <span className="flex-1 min-w-0 group-hover:text-foreground [&_b]:text-foreground [&_b]:font-semibold">
                            Analyzing <b>{clip(thought, 46)}</b> — a live AI research pass…
                        </span>
                        <span className="font-mono text-[11px] text-faint shrink-0 tabular-nums">
                            {elapsed}
                        </span>
                        <span
                            className={cn(
                                "text-[28px] -mt-[6px] leading-none text-muted-foreground shrink-0",
                                open && "rotate-180",
                            )}
                            aria-hidden="true"
                        >
                            ▾
                        </span>
                    </button>
                    <div className="mt-[12px]" hidden={!open}>
                        <p className="mb-[12px] text-[12.5px] leading-[1.5] text-muted-foreground">
                            This is a real model call — no canned steps. Every opportunity it
                            returns is scored 0–10 on these signals (willingness-to-pay counts
                            double):
                        </p>
                        <div className="grid grid-cols-2 gap-x-[14px] gap-y-[9px]">
                            {SCORE_DISPLAY_ORDER.map((k) => {
                                const meta = SCORE_META[k];
                                return (
                                    <div key={k} className="flex items-start gap-[8px] min-w-0">
                                        <span className="mt-[5px] size-[6px] shrink-0 rounded-full bg-primary/70" />
                                        <span className="min-w-0">
                                            <span className="block text-[12px] font-semibold text-foreground">
                                                {meta.full}
                                            </span>
                                            <span className="block text-[11px] leading-[1.4] text-faint">
                                                {meta.hint}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-[14px] font-mono text-[10.5px] text-faint">
                            usually 10–40s · scored proposals appear below when it's done
                        </p>
                    </div>
                </div>
            </article>
        </AssistantTurn>
    );
}

// ---- proposals: the quiet-list of ranked candidates -----------------------------------------
export function ProposalsView({
    candidates,
    pickedId,
    onPick,
    busy,
}: {
    candidates: Candidate[];
    pickedId?: string;
    onPick: (id: string) => void;
    busy: boolean;
}) {
    const ranked = [...candidates].sort((a, b) => scoreTotal(b.scores) - scoreTotal(a.scores));
    const [open, setOpen] = useState<string | null>(ranked[0]?.id ?? null);
    return (
        <AssistantTurn>
            <div className="flex items-baseline gap-[10px] flex-wrap text-[13.5px] text-muted-foreground leading-[1.5] mb-[4px] [&_b]:text-foreground [&_b]:font-semibold">
                <span>
                    <b>Same pain, {ranked.length} opportunities.</b> Ranked by <b>overall score</b>{" "}
                    · willingness-to-pay counts 2×.
                </span>
                <span className="font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint ml-auto">
                    ranked by overall score
                </span>
            </div>
            <div>
                <div className="border border-border rounded-[12px] bg-card shadow-e1 overflow-hidden">
                    {ranked.map((c, i) => {
                        const total = scoreTotal(c.scores);
                        const isOpen = open === c.id;
                        const chosen = c.id === pickedId;
                        const band = scoreBand(total);
                        const proof = c.evidence[0];
                        return (
                            <div
                                key={c.id}
                                className="border-t border-border-soft first:border-t-0"
                                data-row={c.id}
                            >
                                <div className="flex items-stretch">
                                    <button
                                        className={cn(
                                            "flex-1 min-w-0 flex items-center gap-[13px] py-[14px] px-[16px] bg-transparent border-none cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:[outline-offset:-2px]",
                                            isOpen
                                                ? "bg-secondary"
                                                : chosen
                                                  ? "bg-accent"
                                                  : "hover:bg-secondary",
                                        )}
                                        type="button"
                                        title="Pick this opportunity"
                                        disabled={busy}
                                        onClick={() => onPick(c.id)}
                                    >
                                        <span
                                            className={cn(
                                                "font-mono font-bold text-[12px] w-[15px] shrink-0 text-center",
                                                i === 0 ? "text-primary" : "text-faint",
                                            )}
                                        >
                                            {i + 1}
                                        </span>
                                        <span className="flex-1 min-w-0">
                                            <span
                                                className={cn(
                                                    "block text-[15px] font-semibold text-foreground",
                                                    chosen &&
                                                        "after:content-['✓_picked'] after:ml-[9px] after:font-mono after:text-[9.5px] after:font-bold after:tracking-[0.03em] after:text-accent-foreground",
                                                )}
                                            >
                                                {c.name}
                                            </span>
                                            <span className="block text-[14px] text-faint mt-[4px] whitespace-nowrap overflow-hidden text-ellipsis">
                                                {c.wedge}
                                            </span>
                                        </span>
                                        <span
                                            className={cn(
                                                "font-mono font-bold text-[11.5px] py-[4px] px-[10px] rounded-[20px] shrink-0",
                                                band === "hi" && "text-success bg-success-soft",
                                                band === "mid" && "text-warning bg-warning-soft",
                                                band === "lo" && "text-faint bg-secondary",
                                            )}
                                            title="Overall score · willingness-to-pay counts 2×"
                                        >
                                            {total.toFixed(1)}
                                        </span>
                                    </button>
                                    <button
                                        className={cn(
                                            "shrink-0 w-[54px] self-stretch border-none bg-transparent grid place-items-center cursor-pointer hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
                                            isOpen ? "rotate-180 text-primary" : "text-faint",
                                        )}
                                        type="button"
                                        aria-label="Show the score breakdown"
                                        aria-expanded={isOpen}
                                        onClick={() => setOpen(isOpen ? null : c.id)}
                                    >
                                        <svg
                                            className="w-[21px] h-[21px]"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="m6 9 6 6 6-6" />
                                        </svg>
                                    </button>
                                </div>
                                <div
                                    className={cn(
                                        isOpen ? "block" : "hidden",
                                        "pt-[2px] px-[16px] pb-[16px]",
                                    )}
                                >
                                    <div className="font-sans w-full bg-card text-foreground py-[15px] px-[17px] flex flex-col gap-[12px]">
                                        <div className="flex items-start gap-[12px]">
                                            <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
                                                <div className="text-[12.5px] leading-[2] text-muted-foreground capitalize">
                                                    {c.wedge}
                                                </div>
                                            </div>
                                        </div>
                                        {proof && (
                                            <div className="text-[12px] leading-[1.35] text-muted-foreground italic border-l-2 border-primary pl-[10px] [&_b]:not-italic [&_b]:font-mono [&_b]:text-[10px] [&_b]:text-faint [&_b]:uppercase [&_b]:tracking-[0.4px] [&_b]:ml-[6px]">
                                                “{proof.text}”<b>{proof.source}</b>
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-[8px] py-[10px] px-0">
                                            <div className="grid grid-cols-[50px_1fr] gap-[11px] items-baseline">
                                                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-faint">
                                                    Pain
                                                </span>
                                                <span className="text-[12px] leading-[1.45] text-muted-foreground">
                                                    {c.pain}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[50px_1fr] gap-[11px] items-baseline">
                                                <span className="font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-faint">
                                                    Buyer
                                                </span>
                                                <span className="text-[12px] leading-[1.45] text-muted-foreground">
                                                    {c.icp}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-[6px]">
                                            {SCORE_DISPLAY_ORDER.map((k) => {
                                                const v = c.scores[k] ?? 0;
                                                const meta = SCORE_META[k];
                                                const sb = sigBand(v);
                                                return (
                                                    <div
                                                        key={k}
                                                        className={cn(
                                                            "group relative flex items-center justify-between gap-[6px] pt-[5px] pr-[6px] pb-[5px] pl-[9px] rounded-[8px] border border-border-soft bg-background cursor-default transition-colors duration-150 hover:bg-secondary hover:border-faint",
                                                            sb === "sig-gray"
                                                                ? "border-border"
                                                                : sb === "sig-amber"
                                                                  ? "border-warning-soft"
                                                                  : "border-success-soft",
                                                        )}
                                                    >
                                                        <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                                            {meta.label}
                                                        </span>
                                                        <span
                                                            className={cn(
                                                                "font-mono text-[12px] font-bold w-[21px] h-[21px] shrink-0 flex items-center justify-center rounded-[6px]",
                                                                sb === "sig-gray"
                                                                    ? "bg-neutral text-white"
                                                                    : sb === "sig-amber"
                                                                      ? "bg-warning-soft text-warning"
                                                                      : "bg-success-soft text-success",
                                                            )}
                                                        >
                                                            {v}
                                                        </span>
                                                        <span className="absolute bottom-[calc(100%+7px)] left-1/2 w-[158px] bg-foreground text-background font-sans text-[11px] leading-[1.35] text-center py-[7px] px-[9px] rounded-[8px] opacity-0 invisible pointer-events-none z-[6] -translate-x-1/2 translate-y-[4px] transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[5px] after:border-transparent after:border-t-foreground">
                                                            <strong className="block font-mono text-[9.5px] uppercase tracking-[0.5px] text-accent mb-[3px] font-semibold">
                                                                {meta.full}
                                                            </strong>
                                                            {meta.hint}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-[12px] pt-[10px] border-t border-border-soft mt-[1px]">
                                            <div className="mr-auto flex items-center gap-[12px] font-mono text-[14px] text-faint">
                                                <span>score {total.toFixed(1)}/10</span>
                                            </div>
                                            <button
                                                className="font-sans text-[13px] font-semibold text-white bg-primary border-none rounded-[9px] py-[9px] px-[17px] cursor-pointer whitespace-nowrap hover:-translate-y-px hover:brightness-105"
                                                type="button"
                                                disabled={busy}
                                                onClick={() => onPick(c.id)}
                                            >
                                                Select this opportunity
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </AssistantTurn>
    );
}

// ---- specing: a light "drafting" turn ------------------------------------------------------
export function SpecingView({ name }: { name: string }) {
    return (
        <AssistantTurn>
            <div className={ASSISTANT_BUBBLE}>
                Drafting the <b>{name}</b> company spec &amp; branding… <span />
            </div>
        </AssistantTurn>
    );
}

// ---- spec: the spec letterhead + approve turn -----------------------------------------------
// Delegates to the shared CompanyLogo (identical look) so the generated logo is one component.
function BrandLogo({ branding, size }: { branding: Branding; size: number }) {
    return <CompanyLogo name={branding.mark} branding={branding} size={size} />;
}

export function SpecView({
    spin,
    onCreate,
    onBack,
    busy,
}: {
    spin: Spin;
    onCreate: () => void;
    onBack: () => void;
    busy: boolean;
}) {
    const spec = spin.spec;
    const branding = spin.branding;
    if (!spec || !branding) return null;
    const picked = spin.candidates.find((c) => c.id === spin.pickedId);
    const slug = spec.product.toLowerCase().replace(/[^a-z0-9]/g, "");
    const brandVars = {
        "--draft-brand": branding.palette[0],
        "--draft-accent": branding.palette[1],
    } as React.CSSProperties;
    return (
        <AssistantTurn>
            <article
                className="font-serif text-foreground bg-card border border-border border-t-4 border-t-[color:var(--draft-brand)] rounded-[5px] shadow-[0_1px_2px_rgba(44,41,38,0.04),0_14px_38px_rgba(44,41,38,0.05)] py-[40px] px-[48px] max-w-[820px] mx-auto overflow-visible"
                style={brandVars}
            >
                <header>
                    <div className="flex justify-between items-baseline gap-[16px]">
                        <span className="font-serif text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--draft-brand)]">
                            Company draft
                        </span>
                        <span className="text-[12.5px] italic text-faint text-right leading-[1.4]">
                            {picked ? `Seeded from ${picked.name}` : "From your thought"}
                        </span>
                    </div>
                    <div className="flex items-center gap-[16px] mt-[15px]">
                        <span className="shrink-0">
                            <BrandLogo branding={branding} size={58} />
                        </span>
                        <div className="min-w-0">
                            <h2 className="m-0 text-[34px] font-medium tracking-[-0.015em] leading-[1.04] text-foreground">
                                {spec.product}
                            </h2>
                            <p className="mt-[7px] text-[17px] italic leading-[1.4] text-muted-foreground max-w-[82ch]">
                                {spec.tagline}
                            </p>
                        </div>
                    </div>
                </header>

                <hr className="h-px bg-border border-0 mt-[26px]" />

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        1
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            The company
                        </h3>
                        <p className={SPEC_P}>
                            <b>{spec.product}</b>
                            {picked ? (
                                <>
                                    {" "}
                                    grew from the{" "}
                                    <em className="italic text-foreground">{picked.name}</em>{" "}
                                    opportunity — {picked.pain}
                                </>
                            ) : null}
                        </p>
                    </div>
                </section>

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        2
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            Who it's for
                        </h3>
                        <p className={SPEC_P}>{spec.icp}</p>
                    </div>
                </section>

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        3
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            Branding
                        </h3>
                        <div className="flex gap-[18px] items-center flex-wrap">
                            <div className="shrink-0 flex flex-col items-center gap-[6px]">
                                <BrandLogo branding={branding} size={52} />
                                <span className="font-mono text-[8.5px] tracking-[0.05em] uppercase text-faint">
                                    Generated logo
                                </span>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <div className="flex gap-[16px] flex-wrap">
                                    <Swatch label="Primary" hex={branding.palette[0]} />
                                    <Swatch label="Accent" hex={branding.palette[1]} />
                                    <Swatch label="Ink" hex="#241f1c" />
                                </div>
                                <p className={SPEC_P}>
                                    <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.05em] text-faint mr-[9px]">
                                        Style
                                    </span>
                                    {branding.style}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        4
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            What we'll build
                            <sup className="text-[0.58em] text-primary align-super ml-[2px] not-italic">
                                †
                            </sup>
                        </h3>
                        <p className={SPEC_P}>
                            A first version in {spec.slices.length} slices. The first is your single
                            sanity-check — proof the core loop works before anything else.
                        </p>
                        <ol className="list-none mt-[15px] p-0 border-t border-border-soft">
                            {spec.slices.map((s, i) => {
                                const isCheck = i === 0;
                                return (
                                    <li
                                        key={s.title}
                                        className={cn(
                                            "grid grid-cols-[38px_1fr] gap-[14px] py-[12px] border-b",
                                            isCheck
                                                ? "border-[color:color-mix(in_srgb,var(--draft-brand)_35%,var(--border))]"
                                                : "border-border-soft",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "text-[14.5px] leading-[1.5]",
                                                isCheck
                                                    ? "text-primary font-semibold"
                                                    : "font-medium text-faint",
                                            )}
                                        >
                                            3.{i + 1}
                                        </span>
                                        <div>
                                            <div className="flex items-baseline flex-wrap gap-x-[10px] gap-y-[7px]">
                                                <span className="text-[15.3px] font-semibold leading-[1.45] text-foreground">
                                                    {s.title}
                                                </span>
                                                {i === 0 && (
                                                    <span className="font-serif text-[9.5px] font-semibold tracking-[0.12em] uppercase text-accent-foreground bg-accent py-[3px] px-[8px] rounded-[3px] whitespace-nowrap">
                                                        Sanity-check
                                                    </span>
                                                )}
                                            </div>
                                            {i === 0 && s.doneWhen ? (
                                                <p className={SPEC_P}>
                                                    <span className="italic text-accent-foreground">
                                                        Done when
                                                    </span>{" "}
                                                    {s.doneWhen}
                                                </p>
                                            ) : (
                                                s.sub && <p className={SPEC_P}>{s.sub}</p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                </section>

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        5
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            Name &amp; domain
                        </h3>
                        <div>
                            <div className="flex items-center gap-[11px] flex-wrap">
                                <span className="font-mono text-[15px] font-bold text-foreground">
                                    {branding.domain}
                                </span>
                                <span className="inline-flex items-center gap-[6px] text-[11.5px] font-semibold py-[4px] px-[10px] rounded-[20px] bg-success-soft text-success">
                                    <span className="w-[6px] h-[6px] rounded-full bg-success" />
                                    available · $12/yr
                                </span>
                                <button
                                    type="button"
                                    className="text-[12px] font-semibold text-accent-foreground bg-accent border-none rounded-[9px] py-[6px] px-[12px] cursor-pointer hover:brightness-[0.98]"
                                    onClick={onCreate}
                                >
                                    Register →
                                </button>
                            </div>
                            <div className="flex items-center gap-[12px] flex-wrap mt-[11px]">
                                <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.05em] text-faint">
                                    Also free
                                </span>
                                <span className="font-mono text-[12px] text-muted-foreground inline-flex items-center gap-[5px]">
                                    get{slug}.com
                                    <span className="text-[8.5px] font-bold uppercase tracking-[0.04em] text-success bg-success-soft rounded-[5px] py-px px-[6px]">
                                        free
                                    </span>
                                </span>
                                <span className="font-mono text-[12px] text-muted-foreground inline-flex items-center gap-[5px]">
                                    {slug}hq.com
                                    <span className="text-[8.5px] font-bold uppercase tracking-[0.04em] text-success bg-success-soft rounded-[5px] py-px px-[6px]">
                                        free
                                    </span>
                                </span>
                            </div>
                            <p className={SPEC_P}>
                                I only propose names whose <b>.com</b> is unregistered and ready to
                                buy.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-[27px_1fr] gap-[17px] mt-[25px]">
                    <div className="text-[17px] font-semibold leading-[1.5] text-[color:var(--draft-brand)]">
                        6
                    </div>
                    <div>
                        <h3 className="text-[17px] font-semibold leading-[1.5] text-foreground">
                            Terms
                        </h3>
                        <dl className="m-0 p-0 border-t border-border-soft">
                            <div className="grid grid-cols-[90px_1fr] gap-[14px] py-[9px] border-b border-border-soft">
                                <dt className="font-serif text-[11px] font-semibold tracking-[0.12em] uppercase text-faint pt-[3px]">
                                    Price
                                </dt>
                                <dd className="m-0 text-[15.3px] leading-[1.5] text-foreground">
                                    ${spec.pricingUsd}
                                    <span className="text-faint"> / mo</span>
                                </dd>
                            </div>
                            <div className="grid grid-cols-[90px_1fr] gap-[14px] py-[9px] border-b border-border-soft">
                                <dt className="font-serif text-[11px] font-semibold tracking-[0.12em] uppercase text-faint pt-[3px]">
                                    Trial
                                </dt>
                                <dd className="m-0 text-[15.3px] leading-[1.5] text-foreground">
                                    {spec.trialDays} days, free
                                </dd>
                            </div>
                            <div className="grid grid-cols-[90px_1fr] gap-[14px] py-[9px] border-b border-border-soft">
                                <dt className="font-serif text-[11px] font-semibold tracking-[0.12em] uppercase text-faint pt-[3px]">
                                    Est. MRR
                                </dt>
                                <dd className="m-0 text-[15.3px] leading-[1.5] text-foreground">
                                    ${fmtK(spec.market.mrrLow)}–${fmtK(spec.market.mrrHigh)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <p className="mt-[24px] text-[12.5px] italic leading-[1.5] text-faint">
                    <span className="not-italic text-primary mr-[5px]">†</span> Built with{" "}
                    {spec.stack.join(", ")}.
                </p>
            </article>

            <div className="max-w-[820px] mt-[18px] mx-auto flex flex-col gap-[14px]">
                <div className={ASSISTANT_BUBBLE}>
                    Ready to build <b>{spec.product}</b>? I'll register the domain, build v1 in test
                    mode, then deploy it.
                </div>
                <div className="flex items-end justify-between gap-[20px] flex-wrap bg-secondary border border-border rounded-[14px] py-[16px] px-[18px]">
                    <button
                        className="shrink-0 text-[14px] font-semibold text-white bg-primary border-none rounded-[13px] py-[12px] px-[20px] cursor-pointer inline-flex items-center gap-[9px] shadow-[0_1px_2px_rgba(200,100,60,0.18),0_6px_18px_rgba(200,100,60,0.2)] hover:brightness-[1.04] hover:-translate-y-px active:translate-y-0"
                        type="button"
                        disabled={busy}
                        onClick={onBack}
                        style={{ marginRight: "auto" }}
                    >
                        ← Choose a different angle
                    </button>
                    <button
                        className="shrink-0 inline-flex items-center gap-[9px] text-[15px] font-[650] text-white bg-success border-none rounded-[13px] py-[14px] px-[22px] cursor-pointer shadow-[0_1px_2px_rgba(40,90,50,0.18),0_8px_22px_rgba(40,90,50,0.22)] hover:-translate-y-px hover:brightness-[1.04]"
                        type="button"
                        disabled={busy}
                        onClick={onCreate}
                    >
                        <svg
                            className="w-[17px] h-[17px]"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d="M3 8.5l3 3 7-7.5"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        Create {spec.product}
                    </button>
                </div>
            </div>
        </AssistantTurn>
    );
}

function Swatch({ label, hex }: { label: string; hex: string }) {
    return (
        <div className="flex items-center gap-[9px]">
            <span
                className="w-[24px] h-[24px] rounded-[7px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
                style={{ background: hex }}
            />
            <span className="flex flex-col leading-[1.25]">
                <span className="text-[11.5px] font-semibold text-foreground">{label}</span>
                <span className="font-mono text-[10px] text-faint">{hex.toUpperCase()}</span>
            </span>
        </div>
    );
}

// ---- creating: the steps animation (unchanged behavior) ------------------------------------
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
        <div className="flex justify-center py-[56px] px-[24px]">
            <div className="bg-card border border-border rounded-[22px] shadow-e2 py-[40px] px-[44px] max-w-[440px] w-full text-center">
                <div className="w-[56px] h-[56px] mx-auto mb-[22px]">
                    <svg
                        className="w-full h-full -rotate-90"
                        viewBox="0 0 50 50"
                        aria-hidden="true"
                    >
                        <circle
                            className="fill-none stroke-border [stroke-width:4]"
                            cx="25"
                            cy="25"
                            r="20"
                        />
                        <circle
                            className="fill-none stroke-primary [stroke-width:4] [stroke-linecap:round] [stroke-dasharray:90_60] animate-[cc-rot_0.9s_linear_infinite]"
                            cx="25"
                            cy="25"
                            r="20"
                        />
                    </svg>
                </div>
                <h2 className="font-semibold text-[22px] text-foreground m-0 mb-[6px]">
                    Creating {product}…
                </h2>
                <p className="text-[14px] text-muted-foreground m-0 mb-[24px]">
                    Spinning up everything it needs to go live.
                </p>
                <ul className="list-none m-0 p-0 text-left flex flex-col gap-[12px]">
                    {CREATE_STEPS.map((s, i) => {
                        const isDone = i < done;
                        return (
                            <li
                                key={s}
                                className={cn(
                                    "flex items-center gap-[12px] text-[14px] transition-[opacity,color] duration-300",
                                    isDone
                                        ? "opacity-100 text-foreground"
                                        : "opacity-50 text-faint",
                                )}
                            >
                                <span
                                    className={cn(
                                        "w-[20px] h-[20px] rounded-full border-2 shrink-0 relative transition-[border-color,background] duration-300",
                                        isDone
                                            ? "bg-success border-success after:content-[''] after:absolute after:left-[6px] after:top-[3px] after:w-[5px] after:h-[9px] after:border-solid after:border-white after:[border-width:0_2px_2px_0] after:rotate-45"
                                            : "border-border",
                                    )}
                                />
                                <span>{s}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

// ---- failed ---------------------------------------------------------------------------------
export function FailedView({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
    return (
        <AssistantTurn>
            <div className={ASSISTANT_BUBBLE}>
                The scout hit a snag. Want me to try again?{" "}
                <button
                    type="button"
                    className="shrink-0 text-[14px] font-semibold text-white bg-primary border-none rounded-[13px] py-[12px] px-[20px] cursor-pointer inline-flex items-center gap-[9px] shadow-[0_1px_2px_rgba(200,100,60,0.18),0_6px_18px_rgba(200,100,60,0.2)] hover:brightness-[1.04] hover:-translate-y-px active:translate-y-0"
                    disabled={busy}
                    onClick={onRetry}
                    style={{ marginLeft: 8 }}
                >
                    Try again
                </button>
            </div>
        </AssistantTurn>
    );
}

// ---- tiny helpers ---------------------------------------------------------------------------
function clip(s: string, n: number): string {
    const t = (s || "").trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}
