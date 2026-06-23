import * as React from "react";
import { cn } from "../utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // Uses `rounded-md` (--r-md, same as cards) instead of `rounded`
          // (--r-sm, same as buttons/inputs) - textareas are tall enough that
          // the buttons-pill radius produces a stadium shape in Pill mode.
          // Sharing the card scale keeps Pill-mode textareas at 24px, sane.
          "flex w-full rounded-md border border-border-strong bg-field text-fg",
          "px-3 py-[10px] text-sm leading-[1.4]",
          "placeholder:text-fg-subtle",
          "min-h-[88px] resize-y",
          "hover:border-fg-muted",
          "focus:outline-none focus:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-hover",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
