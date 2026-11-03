"use client";

import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { sql } from "@codemirror/lang-sql";
import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, lintGutter, lintKeymap, setDiagnostics } from "@codemirror/lint";
import { search, searchKeymap } from "@codemirror/search";
import {
    Annotation,
    Compartment,
    EditorState,
    type Extension,
    Prec,
    Transaction,
} from "@codemirror/state";
import { EditorView, keymap, lineNumbers, placeholder as placeholderText } from "@codemirror/view";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { SqlDiagnostic, SqlEditorProps, SqlSchema } from "./sql-editor";
import { SQL_EDITOR_LINES, sqlEditorFrame } from "./sql-editor-frame";
import {
    DuckDB,
    columnCompletion,
    completionKind,
    completionSchema,
    sizeTheme,
    sqlHighlight,
    sqlTheme,
} from "./sql-editor-setup";

const external = Annotation.define<boolean>();

const languagePart = new Compartment();
const readOnlyPart = new Compartment();
const placeholderPart = new Compartment();
const sizePart = new Compartment();
const attributesPart = new Compartment();

type Attributes = Record<string, string>;

type Settings = {
    schema: SqlSchema | null;
    readOnly: boolean;
    placeholder: string;
    minLines: number;
    maxLines: number;
    attributes: Attributes;
};

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

function configured(settings: Settings) {
    return {
        language: language(settings.schema),
        readOnly: EditorState.readOnly.of(settings.readOnly),
        placeholder: settings.placeholder ? placeholderText(settings.placeholder) : [],
        size: sizeTheme(settings.minLines, settings.maxLines),
        attributes: EditorView.contentAttributes.of(settings.attributes),
    };
}

function toDiagnostics(state: EditorState, list: readonly SqlDiagnostic[]): Diagnostic[] {
    return list.map((item) => {
        const line = state.doc.line(Math.min(Math.max(item.line, 1), state.doc.lines));
        const from = Math.min(line.from + Math.max(item.column, 1) - 1, line.to);
        const word = state.wordAt(from);
        const length = item.length ?? (word && word.from === from ? word.to - from : 1);
        return {
            from,
            to: Math.min(from + Math.max(length, 1), line.to),
            severity: item.severity ?? "error",
            message: item.message,
        };
    });
}

function attributes(props: SqlEditorProps, labelledBy: string | undefined, invalid: boolean) {
    const named = props["aria-labelledby"] ?? (props["aria-label"] ? undefined : labelledBy);
    const entries: [string, string | undefined][] = [
        ["id", props.id],
        ["aria-label", props["aria-label"]],
        ["aria-labelledby", named],
        ["aria-describedby", props["aria-describedby"]],
        ["aria-invalid", invalid ? "true" : undefined],
        ["aria-readonly", props.readOnly ? "true" : undefined],
    ];
    const found: Attributes = {};
    for (const [name, value] of entries) {
        if (value) found[name] = value;
    }
    return found;
}

function changedRange(before: string, after: string) {
    let start = 0;
    const shorter = Math.min(before.length, after.length);
    while (start < shorter && before[start] === after[start]) start++;
    let end = 0;
    while (
        end < shorter - start &&
        before[before.length - 1 - end] === after[after.length - 1 - end]
    ) {
        end++;
    }
    return {
        from: start,
        to: before.length - end,
        insert: after.slice(start, after.length - end),
    };
}

function useLabelFor(id: string | undefined, focus: () => void) {
    const [labelId, setLabelId] = useState<string>();
    useEffect(() => {
        if (!id) return;
        const label = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
        if (!label) return;
        if (!label.id) label.id = `${id}-label`;
        setLabelId(label.id);
        label.addEventListener("click", focus);
        return () => label.removeEventListener("click", focus);
    }, [id, focus]);
    return labelId;
}

function SqlEditorView(props: SqlEditorProps) {
    const {
        value,
        defaultValue,
        onValueChange,
        onRun,
        schema,
        diagnostics,
        readOnly = false,
        minLines = SQL_EDITOR_LINES.min,
        maxLines = SQL_EDITOR_LINES.max,
        placeholder = "",
        className,
        ref,
    } = props;
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const focus = useCallback(() => view.current?.focus(), []);
    const labelId = useLabelFor(props.id, focus);
    const invalid =
        props["aria-invalid"] ?? (diagnostics ?? []).some((item) => item.severity !== "warning");
    const settingsKey = JSON.stringify({
        schema: schema ?? null,
        readOnly,
        placeholder,
        minLines,
        maxLines,
        attributes: attributes(props, labelId, invalid),
    } satisfies Settings);
    const diagnosticsKey = JSON.stringify(diagnostics ?? []);
    const latest = useRef({ onValueChange, onRun, doc: value ?? defaultValue ?? "", settingsKey });
    latest.current = {
        onValueChange,
        onRun,
        doc: latest.current.doc,
        settingsKey,
    };

    useImperativeHandle(
        ref,
        () => ({
            focus,
            insert: (text: string) => {
                const current = view.current;
                if (!current) return;
                current.dispatch({
                    ...current.state.replaceSelection(text),
                    scrollIntoView: true,
                    userEvent: "input",
                });
                current.focus();
            },
        }),
        [focus],
    );

    useEffect(() => {
        if (!host.current) return;
        const parts = configured(JSON.parse(latest.current.settingsKey) as Settings);
        const run = Prec.highest(
            keymap.of([
                {
                    key: "Mod-Enter",
                    preventDefault: true,
                    run: (target) => {
                        const handler = latest.current.onRun;
                        if (!handler) return false;
                        handler(target.state.doc.toString());
                        return true;
                    },
                },
            ]),
        );
        const created = new EditorView({
            parent: host.current,
            state: EditorState.create({
                doc: latest.current.doc,
                extensions: [
                    run,
                    lintGutter(),
                    lineNumbers(),
                    history(),
                    closeBrackets(),
                    bracketMatching(),
                    search({ top: true }),
                    autocompletion({
                        icons: false,
                        addToOptions: [{ render: completionKind, position: 90 }],
                    }),
                    keymap.of([
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...historyKeymap,
                        ...searchKeymap,
                        ...completionKeymap,
                        ...lintKeymap,
                        indentWithTab,
                    ]),
                    EditorView.lineWrapping,
                    syntaxHighlighting(sqlHighlight),
                    sqlTheme,
                    languagePart.of(parts.language),
                    readOnlyPart.of(parts.readOnly),
                    placeholderPart.of(parts.placeholder),
                    sizePart.of(parts.size),
                    attributesPart.of(parts.attributes),
                    EditorView.updateListener.of((update) => {
                        if (!update.docChanged) return;
                        const doc = update.state.doc.toString();
                        latest.current.doc = doc;
                        if (update.transactions.some((tr) => tr.annotation(external))) return;
                        latest.current.onValueChange?.(doc);
                    }),
                ],
            }),
        });
        view.current = created;
        return () => {
            created.destroy();
            view.current = null;
        };
    }, []);

    useEffect(() => {
        const current = view.current;
        if (!current || value === undefined) return;
        const doc = current.state.doc.toString();
        if (doc === value) return;
        current.dispatch({
            changes: changedRange(doc, value),
            annotations: [external.of(true), Transaction.addToHistory.of(false)],
        });
    }, [value]);

    useEffect(() => {
        const parts = configured(JSON.parse(settingsKey) as Settings);
        view.current?.dispatch({
            effects: [
                languagePart.reconfigure(parts.language),
                readOnlyPart.reconfigure(parts.readOnly),
                placeholderPart.reconfigure(parts.placeholder),
                sizePart.reconfigure(parts.size),
                attributesPart.reconfigure(parts.attributes),
            ],
        });
    }, [settingsKey]);

    useEffect(() => {
        const current = view.current;
        if (!current) return;
        const list = JSON.parse(diagnosticsKey) as SqlDiagnostic[];
        current.dispatch(setDiagnostics(current.state, toDiagnostics(current.state, list)));
    }, [diagnosticsKey]);

    return (
        <div
            ref={host}
            data-slot="sql-editor"
            data-invalid={invalid ? "" : undefined}
            className={sqlEditorFrame(className)}
        />
    );
}

export { SqlEditorView };
