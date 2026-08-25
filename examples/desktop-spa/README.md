# desktop-spa - the reference consumer

A minimal, router-less, SSR-less Vite SPA that renders the kit: exactly the shape a Tauri v2
frontend has. It exists to answer one question with a build rather than a promise - *can a
desktop app use this package and look identical?* - and to be the thing you copy when you start
that app.

It is **not** wired into the pnpm workspace (`pnpm-workspace.yaml` globs `packages/*`, not
`packages/*/examples/*`), so it never installs or builds as part of normal work. It is a
snapshot of a verified configuration.

What it exercises, none of which involves a router or a server:

- `AppShell` + `Rail` + `NavItem` + `SectionLabel` + `EntityRow` + `AccountButton`/`AccountMenu`
- `TitleBar` + `WindowControls` through `WindowControlsProvider` - the desktop chrome, with no
  `@tauri-apps/*` import anywhere in the package
- `UIProvider` with **no** `Link` supplied, proving the nav seam degrades to plain `<a href>`
- `createTheme({ namespace: "probe" })`, so the desktop app owns its own preference key
- primitives, status atoms, brand marks, timeline, chat, empty states
- the stylesheet entry from the package README, including `source(none)` and both `@source` lines

## Running it

Copy the folder somewhere it can install (or add it to the workspace temporarily), then:

```bash
pnpm install
pnpm build            # bundles the package's source through the app's own Vite/Tailwind
pnpm preview
```

The last verified run produced a 342 KB JS bundle, 112 KB of CSS and the four self-hosted
families as `.woff2` assets, with the paper theme rendering identically to the web app.

## Turning it into the real Tauri app

1. `pnpm create tauri-app` (or add `src-tauri/` to this folder).
2. Copy `tauri.conf.json`'s `security.csp` and `build.target` from the package README - Tailwind
   v4 needs a Safari 16.4 floor, and radix injects nonce-less `<style>` tags at runtime.
3. Replace the `UIProvider` with your router's `Link`/`navigate`/`pathname` if you add one.
4. Fill `WindowControlsProvider` with the real `@tauri-apps/api/window` calls - that is the only
   file in the app that should import a native API.
