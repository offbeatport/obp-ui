"use client";

import { Combobox } from "@base-ui/react/combobox";
import { CheckIcon, ChevronDownIcon, Search } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";
import { cn } from "../lib/cn";
import { type ProviderId, ProviderLogo } from "../provider-logos";

export type ChatModel = {
    id: string;
    name: string;
    provider?: ProviderId;
    icon?: ReactNode;
    group?: string;
    detail?: ReactNode;
    keywords?: string;
    disabled?: boolean;
};

type ChatModelGroup = { key: string; label?: string; items: ChatModel[] };

export type ChatModelPickerProps = {
    models: readonly ChatModel[];
    value: string | null;
    onValueChange: (id: string) => void;
    label?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    empty?: ReactNode;
    hint?: ReactNode;
    disabled?: boolean;
    align?: "start" | "center" | "end";
    side?: "top" | "bottom";
    className?: string;
    popupClassName?: string;
};

const TRIGGER =
    "inline-flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-base text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-secondary data-popup-open:text-foreground disabled:pointer-events-none disabled:opacity-50";

const POPUP =
    "flex max-h-[min(24rem,var(--available-height))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-e2 transition-opacity duration-100 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none";

const ITEM =
    "grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)_1rem] items-center gap-x-2 px-3 py-1.5 text-base outline-none select-none data-disabled:cursor-not-allowed data-disabled:opacity-50 data-highlighted:bg-secondary";

function groupModels(models: readonly ChatModel[]): ChatModelGroup[] {
    const groups = new Map<string, ChatModelGroup>();
    for (const model of models) {
        const key = model.group ?? "";
        const group = groups.get(key) ?? { key, label: model.group, items: [] };
        group.items.push(model);
        groups.set(key, group);
    }
    return [...groups.values()];
}

function ModelMark({ model }: { model: ChatModel }) {
    if (model.icon) {
        return (
            <span
                aria-hidden="true"
                className="flex size-4 shrink-0 items-center justify-center [&>*]:size-4 [&>*]:shrink-0"
            >
                {model.icon}
            </span>
        );
    }
    return model.provider ? (
        <ProviderLogo id={model.provider} className="size-4 shrink-0" />
    ) : (
        <span aria-hidden="true" className="size-4 shrink-0" />
    );
}

function typedKey(event: KeyboardEvent): string | null {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return null;
    return event.key === " " ? null : event.key;
}

function focusOnMount(input: HTMLInputElement | null): void {
    input?.focus({ preventScroll: true });
}

function modelText(model: ChatModel): string {
    return [model.name, model.group, model.provider, model.id, model.keywords]
        .filter(Boolean)
        .join(" ");
}

export function ChatModelPicker({
    models,
    value,
    onValueChange,
    label = "Model",
    placeholder = "Choose a model",
    searchPlaceholder = "Search models",
    empty = "No model matches.",
    hint,
    disabled,
    align = "start",
    side = "top",
    className,
    popupClassName,
}: ChatModelPickerProps) {
    const groups = useMemo(() => groupModels(models), [models]);
    const selected = models.find((model) => model.id === value) ?? null;
    const searchable = models.length > 6;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const typeIntoSearch = (event: KeyboardEvent<HTMLButtonElement>): boolean => {
        const key = typedKey(event);
        if (key === null) return false;
        event.preventDefault();
        if (searchable) {
            setQuery((current) => (open ? current + key : key));
            setOpen(true);
        }
        return true;
    };

    return (
        <Combobox.Root<ChatModel>
            items={groups}
            value={selected}
            onValueChange={(next) => {
                if (next) onValueChange(next.id);
            }}
            itemToStringLabel={(model) => model.name}
            itemToStringValue={modelText}
            isItemEqualToValue={(item, current) => item.id === current.id}
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setQuery("");
            }}
            inputValue={query}
            onInputValueChange={setQuery}
            autoHighlight
            disabled={disabled}
        >
            <Combobox.Trigger
                data-slot="chat-model-picker"
                aria-label={selected ? `${label}: ${selected.name}` : label}
                className={cn(TRIGGER, className)}
                onKeyDown={(event) => {
                    if (typeIntoSearch(event)) event.preventBaseUIHandler();
                }}
            >
                {selected ? (
                    <>
                        <ModelMark model={selected} />
                        <span className="truncate text-foreground">{selected.name}</span>
                    </>
                ) : (
                    <span className="truncate">{placeholder}</span>
                )}
                <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
            </Combobox.Trigger>
            <Combobox.Portal>
                <Combobox.Positioner
                    className="z-50 outline-none"
                    side={side}
                    align={align}
                    sideOffset={6}
                >
                    <Combobox.Popup
                        data-slot="chat-model-picker-popup"
                        aria-label={label}
                        className={cn(POPUP, popupClassName)}
                    >
                        <div
                            className={cn(
                                "relative border-b border-border-soft",
                                !searchable && "sr-only",
                            )}
                        >
                            <Search
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                            />
                            <Combobox.Input
                                ref={focusOnMount}
                                aria-label={searchPlaceholder}
                                placeholder={searchPlaceholder}
                                className="h-9 w-full bg-transparent pr-3 pl-9 text-base outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        <Combobox.Empty className="px-3 py-3 text-sm text-muted-foreground empty:hidden">
                            {empty}
                        </Combobox.Empty>
                        <Combobox.List className="min-h-0 overflow-y-auto py-1 outline-none empty:hidden">
                            {(group: ChatModelGroup) => (
                                <Combobox.Group
                                    key={group.key}
                                    items={group.items}
                                    className="border-t border-border-soft pb-1 first:border-t-0"
                                >
                                    {group.label && (
                                        <Combobox.GroupLabel className="px-3 pt-2 pb-1 text-sm font-medium text-muted-foreground">
                                            {group.label}
                                        </Combobox.GroupLabel>
                                    )}
                                    <Combobox.Collection>
                                        {(model: ChatModel) => (
                                            <Combobox.Item
                                                key={model.id}
                                                value={model}
                                                disabled={model.disabled}
                                                className={ITEM}
                                            >
                                                <ModelMark model={model} />
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="truncate">{model.name}</span>
                                                    {model.detail && (
                                                        <span className="truncate text-sm text-muted-foreground tabular-nums">
                                                            {model.detail}
                                                        </span>
                                                    )}
                                                </span>
                                                <Combobox.ItemIndicator className="flex size-4 items-center justify-center">
                                                    <CheckIcon className="size-4" strokeWidth={3} />
                                                </Combobox.ItemIndicator>
                                            </Combobox.Item>
                                        )}
                                    </Combobox.Collection>
                                </Combobox.Group>
                            )}
                        </Combobox.List>
                        {hint && (
                            <p className="border-t border-border-soft px-3 py-2 text-sm text-muted-foreground">
                                {hint}
                            </p>
                        )}
                    </Combobox.Popup>
                </Combobox.Positioner>
            </Combobox.Portal>
        </Combobox.Root>
    );
}
