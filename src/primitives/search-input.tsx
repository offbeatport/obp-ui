import { Search, X } from "lucide-react";
import type * as React from "react";

import { cn } from "../lib/cn";
import { Input } from "./input";

type SearchInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
    value: string;
    onValueChange: (value: string) => void;
    inputClassName?: string;
};

function SearchInput({
    value,
    onValueChange,
    className,
    inputClassName,
    onKeyDown,
    ...props
}: SearchInputProps) {
    return (
        <div data-slot="search-input" className={cn("relative", className)}>
            <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
                type="search"
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Escape" && value) {
                        event.preventDefault();
                        onValueChange("");
                    }
                    onKeyDown?.(event);
                }}
                className={cn(
                    "pr-8 pl-8 [&::-webkit-search-cancel-button]:appearance-none",
                    inputClassName,
                )}
                {...props}
            />
            {value && (
                <button
                    type="button"
                    aria-label="Clear search"
                    title="Clear search"
                    onClick={() => onValueChange("")}
                    className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <X className="size-3.5" />
                </button>
            )}
        </div>
    );
}

export { SearchInput, type SearchInputProps };
