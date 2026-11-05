import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { matchRanges } from "../lib/search-text";

type HighlightTextProps = {
    text: string;
    query: string;
    className?: string;
    markClassName?: string;
};

function HighlightText({ text, query, className, markClassName }: HighlightTextProps) {
    const ranges = matchRanges(text, query);
    if (ranges.length === 0) {
        return <span className={className}>{text}</span>;
    }
    const parts: ReactNode[] = [];
    let at = 0;
    for (const [start, end] of ranges) {
        if (start > at) {
            parts.push(text.slice(at, start));
        }
        parts.push(
            <mark
                key={start}
                data-slot="highlight"
                className={cn("rounded-sm bg-accent text-accent-foreground", markClassName)}
            >
                {text.slice(start, end)}
            </mark>,
        );
        at = end;
    }
    if (at < text.length) {
        parts.push(text.slice(at));
    }
    return <span className={className}>{parts}</span>;
}

export { HighlightText, type HighlightTextProps };
