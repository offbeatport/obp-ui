"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

// "There is nothing here yet" - one component, three framings the app already draws. Every class
// string is kept as-is, so each variant is pixel-identical to the surface it came from:
//
//   "rail"   the sidebar's no-companies CTA (app-shell CompaniesNav): tight dashed card, 12px
//            copy, a full-width outline button underneath.
//   "panel"  the Portfolio page's dashed panel: centred, max-w-md, roomy 40px padding.
//   "plate"  a tab-sized placeholder (Source Code's "No source yet"): a bordered card that fills
//            the tab and centres an icon + heading + mono line.
//
// The action is a slot: the button/link the caller passes owns its own classes AND its own top
// margin (both originals put `mt-4` on the element itself, not on a wrapper).

export type EmptyStateVariant = "rail" | "panel" | "plate";

const FRAME: Record<EmptyStateVariant, string> = {
    rail: "mx-1 mt-1.5 mb-0.5 rounded-md border-2 border-dashed bg-secondary px-3.5 py-4 text-center",
    panel: "mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center",
    plate: "grid h-[min(560px,64vh)] place-items-center rounded-xl border border-border bg-card",
};

// Only "plate" centres a fixed-width column inside a filling frame; the other two are the column.
const INNER: Record<EmptyStateVariant, string> = {
    rail: "",
    panel: "",
    plate: "text-center",
};

const ICON: Record<EmptyStateVariant, string> = {
    rail: "mx-auto size-6 text-faint",
    panel: "mx-auto size-8 text-faint",
    plate: "mx-auto size-8 text-faint",
};

const TITLE: Record<EmptyStateVariant, string> = {
    rail: "text-sm font-[650] text-foreground",
    // The Portfolio panel ships without a heading today; this matches the plate's scale for
    // callers that want one.
    panel: "font-display text-lg",
    plate: "mt-3 font-display text-lg",
};

const BODY: Record<EmptyStateVariant, string> = {
    rail: "m-2 text-sm leading-[1.45] text-faint",
    panel: "text-sm text-muted-foreground",
    plate: "mt-1 font-mono text-[12px] text-muted-foreground",
};

export type EmptyStateProps = {
    variant?: EmptyStateVariant;
    /** Lucide glyph above the title. The rail variant has none in the app - pass one only if
     *  the surface can afford the height. */
    icon?: LucideIcon;
    title?: ReactNode;
    /** One or two lines of prose. */
    children?: ReactNode;
    /** The CTA - a <Link>/<button> with its own classes and its own `mt-*`. */
    action?: ReactNode;
    className?: string;
    titleClassName?: string;
    bodyClassName?: string;
};

export function EmptyState({
    variant = "panel",
    icon: Icon,
    title,
    children,
    action,
    className,
    titleClassName,
    bodyClassName,
}: EmptyStateProps) {
    // The rail's heading is a plain <div> in the app (it is a label, not a document heading);
    // the others are real headings. Kept per variant so the markup matches the original.
    const Title = variant === "rail" ? "div" : "h3";
    const body = (
        <>
            {Icon && <Icon className={ICON[variant]} />}
            {title !== undefined && <Title className={cn(TITLE[variant], titleClassName)}>{title}</Title>}
            {children !== undefined && <p className={cn(BODY[variant], bodyClassName)}>{children}</p>}
            {action}
        </>
    );
    return (
        <div className={cn(FRAME[variant], className)}>
            {INNER[variant] ? <div className={INNER[variant]}>{body}</div> : body}
        </div>
    );
}
