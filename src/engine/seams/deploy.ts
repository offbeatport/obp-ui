import { createServer } from "node:net";
import type { Deploy, DeploySpec, Deployment, Sandbox } from "./types.js";

// LocalDeploy — the v1 Deploy seam: run the built app as a detached host subprocess
// (through the injected Sandbox, so it gets its own process group and the reaper can
// kill(-pgid) it) on a real 127.0.0.1 port, and block until it answers HTTP. The
// company's live URL is what the Validator (and later, you) hits. CloudDeploy
// (Fly/Coolify/containers) is the hosted drop-in behind this same interface.
//
// One deploy per company: up() supersedes any prior deploy for that company before
// starting the new one, so a re-run never leaks the previous port. The registry is
// in-memory (single executor); the pgid is also persisted to run.checkpoint.deployPgid
// so a crashed executor's boot reaper still kills the orphan.
type Live = Deployment & { runId?: string };

export class LocalDeploy implements Deploy {
    kind = "local-deploy";
    private readonly live = new Map<string, Live>();

    constructor(
        private readonly sandbox: Sandbox,
        private readonly range: [number, number] = [43000, 43999],
        private readonly healthTimeoutMs = 15_000,
    ) {}

    /** The current deployment for a company, if one is live (for previewUrl reads). */
    get(companyId: string): Deployment | undefined {
        return this.live.get(companyId);
    }

    async up(spec: DeploySpec): Promise<Deployment> {
        await this.down(spec.companyId); // supersede any prior deploy for this company
        const port = await findFreePort(preferredPort(spec.companyId, this.range), this.range);

        const [cmd, ...args] = spec.startCmd.split(" ");
        const proc = this.sandbox.spawn({
            cmd,
            args,
            cwd: spec.workdir,
            env: { PORT: String(port) },
        });

        // Drain stdio: an unread pipe fills at ~64KB and blocks the child. Keep a bounded
        // stderr tail so a crash-on-boot surfaces a useful reason instead of a bare timeout.
        proc.stdout.on("data", () => {});
        let errTail = "";
        proc.stderr.on("data", (b: Buffer) => {
            errTail = (errTail + b.toString()).slice(-800);
        });
        let exited = false;
        void proc.wait().then(() => {
            exited = true;
        });

        const url = `http://127.0.0.1:${port}`;
        const healthy = await waitForHealth(
            url + (spec.healthPath || "/"),
            () => exited,
            this.healthTimeoutMs,
        );
        if (!healthy) {
            await this.sandbox.kill(proc.pgid);
            const why = exited ? "process exited before serving" : "health check timed out";
            throw new Error(`deploy failed: ${why}${errTail ? ` — ${errTail.trim()}` : ""}`);
        }

        const dep: Live = { url, pid: proc.pid, pgid: proc.pgid, port, runId: spec.runId };
        this.live.set(spec.companyId, dep);
        return { url, pid: proc.pid, pgid: proc.pgid, port };
    }

    async down(companyId: string): Promise<void> {
        const d = this.live.get(companyId);
        if (!d) return;
        this.live.delete(companyId);
        await this.sandbox.kill(d.pgid);
    }

    // Mark a company's deploy as shipped/persistent so reconcile never reaps it (the
    // product stays live after ship). A no-op if nothing is deployed for the company.
    persist(companyId: string): void {
        const d = this.live.get(companyId);
        if (d) d.runId = undefined;
    }

    // Kill deploys tied to a run that is no longer live (crashed mid-validation). Shipped
    // deploys (runId cleared via persist) are never reaped. Local single-executor rarely
    // needs this; it's here so the hosted impl's contract is honored.
    async reconcile(liveRunIds: string[]): Promise<void> {
        const keep = new Set(liveRunIds);
        for (const [companyId, d] of this.live) {
            if (d.runId && !keep.has(d.runId)) await this.down(companyId);
        }
    }
}

// Deterministic per-company base port keeps re-runs on a stable port (and different
// companies apart) without any persistence; findFreePort steps past collisions.
function preferredPort(companyId: string, [lo, hi]: [number, number]): number {
    let h = 2166136261;
    for (let i = 0; i < companyId.length; i++) {
        h = (h ^ companyId.charCodeAt(i)) * 16777619;
    }
    return lo + (Math.abs(h) % (hi - lo + 1));
}

// First free TCP port at/after `start`, wrapping within [lo,hi]. Probes by binding.
async function findFreePort(start: number, [lo, hi]: [number, number]): Promise<number> {
    const span = hi - lo + 1;
    for (let i = 0; i < span; i++) {
        const port = lo + ((((start - lo + i) % span) + span) % span);
        if (await portFree(port)) return port;
    }
    throw new Error(`deploy: no free port in [${lo}, ${hi}]`);
}

function portFree(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const srv = createServer();
        srv.once("error", () => resolve(false));
        srv.once("listening", () => srv.close(() => resolve(true)));
        srv.listen(port, "127.0.0.1");
    });
}

// Poll until the app answers HTTP at all (any status = the port is serving), or the
// process dies, or we time out. The Validator does the real doneWhen assertions after.
async function waitForHealth(
    url: string,
    exited: () => boolean,
    timeoutMs: number,
): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (exited()) return false;
        try {
            await fetch(url, { signal: AbortSignal.timeout(1000) });
            return true;
        } catch {
            await sleep(300);
        }
    }
    return false;
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
