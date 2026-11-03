"use client";

import { Toast } from "@base-ui/react/toast";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/cn";

type ToastTone = "neutral" | "success" | "warning" | "destructive";

const TONE_EDGE: Record<ToastTone, string> = {
    neutral: "border-l-border",
    success: "border-l-success",
    warning: "border-l-warning",
    destructive: "border-l-destructive",
};

function toneOf(type: string | undefined): ToastTone {
    return type === "success" || type === "warning" || type === "destructive" ? type : "neutral";
}

function ToastList() {
    const { toasts } = Toast.useToastManager();
    return toasts.map((toast) => (
        <Toast.Root
            key={toast.id}
            toast={toast}
            data-slot="toast"
            className={cn(
                "relative flex w-full items-start gap-3 rounded-lg border border-l-4 bg-popover py-3 pr-10 pl-4 text-sm text-popover-foreground shadow-e2 outline-none",
                "transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
                TONE_EDGE[toneOf(toast.type)],
            )}
        >
            <span className="flex min-w-0 flex-col gap-0.5">
                <Toast.Title className="font-semibold" />
                <Toast.Description className="text-muted-foreground" />
            </span>
            <Toast.Close
                aria-label="Dismiss"
                className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                <XIcon aria-hidden="true" className="size-4" />
            </Toast.Close>
        </Toast.Root>
    ));
}

function ToastProvider({ children, timeout = 5000 }: { children: ReactNode; timeout?: number }) {
    return (
        <Toast.Provider timeout={timeout}>
            {children}
            <Toast.Portal>
                <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100%-2rem))] flex-col gap-2 outline-none">
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
};

function useToast() {
    const manager = Toast.useToastManager();
    return ({ title, description, tone = "neutral", timeout }: ToastOptions) =>
        manager.add({ title, description, type: tone, timeout });
}

export { ToastProvider, useToast, type ToastOptions, type ToastTone };
