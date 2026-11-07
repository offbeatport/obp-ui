"use client";

import { Autocomplete } from "@base-ui/react/autocomplete";
import { Search, X } from "lucide-react";
import { type ReactNode, type Ref, useState } from "react";

import { cn } from "../lib/cn";
import { Input } from "./input";
import { Kbd } from "./kbd";

type SearchMenuGroup<T> = {
    key: string;
    label?: ReactNode;
    items: readonly T[];
};

type SearchMenuProps<T> = {
    groups: readonly SearchMenuGroup<T>[];
    query: string;
    onQueryChange: (query: string) => void;
    itemKey: (item: T) => string;
    itemText: (item: T) => string;
    renderItem: (item: T) => ReactNode;
    onPick: (item: T) => void;
    label: string;
    placeholder?: string;
    empty?: ReactNode;
    shortcut?: string;
    inputRef?: Ref<HTMLInputElement>;
    className?: string;
    popupClassName?: string;
};

function SearchMenu<T>({
    groups,
    query,
    onQueryChange,
    itemKey,
    itemText,
    renderItem,
    onPick,
    label,
    placeholder,
    empty = "Nothing matches.",
    shortcut,
    inputRef,
    className,
    popupClassName,
}: SearchMenuProps<T>) {
    const [open, setOpen] = useState(false);
    const searching = query.trim().length > 0;
    const pick = (item: T) => {
        onPick(item);
        onQueryChange("");
        setOpen(false);
    };
    return (
        <Autocomplete.Root
            items={groups}
            mode="none"
            autoHighlight="always"
            openOnInputClick
            open={open && searching}
            onOpenChange={setOpen}
            itemToStringValue={itemText}
            value={query}
            onValueChange={(next, details) => {
                if (details.reason !== "item-press") {
                    onQueryChange(next);
                }
            }}
        >
            <div data-slot="search-menu" className={cn("relative", className)}>
                <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Autocomplete.Input
                    ref={inputRef}
                    aria-label={label}
                    placeholder={placeholder}
                    onKeyDown={(event) => {
                        if (event.key === "Escape" && query) {
                            event.preventDefault();
                            event.stopPropagation();
                            onQueryChange("");
                        }
                    }}
                    render={
                        <Input
                            type="search"
                            className="peer pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none"
                        />
                    }
                />
                {query ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label="Clear search"
                        onClick={() => onQueryChange("")}
                        className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <X className="size-3.5" />
                    </button>
                ) : (
                    shortcut && (
                        <Kbd
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 peer-focus:hidden"
                        >
                            {shortcut}
                        </Kbd>
                    )
                )}
            </div>
            <Autocomplete.Portal>
                <Autocomplete.Positioner
                    data-slot="search-menu-positioner"
                    className="z-50 outline-none"
                    align="start"
                    sideOffset={4}
                >
                    <Autocomplete.Popup
                        data-slot="search-menu-popup"
                        className={cn(
                            "flex max-h-[min(30rem,var(--available-height))] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-e2",
                            "transition-opacity duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none",
                            popupClassName,
                        )}
                    >
                        <Autocomplete.Empty className="px-3 py-3 text-sm text-muted-foreground empty:hidden">
                            {empty}
                        </Autocomplete.Empty>
                        <Autocomplete.List
                            data-slot="search-menu-items"
                            className="min-h-0 overflow-y-auto py-1 outline-none empty:hidden"
                        >
                            {(group: SearchMenuGroup<T>) => (
                                <Autocomplete.Group
                                    key={group.key}
                                    items={group.items}
                                    className="border-t border-border-soft pb-1 first:border-t-0"
                                >
                                    {group.label && (
                                        <Autocomplete.GroupLabel className="px-3 pt-2 pb-1 text-sm font-medium text-muted-foreground">
                                            {group.label}
                                        </Autocomplete.GroupLabel>
                                    )}
                                    <Autocomplete.Collection>
                                        {(item: T) => (
                                            <Autocomplete.Item
                                                key={itemKey(item)}
                                                value={item}
                                                onClick={() => pick(item)}
                                                className="flex cursor-pointer flex-col gap-0.5 px-3 py-1.5 text-base outline-none select-none data-highlighted:bg-secondary"
                                            >
                                                {renderItem(item)}
                                            </Autocomplete.Item>
                                        )}
                                    </Autocomplete.Collection>
                                </Autocomplete.Group>
                            )}
                        </Autocomplete.List>
                    </Autocomplete.Popup>
                </Autocomplete.Positioner>
            </Autocomplete.Portal>
        </Autocomplete.Root>
    );
}

export { SearchMenu, type SearchMenuGroup, type SearchMenuProps };
