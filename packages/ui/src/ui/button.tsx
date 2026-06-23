import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded font-medium leading-none",
    "border border-transparent",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
    "disabled:opacity-40 disabled:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg border-primary hover:brightness-110",
        secondary: "bg-transparent text-fg border-border-strong hover:bg-hover",
        ghost: "bg-transparent text-fg hover:bg-hover",
        danger: "bg-transparent text-danger border-border-strong hover:bg-hover",
        link: "bg-transparent text-primary p-0 h-auto underline-offset-4 hover:underline",
      },
      size: {
        sm: "px-3 py-[7px] text-[13px]",
        md: "px-4 py-[10px] text-sm",
        lg: "px-5 py-[13px] text-[15px]",
        icon: "h-[34px] w-[34px] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
