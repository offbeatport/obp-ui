import { Field, SqlEditor, type SqlSchema } from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

const SCHEMA: SqlSchema = {
    tickets: ["id", "text", "category", "created_at"],
    customers: ["id", "name", "plan", "Signup Date"],
};

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
            note="SQL is entered here, never in a Textarea. CodeMirror, loaded on first use, DuckDB highlighting from the tokens, table and column completion, Cmd/Ctrl+Enter runs, Escape then Tab leaves."
        >
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
                <Field id="sql-empty" label="Empty">
                    <SqlEditor
                        id="sql-empty"
                        placeholder="SELECT text AS input, category AS label FROM tickets"
                    />
                </Field>
                <div className="flex flex-col gap-1.5">
                    <Field id="sql-schema" label="Schema autocomplete">
                        <SqlEditor
                            id="sql-schema"
                            value={query}
                            onValueChange={setQuery}
                            onRun={(sql) => setRan(sql.trim())}
                            schema={SCHEMA}
                        />
                    </Field>
                    <Note>
                        {ran === null
                            ? "Type a table or column name, or tickets. for its columns. Cmd/Ctrl+Enter runs."
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
                            note: "{ table: columns[] } for table, column and table.column completion, plus DuckDB keywords.",
                        },
                        {
                            name: "onRun",
                            note: "Called with the text on Cmd/Ctrl+Enter.",
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
                            name: "readOnly, placeholder, id, aria-*",
                            note: "An id pairs it with Field or Label; ref exposes focus() and insert(text).",
                        },
                    ]}
                />
            </div>
        </Spec>
    );
}
