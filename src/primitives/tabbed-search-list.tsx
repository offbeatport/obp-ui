"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Search, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Input } from "./input";
import { Tabs, TabsList, TabsTrigger } from "./tabs";

type TabbedSearchListGroup<T> = {
    key: string;
    label?: ReactNode;
    items: readonly T[];
};

type TabbedSearchListTab<T> = {
    value: string;
    label: string;
    groups?: readonly TabbedSearchListGroup<T>[];
    toolbar?: ReactNode;
    actions?: ReactNode;
    empty?: ReactNode;
    panel?: (query: string) => ReactNode;
    matches?: (query: string) => boolean;
};

type TabbedSearchListProps<T> = {
    tabs: readonly TabbedSearchListTab<T>[];
    tab: string;
    onTabChange: (tab: string) => void;
    itemKey: (item: T) => string;
    itemText: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    onPick: (item: T) => void;
    currentKey?: string;
    label: string;
    placeholder?: string;
    className?: string;
    listClassName?: string;
};

function fold(text: string): string {
    return text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
}

function matcher(query: string): (text: string) => boolean {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    return (text) => {
        const folded = fold(text);
        return terms.every((term) => folded.includes(term));
    };
}

function filterGroups<T>(
    groups: readonly TabbedSearchListGroup<T>[],
    hit: (text: string) => boolean,
    itemText: (item: T) => string,
): TabbedSearchListGroup<T>[] {
    return groups
        .map((group) => ({ ...group, items: group.items.filter((item) => hit(itemText(item))) }))
        .filter((group) => group.items.length > 0);
}

function total<T>(groups: readonly TabbedSearchListGroup<T>[]): number {
    return groups.reduce((sum, group) => sum + group.items.length, 0);
}

function TabbedSearchList<T>({
    tabs,
    tab,
    onTabChange,
    itemKey,
    itemText,
    renderItem,
    onPick,
    currentKey,
    label,
    placeholder,
    className,
    listClassName,
}: TabbedSearchListProps<T>) {
    const [query, setQuery] = useState("");
    const input = useRef<HTMLInputElement>(null);
    const id = useId();
    const hit = matcher(query);
    const searching = query.trim().length > 0;
    const filtered = new Map(
        tabs.map((item) => [item.value, filterGroups(item.groups ?? [], hit, itemText)]),
    );
    const counts = new Map(
        tabs.map((item) => [item.value, item.panel ? null : total(filtered.get(item.value) ?? [])]),
    );
    const active = tabs.find((item) => item.value === tab) ?? tabs[0];
    const groups = active && !active.panel ? (filtered.get(active.value) ?? []) : [];
    const elsewhere = tabs.filter(
        (item) =>
            item.value !== active?.value &&
            (item.panel ? Boolean(item.matches?.(query)) : (counts.get(item.value) ?? 0) > 0),
    );
    const toSearch = (event: KeyboardEvent) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            input.current?.focus();
        }
    };
    return (
        <Autocomplete.Root
            items={groups}
            inline
            open
            mode="none"
            autoHighlight="always"
            itemToStringValue={itemText}
            value={query}
            onValueChange={(next, details) => {
                if (details.reason !== "item-press") {
                    setQuery(next);
                }
            }}
        >
            <div
                data-slot="tabbed-search-list"
                className={cn("flex min-h-0 flex-col gap-3", className)}
            >
                <div className="relative">
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Autocomplete.Input
                        ref={input}
                        aria-label={label}
                        placeholder={placeholder}
                        onKeyDown={(event) => {
                            if (event.key === "Escape" && query) {
                                event.preventDefault();
                                event.stopPropagation();
                                setQuery("");
                            }
                        }}
                        render={
                            <Input
                                type="search"
                                className="pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
                            />
                        }
                    />
                    {query && (
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-label="Clear search"
                            onClick={() => {
                                setQuery("");
                                input.current?.focus();
                            }}
                            className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
                <Tabs
                    value={active?.value}
                    onValueChange={(next) => onTabChange(String(next))}
                    className="min-h-0 flex-1 gap-3"
                >
                    <div className="flex min-h-10 flex-wrap items-end justify-between gap-x-3 gap-y-2 border-b">
                        <TabsList
                            variant="line"
                            className="-mb-px gap-2 px-0 group-data-[orientation=horizontal]/tabs:h-10"
                            onKeyDown={toSearch}
                        >
                            {tabs.map((item) => {
                                const count = counts.get(item.value);
                                return (
                                    <TabsTrigger
                                        key={item.value}
                                        value={item.value}
                                        id={`${id}-tab-${item.value}`}
                                        aria-controls={`${id}-panel`}
                                        className="flex-none px-3 text-base"
                                    >
                                        {item.label}
                                        {count !== null && count !== undefined && (
                                            <span className="font-normal text-muted-foreground tabular-nums">
                                                {count}
                                            </span>
                                        )}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                        {active?.actions && (
                            <div className="flex items-center gap-2 pb-1.5">{active.actions}</div>
                        )}
                    </div>
                    <div
                        role="tabpanel"
                        id={`${id}-panel`}
                        aria-labelledby={active ? `${id}-tab-${active.value}` : undefined}
                        className="flex min-h-0 flex-1 flex-col gap-3"
                    >
                        {active?.panel ? active.panel(query) : active?.toolbar}
                        {active && !active.panel && groups.length === 0 && (
                            <div
                                data-slot="tabbed-search-list-empty"
                                className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-md border px-3 py-8 text-center text-base text-muted-foreground"
                            >
                                <span>
                                    {searching
                                        ? "Nothing here matches."
                                        : (active.empty ?? "Nothing here yet.")}
                                </span>
                                {searching && elsewhere.length > 0 && (
                                    <span className="flex flex-wrap items-center justify-center gap-2">
                                        {elsewhere.map((other) => {
                                            const count = counts.get(other.value);
                                            return (
                                                <Button
                                                    key={other.value}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onTabChange(other.value)}
                                                >
                                                    {other.label}
                                                    {count !== null && count !== undefined && (
                                                        <span className="text-muted-foreground tabular-nums">
                                                            {count}
                                                        </span>
                                                    )}
                                                </Button>
                                            );
                                        })}
                                    </span>
                                )}
                            </div>
                        )}
                        <Autocomplete.List
                            data-slot="tabbed-search-list-items"
                            className={cn(
                                "relative flex max-h-[min(26rem,55vh)] min-h-0 flex-col overflow-y-auto rounded-md border outline-none empty:hidden",
                                listClassName,
                            )}
                        >
                            {(group: TabbedSearchListGroup<T>) => (
                                <Autocomplete.Group
                                    key={group.key}
                                    items={group.items}
                                    className="border-t first:border-t-0 [&>[role=option]+[role=option]]:border-t [&>[role=option]+[role=option]]:border-border-soft"
                                >
                                    {group.label && (
                                        <Autocomplete.GroupLabel className="px-3 pt-2.5 pb-1 text-sm font-medium text-muted-foreground">
                                            {group.label}
                                        </Autocomplete.GroupLabel>
                                    )}
                                    <Autocomplete.Collection>
                                        {(entry: T) => {
                                            const current = currentKey === itemKey(entry);
                                            return (
                                                <Autocomplete.Item
                                                    key={itemKey(entry)}
                                                    value={entry}
                                                    onClick={() => onPick(entry)}
                                                    data-current={current ? "" : undefined}
                                                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm outline-none select-none data-current:not-data-highlighted:bg-accent data-highlighted:bg-secondary"
                                                >
                                                    {renderItem(entry)}
                                                    {current && (
                                                        <span className="sr-only">
                                                            Current choice
                                                        </span>
                                                    )}
                                                </Autocomplete.Item>
                                            );
                                        }}
                                    </Autocomplete.Collection>
                                </Autocomplete.Group>
                            )}
                        </Autocomplete.List>
                    </div>
                </Tabs>
            </div>
        </Autocomplete.Root>
    );
}

export {
    TabbedSearchList,
    type TabbedSearchListGroup,
    type TabbedSearchListProps,
    type TabbedSearchListTab,
};
