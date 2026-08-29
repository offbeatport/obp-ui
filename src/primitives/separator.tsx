"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type * as React from "react";

import { type StringClassName, asChildProps, asChildVoid } from "../lib/base-ui-compat";
import { cn } from "../lib/cn";

function Separator({
    className,
    orientation = "horizontal",
    decorative = true,
    asChild = false,
    children,
    ...props
}: StringClassName<Omit<React.ComponentProps<typeof SeparatorPrimitive>, "render">> & {
    decorative?: boolean;
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }

    const semanticProps: Pick<React.ComponentProps<"div">, "role" | "aria-orientation"> = decorative
        ? { role: "none", "aria-orientation": undefined }
        : {
              role: "separator",
              "aria-orientation": orientation === "vertical" ? "vertical" : undefined,
          };

    return (
        <SeparatorPrimitive
            data-slot="separator"
            orientation={orientation}
            {...semanticProps}
            className={cn(
                "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

export { Separator };
