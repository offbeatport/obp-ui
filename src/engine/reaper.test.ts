import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { sqlite } from "../db/index.js";
import { config } from "./config.js";
import { bootReclaim, renewLease, sweepExpiredLeases } from "./reaper.js";

// Crash-recovery DB transitions. checkpoint is left null so killPgid is a guarded no-op.

function clearAll() {
    sqlite.exec("DELETE FROM run; DELETE FROM action; DELETE FROM company;");
}
// A company mid-run: active + locked by the run, its action + run both 'running'.
function seedRunning(
    attempt = 0,
    leaseMsFromNow = config.leaseMs,
): { cid: string; aid: string; rid: string } {
    const cid = randomUUID();
    const aid = randomUUID();
    const rid = randomUUID();
    sqlite
        .prepare(
            "INSERT INTO company (id,name,thesis,status,autopilot,locked_by_run_id) VALUES (?,?,?,'active','off',?)",
        )
        .run(cid, "Co", "t", rid);
    sqlite
        .prepare(
            "INSERT INTO action (id,company_id,type,title,reversible,status,priority,payload) VALUES (?,?,'code','slice',1,'running',1,'{}')",
        )
        .run(aid, cid);
    sqlite
        .prepare(
            "INSERT INTO run (id,action_id,company_id,status,attempt,lease_expires_at) VALUES (?,?,?,'running',?,?)",
        )
        .run(rid, aid, cid, attempt, Date.now() + leaseMsFromNow);
    return { cid, aid, rid };
}
const one = (sql: string, ...p: unknown[]) =>
    sqlite.prepare(sql).get(...p) as Record<string, unknown>;

beforeEach(clearAll);

describe("bootReclaim", () => {
    it("reclaims a running run: fails the run, re-queues the action, releases the lock", () => {
        const { cid, aid, rid } = seedRunning(0);
        expect(bootReclaim()).toBe(1);
        expect(one("SELECT status FROM run WHERE id=?", rid).status).toBe("failed");
        expect(one("SELECT status FROM action WHERE id=?", aid).status).toBe("queued");
        expect(one("SELECT locked_by_run_id l FROM company WHERE id=?", cid).l).toBeNull();
    });

    it("blocks the action instead of re-queuing at max attempts", () => {
        const { aid } = seedRunning(config.maxAttempts - 1); // this attempt is the last
        bootReclaim();
        expect(one("SELECT status FROM action WHERE id=?", aid).status).toBe("blocked");
    });

    it("reclaims regardless of a still-future lease (a fresh crash)", () => {
        seedRunning(0, 10 * 60 * 1000); // lease far in the future
        expect(bootReclaim()).toBe(1);
    });
});

describe("sweepExpiredLeases", () => {
    it("reclaims a run whose lease has lapsed", () => {
        const { rid } = seedRunning(0, -1000); // already expired
        expect(sweepExpiredLeases(new Set())).toBe(1);
        expect(one("SELECT status FROM run WHERE id=?", rid).status).toBe("failed");
    });

    it("does NOT reclaim a run this executor is actively driving", () => {
        const { rid } = seedRunning(0, -1000);
        expect(sweepExpiredLeases(new Set([rid]))).toBe(0);
        expect(one("SELECT status FROM run WHERE id=?", rid).status).toBe("running");
    });

    it("does NOT reclaim a run whose lease is still valid", () => {
        seedRunning(0, config.leaseMs);
        expect(sweepExpiredLeases(new Set())).toBe(0);
    });
});

describe("renewLease", () => {
    it("pushes the lease into the future", () => {
        const { rid } = seedRunning(0, -1000); // currently expired
        renewLease(rid);
        const lease = one("SELECT lease_expires_at le FROM run WHERE id=?", rid).le as number;
        expect(lease).toBeGreaterThan(Date.now());
    });
});
