"use client";

import { type Ref, Suspense, lazy } from "react";

import { SQL_EDITOR_LINES, linesHeight, sqlEditorFrame } from "./sql-editor-frame";

type SqlSchema = Readonly<Record<string, readonly string[]>>;

type SqlDiagnostic = {
    line: number;
    column: number;
    message: string;
    length?: number;
    severity?: "error" | "warning" | "info";
};

type SqlEditorHandle = {
    focus: () => void;
    insert: (text: string) => void;
};

type SqlEditorProps = {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    onRun?: (value: string) => void;
    schema?: SqlSchema;
    diagnostics?: readonly SqlDiagnostic[];
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
    ref?: Ref<SqlEditorHandle>;
};

const SqlEditorView = lazy(() =>
    import("./sql-editor-view").then((module) => ({ default: module.SqlEditorView })),
);

function shownLines({ value, defaultValue, minLines, maxLines }: SqlEditorProps) {
    const lines = (value ?? defaultValue ?? "").split("\n").length;
    const min = minLines ?? SQL_EDITOR_LINES.min;
    return Math.min(Math.max(lines, min), Math.max(min, maxLines ?? SQL_EDITOR_LINES.max));
}

function SqlEditorLoading(props: SqlEditorProps) {
    return (
        <div
            data-slot="sql-editor"
            aria-busy="true"
            className={sqlEditorFrame(props.className)}
            style={{ height: `calc(${linesHeight(shownLines(props))} + 2px)` }}
        />
    );
}

function SqlEditor(props: SqlEditorProps) {
    return (
        <Suspense fallback={<SqlEditorLoading {...props} />}>
            <SqlEditorView {...props} />
        </Suspense>
    );
}

export { SqlEditor, type SqlDiagnostic, type SqlEditorHandle, type SqlEditorProps, type SqlSchema };
