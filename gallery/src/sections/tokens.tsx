import { Badge } from "obp-ui";
import { Note, Row, Spec } from "../kit";

type Swatch = { token: string; cls: string; note: string };

const SURFACES: Swatch[] = [
    { token: "--background", cls: "bg-background", note: "the page" },
    { token: "--card / --popover", cls: "bg-card", note: "raised paper surfaces" },
    { token: "--secondary / --muted", cls: "bg-secondary", note: "rails, subtle fills" },
    { token: "--border", cls: "bg-border", note: "hairlines" },
    { token: "--border-soft", cls: "bg-border-soft", note: "quieter hairlines" },
    { token: "--faint", cls: "bg-faint", note: "lightest ink" },
    { token: "--muted-foreground", cls: "bg-muted-foreground", note: "soft ink" },
    { token: "--foreground", cls: "bg-foreground", note: "ink" },
];

const BRAND: Swatch[] = [
    { token: "--primary", cls: "bg-primary", note: "terracotta brand" },
    { token: "--primary-foreground", cls: "bg-primary-foreground", note: "ink on brand" },
    { token: "--accent", cls: "bg-accent", note: "soft hover surface" },
    { token: "--accent-foreground", cls: "bg-accent-foreground", note: "ink on accent" },
    { token: "--ring", cls: "bg-ring", note: "focus ring" },
];

type StatusRow = {
    token: string;
    meaning: string;
    solid: string;
    soft: string;
    dot: string;
    badge: "success" | "info" | "approval" | "neutral" | "warning" | "destructive";
};

const STATUS: StatusRow[] = [
    {
        token: "success",
        meaning: "shipped / done / live",
        solid: "bg-success text-success-foreground",
        soft: "bg-success-soft text-success",
        dot: "bg-success",
        badge: "success",
    },
    {
        token: "info",
        meaning: "building / running",
        solid: "bg-info text-info-foreground",
        soft: "bg-info-soft text-info",
        dot: "bg-info",
        badge: "info",
    },
    {
        token: "approval",
        meaning: "awaiting your approval",
        solid: "bg-approval text-approval-foreground",
        soft: "bg-approval-soft text-approval",
        dot: "bg-approval",
        badge: "approval",
    },
    {
        token: "neutral",
        meaning: "queued / todo / idle",
        solid: "bg-neutral text-neutral-foreground",
        soft: "bg-neutral-soft text-neutral",
        dot: "bg-neutral",
        badge: "neutral",
    },
    {
        token: "warning",
        meaning: "at-risk / caution / reject",
        solid: "bg-warning text-warning-foreground",
        soft: "bg-warning-soft text-warning",
        dot: "bg-warning",
        badge: "warning",
    },
    {
        token: "destructive",
        meaning: "blocked / killed / error",
        solid: "bg-destructive text-destructive-foreground",
        soft: "bg-destructive-soft text-destructive",
        dot: "bg-destructive",
        badge: "destructive",
    },
];

const RADII = [
    { cls: "rounded-sm", token: "--radius - 4px" },
    { cls: "rounded-md", token: "--radius - 2px" },
    { cls: "rounded-lg", token: "--radius (12px)" },
    { cls: "rounded-xl", token: "--radius-card (18px)" },
];

const TYPE_SCALE: [string, string][] = [
    ["text-sm", "--type-sm"],
    ["text-base", "--type-base"],
    ["text-lg", "--type-lg"],
    ["text-xl", "--type-xl"],
    ["text-2xl", "--type-2xl"],
    ["text-3xl", "--type-3xl"],
];

function SwatchGrid({ items }: { items: Swatch[] }) {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {items.map((s) => (
                <div key={s.token} className="min-w-0">
                    <div className={`h-14 rounded-lg border border-border ${s.cls}`} />
                    <div className="mt-2 truncate font-mono text-sm text-foreground">{s.token}</div>
                    <div className="truncate text-sm text-muted-foreground">{s.note}</div>
                </div>
            ))}
        </div>
    );
}

export function TokensSection() {
    return (
        <>
            <Spec name="Surfaces & ink" note="page, paper, rails, hairlines, three ink weights.">
                <SwatchGrid items={SURFACES} />
                <div className="mt-6 space-y-1">
                    <p className="text-base text-foreground">text-foreground - ink, body copy</p>
                    <p className="text-base text-muted-foreground">
                        text-muted-foreground - secondary prose
                    </p>
                    <p className="text-base text-faint">text-faint - captions, meta, timestamps</p>
                </div>
            </Spec>

            <Spec
                name="Brand"
                note="one terracotta accent, plus the soft hover surface it pairs with."
            >
                <SwatchGrid items={BRAND} />
            </Spec>

            <Spec
                name="Status language"
                note="six meanings, each with a solid, a -soft fill and a Badge variant. Don't improvise a seventh."
            >
                <div className="space-y-3">
                    {STATUS.map((s) => (
                        <div
                            key={s.token}
                            className="flex flex-wrap items-center gap-3 border-b border-border-soft pb-3 last:border-b-0 last:pb-0"
                        >
                            <span className="w-32 font-mono text-sm font-semibold">{s.token}</span>
                            <span className={`h-8 w-16 rounded-lg ${s.solid}`} />
                            <span
                                className={`rounded-full px-2.5 py-0.5 font-mono text-sm ${s.soft}`}
                            >
                                -soft
                            </span>
                            <span className={`size-2 rounded-full ${s.dot}`} />
                            <Badge variant={s.badge}>{s.token}</Badge>
                            <span className="text-sm text-muted-foreground">{s.meaning}</span>
                        </div>
                    ))}
                </div>
                <Note>
                    Brand emphasis (autopilot, "this is ours") uses the <code>accent</code> /{" "}
                    <code>default</code> Badge variants instead - see Primitives.
                </Note>
            </Spec>

            <Spec
                name="Radius & elevation"
                note="two radii and two shadows; nothing else is legal."
            >
                <Row className="gap-6">
                    {RADII.map((r) => (
                        <div key={r.cls} className="flex flex-col items-start gap-2">
                            <div className={`size-16 border border-border bg-secondary ${r.cls}`} />
                            <span className="font-mono text-sm text-faint">{r.cls}</span>
                            <span className="font-mono text-sm text-faint">{r.token}</span>
                        </div>
                    ))}
                </Row>
                <Row className="mt-6 gap-6">
                    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-e1">
                        <span className="font-mono text-sm">shadow-e1</span>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-6 py-5 shadow-e2">
                        <span className="font-mono text-sm">shadow-e2</span>
                    </div>
                </Row>
            </Spec>

            <Spec
                name="Type"
                note="four self-hosted families; text-sm is the floor - text-xs and arbitrary sizes are banned."
            >
                <div className="space-y-4">
                    <p className="font-display text-3xl font-light tracking-tight">
                        font-display - Space Grotesk, use font-light for headings
                    </p>
                    <p className="text-base">font-sans - Inter, body copy and UI</p>
                    <p className="font-serif text-lg italic text-muted-foreground">
                        font-serif - Spectral italic, the editorial voice
                    </p>
                    <p className="font-mono text-base">
                        font-mono - JetBrains Mono, ids and numbers
                    </p>
                </div>
                <div className="mt-6 space-y-1 border-t border-border-soft pt-4">
                    {TYPE_SCALE.map(([cls, token]) => (
                        <p key={cls} className={cls}>
                            <span className="font-mono text-faint">{cls}</span>{" "}
                            <span className="font-mono text-faint/70">{token}</span> - the quick
                            brown fox
                        </p>
                    ))}
                </div>
            </Spec>
        </>
    );
}
