# Licensing

**Decision (2026-07-13): fair-source, one license over the whole repo — the Functional Source
License (FSL-1.1, Apache-2.0 future).** Not classic two-license open-core; not pure MIT; not closed.

## Why
cslopslop's moat is **portability + anti-lock-in** ("every company is a git repo you own; `git clone`
+ any agent continues it"). That only works if the core is genuinely open to read, run, fork, and
self-host. So closed is off the table.

But the **hosted multi-tenant layer** (per-tenant sandbox isolation, billing, running untrusted
agents at scale) is the expensive, valuable part — the business. Pure MIT would let a competitor or
a cloud host our exact product and undercut us (the OSS-SaaS strip-mine).

**FSL threads the needle:** source-available — anyone may use, modify, and self-host — but may **not
offer it as a competing hosted service**. Each version's license **converts to Apache 2.0 two years
after release**, so it becomes true OSS on a rolling basis. One codebase, one license.

## How it maps to the deployment model
- **Self-host (single-tenant, OSS spirit):** fully permitted — run it, fork it, BYOK, own your repos.
  This is the trust/adoption/credibility wedge and the anti-Bolt story.
- **Hosted (multi-tenant):** our commercial product. FSL's "Competing Use" restriction protects it.
- Monetize hosted via **managed credits + zero-setup + reliability/SLA/team features** — never by
  crippling self-host. BYOK-no-markup on self-host is itself a wedge.

## What's here
- `LICENSE` — the FSL-1.1 notice with our parameters. **Action required:** paste the canonical
  FSL-1.1 (Apache-2.0 future) text from <https://fsl.software/> and stamp the Change Date.

## Parameters
- **Licensor:** C Slop Slop (update to the legal entity).
- **Change License:** Apache License, Version 2.0.
- **Change Date:** two years after each version's publication (e.g. a version released 2026-07-13 →
  Apache-2.0 on 2028-07-13).
- **SPDX-ish tag:** `FSL-1.1-Apache-2.0`.

## Reconsider if
- You want maximal contribution/adoption over protection → Apache-2.0 on the core + keep the
  multi-tenant layer in a private repo (classic open-core split).
- You need stronger anti-cloud teeth → BSL/SSPL (heavier, more friction).
