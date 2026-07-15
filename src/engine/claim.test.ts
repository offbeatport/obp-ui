import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { sqlite } from "../db/index.js";
import { claimNext } from "./claim.js";

// The atomic CAS claim - the core of the run-executor spine. No AI/mocks needed; pure DB.

function clearAll() {
    sqlite.exec("DELETE FROM run; DELETE FROM action; DELETE FROM company;");
}
function makeCompany(
    opts: Partial<{ status: string; locked: boolean; budget: number }> = {},
): string {
    const id = randomUUID();
    sqlite
        .prepare(
            "INSERT INTO company (id,name,thesis,status,autopilot,budget_cap_usd,locked_by_run_id) VALUES (?,?,?,?,'off',?,?)",
        )
        .run(
            id,
            "Co",
            "t",
            opts.status ?? "active",
            opts.budget ?? null,
            opts.locked ? "somerun" : null,
        );
    return id;
}
function makeAction(
    companyId: string,
    opts: Partial<{ type: string; status: string; priority: number; dependsOn: string[] }> = {},
): string {
    const id = randomUUID();
    sqlite
        .prepare(
            'INSERT INTO action (id,company_id,type,title,reversible,status,priority,depends_on,payload) VALUES (?,?,?,?,1,?,?,?,\'{"doneWhen":"http-signup"}\')',
        )
        .run(
            id,
            companyId,
            opts.type ?? "code",
            "slice",
            opts.status ?? "queued",
            opts.priority ?? 1,
            opts.dependsOn ? JSON.stringify(opts.dependsOn) : null,
        );
    return id;
}
const actionStatus = (id: string) =>
    (sqlite.prepare("SELECT status FROM action WHERE id=?").get(id) as { status: string }).status;
const companyLock = (id: string) =>
    (
        sqlite.prepare("SELECT locked_by_run_id l FROM company WHERE id=?").get(id) as {
            l: string | null;
        }
    ).l;
const runCount = (companyId: string) =>
    (
        sqlite.prepare("SELECT COUNT(*) n FROM run WHERE company_id=?").get(companyId) as {
            n: number;
        }
    ).n;

beforeEach(clearAll);

describe("claimNext", () => {
    it("claims a queued code action: creates a running run, marks the action running, locks the company", () => {
        const cid = makeCompany();
        const aid = makeAction(cid);
        const claim = claimNext("inst-1");
        expect(claim).not.toBeNull();
        expect(claim?.actionId).toBe(aid);
        expect(claim?.companyId).toBe(cid);
        expect(actionStatus(aid)).toBe("running");
        expect(companyLock(cid)).toBe(claim?.runId);
        expect(runCount(cid)).toBe(1);
    });

    it("returns null when there is nothing to claim", () => {
        expect(claimNext("inst-1")).toBeNull();
    });

    it("does not claim from a locked company", () => {
        const cid = makeCompany({ locked: true });
        makeAction(cid);
        expect(claimNext("inst-1")).toBeNull();
    });

    it("does not claim from a paused company", () => {
        const cid = makeCompany({ status: "paused" });
        makeAction(cid);
        expect(claimNext("inst-1")).toBeNull();
    });

    it("does not claim a non-code action", () => {
        const cid = makeCompany();
        makeAction(cid, { type: "message" });
        expect(claimNext("inst-1")).toBeNull();
    });

    it("does not claim an action with an unfinished dependency", () => {
        const cid = makeCompany();
        const dep = makeAction(cid, { status: "queued" }); // dependency not done
        makeAction(cid, { dependsOn: [dep] });
        // the only claimable one is the dep itself (no deps); claim it, then the dependent is
        // still blocked because dep is now 'running', not 'done'.
        const first = claimNext("inst-1");
        expect(first?.actionId).toBe(dep);
        // company now locked → nothing else claimable regardless
        expect(claimNext("inst-2")).toBeNull();
    });

    it("does not claim when the company is over its budget cap", () => {
        const cid = makeCompany({ budget: 1 });
        const aid = makeAction(cid);
        // a prior run already spent over the cap (real action_id to satisfy the FK)
        sqlite
            .prepare(
                "INSERT INTO run (id,action_id,company_id,status,attempt,cost_usd) VALUES (?,?,?,'succeeded',0,5)",
            )
            .run(randomUUID(), aid, cid);
        expect(claimNext("inst-1")).toBeNull();
    });

    it("claims the higher-priority action first", () => {
        const cid = makeCompany();
        makeAction(cid, { priority: 1 });
        const hi = makeAction(cid, { priority: 9 });
        expect(claimNext("inst-1")?.actionId).toBe(hi);
    });
});
