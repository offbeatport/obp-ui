import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Reach for `Card` only when the section is a form, a lifted surface
 * (dialog, pricing tile), or an interactive tile in a grid of peers.
 * Most page sections - lists, summaries, run details - read better
 * as flat composition (typography + whitespace). See `FACTORY.md` §5.2.
 */
const cardVariants = cva("text-fg p-6", {
  variants: {
    variant: {
      flat: "",
      bordered: "rounded-md border border-border",
      shadow: "rounded-md border border-border shadow-card",
    },
  },
  defaultVariants: {
    variant: "bordered",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof cardVariants> { }

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant, className }))} {...props} />
  ),
);
Card.displayName = "Card";

/* Layout helpers - no padding (Card handles outer padding); they add
 * vertical rhythm and typography only. */

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "font-display text-[18px] font-normal leading-tight tracking-[-0.01em]",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-[13px] text-fg-muted", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center mt-4", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { cardVariants };
