import { Database, FileText, Folder, Layers, Table2 } from "lucide-react";
import { SearchInput, Tree, type TreeNode, filterTree } from "obp-ui";
import { useMemo, useState } from "react";
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

type Entry = { id: string; name: string; parent: string; folder: boolean };

const ROOT = "datasets";

const ENTRIES: Entry[] = [
    { id: "support", name: "Support", parent: ROOT, folder: true },
    { id: "billing", name: "Billing", parent: "support", folder: true },
    { id: "archive", name: "Archive", parent: ROOT, folder: true },
    { id: "triage", name: "Ticket triage", parent: "support", folder: false },
    { id: "refunds", name: "Refund reasons", parent: "billing", folder: false },
    { id: "routing", name: "Queue routing", parent: ROOT, folder: false },
    { id: "intents", name: "Travel intents", parent: ROOT, folder: false },
];

function branch(entries: Entry[], parent: string): TreeNode[] {
    return entries
        .filter((entry) => entry.parent === parent)
        .sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name))
        .map((entry) =>
            entry.folder
                ? {
                      id: entry.id,
                      label: entry.name,
                      icon: <Folder />,
                      draggable: true,
                      droppable: true,
                      children: branch(entries, entry.id),
                  }
                : { id: entry.id, label: entry.name, icon: <Table2 />, draggable: true },
        );
}

function MovableTreeDemo() {
    const [entries, setEntries] = useState(ENTRIES);
    const [selected, setSelected] = useState<string | null>("triage");
    const [expanded, setExpanded] = useState<string[]>([ROOT, "support", "billing"]);
    const [moved, setMoved] = useState("nothing yet");
    const nodes = useMemo<TreeNode[]>(
        () => [
            {
                id: ROOT,
                label: "Datasets",
                icon: <Layers />,
                meta: entries.filter((entry) => !entry.folder).length,
                droppable: true,
                children: branch(entries, ROOT),
            },
        ],
        [entries],
    );
    const nameOf = (id: string) =>
        id === ROOT ? "Datasets" : (entries.find((entry) => entry.id === id)?.name ?? id);
    const move = (id: string, target: string) => {
        setEntries((current) =>
            current.map((entry) => (entry.id === id ? { ...entry, parent: target } : entry)),
        );
        setMoved(`${nameOf(id)} into ${nameOf(target)}`);
    };
    return (
        <Spec
            name="Tree drag and drop · onMove · canDrop"
            note="Drag rows onto folders. Nodes opt in with draggable and droppable; the tree refuses a drop into the node itself, below it, or where it already is."
        >
            <div className="max-w-sm rounded-lg border">
                <Tree
                    aria-label="Datasets"
                    nodes={nodes}
                    selectedId={selected}
                    onSelect={setSelected}
                    expandedIds={expanded}
                    onExpandedChange={setExpanded}
                    onMove={move}
                    canDrop={(node, target) => !(node.id === "intents" && target.id === "archive")}
                />
            </div>
            <Note>
                last move: <span className="font-mono">{moved}</span>
            </Note>
            <Api
                items={[
                    {
                        name: "draggable, droppable",
                        note: "per node. A drop on a row that is not droppable lands in its nearest droppable ancestor, so dropping on a dataset files the dragged row beside it.",
                    },
                    {
                        name: "onMove(id, targetId)",
                        note: "called once per drop with the dragged node and the folder it lands in; the tree opens the target. Keep the data and the order yourself.",
                    },
                    {
                        name: "canDrop(node, target)",
                        note: "extra rules on top of the built-in ones; here Travel intents may not go into Archive.",
                    },
                    {
                        name: "pointer",
                        note: "a mouse drag starts after 4px, touch after a 250ms press. The target row gets a 1px primary outline, the lifted row fades, and a collapsed folder held under the pointer opens after 700ms.",
                    },
                    {
                        name: "keyboard",
                        note: "drag is pointer-only: give every movable row a Move to… command (a dialog with a folder picker) so the keyboard model above stays intact.",
                    },
                ]}
            />
        </Spec>
    );
}

function matchesText(node: TreeNode, text: string): boolean {
    return String(node.label).toLowerCase().includes(text);
}

export function TreeDemo() {
    return (
        <>
            <FilterTreeDemo />
            <MovableTreeDemo />
        </>
    );
}

function FilterTreeDemo() {
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
