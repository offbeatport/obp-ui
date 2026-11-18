"use client";

import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
import { useMemo } from "react";

import { CodeEditorView } from "./code-editor-view";
import type { SqlEditorProps, SqlSchema } from "./sql-editor";
import {
    DuckDB,
    columnCompletion,
    columnHover,
    completionKind,
    completionSchema,
    foldByIndent,
} from "./sql-editor-setup";

const extensions: Extension = [
    autocompletion({
        icons: false,
        filterStrict: true,
        addToOptions: [{ render: completionKind, position: 90 }],
    }),
    foldByIndent,
];

function language(schema: SqlSchema | null): Extension {
    const support = sql({
        dialect: DuckDB,
        upperCaseKeywords: true,
        schema: schema ? completionSchema(schema) : undefined,
    });
    return schema
        ? [
              support,
              support.language.data.of({ autocomplete: columnCompletion(schema) }),
              columnHover(schema),
          ]
        : support;
}

async function formatSql(text: string) {
    const { duckdb, formatDialect } = await import("sql-formatter");
    return formatDialect(text, { dialect: duckdb, keywordCase: "upper", tabWidth: 2 });
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
            extensions={extensions}
            keys={completionKeymap}
            formatter={formatSql}
        />
    );
}

export { SqlEditorView };
