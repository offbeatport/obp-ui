"use client";

import { Check, Copy } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { Button } from "./button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

type CodeLanguage =
    | "bash"
    | "python"
    | "javascript"
    | "typescript"
    | "json"
    | "yaml"
    | "sql"
    | "text";

type CodeToken = { text: string; className: string };

type CodeBlockProps = {
    code: string;
    language?: CodeLanguage;
    title?: ReactNode;
    copy?: boolean;
    copyLabel?: string;
    wrap?: boolean;
    className?: string;
};

type CodeTab = {
    id: string;
    label: string;
    code: string;
    language: CodeLanguage;
    title?: ReactNode;
};

type CodeTabsProps = {
    items: readonly CodeTab[];
    title?: ReactNode;
    defaultValue?: string;
    wrap?: boolean;
    className?: string;
    blockClassName?: string;
};

type CopyState = "idle" | "copied" | "manual";

const ALIASES: Record<string, CodeLanguage> = {
    bash: "bash",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    console: "bash",
    curl: "bash",
    env: "bash",
    dotenv: "bash",
    python: "python",
    py: "python",
    javascript: "javascript",
    js: "javascript",
    mjs: "javascript",
    typescript: "typescript",
    ts: "typescript",
    json: "json",
    jsonc: "json",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
};

const RESET_AFTER: Record<Exclude<CopyState, "idle">, number> = { copied: 1500, manual: 4000 };

const highlighters = new Map<CodeLanguage, (code: string) => CodeToken[]>();

const loads = new Map<CodeLanguage, Promise<void>>();

function codeLanguage(name: string | null | undefined): CodeLanguage {
    return ALIASES[(name ?? "").trim().toLowerCase()] ?? "text";
}

function loadLanguage(language: Exclude<CodeLanguage, "text">): Promise<void> {
    const known = loads.get(language);
    if (known) return known;
    const next = import("./code-block-highlight")
        .then((module) => module.loadHighlight(language))
        .then((highlight) => {
            highlighters.set(language, highlight);
        })
        .catch(() => {
            loads.delete(language);
        });
    loads.set(language, next);
    return next;
}

function useHighlight(code: string, language: CodeLanguage) {
    const [, setLoaded] = useState(0);
    const highlight = highlighters.get(language);
    useEffect(() => {
        if (highlight || language === "text") return;
        let live = true;
        loadLanguage(language).then(() => {
            if (live) setLoaded((count) => count + 1);
        });
        return () => {
            live = false;
        };
    }, [highlight, language]);
    return useMemo(() => highlight?.(code), [highlight, code]);
}

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

function useCopy(code: string, target: RefObject<HTMLElement | null>) {
    const [state, setState] = useState<CopyState>("idle");
    useEffect(() => {
        if (state === "idle") return;
        const timer = window.setTimeout(() => setState("idle"), RESET_AFTER[state]);
        return () => window.clearTimeout(timer);
    }, [state]);
    const fallback = () => setState(copyBySelection(target.current) ? "copied" : "manual");
    const copy = () => {
        if (!navigator.clipboard) {
            fallback();
            return;
        }
        navigator.clipboard.writeText(code).then(() => setState("copied"), fallback);
    };
    return { state, copy };
}

function copyText(state: CopyState) {
    if (state === "copied") return "Copied";
    if (state === "manual") return `Press ${copyShortcut()}`;
    return "Copy";
}

function CopyAction({
    state,
    label,
    inline,
    onCopy,
}: {
    state: CopyState;
    label: string;
    inline: boolean;
    onCopy: () => void;
}) {
    const icon = state === "copied" ? <Check /> : <Copy />;
    const text = copyText(state);
    const named = state === "idle" ? label : text;
    const status = (
        <span aria-live="polite" className="sr-only">
            {state === "idle" ? "" : text}
        </span>
    );
    if (inline) {
        return (
            <>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={named}
                    onClick={onCopy}
                >
                    {icon}
                    {text}
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
                        variant="outline"
                        size="icon-sm"
                        aria-label={named}
                        onClick={onCopy}
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

function CodeText({ code, tokens }: { code: string; tokens: CodeToken[] | undefined }) {
    if (!tokens) return code;
    let at = 0;
    return tokens.map((token) => {
        const key = at;
        at += token.text.length;
        return token.className ? (
            <span key={key} className={token.className}>
                {token.text}
            </span>
        ) : (
            token.text
        );
    });
}

function CodeBlock({
    code,
    language = "text",
    title,
    copy = true,
    copyLabel = "Copy",
    wrap = false,
    className,
}: CodeBlockProps) {
    const pre = useRef<HTMLPreElement>(null);
    const tokens = useHighlight(code, language);
    const copier = useCopy(code, pre);
    const header = title != null;
    return (
        <figure
            data-slot="code-block"
            data-language={language}
            className={cn(
                "relative flex min-w-0 flex-col rounded-md border border-border bg-muted text-foreground",
                className,
            )}
        >
            {header && (
                <figcaption className="flex min-h-9 items-center justify-between gap-3 border-b border-border py-1 pr-1 pl-3">
                    <span className="min-w-0 truncate text-sm text-muted-foreground">{title}</span>
                    {copy && (
                        <CopyAction
                            state={copier.state}
                            label={copyLabel}
                            inline
                            onCopy={copier.copy}
                        />
                    )}
                </figcaption>
            )}
            <pre
                ref={pre}
                className={cn(
                    "min-h-0 overflow-auto p-3 font-mono text-base",
                    wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
                    copy && !header && "pr-12",
                )}
            >
                <code>
                    <CodeText code={code} tokens={tokens} />
                </code>
            </pre>
            {copy && !header && (
                <div className="absolute top-1.5 right-1.5">
                    <CopyAction
                        state={copier.state}
                        label={copyLabel}
                        inline={false}
                        onCopy={copier.copy}
                    />
                </div>
            )}
        </figure>
    );
}

function CodeTabs({ items, title, defaultValue, wrap, className, blockClassName }: CodeTabsProps) {
    return (
        <Tabs
            data-slot="code-tabs"
            defaultValue={defaultValue ?? items[0]?.id}
            className={cn("min-w-0 gap-1", className)}
        >
            <div className="overflow-x-auto pb-1">
                <TabsList variant="line">
                    {items.map((item) => (
                        <TabsTrigger key={item.id} value={item.id}>
                            {item.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            {items.map((item) => (
                <TabsContent key={item.id} value={item.id} className="min-w-0">
                    <CodeBlock
                        code={item.code}
                        language={item.language}
                        title={item.title ?? title}
                        copyLabel={`Copy ${item.label}`}
                        wrap={wrap}
                        className={blockClassName}
                    />
                </TabsContent>
            ))}
        </Tabs>
    );
}

export {
    CodeBlock,
    type CodeBlockProps,
    type CodeLanguage,
    type CodeTab,
    CodeTabs,
    type CodeTabsProps,
    type CodeToken,
    codeLanguage,
};
