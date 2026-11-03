import { X } from "lucide-react";
import {
    Badge,
    Button,
    type CompareColumn,
    CompareMarker,
    type CompareSection,
    CompareTable,
    Label,
    Switch,
} from "obp-ui";
import { type ReactNode, useState } from "react";
import { Api, Note, Spec } from "../kit";

type Plan = {
    id: string;
    name: string;
    family: string;
    vcpus: number;
    memory: number;
    disk: number;
    region: string;
    gpu: string;
    price: number;
};

const PLANS: Plan[] = [
    {
        id: "s2",
        name: "Standard 2",
        family: "General purpose",
        vcpus: 2,
        memory: 8,
        disk: 80,
        region: "eu-west, us-east",
        gpu: "None",
        price: 24,
    },
    {
        id: "s4",
        name: "Standard 4",
        family: "General purpose",
        vcpus: 4,
        memory: 16,
        disk: 160,
        region: "eu-west, us-east",
        gpu: "None",
        price: 48,
    },
    {
        id: "m8",
        name: "Memory 8",
        family: "Memory optimised",
        vcpus: 8,
        memory: 64,
        disk: 160,
        region: "eu-west, us-east",
        gpu: "None",
        price: 112,
    },
    {
        id: "c8",
        name: "Compute 8",
        family: "Compute optimised",
        vcpus: 8,
        memory: 16,
        disk: 160,
        region: "eu-west",
        gpu: "None",
        price: 96,
    },
    {
        id: "g1",
        name: "GPU 1",
        family: "Accelerated",
        vcpus: 8,
        memory: 32,
        disk: 320,
        region: "us-east",
        gpu: "1 × L4, 24 GB",
        price: 410,
    },
];

type Attribute = {
    id: string;
    label: string;
    value: (plan: Plan) => string;
    best?: (plan: Plan) => number;
    bestLabel?: string;
};

const SECTIONS: { id: string; title: string; attributes: Attribute[] }[] = [
    {
        id: "compute",
        title: "Compute",
        attributes: [
            { id: "family", label: "Family", value: (plan) => plan.family },
            { id: "vcpus", label: "vCPUs", value: (plan) => String(plan.vcpus) },
            { id: "gpu", label: "GPU", value: (plan) => plan.gpu },
        ],
    },
    {
        id: "storage",
        title: "Memory and storage",
        attributes: [
            { id: "memory", label: "Memory", value: (plan) => `${plan.memory} GB` },
            { id: "disk", label: "Disk", value: (plan) => `${plan.disk} GB NVMe` },
            { id: "backups", label: "Backups", value: () => "Daily, kept 7 days" },
        ],
    },
    {
        id: "pricing",
        title: "Pricing and availability",
        attributes: [
            {
                id: "price",
                label: "Monthly price",
                value: (plan) => `$${plan.price}`,
                best: (plan) => plan.price,
                bestLabel: "Lowest",
            },
            { id: "region", label: "Regions", value: (plan) => plan.region },
            { id: "billing", label: "Billing", value: () => "Hourly, capped monthly" },
        ],
    },
];

function cell(attribute: Attribute, plan: Plan, plans: Plan[]): ReactNode {
    const text = attribute.value(plan);
    if (!attribute.best) {
        return text;
    }
    const scores = plans.map(attribute.best);
    const lowest = Math.min(...scores);
    const winner = new Set(scores).size > 1 && attribute.best(plan) === lowest;
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {text}
            {winner && <Badge variant="accent">{attribute.bestLabel}</Badge>}
        </span>
    );
}

export function CompareDemo() {
    const [ids, setIds] = useState(PLANS.map((plan) => plan.id));
    const [only, setOnly] = useState(false);
    const plans = ids.flatMap((id) => PLANS.filter((plan) => plan.id === id));
    const columns: CompareColumn[] = plans.map((plan) => ({
        id: plan.id,
        label: plan.name,
        header: (
            <div className="flex items-start gap-2">
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold text-foreground">{plan.name}</span>
                    <span className="truncate text-muted-foreground">{plan.family}</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${plan.name}`}
                    onClick={() => setIds(ids.filter((id) => id !== plan.id))}
                >
                    <X />
                </Button>
            </div>
        ),
    }));
    const all = SECTIONS.map((section) => ({
        id: section.id,
        title: section.title,
        rows: section.attributes.map((attribute) => ({
            id: attribute.id,
            label: attribute.label,
            differs: new Set(plans.map(attribute.value)).size > 1,
            cells: plans.map((plan) => cell(attribute, plan, plans)),
        })),
    }));
    const rows = all.flatMap((section) => section.rows);
    const differing = rows.filter((row) => row.differs).length;
    const sections: CompareSection[] = only
        ? all.map((section) => ({ ...section, rows: section.rows.filter((row) => row.differs) }))
        : all;
    return (
        <Spec
            name="CompareTable · CompareMarker"
            note="Things side by side, one column each. The header sticks to the page's scroller, the attribute column stays pinned while the columns scroll sideways, rows that differ carry a primary edge and a light tint, and a column header drags to a new place."
        >
            <CompareTable
                label="Compare plans"
                columns={columns}
                sections={sections}
                stickyTop="61px"
                className="[--compare-surface:var(--card)]"
                onReorder={setIds}
                corner={
                    <div className="flex flex-col gap-1">
                        <Label className="flex items-center gap-2 font-normal">
                            <Switch checked={only} onCheckedChange={setOnly} size="sm" />
                            Only differences
                        </Label>
                        <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                            <CompareMarker />
                            {`${differing} of ${rows.length} differ`}
                        </span>
                    </div>
                }
            />
            <Note>
                {ids.length < PLANS.length ? (
                    <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => setIds(PLANS.map((plan) => plan.id))}
                    >
                        Restore every plan
                    </Button>
                ) : (
                    "Drag a plan's header to reorder, or narrow the window and drag towards an edge to scroll."
                )}
            </Note>
            <Api
                items={[
                    {
                        name: "columns, sections",
                        note: "a column is { id, header }; a section is { id, title?, rows } and a row is { id, label, cells, differs? }, with one cell per column in column order. Sections with no rows are left out, so filtering to differences is a filter on rows.",
                    },
                    {
                        name: "corner",
                        note: "the top-left cell, above the attribute labels. It sticks with the header, so it is the place for the differences switch and its count.",
                    },
                    {
                        name: "labelWidth, columnWidth",
                        note: "CSS lengths. The label column defaults to clamp(7.5rem, 28cqi, 11rem) of the table's own width; columns share the rest and never go below columnWidth (13rem), so more columns scroll sideways.",
                    },
                    {
                        name: "stickyTop",
                        note: "where the header stops, below any sticky bar of your own. Defaults to 0px.",
                    },
                    {
                        name: "--compare-surface",
                        note: "the fill behind the header and the pinned column, so scrolled cells never show through. Defaults to --background; set it to var(--card) on a card.",
                    },
                    {
                        name: "differs, differsLabel, CompareMarker",
                        note: "a differing row gets a 2px --primary edge on its label, a light --primary tint across the row and foreground text; matching rows stay muted. Screen readers hear differsLabel after the label. Use CompareMarker beside a count as the legend. Mark an objectively best value in a cell with a Badge; never rank the columns.",
                    },
                    {
                        name: "onReorder, column.label",
                        note: "opt-in drag to reorder: a header drags with the mouse, or with touch after a short press so the page still scrolls; a 2px --primary line shows where it lands, and dragging near an edge scrolls the columns. The grip at the top of each header takes the keyboard: Space lifts, arrows move, Space drops, Escape cancels, and a live region announces each move by column.label. Called with the new id order.",
                    },
                ]}
            />
        </Spec>
    );
}
