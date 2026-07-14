import { describe, expect, it } from "vitest";
import { sliceState, slugify } from "./data.js";

describe("slugify", () => {
    it("lowercases and hyphenates", () => {
        expect(slugify("Acme Widgets")).toBe("acme-widgets");
        expect(slugify("A  Tool!! for $$ things")).toBe("a-tool-for-things");
    });
    it("falls back to 'company' when nothing survives", () => {
        expect(slugify("!!!")).toBe("company");
        expect(slugify("")).toBe("company");
    });
});

describe("sliceState", () => {
    it("projects action.status onto the UI slice lifecycle", () => {
        expect(sliceState("running")).toBe("building");
        expect(sliceState("approved")).toBe("building");
        expect(sliceState("awaiting_approval")).toBe("awaiting_approval");
        expect(sliceState("blocked")).toBe("blocked");
        expect(sliceState("done")).toBe("shipped");
        expect(sliceState("queued")).toBe("todo");
    });
});
