import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Shimmering placeholder for loading content. Composes with width / height
 * utilities (`<Skeleton className="w-full h-4" />`). Uses the `.sk` class
 * defined in core's theme.css for the shimmer animation.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("sk", className)} aria-hidden="true" {...props} />
  ),
);
Skeleton.displayName = "Skeleton";
