import {
    ActivityRow,
    LiveDot,
    PulsePill,
    type Signal,
    SignalBars,
    StatTile,
    StatusDot,
    StatusPill,
    TONE,
    TONE_VAR,
    type Tone,
} from "@paperkit/ui";
import { Api, Cell, Note, Row, Spec } from "../kit";

// The atoms that express state. Every colour decision is the caller's: these ship the shape,
// the app supplies the tone - which is why the demos below pass token classes and CSS vars.

const DOT_SIZES = ["xs", "sm", "md", "lg", "xl"] as const;

const TONES: Tone[] = ["green", "blue", "violet", "slate", "amber", "red"];

const PILLS: { tone: Tone; label: string }[] = [
    { tone: "green", label: "live" },
    { tone: "blue", label: "building" },
    { tone: "violet", label: "needs you" },
    { tone: "slate", label: "idle" },
];

const SIGNALS: Signal[] = [
    { label: "pain", val: 8.4 },
    { label: "reach", val: 6.1 },
    { label: "moat", val: 4.7 },
];

export function StatusSection() {
    return (
        <>
            <Spec
                name="StatusDot"
                note="the smallest atom: five fixed sizes, plus a ring, a glow, a blink, a pulse or a halo."
            >
                <Row className="gap-6">
                    {DOT_SIZES.map((size) => (
                        <Cell key={size} label={size}>
                            <StatusDot size={size} colorClassName="bg-success" />
                        </Cell>
                    ))}
                </Row>
                <Row className="mt-6 gap-6">
                    <Cell label="ring">
                        <StatusDot size="lg" colorClassName="bg-info" ring="var(--info-soft)" />
                    </Cell>
                    <Cell label="glow">
                        <StatusDot
                            size="lg"
                            colorClassName="bg-success"
                            glow="0 0 10px var(--success)"
                        />
                    </Cell>
                    <Cell label="blink">
                        <StatusDot size="lg" colorClassName="bg-warning" blink />
                    </Cell>
                    <Cell label="pulse">
                        <StatusDot size="lg" colorClassName="bg-approval" pulse />
                    </Cell>
                    <Cell label="halo">
                        <StatusDot
                            size="lg"
                            colorClassName="bg-destructive"
                            halo="var(--destructive)"
                        />
                    </Cell>
                    <Cell label="color (runtime)">
                        <StatusDot size="lg" color="var(--primary)" />
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="StatusPill"
                note='two looks: "bare" is a dot + caption lockup, "soft" is a tinted capsule whose dot inherits the text colour.'
            >
                <Row className="gap-6">
                    {PILLS.map((p) => (
                        <StatusPill
                            key={p.tone}
                            variant="bare"
                            dotClassName={TONE[p.tone].solid}
                            ring={`color-mix(in srgb, ${TONE_VAR[p.tone]} 25%, transparent)`}
                        >
                            {p.label}
                        </StatusPill>
                    ))}
                </Row>
                <Row className="mt-5 gap-3">
                    {PILLS.map((p) => (
                        <StatusPill
                            key={p.tone}
                            variant="soft"
                            className={`${TONE[p.tone].text} ${TONE[p.tone].soft}`}
                        >
                            {p.label}
                        </StatusPill>
                    ))}
                    <StatusPill
                        variant="soft"
                        hideDot
                        className="bg-secondary text-muted-foreground"
                    >
                        hideDot
                    </StatusPill>
                </Row>
            </Spec>

            <Spec
                name="LiveDot"
                note='the "something is happening" indicator - a sonar ping or a slow blink.'
            >
                <Row className="gap-8">
                    <Cell label='variant="ping"'>
                        <LiveDot />
                    </Cell>
                    <Cell label='variant="blink"'>
                        <LiveDot variant="blink" />
                    </Cell>
                    <Cell label="with a label (lockup)">
                        <LiveDot label="live activity" />
                    </Cell>
                    <Cell label="blink + label">
                        <LiveDot variant="blink" label="live activity" />
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="PulsePill"
                note='the "needs you" capsule; its leading pip fires a ring pulse.'
            >
                <Row>
                    <PulsePill>2 need you</PulsePill>
                    <PulsePill>approve deploy</PulsePill>
                </Row>
            </Spec>

            <Spec
                name="SignalBars"
                note="a labelled micro bar-chart; width is a runtime %, so the fill colour is a prop."
            >
                <Row className="gap-10">
                    <Cell label="default (max 10)">
                        <SignalBars signals={SIGNALS} color="var(--primary)" className="w-56" />
                    </Cell>
                    <Cell label="max={5}, four columns">
                        <SignalBars
                            signals={[...SIGNALS, { label: "speed", val: 3.2 }]}
                            color="var(--info)"
                            max={5}
                            className="w-64 grid-cols-4"
                        />
                    </Cell>
                </Row>
            </Spec>

            <Spec
                name="StatTile"
                note='number over label in three framings: "metric" (bordered), "cell" (compact, canvas HUD) and "bare".'
            >
                <Row className="gap-6">
                    <Cell label='variant="metric"'>
                        <StatTile value="$1.2k" label="MRR" sub="+18% this week" />
                    </Cell>
                    <Cell label='variant="cell"'>
                        <StatTile variant="cell" value="7" label="companies" />
                    </Cell>
                    <Cell label='variant="cell" alert'>
                        <StatTile variant="cell" value="2" label="need you" alert />
                    </Cell>
                    <Cell label='variant="bare"'>
                        <StatTile variant="bare" value="41" label="slices shipped" />
                    </Cell>
                </Row>
                <Note>
                    The "cell" frame is drawn for the forced-dark canvas HUD, which is why it looks
                    almost frameless on paper.
                </Note>
            </Spec>

            <Spec
                name="ActivityRow"
                note="one line of a live feed: a fixed-width tone tag, ellipsised prose, a timestamp."
            >
                <div className="max-w-lg space-y-1.5">
                    <ActivityRow
                        tag="BUILD"
                        tagClassName="text-info bg-info-soft"
                        text="slice 4 · checkout wired to Stripe test keys"
                        ago="2m"
                    />
                    <ActivityRow
                        tag="GROW"
                        tagClassName="text-approval bg-approval-soft"
                        text="posted the launch thread; 41 clicks so far"
                        ago="18m"
                    />
                    <ActivityRow
                        tag="RUN"
                        tagClassName="text-success bg-success-soft"
                        leading={<StatusDot size="xs" colorClassName="bg-success" />}
                        text="deploy v12 is healthy - a very long line that has to ellipsise rather than widen its card"
                        ago="1h"
                    />
                    <ActivityRow text="untagged line - no chip, no leading dot" ago="3h" />
                </div>
            </Spec>

            <Spec
                name="TONE · TONE_VAR"
                note="tone → the semantic token family. One place owns the translation."
            >
                <div className="space-y-2">
                    {TONES.map((t) => (
                        <div key={t} className="flex flex-wrap items-center gap-3">
                            <span className="w-16 font-mono text-sm">{t}</span>
                            <span className={`w-24 font-mono text-sm ${TONE[t].text}`}>text</span>
                            <span className={`size-5 rounded-full ${TONE[t].solid}`} />
                            <span
                                className={`rounded-md px-2 py-0.5 font-mono text-sm ${TONE[t].soft}`}
                            >
                                soft
                            </span>
                            <span
                                className={`border-l-4 pl-2 font-mono text-sm text-muted-foreground ${TONE[t].borderL}`}
                            >
                                borderL
                            </span>
                            <span className="font-mono text-sm text-faint">{TONE_VAR[t]}</span>
                        </div>
                    ))}
                </div>
                <Api
                    items={[
                        {
                            name: "Tone",
                            note: "the six-value union: green | blue | violet | slate | amber | red.",
                        },
                        {
                            name: "ToneClasses",
                            note: "the { text, solid, soft, borderL } record each tone maps to.",
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
