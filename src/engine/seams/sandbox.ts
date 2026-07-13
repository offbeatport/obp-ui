import { spawn } from "node:child_process";
import type { Sandbox, SandboxProc, SpawnSpec } from "./types.js";

// LocalShell — the v1 Sandbox: spawn the agent/app as a host child process in its OWN
// process group (detached), so the reaper can kill(-pgid) the whole tree after a crash.
// CloudSandbox (microVM/container) is the hosted drop-in behind the same interface — the
// reason --dangerously-skip-permissions inheriting host secrets is only acceptable locally.
export class LocalShell implements Sandbox {
  kind = "local-shell";

  spawn(spec: SpawnSpec): SandboxProc {
    const child = spawn(spec.cmd, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      detached: true, // new process group → pgid === pid on POSIX
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (spec.stdin != null) {
      child.stdin?.write(spec.stdin);
      child.stdin?.end();
    }
    const pid = child.pid ?? -1;
    if (!child.stdout || !child.stderr) {
      throw new Error("LocalShell: child stdio not available");
    }
    return {
      pid,
      pgid: pid,
      stdout: child.stdout,
      stderr: child.stderr,
      wait: () => new Promise((resolve) => child.on("close", (code) => resolve({ code }))),
    };
  }

  async kill(pgid: number): Promise<void> {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}
