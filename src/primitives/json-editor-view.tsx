"use client";

import { json, jsonParseLinter } from "@codemirror/lang-json";
import { indentOnInput } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { CodeEditorView } from "./code-editor-view";
import type { JsonEditorProps } from "./json-editor";

const parseLint = jsonParseLinter();

const support = json();

const quietBrackets = EditorView.theme({
    "&:not(.cm-focused) .cm-matchingBracket": { backgroundColor: "transparent" },
});

const extensions: Extension = [
    indentOnInput(),
    quietBrackets,
    linter((view) => (view.state.doc.toString().trim() ? parseLint(view) : [])),
];

function JsonEditorView(props: JsonEditorProps) {
    return (
        <CodeEditorView
            {...props}
            slot="json-editor"
            language={support}
            languageKey="json"
            extensions={extensions}
        />
    );
}

export { JsonEditorView };
