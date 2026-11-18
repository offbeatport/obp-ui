"use client";

import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
    bracketMatching,
    codeFolding,
    foldGutter,
    foldKeymap,
    syntaxHighlighting,
} from "@codemirror/language";
import { type Diagnostic, forceLinting, lintGutter, lintKeymap, linter } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
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
    drawSelection,
    highlightActiveLine,
    highlightActiveLineGutter,
    keymap,
    lineNumbers,
    placeholder as placeholderText,
    rectangularSelection,
} from "@codemirror/view";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Button } from "./button";
import {
    type Formatter,
    chevron,
    foldedPlaceholder,
    formatKeys,
    isFormatKey,
    mappedCursor,
    runnableText,
    shortError,
    starterHint,
    starterKeymap,
} from "./code-editor-commands";
import {
    type CodeDiagnostic,
    type CodeEditorProps,
    EDITOR_LINES,
    FOOTER_HEIGHT,
    editorFrame,
} from "./code-editor-frame";
import { editorTheme, sizeTheme } from "./code-editor-theme";
import { codeHighlighter } from "./code-highlight";
import { Kbd } from "./kbd";

type CodeEditorViewProps = CodeEditorProps & {
    slot: string;
    language: Extension;
    languageKey: string;
    extensions?: Extension;
    keys?: readonly KeyBinding[];
    onRun?: (value: string) => void;
    formatter?: Formatter;
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
    starter: string;
    minLines: number;
    maxLines: number;
    attributes: Attributes;
};

function configured(settings: Settings) {
    return {
        readOnly: EditorState.readOnly.of(settings.readOnly),
        placeholder: settings.starter
            ? placeholderText(starterHint(settings.starter))
            : settings.placeholder
              ? placeholderText(settings.placeholder)
              : [],
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

const multipleCursors: Extension = [
    EditorState.allowMultipleSelections.of(true),
    drawSelection(),
    rectangularSelection({ eventFilter: (event) => event.altKey && event.shiftKey }),
    EditorView.clickAddsSelectionRange.of(
        (event) => event.altKey || event.metaKey || event.ctrlKey,
    ),
    highlightSelectionMatches(),
];

const folding: Extension = [
    codeFolding({ placeholderDOM: foldedPlaceholder }),
    foldGutter({ markerDOM: chevron }),
];

function EditorFooter({
    error,
    running,
    onFormat,
}: {
    error: string | null;
    running: boolean;
    onFormat: () => void;
}) {
    return (
        <div
            className="flex shrink-0 items-center justify-between gap-3 border-t border-border-soft pr-1 pl-2.5 font-sans"
            style={{ height: FOOTER_HEIGHT }}
        >
            <output
                title={error ?? undefined}
                className="min-w-0 truncate text-sm text-destructive"
            >
                {error ? `Could not format: ${error}` : ""}
            </output>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={running}
                onMouseDown={(event) => event.preventDefault()}
                onClick={onFormat}
            >
                Format
                <Kbd>{formatKeys()}</Kbd>
            </Button>
        </div>
    );
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
        starter = "",
        formatter,
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
    const [formatError, setFormatError] = useState<string | null>(null);
    const [formatting, setFormatting] = useState(false);
    const labelId = useLabelFor(props.id, focus);
    const invalid =
        props["aria-invalid"] ?? (diagnostics ?? []).some((item) => item.severity !== "warning");
    const settingsKey = JSON.stringify({
        languageKey,
        readOnly,
        placeholder,
        starter,
        minLines,
        maxLines,
        attributes: attributes(props, labelId, invalid),
    } satisfies Settings);
    const diagnosticsKey = JSON.stringify(diagnostics ?? []);
    const setup = useRef({ extensions, keys });
    const latest = useRef({
        onValueChange,
        onRun,
        formatter,
        starter,
        readOnly,
        language,
        doc: value ?? defaultValue ?? "",
        settingsKey,
    });
    latest.current = {
        onValueChange,
        onRun,
        formatter,
        starter,
        readOnly,
        language,
        doc: latest.current.doc,
        settingsKey,
    };

    const format = useCallback(async () => {
        const current = view.current;
        const formatText = latest.current.formatter;
        if (!current || !formatText || latest.current.readOnly) return;
        const before = current.state.doc.toString();
        if (!before.trim()) return;
        setFormatting(true);
        try {
            const after = await formatText(before);
            setFormatError(null);
            if (current.state.doc.toString() !== before || after === before) return;
            const head = mappedCursor(before, after, current.state.selection.main.head);
            current.dispatch({
                changes: changedRange(before, after),
                selection: { anchor: head },
                scrollIntoView: true,
                userEvent: "input.format",
            });
        } catch (error) {
            setFormatError(shortError(error));
        } finally {
            setFormatting(false);
            current.focus();
        }
    }, []);

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
            format: () => {
                void format();
            },
        }),
        [focus, format],
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
                        handler(runnableText(target.state));
                        return true;
                    },
                },
            ]),
        );
        const formatKey = Prec.highest(
            EditorView.domEventHandlers({
                keydown: (event) => {
                    if (!isFormatKey(event) || !latest.current.formatter) return false;
                    event.preventDefault();
                    void format();
                    return true;
                },
            }),
        );
        const starterKeys = Prec.highest(starterKeymap(() => latest.current.starter));
        const created = new EditorView({
            parent: host.current,
            state: EditorState.create({
                doc: latest.current.doc,
                extensions: [
                    run,
                    formatKey,
                    starterKeys,
                    lintGutter(),
                    lineNumbers(),
                    folding,
                    highlightActiveLine(),
                    highlightActiveLineGutter(),
                    multipleCursors,
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
                        ...foldKeymap,
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
                        setFormatError(null);
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
    }, [format]);

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

    const footer = Boolean(formatter) && !readOnly;
    return (
        <div
            data-slot={slot}
            data-invalid={invalid ? "" : undefined}
            className={editorFrame(className)}
        >
            <div ref={host} className="flex min-h-0 flex-1 flex-col rounded-[inherit]" />
            {footer && (
                <EditorFooter
                    error={formatError}
                    running={formatting}
                    onFormat={() => void format()}
                />
            )}
        </div>
    );
}

export { CodeEditorView, type CodeEditorViewProps };
