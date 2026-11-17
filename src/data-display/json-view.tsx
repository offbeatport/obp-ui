"use client";

import { IconChevronRight } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../primitives/button";

const INK = {
    key: "text-syntax-property",
    string: "text-syntax-string",
    number: "text-syntax-number",
    literal: "text-syntax-keyword",
    punctuation: "text-syntax-punctuation",
    note: "text-muted-foreground",
};

const INDENT_CH = 2;

type Entry = [string | null, unknown];

function isBranch(value: unknown): value is object {
    return value !== null && typeof value === "object";
}

function entriesOf(value: object): Entry[] {
    return Array.isArray(value)
        ? value.map((item): Entry => [null, item])
        : Object.entries(value as Record<string, unknown>);
}

function sizeText(value: object): string {
    const size = entriesOf(value).length;
    if (Array.isArray(value)) return size === 1 ? "1 item" : `${size} items`;
    return size === 1 ? "1 key" : `${size} keys`;
}

function Scalar({ value }: { value: unknown }) {
    if (typeof value === "string")
        return <span className={INK.string}>{JSON.stringify(value)}</span>;
    if (typeof value === "number" || typeof value === "bigint")
        return <span className={INK.number}>{String(value)}</span>;
    if (typeof value === "boolean") return <span className={INK.literal}>{String(value)}</span>;
    return <span className={INK.literal}>null</span>;
}

function Key({ name }: { name: string | null }) {
    if (name === null) return null;
    return (
        <>
            <span className={INK.key}>{JSON.stringify(name)}</span>
            <span className={INK.punctuation}>: </span>
        </>
    );
}

function Comma({ show }: { show: boolean }) {
    return show ? <span className={INK.punctuation}>,</span> : null;
}

function Line({
    depth,
    mark,
    toggle,
    children,
}: {
    depth: number;
    mark: boolean;
    toggle?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div
            className={cn("relative break-words whitespace-pre-wrap", mark && "bg-highlight")}
            style={{ paddingLeft: `${(depth + 1) * INDENT_CH}ch` }}
        >
            {toggle && (
                <span
                    className="absolute top-0 flex h-6 items-center"
                    style={{ left: `${depth * INDENT_CH}ch` }}
                >
                    {toggle}
                </span>
            )}
            {children}
        </div>
    );
}

type NodeProps = {
    root?: boolean;
    name: string | null;
    value: unknown;
    depth: number;
    comma: boolean;
    mark: boolean;
    openDepth: number;
    marked: readonly string[];
};

function Branch({
    root = false,
    name,
    value,
    depth,
    comma,
    mark,
    openDepth,
    marked,
}: NodeProps & { value: object }) {
    const [open, setOpen] = useState(depth < openDepth);
    const array = Array.isArray(value);
    const entries = entriesOf(value);
    const [opener, closer] = array ? ["[", "]"] : ["{", "}"];
    if (entries.length === 0) {
        return (
            <Line depth={depth} mark={mark}>
                <Key name={name} />
                <span className={INK.punctuation}>{`${opener}${closer}`}</span>
                <Comma show={comma} />
            </Line>
        );
    }
    const subject = name ?? (array ? "list" : "object");
    const toggle = (
        <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Fold" : "Unfold"} ${subject}`}
            onClick={() => setOpen(!open)}
            className="grid size-4 place-items-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
            <IconChevronRight
                aria-hidden="true"
                className={cn(
                    "size-3.5 transition-transform duration-100 motion-reduce:transition-none",
                    open && "rotate-90",
                )}
            />
        </button>
    );
    const head = (
        <Line depth={depth} mark={mark} toggle={toggle}>
            <Key name={name} />
            <span className={INK.punctuation}>{opener}</span>
            {!open && (
                <>
                    <span className={INK.punctuation}>{`…${closer}`}</span>
                    <Comma show={comma} />
                    <span className={INK.note}>{` ${sizeText(value)}`}</span>
                </>
            )}
        </Line>
    );
    if (!open) return head;
    return (
        <>
            {head}
            <Entries
                entries={entries}
                depth={depth + 1}
                mark={mark}
                markKeys={root}
                openDepth={openDepth}
                marked={marked}
            />
            <Line depth={depth} mark={mark}>
                <span className={INK.punctuation}>{closer}</span>
                <Comma show={comma} />
            </Line>
        </>
    );
}

function Entries({
    entries,
    depth,
    mark,
    markKeys,
    openDepth,
    marked,
}: {
    entries: Entry[];
    depth: number;
    mark: boolean;
    markKeys: boolean;
    openDepth: number;
    marked: readonly string[];
}) {
    return entries.map(([key, item], index) => (
        <JsonNode
            key={key ?? index}
            name={key}
            value={item}
            depth={depth}
            comma={index < entries.length - 1}
            mark={mark || (markKeys && key !== null && marked.includes(key))}
            openDepth={openDepth}
            marked={marked}
        />
    ));
}

function JsonNode(props: NodeProps) {
    if (isBranch(props.value)) return <Branch {...props} value={props.value} />;
    return (
        <Line depth={props.depth} mark={props.mark}>
            <Key name={props.name} />
            <Scalar value={props.value} />
            <Comma show={props.comma} />
        </Line>
    );
}

type JsonViewProps = {
    value: unknown;
    openDepth?: number;
    marked?: readonly string[];
    bare?: boolean;
    className?: string;
};

function JsonView({ value, openDepth = 3, marked = [], bare = false, className }: JsonViewProps) {
    const entries = bare && isBranch(value) ? entriesOf(value) : [];
    return (
        <div
            data-slot="json-view"
            className={cn("min-w-0 font-mono text-base leading-6", className)}
        >
            {entries.length > 0 ? (
                <Entries
                    entries={entries}
                    depth={0}
                    mark={false}
                    markKeys
                    openDepth={openDepth - 1}
                    marked={marked}
                />
            ) : (
                <JsonNode
                    root
                    name={null}
                    value={value}
                    depth={0}
                    comma={false}
                    mark={false}
                    openDepth={openDepth}
                    marked={marked}
                />
            )}
        </div>
    );
}

function summaryValue(value: unknown): ReactNode {
    if (Array.isArray(value)) return <span className={INK.punctuation}>{`[${value.length}]`}</span>;
    if (isBranch(value)) return <span className={INK.punctuation}>{"{…}"}</span>;
    if (typeof value === "string") return <span className={INK.string}>{value}</span>;
    return <Scalar value={value} />;
}

function RecordSummary({ value }: { value: unknown }) {
    if (!isBranch(value) || Array.isArray(value)) return summaryValue(value);
    return entriesOf(value).map(([key, item], index) => (
        <span key={key ?? index}>
            {index > 0 && <span className={INK.note}>{" · "}</span>}
            <span className={INK.key}>{key}</span>
            <span className={INK.punctuation}>{": "}</span>
            {summaryValue(item)}
        </span>
    ));
}

type RecordListProps = {
    records: readonly unknown[];
    open: readonly number[];
    onOpenChange: (open: number[]) => void;
    start?: number;
    noun?: string;
    marked?: readonly string[];
    openDepth?: number;
    summary?: (record: unknown, index: number) => ReactNode;
    empty?: ReactNode;
    className?: string;
};

function RecordList({
    records,
    open,
    onOpenChange,
    start = 1,
    noun = "Row",
    marked,
    openDepth,
    summary,
    empty = "No rows.",
    className,
}: RecordListProps) {
    if (records.length === 0) {
        return (
            <p className={cn("px-3 py-2 text-base text-muted-foreground", className)}>{empty}</p>
        );
    }
    return (
        <ol
            data-slot="record-list"
            className={cn("flex min-w-0 flex-col divide-y divide-border", className)}
        >
            {records.map((record, index) => {
                const isOpen = open.includes(index);
                const number = start + index;
                return (
                    <li key={number} className="min-w-0">
                        <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`${noun} ${number}`}
                            onClick={() =>
                                onOpenChange(
                                    isOpen
                                        ? open.filter((item) => item !== index)
                                        : [...open, index],
                                )
                            }
                            className="flex h-9 w-full min-w-0 items-center gap-2 px-3 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                        >
                            <IconChevronRight
                                aria-hidden="true"
                                className={cn(
                                    "size-4 shrink-0 text-muted-foreground transition-transform duration-100 motion-reduce:transition-none",
                                    isOpen && "rotate-90",
                                )}
                            />
                            <span className="w-9 shrink-0 text-sm text-muted-foreground tabular-nums">
                                {number}
                            </span>
                            <span
                                className={cn(
                                    "flex min-w-0 flex-1 items-center gap-3",
                                    isOpen && "invisible",
                                )}
                            >
                                {summary ? (
                                    summary(record, index)
                                ) : (
                                    <span className="min-w-0 flex-1 truncate font-mono text-sm">
                                        <RecordSummary value={record} />
                                    </span>
                                )}
                            </span>
                        </button>
                        {isOpen && (
                            <div className="pr-3 pb-3 pl-16">
                                <JsonView
                                    value={record}
                                    marked={marked}
                                    openDepth={openDepth}
                                    bare
                                />
                            </div>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function RecordListToggle({
    total,
    open,
    onOpenChange,
}: {
    total: number;
    open: readonly number[];
    onOpenChange: (open: number[]) => void;
}) {
    const all = total > 0 && open.length >= total;
    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={total === 0}
            onClick={() =>
                onOpenChange(all ? [] : Array.from({ length: total }, (_, index) => index))
            }
        >
            {all ? "Collapse all" : "Expand all"}
        </Button>
    );
}

export { JsonView, type JsonViewProps, RecordList, type RecordListProps, RecordListToggle };
