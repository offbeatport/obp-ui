import { Field, type SqlCompletion, SqlEditor, type SqlSchema } from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

const SCHEMA: SqlSchema = {
    tickets: [
        { name: "id", type: "BIGINT", samples: ["1", "2", "3"] },
        {
            name: "text",
            type: "VARCHAR",
            samples: [
                "My card was charged twice",
                "Cannot log in after the update",
                "Export to CSV?",
            ],
        },
        { name: "category", type: "VARCHAR", samples: ["billing", "bug", "account"] },
        { name: "created_at", type: "TIMESTAMP" },
    ],
    customers: ["id", "name", "plan", "Signup Date"],
};

const WORDS: SqlCompletion[] = [
    {
        label: "regexp_replace",
        kind: "function",
        signature: "regexp_replace(text, pattern, replacement[, 'g'])",
        description: "Replaces the first match of a pattern, or every match with 'g'.",
    },
    {
        label: "lower",
        kind: "function",
        signature: "lower(text)",
        description: "The text in lower case.",
    },
    {
        label: "qualify",
        kind: "keyword",
        description: "Filters rows on a window function, as WHERE does on columns.",
    },
];

const STARTER = "SELECT text AS input, category AS label FROM tickets";

const JOINED = `SELECT t.text AS input, t.category AS label
FROM tickets t
JOIN customers c ON c.id = t.customer_id
WHERE t.category IS NOT NULL`;

const SAVED = `SELECT CAST(text AS VARCHAR) AS input,
       CAST(category AS VARCHAR) AS label
FROM tickets
-- Saved 2 Nov, read-only here
LIMIT 1000`;

export function SqlEditorDemo() {
    const [query, setQuery] = useState("SELECT ");
    const [ran, setRan] = useState<string | null>(null);
    return (
        <Spec
            name="SqlEditor"
            note="SQL is entered here, never in a Textarea. CodeMirror, loaded on first use, DuckDB highlighting from the tokens, table and column completion with types and sample values, Format (Shift+Alt+F), folding, Alt-click or Cmd/Ctrl+D for more cursors, Cmd/Ctrl+Enter runs, Escape then Tab leaves."
        >
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
                <Field id="sql-empty" label="Empty, with a starter">
                    <SqlEditor id="sql-empty" starter={STARTER} schema={SCHEMA} />
                </Field>
                <div className="flex flex-col gap-1.5">
                    <Field id="sql-schema" label="Schema autocomplete">
                        <SqlEditor
                            id="sql-schema"
                            value={query}
                            onValueChange={setQuery}
                            onRun={(sql) => setRan(sql.trim())}
                            schema={SCHEMA}
                            completions={WORDS}
                        />
                    </Field>
                    <Note>
                        {ran === null
                            ? "Type a table or column name, or tickets. for its columns, or reg for regexp_replace; hover a column for its type and values. Cmd/Ctrl+Enter runs the selection, or everything."
                            : `Ran: ${ran}`}
                    </Note>
                </div>
                <Field
                    id="sql-error"
                    label="With an error"
                    error='Binder Error: Referenced column "customer_id" not found in FROM clause'
                >
                    <SqlEditor
                        id="sql-error"
                        defaultValue={JOINED}
                        schema={SCHEMA}
                        diagnostics={[
                            {
                                line: 3,
                                column: 25,
                                length: 13,
                                message:
                                    'Referenced column "customer_id" not found in FROM clause. Candidate bindings: "t.category"',
                            },
                        ]}
                    />
                </Field>
                <Field id="sql-read-only" label="Read-only">
                    <SqlEditor id="sql-read-only" defaultValue={SAVED} readOnly minLines={5} />
                </Field>
            </div>
            <div className="mt-5">
                <Api
                    items={[
                        {
                            name: "value / defaultValue",
                            note: "Controlled or uncontrolled text; onValueChange gets every edit.",
                        },
                        {
                            name: "schema",
                            note: "{ table: columns[] } for table, column and table.column completion, plus DuckDB keywords. A column is a name or { name, type?, samples? }: the type shows beside it in the list, and the list and a hover over the name show up to three sample values.",
                        },
                        {
                            name: "completions",
                            note: "Functions and keywords with a signature and a one-line description, shown beside the completion list. A function inserts name() with the cursor between the brackets; the app owns the list.",
                        },
                        {
                            name: "onRun",
                            note: "Called on Cmd/Ctrl+Enter with the selection, or the whole text when nothing is selected.",
                        },
                        {
                            name: "starter",
                            note: "A snippet shown as the placeholder of an empty editor, with a Tab key; Tab inserts it.",
                        },
                        {
                            name: "Format",
                            note: "The footer button or Shift+Alt+F formats with sql-formatter's DuckDB dialect, loaded on first use; the cursor stays on the same token. A parse error shows in the footer until the next edit.",
                        },
                        {
                            name: "diagnostics",
                            note: "{ line, column, message, length? } from the server's error, 1-based: a wavy underline, a gutter dot and the message on hover.",
                        },
                        {
                            name: "minLines / maxLines",
                            note: "Grows with the text between the two, then scrolls.",
                            value: "3 / 16",
                        },
                        {
                            name: "fill",
                            note: "Takes the height of its parent (a flex column or a sized box) and scrolls inside it; minLines still sets the least height.",
                        },
                        {
                            name: "readOnly, placeholder, id, aria-*",
                            note: "An id pairs it with Field or Label; ref exposes focus(), insert(text), replace(text, { format }) and format().",
                        },
                    ]}
                />
            </div>
        </Spec>
    );
}
