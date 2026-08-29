# obp-ui

The Offbeatport design system: design tokens, six theme presets over four axes, 19 primitives,
self-hosted fonts, a
router-agnostic nav seam, and - behind their own entry points - one product's shell, console, chat
and board. One package under several independent products, on every host: a TanStack Start web
app, a Tauri v2 desktop app and a Next app all render from the same bytes.

- **The law:** [`DESIGN.md`](./DESIGN.md) - three tiers. Shared law (tokens only, compose don't
  fork, both themes, the contrast floors) binds every product; the tokens are a vocabulary each
  product varies; the shell/console/chat/nav-ui archetype is opt-in (and `canvas` is opt-in for a
  dependency reason). Read it before adding UI.
- **The dev app:** `pnpm dev` - one page, no app required. The *Gallery*: every export, one block
  per family, in both themes. See [The dev app](#the-dev-app).
- **No app in here.** No router, no server functions, no database, no product domain data - see
  [What is NOT in here](#what-is-not-in-here).

```
src/                                                     ← the root barrel, tiers 1-2
  styles/       tokens.css · base.css · shell.css · keyframes.css · fonts.css · fonts-alt.css · canvas.css · desktop.css
  primitives/   badge button card checkbox color-picker dialog dropdown-menu input label popover
                radio-group scroll-area select separator switch table tabs textarea tooltip  (19)
  nav/          UIProvider · Link · TabNav · SegmentedTabs
  data-display/ EmptyState · Timeline · TaskCard · ExpandableRow · GradientMark
  lib/          cn · theme (light/dark) · theme-preset (4 axes) · palette · color · storage · prepaint · dom-class-pref · client-only
  markdown.tsx · confirm-dialog.tsx · theme-toggle.tsx · theme-picker.tsx · provider-logos.tsx
  shell/ console/ chat/ nav-ui/ canvas/                  ← tier 3, own entry points only
gallery/        the dev app (`pnpm dev`) - the Gallery: every export, one block per family
```

---

## Entry points

The root barrel is **anonymous**: parts any product can use without coming to resemble another
one. Five subtrees sit behind their own entry points instead.

| Import from | You get | Why it is separate |
| --- | --- | --- |
| `obp-ui` | tokens, primitives, `cn`, the nav seam + `UIProvider`, the tone map (`TONE`, `TONE_VAR`), data-display (`EmptyState`, `Timeline`, `TaskCard`, `ExpandableRow`, `GradientMark`), `ProviderLogo`, `Markdown`, `ConfirmDialog`, `ThemeToggle`, theme presets | the default - nothing here carries a product's identity |
| `obp-ui/canvas` | the React Flow board, node vocabulary, flavors, 10 layouts | **dependency**: `@xyflow/react` is an optional peer, and apps without a board must not pay for it |
| `obp-ui/shell` | `AppShell`, `Rail`, `NavItem`, `EntityRow`, `TitleBar`, account + window controls | **identity** |
| `obp-ui/console` | `ConsoleDock`, `ConsolePane`, `LogView`, `LogLine` | **identity** |
| `obp-ui/chat` | `ChatPanel`, `ChatBubble`, `ChatComposer`, `AssistantTurn` | **identity** |
| `obp-ui/nav-ui` | the ten tab treatments | **identity** |

"Identity" means: mounting those makes your app look like cslopslop. That is a perfectly good
thing to choose - it is what the archetype is *for* - but it must be a **choice**, visible at the
import line, not something that arrives because it happened to be in the default barrel.

The measurement behind the split: across the five consuming repos, shell / console / chat /
nav-ui have exactly **one** consumer. Two others carry the whole `shell/` directory in their
forks and mount **zero** files of it - they hand-rolled their own page frames. A flat barrel gave
them no signal that inheriting someone else's frame was the decision in front of them.

Adding to the root barrel? The test is: *would a second product import this without also adopting
the first product's look?* If not, it goes behind its own entry point.

---

## The dev app

```bash
pnpm install && pnpm dev      # from the repo root (`pnpm ui` still works)
```

A small Vite + React app in [`gallery/`](./gallery) on **http://localhost:5180**. One page, no
header switch: a second page whose sections were a strict content *subset* of the gallery was a
second answer to the same question, and it is gone.

**Gallery** is the exhaustive inventory: every component in the public barrel - the tokens themselves
(surfaces, brand, the full status language with its `-soft` fills, radius, elevation, type), the
19 primitives with every variant *and* every size, the data-display surfaces
(the entity mark among them), the nav seam, all ten `nav-ui` tab treatments, both chat surfaces,
the agent console,
the shell (inside a fixed frame, so it makes sense on a page that is not an app), and the
`obp-ui/canvas` boards behind the optional `@xyflow/react` peer.

Kitchen sink, not Storybook: no extra tooling, no stories to keep in sync. The interactive
components are really wired (dialogs open, selects select, the composer sends, the boards pan), and
the header's `<ThemeToggle />` flips light ↔ dark - both must look right, that is rule 4 in
[`DESIGN.md`](./DESIGN.md).

The gallery's sidebar is **flat and always expanded**: a section label, then every Spec in that
section, ~60 items that scroll, with a scroll spy tracking the one you are reading. It is not an
accordion - the item you want is almost always in a section you have not reached yet, so opening
the section you are already in costs a click and hides the rest. The Spec list is read off the DOM
(`[data-spec]`) after mount rather than hand-written, so adding a Spec adds a nav entry with no
second edit.

**Theme configuration has no section.** It is the `<ThemePicker />` in the header, and nowhere
else: a picker is only honest where it can re-skin the whole page, and a second live one would be
a second thing claiming to be the current theme. The comparison that would justify a section -
all six presets, light and dark, side by side - is inside that picker's editor, next to the
controls that act on it.

Two things worth copying from it: `gallery/src/app.css` is the exact app-entry stylesheet described
below, and the sections import the kit **by name** (`obp-ui`, `obp-ui/canvas`, `obp-ui/shell`, …)
through the package's own `exports` map, so every demo is also a usage example. The shell, console,
chat and nav-ui sections each import from *two* modules - the anonymous parts from `obp-ui`, the
archetype from its own entry - which is exactly what a consumer writes and the reason the split is
legible on the page. If a component is exported and not on that page, the gallery is wrong - add it.

---

## Install

The library **is** the root package of this repo. That is deliberate: it lets a consumer name the
repo directly, with no subdirectory fragment.

```jsonc
// any app's package.json
{
  "dependencies": {
    "obp-ui": "git+ssh://git@github.com/offbeatport/obp-ui.git#main",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.2",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.7.3",
    "vite": "^7.3.2"
  }
}
```

Pin a tag instead of `main` (`#v0.2.0`) once you have more than one consumer and want them to
move independently. pnpm records the resolved commit SHA in the lockfile either way, so an app
never drifts on its own - it moves when you run `pnpm update obp-ui`.

`react`, `react-dom` and `tailwindcss` are **peer** dependencies: the app owns those versions, so
there is exactly one React and one Tailwind in the tree. `@xyflow/react` is an optional peer; only
install it if you import `obp-ui/canvas`.

### Four things that bite

1. **It ships TypeScript source, not a build.** `exports` point at `./src/index.ts`, so the
   consumer's bundler compiles it. As a git dependency it lands as a real directory in
   `node_modules` and gets dep-pre-bundled, so exclude it: `optimizeDeps: { exclude: ["obp-ui"] }`.
2. **`moduleResolution` must be `"Bundler"`** (or `"NodeNext"`) in the consumer's `tsconfig.json`,
   otherwise TypeScript ignores the `exports` map and every subpath fails to resolve - all five of
   `obp-ui/canvas`, `/shell`, `/console`, `/chat`, `/nav-ui`. The bare `obp-ui` import keeps
   working, which is what makes this one confusing to diagnose.
3. **Deduplicate React** - two copies is the classic "invalid hook call". See the Vite config in
   the Tauri checklist.
4. **Private repo, so builds need credentials.** Locally your SSH agent covers it. In CI or
   Coolify the build container does not inherit the credential that cloned the app repo - add a
   deploy key or PAT as a build secret and teach git to use it:
   `git config --global url."https://x-access-token:$GITHUB_TOKEN@github.com/".insteadOf "git@github.com:"`.

### Working on the kit and an app at the same time

A git dependency is a snapshot, so a local edit to this repo will not show up in an app. For the
tight loop, override the dependency to your checkout and remember to drop it before committing:

```bash
pnpm --filter <app> add obp-ui@link:../../obp-ui   # or a pnpm.overrides entry
```

## The app stylesheet entry

Create exactly one stylesheet in the app and import it once from the app entry. This is the whole
file:

```css
@import "tailwindcss" source(none);

@import "obp-ui/fonts.css";
@import "obp-ui/fonts-alt.css";  /* only if a theme preset names those families */
@import "obp-ui/styles.css";
@import "obp-ui/canvas.css";     /* only if the app ships the canvas */
@import "obp-ui/desktop.css";    /* desktop only */

@source "../**/*.{ts,tsx}";
@source "<relative path to packages/ui/src>";
```

Order matters: fonts before tokens (so the `@font-face` rules exist when the family tokens are
read), and `desktop.css` last, because it deliberately overrides parts of the base layer.

Three traps, all of which have cost us time:

- **`source(none)` is not optional.** Without it Tailwind also auto-scans the Vite project root, so
  each app harvests classes out of whatever else is lying around (docs, prototypes, a second app's
  `dist/`) and the two apps emit *different* CSS from the same components. `source(none)` makes the
  class set exactly the `@source` lines below it - which is the only way "the desktop app looks
  identical" is a fact rather than a hope.
- **Never write `@source not …` in an app.** Source negations are global: a single `@source not`
  anywhere switches off the automatic source detection that `obp-ui`'s own `@source "../"`
  relies on, and the package's classes silently vanish from the output. Nothing errors; buttons
  just lose their padding.
- **A `**` glob inside a CSS comment ends the comment early.** The `*/` in the middle of
  `../**/*.tsx` closes it, and everything after that is parsed as CSS until the stray `*/` throws.
  Do not paste `@source` lines into `/* … */` blocks (this is why `src/styles/index.css` describes
  the snippet in prose and points here).

The second `@source` line is belt-and-braces: the package declares its own `@source "../"`
(relative to `src/styles/index.css`, and an explicit `@source` is exempt from Tailwind's automatic
`node_modules` exclusion), but a real in-repo relative path always resolves even when the pnpm
symlink confuses the scanner. The web app uses `"../../../../packages/ui/src"`.

---

## Mounting

Wrap the app once in `UIProvider`. It is the seam that lets shell components render links and know
what is active without the package ever importing a router.

### TanStack Router (the web app)

```tsx
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { UIProvider } from "obp-ui";

function Providers({ children }: { children: React.ReactNode }) {
    const pathname = useRouterState({ select: (s) => s.location.pathname });
    const navigate = useNavigate();
    return (
        <UIProvider
            Link={({ href, ...rest }) => <Link to={href} {...rest} />}
            navigate={(href, opts) => navigate({ to: href, replace: opts?.replace })}
            pathname={pathname}
        >
            {children}
        </UIProvider>
    );
}
```

### No router at all (Tauri / a static gallery)

`UIProvider` is optional - with no provider mounted the package falls back to plain `<a href>` and
`pathname: ""`, so active states simply stay off. Mount it anyway as soon as you have a notion of
"current screen":

```tsx
import { UIProvider } from "obp-ui";

const [screen, setScreen] = useState("/");

<UIProvider
    Link={({ href, children, ...rest }) => (
        <a
            href={href}
            {...rest}
            onClick={(e) => {
                e.preventDefault();
                setScreen(href);
            }}
        >
            {children}
        </a>
    )}
    navigate={(href) => setScreen(href)}
    pathname={screen}
>
    {children}
</UIProvider>;
```

Inside the package, always use `import { Link } from "../nav/link"` and
`useNav()` / `useIsActive(href)` from `"../nav/ui-provider"` - never a bare `<a>`, never a router
import.

**Route shapes are a prop too.** `UIProvider` takes an optional `paths` object
(`home()`, `companies()`, `company(slug)`, `settings(sub)`, …) so a host with a different URL
scheme - or a desktop app with no URLs at all - can remap every link in the shell without touching
a component. Anything you leave out keeps the default.

**Theme:** call `initTheme()` once at boot (it applies the stored preference and follows the OS
while in `system` mode) and drop `<ThemeToggle />` wherever the chrome wants it. A second app on
the same origin should namespace its own controller: `createTheme({ namespace: "myapp" })`.

---

## Theming a product

**The only file you override is `tokens.css`.** Components never change - that is the entire deal.
This is tier 2 in [`DESIGN.md`](./DESIGN.md): the tokens are a vocabulary every product is
*expected* to vary, so two products on this kit should not look like each other. Redefine the
token *values* after importing the package stylesheet:

```css
@import "obp-ui/styles.css";

/* This company is cool, tighter and violet-branded. */
:root {
    --radius: 0.5rem; /* 8px - buttons, inputs, badges */
    --radius-card: 0.75rem; /* 12px - cards, surfaces, dialogs */

    --background: #f6f7fb;
    --foreground: #1c1f2a;
    --card: #ffffff;

    --primary: #5b52d6;
    --primary-foreground: #ffffff;
    --accent: #e7e5fb;
    --accent-foreground: #4038ad;
    --ring: #5b52d6;
}

.dark {
    --background: #0a0b12;
    --card: #14161f;
    --primary: #8b83f0;
    --accent: rgba(139, 131, 240, 0.18);
}
```

The `@theme inline` block in `tokens.css` maps every token onto a Tailwind colour, so
`bg-primary`, `text-faint`, `border-border-soft`, `bg-success-soft` and friends follow along
automatically. Override *values*, never the mapping. Hex literals are legal **here** and nowhere
else - see rule 1 in [`DESIGN.md`](./DESIGN.md).

Three ways to do it, cheapest first:

1. **Ship a theme preset.** `THEME_PRESETS` holds six, `<ThemePicker />` swaps them at runtime,
   and `initThemePreset()` re-applies them across light/dark flips (the colour half is
   mode-specific). Nothing to write - see [Theme presets](#theme-presets-the-four-axes) below.
   Selecting Paper *removes* the overrides rather than restating them, so the default can never
   drift from `tokens.css`.
2. **Override the block above** for one fixed brand. This is what BuyDiff does: same primitives,
   same fonts, same radius, teal at 5.33:1 on the page.
3. **Add a palette** to `src/lib/palette.ts` when two products want the same colours, or a preset
   to `src/lib/theme-preset.ts` when they want the same *bundle*. The palette header records how
   the ten were built - achromatic surfaces, brand at 90% of the sRGB ceiling solved jointly with
   lightness against 4.5:1 on the page - and a new one that skips that will not sit next to the
   others.

**Verify before you ship.** The kit exports `contrastRatio(a, b)`; the floors are in DESIGN.md §1
(`--faint` on `--card` ≥ 4.55:1, `--primary` on `--background` ≥ 4.5:1 because it is the
prose-link colour, a filled status chip's label ≥ 5.65:1 in dark). Check **both** modes: dark
inverts the brand - `--primary` goes light and `--primary-foreground` goes dark - so a value that
passes in light can land at 1.17:1 in dark.

**Beyond colour:** the six `--type-*` steps (and their `-leading` pairs), `--radius`,
`--radius-card`, `--spacing`, `--measure` and the two shadows are token overrides too - components
name a *step* (`text-sm`, `text-lg`) and never a value or a font family, so a product resizes the
whole kit from the same block. Radius is the partial one: 35 literal `rounded-[Npx]` in the
composed kits (21 of them in `canvas/`) do not follow `--radius`.

**What you do not override:** the status hues. They are identical in every preset on purpose -
vocabulary, not skin. Only their `-soft` fills are re-mixed, against your page.

**What you cannot override yet:** anything with no token behind it - a fluid type step, a
brand-tinted shadow, a third radius. That is the archetype gap in DESIGN.md's last section, and it
is the reason PicSuper is not on this kit. Add the token, don't fork the components.

---

## Theme presets: the four axes

A **theme preset** is a curated bundle of four token groups. Names first, because there is a live
collision to keep straight: `Theme` in this package means `"light" | "dark"` - that is the **mode**,
and `initTheme()` / `<ThemeToggle />` own it. A **preset** is the other thing, and it renders in
either mode.

| axis | tokens | catalogue |
|---|---|---|
| colour | the 13 surface/ink/brand tokens, x light and dark | `THEME_PALETTES` (10) |
| type | `--font-sans` `--font-display` `--font-mono` `--font-serif` | `TYPE_PAIRINGS` (6) |
| radius | `--radius` `--radius-card` | `RADIUS_STEPS` (sharp / default / soft / round) |
| space | `--spacing` | `SPACE_STEPS` (compact / default / airy) |

```tsx
import { initTheme, initThemePreset, ThemePicker } from "obp-ui";

initTheme();        // resolves the MODE first…
initThemePreset();  // …then writes the four axes for whichever mode won

<ThemePicker />     // six presets in a popover + a custom editor
```

**Density is one token.** Tailwind v4 compiles every spacing utility as a multiple of `--spacing`
- measured in the built gallery CSS, 254 declarations of the form
`.h-9{height:calc(var(--spacing) * 9)}`, `.px-4{padding-inline:calc(var(--spacing) * 4)}`,
`.gap-2`, `.p-5`. So the density axis needs **no new tokens and no edits to any primitive**.
Tailwind declares `--spacing:.25rem` inside `@layer theme` on `:root,:host`; an inline property on
`<html>` is in no layer and outranks it. Measured in headless Chrome on a real `<Button>` (`h-9`):

| step | `--spacing` | control height |
|---|---|---|
| compact | `0.22rem` | 31.67px |
| default | `0.25rem` | 36.00px |
| airy | `0.28rem` | 40.32px |

Removing the inline property returns it to exactly 36.00px, which is the mechanism the default
preset relies on.

**Paper applies by clearing.** `applyThemePreset()` removes every managed property before writing,
and returns early for the default - so the authored theme is byte-exact whatever `tokens.css` says
today, and can never drift. The consequence: `MANAGED` in `src/lib/theme-preset.ts` has to list
**every** property any axis can write. A property missing from it survives the switch back to
Paper, and a stuck radius or a stuck font is invisible until someone picks the default and gets
the previous preset's measurements.

**A preset names families; it does not load them.** See [Fonts](#fonts) - if the app has not
imported the stylesheet carrying the faces a preset names, the token falls silently through its
fallback stack to `system-ui` and the preset looks like it did nothing.

The six: **Paper** (the authored theme, all four axes), **Console** (slate + Geist/Space Grotesk +
sharp + compact), **Editorial** (claret + Fraunces + soft + airy), **Technical** (teal + IBM Plex
+ sharp + compact), **Soft** (ochre + Instrument Serif + round + airy), **Mono** (graphite + Geist
+ authored radius and density). Console and Technical deliberately share a density and a radius -
that is the shape of a tool you sit in front of all day; what separates them is voice, not
measurement.

**The editor** (`<ThemePicker />` → *Compare presets…*) opens seeded from whatever preset you were
on. It leads with **all six presets drawn in both modes at once** - twelve tiles carrying their own
tokens inline, so corners, padding and type differ per tile rather than being described; clicking
one starts you from all four of its axes. Below that it takes those axes apart: the ten palettes as
chips (**colour only** - your type, radius and density survive a palette click, which is the point
of the widening) plus twelve colour pickers, a font pairing, a radius step, a density step. Colour
edits **one mode at a time** and
says which - a colour that works on cream rarely works on near-black - while type, radius and
space are mode-independent and apply to both. It persists through the `prefStorage` seam like
every other preference.

**Opening it costs nothing.** The seed is held in React state, not written through the controller,
so browsing the twelve tiles and closing leaves you on the preset you arrived with - `<html>` keeps
its zero inline properties and nothing is stored. Only an actual edit makes you *Custom*. That
matters because Custom is a frozen snapshot: it restates all 46 properties, so a user converted to
it by accident silently stops tracking later edits to `tokens.css`.

---

## Fonts

`obp-ui/fonts.css` self-hosts all four families - no CDN, because the desktop app has to work
offline and Tauri's CSP blocks `fonts.googleapis.com` by default:

| token | family | package |
|---|---|---|
| `--font-sans` | Inter (400/450/500/600/700 + italic) | `@fontsource-variable/inter` |
| `--font-display` | Space Grotesk (300-700) | `@fontsource-variable/space-grotesk` |
| `--font-mono` | JetBrains Mono (100-800) | `@fontsource-variable/jetbrains-mono` |
| `--font-serif` | Spectral (400/500/600 + italic) | `@fontsource/spectral` |

**Why the tokens say `"Inter Variable"`.** The `@fontsource-variable/*` packages register the face
under `<Family> Variable`, not `<Family>`. The variable-font machinery needs a distinct family name
so it does not collide with a statically-installed `Inter` on the same machine. So the tokens list
both, variable first:

```css
--font-sans: "Inter Variable", "Inter", system-ui, sans-serif;
```

**The failure mode:** install the fontsource packages, import `fonts.css`, but leave the token
saying `"Inter"` - and nothing errors. The `@font-face` rules load, no rule claims the family
`Inter`, so the whole app silently renders in `system-ui`. It looks *nearly* right, which is worse
than looking broken. If type suddenly feels a little too wide, check the family name first.

Skipping `fonts.css` entirely is legal (the plain names and the system fallbacks are still in the
stack) - you just get whatever the host machine has.

### `obp-ui/fonts-alt.css` - the faces the other presets name

The five non-default [theme presets](#theme-presets-the-four-axes) name families `fonts.css` does
not carry. They live in a **second, separately-imported stylesheet** on purpose: `fonts.css` is the
authored pairing that every app pays for, and this file is another ~3.6MB of woff2 on disk. An app
should pay only for the faces its chosen theme uses.

| token value | family | package |
|---|---|---|
| `"Geist Variable"` | Geist (100-900 + italic) | `@fontsource-variable/geist` |
| `"Geist Mono Variable"` | Geist Mono (100-900) | `@fontsource-variable/geist-mono` |
| `"IBM Plex Sans Variable"` | IBM Plex Sans (100-700 + italic) | `@fontsource-variable/ibm-plex-sans` |
| `"Fraunces Variable"` | Fraunces (100-900 + italic, `wght` axis only) | `@fontsource-variable/fraunces` |
| `"Instrument Serif"` | Instrument Serif (400 + italic - all it ships) | `@fontsource/instrument-serif` |

**A consuming app must import the stylesheet its preset's families come from.** A preset only
writes family *names* into `--font-*`; nothing loads a face on its behalf. Ship Editorial without
`obp-ui/fonts-alt.css` and `--font-display` names `"Fraunces Variable"`, no `@font-face` claims
that family, and the headings quietly render in Georgia - the same silent failure the paragraph
above describes, one level up. The rule of thumb:

| preset | needs |
|---|---|
| Paper | `fonts.css` |
| Console, Technical, Editorial, Soft, Mono | `fonts.css` **and** `fonts-alt.css` |

(The non-Paper presets still name JetBrains Mono, Space Grotesk or Spectral in at least one role,
so `fonts-alt.css` is an addition, never a replacement.) The gallery imports both, because it
draws every preset. Note the same `<Family> Variable` trap applies: four of the five register
under the Variable name, and only Instrument Serif - a static face - uses its plain name.

---

## The pre-paint script

`prePaintScript()` returns the inline script that resolves the persisted `<html>` classes **before
first paint**, so the app never flashes light-then-dark. It has to run synchronously in `<head>`,
which means it cannot be a React effect and cannot import anything - it is a string.

### TanStack Start

```tsx
import { prePaintScript } from "obp-ui";

export const Route = createRootRoute({
    head: () => ({
        scripts: [{ children: prePaintScript() }],
    }),
});
```

### Vite / Tauri `index.html`

The string is generated, so inline it at build time (a tiny Vite plugin or
`vite-plugin-html`), or hand-write the equivalent. For the desktop app the same script is also the
right place to stamp the two hooks `desktop.css` needs:

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <script>
            // <html class="is-desktop" data-os="…"> + the persisted theme, before first paint.
            try {
                var d = document.documentElement;
                d.classList.add("is-desktop");
                var p = navigator.userAgentData?.platform || navigator.platform || "";
                d.dataset.os = /mac/i.test(p) ? "macos" : /win/i.test(p) ? "windows" : "linux";
                var t = localStorage.getItem("cslopslop-theme");
                if (t === "dark" || (t !== "light" && matchMedia("(prefers-color-scheme: dark)").matches))
                    d.classList.add("dark");
            } catch (e) {}
        </script>
    </head>
    <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
    </body>
</html>
```

Pass the same namespace you pass to `createTheme()`; the storage keys are derived from it
(`<ns>-theme`), so they cannot drift. `prePaintScript(ns, [])` drops the console-tab preference for
an app that has no agent console.

---

## Desktop (`desktop.css`)

Opt-in layer, imported **after** `styles.css`, that makes the window behave like an app instead of
a page: chrome text is not selectable (content still is), no rubber-band overscroll, native macOS
scrollbars, drag-region and titlebar conventions, and a real `prefers-reduced-motion` pass over the
package's animations.

It needs two hooks on `<html>` (see the snippet above), and it can only reach an app that imports
it - the web app does not:

```html
<html class="is-desktop" data-os="macos">
```

Useful hooks it defines: `--titlebar-height`, `--titlebar-inset` (78px of traffic-light clearance
on macOS), `.titlebar` / `.titlebar-controls`, `[data-selectable]` / `[data-selectable="false"]`,
`[data-scroll-region]`, and `.allow-transition` - the documented escape hatch from the base layer's
`transition-duration: 0s !important` on buttons and links, for the one case where a fade helps
(window-control hovers). Read the file; every block explains itself.

---

## Tauri v2 checklist

*Verified against the Tauri v2 docs (`v2.tauri.app`) in August 2026; two of the numbers we had
written down were wrong and are corrected below.*

### 1. CSP - `app.security.csp`

In Tauri v2 the key is nested under `app`, **not** at the root the way v1 had it:

```jsonc
// src-tauri/tauri.conf.json
{
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        "script-src": "'self'",
        "style-src": "'self'",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "connect-src": "ipc: http://ipc.localhost"
      }
    }
  }
}
```

**`style-src` no longer needs `'unsafe-inline'`, and this is one of the things the move off Radix
bought.** Radix pulled in `react-remove-scroll`, which scroll-locks via `react-style-singleton` -
a `<style>` element created from JS with no nonce on it, on every Dialog, DropdownMenu, Select and
Tooltip. Nothing could nonce it, so the directive had to be widened.

Base UI has no `react-remove-scroll` dependency; it scroll-locks by setting style *attributes* from
JavaScript, and CSP does not police those (`style-src-attr` only governs attributes parsed out of
server-rendered HTML, not ones script assigns). The single `<style>` element it would still inject
is the scrollbar-hiding rule used by `ScrollArea.Viewport` and `Select.Popup` - and `UIProvider`
turns that off via Base UI's `CSPProvider disableStyleElements`, because the same rule ships as
ordinary bundled CSS in `base.css`. Tailwind's output was always a normal bundled asset.

Dropping `'unsafe-inline'` also retires the `dangerousDisableAssetCspModification` escape hatch
that used to be required alongside it. The reason it was required is worth keeping in mind if you
ever put `'unsafe-inline'` back: at compile time Tauri appends its own nonces and hashes to the
directives for the assets it bundles, and per the CSP spec a directive containing a nonce or hash
makes browsers **ignore `'unsafe-inline'` in that directive**. Setting it to `["style-src"]` told
Tauri to leave that one alone. Never pass `true` - that also disables nonce injection for
`script-src`, throwing away the protection you actually want.

> Verified by reading Base UI 1.7's source and CSP docs, not yet by shipping a hardened Tauri
> build. If a dialog or select misbehaves under the stricter policy, check the devtools console
> for a CSP violation before assuming the component is broken.

If you server-render (the web app, not the desktop one) and your policy blocks inline styles
outright, pass a per-request nonce through: `<UIProvider nonce={nonce}>`.

This only reproduces in a compiled build (`tauri build --debug`), never in `tauri dev`, because the
injection happens at compile time. Dialogs that open with no styling and a CSP violation in the
console are this bug.

### 2. `build.target` - raise it above Tauri's default

Tauri's Vite guide recommends `chrome105` on Windows and `safari13` elsewhere. **Both are below
Tailwind v4's floor** (Chrome 111 / Safari 16.4 / Firefox 128 - it uses `@property`, `color-mix()`
and cascade layers, none of which esbuild can down-level). Raise them:

```ts
// vite.config.ts
export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ["react", "react-dom"] },
    build: {
        target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome111" : "safari16",
        minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
    },
    envPrefix: ["VITE_", "TAURI_ENV_*"],
    clearScreen: false,
    server: { port: 5173, strictPort: true, watch: { ignored: ["**/src-tauri/**"] } },
});
```

Correction to what we had written down before: **Safari 16.4 is not simply "macOS 13.3"**. It
shipped in March 2023 with macOS 13.3 Ventura but was also offered as an update to Monterey and Big
Sur, and WKWebView follows whatever Safari is installed - so the real requirement is "a machine
that has taken the Safari 16.4 update", i.e. macOS 11.7.5 / 12.6.4 / 13.3 or newer. Note esbuild's
`safari16` means 16.0; write `safari16.4` if you want the target to be exactly Tailwind's floor.
Windows is evergreen WebView2, so `chrome111` is a formality there - but an esbuild target of 105
would still down-level syntax the CSS needs.

### 3. One React

```ts
resolve: { dedupe: ["react", "react-dom"] }
```

pnpm's strict `node_modules` plus a symlinked workspace package is the exact shape that produces
two React copies. The symptom is "Invalid hook call" the first time a Base UI primitive mounts, or
a `UIProvider` context that reads as empty inside the package.

### 4. Drag regions need a capability

`data-tauri-drag-region` calls the `start_dragging` window command, which is gated by the
permission system. Without the grant the attribute does nothing at all - no error, the window just
does not move:

```jsonc
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "windows": ["main"],
  "permissions": ["core:window:default", "core:window:allow-start-dragging"]
}
```

`windows` must list the labels the drag region actually appears in. Two behaviours worth knowing:
the attribute applies **only to the element it is written on** (children need their own, which is
deliberate so buttons inside a titlebar keep working), and on macOS an unfocused window takes the
first drag to focus and a second to move.

`desktop.css` styles the attribute (cursor, no selection) but cannot grant it - Tauri hit-tests it
natively, and Electron's `-webkit-app-region` is not involved.

### 5. Everything else

- `identifier` is required in `tauri.conf.json`; `productName` and `version` are optional.
- A frameless macOS window that keeps native traffic lights uses `titleBarStyle: "Transparent"`
  (plus `hiddenTitle`) rather than `decorations: false` - that is what `--titlebar-inset` clears.
- The fonts are bundled as app assets, so `font-src 'self' data:` is enough; nothing reaches for
  Google Fonts.

---

## Defining your own palette in a consuming app

Two ways, depending on whether the brand is fixed or switchable.

**Fixed brand — CSS only.** Redeclare the token values in your own stylesheet after the import.
No JS, no runtime. Never fork `tokens.css`.

```css
@import "obp-ui/styles.css";
:root { --primary: #7c3aed; --accent: #ede9fe; /* ... */ }
```

**Switchable, or you want the neutrals derived for you — `makePalette`.** You supply five hexes;
the eight neutrals, both `primaryForeground`s, `shadowTint` and the dark `accent` wash are derived
from the primary's hue against the kit's shared lightness ladder.

```ts
import { makePalette, makePreset, themePresets } from "obp-ui";

const brand = makePalette({
    id: "brand",
    name: "Brand",
    note: "my product",
    light: { primary: "#7c3aed", accent: "#ede9fe", accentForeground: "#5b21b6" },
    dark: { primary: "#c4b5fd", accentForeground: "#ddd6fe" },
});

themePresets.setCustomTheme(makePreset(brand, { type: "geist", radius: "sharp", space: "compact" }));
themePresets.applyThemePreset();
```

`makePreset` fills the other three axes - type, radius, space - falling back to the Paper defaults
for any you omit. `tint: 0` on the spec gives a pure achromatic set; `washAlpha` overrides the dark
accent's 0.18.

Check the two floors on anything you invent, both modes: `contrastRatio(faint, card) >= 4.55` and
`contrastRatio(primary, background) >= 4.5`. Both are exported from the barrel.

## Adding a primitive

`components.json` in this package points the shadcn CLI at `src/primitives`, so run it **here**,
not in the app:

```bash
npx shadcn@latest add <name>      # from this repo's root - the library IS the root package
```

Since July 2026 the CLI emits **Base UI** components by default, which is the same headless layer
this kit is on - so what it writes now lines up with `src/primitives` instead of fighting it. Do
not pass `-b radix`: that asks for the lineage this repo deliberately left.

Then, before committing:

1. rewrite the generated `@/…` imports to relative ones (`../lib/cn`, `../primitives`) - the
   package has no path alias at runtime;
2. add `"use client";` on line 1 if it uses hooks, handlers, browser APIs or context;
3. re-theme it with tokens (the CLI emits raw shadcn colours) - that is rule 1 in
   [`DESIGN.md`](./DESIGN.md), and a primitive is tier 1, so it is binding on every product;
4. keep the kit's `asChild` spelling rather than Base UI's `render`, via the adapters in
   `src/lib/base-ui-compat.ts` - five apps are written against `asChild`;
5. export it from `src/primitives/index.ts`, and add it to the gallery.

If the CLI complains that it cannot find an import alias, add
`"paths": { "@/*": ["./src/*"] }` to `tsconfig.json` - it is only used to resolve the write
target, and step 1 removes the aliases again.

Point a **consuming app's** `components.json` at `obp-ui` for its `ui` and `utils` aliases, so
running the CLI from the app writes imports that resolve to the package instead of quietly
re-creating a local `src/components/ui`. A product-local copy of a primitive is a fork.

---

## What is NOT in here

Deliberately, and permanently:

- **cslopslop domain surfaces** - the command centre, the company canvas' *content*, the spin flow,
  the agent console's data, the guardrail ledger's rules. Hard-coded arrays and maps of cslopslop
  concepts (nav lists, presets, step lists, score metadata, mock content) live in `apps/web` and
  arrive here as **props**. The package ships the shape; the app supplies the content.
- **Server functions and data access** - no `~/server/*`, no `createServerFn`, no fetching. A
  component that needs data takes it as a prop; a component that needs to mutate takes
  `onSend(text)`, `onRefresh()`, `onSelect(id)`.
- **The database** - no `drizzle-orm`, no `better-sqlite3`, no schema types. Types the components
  genuinely need (a status union, a tone union) are re-declared here as small local types, and the
  app's types are structurally assignable to them.
- **Router and framework imports** - no `@tanstack/*`, no `~/…` alias, no `node:*`, no `zod`. Links
  and navigation come from the nav seam; `ClientOnly` comes from `../lib/client-only`.

If something you are extracting needs one of those, it is not a design-system component yet - split
it until the presentational half has no opinions about where its data came from.

**Someone else's identity** is the leak this rule keeps catching. There used to be a `brand/`
family here holding a `LogoMark` whose defaults drew the cslopslop "C" tile exactly and a
`palettes.ts` that was a verbatim copy of that app's `config/spin.ts` gradient table. Both are
gone: a product's mark and a product's six hexes are the product's, not the kit's. What survived
is `GradientMark` - an avatar for a row, now in `data-display/` - which derives its two stops from
the seed and the live `--primary` instead of reading a table (see the file header for the
contrast measurements that decided it).

The one deliberate exception left is `provider-logos.tsx`: Anthropic's and OpenAI's marks in
Anthropic's and OpenAI's colours. Those are third-party identities, not ours, and no token can
express them.
