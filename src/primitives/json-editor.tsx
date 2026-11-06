"use client";

import { Suspense, lazy } from "react";

import {
    type CodeDiagnostic,
    type CodeEditorHandle,
    CodeEditorLoading,
    type CodeEditorProps,
} from "./code-editor-frame";

type JsonDiagnostic = CodeDiagnostic;

type JsonEditorHandle = CodeEditorHandle;

type JsonEditorProps = CodeEditorProps;

const JsonEditorView = lazy(() =>
    import("./json-editor-view").then((module) => ({ default: module.JsonEditorView })),
);

function JsonEditor(props: JsonEditorProps) {
    return (
        <Suspense fallback={<CodeEditorLoading slot="json-editor" {...props} />}>
            <JsonEditorView {...props} />
        </Suspense>
    );
}

export { JsonEditor, type JsonDiagnostic, type JsonEditorHandle, type JsonEditorProps };
