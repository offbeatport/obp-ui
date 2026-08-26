# @paperkit/ui

The editorial **"paper"** design system: design tokens, 19 primitives, the shared shell
pieces, self-hosted fonts, and a router-agnostic nav seam. One package, two hosts - the
TanStack Start web app (`apps/web`) and the Tauri v2 desktop app render from the same bytes.

- **The law:** [`DESIGN.md`](./DESIGN.md) - tokens only, compose don't fork, both themes work.
  Read it before adding UI.
- **The gallery:** `pnpm ui` - every export in one page, no app required. See
  [The gallery](#the-gallery).
- **The showcase:** the `/design` route lives in the web app (`apps/web/src/routes/design.tsx`).
- **No app in here.** No router, no server functions, no database, no cslopslop domain data - see
  [What is NOT in here](#what-is-not-in-here).

```
src/
  styles/     tokens.css · base.css · shell.css · keyframes.css · fonts.css · canvas.css · desktop.css
  primitives/ button card badge dialog dropdown-menu input label radio-group scroll-area
              select separator switch table tabs textarea tooltip
  nav/        UIProvider · Link · TabNav · SegmentedTabs
  lib/        cn · theme · storage · prepaint · dom-class-pref · client-only
  markdown.tsx · confirm-dialog.tsx · theme-toggle.tsx · provider-logos.tsx
gallery/      the kitchen sink (`pnpm ui`) - a small Vite app, one page, every export
```

---

## The gallery

```bash
pnpm ui                       # from the repo root - or from packages/ui
```

A small Vite + React app in [`gallery/`](./gallery) that serves **one page on
http://localhost:5180** showing every component in the public barrel: the tokens themselves
(surfaces, brand, the full status language with its `-soft` fills, radius, elevation, type), the
19 primitives with every variant *and* every size, brand marks, the status atoms, the data-display
surfaces, the nav seam, all ten `nav-ui` tab treatments, both chat surfaces, the agent console,
the shell (inside a fixed frame, so it makes sense on a page that is not an app), and the
`@paperkit/ui/canvas` boards behind the optional `@xyflow/react` peer.

Kitchen sink, not Storybook: no extra tooling, no stories to keep in sync. The interactive
components are really wired (dialogs open, selects select, the composer sends, the boards pan), and
the header's `<ThemeToggle />` flips light ↔ dark - both must look right, that is rule 4 in
[`DESIGN.md`](./DESIGN.md).

Two things worth copying from it: `gallery/src/app.css` is the exact app-entry stylesheet described
below, and the sections import the kit **by name** (`@paperkit/ui`, `@paperkit/ui/canvas`) through
the package's own `exports` map, so every demo is also a usage example. If a component is exported
and not on that page, the gallery is wrong - add it.

---

## Install

### A new app inside this monorepo

`pnpm-workspace.yaml` already globs `apps/*` and `packages/*`, so a workspace protocol dependency
is all it takes:

```jsonc
// apps/desktop/package.json
{
  "name": "@cslopslop/desktop",
  "private": true,
  "type": "module",
  "dependencies": {
    "@paperkit/ui": "workspace:*",
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

```bash
pnpm install                       # from the repo root
```

`react`, `react-dom` and `tailwindcss` are **peer** dependencies - the app owns those versions, so
there is exactly one React and one Tailwind in the tree. `@xyflow/react` is an optional peer; only
install it if you import `@paperkit/ui/canvas`.

### An app in a separate repo

The package is `private: true` and is not published. Consume it from a checkout or straight from
git:

```jsonc
// package.json
{
  "dependencies": {
    // a sibling checkout
    "@paperkit/ui": "file:../cslopslop/packages/ui",
    // …or the subdirectory of the git repo (pnpm's `path:` parameter)
    "@paperkit/ui": "github:<org>/cslopslop#path:/packages/ui"
  }
}
```

Three things that bite in a separate repo:

1. **It ships TypeScript source, not a build.** `exports` point at `./src/index.ts`, so the
   consumer's bundler compiles it. With Vite that is automatic for a symlinked (`workspace:`/
   `file:`) dependency; for a git dependency it lands as a real directory in `node_modules` and
   gets dep-pre-bundled, so exclude it: `optimizeDeps: { exclude: ["@paperkit/ui"] }`.
2. **`moduleResolution` must be `"Bundler"`** (or `"NodeNext"`) in the consumer's `tsconfig.json`,
   otherwise TypeScript ignores the `exports` map and cannot find `@paperkit/ui/canvas`.
3. **Deduplicate React** - two copies is the classic "invalid hook call". See the Vite config in the
   Tauri checklist.

---

## The app stylesheet entry

Create exactly one stylesheet in the app and import it once from the app entry. This is the whole
file:

```css
@import "tailwindcss" source(none);

@import "@paperkit/ui/fonts.css";
@import "@paperkit/ui/styles.css";
@import "@paperkit/ui/canvas.css";     /* only if the app ships the canvas */
@import "@paperkit/ui/desktop.css";    /* desktop only */

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
  anywhere switches off the automatic source detection that `@paperkit/ui`'s own `@source "../"`
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
import { UIProvider } from "@paperkit/ui";

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
import { UIProvider } from "@paperkit/ui";

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
Redefine the token *values* after importing the package stylesheet:

```css
@import "@paperkit/ui/styles.css";

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

This is also how a company gets branded: cslopslop stamps this kit into the company repo and
rewrites exactly this block.

---

## Fonts

`@paperkit/ui/fonts.css` self-hosts all four families - no CDN, because the desktop app has to work
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

---

## The pre-paint script

`prePaintScript()` returns the inline script that resolves the persisted `<html>` classes **before
first paint**, so the app never flashes light-then-dark. It has to run synchronously in `<head>`,
which means it cannot be a React effect and cannot import anything - it is a string.

### TanStack Start

```tsx
import { prePaintScript } from "@paperkit/ui";

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
        "style-src": "'self' 'unsafe-inline'",
        "font-src": "'self' data:",
        "img-src": "'self' asset: http://asset.localhost blob: data:",
        "connect-src": "ipc: http://ipc.localhost"
      },
      "dangerousDisableAssetCspModification": ["style-src"]
    }
  }
}
```

`style-src` needs `'unsafe-inline'` because Radix injects stylesheets at runtime:
`react-remove-scroll` (Dialog, DropdownMenu, Select, Tooltip) goes through
`react-style-singleton`, which creates a `<style>` element from JS with no nonce on it. Tailwind's
own output is a normal bundled asset and does not need this.

**The part that is easy to get wrong:** at compile time Tauri appends its own nonces and hashes to
the CSP directives for the assets it bundles - and per the CSP spec, as soon as a directive
contains a nonce or hash, browsers **ignore `'unsafe-inline'` in that directive**. So the config
above only works with `dangerousDisableAssetCspModification: ["style-src"]`, which tells Tauri to
leave that one directive alone. Keep it as an array - passing `true` also disables nonce injection
for `script-src`, which throws away the protection you actually want.

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
two React copies. The symptom is "Invalid hook call" the first time a Radix primitive mounts, or a
`UIProvider` context that reads as empty inside the package.

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

## Adding a primitive

`components.json` in this package points the shadcn CLI at `src/primitives`, so run it **here**,
not in the app:

```bash
cd packages/ui
npx shadcn@latest add <name>
```

Then, before committing:

1. rewrite the generated `@/…` imports to relative ones (`../lib/cn`, `../primitives`) - the
   package has no path alias at runtime;
2. add `"use client";` on line 1 if it uses hooks, handlers, browser APIs or context;
3. re-theme it with tokens (the CLI emits raw shadcn colours);
4. export it from `src/primitives/index.ts`.

If the CLI complains that it cannot find an import alias, add
`"paths": { "@/*": ["./src/*"] }` to `packages/ui/tsconfig.json` - it is only used to resolve the
write target, and step 1 removes the aliases again.

`apps/web/components.json` now points its `ui` and `utils` aliases at `@paperkit/ui`, so running
the CLI from the app writes imports that resolve to the package instead of quietly re-creating
`apps/web/src/components/ui`. That directory is gone and should stay gone.

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
