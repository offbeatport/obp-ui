import { describe, expect, it } from "vitest";
import type { Action } from "../db/index.js";
import { pickCurrent, sliceState, slugify } from "./data.js";

// Minimal Action factory — pickCurrent only reads status; id/createdAt just need to exist.
let seq = 0;
const act = (status: Action["status"]): Action =>
    ({ id: `a${seq++}`, status, type: "code" }) as Action;

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

describe("pickCurrent", () => {
    it("prefers in-flight (running/awaiting/approved) over everything else", () => {
        expect(pickCurrent([act("queued"), act("running"), act("done")])?.status).toBe("running");
        expect(pickCurrent([act("blocked"), act("awaiting_approval")])?.status).toBe(
            "awaiting_approval",
        );
    });
    it("falls back to blocked, then queued, then most-recent shipped", () => {
        expect(pickCurrent([act("done"), act("blocked"), act("queued")])?.status).toBe("blocked");
        expect(pickCurrent([act("done"), act("queued")])?.status).toBe("queued");
        const last = act("done");
        expect(pickCurrent([act("done"), last])).toBe(last); // reversed find → newest done
    });
    it("returns undefined for no code actions", () => {
        expect(pickCurrent([])).toBeUndefined();
    });
});
