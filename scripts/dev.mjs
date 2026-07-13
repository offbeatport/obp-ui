// Dev launcher: runs the two processes of the spine side by side over the shared WAL DB.
//   web    = vite dev (UI + server fns + SSE route)
//   engine = the executor daemon (claim loop, runs, reaper)
// The engine runs as plain `tsx` (NOT `tsx watch`) on purpose: editing an engine file
// must not SIGTERM a live run and silently burn an attempt. Restart it by hand (or
// restart `pnpm dev`) when you change engine code.
import { spawn } from "node:child_process";

const procs = [];
let shuttingDown = false;

function tag(name, buf) {
  const label = `\x1b[2m[${name}]\x1b[0m`;
  return buf
    .toString()
    .split("\n")
    .map((l, i, arr) => (i === arr.length - 1 && l === "" ? "" : `${label} ${l}\n`))
    .join("");
}

function run(name, args) {
  const p = spawn("pnpm", args, { env: process.env });
  p.stdout.on("data", (d) => process.stdout.write(tag(name, d)));
  p.stderr.on("data", (d) => process.stderr.write(tag(name, d)));
  p.on("exit", (code) => {
    console.log(`[dev] ${name} exited (${code}) — shutting down`);
    shutdown();
  });
  procs.push(p);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    try {
      p.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(0), 400);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run("web", ["run", "dev:web"]);
run("engine", ["run", "dev:engine"]);
console.log("[dev] web + engine starting — http://localhost:3000");
