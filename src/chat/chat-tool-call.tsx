"use client";

import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CodeBlock } from "../primitives/code-block";

export type ChatToolCallProps = {
    name: string;
    id?: string;
    args: string;
    result?: string;
    label?: ReactNode;
    children?: ReactNode;
    className?: string;
};

function prettyJson(text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
    try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
        return null;
    }
}

export function ChatToolCall({
    name,
    id,
    args,
    result,
    label = "Calls",
    children,
    className,
}: ChatToolCallProps) {
    const shownArgs = prettyJson(args);
    const shownResult = result === undefined ? null : prettyJson(result);
    return (
        <section
            aria-label={`${typeof label === "string" ? label : "Calls"} ${name}`}
            className={cn("flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3", className)}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                    {label} <span className="font-mono">{name}</span>
                </span>
                {id && <span className="font-mono text-sm text-muted-foreground">{id}</span>}
            </div>
            <CodeBlock
                code={shownArgs ?? args}
                language={shownArgs ? "json" : "text"}
                copyLabel="Copy the arguments"
            />
            {result !== undefined ? (
                <CodeBlock
                    code={shownResult ?? result}
                    language={shownResult ? "json" : "text"}
                    title="Result"
                    copyLabel="Copy the result"
                    wrap
                />
            ) : (
                children
            )}
        </section>
    );
}
