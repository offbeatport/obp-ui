import type { ColumnDef } from "@tanstack/react-table";
import { Check, FileCode2, Hammer, Inbox, Plus, Rocket, TriangleAlert } from "lucide-react";
import {
    Badge,
    Button,
    DataGrid,
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
    markColorFor,
} from "obp-ui";
import { useState } from "react";
import { Api, Cell, Frame, Note, Row, Spec } from "../kit";

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

type Request = { id: string; route: string; region: string; status: number; latency: number };

const ROUTES = ["/v1/chat/completions", "/v1/models", "/api/keys", "/api/jobs", "/v1/embeddings"];
const REGIONS = ["eu-west", "us-east", "ap-south"];

const REQUESTS: Request[] = Array.from({ length: 5000 }, (_, index) => ({
    id: `req_${(index * 7919).toString(36).padStart(6, "0")}`,
    route: ROUTES[index % ROUTES.length] ?? "/",
    region: REGIONS[index % REGIONS.length] ?? "eu-west",
    status: index % 37 === 0 ? 503 : 200,
    latency: 40 + ((index * 53) % 900),
}));

const REQUEST_COLUMNS: ColumnDef<Request, unknown>[] = [
    {
        header: "Request",
        accessorKey: "id",
        enableHiding: false,
        cell: (info) => <span className="font-mono">{String(info.getValue())}</span>,
    },
    { header: "Route", accessorKey: "route" },
    { header: "Region", accessorKey: "region" },
    {
        header: "Status",
        accessorKey: "status",
        cell: (info) =>
            info.getValue() === 200 ? (
                <Badge variant="success">200</Badge>
            ) : (
                <Badge variant="destructive">{String(info.getValue())}</Badge>
            ),
    },
    {
        header: "Latency",
        accessorKey: "latency",
        cell: (info) => `${String(info.getValue())} ms`,
    },
];

export function DataDisplaySection() {
    const [open, setOpen] = useState<string | null>("invoices");
    const [picked, setPicked] = useState<string | null>("invoices");
    const [selectedRequests, setSelectedRequests] = useState<string[]>([]);

    return (
        <>
            <Spec
                name="DataGrid"
                note="TanStack Table with sorting, resizable columns, a sticky header and virtual rows. 5,000 rows here; only the visible ones are in the DOM."
            >
                <DataGrid
                    columns={REQUEST_COLUMNS}
                    rows={REQUESTS}
                    getRowId={(row) => row.id}
                    onOpen={() => undefined}
                    rowLabel={(row) => `${row.id} ${row.route}`}
                    maxHeight="360px"
                    storageKey="gallery.data-grid"
                    columnPicker
                    hiddenColumns={["region"]}
                    selectedIds={selectedRequests}
                    onSelectedIdsChange={setSelectedRequests}
                />
                <p className="text-sm text-muted-foreground tabular-nums">{`${selectedRequests.length} selected`}</p>
                <Api
                    items={[
                        {
                            name: "sortable, resizable",
                            note: "both on by default. Drag or arrow-key a header edge; double-click resets the column. Widths persist under storageKey.",
                        },
                        {
                            name: "columnPicker, hiddenColumns",
                            note: "a columns button at the end of the header row shows or hides any column whose enableHiding is not false, and switches density between comfortable and compact. hiddenColumns sets the defaults; choices persist under storageKey. Default to few enough columns that the grid fits; when people add more, it scrolls sideways, the button stays at the visible right edge and a column you add scrolls into view.",
                        },
                        {
                            name: "selectedIds, onSelectedIdsChange",
                            note: "adds a checkbox column and a select-all header over the rows shown. Selected rows take the selected fill; ids come from getRowId.",
                        },
                        {
                            name: "DataGridDetail",
                            note: "wraps secondary text in a cell, such as a description under a name; compact density hides it.",
                        },
                        {
                            name: "loading, loadingRows",
                            note: "keeps the real header and draws placeholder rows while data loads, so the page does not jump when it arrives.",
                        },
                        {
                            name: "maxHeight",
                            note: "scrolls inside the grid. Without it the header sticks to the page's scroller while the grid fits its width.",
                        },
                        {
                            name: "virtualize",
                            note: "on from 150 rows; rows are measured, so multi-line cells work.",
                        },
                        {
                            name: "onOpen, rowLabel",
                            note: "a click anywhere on the row opens it, except on buttons, links, menus and fields, or while text is selected. Rows are focusable: arrows, Home and End move, Enter opens. Keep a real link in the row for new-tab clicks; mark any other control data-grid-ignore.",
                        },
                    ]}
                />
            </Spec>
            <Spec
                name="GradientMark · markColorFor"
                note="One letter on a flat tile, its hue stepped from the name around --primary. No gradient: the name is kept for compatibility."
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
                            name: 'markColorFor("Ledgerly")',
                            note: "one of twelve 30deg hue steps around --primary, at the primary's own lightness so the label keeps --primary-foreground's contrast.",
                            value: markColorFor("Ledgerly"),
                        },
                        {
                            name: 'markColorFor("Harbourline")',
                            note: "a different seed, a different step - stable per seed, in any process.",
                            value: markColorFor("Harbourline"),
                        },
                    ]}
                />
                <Note>
                    No branding row yet? It falls back to the first letter and{" "}
                    <code>markColorFor(name)</code>, so a draft still gets a stable mark. In an
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
                note="Chevron opens a panel; parent keeps one open."
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
                note="Hairline spine, one dot per task."
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
