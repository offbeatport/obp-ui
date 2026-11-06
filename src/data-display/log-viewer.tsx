"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import {
    type ReactNode,
    type UIEvent,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { cn } from "../lib/cn";
import { foldText, searchTerms } from "../lib/search-text";
import { Button } from "../primitives/button";
import { HighlightText } from "../primitives/highlight-text";
import { SearchInput } from "../primitives/search-input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../primitives/select";
import { Switch } from "../primitives/switch";

type LogLevel = "debug" | "info" | "warning" | "error";

type LogEntry = {
    id: string | number;
    level: LogLevel;
    message: string;
    time?: number;
    source?: string;
    fields?: Readonly<Record<string, unknown>>;
    detail?: string;
};

type LogViewerProps = {
    entries: readonly LogEntry[];
    live?: boolean;
    quietSource?: string;
    quietLabel?: string;
    defaultLevel?: LogLevel;
    fileName?: string;
    label?: string;
    empty?: ReactNode;
    maxHeight?: string;
    actions?: ReactNode;
    formatTime?: (time: number) => string;
    className?: string;
};

const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warning: 2, error: 3 };
const LEVEL_TAG: Record<LogLevel, string> = {
    debug: "debug",
    info: "info",
    warning: "warn",
    error: "error",
};
const LEVEL_INK: Record<LogLevel, string> = {
    debug: "text-faint",
    info: "text-muted-foreground",
    warning: "text-warning",
    error: "text-destructive",
};
const LEVEL_CHOICES: { value: LogLevel; label: string }[] = [
    { value: "debug", label: "All levels" },
    { value: "info", label: "Info and above" },
    { value: "warning", label: "Warnings and errors" },
    { value: "error", label: "Errors only" },
];
const NEAR_BOTTOM = 40;
const ESTIMATED_LINE = 22;
const COPIED_MS = 1500;

function clock(time: number): string {
    const moment = new Date(time);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(moment.getHours())}:${pad(moment.getMinutes())}:${pad(moment.getSeconds())}`;
}

function fieldText(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === undefined) return "";
    return JSON.stringify(value);
}

function hasMore(entry: LogEntry): boolean {
    return Boolean(entry.detail) || Object.keys(entry.fields ?? {}).length > 0;
}

function plainLine(entry: LogEntry): string {
    const time = entry.time === undefined ? "" : `${new Date(entry.time).toISOString()} `;
    const source = entry.source ? ` [${entry.source}]` : "";
    const fields =
        entry.fields && Object.keys(entry.fields).length > 0
            ? ` ${JSON.stringify(entry.fields)}`
            : "";
    const detail = entry.detail ? `\n${entry.detail}` : "";
    return `${time}${LEVEL_TAG[entry.level].padEnd(5)}${source} ${entry.message}${fields}${detail}`;
}

function plainText(entries: readonly LogEntry[]): string {
    return `${entries.map(plainLine).join("\n")}\n`;
}

function copyWithSelection(text: string): boolean {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
}

async function copyText(text: string): Promise<boolean> {
    if (navigator.clipboard) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            return copyWithSelection(text);
        }
    }
    return copyWithSelection(text);
}

function saveText(text: string, fileName: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

const SEARCHABLE = new WeakMap<LogEntry, string>();

function searchable(entry: LogEntry): string {
    const known = SEARCHABLE.get(entry);
    if (known !== undefined) return known;
    const fields = entry.fields ? JSON.stringify(entry.fields) : "";
    const folded = foldText(`${entry.message}\n${entry.detail ?? ""}\n${fields}`);
    SEARCHABLE.set(entry, folded);
    return folded;
}

function matches(entry: LogEntry, terms: string[]): boolean {
    if (terms.length === 0) return true;
    const text = searchable(entry);
    return terms.every((term) => text.includes(term));
}

function Fields({ fields }: { fields: Readonly<Record<string, unknown>> }) {
    return (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-0.5">
            {Object.entries(fields).map(([key, value]) => (
                <div key={key} className="contents">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="break-words whitespace-pre-wrap text-foreground">
                        {fieldText(value)}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function LogRow({
    entry,
    open,
    query,
    quiet,
    formatTime,
    onToggle,
}: {
    entry: LogEntry;
    open: boolean;
    query: string;
    quiet: boolean;
    formatTime: (time: number) => string;
    onToggle: () => void;
}) {
    const expandable = hasMore(entry);
    const ink =
        entry.level === "error" || entry.level === "warning"
            ? LEVEL_INK[entry.level]
            : entry.level === "debug" || quiet
              ? "text-muted-foreground"
              : "text-foreground";
    const summary = (
        <>
            <span className="flex h-[1.5em] items-center justify-center text-muted-foreground">
                {expandable && (
                    <ChevronRight
                        aria-hidden="true"
                        className={cn(
                            "size-3.5 transition-transform duration-100 motion-reduce:transition-none",
                            open && "rotate-90",
                        )}
                    />
                )}
            </span>
            {entry.time !== undefined && (
                <time
                    dateTime={new Date(entry.time).toISOString()}
                    title={new Date(entry.time).toLocaleString()}
                    className="text-faint tabular-nums"
                >
                    {formatTime(entry.time)}
                </time>
            )}
            <span className={LEVEL_INK[entry.level]}>{LEVEL_TAG[entry.level]}</span>
            <HighlightText
                text={entry.message}
                query={query}
                className={cn("min-w-0 break-words whitespace-pre-wrap", ink)}
            />
        </>
    );
    const columns =
        entry.time === undefined
            ? "grid-cols-[1rem_5ch_minmax(0,1fr)]"
            : "grid-cols-[1rem_max-content_5ch_minmax(0,1fr)]";
    if (!expandable) {
        return (
            <div
                data-slot="log-row"
                data-level={entry.level}
                className={cn("grid gap-x-2 px-2 py-0.5 hover:bg-secondary", columns)}
            >
                {summary}
            </div>
        );
    }
    return (
        <div
            data-slot="log-row"
            data-level={entry.level}
            className={cn("grid gap-x-2 px-2 hover:bg-secondary", columns)}
        >
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className="col-span-full grid cursor-pointer grid-cols-subgrid py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
                {summary}
            </button>
            {open && (
                <div className="flex min-w-0 flex-col gap-1 pb-1" style={{ gridColumn: "-2 / -1" }}>
                    {entry.fields && Object.keys(entry.fields).length > 0 && (
                        <Fields fields={entry.fields} />
                    )}
                    {entry.detail && (
                        <div className="overflow-x-auto">
                            <HighlightText
                                text={entry.detail}
                                query={query}
                                className="whitespace-pre text-foreground"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function LogViewer({
    entries,
    live = false,
    quietSource,
    quietLabel = "Show all output",
    defaultLevel = "info",
    fileName = "log.txt",
    label = "Log",
    empty,
    maxHeight = "28rem",
    actions,
    formatTime = clock,
    className,
}: LogViewerProps) {
    const [query, setQuery] = useState("");
    const [level, setLevel] = useState<LogLevel>(defaultLevel);
    const [showQuiet, setShowQuiet] = useState(false);
    const [follow, setFollow] = useState(live);
    const [opened, setOpened] = useState<ReadonlySet<LogEntry["id"]>>(() => new Set());
    const [copied, setCopied] = useState(false);
    const scroller = useRef<HTMLDivElement>(null);
    const id = useId();
    const hasQuiet =
        quietSource !== undefined && entries.some((entry) => entry.source === quietSource);

    useEffect(() => {
        setFollow(live);
    }, [live]);

    useEffect(() => {
        if (!copied) return;
        const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
        return () => window.clearTimeout(timer);
    }, [copied]);

    const shown = useMemo(() => {
        const terms = searchTerms(query);
        return entries.filter(
            (entry) =>
                RANK[entry.level] >= RANK[level] &&
                (showQuiet || entry.source !== quietSource || entry.level === "error") &&
                matches(entry, terms),
        );
    }, [entries, level, showQuiet, quietSource, query]);

    const virtualizer = useVirtualizer({
        count: shown.length,
        getScrollElement: () => scroller.current,
        getItemKey: (index) => shown[index]?.id ?? index,
        estimateSize: () => ESTIMATED_LINE,
        overscan: 12,
    });
    const total = virtualizer.getTotalSize();

    const lines = shown.length;
    useLayoutEffect(() => {
        void total;
        void lines;
        const element = scroller.current;
        if (follow && element) {
            element.scrollTop = element.scrollHeight;
        }
    }, [follow, total, lines]);

    const onScroll = (event: UIEvent<HTMLDivElement>) => {
        const element = event.currentTarget;
        const atBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM;
        if (follow && !atBottom) setFollow(false);
        if (!follow && live && atBottom) setFollow(true);
    };

    const toggle = (id: LogEntry["id"]) =>
        setOpened((current) => {
            const next = new Set(current);
            if (!next.delete(id)) next.add(id);
            return next;
        });

    const clear = () => {
        setQuery("");
        setLevel("debug");
        setShowQuiet(true);
    };

    const counts = useMemo(() => {
        const found: Record<LogLevel, number> = { debug: 0, info: 0, warning: 0, error: 0 };
        for (const entry of entries) found[entry.level] += 1;
        return found;
    }, [entries]);

    const atLeast = (floor: LogLevel) =>
        (Object.keys(counts) as LogLevel[])
            .filter((name) => RANK[name] >= RANK[floor])
            .reduce((sum, name) => sum + counts[name], 0);

    return (
        <div data-slot="log-viewer" className={cn("flex min-w-0 flex-col gap-2", className)}>
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    aria-label={`Search ${label.toLowerCase()}`}
                    placeholder="Search"
                    value={query}
                    onValueChange={setQuery}
                    className="w-full min-w-40 max-w-64 flex-1"
                />
                <Select
                    value={level}
                    items={LEVEL_CHOICES}
                    onValueChange={(next) => setLevel(next as LogLevel)}
                >
                    <SelectTrigger aria-label="Level" className="w-auto min-w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LEVEL_CHOICES.map((choice) => (
                            <SelectItem key={choice.value} value={choice.value}>
                                {choice.label}
                                <span className="ml-auto pl-3 text-muted-foreground tabular-nums">
                                    {atLeast(choice.value)}
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {hasQuiet && (
                    <span className="flex h-8 items-center gap-2 text-sm">
                        <Switch
                            id={`${id}-quiet`}
                            size="sm"
                            checked={showQuiet}
                            onCheckedChange={setShowQuiet}
                        />
                        <label htmlFor={`${id}-quiet`}>{quietLabel}</label>
                    </span>
                )}
                {live && (
                    <span className="flex h-8 items-center gap-2 text-sm">
                        <Switch
                            id={`${id}-follow`}
                            size="sm"
                            checked={follow}
                            onCheckedChange={setFollow}
                        />
                        <label htmlFor={`${id}-follow`}>Follow</label>
                    </span>
                )}
                <span className="text-sm text-muted-foreground tabular-nums">
                    {shown.length === entries.length
                        ? `${entries.length} ${entries.length === 1 ? "line" : "lines"}`
                        : `${shown.length} of ${entries.length} lines`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {actions}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={shown.length === 0}
                        aria-label={copied ? "Copied" : "Copy the lines shown"}
                        onClick={() => copyText(plainText(shown)).then(setCopied)}
                    >
                        {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={entries.length === 0}
                        onClick={() => saveText(plainText(entries), fileName)}
                    >
                        Download
                    </Button>
                </div>
            </div>
            <div
                ref={scroller}
                role="log"
                aria-live="off"
                aria-label={label}
                onScroll={onScroll}
                className="min-h-24 overflow-auto rounded-lg border bg-card py-1 font-mono text-sm leading-[1.5] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ maxHeight }}
            >
                {entries.length === 0 ? (
                    <div className="px-3 py-2 font-sans text-muted-foreground">
                        {empty ?? "No output yet."}
                    </div>
                ) : shown.length === 0 ? (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 font-sans">
                        <span className="text-muted-foreground">No lines match these filters.</span>
                        <Button variant="outline" size="sm" onClick={clear}>
                            Show every line
                        </Button>
                    </div>
                ) : (
                    <div className="relative w-full" style={{ height: total }}>
                        {virtualizer.getVirtualItems().map((item) => {
                            const entry = shown[item.index];
                            if (!entry) return null;
                            return (
                                <div
                                    key={item.key}
                                    ref={virtualizer.measureElement}
                                    data-index={item.index}
                                    className="absolute top-0 left-0 w-full"
                                    style={{ transform: `translateY(${item.start}px)` }}
                                >
                                    <LogRow
                                        entry={entry}
                                        open={opened.has(entry.id)}
                                        query={query}
                                        quiet={entry.source === quietSource}
                                        formatTime={formatTime}
                                        onToggle={() => toggle(entry.id)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export { LogViewer, type LogEntry, type LogLevel, type LogViewerProps, plainText as logText };
