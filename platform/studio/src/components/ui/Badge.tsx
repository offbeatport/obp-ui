import type { CSSProperties, ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "muted";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  default: "text-fg-muted bg-[rgba(165,182,214,0.08)] border border-border",
  accent:  "text-accent bg-[rgba(96,165,250,0.08)] border border-[rgba(96,165,250,0.2)]",
  success: "text-[#4ade80] bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.2)]",
  warning: "text-warning bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)]",
  danger:  "text-[rgba(239,68,68,0.8)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)]",
  muted:   "text-fg-subtle bg-transparent border border-border",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  style?: CSSProperties;
}

export function Badge({ variant = "default", children, style }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-[2px]",
        "rounded text-[0.70rem] font-semibold tracking-widest uppercase leading-[1.4]",
        VARIANT_CLASS[variant],
      ].join(" ")}
      style={style}
    >
      {children}
    </span>
  );
}

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}
