import { Field, JsonEditor } from "obp-ui";
import { useState } from "react";
import { Api, Note, Spec } from "../kit";

const BROKEN = `{
  "stop": ["\\n\\n"],
  "logit_bias": { "50256": -100 }
  "response_format": { "type": "json_object" }
}`;

const SCHEMA = `{
  "type": "object",
  "properties": {
    "label": { "type": "string", "enum": ["billing", "bug", "other"] },
    "confidence": { "type": "number" }
  },
  "required": ["label"]
}`;

const SAVED = `{
  "temperature": 0.2,
  "max_tokens": 512,
  "stream": true,
  "user": null
}`;

function parsed(text: string) {
    if (!text.trim()) return "empty";
    try {
        return `valid, ${Object.keys(JSON.parse(text) as object).length} keys`;
    } catch {
        return "not valid JSON yet";
    }
}

export function JsonEditorDemo() {
    const [extra, setExtra] = useState("");
    return (
        <Spec
            name="JsonEditor"
            note="JSON is entered here, never in a Textarea. CodeMirror, loaded on first use: highlighting from the tokens, bracket matching, auto-closed brackets and quotes, indentation, and a parse error marked where it is. An empty editor is not an error."
        >
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Field id="json-empty" label="Extra body">
                        <JsonEditor
                            id="json-empty"
                            value={extra}
                            onValueChange={setExtra}
                            placeholder='{ "stop": ["\n\n"] }'
                        />
                    </Field>
                    <Note>{parsed(extra)}</Note>
                </div>
                <Field id="json-broken" label="With a parse error">
                    <JsonEditor id="json-broken" defaultValue={BROKEN} minLines={5} />
                </Field>
                <Field
                    id="json-server"
                    label="With a server diagnostic"
                    error="response_format.schema: enum is not supported by this engine"
                >
                    <JsonEditor
                        id="json-server"
                        defaultValue={SCHEMA}
                        diagnostics={[
                            {
                                line: 4,
                                column: 34,
                                length: 6,
                                message: "enum is not supported by this engine",
                            },
                        ]}
                    />
                </Field>
                <Field id="json-read-only" label="Read-only">
                    <JsonEditor id="json-read-only" defaultValue={SAVED} readOnly />
                </Field>
            </div>
            <div className="mt-5">
                <Api
                    items={[
                        {
                            name: "value / defaultValue",
                            note: "Controlled or uncontrolled text; onValueChange gets every edit. Parse the text yourself before sending it.",
                        },
                        {
                            name: "diagnostics",
                            note: "{ line, column, message, length?, severity? } from the server, 1-based, shown with the parse error.",
                        },
                        {
                            name: "minLines / maxLines",
                            note: "Grows with the text between the two, then scrolls.",
                            value: "3 / 16",
                        },
                        {
                            name: "readOnly, placeholder, id, aria-*",
                            note: "The same frame and props as SqlEditor; ref exposes focus() and insert(text).",
                        },
                    ]}
                />
            </div>
        </Spec>
    );
}
