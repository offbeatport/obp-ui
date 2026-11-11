"use client";

import { Check, Copy } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type CopyState = "idle" | "copied" | "manual";

type CopyButtonProps = {
    text: string;
    label?: string;
    target?: RefObject<HTMLElement | null>;
    withText?: boolean;
    variant?: "outline" | "ghost";
    size?: "sm" | "icon-sm" | "icon";
    className?: string;
};

const RESET_AFTER: Record<Exclude<CopyState, "idle">, number> = { copied: 1500, manual: 4000 };

function copyShortcut() {
    return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘C" : "Ctrl+C";
}

function copyBySelection(node: HTMLElement | null) {
    const selection = window.getSelection();
    if (!node || !selection) return false;
    selection.selectAllChildren(node);
    const copied = document.execCommand("copy");
    if (copied) selection.removeAllRanges();
    return copied;
}

function copyByScratch(text: string) {
    const scratch = document.createElement("textarea");
    scratch.value = text;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    const copied = document.execCommand("copy");
    scratch.remove();
    return copied;
}

function useCopy(text: string, target?: RefObject<HTMLElement | null>) {
    const [state, setState] = useState<CopyState>("idle");
    useEffect(() => {
        if (state === "idle") return;
        const timer = window.setTimeout(() => setState("idle"), RESET_AFTER[state]);
        return () => window.clearTimeout(timer);
    }, [state]);
    const fallback = () => {
        const copied = target ? copyBySelection(target.current) : copyByScratch(text);
        setState(copied ? "copied" : "manual");
    };
    const copy = () => {
        if (!navigator.clipboard) {
            fallback();
            return;
        }
        navigator.clipboard.writeText(text).then(() => setState("copied"), fallback);
    };
    return { state, copy };
}

function copyText(state: CopyState) {
    if (state === "copied") return "Copied";
    if (state === "manual") return `Press ${copyShortcut()}`;
    return "Copy";
}

function CopyButton({
    text,
    label = "Copy",
    target,
    withText = false,
    variant = "outline",
    size,
    className,
}: CopyButtonProps) {
    const { state, copy } = useCopy(text, target);
    const icon = state === "copied" ? <Check /> : <Copy />;
    const shown = copyText(state);
    const named = state === "idle" ? label : shown;
    const status = (
        <span aria-live="polite" className="sr-only">
            {state === "idle" ? "" : shown}
        </span>
    );
    if (withText) {
        return (
            <>
                <Button
                    type="button"
                    variant={variant}
                    size={size ?? "sm"}
                    aria-label={named}
                    onClick={copy}
                    className={className}
                >
                    {icon}
                    {shown}
                </Button>
                {status}
            </>
        );
    }
    return (
        <>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant={variant}
                        size={size ?? "icon-sm"}
                        aria-label={named}
                        onClick={copy}
                        className={className}
                    >
                        {icon}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{named}</TooltipContent>
            </Tooltip>
            {status}
        </>
    );
}

export { CopyButton, type CopyButtonProps };
