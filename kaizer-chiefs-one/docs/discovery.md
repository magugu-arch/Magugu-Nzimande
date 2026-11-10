# Phase 0 — Discovery report

Date: 10 November 2026. Status: proposed direction, not a club-approved specification.

## 1. What was in the repository

The repository `magugu-arch/Magugu-Nzimande` held two unrelated projects and no Kaizer Chiefs code:

| Path | What it is | Stack |
| --- | --- | --- |
| `/` (root) | bb.q Chicken South Africa ordering app | Expo SDK 57, React Native 0.86, React 19.2, Expo Router, TanStack Query, Zustand, TypeScript strict, Jest (`jest-expo`), ESLint 9 flat config, Prettier, EAS profiles, Playwright screen audits |
| `bulls-one/` | Vodacom Bulls "Loftus Experience" concept | A single-file HTML/CSS/JS prototype with a Python build and a GitHub Pages site build |

## 2. Baseline health of the existing code (before any change)

| Check | Result |
| --- | --- |
| `npm ci` (root) | Installs cleanly |
| `npm run typecheck` (root) | Passes |
| `npm run lint` (root) | 0 errors, 11 warnings (all pre-existing) |
| `npm test` (root) | 54 suites, 891 tests, all pass |

None of these were changed except to exclude the new workspace from the root's TypeScript,
ESLint and Jest scans (three one-line ignores). They still pass after that change.

## 3. Decision: a separate workspace, not a rewrite

The brief recommends a TypeScript monorepo (`apps/mobile`, `apps/admin`, `packages/*`,
`supabase/`, `docs/`). The root is a working, tested app for a different client, so replacing
it would break a sound structure. The Kaizer Chiefs One App therefore lives in its own npm
workspace at `kaizer-chiefs-one/`, with its own lockfile, CI job and tooling.

What carries over from the root, because it already works on SDK 57:

- the same Expo SDK 57 / React Native 0.86 / React 19.2 line, Expo Router, TanStack Query and
  Zustand, aligned with `expo install --check` against SDK 57's bundled module list;
- per-weight Google Font imports, Reanimated/Worklets setup and Jest mocking patterns;
- the habit of rendering every route in a browser and failing on overflow and console errors.

## 4. Fit of the proposed architecture

| Brief | Built here |
| --- | --- |
| `apps/mobile` Expo + RN + TS | Yes. Expo Router app, 30 routes. |
| `apps/admin` Next.js + TS | Yes. Next.js 16, role-protected, server-side RBAC. |
| `packages/ui` tokens | Yes. Colour, type, spacing, radii, elevation, breakpoints, states, springs. Generates CSS variables for the admin. |
| `packages/contracts` | Yes. zod schemas, domain types, provider interfaces, RBAC, capability flags. |
| `supabase/` migrations, RLS, functions | Yes. Schema, RLS on every user-scoped table, policy tests that run in PGlite (no Docker). Function stubs fail clearly until providers are configured. |
| `docs/` | Yes. This report, architecture, decisions, integration contracts, release checklist, open decisions. |

## 5. Expo documentation

`AGENTS.md` asks for the exact v57 docs. `docs.expo.dev` is not reachable from the build
environment's network, so the v57 pages were read from their source in the `expo/expo`
repository (`docs/pages/...`) and from the installed packages' type definitions. Notable
v57 guidance followed: Metro needs no monorepo configuration from SDK 52 on; JavaScript tabs
are bundled with Expo Router from SDK 56; `expo-image-picker` takes `mediaTypes` as an array
of `'images' | 'videos'`, reports `duration` in milliseconds, and its plugin can block the
camera and microphone permissions.

## 6. First milestone (delivered in this session)

Design tokens and navigation foundation, then the content-led MVP on clearly labelled demo
adapters:

1. Tokens and contracts, with tests that encode the brief's non-negotiables (no demo scores,
   no demo membership, no demo balance, short-lived ticket tokens, consent-first uploads).
2. The mobile shell: onboarding, guest mode, demo sign-in, five tabs and every surface the
   brief lists, each with loading, empty, unavailable and error states.
3. The database schema with RLS and tests proving supporters cannot read each other's data.
4. The admin shell with server-enforced roles, moderation, content and audit log.

## 7. Blockers that only the club can clear

See [open-decisions.md](./open-decisions.md). Nothing in this build connects to a real club
system; every integration sits behind an adapter and a capability flag.
