import { cn } from "~/lib/utils";

// "Glow C" wordmark — V7 from design/v2-prototypes/logo-explorations.html.
//   { [C] slop slop } — glowing terracotta C block, bolder braces.
// The mark maps the prototype's --accent to our --primary (terracotta); the glow is the
// literal brand-terracotta shadow, theme-independent (reads on any surface).
const BLOCK_STYLE: React.CSSProperties = {
  background: "radial-gradient(circle at 32% 28%, #e08458, var(--primary))",
  boxShadow:
    "0 0 0 4px rgba(200,100,60,0.13), 0 4px 16px rgba(200,100,60,0.5), inset 0 1px 1px rgba(255,255,255,0.4)",
};

/** Just the glowing C block (collapsed rail, favicon-scale, on-dark lockups). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-7 flex-none place-items-center rounded-[9px] text-sm font-bold text-white",
        className,
      )}
      style={BLOCK_STYLE}
    >
      C
    </span>
  );
}

function Brace({ children }: { children: string }) {
  return (
    <span className="font-display text-2xl font-medium leading-none text-primary opacity-[0.55]">
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
      <span className="whitespace-nowrap text-[17px] font-semibold tracking-tight text-foreground">
        slop slop
      </span>
      <Brace>{"}"}</Brace>
    </span>
  );
}
