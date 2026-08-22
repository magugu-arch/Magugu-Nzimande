# bb.q Chicken SA — Handover

Everything needed to take this over, in the order you'll need it.
`README.md` is the reference manual; this is the orientation.

---

## 1. What was built

A production-oriented React Native customer ordering app for bb.q Chicken South
Africa, built to the supplied brief.

| | |
|---|---|
| Stack | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · Expo Router · TanStack Query · Zustand |
| Screens | 42 routes covering every journey in brief §4 |
| Food photography | All 16 catalogue products, own artwork, no placeholders |
| Tests | 154, across 10 suites |
| Branch | `claude/bbq-chicken-app-czgvuz` |

It runs **end to end with no backend**. `EXPO_PUBLIC_USE_MOCK_API` defaults to
`1`, so a bundled mock service layer serves menu, stores, orders, rewards and
payments. Every service already declares the endpoint and response type the real
API must return.

---

## 2. First thirty minutes

```bash
npm install
npm start           # press i / a, or scan with Expo Go
```

Sign in with any valid email and a password of 8+ characters. The OTP is always
`1234` — the screen says so.

Then walk the journey that matters: **Menu → a chicken product → customise →
add to cart → checkout → place order → track it.** That path exercises most of
the app, and if something is wrong you'll see it there first.

```bash
npm run verify      # typecheck → lint → test, the gate before any commit
```

---

## 3. The three things to understand

**Business logic is not in screens.** Pricing lives in `utils/cart.ts`,
commercial rules in `constants/config.ts`, data access behind `services/`.
Screens compose; they don't calculate. If you find yourself doing arithmetic in
a component, it belongs one layer down.

**Food imagery resolves through one module.** Screens pass a `FoodAssetKey` to
`<FoodImage>` and never `require()` an image. Masters live in
`assets/food/masters/`, are never shipped, and `npm run assets:derive`
regenerates four responsive crops plus the static require registry. Adding
artwork is: drop the file in, run that command.

**Money never touches raw floats.** All arithmetic rounds through cents, so
`0.1 + 0.2` is `0.3` and totals never drift. Use the helpers in `utils/money.ts`.

---

## 4. Getting it onto a device

```bash
npm install -g eas-cli
eas login
eas init                   # writes the real projectId into app.json — commit this
npm run build:dev:ios      # or build:dev:android
```

Then install the build and run `npm start`; the dev client connects to it.

**Push notifications only work in a development build.** Expo Go dropped remote
push in SDK 53. Registration, token sync, tap routing and cold-start routing are
all built and waiting for a real project id.

Profiles are in `eas.json`: `development`, `development-simulator`, `preview`
(mock API, for stakeholder review), `preview-live` (real API), `production`.

> I could not run the build myself. This environment's egress policy returns 403
> for `api.expo.dev`, `cdp.expo.dev` and `dl.google.com`, which blocks both EAS
> and a local Android SDK install. Everything upstream of the build server is
> verified: both platforms prebuild clean, native dependencies match the SDK 57
> bundle exactly, and the production Metro bundle compiles for both platforms.

---

## 5. What is stubbed, and where to pick it up

Four integrations need something external. Each has a marked hook-in point.

| What | Where | Needs |
|---|---|---|
| **Card capture** | `app/account/payment-methods.tsx` — currently an explanatory alert | The gateway's PCI-compliant SDK. Never build your own card form. |
| **Address geocoding** | `app/checkout/address.tsx` — anchors new addresses to the city centre | A geocoder key |
| **Store map** | `features/stores/components/StoreMapPreview.tsx` — schematic, pure RN, no native dep | Drop in react-native-maps or Mapbox; its props are already the ones a real map needs, so no caller changes |
| **Crash reporting** | `ErrorBoundary` takes an `onError` | Sentry or Crashlytics |

Also outstanding, and deliberate:

- **The app icon** is a generated typographic wordmark, not the licensed bb.q
  logo. `npm run assets:brand` draws it from brand tokens. Replace the files in
  `assets/` with the real artwork and delete the script.
- **iOS `UIBackgroundModes`** omits `remote-notification`. User-facing alerts
  don't need it and Apple rejects apps declaring unused background modes. Add it
  only if the backend starts sending silent pushes.
- **`eas.json` submit placeholders** — fill `appleId`, `ascAppId`,
  `appleTeamId` before the first store submission.

---

## 6. Wiring the real backend

Set `EXPO_PUBLIC_USE_MOCK_API=0` and point `EXPO_PUBLIC_API_BASE_URL` at the API.

| Service | Endpoints |
|---|---|
| `menuService` | `GET /v1/menu`, `/v1/menu/products/:id` |
| `storeService` | `GET /v1/stores?lat&lng`, `/v1/stores/:id` |
| `orderService` | `GET/POST /v1/orders`, `/v1/orders/:id`, `…/cancel`, `…/rating` |
| `rewardsService` | `/v1/loyalty/*`, `/v1/promotions`, `/v1/vouchers/validate` |
| `accountService` | `/v1/account/*`, `/v1/support/*` |
| `authService` | `/v1/auth/*` |
| `paymentService` | `/v1/payments/*` |
| `notificationService` | `POST /v1/account/push-tokens` |

`services/apiClient.ts` owns auth headers, timeouts and error normalisation, so
moving to GraphQL means rewriting that one file, not every caller.

**Secrets:** tokens go to the platform keychain via `expo-secure-store`. Only
`EXPO_PUBLIC_*` values are inlined into the bundle. Card details are never
captured by our own form.

---

## 7. Guardrails already in place

These fail loudly rather than rotting quietly — leave them on.

- **`npm run verify`** — typecheck, lint, 154 tests. The pre-commit gate.
- **CI** (`.github/workflows/verify.yml`) runs that on every push, plus a Metro
  bundle for both platforms, plus two asset checks.
- **`npm run assets:audit`** exits non-zero while any of the 16 products lacks
  its own photograph, so a new menu item can't ship on a placeholder.
- **Derivative drift check** — re-derives crops in CI and fails if they differ,
  catching anyone who edited a derivative by hand instead of the master.
- **Data-integrity tests** assert every product references a real asset key,
  every recommendation points at a real product, option-group defaults are
  valid, and no category is empty. A malformed product fails the build.

---

## 8. If I were picking this up

In order:

1. **Get it on a device and walk the ordering journey.** It has never run on
   hardware. That is the single largest unknown, and everything else is easier
   to judge afterwards.
2. **Wire the real menu endpoint.** It is the lowest-risk backend swap — the
   shape is already defined and the seed data documents it.
3. **Then payments**, because it is the one that must not be improvised, and it
   gates the rest of checkout being genuinely testable.
4. Leave the store map until last. The schematic version works, and a native map
   is a day of native config for a screen customers use briefly.

One caution: the mock service layer is convincing enough that it is easy to
forget it is mock. When something behaves suspiciously well — an order advancing
through statuses on schedule, a voucher validating instantly — check
`EXPO_PUBLIC_USE_MOCK_API` before concluding the backend works.
