import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Card({ children, style, className }: CardProps) {
  return (
    <div
      className={["bg-bg-elevated border border-border rounded-[var(--radius)]", className ?? ""].join(" ")}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="px-4 py-3 border-b border-border flex items-center gap-2"
      style={style}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="px-4 py-[14px]" style={style}>
      {children}
    </div>
  );
}
