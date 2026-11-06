import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { PostgreSQL, SQLDialect, type SQLNamespace } from "@codemirror/lang-sql";
import { syntaxTree } from "@codemirror/language";

import type { SqlSchema } from "./sql-editor";

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

export { columnCompletion, completionKind, completionSchema, DuckDB };
