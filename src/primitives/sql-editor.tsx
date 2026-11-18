"use client";

import { Suspense, lazy } from "react";

import {
    type CodeDiagnostic,
    type CodeEditorHandle,
    CodeEditorLoading,
    type CodeEditorProps,
} from "./code-editor-frame";

type SqlColumn = {
    name: string;
    type?: string;
    samples?: readonly string[];
};

type SqlSchema = Readonly<Record<string, readonly (string | SqlColumn)[]>>;

type SqlDiagnostic = CodeDiagnostic;

type SqlEditorHandle = CodeEditorHandle;

type SqlEditorProps = CodeEditorProps & {
    onRun?: (value: string) => void;
    schema?: SqlSchema;
};

const SqlEditorView = lazy(() =>
    import("./sql-editor-view").then((module) => ({ default: module.SqlEditorView })),
);

function SqlEditor(props: SqlEditorProps) {
    return (
        <Suspense
            fallback={<CodeEditorLoading slot="sql-editor" footer={!props.readOnly} {...props} />}
        >
            <SqlEditorView {...props} />
        </Suspense>
    );
}

export {
    SqlEditor,
    type SqlColumn,
    type SqlDiagnostic,
    type SqlEditorHandle,
    type SqlEditorProps,
    type SqlSchema,
};
