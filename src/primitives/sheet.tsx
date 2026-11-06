"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import {
    type StringClassName,
    asChildProps,
    asChildRender,
    asChildVoid,
    autoFocusFor,
} from "../lib/base-ui-compat";
import { cn } from "../lib/cn";
import { DialogOverlay, DialogPortal } from "./dialog";

function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
    asChild,
    children,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Trigger>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DialogPrimitive.Trigger
            data-slot="sheet-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function SheetClose({
    asChild,
    children,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Close>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DialogPrimitive.Close
            data-slot="sheet-close"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

type SheetContentProps = StringClassName<React.ComponentProps<typeof DialogPrimitive.Popup>> & {
    side?: "right" | "left";
    showCloseButton?: boolean;
    asChild?: boolean;
    forceMount?: boolean;
    onOpenAutoFocus?: (event: Event) => void;
    onCloseAutoFocus?: (event: Event) => void;
};

function SheetContent({
    className,
    children,
    side = "right",
    showCloseButton = true,
    asChild,
    forceMount,
    initialFocus,
    finalFocus,
    onOpenAutoFocus,
    onCloseAutoFocus,
    ...props
}: SheetContentProps) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const render = asChildRender(asChild, children);
    const body = (
        <>
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close
                    data-slot="sheet-close"
                    className="absolute top-5 right-4 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                    <XIcon />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            )}
        </>
    );
    return (
        <DialogPortal data-slot="sheet-portal" forceMount={forceMount}>
            <DialogOverlay data-slot="sheet-overlay" />
            <DialogPrimitive.Popup
                data-slot="sheet-content"
                data-side={side}
                className={cn(
                    "fixed inset-y-0 z-50 flex h-full w-full flex-col gap-6 overflow-y-auto overscroll-contain bg-card p-panel text-base shadow-e2 outline-none sm:max-w-sm",
                    "transition-opacity duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
                    "data-[side=left]:left-0 data-[side=left]:border-r data-[side=right]:right-0 data-[side=right]:border-l",
                    className,
                )}
                initialFocus={
                    initialFocus ?? autoFocusFor(onOpenAutoFocus, "focusScope.autoFocusOnMount")
                }
                finalFocus={
                    finalFocus ?? autoFocusFor(onCloseAutoFocus, "focusScope.autoFocusOnUnmount")
                }
                {...props}
                {...(render ? { render } : { children: body })}
            />
        </DialogPortal>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="sheet-header"
            className={cn("flex flex-col gap-2 pr-8 text-left", className)}
            {...props}
        />
    );
}

function SheetTitle({
    className,
    asChild,
    children,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Title>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DialogPrimitive.Title
            data-slot="sheet-title"
            className={cn("text-lg font-semibold", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function SheetDescription({
    className,
    asChild,
    children,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Description>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DialogPrimitive.Description
            data-slot="sheet-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

export {
    Sheet,
    SheetClose,
    SheetContent,
    type SheetContentProps,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
};
