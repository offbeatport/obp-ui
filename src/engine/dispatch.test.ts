import { describe, expect, it } from "vitest";
import { toClaudeCliModel } from "./dispatch.js";

// Regression guard for the fix: `claude -p --model claude-3.5-haiku` 404s; the CLI wants
// tier aliases. This mapping is what makes real-AI thinking work on the keyless path.
describe("toClaudeCliModel", () => {
    it("maps OpenRouter-style slugs to CLI aliases", () => {
        expect(toClaudeCliModel("claude-3.5-haiku")).toBe("haiku");
        expect(toClaudeCliModel("claude-3.7-sonnet")).toBe("sonnet");
        expect(toClaudeCliModel("anthropic/claude-3-opus")).toBe("opus");
    });
    it("passes bare aliases through (case-insensitive)", () => {
        expect(toClaudeCliModel("haiku")).toBe("haiku");
        expect(toClaudeCliModel("SONNET")).toBe("sonnet");
    });
    it("returns undefined for unknown / empty so the CLI picks its default", () => {
        expect(toClaudeCliModel(undefined)).toBeUndefined();
        expect(toClaudeCliModel("")).toBeUndefined();
        expect(toClaudeCliModel("gpt-4o")).toBeUndefined();
    });
});
