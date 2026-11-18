"use client";

import { IconAlertCircle } from "@tabler/icons-react";
import { Fragment, type ReactNode, useId } from "react";
import type { IconComponent } from "../icons";
import { cn } from "../lib/cn";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../primitives/collapsible";
import { CopyButton } from "../primitives/copy-button";

export type ErrorDetail = { label: string; value: string };

export type ErrorTone = "destructive" | "neutral";

export type ErrorPanelVariant = "plate" | "inset";

const TONE: Record<ErrorTone, string> = {
    destructive: "text-destructive",
    neutral: "text-muted-foreground",
};

export function errorDetailsText(details: ErrorDetail[]): string {
    return details.map((detail) => `${detail.label}: ${detail.value}`).join("\n");
}

export function ErrorDetailsList({
    details,
    className,
}: {
    details: ErrorDetail[];
    className?: string;
}) {
    return (
        <div
            data-slot="error-details"
            className={cn(
                "flex w-full min-w-0 items-start gap-2 rounded-md border bg-background py-1 pr-1 pl-3 text-left",
                className,
            )}
        >
            <dl className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] gap-x-4 py-1 text-sm">
                {details.map((detail) => (
                    <Fragment key={detail.label}>
                        <dt className="text-muted-foreground">{detail.label}</dt>
                        <dd className="min-w-0 font-mono break-all text-foreground tabular-nums">
                            {detail.value}
                        </dd>
                    </Fragment>
                ))}
            </dl>
            <CopyButton text={errorDetailsText(details)} label="Copy details" variant="ghost" />
        </div>
    );
}

function DetailsTrigger() {
    return (
        <CollapsibleTrigger className="h-7 text-sm font-normal text-muted-foreground hover:text-foreground">
            Details
        </CollapsibleTrigger>
    );
}

export type ErrorPanelProps = {
    variant?: ErrorPanelVariant;
    tone?: ErrorTone;
    icon?: IconComponent;
    title: ReactNode;
    heading?: "h1" | "h2" | "h3";
    children?: ReactNode;
    actions?: ReactNode;
    details?: ErrorDetail[];
    className?: string;
};

export function ErrorPanel({
    variant = "plate",
    tone = "destructive",
    icon: Icon = IconAlertCircle,
    title,
    heading: Heading = "h2",
    children,
    actions,
    details,
    className,
}: ErrorPanelProps) {
    const titleId = useId();
    const plate = variant === "plate";
    return (
        <section
            aria-labelledby={titleId}
            data-slot="error-panel"
            data-tone={tone}
            className={cn(
                "flex w-full flex-col items-center justify-center p-panel text-center",
                plate ? "min-h-[min(28rem,60vh)] rounded-xl border bg-card" : "h-full min-h-48",
                className,
            )}
        >
            <div className="flex w-full max-w-md flex-col items-center">
                <Icon aria-hidden="true" className={cn("mb-3 size-6", TONE[tone])} />
                <Heading
                    id={titleId}
                    className={cn("font-semibold text-foreground", plate ? "text-lg" : "text-base")}
                >
                    {title}
                </Heading>
                {children && (
                    <p
                        className={cn(
                            "mt-1 break-words text-muted-foreground",
                            plate ? "text-base" : "text-sm",
                        )}
                    >
                        {children}
                    </p>
                )}
                {actions && (
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        {actions}
                    </div>
                )}
                {details && details.length > 0 && (
                    <Collapsible className="mt-4 flex w-full flex-col items-center gap-2">
                        <DetailsTrigger />
                        <CollapsibleContent className="w-full">
                            <ErrorDetailsList details={details} />
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>
        </section>
    );
}

export type InlineErrorProps = {
    tone?: ErrorTone;
    icon?: IconComponent;
    children: ReactNode;
    action?: ReactNode;
    details?: ErrorDetail[];
    className?: string;
};

export function InlineError({
    tone = "destructive",
    icon: Icon = IconAlertCircle,
    children,
    action,
    details,
    className,
}: InlineErrorProps) {
    const shown = details && details.length > 0;
    return (
        <div
            role="alert"
            data-slot="inline-error"
            data-tone={tone}
            className={cn("min-w-0", className)}
        >
            <Collapsible className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p
                    className={cn(
                        "flex min-h-7 min-w-0 items-start gap-2 py-0.5 text-base",
                        tone === "destructive" ? "text-destructive" : "text-foreground",
                    )}
                >
                    <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", TONE[tone])} />
                    <span className="min-w-0 break-words">{children}</span>
                </p>
                {(action || shown) && (
                    <div className="flex items-center gap-2">
                        {action}
                        {shown && <DetailsTrigger />}
                    </div>
                )}
                {shown && (
                    <CollapsibleContent className="basis-full pl-6">
                        <ErrorDetailsList details={details} className="max-w-xl" />
                    </CollapsibleContent>
                )}
            </Collapsible>
        </div>
    );
}
