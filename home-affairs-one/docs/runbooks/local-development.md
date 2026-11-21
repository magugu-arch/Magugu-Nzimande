# Local development

How to install, run, build, preview and check the Home Affairs One prototype on your own machine,
how its images are produced, how to host it under a sub-path, how to switch the feature-flag
profile, how to reset the demo data, and what to do when something goes wrong.

Status: describes the scripts in the root `package.json` as they stand. The prototype is a static
site with in-browser mocks; there is no server, database or secret to configure.

## Prerequisites

| Need                          | Detail                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------- |
| Node.js 20.9 or later         | Set in `package.json` → `engines`                                                        |
| npm                           | The repository uses npm workspaces and a committed `package-lock.json`                   |
| A Chromium browser (e2e only) | Playwright's own Chromium, or a system Chromium pointed to by `PLAYWRIGHT_CHROMIUM_PATH` |

Run every command from the `home-affairs-one/` folder. The parent repository holds other projects
with their own lockfiles; running npm one level up works on a different project.

## Install

```bash
npm install     # or `npm ci` for a clean install that matches the lockfile exactly
```

This installs all workspaces (`apps/web`, `packages/*`, `services/*`, `infrastructure/local`).
Ask before adding or upgrading a dependency — see `docs/security/secure-development.md`.

## Everyday commands

| Command                 | What it does                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Derives images, then starts the Next.js dev server. Next prints the address (by default `localhost:3000`) |
| `npm run build`         | Derives images, then builds the static export into `apps/web/out`                                         |
| `npm run preview`       | Serves `apps/web/out` at `http://127.0.0.1:4173/` with a small static file server. Build first            |
| `npm run verify`        | Typecheck, lint, format check, unit tests and asset check, in that order. Run it after every change       |
| `npm run test:e2e`      | Playwright journeys and axe checks against the static export. Build first                                 |
| `npm run typecheck`     | `tsc --noEmit` for the workspaces and for the web app                                                     |
| `npm run lint`          | ESLint. `npm run lint:fix` applies automatic fixes                                                        |
| `npm run format:check`  | Prettier check. `npm run format` rewrites files                                                           |
| `npm test`              | Vitest, once. `npm run test:watch` re-runs on change                                                      |
| `npm run assets:derive` | Builds image derivatives and the generated manifest (also run by `dev` and `build`)                       |
| `npm run assets:check`  | Checks the 60 masters and the manifest                                                                    |

The dev server gives fast refresh and does not register the service worker. The preview serves
exactly what a static host would serve, including the service worker, so use it for a final look.

## End-to-end and accessibility tests

```bash
npm run build
npm run test:e2e
```

- The tests run against the real export in `apps/web/out`, so **build first**. Rebuild after any
  change you want the tests to see.
- Playwright starts the static server itself on port 4173. If a server is already listening there
  (for example `npm run preview`), it is reused — make sure it is serving a current build.
- Two projects run: `phone` (Pixel 7 emulation) and `desktop` (1280 × 860).
- Specs are picked up from `tests/e2e/**/*.spec.ts` and `tests/accessibility/**/*.spec.ts`.
- Browser: Playwright needs Chromium. Either download its own copy with Playwright's command
  `npx playwright install chromium`, or use a Chromium already on the machine:

  ```bash
  PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
  ```

- A different port: `E2E_PORT=4273 npm run test:e2e`.
- The tests expect the site at the root of the server. Build **without** `NEXT_PUBLIC_BASE_PATH`
  before running them.

Automated checks find only some accessibility problems. The manual checks are in
`manual-accessibility-testing.md`.

## How images are derived

| Path                                         | Role                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `assets/masters/`                            | The 60 supplied photographs. Never edit, rename or re-save them                         |
| `assets/manifest.json`                       | Hand-edited: ID, source file, subject, alt text, focal point, placements, review status |
| `apps/web/public/assets/home-affairs-one/`   | WebP derivatives (`A01-360.webp` …). Git-ignored; rebuilt on demand                     |
| `apps/web/src/generated/asset-manifest.json` | Generated: the manifest plus dimensions, checksum, dominant colour and widths           |
| `docs/design/asset-manifest.md`              | Generated: the human-readable register. Do not edit by hand                             |

`npm run assets:derive` (`scripts/derive-assets.mjs`) resizes each master to 360, 640 and 960 pixels
wide where that is usefully smaller than the original, plus the original width, and encodes WebP.
A derivative is only re-encoded when it is missing or older than its master, so re-running is
cheap.

`npm run assets:check` fails if a master is missing or its checksum has changed, if an asset lacks
alt text, a focal point, a placement or a review status, or if an asset is not used anywhere in
`apps/web/src`. Add `-- --derived` to also require every derivative file:

```bash
npm run assets:check -- --derived
```

To change alt text, a crop focus or a placement, edit `assets/manifest.json` and run
`npm run assets:derive`. In screens, use `<Photo asset="A12" />` only.

## Hosting under a sub-path

Set `NEXT_PUBLIC_BASE_PATH` at build time. It must start with a slash and have no trailing slash.

```bash
NEXT_PUBLIC_BASE_PATH=/my-org/home-affairs-one npm run build
npm run preview -- /my-org/home-affairs-one
# → http://127.0.0.1:4173/my-org/home-affairs-one/
```

The value is compiled into the build, so the folder must be served from exactly that path. Raw
`src` and `href` attributes go through `withBasePath()` (`apps/web/src/lib/base-path.ts`); Next
rewrites its own links. Browser storage is shared by everything on the same origin, whatever the
path — prefer an origin of its own for the prototype.

## Switching the feature-flag profile

The flags `wallet`, `biometricVerification`, `aiGuide` and `partnerIntegrations` default to the
`prototype` profile (all on, as labelled previews). To build with the `pilot` profile (all off):

```bash
NEXT_PUBLIC_FLAG_PROFILE=pilot npm run build     # or: NEXT_PUBLIC_FLAG_PROFILE=pilot npm run dev
```

Any other value means `prototype`. The profile is fixed at build time. Flag changes made on a
device are stored in `localStorage` under `hao.flags.v1` and take precedence over the profile
defaults — remove that key (or clear site data) to see a profile as built.

On Windows PowerShell, set a variable first: `$env:NEXT_PUBLIC_FLAG_PROFILE = 'pilot'; npm run build`.

## Resetting demo data

All demo data is created in the browser the first time each mock service is used, and kept in
`localStorage`. Changing seed data in code has no effect on a browser that already holds data.

- **In the app:** use the "reset demo data" control. It calls `resetDemoData()`
  (`apps/web/src/lib/gateway.ts`): every `hao.v1:` key is removed, `sessionStorage` is emptied and
  the page reloads with fresh sample data.
- **From the browser console**, if you cannot reach the control:

  ```js
  Object.keys(localStorage)
    .filter((key) => key.startsWith('hao.v1:'))
    .forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  location.reload();
  ```

- **Everything, including preferences, flag overrides and the offline cache:** clear site data for
  the address in the browser's developer tools.

Unit tests need none of this: `tests/setup.ts` clears both storages after each test.

## Common problems

| Symptom                                              | Likely cause and fix                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Commands fail or run a different project             | You are in the parent folder. `cd home-affairs-one`                                                             |
| Photographs are missing (404)                        | Derivatives are git-ignored. Run `npm run assets:derive` (`dev` and `build` do this for you)                    |
| `assets:check`: "not in the generated manifest"      | Run `npm run assets:derive`                                                                                     |
| `assets:check`: "master has changed"                 | A file in `assets/masters` was modified. Restore the original; masters are never edited                         |
| `assets:check`: "not used anywhere"                  | Every photograph must be placed in a screen. Place it, using `<Photo>`                                          |
| `test:e2e` cannot reach pages, or tests an old build | `apps/web/out` is missing or stale, or an old preview server is still on the port. Rebuild; stop the old server |
| `test:e2e`: browser executable not found             | Run `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH`                                        |
| Preview still shows old files after a rebuild        | The service worker serves cached static files first, then refreshes them. Reload twice, or clear site data      |
| New seed data does not appear                        | The browser already holds demo data. Reset it                                                                   |
| A gated feature is missing or unexpectedly present   | Check the build's flag profile and any `hao.flags.v1` override on the device                                    |
| Everything shows "offline" or errors                 | The simulated network mode is not `normal`. Change it in the prototype controls, or reset demo data             |
| Links or images break when hosted under a sub-path   | `NEXT_PUBLIC_BASE_PATH` at build time does not match the path being served                                      |
| Data is not kept between visits                      | The browser is blocking or clearing storage (private windows, strict settings)                                  |
| `format:check` fails on a file you did not touch     | Someone else's change. Do not reformat the whole tree; fix only your own files and tell the owner               |
