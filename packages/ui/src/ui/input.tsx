import * as React from "react";
import { cn } from "../utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex w-full rounded border border-border-strong bg-field text-fg",
          "px-3 py-[10px] text-sm leading-[1.4]",
          "placeholder:text-fg-subtle",
          "hover:border-fg-muted",
          "focus:outline-none focus:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-hover",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_rgb(var(--field))]",
          "[&:-webkit-autofill]:[-webkit-text-fill-color:rgb(var(--fg))]",
          "[&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_rgb(var(--field))]",
          "[&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_rgb(var(--field))]",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
