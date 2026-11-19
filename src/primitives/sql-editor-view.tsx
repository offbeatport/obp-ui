"use client";

import { autocompletion, completionKeymap, completionStatus } from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { type RefObject, useMemo, useRef } from "react";

import { CodeEditorView } from "./code-editor-view";
import type { SqlCompletion, SqlEditorProps, SqlSchema } from "./sql-editor";
import {
    DuckDB,
    columnCompletion,
    columnHover,
    completionKind,
    completionSchema,
    foldByIndent,
    wordCompletions,
} from "./sql-editor-setup";

const extensions: Extension = [
    autocompletion({
        icons: false,
        filterStrict: true,
        addToOptions: [{ render: completionKind, position: 90 }],
    }),
    foldByIndent,
];

function language(schema: SqlSchema | null, completions: readonly SqlCompletion[]): Extension {
    const words = wordCompletions(completions);
    const support = sql({
        dialect: DuckDB,
        upperCaseKeywords: true,
        schema: schema ? completionSchema(schema) : undefined,
        keywordCompletion: words.build,
    });
    return [
        support,
        words.extra ? support.language.data.of({ autocomplete: words.extra }) : [],
        schema
            ? [
                  support.language.data.of({ autocomplete: columnCompletion(schema) }),
                  columnHover(schema),
              ]
            : [],
    ];
}

async function formatSql(text: string) {
    const { duckdb, formatDialect } = await import("sql-formatter");
    return formatDialect(text, { dialect: duckdb, keywordCase: "upper", tabWidth: 2 });
}

type CompletingListener = ((open: boolean) => void) | undefined;

function completing(notify: RefObject<CompletingListener>): Extension {
    return EditorView.updateListener.of((update) => {
        const open = completionStatus(update.state) !== null;
        if (open !== (completionStatus(update.startState) !== null)) notify.current?.(open);
    });
}

function SqlEditorView({ schema, completions, onCompletingChange, ...props }: SqlEditorProps) {
    const notify = useRef<CompletingListener>(onCompletingChange);
    notify.current = onCompletingChange;
    const setup = useMemo(() => [extensions, completing(notify)], []);
    const schemaKey = JSON.stringify([schema ?? null, completions ?? []]);
    const support = useMemo(() => {
        const [parsed, words] = JSON.parse(schemaKey) as [SqlSchema | null, SqlCompletion[]];
        return language(parsed, words);
    }, [schemaKey]);
    return (
        <CodeEditorView
            {...props}
            slot="sql-editor"
            language={support}
            languageKey={schemaKey}
            extensions={setup}
            keys={completionKeymap}
            formatter={formatSql}
        />
    );
}

export { SqlEditorView };
