# microsaas

Offbeatport's micro-SaaS factory. Monorepo: shared core package, design
playground, every scaffolded app.

**All factory rules - layout, archetypes, scaffold flow, design,
quality gates - live in [FACTORY.md](./FACTORY.md). Read that.**

```bash
pnpm install              # install everything (workspace-aware)
pnpm playground           # design preview at :5173
pnpm typecheck            # typecheck all packages + apps
pnpm --filter <slug> dev  # start a specific app
```

Scaffold a new app: invoke `/build-from-pain`.
