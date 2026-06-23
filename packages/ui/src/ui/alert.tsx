import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils/cn";

/**
 * Static inline alert / callout. For transient feedback after an action,
 * use `sonner` toasts. Use Alert for persistent notices on the page
 * (banner above content, info inside a form section, error summary, etc.).
 */
const alertVariants = cva(
  "flex gap-3 rounded-md border p-4 text-sm leading-[1.5]",
  {
    variants: {
      variant: {
        info: "border-border-strong bg-field text-fg",
        success: "border-success/30 bg-success/8 text-fg",
        warning: "border-warning/30 bg-warning/8 text-fg",
        danger: "border-danger/30 bg-danger/8 text-fg",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  ),
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("font-medium", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-fg-muted", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";
