# Design system — read this before building or extending any UI

cslopslop has **one** visual language. Every screen in the platform, and every app cslopslop
builds for a company, is composed from the same tokens + components. You do not invent styles;
you compose the existing ones. This is what keeps feature #70 look like feature #1.

**See it live:** run `pnpm dev` and open **http://localhost:3000/design** — the kitchen sink shows
every token and component in light + dark. `src/routes/design.tsx` is also the best usage reference.

## The aesthetic (one style, one archetype)
Warm **editorial "paper"** — cream/paper surfaces, ink text, a single **terracotta** brand accent,
generous radius, soft shadows, light **and** dark. Grounded in
`design/v2-prototypes/08-chat-spine-pro-v7.html`. Calm, legible, a little literary — not a cold SaaS dashboard.

- **Fonts:** `font-sans` = Inter (body) · `font-display` = Space Grotesk (headings, use `font-light`) ·
  `font-serif` = Spectral italic (theses / editorial voice) · `font-mono` = JetBrains Mono (numbers, ids, code).

## Hard rules
1. **Tokens only — never hardcode a color, radius, or shadow.** Use Tailwind utilities backed by the
   token layer: `bg-background bg-card bg-primary text-muted-foreground border shadow-e1`, etc.
   No `#hex`, no `text-[#...]`, no raw `rgb()` in components.
2. **Reuse `~/components/ui/*` — compose, don't fork.** Need a variant? Add it to the component's
   `cva` variants (see how `badge.tsx` gained the status variants), don't restyle inline or copy the file.
3. **Add new primitives with the CLI:** `npx shadcn@latest add <name>` (writes to `~/components/ui`,
   uses our `components.json` + `~/` alias). Then theme it with tokens only.
4. **Both themes must work.** Dark is a real product mode (`.dark` class on `<html>`). Never assume light.
5. **Respect the status language** below — statuses are not ad-hoc colors.

## Tokens (defined in `src/styles/globals.css`)
Surfaces: `background` (page) · `card` / `popover` (surfaces) · `secondary` / `muted` (subtle fills) ·
`foreground` `muted-foreground` `faint` (text, darkest→lightest) · `border` `border-soft` · `input` `ring`.
Brand: `primary` (terracotta) + `primary-foreground` · `accent` (soft hover) + `accent-foreground`.
Radius: base `--radius` 12px (buttons/inputs/badges) · `--radius-card` 18px (cards). Elevation: `shadow-e1` `shadow-e2`.

### Status language (use the matching Badge variant / token — don't improvise)
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
`Table` · `Separator` · `ScrollArea`.

## Per-company reuse (why this doc exists twice over)
This kit is also the **template cslopslop stamps into every company repo**. Branding a company =
**overriding the token values** in that repo's `globals.css` (palette/radius/fonts from the brand) —
the components are copied unchanged. So a company's UI is on-brand *and* consistent, and
`git clone + claude` keeps building it in the same language because the agent re-reads this contract
every run. When the build archetype moves past the walking-skeleton (`prompts/harness-system.md`),
the harness system prompt points the agent here.

**One line:** tokens are the knob; components are shared; this file is the law.
