import { CodeBlock, type CodeTab, CodeTabs } from "obp-ui";
import { Api, Note, Spec } from "../kit";

const BASE_URL = "http://localhost:8000/v1";

const CLIENTS: CodeTab[] = [
    {
        id: "curl",
        label: "curl",
        language: "bash",
        code: [
            `curl ${BASE_URL}/chat/completions \\`,
            '  -H "Authorization: Bearer YOUR_KEY" \\',
            '  -H "Content-Type: application/json" \\',
            `  -d '{"model": "support-triage", "messages": [{"role": "user", "content": "I was charged twice"}]}'`,
        ].join("\n"),
    },
    {
        id: "python",
        label: "Python",
        language: "python",
        code: [
            "from openai import OpenAI",
            "",
            `client = OpenAI(base_url="${BASE_URL}", api_key="YOUR_KEY")`,
            "reply = client.chat.completions.create(",
            '    model="support-triage",',
            '    messages=[{"role": "user", "content": "I was charged twice"}],',
            "    temperature=0.2,",
            ")",
            "print(reply.choices[0].message.content)",
        ].join("\n"),
    },
    {
        id: "javascript",
        label: "JavaScript",
        language: "javascript",
        code: [
            'import OpenAI from "openai";',
            "",
            `const client = new OpenAI({ baseURL: "${BASE_URL}", apiKey: "YOUR_KEY" });`,
            "const reply = await client.chat.completions.create({",
            '    model: "support-triage",',
            '    messages: [{ role: "user", content: "I was charged twice" }],',
            "    stream: false,",
            "});",
            "console.log(reply.choices[0].message.content);",
        ].join("\n"),
    },
    {
        id: "litellm",
        label: "LiteLLM",
        language: "yaml",
        title: "config.yaml",
        code: [
            "model_list:",
            "  - model_name: support-triage",
            "    litellm_params:",
            "      model: openai/support-triage",
            `      api_base: ${BASE_URL}`,
            "      api_key: YOUR_KEY # from Deployments",
        ].join("\n"),
    },
];

const JSON_SAMPLE = `{
  "id": "chatcmpl-abc123",
  "model": "support-triage",
  "choices": [{ "index": 0, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 18, "completion_tokens": 3 },
  "cached": false,
  "user": null
}`;

const SQL_SAMPLE = `-- Billing tickets from the last week
SELECT body AS input, queue AS label
FROM tickets
WHERE created_at > now() - INTERVAL 7 DAY
  AND queue IN ('billing', 'refunds')
LIMIT 500`;

const TS_SAMPLE = `type Rating = "up" | "down";

export async function rate(id: string, rating: Rating): Promise<void> {
    await fetch("/v1/feedback", { method: "POST", body: JSON.stringify({ response_id: id, rating }) });
}`;

const ENV_SAMPLE = `OPENAI_BASE_URL=${BASE_URL}
OPENAI_API_KEY=YOUR_KEY
OPENAI_MODEL=support-triage`;

const LONG_LINE =
    "minibrain engine --model qwen2.5-7b-instruct --main-url http://10.0.4.12:8000 --pool gpu --host 0.0.0.0 --port 8100 --max-model-len 8192";

export function CodeBlockDemo() {
    return (
        <>
            <Spec
                name="CodeBlock"
                note="Code is always shown in a CodeBlock, never a bare pre. Highlighted from the syntax tokens with the editors' Lezer parsers, loaded per language on first use; a Copy button with Copied feedback, a title row for a file name or caption, and long lines scroll unless wrap is on."
            >
                <div className="grid gap-5 lg:grid-cols-2">
                    <CodeBlock code={JSON_SAMPLE} language="json" title="Response" />
                    <CodeBlock code={SQL_SAMPLE} language="sql" title="Query" />
                    <CodeBlock code={TS_SAMPLE} language="typescript" title="rate.ts" />
                    <CodeBlock code={ENV_SAMPLE} language="bash" title=".env" />
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <CodeBlock code="minibrain admin setup-link" language="bash" />
                        <Note>
                            No title: the copy button sits in the corner, named by copyLabel.
                        </Note>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <CodeBlock code={LONG_LINE} language="bash" wrap copy={false} />
                        <Note>wrap, and copy off.</Note>
                    </div>
                </div>
                <div className="mt-5 flex min-w-0 flex-col gap-1.5">
                    <CodeBlock code={LONG_LINE} language="bash" title="Long lines scroll" />
                </div>
                <div className="mt-5">
                    <Api
                        items={[
                            {
                                name: "code / language",
                                note: "bash (curl, .env and CLI lines), python, javascript, typescript, json, yaml, sql or text. codeLanguage(name) maps a Markdown fence name such as sh, py, js, ts or yml.",
                                value: "text",
                            },
                            {
                                name: "title",
                                note: "A file name or caption in a row above the code, with the Copy button on its right.",
                            },
                            {
                                name: "copy / copyLabel",
                                note: "The Copy button and its accessible name. Without the clipboard API it copies the selection, and if that fails too it selects the code and says which keys to press.",
                                value: "true / Copy",
                            },
                            {
                                name: "wrap",
                                note: "Wrap long lines instead of scrolling them sideways.",
                                value: "false",
                            },
                            {
                                name: "className",
                                note: "On the frame; a max-h-* makes the code scroll inside it.",
                            },
                        ]}
                    />
                </div>
            </Spec>
            <Spec
                name="CodeTabs"
                note="One snippet in several languages or clients: line tabs over a CodeBlock. Each tab's Copy button is named after it, and a tab may carry its own title (a file name) over the shared one."
            >
                <CodeTabs items={CLIENTS} title="Copy, paste and run." />
                <div className="mt-5">
                    <Api
                        items={[
                            {
                                name: "items",
                                note: "{ id, label, code, language, title? } per tab, in order.",
                            },
                            {
                                name: "title",
                                note: "The caption for tabs without a title of their own.",
                            },
                            {
                                name: "defaultValue, wrap, blockClassName",
                                note: "The first tab opens by default; wrap and blockClassName pass to every CodeBlock.",
                            },
                        ]}
                    />
                </div>
            </Spec>
        </>
    );
}
