import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

/**
 * Static status pill - distinct from `Alert` (which is a banner) and from
 * `sonner` toasts (transient). Use Badge for inline labels: "Active",
 * "Beta", "Pro", "Deprecated", etc.
 */
const badgeVariants = cva(
  "inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] uppercase tracking-[0.08em] font-medium border",
  {
    variants: {
      variant: {
        default: "bg-hover text-fg-muted border-border",
        primary: "bg-primary/12 text-primary border-primary/30",
        success: "bg-success/12 text-success border-success/30",
        warning: "bg-warning/12 text-warning border-warning/30",
        danger: "bg-danger/12 text-danger border-danger/30",
        outline: "bg-transparent text-fg-muted border-border-strong",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> { }

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
