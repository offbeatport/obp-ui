# ReportFuse

Built on [`@offbeatport/microsaas-core`](https://github.com/offbeatport/microsaas-core).

## Quick start

```bash
pnpm install
cp .env.example .env       # edit as needed
pnpm dev
```

Open <http://localhost:3000>.

## Scripts

| Command            | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `pnpm dev`         | Start the dev server                          |
| `pnpm build`       | Build for production                          |
| `pnpm start`       | Run the production build (`node .output/...`) |
| `pnpm typecheck`   | TypeScript check                              |
| `pnpm db:generate` | Generate a drizzle migration                  |
| `pnpm db:push`     | Push schema changes to the local SQLite       |
| `pnpm db:studio`   | Open drizzle-kit studio                       |

## Project layout

```
src/
├── client.tsx         # hydrate
├── server.ts          # createServerEntry
├── router.tsx         # createRouter
├── db/
│   ├── client.ts      # createDb({ schema })
│   └── schema.ts      # app-specific tables (extends core auth schema)
├── lib/
│   ├── auth.ts        # createAuth({ db })
│   ├── auth-client.ts # createCoreAuthClient()
│   └── _local/        # graveyard for "to be promoted to core"
├── styles/
│   └── app.css        # imports core theme + tailwind directives
├── features/          # niche logic (the AI call, generator, calc, ...)
└── routes/
    ├── __root.tsx     # brand surface (TopNav, head meta)
    ├── index.tsx      # landing
    └── api/auth/$.tsx # better-auth catch-all
```

## Core rules

See [CLAUDE.md](./CLAUDE.md). TL;DR - never edit `node_modules/@offbeatport/microsaas-core/`.
Local lib only.
