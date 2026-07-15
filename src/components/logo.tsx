import { cn } from "~/lib/utils";

// The terracotta "C" block. Gradient + a subtle top bevel are inlined here (brand identity, like
// an avatar tint); the outer glow/halo was intentionally dropped.
export function LogoMark({ className }: { className?: string }) {
    return (
        <span
            style={{
                background: "radial-gradient(circle at 32% 28%, #e08458, var(--primary))",
                boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.4)",
            }}
            className={cn(
                "grid size-7 flex-none place-items-center rounded-[9px] text-sm font-bold text-white",
                className,
            )}
        >
            C
        </span>
    );
}

function Brace({ children }: { children: string }) {
    return (
        <span className="font-display text-2xl leading-none text-primary opacity-[0.4]">
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
