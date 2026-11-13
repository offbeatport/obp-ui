"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

type InfoTipProps = {
    label: string;
    children: ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    className?: string;
};

function InfoTip({ label, children, side = "top", align = "center", className }: InfoTipProps) {
    return (
        <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger
                data-slot="info-tip"
                openOnHover
                delay={100}
                aria-label={label}
                className={cn(
                    "inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-popup-open:text-foreground",
                    className,
                )}
            >
                <InfoIcon aria-hidden="true" className="size-3.5" />
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Positioner
                    className="z-50"
                    side={side}
                    align={align}
                    sideOffset={6}
                    collisionPadding={8}
                >
                    <PopoverPrimitive.Popup
                        data-slot="info-tip-content"
                        initialFocus={false}
                        className="relative w-fit max-w-72 rounded-md border border-tooltip-border bg-tooltip px-2 py-1 text-sm text-balance text-tooltip-foreground outline-none transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
                    >
                        {children}
                        <PopoverPrimitive.Arrow className="z-50 size-2.5 rotate-45 rounded-[2px] border-tooltip-border bg-tooltip data-[side=bottom]:top-[-4px] data-[side=bottom]:border-t data-[side=bottom]:border-l data-[side=left]:right-[-4px] data-[side=left]:border-t data-[side=left]:border-r data-[side=right]:left-[-4px] data-[side=right]:border-b data-[side=right]:border-l data-[side=top]:bottom-[-4px] data-[side=top]:border-r data-[side=top]:border-b" />
                    </PopoverPrimitive.Popup>
                </PopoverPrimitive.Positioner>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
}

export { InfoTip };
