# MAXHOSA AFRICA — app concept build

> **Concept demo — sample products, sample courier, no real purchase/delivery.**
> Every product, price, order, courier event and appointment slot here is
> sample data behind a typed mock provider. Nothing connects to MAXHOSA
> AFRICA's store, payments, couriers or bookings.

Two deliverables, one design:

1. **The app** — Expo SDK 57 · React Native 0.86 · React 19 · strict
   TypeScript · Expo Router, for iOS and Android (and web for review).
2. **The offline demo** — one HTML file anyone can open without installing
   anything: [`deliverables/MAXHOSA_AFRICA_App_Offline_Demo.html`](deliverables/MAXHOSA_AFRICA_App_Offline_Demo.html),
   with a ZIP and [`OPEN_ME_FIRST_README.txt`](deliverables/OPEN_ME_FIRST_README.txt).

This folder is a separate app from the bb.q Chicken app at the repository
root; the root's TypeScript, ESLint and Jest configs exclude it.

## Docs

| | |
|---|---|
| [PRODUCT_SCOPE](docs/PRODUCT_SCOPE.md) | What is in this build, and what is not |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | Structure, data flow, providers, testing |
| [DESIGN](docs/DESIGN.md) | Apple-style interaction rules and provisional tokens |
| [INTEGRATION_STATUS](docs/INTEGRATION_STATUS.md) | Every connector, labelled mock → production approved |
| [SECURITY_PRIVACY](docs/SECURITY_PRIVACY.md) | What the build does now; what launch requires |
| [commerce-integration-audit](docs/commerce-integration-audit.md) | Discovery status and open questions |
| [TASK_BOARD](docs/TASK_BOARD.md) | Phased plan, status checklist, verification log |
| [COMPLETION_AUDIT](docs/COMPLETION_AUDIT.md) | How complete the app is (about 30% of production), what remains and what it costs |
| [OFFLINE_DEMO_TEST_RESULTS](docs/OFFLINE_DEMO_TEST_RESULTS.md) | The offline demo's automated test report |

## Quick start

```bash
cd maxhosa
npm install
cp .env.example .env.local      # optional: every provider defaults to mock
npm start                       # then i (iOS), a (Android) or w (web)
```

Every native module used ships with the Expo SDK (versions pinned by
`npx expo install`). A development build (`npx expo run:ios` /
`run:android`) is the closest match to production. **Not yet run on a
simulator or device** — this build was verified through Jest, the web export
and Chromium (see TASK_BOARD).

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Expo config, React Compiler rules, Prettier) |
| `npm test` | Jest — 75 tests |
| `npm run verify` | Asset gate → typecheck → lint → format check → tests |
| `npm run assets:verify` | The 24-image gate: count, uniqueness, integrity, allowlist, recorded additions, registry in step |
| `npm run assets:manifest` | Recompute hashes/sizes and regenerate the registry after replacing images |
| `npm run demo:build` | Build the single-file offline demo, its README and ZIP |
| `npm run demo:test` | Test the offline demo in Chromium with the network cut; writes the report |
| `npm run export:web` / `npm run shots:web` | Web export, then render and photograph 20 routes |

## Mock mode and configuration

`EXPO_PUBLIC_COMMERCE_PROVIDER`, `EXPO_PUBLIC_DELIVERY_PROVIDER`,
`EXPO_PUBLIC_BOOKING_PROVIDER` and `EXPO_PUBLIC_EVENTS_PROVIDER` select
adapters. Only `mock` exists; any other
value stops the app at start-up rather than running on sample data while
appearing live. While any provider is a mock, the demo strip shows on every
screen. See [INTEGRATION_STATUS](docs/INTEGRATION_STATUS.md) for what each
real adapter needs.

## The 24 images

`assets/maxhosa/` holds exactly the 24 verified concept images
(`mx-asset-01` … `mx-asset-24`) with a JSON and Markdown manifest (original
filenames, sizes, SHA-256, alt text, placement). They were extracted from the
brief's Appendix C, so they are **previews (280–336 × 420 px)**. To use the
full-resolution masters: replace each `mx-asset-NN.jpg` with its master
(JPEG), run `npm run assets:manifest`, then `npm run demo:build`. They remain
concept assets — not approved product photography or live SKUs — until
MAXHOSA approves them.

One image sits outside the 24: `mx-asset-25`, the sunset terrace event
photograph supplied with the events request, used as the hero of the sample
“Sunset knitwear soirée” and recorded in the manifest as an addition (who
supplied it, when, why). The gate refuses any addition without that record.
Confirm brand approval and rights before it is shown publicly.

## Offline demo vs. the app vs. a PWA

- **Offline demo:** a presentation prototype. One HTML file, inline
  everything, a Content-Security-Policy that blocks all network requests.
  Opens from Finder, Android's Files app or a WhatsApp *document* download in
  a browser. Not a native app and not installable.
- **Native app:** distributed through the App Store and Google Play after
  brand approval; gets native sheets, haptics, the system back gesture and,
  later, Live Activities.
- **PWA:** would need hosting over HTTPS for installability and a reliable
  service worker; not part of this build.

## Release checklist (not started — needs brand approval)

- [ ] Real providers verified in sandbox; INTEGRATION_STATUS updated
- [ ] Approved logo, icons, splash, typefaces, photography
- [ ] iOS and Android builds on real devices; VoiceOver/TalkBack; largest text
- [ ] Security review, secret scan, penetration test; POPIA/GDPR reviews
- [ ] Store metadata, privacy nutrition labels / data-safety form, support URL
- [ ] Bundle IDs confirmed (`africa.maxhosa.app.concept` is a placeholder)
