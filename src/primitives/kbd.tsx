import type * as React from "react";

import { cn } from "../lib/cn";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
    return (
        <kbd
            data-slot="kbd"
            className={cn(
                "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm border border-border bg-muted px-1 font-mono text-sm leading-none font-normal text-muted-foreground select-none",
                "in-data-[slot=button]:border-current/30 in-data-[slot=button]:bg-transparent in-data-[slot=button]:text-current",
                className,
            )}
            {...props}
        />
    );
}

function KbdHint({
    keys,
    children,
    className,
}: {
    keys: string[];
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            data-slot="kbd-hint"
            className={cn(
                "inline-flex items-center gap-1.5 text-sm text-muted-foreground",
                className,
            )}
        >
            <span className="inline-flex items-center gap-0.5">
                {keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                ))}
            </span>
            {children}
        </span>
    );
}

export { Kbd, KbdHint };
