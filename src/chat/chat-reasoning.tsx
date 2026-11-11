"use client";

import { type ReactNode, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../primitives/collapsible";

export type ChatReasoningProps = {
    text: string;
    streaming?: boolean;
    label?: ReactNode;
    summary?: ReactNode;
    className?: string;
};

function wordCount(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function ChatReasoning({
    text,
    streaming = false,
    label = "Reasoning",
    summary,
    className,
}: ChatReasoningProps) {
    const [chosen, setChosen] = useState<boolean | null>(null);
    const open = chosen ?? streaming;
    const words = wordCount(text);
    const after = summary ?? `${words.toLocaleString()} ${words === 1 ? "word" : "words"}`;
    return (
        <Collapsible open={open} onOpenChange={setChosen} className={className}>
            <CollapsibleTrigger className="text-muted-foreground">
                {streaming ? (
                    <>{label}…</>
                ) : (
                    <>
                        {label}
                        <span className="tabular-nums"> · {after}</span>
                    </>
                )}
            </CollapsibleTrigger>
            <CollapsibleContent>
                <p className="mt-2 border-l pl-3 text-base break-words whitespace-pre-wrap text-muted-foreground">
                    {text.trim()}
                </p>
            </CollapsibleContent>
        </Collapsible>
    );
}
