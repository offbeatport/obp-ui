import {
    type Completion,
    type CompletionContext,
    type CompletionResult,
    type CompletionSource,
    ifNotIn,
    snippetCompletion,
} from "@codemirror/autocomplete";
import { PostgreSQL, SQLDialect, type SQLNamespace } from "@codemirror/lang-sql";
import { foldService, syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";

import type { SqlColumn, SqlCompletion, SqlSchema } from "./sql-editor";

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

function wordsOf(...lists: (string | undefined)[]) {
    return new Set(lists.join(" ").split(" ").filter(Boolean));
}

const KEYWORD_WORDS = wordsOf(DuckDB.spec.keywords, DuckDB.spec.types, "true false null unknown");

const BUILTIN_WORDS = wordsOf(DuckDB.spec.builtin);

const OUTSIDE_CODE = ["QuotedIdentifier", "String", "LineComment", "BlockComment", "."];

type Tables = [string, SqlColumn[]][];

const PLAIN_NAME = /^[a-z_][a-z_\d]*$/i;

function quoted(name: string): string | undefined {
    return PLAIN_NAME.test(name) ? undefined : `"${name.replaceAll('"', '""')}"`;
}

function tablesOf(schema: SqlSchema): Tables {
    return Object.entries(schema).map(([table, columns]) => [
        table,
        columns.map((column) => (typeof column === "string" ? { name: column } : column)),
    ]);
}

function element(tag: string, className: string, text?: string) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function columnInfo(table: string, column: SqlColumn) {
    const box = element("div", "cm-columnInfo");
    const head = element("div", "cm-columnInfo-head");
    head.append(element("span", "cm-columnInfo-name", column.name));
    if (column.type) head.append(element("span", "cm-columnInfo-type", column.type));
    box.append(head, element("div", "cm-columnInfo-table", `in ${table}`));
    const samples = column.samples ?? [];
    if (samples.length > 0) {
        const list = element("ul", "cm-columnInfo-samples");
        list.setAttribute("aria-label", "Sample values");
        for (const sample of samples.slice(0, 3)) {
            const item = element("li", "", sample);
            item.title = sample;
            list.append(item);
        }
        box.append(list);
    }
    return box;
}

function wordInfo(word: SqlCompletion) {
    const box = element("div", "cm-columnInfo");
    if (word.signature) box.append(element("div", "cm-columnInfo-name", word.signature));
    if (word.description) box.append(element("div", "cm-columnInfo-description", word.description));
    return box;
}

function wordOption(word: SqlCompletion): Completion {
    const info = word.signature || word.description ? () => wordInfo(word) : undefined;
    if (word.kind === "function") {
        const name = word.label.toLowerCase();
        return snippetCompletion(`${name}(\${})`, { label: name, type: "function", info });
    }
    return { label: word.label.toUpperCase(), type: "keyword", info };
}

function wordKey(label: string, kind: SqlCompletion["kind"]) {
    return `${kind ?? "keyword"}:${label.toLowerCase()}`;
}

function wordCompletions(words: readonly SqlCompletion[]) {
    const known = new Map(words.map((word) => [wordKey(word.label, word.kind), wordOption(word)]));
    const build = (label: string, type: string): Completion =>
        known.get(wordKey(label, type === "variable" ? "function" : "keyword")) ?? {
            label,
            type,
            boost: -1,
        };
    const extra = words
        .filter((word) => {
            const dialect = word.kind === "function" ? BUILTIN_WORDS : KEYWORD_WORDS;
            return !dialect.has(word.label.toLowerCase());
        })
        .map(wordOption);
    const complete: CompletionSource = (context) => {
        const word = context.matchBefore(/\w*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;
        return { from: word.from, options: extra, validFor: /^\w*$/ };
    };
    return { build, extra: extra.length > 0 ? ifNotIn(OUTSIDE_CODE, complete) : null };
}

function columnOption(table: string, column: SqlColumn, boost?: number): Completion {
    return {
        label: column.name,
        type: "column",
        detail: column.type,
        info: () => columnInfo(table, column),
        apply: quoted(column.name),
        boost,
    };
}

function completionSchema(schema: SqlSchema): SQLNamespace {
    return Object.fromEntries(
        tablesOf(schema).map(([table, columns]) => [
            table,
            {
                self: { label: table, type: "table", apply: quoted(table), boost: 1 },
                children: columns.map((column) => columnOption(table, column)),
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

function namedIn(state: EditorState, position: number) {
    const text = state.doc.toString();
    const { start, end } = statementBounds(text, position);
    const statement = text.slice(start, end).toLowerCase();
    return (table: string) =>
        new RegExp(`(^|[^\\w"])"?${escaped(table.toLowerCase())}"?($|[^\\w"])`).test(statement);
}

function columnCompletion(schema: SqlSchema) {
    const tables = tablesOf(schema);
    return (context: CompletionContext): CompletionResult | null => {
        const word = context.matchBefore(/\w*/);
        if (!word || (word.from === word.to && !context.explicit)) return null;
        if (context.state.sliceDoc(word.from - 1, word.from) === ".") return null;
        const node = syntaxTree(context.state).resolveInner(context.pos, -1);
        if (SKIPPED_NODES.has(node.name)) return null;
        const named = namedIn(context.state, context.pos);
        const options: Completion[] = tables.flatMap(([table, columns]) => {
            const boost = named(table) ? 2 : 0;
            return columns.map((column) => ({
                ...columnOption(table, column, boost),
                detail: column.type ? `${column.type} · ${table}` : table,
            }));
        });
        return { from: word.from, options, validFor: /^\w*$/ };
    };
}

function identifierAt(state: EditorState, position: number, side: -1 | 1) {
    const node = syntaxTree(state).resolveInner(position, side);
    if (node.name === "Identifier") {
        return { from: node.from, to: node.to, name: state.sliceDoc(node.from, node.to) };
    }
    if (node.name === "QuotedIdentifier") {
        const text = state.sliceDoc(node.from + 1, node.to - 1).replaceAll('""', '"');
        return { from: node.from, to: node.to, name: text };
    }
    return null;
}

function columnHover(schema: SqlSchema) {
    const tables = tablesOf(schema);
    return hoverTooltip((view, position, side) => {
        const found = identifierAt(view.state, position, side);
        if (!found) return null;
        const wanted = found.name.toLowerCase();
        const named = namedIn(view.state, position);
        const matches = tables.flatMap(([table, columns]) =>
            columns
                .filter((column) => column.name.toLowerCase() === wanted)
                .map((column) => ({ table, column })),
        );
        const match = matches.find((item) => named(item.table)) ?? matches[0];
        if (!match) return null;
        return {
            pos: found.from,
            end: found.to,
            above: true,
            create: () => ({ dom: columnInfo(match.table, match.column) }),
        };
    });
}

function indentOf(text: string) {
    return text.length - text.trimStart().length;
}

const foldByIndent = foldService.of((state, lineStart) => {
    const line = state.doc.lineAt(lineStart);
    if (!line.text.trim()) return null;
    const indent = indentOf(line.text);
    let last = line;
    for (let number = line.number + 1; number <= state.doc.lines; number++) {
        const next = state.doc.line(number);
        if (!next.text.trim()) continue;
        if (indentOf(next.text) <= indent) break;
        last = next;
    }
    return last.number > line.number ? { from: line.to, to: last.to } : null;
});

const KIND_LABEL: Record<string, string> = {
    table: "table",
    column: "column",
    keyword: "keyword",
    type: "type",
    variable: "function",
    function: "function",
    constant: "alias",
};

function completionKind(completion: Completion) {
    const kind = document.createElement("span");
    kind.className = "cm-completionKind";
    kind.textContent = KIND_LABEL[completion.type ?? ""] ?? "";
    return kind;
}

export {
    columnCompletion,
    columnHover,
    completionKind,
    completionSchema,
    DuckDB,
    foldByIndent,
    wordCompletions,
};
