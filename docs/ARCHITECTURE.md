# Architecture — run-executor spine

> Diagrams are [Mermaid](https://mermaid.js.org/) — they render natively on GitHub and in VS Code (install the "Markdown Preview Mermaid Support" extension). Edit the fenced ` ```mermaid ` blocks as plain text.

## Process topology

Two OS processes coordinate through **one WAL SQLite file** (queue/lease/lock state) and **per-run NDJSON log files** (the log bus). No sockets, no IPC.

```mermaid
flowchart TB
    browser["🖥️ Browser<br/>Action Queue UI"]

    subgraph web["Web process — vite dev :3000"]
        serverfns["Server fns<br/>enqueue · list · reset"]
        sse["SSE route<br/>/api/runs/$runId/logs"]
    end

    subgraph exec["Executor daemon — tsx (src/engine/)"]
        loop["loop.ts<br/>poll → claim → run"]
        claim["claim.ts<br/>BEGIN IMMEDIATE + lock CAS"]
        runner["runner.ts<br/>runOne"]
        reaper["reaper.ts<br/>boot reclaim · lease sweep"]

        subgraph seams["Seams (src/engine/seams/)"]
            harness["Harness ✅ NoopHarness"]
            sandbox["Sandbox ⬜ LocalShell"]
            deploy["Deploy ⬜ LocalProcessDeploy"]
            git["Git ⬜ LocalGitProvider"]
            validator["Validator ⬜ HttpSignupCheck"]
        end
    end

    db[("cslopslop.db<br/>WAL SQLite<br/>company · action · run")]
    ndjson[[".runs/&lt;runId&gt;/log.ndjson<br/>append-only log bus"]]

    browser -->|"HTTP"| serverfns
    browser -->|"EventSource"| sse
    serverfns -->|"tiny writes"| db
    loop --> claim --> db
    loop --> runner --> harness
    runner -->|"append lines"| ndjson
    reaper --> db
    sse -->|"size-poll tail"| ndjson

    classDef done fill:#22c55e22,stroke:#22c55e;
    classDef todo fill:#a5b6d611,stroke:#64748b,stroke-dasharray:4 3;
    class harness done;
    class sandbox,deploy,git,validator todo;
```

Legend: **✅ implemented** · **⬜ interface only** (local impls land in build steps 4–6).

Key rules encoded above:
- The **executor** is a separate `tsx` process (survives Vite HMR; keeps synchronous SQLite + minutes-long subprocess supervision off the HTTP/SSR loop).
- The **claim** is one `BEGIN IMMEDIATE` transaction doing sub-millisecond writes only; all build/deploy/agent work runs *outside* it. A company-lock CAS (`UPDATE … WHERE locked_by_run_id IS NULL`) is the cross-process guard.
- The **web process is write-minimal** — it never spawns subprocesses, so the synchronous `busy_timeout` wait can't stall HTTP/SSE.
- **Crash recovery** = replay from the git-sha checkpoint; boot reclaims every `running` run left by a dead executor.

## Run + action state machine

```mermaid
stateDiagram-v2
    direction LR
    [*] --> queued : enqueue

    queued --> running : claim (lock company)
    running --> done : NoopHarness ✅
    running --> queued : reclaim / retry (attempt < 3)
    running --> blocked : max attempts / no-progress

    state "steps 4–6 (planned)" as future {
        running2 : running
        running2 --> awaiting_approval : deploy + validate green
        awaiting_approval --> approved : you Approve
        awaiting_approval --> queued : Reject-with-feedback
        approved --> done2 : ship driver (Git.promote)
        done2 : done
    }

    done --> [*]
    blocked --> [*]

    note right of running
        Control plane (built) goes
        straight running → done.
        The approval gate + ship
        arrive with the real harness.
    end note
```

Today's control plane (NoopHarness) runs `queued → running → done`; the `awaiting_approval → approved → ship` path is wired into the schema (`action.status` enum) but activated in steps 5–6 when the real build → deploy → validate exists.

## Deployment placements — one engine, two homes

The seams exist so the **local open-core** and the **hosted multi-tenant** product are the same engine with different implementations injected at each boundary.

```mermaid
flowchart LR
    subgraph engine["One engine (loop · claim · reaper)"]
        s1["Harness"]
        s2["Sandbox"]
        s3["Deploy"]
        s4["Git"]
    end

    subgraph local["Self-host (v1)"]
        l1["ClaudeCliHarness"]
        l2["LocalShell"]
        l3["LocalProcessDeploy"]
        l4["LocalGitProvider"]
    end

    subgraph hosted["Hosted (next)"]
        h1["OpenRouter / Codex"]
        h2["CloudSandbox (microVM)"]
        h3["Docker / cloud infra"]
        h4["Gitea / GitHub org"]
    end

    s1 -.-> l1 & h1
    s2 -.-> l2 & h2
    s3 -.-> l3 & h3
    s4 -.-> l4 & h4
```

Swapping self-host → hosted means injecting the right-hand implementations at each seam — the run loop never changes.
