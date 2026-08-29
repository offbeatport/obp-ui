"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateVariant = "rail" | "panel" | "plate";

const FRAME: Record<EmptyStateVariant, string> = {
    rail: "mx-1 mt-1.5 mb-0.5 rounded-md border-2 border-dashed bg-secondary px-3.5 py-4 text-center",
    panel: "mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-secondary/40 p-10 text-center",
    plate: "grid h-[min(560px,64vh)] place-items-center rounded-xl border border-border bg-card",
};

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
    panel: "font-display text-lg",
    plate: "mt-3 font-display text-lg",
};

const BODY: Record<EmptyStateVariant, string> = {
    rail: "m-2 text-sm leading-[1.45] text-faint",
    panel: "text-sm text-muted-foreground",
    plate: "mt-1 font-mono text-sm text-muted-foreground",
};

export type EmptyStateProps = {
    variant?: EmptyStateVariant;
    icon?: LucideIcon;
    title?: ReactNode;
    children?: ReactNode;
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
    const Title = variant === "rail" ? "div" : "h3";
    const body = (
        <>
            {Icon && <Icon className={ICON[variant]} />}
            {title !== undefined && (
                <Title className={cn(TITLE[variant], titleClassName)}>{title}</Title>
            )}
            {children !== undefined && (
                <p className={cn(BODY[variant], bodyClassName)}>{children}</p>
            )}
            {action}
        </>
    );
    return (
        <div className={cn(FRAME[variant], className)}>
            {INNER[variant] ? <div className={INNER[variant]}>{body}</div> : body}
        </div>
    );
}
