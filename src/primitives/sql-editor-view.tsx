"use client";

import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
import { useMemo } from "react";

import { CodeEditorView } from "./code-editor-view";
import type { SqlEditorProps, SqlSchema } from "./sql-editor";
import { DuckDB, columnCompletion, completionKind, completionSchema } from "./sql-editor-setup";

const completion = autocompletion({
    icons: false,
    filterStrict: true,
    addToOptions: [{ render: completionKind, position: 90 }],
});

function language(schema: SqlSchema | null): Extension {
    const support = sql({
        dialect: DuckDB,
        upperCaseKeywords: true,
        schema: schema ? completionSchema(schema) : undefined,
    });
    return schema
        ? [support, support.language.data.of({ autocomplete: columnCompletion(schema) })]
        : support;
}

function SqlEditorView({ schema, ...props }: SqlEditorProps) {
    const schemaKey = JSON.stringify(schema ?? null);
    const support = useMemo(() => language(JSON.parse(schemaKey) as SqlSchema | null), [schemaKey]);
    return (
        <CodeEditorView
            {...props}
            slot="sql-editor"
            language={support}
            languageKey={schemaKey}
            extensions={completion}
            keys={completionKeymap}
        />
    );
}

export { SqlEditorView };
