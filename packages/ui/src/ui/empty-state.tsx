import * as React from "react";
import { cn } from "../utils/cn";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Icon (typically a lucide-react icon, ~32px). */
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary CTA, usually a `<Button>`. */
  action?: React.ReactNode;
  /** Secondary CTA, e.g. a "Learn more" link. */
  secondaryAction?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, secondaryAction, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        "border border-dashed border-border rounded-md",
        className,
      )}
      {...props}
    >
      {icon && <div className="mb-4 text-fg-muted [&_svg]:w-8 [&_svg]:h-8">{icon}</div>}
      <h3 className="mb-2 max-w-sm">{title}</h3>
      {description && (
        <p className="text-fg-muted text-[14px] leading-[1.6] max-w-md mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap gap-3 items-center justify-center">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
