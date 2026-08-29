# Design system - the law for every product built on obp-ui

`obp-ui` is not one app's UI any more. Five independent products are in scope - **cslopslop** (an
agent operator console), **BuyDiff** (a public comparison tool), **WebInvoke** (developer docs +
API), **PicSuper** (a consumer one-screen utility) and the microsaas portfolio - and they are
*supposed* to look different from one another. What they may not do is disagree about tokens,
contrast, or how a variant gets added. Hence three tiers: know which one you are standing in
before you type.

**See it live:** `pnpm ui` → http://localhost:5180 - every export, both themes, all six theme
presets (and the ten palettes their colour axis draws from).

## 1. Shared law - binding on every product

Binding on everything the root barrel exports: `src/styles/*` · `src/lib/*` · `src/primitives/*` ·
`src/nav/*` · `src/data-display/*`.

1. **Tokens only - never hardcode a colour, radius or shadow.** Use utilities backed by the token
   layer: `bg-background bg-card bg-primary text-muted-foreground border shadow-e1`. No `#hex`,
   no `text-[#…]`, no raw `rgb()` in a component. Literal colour is legal in one kind of file: a
   `tokens.css` - this package's, or a product's override block after the import. (19 hex literals
   survive in components - 14 in `canvas/flavors.ts`, 3 in `nav-ui/`, and two prop defaults in
   `canvas/nodes.tsx` and `theme-picker.tsx`. Verbatim prototype ports, same as the radius debt in
   §2: debt, not licence. `provider-logos.tsx` is the one real exception - a third party's mark has
   to draw in its own colour. The two hexes in `data-display/gradient-mark.tsx` are contrast
   measurements written down in a comment; nothing paints them.)
2. **Compose, don't fork.** Need a variant? Add it to the component's `cva` (see how
   `src/primitives/badge.tsx` gained the status variants). Never restyle inline, never copy the
   file into the app. A product-local `components/ui/` directory is a fork with extra steps.
   The composition prop is **`asChild`**, everywhere, on every wrapper. The headless layer
   underneath is Base UI, which spells it `render`; that rename stops at the package boundary and
   is absorbed by `src/lib/base-ui-compat.ts`. A new primitive that exposes `render` instead has
   forked the API in the one place five products all touch.
3. **Both themes work.** Dark is a real product mode (`.dark` on `<html>`; a nested `.light`
   interrupts it, which is what makes a scoped preview possible). A component that has only been
   looked at in one mode is not finished.
4. **Contrast floors**, measured across the ten palettes in `src/lib/palette.ts`, both modes.
   A palette is declared with `makePalette({ light: { primary, accent, accentForeground },
   dark: { primary, accentForeground } })` - five hexes. The eight neutrals, both
   `primaryForeground`s, `shadowTint` and the dark `accent` wash are derived from the primary's
   hue against a shared lightness ladder, so they cannot drift between palettes. `tint: 0` gives a
   pure achromatic set (Graphite). Paper stays a hand-written literal: it is the authored theme and
   its warm neutrals and 3.55:1 primary are deliberate exceptions the generator must not reproduce.
   - `--faint` on `--card` **≥ 4.55:1** (min 4.60, Paper light). It is the lightest ink the kit
     ships; it still has to pass AA.
   - `--primary` on `--background` **≥ 4.5:1** (min 4.50 over the nine generated palettes) -
     because `--primary` is the prose-link colour (`markdown.tsx`) and the focus ring at least as
     often as it is a button fill, so it has to work as *text*. Paper, the authored theme, is the
     one exception at 3.55:1; inherit its warmth, not that number.
   - A filled status chip's label **≥ 5.65:1** in dark mode (destructive is the tightest, 5.67 on
     the ink `palette.ts` writes; warning reaches 11.3:1), from the matching `-foreground` token
     and never `#fff` - dark inverts these hues, so white lands at 1.7-3.3:1 on them (warning the
     worst at 1.67:1) and 1.17:1 on Graphite dark's `--primary`. Light
     mode's white-on-hue only runs 3.0-5.3:1, which is why the chip vocabulary is a soft fill plus
     status text (`bg-success-soft text-success`) and filled chips stay on the deeper hues.
5. **Respect the status language** below. Statuses are vocabulary, not decoration - the six hues
   are deliberately identical in every palette and every preset, and no product re-hues them. The *meanings* in the
   table are cslopslop's reading of them; a product with no approval queue maps its own meanings
   onto the same six tokens rather than inventing a seventh hue.
6. **Focus stays visible; motion has a stop.** Keep the `focus-visible:ring-ring/50` a primitive
   ships when you add a variant - never remove an outline without replacing it. Anything that
   loops or draws needs a `motion-reduce:` escape at the call site.
7. **Type comes off the scale.** Six steps - `--type-sm` … `--type-3xl`, mapped onto `text-sm` …
   `text-3xl` - and `--type-sm` (14px) is the **floor**. No `text-xs` (Tailwind still ships the
   utility; nothing here may use it), no `text-[Npx]`. The literals the scale replaced ran to 15
   different sizes between 8px and 16px, and a 9.5px uppercase mono label is unreadable at arm's
   length. A micro-caption is `font-mono` + uppercase + tracking + `text-faint`, not smaller type.
8. **No app in the package.** No router imports, no server functions, no DB, no product domain
   data. Content is a prop. See "What is NOT in here" in `README.md`.

### Status language (use the matching Badge variant / token - don't improvise)
| meaning | token / `<Badge variant>` | colour |
|---|---|---|
| shipped / done / live | `success` | green |
| building / running / info | `info` | blue |
| awaiting **your** approval | `approval` | violet |
| queued / todo / idle | `neutral` | slate |
| at-risk / caution / reject | `warning` | amber |
| blocked / killed / error | `destructive` | red |
| autopilot / brand emphasis | `accent` / `default` | brand |

Each has a `-soft` fill token for chips and callouts.

## 2. Shared vocabulary - vary it freely

The tokens and the 19 primitives are a *vocabulary*, not a look. A product changes its look by
redeclaring token **values** in its own `tokens.css` after the import - `:root { --primary:
#0c736f; --radius: 0.5rem }` and the same again under `.dark` - never by editing a component.
What is yours to set:

- **Theme preset.** The six in `src/lib/theme-preset.ts` bundle all four axes below at once, and
  `<ThemePicker />` swaps them at runtime. "Theme" there means the **preset**; `Theme` in
  `src/lib/theme.ts` means `light | dark`, the **mode**. Presets are the cheapest way to vary the
  look, and the default applies by *removing* every override so it cannot drift.
- **Palette.** The ten in `src/lib/palette.ts` are the colour axis: achromatic surfaces, brand
  at 90% of the sRGB ceiling solved against 4.5:1 on the page. Ship one, ship the picker, or write
  your own values - a new one has to clear the floors in §1.
- **Fonts.** Nothing in the kit hardcodes a family: `base.css` reads `var(--font-sans)` and
  `var(--font-display)`, and that is the only place a family is named. Swap all four, or skip
  `fonts.css` and take the system stack. A preset's type axis is exactly this override - but it
  only names families, so the app still has to import the stylesheet that loads them
  (`obp-ui/fonts.css`, `obp-ui/fonts-alt.css`) or the token falls silently through to `system-ui`.
- **Type sizes.** The six `--type-*` values and their `-leading` pairs. Redefine them and the
  whole kit resizes: the 167 type classes in `src` name a *step* (`text-sm`, `text-lg`), never a
  value. What you cannot vary is the number of steps or their nature - six static rem values, no
  fluid step. See the archetype section.
- **Radius and elevation.** `--radius`, `--radius-card`, `--shadow-e1/e2`. (35 literal
  `rounded-[Npx]` survive, 21 of them in `canvas/` - verbatim prototype ports that do *not* follow
  `--radius`. Debt, not licence.)
- **Density and measure.** `--measure` (the 42rem editorial column), `--spacing`, and which
  primitives you mount at all. `--spacing` is the whole density axis on its own: Tailwind v4
  compiles every spacing utility as `calc(var(--spacing) * N)`, so one value moves control
  heights, gaps, padding and icon boxes together. Measured on a real `<Button>` (`h-9`):
  `0.22rem` → 31.67px, `0.25rem` → 36.00px, `0.28rem` → 40.32px.

BuyDiff shows the range: same primitives, same fonts, same radius, a teal brand at 5.33:1 on the
page - and it does not read as cslopslop. WebInvoke shows the other half: it kept the terracotta
tokens untouched and still reads as a different product. Neither difference came from the palette.
Both came from tier 3.

## 3. cslopslop's own - available, not prescribed

`obp-ui/shell` · `obp-ui/console` · `obp-ui/chat` · `obp-ui/canvas` · `obp-ui/nav-ui`
(plus the opt-in `obp-ui/canvas.css`).

One product's archetype: a rail-and-canvas frame, a bottom-docked agent console, a co-pilot
thread, an infinite board, ten tab treatments. They sit behind their own entry points rather than
the root barrel because **mounting `AppShell` + `ConsoleDock` makes a product read as cslopslop in
a different hue.** A fine thing to choose - it is what an archetype is for - but a choice with a
consequence, so it has to be visible at the import line.

A marketing surface or a data-dense app should expect to build its own frame; both that exist
already did. BuyDiff and WebInvoke each carry the whole `shell/` directory in their forks and
mount zero files of it. (`canvas` is separate for a second reason: `@xyflow/react` is an optional
peer, and an app without a board must not pay for it.)

## Archetypes - the next axis, not the next fork

The kit encodes exactly **one** archetype today: an operator console - dense rails, mono
micro-captions, calm motion, one editorial column. Two more are wanted, a customer-facing
marketing surface and a data-intensive one. The rule that stops that becoming three forks:

- **One kit, one token layer.** An archetype is a **preset over scales** - type, density, radius,
  motion - exactly as a palette is a preset over hue. It ships as token values, not as a second
  component tree. §3 is not the counter-example: `shell/` and `console/` are one product's
  *composed screens*, and a second archetype may earn its own entry point of composed screens the
  same way. What it may never have is a second copy of a primitive, a token or a scale.
- **A scale has to exist as a token before an archetype may vary it.** Type does
  (`--type-sm` … `--type-3xl`), and so does **density** - that entry used to read "not tokenised
  at all - every primitive spells its own `h-9 px-4 gap-2`", and that was wrong. Those utilities
  compile to `calc(var(--spacing) * N)`; 254 such declarations in the built gallery CSS, all
  against one `--spacing`. The whole kit re-measures from one inline property and no primitive
  changes. Radius steps and motion are still the gap: `--radius-sm/md/lg/xl` look like steps but
  are `calc()` off `--radius` inside `@theme inline`, so they are substituted into the utilities
  at build time and cannot be set independently. Add the token first; if varying a scale means
  touching a component, the token is what is missing.
- **No archetype gets built until two real surfaces need it.** One product's need is a token
  override. Two is a preset.

The evidence that this is needed: **PicSuper left the system entirely.** It wanted fluid display
type (`clamp()` on three steps), a brand-tinted CTA shadow, eight radius steps (`--radius` plus
`-sm/md/lg/xl/cta/card/zone`) and light-only - and the kit has a slot for none of those,
so PicSuper took none of the kit. That is the real cost of a single archetype: not that the
products look alike, but that the ones that do not fit walk away with nothing.

**One line:** tokens are the knob, primitives are shared, the archetype is opt-in, and this file
is the law.

---

## Re-branding a product

Paste this after the import. Twenty-one variables re-skin everything - buttons, links, focus
rings, hover washes, borders, and the logo mark, which fills from `var(--primary)`.

```css
@import "obp-ui/styles.css";

:root {
    --background: #ffffff;   --foreground: #111111;
    --card: #ffffff;         --card-foreground: #111111;
    --popover: #ffffff;      --popover-foreground: #111111;
    --secondary: #f3f3f5;    --secondary-foreground: #111111;
    --muted: #f3f3f5;        --muted-foreground: #5a5a63;
    --faint: #7a7a85;
    --primary: #7c3aed;      --primary-foreground: #ffffff;
    --accent: #ede9fe;       --accent-foreground: #5b21b6;
    --border: #e4e4e8;       --border-soft: #efeff2;
    --input: #e4e4e8;        --ring: #7c3aed;
}

.dark { /* same keys, dark values */ }
```

Or set `--primary` alone: `--accent`, `--accent-foreground` and `--ring` derive from it in
`tokens.css` via relative `oklch()`.

No JS, no rebuild, no flicker, works with JS disabled. `makePalette` + `setCustomTheme` is the
runtime alternative; it costs 5.5 kB gzip and flashes the default brand first, because
`prePaintScript` restores light/dark but not preset tokens. Use it only for a live theme picker.

**The six status hues are not in that list on purpose.** success, warning, info, approval, neutral
and destructive are meaning, not brand, and stay constant across every product.

**The one thing to eyeball:** `--primary` is the link colour and the focus ring, not just a button
fill, so a pale brand colour makes links unreadable. Take the brand's hue and adjust its lightness
until it reads as text - that is what Paper does, terracotta `#c8643c` light and `#e0794c` dark.
The logo file keeps the exact brand colour; it answers to no contrast floor.

## Two operational notes that used to live in the README

**Tauri CSP.** `app.security.csp` (nested under `app` in v2, not at the root as in v1) can keep
`style-src 'self'` - no `'unsafe-inline'`. Base UI has no `react-remove-scroll`, and `UIProvider`
sets `CSPProvider disableStyleElements` because the one rule it would inject ships in `base.css`.
`build.target` is `safari16` for Tailwind v4's `@property`.

**One React.** `resolve: { dedupe: ["react", "react-dom"] }` in the consumer's vite config. pnpm's
strict `node_modules` plus a symlinked package is the exact shape that yields two React copies; the
symptom is "Invalid hook call" the first time a Base UI primitive mounts.
