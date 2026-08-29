import { Badge, GradientMark, Label, consoleTabPref, createDomClassPref } from "obp-ui";
import {
    type ConsoleDigest,
    ConsoleDock,
    type ConsoleDockPane,
    ConsolePane,
    ConsoleTabToggle,
    type LogKind,
    LogLine,
    type LogLineData,
    LogView,
    NEAR_BOTTOM_PX,
    STATUS_VARIANT,
    ago,
    hms,
    localeTime,
} from "obp-ui/console";
import { Api, Cell, Frame, Note, Row, Spec } from "../kit";

const KINDS: LogKind[] = ["act", "ok", "warn", "info", "msg", "error"];

const now = Date.now();

const SAMPLE: LogLineData[] = [
    { t: now - 42_000, msg: "run started · slice 3 · checkout", kind: "act" },
    { t: now - 36_000, msg: "read src/routes/checkout.tsx", kind: "msg" },
    { t: now - 22_000, msg: "stripe key missing in env", kind: "warn" },
    { t: now - 12_000, msg: "asked the founder for a live key", kind: "info" },
    { t: now - 4_000, msg: "slice 2 shipped · preview healthy", kind: "ok" },
];

const PANES: { slug: string; name: string; chip: string; chipClass: string }[] = [
    { slug: "ledgerly", name: "Ledgerly", chip: "building", chipClass: "text-info bg-info-soft" },
    {
        slug: "quietbill",
        name: "Quietbill",
        chip: "idle",
        chipClass: "text-neutral bg-neutral-soft",
    },
];

const SCRIPT: Record<string, { msg: string; kind: LogKind }[]> = {
    ledgerly: [
        { msg: "run started · slice 3", kind: "act" },
        { msg: "npm install stripe", kind: "msg" },
        { msg: "wrote src/routes/checkout.tsx", kind: "msg" },
        { msg: "typecheck clean", kind: "ok" },
        { msg: "stripe key missing - needs you", kind: "warn" },
    ],
    quietbill: [
        { msg: "nothing queued", kind: "info" },
        { msg: "last run 3h ago · $0.12", kind: "msg" },
    ],
};

async function fetchDigest(cursors: Record<string, number>): Promise<ConsoleDigest> {
    let pending = false;
    const panes: ConsoleDockPane[] = PANES.map((p) => {
        const all = SCRIPT[p.slug];
        const from = cursors[p.slug] ?? 0;
        const to = Math.min(all.length, from + 2);
        if (to < all.length) pending = true;
        return {
            slug: p.slug,
            name: p.name,
            active: p.slug === "ledgerly" && to < all.length,
            cursor: to,
            lines: all.slice(from, to).map((l, i) => ({ ...l, t: Date.now(), off: from + i })),
        };
    });
    return { panes, anyActive: pending };
}

const tabPref = createDomClassPref({
    storageKey: consoleTabPref().key,
    className: consoleTabPref().className,
});

export function ConsoleSection() {
    return (
        <>
            <Spec name="ConsoleDock" note="Ctrl+` toggles, Esc closes, drag to resize." bare>
                <ConsoleDock
                    fetchDigest={fetchDigest}
                    renderLogo={(p) => <GradientMark name={p.name} size={20} />}
                    paneStatus={(p) => {
                        const meta = PANES.find((x) => x.slug === p.slug);
                        return meta ? { label: meta.chip, className: meta.chipClass } : undefined;
                    }}
                    activeLabel="● working…"
                />
                <Note>
                    It polls one digest function - 0.75s while any run is active, 4s idle - with a
                    per-pane cursor, so steady-state polls carry only new lines. Nothing is fetched
                    until it opens.
                </Note>
            </Spec>

            <Spec name="ConsolePane" note="One agent: identity, state, tailing log." bare>
                <Frame className="h-64 max-w-lg">
                    <ConsolePane
                        title="Ledgerly"
                        logo={<GradientMark name="Ledgerly" size={20} />}
                        status={{ label: "building", className: "text-info bg-info-soft" }}
                        lines={SAMPLE}
                        active
                    />
                </Frame>
            </Spec>

            <Spec
                name="LogLine · LogView"
                note='two chromes: "console" gives the clock its own column, "run" colours the whole row and ships as a Card.'
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                        <p className="mb-2 font-mono text-sm text-faint">variant="console"</p>
                        <div className="rounded-lg border border-border bg-card p-3 font-mono">
                            {KINDS.map((kind) => (
                                <LogLine
                                    key={kind}
                                    line={{ t: now, msg: `kind="${kind}"`, kind }}
                                />
                            ))}
                            <LogLine line={{ msg: "no kind, no clock" }} />
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 font-mono text-sm text-faint">variant="run"</p>
                        <LogView
                            variant="run"
                            lines={SAMPLE}
                            className="h-44"
                            empty={<span className="text-faint">waiting for output…</span>}
                            footer={<span className="text-faint">— end of run —</span>}
                        />
                    </div>
                </div>
            </Spec>

            <Spec name="ConsoleTabToggle" note="Hides the launcher tab; an <html> class.">
                <Row className="gap-3">
                    <ConsoleTabToggle pref={tabPref} />
                    <Label>Show the agent console button</Label>
                </Row>
            </Spec>

            <Spec name="STATUS_VARIANT" note="Status → Badge variant.">
                <Row>
                    {Object.entries(STATUS_VARIANT).map(([status, variant]) => (
                        <Cell key={status} label={status}>
                            <Badge variant={variant}>{variant}</Badge>
                        </Cell>
                    ))}
                </Row>
            </Spec>

            <Spec name="Clocks & scrolling" note="Time formats and the tail hook." bare>
                <Api
                    items={[
                        {
                            name: "hms(t)",
                            note: "24h wall clock - the console's timestamp column.",
                            value: hms(now),
                        },
                        {
                            name: "localeTime(t)",
                            note: "the viewer's locale clock - the run tail.",
                            value: localeTime(now),
                        },
                        {
                            name: "ago(t)",
                            note: "compact relative time for run rows.",
                            value: ago(now - 5_400_000),
                        },
                        {
                            name: "useNearBottomScroll(dep)",
                            note: "returns the scroll-container ref; follows the tail only while the reader is already near the bottom (ConsolePane uses it).",
                        },
                        {
                            name: "NEAR_BOTTOM_PX",
                            note: "px from the bottom that still counts as near - about two log lines.",
                            value: String(NEAR_BOTTOM_PX),
                        },
                    ]}
                />
            </Spec>
        </>
    );
}
