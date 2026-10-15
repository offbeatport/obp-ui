"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type EmptyStateVariant = "rail" | "panel" | "plate";

const FRAME: Record<EmptyStateVariant, string> = {
    rail: "mx-1 mt-1.5 mb-0.5 rounded-md border border-dashed px-3 py-3 text-center",
    panel: "mx-auto mt-6 max-w-md rounded-lg border border-dashed border-border p-6 text-center",
    plate: "grid h-[min(560px,64vh)] place-items-center rounded-xl border border-border bg-card",
};

const INNER: Record<EmptyStateVariant, string> = {
    rail: "",
    panel: "",
    plate: "text-center",
};

const ICON: Record<EmptyStateVariant, string> = {
    rail: "mx-auto mb-1 size-4 text-faint",
    panel: "mx-auto mb-2 size-5 text-faint",
    plate: "mx-auto mb-2 size-5 text-faint",
};

const TITLE: Record<EmptyStateVariant, string> = {
    rail: "text-sm font-semibold text-foreground",
    panel: "text-base font-semibold",
    plate: "text-base font-semibold",
};

const BODY: Record<EmptyStateVariant, string> = {
    rail: "mt-1 text-sm text-muted-foreground",
    panel: "mt-1 text-sm text-muted-foreground",
    plate: "mt-1 text-sm text-muted-foreground",
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
