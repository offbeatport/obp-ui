# Design system - the law for every product built on obp-ui

`obp-ui` is not one app's UI any more. Five independent products are in scope - **cslopslop** (an
agent operator console), **BuyDiff** (a public comparison tool), **WebInvoke** (developer docs +
API), **PicSuper** (a consumer one-screen utility) and the microsaas portfolio - and they are
*supposed* to look different from one another. What they may not do is disagree about tokens,
contrast, or how a variant gets added. Hence three tiers: know which one you are standing in
before you type.

**See it live:** `pnpm ui` → http://localhost:5180 - every export, both themes, all nine theme
presets (and the seventeen palettes their colour axis draws from).

**The default is Instrument**: a working tool, not a landing page - an IDE, a cloud console, a
trading screen. Neutral grey surfaces, one classic blue, Public Sans over Intel One Mono, 13px
controls, 4px corners, hairline borders where other kits put shadows. It exists to stop the five
products reading as generated: the shadcn defaults (soft halos, `py-6` cards, pill badges, 12px+
corners), Space Grotesk headings, uppercase mono eyebrows, glass blur and gradient tiles are the
first things a reader recognises as "an AI made this", and §1.9 bans them.

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
4. **Contrast floors**, measured across the seventeen palettes in `src/lib/palette.ts`, both modes.
   There are two ways to declare one, and the floors are the same for both.
   `makePalette({ light: { primary, accent, accentForeground }, dark: { primary,
   accentForeground } })` takes five hexes: the eight neutrals, both `primaryForeground`s,
   `shadowTint` and the dark `accent` wash are derived from the primary's hue against a shared
   lightness ladder, so they cannot drift between palettes. `tint: 0` gives a pure achromatic set
   (Graphite). Nine palettes are generated this way, and a new hue should be too.
   `brandPalette({ light: {…eleven}, dark: {…ten} })` is the escape hatch for a palette whose
   neutrals are the point - a page that must be `#000000` and not the ladder's `#0b0b0b`, or
   GitHub's blue-grey greys. It derives only `primaryForeground`, `shadowTint` and the dark wash.
   Reach for it when you are *quoting* a real product's surfaces, not when you want a new hue.
   Paper stays a hand-written literal below both: it is the authored theme and its warm neutrals
   and 3.55:1 primary are deliberate exceptions neither helper must reproduce.
   - `--faint` on `--card` **≥ 4.55:1** (min 4.60, Paper light; 4.73 over the brand literals). It
     is the lightest ink the kit ships; it still has to pass AA.
   - `--primary` on `--background` **≥ 4.5:1** (min 4.50 over the nine generated palettes, 4.64
     over the seven brand ones) -
     because `--primary` is the prose-link colour (`markdown.tsx`) and the focus ring at least as
     often as it is a button fill, so it has to work as *text*. Paper, the authored theme, is the
     one exception at 3.55:1; inherit its warmth, not that number. This is also the floor a quoted
     brand hue usually fails: X's `#1d9bf0` is 2.84:1 on white and Supabase's `#3ecf8e` is worse,
     so the brand palettes keep the real hue in dark mode - where the page is near-black and it
     clears 7:1 - and darken it for light. A logo colour is not a link colour.
   - A filled status chip's label **≥ 5.65:1** in dark mode (destructive is the tightest, 6.78 on
     the `#101216` ink; warning reaches 8.73:1), from the matching `-foreground` token and never
     `#fff` - dark inverts these hues, so white lands at 2.2-2.8:1 on them (warning the worst at
     2.15:1) and 1.17:1 on Graphite dark's `--primary`. Light mode's white-on-hue runs 6.0-7.7:1.
   - Status **text** ≥ 4.5:1 on the card, the page and its own `-soft` fill, both modes (min 4.87,
     warning on its soft fill in light). This is why the light hues are the deep 700-ish steps and
     not the raw 600s: `#16a34a` green is 3.3:1 on white and fails as a label.
5. **Respect the status language** below. Statuses are vocabulary, not decoration - the six hues
   are deliberately identical in every palette and every preset the kit ships. The *meanings* in the
   table are cslopslop's reading of them; a product with no approval queue maps its own meanings
   onto the same six tokens rather than inventing a seventh hue.
   A product *can* re-hue them - `ThemePreset.status` carries a per-mode override, and the theme
   builder edits them - but it is the last thing to reach for, not the first: two products that
   disagree about what green means have broken the only vocabulary five apps share. If you do it,
   you inherit the chip floor above (a filled label ≥ 5.65:1 in dark) and you own it in both modes.
   The `-soft` fills follow automatically; they are `color-mix()` off the hue, not separate values.
6. **Focus stays visible; motion has a stop.** Two solid rings, no translucent halo: a field
   (input, textarea, select trigger) takes `focus-visible:border-ring focus-visible:ring-1
   focus-visible:ring-ring`, everything you press takes `focus-visible:ring-2 focus-visible:ring-ring
   focus-visible:ring-offset-1 focus-visible:ring-offset-background`. Keep the one a primitive
   ships when you add a variant - never remove an outline without replacing it. Anything that
   loops or draws needs a `motion-reduce:` escape at the call site.
7. **Type comes off the scale.** Seven steps - `--type-sm` … `--type-4xl`, mapped onto `text-sm` …
   `text-4xl` - and `--type-sm` (13px) is the **floor**: every control, menu row, table cell and
   label. Body is `text-base` (14px, 1.5). No `text-xs` (Tailwind still ships the utility; nothing
   here may use it), no `text-[Npx]`. The literals the scale replaced ran to 15 different sizes
   between 8px and 16px, and a 9.5px uppercase mono label is unreadable at arm's length. A caption
   is `text-sm text-muted-foreground` in sentence case - not uppercase, not tracked, not mono, not
   smaller. Inputs are `text-lg md:text-sm` so iOS does not zoom on focus.
8. **No app in the package.** No router imports, no server functions, no DB, no product domain
   data. Content is a prop. See "What is NOT in here" in `README.md`.
9. **No decoration.** Every rule here is a token or a primitive default already; this is the list
   to hold app code to.
   - **Fonts by role.** Anything a person can click, edit, hover or read as data is `font-sans`
     (Public Sans) or `font-mono` (Intel One Mono). Mono is for IDs, hashes, timestamps, code and
     keys - not whole tables, not headings, not labels. Number columns get `tabular-nums`
     (`<table>`, `<time>`, `<data>`, `<output>` and `TableCell` already have it). `font-serif`
     is for long-form reading only.
   - **Density.** Controls are 32px (`h-8`), menu rows 24-28px, cell padding 8-16px (`px-3
     py-1.5` in `TableCell`, `p-4` in `Card`). No section padding above `py-12` inside an app, no
     `gap-6`+ between related controls, no centred hero inside a tool.
   - **Borders, not shadows.** In-flow surfaces separate with `border` (1px `--border`); `shadow-e1`
     is `none`. Only floating layers (menu, popover, select, dialog) carry `shadow-e2`, a hairline
     lift. No `shadow-sm/md/lg`, no coloured glow, no `drop-shadow`.
   - **No gradients, blur or glass.** No `bg-gradient-*`, no `backdrop-blur`, no `filter: blur()`
     in motion, no translucent `bg-*/80` over content. A gradient is legal only where it *is* the
     data: the colour picker's hue and saturation fields.
   - **Corners are small and square-ish.** 2px controls, 4px popovers, 6px cards (`--radius:
     0.25rem`). `rounded-full` only for things that are round by convention: switch, radio, a
     status dot, an avatar. No pill badges, no pill tabs.
   - **Status is coloured text in a 1px outline**, or a dot plus text - not a pastel pill. `-soft`
     fills are for callouts and selected rows.
   - **Icons are functional, never decorative.** Keep the conventional glyphs - close, chevron,
     tick, search, external-link, drag handle. No icon beside every heading, nav item or stat, no
     icon in a tinted circle, no emoji in UI. An icon-only button carries an `aria-label` and a
     tooltip; anything that is not a universal symbol gets a text label instead.
   - **Motion is feedback, not show.** Overlays fade in ≤150ms; no zoom-in, no bounce, no sliding
     pill, no hover lift, no `transition-all`. Buttons and links change state instantly
     (`base.css` zeroes their transitions).

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

Each has a `-soft` fill token for callouts and selected rows. Badges are outlined, not filled.

## 2. Shared vocabulary - vary it freely

The tokens and the 19 primitives are a *vocabulary*, not a look. A product changes its look by
redeclaring token **values** in its own `tokens.css` after the import - `:root { --primary:
#0c736f; --radius: 0.5rem }` and the same again under `.dark` - never by editing a component.
What is yours to set:

- **Theme preset.** The nine in `src/lib/theme-preset.ts` bundle all four axes below at once, and
  `<ThemePicker />` swaps them at runtime. "Theme" there means the **preset**; `Theme` in
  `src/lib/theme.ts` means `light | dark`, the **mode**. Presets are the cheapest way to vary the
  look, and the default applies by *removing* every override so it cannot drift. Instrument is the
  default and is exactly `tokens.css` (Slate palette, Instrument type, Sharp radius, Default
  space). Paper is the original authored theme - cream, terracotta, Inter over Space Grotesk, 12px
  corners - kept as an opt-in preset that needs `obp-ui/fonts-alt.css`. The other seven quote a
  product whose surfaces are widely known - Vercel, Linear,
  GitHub, X, Hyperagent, Supabase, Stripe - so that "make it look like X" is a preset id rather
  than a fresh argument about hexes. They are readings of those interfaces in this kit's
  vocabulary, corrected to §1's floors; they are not those products' design systems, and nothing
  in the kit is branded.
- **Palette.** The seventeen in `src/lib/palette.ts` are the colour axis: achromatic surfaces,
  brand at 90% of the sRGB ceiling solved against 4.5:1 on the page for the nine generated ones,
  and quoted surfaces for the seven brand literals. Ship one, ship the picker, or write your own
  values - a new one has to clear the floors in §1.
- **Fonts.** Nothing in the kit hardcodes a family: `base.css` reads `var(--font-sans)` and
  `var(--font-display)`, and that is the only place a family is named. `obp-ui/fonts.css` loads
  the default three (Public Sans, Intel One Mono, Spectral), self-hosted from `@fontsource` - never
  a Google Fonts `@import`, which a Tauri CSP blocks and which leaks every page view to a third
  party. `obp-ui/fonts-alt.css` loads every other family a preset names (Inter, Space Grotesk,
  JetBrains Mono, Geist, Geist Mono, IBM Plex Sans, Fraunces, Instrument Serif, Iosevka).
  Iosevka is the one family not on `@fontsource`, whose copy is stuck at v22: v34.9.0 is
  vendored in `src/styles/fonts/iosevka/` (OFL, `LICENSE.md` beside it), Iosevka and Iosevka
  Aile at 400/500/600/700 plus 400/700 italic, subset to latin, latin-ext and a symbols range
  (arrows, box drawing, technical glyphs) with only the standard OpenType features kept, so
  ligatures and `tnum` survive. `obp-ui/fonts-iosevka.css` loads it alone. To move it to a new
  release, unzip `PkgWebFont-Unhinted-Iosevka` and `-IosevkaAile` into one folder and run
  `python3 scripts/subset-iosevka.py <folder>/WOFF2-Unhinted` (needs `fonttools` and `brotli`). `--font-display`
  defaults to `var(--font-sans)`: headings are Public Sans at a heavier weight, not a second
  face. Swap all four, or skip `fonts.css` and take the system stack. A preset's type axis is exactly this override - but it
  only names families, so the app still has to import the stylesheet that loads them
  (`obp-ui/fonts.css`, `obp-ui/fonts-alt.css`) or the token falls silently through to `system-ui`.
- **Type sizes.** The seven `--type-*` values and their `-leading` pairs. Redefine them and the
  whole kit resizes: the 167 type classes in `src` name a *step* (`text-sm`, `text-lg`), never a
  value. What you cannot vary is the number of steps or their nature - seven static rem values, no
  fluid step. See the archetype section.
- **Radius and elevation.** `--radius`, `--radius-card`, `--shadow-e1/e2`. A product may give
  `--shadow-e1` a value back; the primitives still never reach for Tailwind's `shadow-sm`. (35 literal
  `rounded-[Npx]` survive, 21 of them in `canvas/` - verbatim prototype ports that do *not* follow
  `--radius`. Debt, not licence.)
- **Density and measure.** `--measure` (the 42rem editorial column), `--spacing`, and which
  primitives you mount at all. `--spacing` is the whole density axis on its own: Tailwind v4
  compiles every spacing utility as `calc(var(--spacing) * N)`, so one value moves control
  heights, gaps, padding and icon boxes together. Measured on a real `<Button>` (`h-8`):
  `0.22rem` → 28.16px, `0.25rem` → 32.00px, `0.28rem` → 35.84px.

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

The kit encodes exactly **one** archetype today: an operator console - dense rails, hairline
borders, sentence-case captions, near-zero motion, one editorial column. Two more are wanted, a customer-facing
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
and destructive are meaning, not brand, and stay constant across every product. If a product has
a reason to move them anyway, they are twelve more variables in the same block - `--success` and
`--success-foreground`, six pairs - and §1.5 is the condition for doing it.

**The one thing to eyeball:** `--primary` is the link colour and the focus ring, not just a button
fill, so a pale brand colour makes links unreadable. Take the brand's hue and adjust its lightness
until it reads as text - that is what the default does, `#1c6be0` light (4.52:1 on the page) and
`#8eb7f8` dark, and what Paper does with terracotta `#c8643c` / `#e0794c`.
The logo file keeps the exact brand colour; it answers to no contrast floor.

## Two operational notes that used to live in the README

**Tauri CSP.** `app.security.csp` (nested under `app` in v2, not at the root as in v1) can keep
`style-src 'self'` - no `'unsafe-inline'`. Base UI has no `react-remove-scroll`, and `UIProvider`
sets `CSPProvider disableStyleElements` because the one rule it would inject ships in `base.css`.
`build.target` is `safari16` for Tailwind v4's `@property`.

**One React.** `resolve: { dedupe: ["react", "react-dom"] }` in the consumer's vite config. pnpm's
strict `node_modules` plus a symlinked package is the exact shape that yields two React copies; the
symptom is "Invalid hook call" the first time a Base UI primitive mounts.
