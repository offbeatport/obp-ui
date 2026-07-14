import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { SliceState, Tone } from "~/server/data";
import "./proto.css";
import { SLICE, TONE, initial } from "./tone";

// Section header — mono kicker · hairline rule · optional count. (.dash1 .sec-head)
export function SecHead({ label, count }: { label: string; count?: number }) {
    return (
        <div className="mx-auto flex w-full items-center gap-2.5">
            <span className="flex-none font-mono text-[11.5px] uppercase tracking-[0.07em] text-faint">
                {label}
            </span>
            <span className="h-px flex-1 bg-border-soft" />
            {count !== undefined && (
                <span className="font-mono text-[11px] text-faint">{count}</span>
            )}
        </div>
    );
}

// Slice-state pill (.dash1 .sbadge).
export function Sbadge({ state }: { state: SliceState }) {
    const { tone, label } = SLICE[state];
    const t = TONE[tone];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] px-[7px] py-0.5 font-mono text-[9.5px] font-medium uppercase tracking-[0.05em]",
                t.soft,
                t.text,
            )}
        >
            <span className={cn("size-[5px] rounded-full", t.solid)} />
            {label}
        </span>
    );
}

// Tinted letter avatar (.ctile-av / .hero-co .av).
export function Avatar({
    name,
    tone,
    className,
}: { name: string; tone: Tone; className?: string }) {
    return (
        <span
            className={cn(
                "grid flex-none place-items-center font-bold text-white",
                TONE[tone].solid,
                className ?? "size-[30px] rounded-[9px] text-[13px]",
            )}
        >
            {initial(name)}
        </span>
    );
}

// Right-pointing arrow used on moves / links.
export function ArrowIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 18 18" fill="none" className={className} aria-hidden="true">
            <path
                d="M4 9h10M10 4.5L14.5 9 10 13.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// Small check glyph (doneWhen passed / approve).
export function CheckIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
            <path
                d="M3 8.5l3 3 7-7.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// External-link glyph.
export function ExternalIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
            <path
                d="M6 2.5H3.5A1.5 1.5 0 002 4v8.5A1.5 1.5 0 003.5 14H12a1.5 1.5 0 001.5-1.5V10M10 2h4v4M13.5 2.5L7 9"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

// Editorial page wrapper — the ~980px scroll column the prototype's dash/streams live in.
export function Column({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cn("mx-auto w-full max-w-[980px] px-6 py-9", className)}>{children}</div>
    );
}
