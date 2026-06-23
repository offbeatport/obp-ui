import { type ReactNode, type CSSProperties } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  width?: number;
  side?: "top" | "bottom";
}

export function Tooltip({ content, children, width = 220, side = "top" }: TooltipProps) {
  if (!content) return <>{children}</>;

  return (
    <span
      className="tooltip-wrapper inline-flex items-center"
      style={{ position: "relative" }}
    >
      {children}
      <span
        className="tooltip-bubble bg-[#0a1530] border border-border-strong text-fg-muted px-3 py-2 text-sm leading-[1.5] whitespace-normal z-[9999] pointer-events-none rounded-[var(--radius)] shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        style={{
          position: "absolute",
          ...(side === "top"
            ? { bottom: "calc(100% + 8px)", top: "auto" }
            : { top: "calc(100% + 8px)", bottom: "auto" }),
          left: 0,
          width,
          opacity: 0,
          transition: "opacity 0.12s",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {content}
      </span>
    </span>
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      className="text-[0.62rem] font-bold tracking-widest uppercase text-fg-subtle"
      style={style}
    >
      {children}
    </span>
  );
}
