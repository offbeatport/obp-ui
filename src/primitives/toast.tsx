"use client";

import { Toast } from "@base-ui/react/toast";
import {
    CircleCheckIcon,
    CircleXIcon,
    InfoIcon,
    type LucideIcon,
    TriangleAlertIcon,
    XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import { buttonVariants } from "./button";

type ToastTone = "neutral" | "success" | "warning" | "destructive";

const TONE_ICON: Record<ToastTone, { Icon: LucideIcon; className: string }> = {
    neutral: { Icon: InfoIcon, className: "text-muted-foreground" },
    success: { Icon: CircleCheckIcon, className: "text-success" },
    warning: { Icon: TriangleAlertIcon, className: "text-warning" },
    destructive: { Icon: CircleXIcon, className: "text-destructive" },
};

function toneOf(type: string | undefined): ToastTone {
    return type === "success" || type === "warning" || type === "destructive" ? type : "neutral";
}

function ToneIcon({ tone }: { tone: ToastTone }) {
    const { Icon, className } = TONE_ICON[tone];
    return (
        <span aria-hidden="true" className="flex h-[1lh] flex-none items-center">
            <Icon className={cn("size-4", className)} />
        </span>
    );
}

function ToastList() {
    const { toasts } = Toast.useToastManager();
    return toasts.map((toast) => (
        <Toast.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
                "flex w-full items-start gap-2.5 rounded-lg border border-border bg-popover p-3 text-sm text-popover-foreground shadow-e2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "[transform:translate(var(--toast-swipe-movement-x),var(--toast-swipe-movement-y))] data-swiping:select-none data-limited:hidden",
                "transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
            )}
        >
            <ToneIcon tone={toneOf(toast.type)} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Toast.Title className="font-semibold" />
                <Toast.Description className="text-muted-foreground" />
                <Toast.Action
                    className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "mt-2 self-start",
                    })}
                />
            </div>
            <span className="flex h-[1lh] flex-none items-center">
                <Toast.Close
                    aria-label="Dismiss"
                    className="-mr-1 flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <XIcon aria-hidden="true" className="size-4" />
                </Toast.Close>
            </span>
        </Toast.Root>
    ));
}

function ToastProvider({ children, timeout = 5000 }: { children: ReactNode; timeout?: number }) {
    return (
        <Toast.Provider timeout={timeout}>
            {children}
            <Toast.Portal>
                <Toast.Viewport className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col-reverse gap-2 outline-none">
                    <ToastList />
                </Toast.Viewport>
            </Toast.Portal>
        </Toast.Provider>
    );
}

type ToastOptions = {
    title: ReactNode;
    description?: ReactNode;
    tone?: ToastTone;
    timeout?: number;
    action?: { label: ReactNode; onClick: () => void };
};

function useToast() {
    const manager = Toast.useToastManager();
    return ({ title, description, tone = "neutral", timeout, action }: ToastOptions) => {
        const id = manager.add({
            title,
            description,
            type: tone,
            timeout: timeout ?? (tone === "destructive" ? 0 : undefined),
            priority: tone === "destructive" ? "high" : "low",
            actionProps: action && {
                children: action.label,
                onClick: () => {
                    action.onClick();
                    manager.close(id);
                },
            },
        });
        return id;
    };
}

export { ToastProvider, useToast, type ToastOptions, type ToastTone };
