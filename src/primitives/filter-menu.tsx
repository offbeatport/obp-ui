"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { InfoTip } from "./info-tip";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Switch } from "./switch";

type FilterMenuOption = {
    value: string;
    label: ReactNode;
    count?: number;
};

type FilterMenuSection =
    | {
          kind: "options";
          key: string;
          title: string;
          options: FilterMenuOption[];
          value: string[];
          onValueChange: (value: string[]) => void;
      }
    | {
          kind: "toggle";
          key: string;
          title: string;
          label: ReactNode;
          info?: ReactNode;
          count?: number;
          checked: boolean;
          onCheckedChange: (checked: boolean) => void;
      };

type FilterMenuProps = {
    sections: FilterMenuSection[];
    onClear: () => void;
    summary?: ReactNode;
    label?: string;
    align?: "start" | "center" | "end";
    className?: string;
};

function activeCount(sections: FilterMenuSection[]): number {
    return sections.reduce(
        (sum, section) =>
            sum + (section.kind === "options" ? section.value.length : section.checked ? 1 : 0),
        0,
    );
}

function Count({ value }: { value?: number }) {
    return value === undefined ? null : (
        <span className="text-sm text-muted-foreground tabular-nums">{value}</span>
    );
}

function OptionsSection({ section }: { section: Extract<FilterMenuSection, { kind: "options" }> }) {
    const toggle = (option: string, on: boolean) =>
        section.onValueChange(
            on
                ? section.options
                      .map((item) => item.value)
                      .filter((item) => item === option || section.value.includes(item))
                : section.value.filter((item) => item !== option),
        );
    return (
        <fieldset className="flex flex-col">
            <legend className="px-2.5 pt-1 pb-1.5 text-sm font-medium text-muted-foreground">
                {section.title}
            </legend>
            {section.options.map((option) => (
                <Label
                    key={option.value}
                    className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 font-normal hover:bg-secondary"
                >
                    <Checkbox
                        checked={section.value.includes(option.value)}
                        onCheckedChange={(next) => toggle(option.value, next === true)}
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Count value={option.count} />
                </Label>
            ))}
        </fieldset>
    );
}

function ToggleSection({ section }: { section: Extract<FilterMenuSection, { kind: "toggle" }> }) {
    return (
        <div className="flex flex-col">
            <span className="px-2.5 pt-1 pb-1.5 text-sm font-medium text-muted-foreground">
                {section.title}
            </span>
            <div className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 hover:bg-secondary">
                <Label className="flex min-w-0 flex-1 items-center gap-2.5 font-normal">
                    <Switch
                        checked={section.checked}
                        onCheckedChange={(next) => section.onCheckedChange(next === true)}
                    />
                    <span className="truncate">{section.label}</span>
                </Label>
                {section.info && <InfoTip label={section.title}>{section.info}</InfoTip>}
                <Count value={section.count} />
            </div>
        </div>
    );
}

function FilterMenu({
    sections,
    onClear,
    summary,
    label = "Filters",
    align = "end",
    className,
}: FilterMenuProps) {
    const active = activeCount(sections);
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    data-slot="filter-menu"
                    data-active={active > 0 || undefined}
                    className={cn("data-active:border-primary", className)}
                >
                    <SlidersHorizontalIcon aria-hidden="true" />
                    {label}
                    {active > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-primary px-1 text-sm leading-none text-primary-foreground tabular-nums">
                            <span className="sr-only">, active: </span>
                            {active}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align={align} className="w-72 p-0">
                <div className="flex max-h-[min(28rem,60vh)] flex-col divide-y overflow-y-auto">
                    {sections.map((section) => (
                        <div key={section.key} className="p-1.5">
                            {section.kind === "options" ? (
                                <OptionsSection section={section} />
                            ) : (
                                <ToggleSection section={section} />
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex items-center justify-between gap-3 border-t px-3 py-2">
                    <span className="text-sm text-muted-foreground tabular-nums">{summary}</span>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={active === 0}
                        onClick={onClear}
                    >
                        Clear
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export { FilterMenu, type FilterMenuOption, type FilterMenuProps, type FilterMenuSection };
