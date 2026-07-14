import { spawn } from "node:child_process";
import type { AiTask } from "../config/ai-catalog.js";
import { type ResolvedTask, resolveTaskModel } from "../config/ai-tasks.js";

// dispatchAI — the AI proxy for the *thinking* tasks (opportunities · research · plan ·
// write · chat · orchestrate). It is the brain, distinct from the build harness (the
// hands, src/engine/seams/harness.ts). One resolver (resolveTaskModel) picks the route;
// this executes it over three transports:
//   • claude-cli — the keyless default: one-shot `claude -p` on the host subscription.
//   • anthropic  — direct Messages API (x-api-key), when an Anthropic key is set.
//   • openai-compat — OpenRouter and every other provider's /chat/completions.
// Callers (planning/scoring/chat drivers) get plain text back and never branch on route.

export type DispatchInput = {
    prompt: string;
    system?: string;
    maxTokens?: number;
    signal?: AbortSignal;
};
export type DispatchResult = {
    text: string;
    model: string;
    via: "claude-cli" | "direct" | "openrouter";
    costUsd: number;
};

export async function dispatchAI(
    task: Exclude<AiTask, "build">,
    input: DispatchInput,
    env: NodeJS.ProcessEnv = process.env,
): Promise<DispatchResult> {
    const r = resolveTaskModel(task, env);
    if (r.kind === "harness") {
        throw new Error(`dispatchAI: '${task}' resolves to a build harness, not a thinking task`);
    }
    if (r.via === "claude-cli") return dispatchClaudeCli(r, input, env);
    if (r.provider === "anthropic" && r.via === "direct") return dispatchAnthropic(r, input);
    return dispatchOpenAICompat(r, input);
}

// One-shot `claude -p` on the host login (subscription). `--output-format json` gives a
// single envelope with the final text + cost; the prompt goes via stdin (avoids ARG_MAX).
function dispatchClaudeCli(
    r: Extract<ResolvedTask, { kind: "model" }>,
    input: DispatchInput,
    env: NodeJS.ProcessEnv,
): Promise<DispatchResult> {
    const bin = env.CSLOP_HARNESS_BIN ?? "claude";
    const args = ["-p", "--output-format", "json"];
    // The `claude` CLI takes short aliases (haiku/sonnet/opus), NOT OpenRouter-style slugs
    // like "claude-3.5-haiku" (which 404 with is_error). Map any configured model to an
    // alias; unknown → omit --model and let the CLI's default pick.
    const cliModel = toClaudeCliModel(r.model);
    if (cliModel) args.push("--model", cliModel);
    if (input.system) args.push("--append-system-prompt", input.system);

    return new Promise((resolve, reject) => {
        const child = spawn(bin, args, { env: { ...env }, stdio: ["pipe", "pipe", "pipe"] });
        let out = "";
        let err = "";
        const onAbort = () => child.kill("SIGKILL");
        input.signal?.addEventListener("abort", onAbort);
        child.on("error", (e) => {
            input.signal?.removeEventListener("abort", onAbort);
            reject(e);
        });
        child.stdout.on("data", (b: Buffer) => {
            out += b.toString();
        });
        child.stderr.on("data", (b: Buffer) => {
            err += b.toString();
        });
        child.stdin.on("error", () => {}); // swallow EPIPE
        child.stdin.write(input.prompt);
        child.stdin.end();
        child.on("close", (code) => {
            input.signal?.removeEventListener("abort", onAbort);
            if (code !== 0) return reject(new Error(`claude -p exited ${code}: ${err.trim()}`));
            try {
                const j = JSON.parse(out) as {
                    result?: string;
                    is_error?: boolean;
                    total_cost_usd?: number;
                    session_id?: string;
                };
                // The CLI exits 0 even on an API error (e.g. bad model → 404) and puts the
                // error prose in `result`. Treat is_error as a failure so callers fall back
                // to their deterministic path instead of surfacing the error as an answer.
                if (j.is_error) {
                    return reject(new Error(`claude -p: ${(j.result ?? "api error").trim()}`));
                }
                resolve({
                    text: (j.result ?? "").trim(),
                    model: r.model || "claude",
                    via: "claude-cli",
                    costUsd: typeof j.total_cost_usd === "number" ? j.total_cost_usd : 0,
                });
            } catch {
                // Older CLIs may print bare text — return it as-is rather than failing.
                resolve({
                    text: out.trim(),
                    model: r.model || "claude",
                    via: "claude-cli",
                    costUsd: 0,
                });
            }
        });
    });
}

// Anthropic Messages API (direct key). Distinct wire shape from OpenAI-compatible.
async function dispatchAnthropic(
    r: Extract<ResolvedTask, { kind: "model" }>,
    input: DispatchInput,
): Promise<DispatchResult> {
    if (!r.apiKey) throw new Error("dispatchAI: no Anthropic API key configured");
    const res = await fetch(`${r.baseUrl.replace(/\/$/, "")}/messages`, {
        method: "POST",
        headers: {
            "x-api-key": r.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model: r.model,
            max_tokens: input.maxTokens ?? 1024,
            ...(input.system ? { system: input.system } : {}),
            messages: [{ role: "user", content: input.prompt }],
        }),
        signal: input.signal ?? AbortSignal.timeout(60_000),
    });
    if (!res.ok)
        throw new Error(`dispatchAI: Anthropic HTTP ${res.status} — ${await snippet(res)}`);
    const j = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (j.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
    return { text: text.trim(), model: r.model, via: "direct", costUsd: 0 };
}

// OpenAI-compatible /chat/completions — OpenRouter and direct OpenAI/xAI/Perplexity/z.ai/custom.
async function dispatchOpenAICompat(
    r: Extract<ResolvedTask, { kind: "model" }>,
    input: DispatchInput,
): Promise<DispatchResult> {
    if (!r.apiKey) throw new Error(`dispatchAI: no API key configured for ${r.provider}`);
    const messages: Array<{ role: string; content: string }> = [];
    if (input.system) messages.push({ role: "system", content: input.system });
    messages.push({ role: "user", content: input.prompt });

    const res = await fetch(`${r.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${r.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
            model: r.model,
            messages,
            ...(input.maxTokens ? { max_tokens: input.maxTokens } : {}),
        }),
        signal: input.signal ?? AbortSignal.timeout(60_000),
    });
    if (!res.ok)
        throw new Error(`dispatchAI: ${r.provider} HTTP ${res.status} — ${await snippet(res)}`);
    const j = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    return {
        text: (j.choices?.[0]?.message?.content ?? "").trim(),
        model: r.model,
        via: r.via,
        costUsd: 0,
    };
}

// Map a configured model to a `claude` CLI alias. Accepts our slugs ("claude-3.5-haiku"),
// bare aliases ("haiku"), or anything containing the tier word; unknown → undefined (CLI default).
export function toClaudeCliModel(model?: string): string | undefined {
    if (!model) return undefined;
    const s = model.toLowerCase();
    if (s.includes("opus")) return "opus";
    if (s.includes("haiku")) return "haiku";
    if (s.includes("sonnet")) return "sonnet";
    return undefined;
}

async function snippet(res: Response): Promise<string> {
    try {
        return (await res.text()).slice(0, 300);
    } catch {
        return res.statusText;
    }
}
