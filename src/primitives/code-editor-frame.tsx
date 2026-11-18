import type { Ref } from "react";

import { cn } from "../lib/cn";

type CodeDiagnostic = {
    line: number;
    column: number;
    message: string;
    length?: number;
    severity?: "error" | "warning" | "info";
};

type CodeEditorHandle = {
    focus: () => void;
    insert: (text: string) => void;
    replace: (text: string, options?: { format?: boolean }) => Promise<string>;
    format: () => void;
};

type CodeEditorProps = {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    diagnostics?: readonly CodeDiagnostic[];
    readOnly?: boolean;
    minLines?: number;
    maxLines?: number;
    fill?: boolean;
    placeholder?: string;
    starter?: string;
    id?: string;
    className?: string;
    "aria-label"?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    ref?: Ref<CodeEditorHandle>;
};

const CONTENT_PADDING = "0.75rem";

const EDITOR_LINES = { min: 3, max: 16 };

const FOOTER_HEIGHT = "2rem";

function editorFrame(className?: string, fill = false) {
    return cn(
        "flex w-full min-w-0 flex-col rounded-md border border-input bg-input-background font-mono text-lg text-foreground md:text-base",
        fill && "h-full min-h-0 flex-1",
        "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        "data-invalid:border-destructive data-invalid:ring-destructive",
        className,
    );
}

function linesHeight(lines: number) {
    return `calc(${lines}lh + ${CONTENT_PADDING})`;
}

function shownLines({ value, defaultValue, minLines, maxLines }: CodeEditorProps) {
    const lines = (value ?? defaultValue ?? "").split("\n").length;
    const min = minLines ?? EDITOR_LINES.min;
    return Math.min(Math.max(lines, min), Math.max(min, maxLines ?? EDITOR_LINES.max));
}

function CodeEditorLoading({
    slot,
    footer = false,
    ...props
}: CodeEditorProps & { slot: string; footer?: boolean }) {
    const extra = footer ? ` + ${FOOTER_HEIGHT} + 1px` : "";
    return (
        <div
            data-slot={slot}
            aria-busy="true"
            className={editorFrame(props.className, props.fill)}
            style={
                props.fill
                    ? undefined
                    : { height: `calc(${linesHeight(shownLines(props))} + 2px${extra})` }
            }
        />
    );
}

export {
    CONTENT_PADDING,
    type CodeDiagnostic,
    CodeEditorLoading,
    type CodeEditorHandle,
    type CodeEditorProps,
    EDITOR_LINES,
    editorFrame,
    FOOTER_HEIGHT,
    linesHeight,
};
