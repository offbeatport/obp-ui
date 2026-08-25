"use client";

import { cn } from "../lib/cn";

// The tiny bar-chart signal indicator from the opportunity node: a row of labelled meters, each
// a 1px-tall track with a filled lead. The track uses `bg-[color:var(--border-soft)]` (not
// `bg-border-soft`) so it survives inside the forced-dark canvas, where the utility and the raw
// var resolve differently.
//
// `max` normalises the score scale (the lab data is 0-10); width is a runtime percentage, so it
// has to be an inline style rather than an arbitrary utility.

export type Signal = { label: string; val: number };

export type SignalBarsProps = {
    signals: Signal[];
    /** Fill colour (the node's accent). Any CSS colour. */
    color: string;
    /** Top of the value scale. 10 matches the lab's opportunity signals. */
    max?: number;
    /** Grid override, e.g. "mt-2 grid-cols-4" - tailwind-merge resolves the column count. */
    className?: string;
};

export function SignalBars({ signals, color, max = 10, className }: SignalBarsProps) {
    return (
        <div className={cn("grid grid-cols-3 gap-1", className)}>
            {signals.map((s) => (
                <div key={s.label} className="flex flex-col gap-0.5">
                    <div className="h-1 overflow-hidden rounded-full bg-[color:var(--border-soft)]">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${(s.val / max) * 100}%`, background: color }}
                        />
                    </div>
                    <span className="font-mono text-[8.5px] uppercase tracking-wide text-faint">
                        {s.label}
                    </span>
                </div>
            ))}
        </div>
    );
}
