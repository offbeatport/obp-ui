"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, forceLinting, lintGutter, lintKeymap, linter } from "@codemirror/lint";
import { search, searchKeymap } from "@codemirror/search";
import {
    Annotation,
    Compartment,
    EditorState,
    type Extension,
    Prec,
    StateEffect,
    StateField,
    Transaction,
} from "@codemirror/state";
import {
    EditorView,
    type KeyBinding,
    keymap,
    lineNumbers,
    placeholder as placeholderText,
} from "@codemirror/view";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import {
    type CodeDiagnostic,
    type CodeEditorProps,
    EDITOR_LINES,
    editorFrame,
} from "./code-editor-frame";
import { editorTheme, sizeTheme } from "./code-editor-theme";
import { codeHighlighter } from "./code-highlight";

type CodeEditorViewProps = CodeEditorProps & {
    slot: string;
    language: Extension;
    languageKey: string;
    extensions?: Extension;
    keys?: readonly KeyBinding[];
    onRun?: (value: string) => void;
};

const external = Annotation.define<boolean>();

const languagePart = new Compartment();
const readOnlyPart = new Compartment();
const placeholderPart = new Compartment();
const sizePart = new Compartment();
const attributesPart = new Compartment();

const setExternal = StateEffect.define<readonly Diagnostic[]>();

const externalDiagnostics = StateField.define<readonly Diagnostic[]>({
    create: () => [],
    update(list, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setExternal)) return effect.value;
        }
        if (!tr.docChanged || list.length === 0) return list;
        return list.map((item) => {
            const from = tr.changes.mapPos(item.from, 1);
            return { ...item, from, to: Math.max(from, tr.changes.mapPos(item.to, -1)) };
        });
    },
});

const externalLint: Extension = [
    externalDiagnostics,
    linter((view) => [...view.state.field(externalDiagnostics)], {
        needsRefresh: (update) =>
            update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setExternal))),
    }),
];

type Attributes = Record<string, string>;

type Settings = {
    languageKey: string;
    readOnly: boolean;
    placeholder: string;
    minLines: number;
    maxLines: number;
    attributes: Attributes;
};

function configured(settings: Settings) {
    return {
        readOnly: EditorState.readOnly.of(settings.readOnly),
        placeholder: settings.placeholder ? placeholderText(settings.placeholder) : [],
        size: sizeTheme(settings.minLines, settings.maxLines),
        attributes: EditorView.contentAttributes.of(settings.attributes),
    };
}

function toDiagnostics(state: EditorState, list: readonly CodeDiagnostic[]): Diagnostic[] {
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

function attributes(props: CodeEditorProps, labelledBy: string | undefined, invalid: boolean) {
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

function CodeEditorView(props: CodeEditorViewProps) {
    const {
        value,
        defaultValue,
        onValueChange,
        onRun,
        diagnostics,
        readOnly = false,
        minLines = EDITOR_LINES.min,
        maxLines = EDITOR_LINES.max,
        placeholder = "",
        className,
        slot,
        language,
        languageKey,
        extensions = [],
        keys = [],
        ref,
    } = props;
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const focus = useCallback(() => view.current?.focus(), []);
    const labelId = useLabelFor(props.id, focus);
    const invalid =
        props["aria-invalid"] ?? (diagnostics ?? []).some((item) => item.severity !== "warning");
    const settingsKey = JSON.stringify({
        languageKey,
        readOnly,
        placeholder,
        minLines,
        maxLines,
        attributes: attributes(props, labelId, invalid),
    } satisfies Settings);
    const diagnosticsKey = JSON.stringify(diagnostics ?? []);
    const setup = useRef({ extensions, keys });
    const latest = useRef({
        onValueChange,
        onRun,
        language,
        doc: value ?? defaultValue ?? "",
        settingsKey,
    });
    latest.current = {
        onValueChange,
        onRun,
        language,
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
                    setup.current.extensions,
                    keymap.of([
                        ...closeBracketsKeymap,
                        ...defaultKeymap,
                        ...historyKeymap,
                        ...searchKeymap,
                        ...setup.current.keys,
                        ...lintKeymap,
                        indentWithTab,
                    ]),
                    EditorView.lineWrapping,
                    syntaxHighlighting(codeHighlighter),
                    editorTheme,
                    externalLint,
                    languagePart.of(latest.current.language),
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
                languagePart.reconfigure(latest.current.language),
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
        const list = JSON.parse(diagnosticsKey) as CodeDiagnostic[];
        current.dispatch({ effects: setExternal.of(toDiagnostics(current.state, list)) });
        forceLinting(current);
    }, [diagnosticsKey]);

    return (
        <div
            ref={host}
            data-slot={slot}
            data-invalid={invalid ? "" : undefined}
            className={editorFrame(className)}
        />
    );
}

export { CodeEditorView, type CodeEditorViewProps };
