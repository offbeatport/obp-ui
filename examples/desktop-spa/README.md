# desktop-spa - the reference consumer

A minimal, router-less, SSR-less Vite SPA that renders the kit: exactly the shape a Tauri v2
frontend has. It exists to answer one question with a build rather than a promise - *can a
desktop app use this package and look identical?* - and to be the thing you copy when you start
that app.

It is a workspace member (`pnpm-workspace.yaml` globs `examples/*`), so a root `pnpm install`
links it against the kit's own source through `obp-ui: workspace:*`. Nothing builds it unless you
ask; it is a snapshot of a verified configuration.

What it exercises, none of which involves a router or a server:

- `AppShell` + `Rail` + `NavItem` + `SectionLabel` + `EntityRow` + `AccountButton`/`AccountMenu`
- `TitleBar` + `WindowControls` through `WindowControlsProvider` - the desktop chrome, with no
  `@tauri-apps/*` import anywhere in the package
- `UIProvider` with **no** `Link` supplied, proving the nav seam degrades to plain `<a href>`
- `createTheme({ namespace: "probe" })`, so the desktop app owns its own preference key
- primitives, brand marks, timeline, chat, empty states
- the stylesheet entry from the package README, including `source(none)` and both `@source` lines

## Running it

`pnpm install` once at the repo root, then from `examples/desktop-spa`:

```bash
pnpm build            # bundles the package's source through the app's own Vite/Tailwind
pnpm preview
```

The last verified run produced a 342 KB JS bundle, 112 KB of CSS and the four self-hosted
families as `.woff2` assets, with the paper theme rendering identically to the web app.

## Turning it into the real Tauri app

1. `pnpm create tauri-app` (or add `src-tauri/` to this folder).
2. Copy `tauri.conf.json`'s `app.security.csp` and `build.target` from the package README - note
   the key is nested under `app` in Tauri v2, not at the root the way v1 had it. Tailwind v4 leans
   on `@property`, `color-mix()` and cascade layers, and it is `@property` that puts the floor at
   Safari 16.4. Take the hardened `style-src 'self'` with them: `UIProvider` turns off the one
   `<style>` element Base UI would otherwise inject, so nothing in the kit needs `'unsafe-inline'`.
3. Replace the `UIProvider` with your router's `Link`/`navigate`/`pathname` if you add one.
4. Fill `WindowControlsProvider` with the real `@tauri-apps/api/window` calls - that is the only
   file in the app that should import a native API.
