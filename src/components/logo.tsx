import { cn } from "~/lib/utils";

export function LogoMark({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                "logo-mark grid size-7 flex-none place-items-center rounded-[9px] text-sm font-bold text-white",
                className,
            )}
        >
            C
        </span>
    );
}

function Brace({ children }: { children: string }) {
    return (
        <span className="font-display text-2xl leading-none text-primary opacity-[0.55]">
            {children}
        </span>
    );
}

/** Full wordmark: { [C] slop slop }. */
export function Logo({ className }: { className?: string }) {
    return (
        <span className={cn("inline-flex items-center gap-1.5", className)}>
            <Brace>{"{"}</Brace>
            <LogoMark />
            <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight text-foreground pl-0.5">
                slop slop
            </span>
            <Brace>{"}"}</Brace>
        </span>
    );
}
