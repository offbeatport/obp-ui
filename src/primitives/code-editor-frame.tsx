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
};

type CodeEditorProps = {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    diagnostics?: readonly CodeDiagnostic[];
    readOnly?: boolean;
    minLines?: number;
    maxLines?: number;
    placeholder?: string;
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

function editorFrame(className?: string) {
    return cn(
        "flex w-full min-w-0 flex-col rounded-md border border-input bg-input-background font-mono text-lg text-foreground md:text-sm",
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

function CodeEditorLoading({ slot, ...props }: CodeEditorProps & { slot: string }) {
    return (
        <div
            data-slot={slot}
            aria-busy="true"
            className={editorFrame(props.className)}
            style={{ height: `calc(${linesHeight(shownLines(props))} + 2px)` }}
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
    linesHeight,
};
