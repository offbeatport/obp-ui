# Design system - read this before building or extending any UI

cslopslop has **one** visual language, and it lives in this package (`obp-ui`). Every screen
in the platform, the desktop app, and every app cslopslop builds for a company is composed from the
same tokens + components. You do not invent styles; you compose the existing ones. This is what
keeps feature #70 look like feature #1.

**Same kit, both hosts:** the web app (`apps/web`, TanStack Start) and the Tauri desktop app import
this identical package - same tokens, same primitives, same fonts. A component that only works in
one of them is a bug. See `README.md` for wiring, and `src/styles/desktop.css` for the handful of
native-window affordances the desktop shell opts into on top.

**See it live:** run `pnpm dev` and open **http://localhost:3000/design** - the kitchen sink shows
every token and component in light + dark. `apps/web/src/routes/design.tsx` is also the best usage
reference.

## The aesthetic (one style, one archetype)
Warm **editorial "paper"** - cream/paper surfaces, ink text, a single **terracotta** brand accent,
generous radius, soft shadows, light **and** dark. Grounded in
`design/v2-prototypes/08-chat-spine-pro-v7.html`. Calm, legible, a little literary - not a cold SaaS dashboard.

- **Fonts:** `font-sans` = Inter (body) · `font-display` = Space Grotesk (headings, use `font-light`) ·
  `font-serif` = Spectral italic (theses / editorial voice) · `font-mono` = JetBrains Mono (numbers, ids, code).
  The faces are self-hosted in this package (`obp-ui/fonts.css`) - no CDN, because the desktop
  app is offline.

## Hard rules
1. **Tokens only - never hardcode a color, radius, or shadow.** Use Tailwind utilities backed by the
   token layer: `bg-background bg-card bg-primary text-muted-foreground border shadow-e1`, etc.
   No `#hex`, no `text-[#...]`, no raw `rgb()` in components.
2. **Reuse `obp-ui` - compose, don't fork.** Need a variant? Add it to the component's
   `cva` variants (see how `src/primitives/badge.tsx` gained the status variants), don't restyle
   inline or copy the file. Nothing visual belongs in `apps/web/src/components/ui` - that directory
   does not exist any more, on purpose.
3. **Add new primitives with the CLI, into the package:** run
   `npx shadcn@latest add <name>` from `packages/ui` (its `components.json` writes to
   `src/primitives`). Then theme it with tokens only, convert the generated `@/…` imports to
   relative ones, add `"use client"`, and export it from `src/primitives/index.ts`.
4. **Both themes must work.** Dark is a real product mode (`.dark` class on `<html>`). Never assume light.
5. **Respect the status language** below - statuses are not ad-hoc colors.
6. **No app in the package.** No router imports, no server functions, no DB, no cslopslop domain
   data. Content is a prop. See "What is NOT in here" in `README.md`.

## Tokens (defined in `src/styles/tokens.css`)
Surfaces: `background` (page) · `card` / `popover` (surfaces) · `secondary` / `muted` (subtle fills) ·
`foreground` `muted-foreground` `faint` (text, darkest→lightest) · `border` `border-soft` · `input` `ring`.
Brand: `primary` (terracotta) + `primary-foreground` · `accent` (soft hover) + `accent-foreground`.
Radius: base `--radius` 12px (buttons/inputs/badges) · `--radius-card` 18px (cards). Elevation: `shadow-e1` `shadow-e2`.

### Status language (use the matching Badge variant / token - don't improvise)
| meaning | token / `<Badge variant>` | color |
|---|---|---|
| shipped / done / live | `success` | green |
| building / running / info | `info` | blue |
| awaiting **your** approval | `approval` | violet |
| queued / todo / idle | `neutral` | slate |
| at-risk / caution / reject | `warning` | amber |
| blocked / killed / error | `destructive` | red |
| autopilot / brand emphasis | `accent` / `default` | terracotta |

Each has a `-soft` fill token (e.g. `bg-success-soft text-success`) for chips and callouts.

## Components available today
`Button` (variants: default/success/outline/secondary/ghost/destructive/link · sizes sm/default/lg/icon) ·
`Badge` (+ status variants above) · `Card` (+ Header/Title/Description/Action/Content/Footer) ·
`Input` `Textarea` `Label` `Select` · `Tabs` · `Dialog` · `DropdownMenu` · `Tooltip` (wrap in `TooltipProvider`) ·
`Table` · `Separator` · `ScrollArea` · `RadioGroup` · `Switch`.
Plus the shared non-primitives: `Markdown` · `ConfirmDialog` · `ThemeToggle` · `TabNav` /
`SegmentedTabs` · provider logos.

## Per-company reuse (why this doc exists twice over)
This kit is also the **template cslopslop stamps into every company repo**. Branding a company =
**overriding the token values** in that repo's copy of `tokens.css` (palette/radius/fonts from the
brand) - the components are copied unchanged. So a company's UI is on-brand *and* consistent, and
`git clone + claude` keeps building it in the same language because the agent re-reads this contract
every run. When the build archetype moves past the walking-skeleton
(`apps/web/prompts/harness-system.md`), the harness system prompt points the agent here.

**One line:** tokens are the knob; components are shared; this file is the law.
