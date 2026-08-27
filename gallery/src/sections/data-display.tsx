import { Check, FileCode2, Hammer, Inbox, Plus, Rocket, TriangleAlert } from "lucide-react";
import {
    Button,
    EmptyState,
    ExpandableRow,
    ExpandableRowList,
    GradientMark,
    type GradientMarkBranding,
    TaskCard,
    TaskStateChip,
    Timeline,
    TimelineDot,
    TimelineItem,
    gradientPairFor,
} from "obp-ui";
import { useState } from "react";
import { Api, Cell, Frame, Note, Row, Spec } from "../kit";

// Lists of things that happened, the list that is empty, and the mark at the head of a row.
// Chrome only: every label, colour and piece of copy below is a prop.

const ENTITIES: { name: string; branding?: GradientMarkBranding }[] = [
    { name: "Ledgerly" },
    { name: "Postmark Studio" },
    { name: "Quietbill" },
    { name: "Harbourline" },
    { name: "Nudge" },
];

const OPPORTUNITIES = [
    {
        id: "invoices",
        title: "Invoice chasing for freelancers",
        score: "8.4",
        thesis: "Freelancers lose three weeks a year chasing late invoices, and every tool for it is built for finance teams.",
    },
    {
        id: "handover",
        title: "Client handover packets",
        score: "7.1",
        thesis: "Agencies rebuild the same handover doc for every project; nobody sells the packet itself.",
    },
    {
        id: "standup",
        title: "Async standup digests",
        score: "5.9",
        thesis: "Crowded. Six funded incumbents and no wedge that a small team can hold.",
    },
];

const TASKS = [
    {
        n: 1,
        title: "Scaffold the repo",
        chip: "shipped",
        accent: "var(--success)",
        icon: Check,
        sub: "TanStack Start + SQLite, deployed to a preview URL.",
        meta: "4h ago · 1 attempt · $0.31",
    },
    {
        n: 2,
        title: "Landing page + waitlist",
        chip: "shipped",
        accent: "var(--success)",
        icon: Check,
        sub: "Copy from the spec, one CTA, email capture wired.",
        meta: "3h ago · 2 attempts · $0.68",
    },
    {
        n: 3,
        title: "Stripe checkout",
        chip: "needs you",
        accent: "var(--warning)",
        icon: TriangleAlert,
        gated: true,
        sub: "The agent needs a live Stripe key before it can finish the slice.",
        meta: "in flight · 1 attempt · $0.44",
    },
    {
        n: 4,
        title: "Invoice reminder cron",
        chip: "queued",
        accent: "var(--neutral)",
        icon: Hammer,
        sub: "Blocked on slice 3.",
        meta: "queued",
    },
];

export function DataDisplaySection() {
    const [open, setOpen] = useState<string | null>("invoices");
    const [picked, setPicked] = useState<string | null>("invoices");

    return (
        <>
            <Spec
                name="GradientMark · gradientPairFor"
                note="the avatar at the head of a row: one letter on a gradient derived from the name and the live --primary. Flip the theme (or a preset) and every mark follows."
            >
                <Row className="gap-6">
                    {ENTITIES.map((e) => (
                        <Cell key={e.name} label={e.name}>
                            <GradientMark name={e.name} branding={e.branding} size={44} />
                        </Cell>
                    ))}
                </Row>
                <Row className="mt-6 gap-6">
                    <Cell label="size={24}">
                        <GradientMark name="Ledgerly" size={24} />
                    </Cell>
                    <Cell label="size={32} (rail default)">
                        <GradientMark name="Ledgerly" size={32} />
                    </Cell>
                    <Cell label="size={56} radius={28}">
                        <GradientMark name="Ledgerly" size={56} radius={28} />
                    </Cell>
                    <Cell label="branding.palette (opt out)">
                        <GradientMark
                            name="Quietbill"
                            branding={{
                                mark: "QB",
                                palette: ["var(--info)", "var(--success)"],
                            }}
                            size={56}
                            radius={28}
                        />
                    </Cell>
                </Row>
                <Api
                    items={[
                        {
                            name: 'gradientPairFor("Ledgerly")',
                            note: "one of twelve 30deg hue steps around --primary; the stops straddle its lightness by ±0.07.",
                            value: gradientPairFor("Ledgerly")[0],
                        },
                        {
                            name: 'gradientPairFor("Harbourline")',
                            note: "a different seed, a different step - stable per seed, in any process.",
                            value: gradientPairFor("Harbourline")[0],
                        },
                    ]}
                />
                <Note>
                    No branding row yet? It falls back to the first letter and{" "}
                    <code>gradientPairFor(name)</code>, so a draft still gets a stable mark. In an
                    achromatic palette (Graphite) there is no hue to rotate and every mark draws the
                    same tile - that palette's whole point, and the letter still separates them.
                </Note>
            </Spec>

            <Spec
                name="EmptyState"
                note='three framings of "nothing here yet": the rail CTA, the page panel, and the tab-sized plate.'
            >
                <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                        <p className="mb-2 font-mono text-sm text-faint">
                            variant="rail" (in a 264px rail)
                        </p>
                        <Frame className="w-[264px] bg-secondary py-2">
                            <EmptyState
                                variant="rail"
                                title="No companies yet"
                                action={
                                    <Button size="sm" variant="outline" className="mt-4 w-full">
                                        <Plus /> New company
                                    </Button>
                                }
                            >
                                Start with a thought. The agent turns it into a scoped company.
                            </EmptyState>
                        </Frame>
                    </div>
                    <div>
                        <p className="mb-2 font-mono text-sm text-faint">variant="panel"</p>
                        <EmptyState
                            variant="panel"
                            icon={Inbox}
                            title="Your portfolio is empty"
                            action={
                                <Button className="mt-4">
                                    <Plus /> New company
                                </Button>
                            }
                        >
                            Everything you start shows up here with its burn, its state and what it
                            needs from you.
                        </EmptyState>
                    </div>
                </div>
                <div className="mt-6">
                    <p className="mb-2 font-mono text-sm text-faint">
                        variant="plate" (fills a tab)
                    </p>
                    <EmptyState variant="plate" icon={FileCode2} title="No source yet">
                        the agent writes into ~/companies/ledgerly
                    </EmptyState>
                </div>
            </Spec>

            <Spec
                name="ExpandableRowList · ExpandableRow"
                note="a framed list of rows; the chevron opens a panel, the row body picks. The parent keeps one open."
                bare
            >
                <ExpandableRowList>
                    {OPPORTUNITIES.map((o) => (
                        <ExpandableRow
                            key={o.id}
                            dataRow={o.id}
                            open={open === o.id}
                            onToggle={() => setOpen(open === o.id ? null : o.id)}
                            selected={picked === o.id}
                            onSelect={() => setPicked(o.id)}
                            title="Pick this opportunity"
                            toggleLabel="Show the score breakdown"
                            panel={
                                <>
                                    <p className="text-sm leading-relaxed text-muted-foreground">
                                        {o.thesis}
                                    </p>
                                    <Row>
                                        <TaskStateChip color="var(--info)">specced</TaskStateChip>
                                        <TaskStateChip color="var(--approval)">
                                            score {o.score}
                                        </TaskStateChip>
                                    </Row>
                                </>
                            }
                        >
                            <span className="font-mono text-sm font-bold text-primary">
                                {o.score}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                                {o.title}
                            </span>
                            {picked === o.id && (
                                <span className="font-mono text-sm text-faint">picked</span>
                            )}
                        </ExpandableRow>
                    ))}
                </ExpandableRowList>
                <Note>
                    open: <span className="font-mono">{open ?? "none"}</span> · picked:{" "}
                    <span className="font-mono">{picked ?? "none"}</span>
                </Note>
            </Spec>

            <Spec
                name="Timeline · TimelineItem · TimelineDot · TaskCard · TaskStateChip"
                note="the build log: one hairline spine, one state-coloured dot per task, the card body next to it."
            >
                <Timeline>
                    {TASKS.map((t) => (
                        <TimelineItem
                            key={t.n}
                            dot={
                                <TimelineDot
                                    color={t.accent}
                                    icon={t.icon}
                                    pulse={t.chip === "needs you"}
                                />
                            }
                        >
                            <TaskCard
                                n={t.n}
                                title={t.title}
                                chip={t.chip}
                                accent={t.accent}
                                gated={t.gated}
                                sub={t.sub}
                                meta={<span>{t.meta}</span>}
                                actions={
                                    t.gated ? (
                                        <>
                                            <Button size="sm" variant="success">
                                                <Check /> Approve
                                            </Button>
                                            <Button size="sm" variant="outline">
                                                Ask for changes
                                            </Button>
                                        </>
                                    ) : undefined
                                }
                            />
                        </TimelineItem>
                    ))}
                </Timeline>
                <Row className="mt-6">
                    <TimelineDot color="var(--primary)" icon={Rocket} />
                    <span className="font-mono text-sm text-faint">
                        a dot on its own · spine={"{false}"} drops the hairline for a one-item list
                    </span>
                </Row>
            </Spec>
        </>
    );
}
