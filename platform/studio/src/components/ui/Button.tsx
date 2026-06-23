import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-accent text-[#050d1e] border-0 hover:brightness-110 active:brightness-95",
  outline: "bg-transparent text-fg-subtle border border-border-strong hover:text-fg hover:border-muted active:opacity-80",
  ghost: "bg-transparent text-fg-subtle border-0 hover:text-fg hover:bg-[rgba(255,255,255,0.05)] active:bg-[rgba(255,255,255,0.08)]",
  destructive: "bg-transparent text-[rgba(239,68,68,0.65)] border border-[rgba(239,68,68,0.2)] hover:text-[rgba(239,68,68,1)] hover:border-[rgba(239,68,68,0.5)] active:opacity-80",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-[10px] py-[4px] text-xs h-[28px]",
  md: "px-[14px] py-[6px] text-sm h-[34px]",
  lg: "px-[20px] py-[9px] text-sm h-[40px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "outline",
    size = "md",
    className,
    style,
    children,
    disabled,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center gap-[6px]",
        "font-medium tracking-[0.01em] cursor-pointer",
        "outline-none rounded-[--radius] select-none",
        "font-[inherit]",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        disabled ? "opacity-45 cursor-not-allowed" : "",
        className ?? "",
      ].join(" ")}
      style={style}
    >
      {children}
    </button>
  );
});
