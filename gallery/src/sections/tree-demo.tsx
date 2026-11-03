import { Database, FileText, Folder, Table2 } from "lucide-react";
import { SearchInput, Tree, type TreeNode, filterTree } from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

const FILES: TreeNode[] = [
    {
        id: "uploads",
        label: "Uploads",
        icon: <Folder />,
        meta: 3,
        children: [
            {
                id: "tickets.csv",
                label: "tickets.csv",
                icon: <FileText />,
                meta: 2,
                children: [
                    { id: "triage", label: "Ticket triage", icon: <Table2 /> },
                    { id: "routing", label: "Queue routing", icon: <Table2 /> },
                ],
            },
            { id: "intents.jsonl", label: "intents.jsonl", icon: <FileText />, meta: 0 },
            { id: "contracts.parquet", label: "contracts.parquet", icon: <FileText />, meta: 0 },
        ],
    },
    {
        id: "warehouse",
        label: "Warehouse",
        icon: <Database />,
        meta: 2,
        children: [
            { id: "orders", label: "public.orders", icon: <Table2 /> },
            { id: "refunds", label: "public.refunds", icon: <Table2 /> },
        ],
    },
    { id: "s3", label: "S3", icon: <Folder />, meta: 0 },
];

function matchesText(node: TreeNode, text: string): boolean {
    return String(node.label).toLowerCase().includes(text);
}

export function TreeDemo() {
    const [selected, setSelected] = useState<string | null>("tickets.csv");
    const [expanded, setExpanded] = useState<string[]>(["uploads", "tickets.csv"]);
    const [query, setQuery] = useState("");
    const text = query.trim().toLowerCase();
    const filtered = text ? filterTree(FILES, (node) => matchesText(node, text)) : null;
    return (
        <Spec
            name="Tree · filterTree · ancestorsOf"
            note="A WAI-ARIA tree for hierarchies: sources, folders, files. Flat rows with aria-level, a roving tab stop, and the keyboard model screen readers expect."
        >
            <div className="flex max-w-sm flex-col gap-2">
                <SearchInput
                    aria-label="Filter files"
                    placeholder="Filter"
                    value={query}
                    onValueChange={setQuery}
                />
                <div className="rounded-lg border">
                    <Tree
                        aria-label="Files"
                        nodes={filtered?.nodes ?? FILES}
                        selectedId={selected}
                        onSelect={setSelected}
                        expandedIds={filtered ? [...expanded, ...filtered.expandedIds] : expanded}
                        onExpandedChange={setExpanded}
                        empty={<p className="p-3 text-sm text-muted-foreground">No matches.</p>}
                    />
                </div>
            </div>
            <Note>
                selected: <span className="font-mono">{selected ?? "none"}</span>
            </Note>
            <Api
                items={[
                    {
                        name: "keyboard",
                        note: "Up and Down move, Right opens or steps into a node, Left closes or steps out to the parent, Home and End jump, Enter or Space selects, * opens every sibling, and typing jumps to the next name that starts with what was typed.",
                    },
                    {
                        name: "mouse",
                        note: "a click selects and opens; a click on the selected node or on its chevron toggles it.",
                    },
                    {
                        name: "nodes",
                        note: "{ id, label, textValue?, icon?, meta?, children? }. textValue feeds type-ahead when label is not a string; meta sits on the right, muted and tabular.",
                    },
                    {
                        name: "expandedIds, onExpandedChange",
                        note: "controlled open state; defaultExpandedIds for uncontrolled.",
                    },
                    {
                        name: "filterTree(nodes, matches)",
                        note: "keeps matches and their ancestors, and returns the ids to open so every match shows. A match keeps all its children.",
                    },
                    {
                        name: "ancestorsOf(nodes, id)",
                        note: "the ids above a node, to open before selecting it from a link.",
                    },
                ]}
            />
        </Spec>
    );
}
