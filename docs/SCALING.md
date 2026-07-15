# Scaling

Today's build is **single-node**: one web process + one executor over one local SQLite/WAL file,
with local subprocess deploys. It comfortably runs a handful–low-tens of active companies. This
doc is the path to thousands of users. The design is built for it - every wall below is a *local
impl behind a seam*, swappable for a distributed one, not a rewrite. Coordination is already rows
in a DB, so the logic ports.

## Current hard walls (single-node)

| Wall | Where | Limit |
|---|---|---|
| One SQLite writer (sync `better-sqlite3`, `busy_timeout=2000ms`) | `src/db/index.ts` | write contention stalls the SSR loop |
| One executor, `maxConcurrentRuns: 2` | `src/engine/config.ts`, `loop.ts` | ~2 concurrent builds total |
| Local deploys, port range `43000–43999` | `src/engine/seams/deploy.ts` | ~1000 live apps / host |
| Local git repos + `.runs/*.ndjson` logs on one disk | `seams/git.ts`, `engine/log.ts` | disk/inode pressure |
| Single-executor invariant, no tenancy | `reaper.ts`, `src/server/identity.ts` | `getIdentity` returns fixed `local` principal |

## Scaling steps (in order)

1. **DB → Postgres.** Replace the single local SQLite with Postgres (or per-tenant SQLite/LiteFS).
   Claim/lease/lock are already row-based (`claim.ts` CAS + lease) so they port; the work is the
   driver + async queries. Unblocks concurrent writers → removes wall #1.

2. **Executor fleet.** Run N executors. The lease/heartbeat/sweep machinery already exists for
   this (`reaper.sweepExpiredLeases` is "reserved for the multi-executor path"); flip the
   single-executor `bootReclaim` assumption to lease-gated, and raise `maxConcurrentRuns` per node.
   Removes wall #2.

3. **Cloud sandbox.** Drop `CloudSandbox` (microVM/container) behind the `Sandbox` seam
   (`seams/types.ts`) so agent + app processes run isolated per tenant, not as local children.

4. **Cloud deploy.** Drop `CloudDeploy` (Fly/Coolify/containers) behind the `Deploy` seam - kills
   the ~1000-port cap (wall #3) and the one-host ceiling. `Deploy.reconcile(liveRunIds)` already
   exists for orphan reaping across nodes.

5. **Remote git + logs.** Gitea/GitHub-org behind the `Git` seam; hosted `DigestSource` (currently
   stubbed in the agent console) for remote log/console transport instead of local FS tail.

6. **Auth + tenancy.** Implement `getIdentity` with better-auth (TODO today), namespace companies/
   repos/deploys per user, and gate `CSLOP_DEPLOYMENT=hosted`.

7. **Managed credits + metering.** Wire the `Credentials` seam's managed-vs-BYOK path and meter
   token spend per tenant (partly un-metered today; per-company budget caps already exist). Guards
   cost at scale.

8. **Finish crash recovery for real runs.** `reaper.ts` TODO: after killing orphaned pgids, call
   `Git.resetClean(workdir, gitSha)` + `Deploy.reconcile()` so a reclaimed run can't leave a dirty
   worktree or orphaned app.

## Rule of thumb

DB (1) and executor fleet (2) are the first two walls; cloud deploy (4) is the third. Auth (6) and
metering (7) are the safety layer before opening the doors. Do them in order - each unblocks the
next.
