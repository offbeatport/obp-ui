import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { PostgreSQL, SQLDialect, type SQLNamespace } from "@codemirror/lang-sql";
import { HighlightStyle, syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

import type { SqlSchema } from "./sql-editor";
import { CONTENT_PADDING, linesHeight } from "./sql-editor-frame";

const DUCKDB_KEYWORDS =
    "anti asof attach columns describe detach exclude glob ilike install load macro pivot pivot_longer pivot_wider positional pragma qualify replace sample semi summarize try_cast union_by_name unpivot using";

const DUCKDB_TYPES =
    "blob double float hugeint list map real struct tinyint ubigint uhugeint uinteger union usmallint utinyint varchar";

const DUCKDB_FUNCTIONS =
    "abs any_value array_agg avg ceil coalesce concat concat_ws contains count date_diff date_part date_trunc ends_with epoch first floor greatest hash last least left len length list_contains list_value lower ltrim max min now nullif regexp_extract regexp_matches regexp_replace right round rtrim split_part starts_with strftime string_agg string_split strptime substring sum trim unnest upper";

const DuckDB = SQLDialect.define({
    ...PostgreSQL.spec,
    keywords: `${PostgreSQL.spec.keywords ?? ""} ${DUCKDB_KEYWORDS}`,
    types: `${PostgreSQL.spec.types ?? ""} ${DUCKDB_TYPES}`,
    builtin: DUCKDB_FUNCTIONS,
    caseInsensitiveIdentifiers: true,
});

const PLAIN_NAME = /^[a-z_][a-z_\d]*$/i;

function quoted(name: string): string | undefined {
    return PLAIN_NAME.test(name) ? undefined : `"${name.replaceAll('"', '""')}"`;
}

function completionSchema(schema: SqlSchema): SQLNamespace {
    return Object.fromEntries(
        Object.entries(schema).map(([table, columns]) => [
            table,
            {
                self: { label: table, type: "table", apply: quoted(table), boost: 1 },
                children: columns.map((column) => ({
                    label: column,
                    type: "column",
                    apply: quoted(column),
                })),
            },
        ]),
    );
}

function escaped(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SKIPPED_NODES = new Set(["String", "QuotedIdentifier", "LineComment", "BlockComment"]);

function statementBounds(text: string, position: number) {
    const start = text.lastIndexOf(";", position - 1) + 1;
    const end = text.indexOf(";", position);
    return { start, end: end === -1 ? text.length : end };
}

function columnCompletion(schema: SqlSchema) {
    const tables = Object.entries(schema);
    return (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/\w*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;
        if (context.state.sliceDoc(word.from - 1, word.from) === ".") return null;
        const node = syntaxTree(context.state).resolveInner(context.pos, -1);
        if (SKIPPED_NODES.has(node.name)) return null;
        const text = context.state.doc.toString();
        const { start, end } = statementBounds(text, context.pos);
        const statement = text.slice(start, end).toLowerCase();
        const named = (table: string) =>
            new RegExp(`(^|[^\\w"])"?${escaped(table.toLowerCase())}"?($|[^\\w"])`).test(statement);
        const options: Completion[] = tables.flatMap(([table, columns]) => {
            const boost = named(table) ? 2 : 0;
            return columns.map((column) => ({
                label: column,
                type: "column",
                detail: table,
                apply: quoted(column),
                boost,
            }));
        });
        return { from: word.from, options, validFor: /^\w*$/ };
    };
}

const KIND_LABEL: Record<string, string> = {
    table: "table",
    column: "column",
    keyword: "keyword",
    type: "type",
    variable: "function",
    constant: "alias",
};

function completionKind(completion: Completion) {
    const kind = document.createElement("span");
    kind.className = "cm-completionKind";
    kind.textContent = KIND_LABEL[completion.type ?? ""] ?? "";
    return kind;
}

const sqlHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: "var(--primary)" },
    { tag: tags.typeName, color: "var(--approval)" },
    { tag: tags.string, color: "var(--success)" },
    { tag: [tags.number, tags.bool, tags.null], color: "var(--warning)" },
    { tag: [tags.lineComment, tags.blockComment], color: "var(--faint)" },
    {
        tag: [tags.operator, tags.punctuation, tags.paren, tags.brace, tags.squareBracket],
        color: "var(--muted-foreground)",
    },
    { tag: tags.special(tags.name), color: "var(--info)" },
    { tag: tags.invalid, color: "var(--destructive)" },
]);

const RADIUS_CONTROL = "calc(var(--radius) - 2px)";

const field = {
    height: "1.75rem",
    padding: "0 0.5rem",
    border: "1px solid var(--input)",
    borderRadius: RADIUS_CONTROL,
    backgroundColor: "var(--input-background)",
    backgroundImage: "none",
    color: "var(--foreground)",
    font: "inherit",
};

const dot = {
    content: '""',
    display: "inline-block",
    flexShrink: "0",
    width: "0.5rem",
    height: "0.5rem",
    borderRadius: "9999px",
};

const sqlTheme = EditorView.theme({
    "&": { color: "inherit", backgroundColor: "transparent", borderRadius: "inherit" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": {
        fontFamily: "inherit",
        lineHeight: "inherit",
        overflow: "auto",
        borderRadius: "inherit",
    },
    ".cm-content": {
        padding: `calc(${CONTENT_PADDING} / 2) 0`,
        caretColor: "var(--foreground)",
    },
    ".cm-content ::selection, .cm-content::selection": {
        backgroundColor: "var(--primary)",
        color: "var(--primary-foreground)",
    },
    ".cm-line": { padding: "0 0.625rem 0 0.375rem" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
    ".cm-gutters": {
        backgroundColor: "transparent",
        color: "var(--faint)",
        border: "none",
        borderRight: "1px solid var(--border-soft)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
        minWidth: "2ch",
        padding: "0 0.375rem 0 0",
        fontVariantNumeric: "tabular-nums",
    },
    ".cm-gutter-lint": { width: "1rem" },
    ".cm-gutter-lint .cm-gutterElement": {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0",
    },
    ".cm-lint-marker": { ...dot, content: "none" },
    ".cm-lint-marker-error": { backgroundColor: "var(--destructive)" },
    ".cm-lint-marker-warning": { backgroundColor: "var(--warning)" },
    ".cm-lint-marker-info": { backgroundColor: "var(--info)" },
    ".cm-lintRange": {
        backgroundImage: "none",
        paddingBottom: "0",
        textDecorationLine: "underline",
        textDecorationStyle: "wavy",
        textDecorationThickness: "1px",
        textDecorationSkipInk: "none",
        textUnderlineOffset: "3px",
    },
    ".cm-lintRange-error": { textDecorationColor: "var(--destructive)" },
    ".cm-lintRange-warning": { textDecorationColor: "var(--warning)" },
    ".cm-lintRange-info": { textDecorationColor: "var(--info)" },
    ".cm-lintRange-active": { backgroundColor: "var(--secondary)" },
    ".cm-lintPoint:after": { borderBottomColor: "var(--destructive)" },
    ".cm-lintPoint-warning:after": { borderBottomColor: "var(--warning)" },
    ".cm-lintPoint-info:after": { borderBottomColor: "var(--info)" },
    ".cm-tooltip": {
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        backgroundColor: "var(--popover)",
        color: "var(--popover-foreground)",
        boxShadow: "var(--shadow-e2)",
        overflow: "hidden",
    },
    ".cm-tooltip-lint": {
        maxWidth: "min(28rem, 90vw)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-sm)",
        lineHeight: "var(--type-sm-leading)",
    },
    ".cm-diagnostic": {
        display: "flex",
        alignItems: "baseline",
        gap: "0.5rem",
        margin: "0",
        padding: "0.375rem 0.625rem",
        border: "none",
    },
    ".cm-diagnostic::before": { ...dot, alignSelf: "center" },
    ".cm-diagnostic-error::before": { backgroundColor: "var(--destructive)" },
    ".cm-diagnostic-warning::before": { backgroundColor: "var(--warning)" },
    ".cm-diagnostic-info::before": { backgroundColor: "var(--info)" },
    ".cm-diagnostic + .cm-diagnostic": { borderTop: "1px solid var(--border-soft)" },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        minWidth: "16rem",
        maxHeight: "16rem",
        padding: "0.25rem 0",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--type-sm)",
        lineHeight: "var(--type-sm-leading)",
    },
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        display: "flex",
        alignItems: "baseline",
        gap: "0.75rem",
        padding: "0.375rem 0.625rem",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--secondary)",
        color: "var(--secondary-foreground)",
    },
    ".cm-tooltip-autocomplete-disabled ul li[aria-selected]": {
        backgroundColor: "var(--muted)",
    },
    ".cm-completionLabel": { flex: "1 1 auto", minWidth: "0" },
    ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
    ".cm-completionDetail, .cm-completionKind": {
        margin: "0",
        fontFamily: "var(--font-sans)",
        fontStyle: "normal",
        color: "var(--muted-foreground)",
    },
    ".cm-completionListIncompleteTop:before, .cm-completionListIncompleteBottom:after": {
        color: "var(--muted-foreground)",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "var(--accent)",
        color: "inherit",
    },
    ".cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket": {
        backgroundColor: "transparent",
        color: "var(--destructive)",
    },
    ".cm-searchMatch": { backgroundColor: "var(--warning-soft)", outline: "none" },
    ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--accent)" },
    ".cm-panels": {
        backgroundColor: "var(--card)",
        color: "var(--foreground)",
        borderRadius: "inherit",
    },
    ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--border)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--border)" },
    ".cm-panel.cm-search, .cm-panel.cm-panel-lint": {
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-sm)",
    },
    ".cm-panel.cm-search": {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.375rem 0.5rem",
        padding: "0.375rem 2rem 0.375rem 0.5rem",
    },
    ".cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label": {
        margin: "0",
    },
    ".cm-panel.cm-search label": {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontSize: "inherit",
        color: "var(--muted-foreground)",
    },
    ".cm-panel.cm-search input[type=checkbox]": { accentColor: "var(--primary)" },
    ".cm-panel.cm-search br": { flexBasis: "100%", height: "0" },
    ".cm-textfield": { ...field, fontSize: "inherit" },
    ".cm-textfield:focus": {
        outline: "none",
        borderColor: "var(--ring)",
        boxShadow: "0 0 0 1px var(--ring)",
    },
    ".cm-button, .cm-button:active": { ...field, cursor: "pointer" },
    ".cm-button:hover": { backgroundColor: "var(--secondary)" },
    ".cm-button:focus-visible, .cm-panel [name=close]:focus-visible": {
        outline: "2px solid var(--ring)",
        outlineOffset: "1px",
    },
    ".cm-panel [name=close]": {
        top: "0.375rem",
        right: "0.5rem",
        width: "1.75rem",
        height: "1.75rem",
        borderRadius: RADIUS_CONTROL,
        color: "var(--muted-foreground)",
        cursor: "pointer",
    },
    ".cm-panel [name=close]:hover": {
        backgroundColor: "var(--secondary)",
        color: "var(--foreground)",
    },
    ".cm-panel.cm-panel-lint ul [aria-selected], .cm-panel.cm-panel-lint ul:focus [aria-selected]":
        {
            backgroundColor: "var(--secondary)",
            color: "var(--secondary-foreground)",
        },
});

function sizeTheme(minLines: number, maxLines: number) {
    return EditorView.theme({
        "&": { maxHeight: linesHeight(Math.max(minLines, maxLines)) },
        ".cm-content, .cm-gutter": { minHeight: linesHeight(minLines) },
    });
}

export {
    columnCompletion,
    completionKind,
    completionSchema,
    DuckDB,
    sizeTheme,
    sqlHighlight,
    sqlTheme,
};
