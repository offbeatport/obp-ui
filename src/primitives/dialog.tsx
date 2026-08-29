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
import { Button } from "./button";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
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
            data-slot="dialog-trigger"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DialogPortal({
    keepMounted,
    forceMount,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Portal>> & {
    forceMount?: boolean;
}) {
    return (
        <DialogPrimitive.Portal
            data-slot="dialog-portal"
            keepMounted={keepMounted ?? forceMount}
            {...props}
        />
    );
}

function DialogClose({
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
            data-slot="dialog-close"
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DialogOverlay({
    className,
    asChild,
    children,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Backdrop>> & {
    asChild?: boolean;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    return (
        <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn(
                "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
                className,
            )}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    asChild,
    forceMount,
    initialFocus,
    finalFocus,
    onOpenAutoFocus,
    onCloseAutoFocus,
    ...props
}: StringClassName<React.ComponentProps<typeof DialogPrimitive.Popup>> & {
    showCloseButton?: boolean;
    asChild?: boolean;
    forceMount?: boolean;
    onOpenAutoFocus?: (event: Event) => void;
    onCloseAutoFocus?: (event: Event) => void;
}) {
    if (asChildVoid(asChild, children)) {
        return null;
    }
    const render = asChildRender(asChild, children);
    const body = (
        <>
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close
                    data-slot="dialog-close"
                    className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                    <XIcon />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            )}
        </>
    );
    return (
        <DialogPortal data-slot="dialog-portal" forceMount={forceMount}>
            <DialogOverlay />
            <DialogPrimitive.Popup
                data-slot="dialog-content"
                className={cn(
                    "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-e2 outline-none transition-[scale,opacity] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:max-w-lg",
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

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="dialog-header"
            className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
            {...props}
        />
    );
}

function DialogFooter({
    className,
    showCloseButton = false,
    children,
    ...props
}: React.ComponentProps<"div"> & {
    showCloseButton?: boolean;
}) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close render={<Button variant="outline">Close</Button>} />
            )}
        </div>
    );
}

function DialogTitle({
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
            data-slot="dialog-title"
            className={cn("text-lg leading-none font-semibold", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

function DialogDescription({
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
            data-slot="dialog-description"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
            {...asChildProps(asChild, children)}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
