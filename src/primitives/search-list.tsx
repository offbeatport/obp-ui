"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Search, X } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "../lib/cn";
import { Input } from "./input";

type SearchListProps<T> = {
    items: readonly T[];
    itemKey: (item: T) => string;
    itemText: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    onPick: (item: T) => void;
    label: string;
    placeholder?: string;
    empty?: ReactNode;
    className?: string;
    listClassName?: string;
};

function SearchList<T>({
    items,
    itemKey,
    itemText,
    renderItem,
    onPick,
    label,
    placeholder,
    empty = "Nothing matches.",
    className,
    listClassName,
}: SearchListProps<T>) {
    const [query, setQuery] = useState("");
    return (
        <Autocomplete.Root
            items={items}
            inline
            open
            autoHighlight="always"
            itemToStringValue={itemText}
            value={query}
            onValueChange={(next, details) => {
                if (details.reason !== "item-press") {
                    setQuery(next);
                }
            }}
        >
            <div data-slot="search-list" className={cn("flex min-h-0 flex-col gap-3", className)}>
                <div className="relative">
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Autocomplete.Input
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
                            aria-label="Clear search"
                            onClick={() => setQuery("")}
                            className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
                <Autocomplete.Empty className="rounded-md border px-3 py-4 text-sm text-muted-foreground empty:hidden">
                    {empty}
                </Autocomplete.Empty>
                <Autocomplete.List
                    data-slot="search-list-items"
                    className={cn(
                        "flex max-h-[min(26rem,55vh)] flex-col divide-y overflow-y-auto rounded-md border outline-none empty:hidden",
                        listClassName,
                    )}
                >
                    {(item: T, index: number) => (
                        <Autocomplete.Item
                            key={itemKey(item)}
                            value={item}
                            index={index}
                            onClick={() => onPick(item)}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm outline-none select-none data-highlighted:bg-secondary"
                        >
                            {renderItem(item)}
                        </Autocomplete.Item>
                    )}
                </Autocomplete.List>
            </div>
        </Autocomplete.Root>
    );
}

export { SearchList, type SearchListProps };
