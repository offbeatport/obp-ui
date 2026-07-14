import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Git } from "./types.js";

const run = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
    const { stdout } = await run("git", args, { cwd, maxBuffer: 64 * 1024 * 1024 });
    return stdout.trim();
}
// non-throwing variant for best-effort cleanup steps
async function gitTry(cwd: string, ...args: string[]): Promise<void> {
    try {
        await git(cwd, ...args);
    } catch {
        /* best-effort */
    }
}

// LocalGitProvider - the v1 Git backbone: one bare local working repo per company under
// `companies/<id>/`, each carrying its own `slop/` brain + `AGENTS.md` so `git clone +
// claude` continues the company with no platform. Gitea / GitHub-org is the hosted drop-in.
export class LocalGitProvider implements Git {
    kind = "local-git";

    constructor(private readonly root = join(process.cwd(), "companies")) {}

    private dir(companyId: string): string {
        return join(this.root, companyId);
    }

    async ensureRepo(companyId: string): Promise<{ workdir: string }> {
        const workdir = this.dir(companyId);
        if (!existsSync(join(workdir, ".git"))) {
            await mkdir(join(workdir, "slop", "research"), { recursive: true });
            await git(workdir, "init", "-q", "-b", "main");
            await git(workdir, "config", "user.email", "agent@cslopslop.local");
            await git(workdir, "config", "user.name", "cslopslop agent");
            await writeFile(join(workdir, "AGENTS.md"), AGENTS_MD);
            // A minimal package.json makes the repo SELF-CONTAINED: without it, `node server.js`
            // walks up to a parent package.json (this platform's is "type":"module") and treats
            // the app's CommonJS server.js as ESM → `require is not defined`. "type":"commonjs"
            // pins it so a company runs the same wherever its repo lives (repo/, VPS, hosted).
            await writeFile(join(workdir, "package.json"), PACKAGE_JSON);
            await writeFile(join(workdir, "slop", "spec.md"), "# Spec\n\n(seeded at promotion)\n");
            await writeFile(join(workdir, "slop", "decisions.md"), "# Decisions\n\n");
            await writeFile(join(workdir, ".gitignore"), "node_modules\n.env\ndata.json\n");
            await git(workdir, "add", "-A");
            await git(workdir, "commit", "-q", "-m", "chore: seed company repo");
        }
        return { workdir };
    }

    seedSha(companyId: string): Promise<string> {
        return git(this.dir(companyId), "rev-parse", "HEAD");
    }

    // Start a run on a fresh branch cut from committed `main`, with a CLEAN tree - so the
    // agent never inherits a prior (failed/unapproved) run's files, and run branches are
    // true siblings off main (not a linear stack that an ff-only promote would ship through).
    async prepareRun(workdir: string, runId: string): Promise<void> {
        await rm(join(workdir, ".git", "index.lock"), { force: true });
        await gitTry(workdir, "merge", "--abort");
        await gitTry(workdir, "rebase", "--abort");
        await git(workdir, "checkout", "-q", "-B", `run/${runId}`, "main");
        await git(workdir, "reset", "-q", "--hard", "main");
        // `-fd` (NOT `-fdx`): clean stray untracked source, but PRESERVE gitignored files —
        // node_modules AND, critically, the shipped app's data.json. `-x` here destroyed live
        // customer signup data (and deps) out from under an already-shipped, still-serving app
        // when the same company's next slice built in this shared tree.
        await git(workdir, "clean", "-fd");
    }

    // Commit the run's work on its (already-checked-out) per-run branch, parented at main.
    // --allow-empty so a no-op run still produces a checkpoint sha.
    async commitAll(workdir: string, _runId: string, msg: string): Promise<string> {
        await git(workdir, "add", "-A");
        await git(workdir, "commit", "-q", "--allow-empty", "-m", msg);
        return git(workdir, "rev-parse", "HEAD");
    }

    // Crash recovery: drop any in-progress git state + untracked files back to the sha.
    async resetClean(workdir: string, sha: string): Promise<void> {
        await rm(join(workdir, ".git", "index.lock"), { force: true });
        await gitTry(workdir, "merge", "--abort");
        await gitTry(workdir, "rebase", "--abort");
        await git(workdir, "reset", "-q", "--hard", sha);
        await git(workdir, "clean", "-fdx");
    }

    // Ship: fast-forward the canonical branch to the approved checkpoint.
    async promote(companyId: string, sha: string): Promise<void> {
        const workdir = this.dir(companyId);
        await git(workdir, "checkout", "-q", "main");
        try {
            await git(workdir, "merge", "--ff-only", sha);
        } catch {
            // not a fast-forward (shouldn't happen with the single-run invariant) → hard-set main
            await git(workdir, "reset", "-q", "--hard", sha);
        }
    }

    async pruneWorktrees(companyId: string): Promise<void> {
        await gitTry(this.dir(companyId), "worktree", "prune");
    }
}

const PACKAGE_JSON = `${JSON.stringify(
    { name: "cslopslop-company", private: true, type: "commonjs" },
    null,
    2,
)}\n`;

const AGENTS_MD = `# AGENTS.md

This is a C Slop Slop company. Read \`slop/\` first (spec, decisions, research), then ship
ONE validated, user-facing feature and persist your reasoning back to \`slop/decisions.md\`.

- \`slop/spec.md\` - the bet: what it is, who it's for, the wedge.
- \`slop/decisions.md\` - append-only one-liners (what + why).
- \`slop/research/\` - the opportunity report (point-in-time demand evidence).

CLAUDE.md / CODEX.md point here. \`git clone + claude\` continues this company with no platform.
`;
