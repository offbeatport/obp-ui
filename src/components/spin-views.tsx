import { useEffect, useState } from "react";
import { CompanyLogo } from "~/components/company-logo";
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
import type { CompanyDetail } from "~/server/data";

type Spin = NonNullable<CompanyDetail["spin"]>;

// The spin-flow view surfaces, ported to the design prototype's EXACT markup + classes
// (08-chat-spine-pro-v7.html). Styling lives in command-center/spin-proto.css (verbatim rules
// scoped under .cc); this file only reproduces the class structure and binds the draft data.
// Score math + labels come from config/spin.ts (one source of truth for engine + UI).

// ---- chat bubble (.spin-msg / .spin-av / .spin-stream-body / .spin-bubble) ------------------
export function Bubble({ m }: { m: SpinMessage }) {
    const me = m.role === "user";
    return (
        <div className={`spin-msg ${me ? "user" : "assistant"}`}>
            <div className="spin-av">{me ? "V" : "C"}</div>
            <div className="spin-stream-body" style={me ? { alignItems: "flex-end" } : undefined}>
                <div className="spin-bubble">{m.content}</div>
            </div>
        </div>
    );
}

// A bare assistant avatar column that hosts an artifact card (scouting/proposals/spec) as its
// stream body — matches the prototype's "assistant turn = avatar + stream-body(bubble? + card)".
function AssistantTurn({ children }: { children: React.ReactNode }) {
    return (
        <div className="spin-msg assistant">
            <div className="spin-av">C</div>
            <div className="spin-stream-body">{children}</div>
        </div>
    );
}

// ---- scouting: the ambient .spin-card.spin-scout (spinner + sources + log + progress) --------
const SCOUT_SOURCES = [
    "r/startups",
    "Google Trends",
    "competitor pricing",
    "IndieHackers",
    "review sites",
    "product forums",
];
const SCOUT_LOG = [
    "scanning communities for demand signals",
    "reading competitor pricing pages",
    "measuring willingness to pay",
    "spotting gaps the incumbents miss",
    "clustering opportunities & scoring demand…",
];
export function ScoutingView({ thought }: { thought: string }) {
    const [tick, setTick] = useState(0);
    // The "thinking" detail is collapsible (prototype default: collapsed) — the headline line is a
    // toggle button, the sources/log/progress live in .spin-scout-more[hidden].
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const t = setInterval(() => setTick((x) => x + 1), 1300);
        return () => clearInterval(t);
    }, []);
    const done = Math.min(SCOUT_SOURCES.length, tick + 1);
    const shownLogs = Math.min(SCOUT_LOG.length, tick + 1);
    return (
        <AssistantTurn>
            <div className="spin-bubble">
                On it · researching now. I'll surface receipts as I find them.
            </div>
            <article className="spin-card spin-scout">
                <div className="spin-card-body">
                    <button
                        type="button"
                        className="spin-scout-line"
                        aria-expanded={open}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <span className="spinner" />
                        <span className="spin-scout-headline">
                            Scouting around <b>{clip(thought, 46)}</b> · scanning{" "}
                            {SCOUT_SOURCES.length} sources for demand signals…
                        </span>
                        <span className="spin-scout-meta mono">
                            {done} / {SCOUT_SOURCES.length}
                        </span>
                        <span className="spin-scout-cv" aria-hidden="true">
                            ▾
                        </span>
                    </button>
                    <div className="spin-scout-more" hidden={!open}>
                        <div className="spin-sources">
                            {SCOUT_SOURCES.map((s, i) => (
                                <span
                                    key={s}
                                    className={`spin-src ${i < done - 1 ? "done" : i === done - 1 ? "run" : "queued"}`}
                                >
                                    <span className="sd" />
                                    {s}
                                </span>
                            ))}
                        </div>
                        <div className="spin-log">
                            {SCOUT_LOG.slice(0, shownLogs).map((line, i) => (
                                <div
                                    key={line}
                                    className={`lg${i === shownLogs - 1 ? " cur" : ""}`}
                                >
                                    <span className="lt mono">
                                        0:{String(2 + i * 4).padStart(2, "0")}
                                    </span>
                                    <span className="lx">
                                        {line}
                                        {i < shownLogs - 1 && <span className="ok"> ✓</span>}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="spin-progress">
                            <div className="bar" />
                        </div>
                        <div className="spin-progress-meta">
                            <span>
                                {done} / {SCOUT_SOURCES.length} sources scanned
                            </span>
                            <span>scoring opportunities</span>
                        </div>
                    </div>
                </div>
            </article>
        </AssistantTurn>
    );
}

// ---- proposals: the .ql quiet-list of ranked candidates ------------------------------------
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
            <div className="spin-prop-lead">
                <span>
                    <b>Same pain, {ranked.length} opportunities.</b> Ranked by <b>overall score</b>{" "}
                    · willingness-to-pay counts 2×.
                </span>
                <span className="ulab sortby spin-prop-sortlabel">ranked by overall score</span>
            </div>
            <div className="spin-prop-mount">
                <div className={`ql${pickedId ? " ql-locked" : ""}`}>
                    {ranked.map((c, i) => {
                        const total = scoreTotal(c.scores);
                        const isOpen = open === c.id;
                        const proof = c.evidence[0];
                        return (
                            <div
                                key={c.id}
                                className={`host${isOpen ? " open" : ""}${c.id === pickedId ? " ql-chosen" : ""}`}
                                data-row={c.id}
                            >
                                <div className="ql-row">
                                    <button
                                        className="ql-select"
                                        type="button"
                                        title="Pick this opportunity"
                                        disabled={busy}
                                        onClick={() => onPick(c.id)}
                                    >
                                        <span className="ql-rank">{i + 1}</span>
                                        <span className="ql-id">
                                            <span className="ql-nm">{c.name}</span>
                                            <span className="ql-wd">{c.wedge}</span>
                                        </span>
                                        <span
                                            className={`ql-sig ${scoreBand(total)}`}
                                            title="Overall score · willingness-to-pay counts 2×"
                                        >
                                            {total.toFixed(1)}
                                        </span>
                                    </button>
                                    <button
                                        className="ql-cv"
                                        type="button"
                                        aria-label="Show the score breakdown"
                                        aria-expanded={isOpen}
                                        onClick={() => setOpen(isOpen ? null : c.id)}
                                    >
                                        <svg
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
                                <div className="ql-detail">
                                    <div className="exc-panel exc-v2">
                                        <div className="hdr">
                                            <div className="hdr-main">
                                                <div className="wedge">{c.wedge}</div>
                                            </div>
                                        </div>
                                        {proof && (
                                            <div className="proof">
                                                “{proof.text}”<b>{proof.source}</b>
                                            </div>
                                        )}
                                        <div className="ctx">
                                            <div className="ctx-row">
                                                <span className="ctx-k">Pain</span>
                                                <span className="ctx-v">{c.pain}</span>
                                            </div>
                                            <div className="ctx-row">
                                                <span className="ctx-k">Buyer</span>
                                                <span className="ctx-v">{c.icp}</span>
                                            </div>
                                        </div>
                                        <div className="signals">
                                            {SCORE_DISPLAY_ORDER.map((k) => {
                                                const v = c.scores[k] ?? 0;
                                                const meta = SCORE_META[k];
                                                return (
                                                    <div key={k} className={`sig ${sigBand(v)}`}>
                                                        <span className="sig-name">
                                                            {meta.label}
                                                        </span>
                                                        <span className="sig-score">{v}</span>
                                                        <span className="sig-tip">
                                                            <strong>{meta.full}</strong>
                                                            {meta.hint}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="cta cta-top">
                                            <div className="market">
                                                <span>score {total.toFixed(1)}/10</span>
                                            </div>
                                            <button
                                                className="btn-primary"
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
            <div className="spin-bubble">
                Drafting the <b>{name}</b> company spec &amp; branding… <span className="spinner" />
            </div>
        </AssistantTurn>
    );
}

// ---- spec: the .spin-spec letterhead + .spin-ready approve turn -----------------------------
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
            <article className="spin-card spin-spec spin-spec-card is-branded" style={brandVars}>
                <header className="bf-lh">
                    <div className="bf-lh-top">
                        <span className="bf-lh-label">Company draft</span>
                        <span className="bf-lh-ref">
                            {picked ? `Seeded from ${picked.name}` : "From your thought"}
                        </span>
                    </div>
                    <div className="bf-lh-name">
                        <span className="bf-lh-logo">
                            <BrandLogo branding={branding} size={58} />
                        </span>
                        <div className="bf-lh-nx">
                            <h2 className="bf-name">{spec.product}</h2>
                            <p className="bf-tag">{spec.tagline}</p>
                        </div>
                    </div>
                </header>

                <hr className="bf-rule" />

                <section className="bf-sec">
                    <div className="bf-sec-no">1</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">The company</h3>
                        <p>
                            <b>{spec.product}</b>
                            {picked ? (
                                <>
                                    {" "}
                                    grew from the <em>{picked.name}</em> opportunity — {picked.pain}
                                </>
                            ) : null}
                        </p>
                    </div>
                </section>

                <section className="bf-sec">
                    <div className="bf-sec-no">2</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">Who it's for</h3>
                        <p>{spec.icp}</p>
                    </div>
                </section>

                <section className="bf-sec">
                    <div className="bf-sec-no">3</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">Branding</h3>
                        <div className="bf-brand">
                            <div className="bf-logo">
                                <BrandLogo branding={branding} size={52} />
                                <span className="bf-logo-cap">Generated logo</span>
                            </div>
                            <div className="bf-brand-body">
                                <div className="bf-swatches">
                                    <Swatch label="Primary" hex={branding.palette[0]} />
                                    <Swatch label="Accent" hex={branding.palette[1]} />
                                    <Swatch label="Ink" hex="#241f1c" />
                                </div>
                                <p className="bf-brand-style">
                                    <span className="bf-brand-lab">Style</span>
                                    {branding.style}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="bf-sec">
                    <div className="bf-sec-no">4</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">
                            What we'll build<sup className="bf-fn-ref">†</sup>
                        </h3>
                        <p>
                            A first version in {spec.slices.length} slices. The first is your single
                            sanity-check — proof the core loop works before anything else.
                        </p>
                        <ol className="bf-slices">
                            {spec.slices.map((s, i) => (
                                <li
                                    key={s.title}
                                    className={`bf-slice${i === 0 ? " is-check" : ""}`}
                                >
                                    <span className="bf-slice-no">3.{i + 1}</span>
                                    <div className="bf-slice-c">
                                        <div className="bf-slice-head">
                                            <span className="bf-slice-name">{s.title}</span>
                                            {i === 0 && (
                                                <span className="bf-slice-tag">Sanity-check</span>
                                            )}
                                        </div>
                                        {i === 0 && s.doneWhen ? (
                                            <p className="bf-slice-done">
                                                <span className="dw">Done when</span> {s.doneWhen}
                                            </p>
                                        ) : (
                                            s.sub && <p className="bf-slice-desc">{s.sub}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="bf-sec">
                    <div className="bf-sec-no">5</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">Name &amp; domain</h3>
                        <div className="bf-domain">
                            <div className="bf-dom-main">
                                <span className="bf-dom-name">{branding.domain}</span>
                                <span className="bf-dom-badge ok">
                                    <span className="bf-dom-dot" />
                                    available · $12/yr
                                </span>
                                <button type="button" className="bf-dom-buy" onClick={onCreate}>
                                    Register →
                                </button>
                            </div>
                            <div className="bf-dom-alts">
                                <span className="bf-dom-alts-l">Also free</span>
                                <span className="bf-dom-alt">
                                    get{slug}.com<span className="bf-dom-free">free</span>
                                </span>
                                <span className="bf-dom-alt">
                                    {slug}hq.com<span className="bf-dom-free">free</span>
                                </span>
                            </div>
                            <p className="bf-dom-note">
                                I only propose names whose <b>.com</b> is unregistered and ready to
                                buy.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="bf-sec">
                    <div className="bf-sec-no">6</div>
                    <div className="bf-sec-body">
                        <h3 className="bf-sec-title">Terms</h3>
                        <dl className="bf-terms">
                            <div className="bf-term">
                                <dt>Price</dt>
                                <dd>
                                    ${spec.pricingUsd}
                                    <span className="bf-term-sub"> / mo</span>
                                </dd>
                            </div>
                            <div className="bf-term">
                                <dt>Trial</dt>
                                <dd>{spec.trialDays} days, free</dd>
                            </div>
                            <div className="bf-term">
                                <dt>Est. MRR</dt>
                                <dd>
                                    ${fmtK(spec.market.mrrLow)}–${fmtK(spec.market.mrrHigh)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </section>

                <p className="bf-footnote">
                    <span className="bf-fn-mark">†</span> Built with {spec.stack.join(", ")}.
                </p>
            </article>

            <div className="spin-ready">
                <div className="spin-bubble spin-ready-ask">
                    Ready to build <b>{spec.product}</b>? I'll register the domain, build v1 in test
                    mode, then deploy it.
                </div>
                <div className="spin-ready-ctrls">
                    <button
                        className="btn-scout"
                        type="button"
                        disabled={busy}
                        onClick={onBack}
                        style={{ marginRight: "auto" }}
                    >
                        ← Choose a different angle
                    </button>
                    <button
                        className="btn-approve spin-approve-big"
                        type="button"
                        disabled={busy}
                        onClick={onCreate}
                    >
                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
        <div className="bf-swatch">
            <span className="bf-sw-chip" style={{ background: hex }} />
            <span className="bf-sw-meta">
                <span className="bf-sw-l">{label}</span>
                <span className="bf-sw-hex">{hex.toUpperCase()}</span>
            </span>
        </div>
    );
}

// ---- creating: the cc-steps animation (unchanged behavior, prototype .cc-* classes) --------
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
        <div className="cc-wrap">
            <div className="cc-card">
                <div className="cc-spin">
                    <svg viewBox="0 0 50 50" aria-hidden="true">
                        <circle className="cc-track" cx="25" cy="25" r="20" />
                        <circle className="cc-arc" cx="25" cy="25" r="20" />
                    </svg>
                </div>
                <h2 className="cc-title">Creating {product}…</h2>
                <p className="cc-sub">Spinning up everything it needs to go live.</p>
                <ul className="cc-steps">
                    {CREATE_STEPS.map((s, i) => (
                        <li key={s} className={`cc-step${i < done ? " done" : ""}`}>
                            <span className="cc-tick" />
                            <span className="cc-lab">{s}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// ---- failed ---------------------------------------------------------------------------------
export function FailedView({ onRetry, busy }: { onRetry: () => void; busy: boolean }) {
    return (
        <AssistantTurn>
            <div className="spin-bubble">
                The scout hit a snag. Want me to try again?{" "}
                <button
                    type="button"
                    className="btn-scout"
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
