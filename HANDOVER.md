# bb.q Chicken SA — Handover

Everything needed to take this over, in the order you'll need it.
`README.md` is the reference manual; this is the orientation.

---

## 1. What was built

A production-oriented React Native customer ordering app for bb.q Chicken South
Africa, built to the supplied brief.

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Stack            | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · Expo Router · TanStack Query · Zustand |
| Screens          | 42 routes covering every journey in brief §4                                                            |
| Browser journeys | 8, driven end to end against the mock layer                                                             |
| Food photography | All 16 catalogue products, own artwork, no placeholders                                                 |
| Logo             | Licensed bb.q lock-up, both approved variants, all icons derived from it                                |
| Tests            | 640, across 37 suites                                                                                   |
| Bundle           | 19.1 MB exported, of which 4.4 MB JavaScript                                                            |
| Branch           | `claude/bbq-chicken-app-czgvuz`                                                                         |

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
the app, and if something is wrong you'll see it there first. Heart a couple of
products on the way and they turn up on Home and behind a Menu filter.

```bash
npm run verify        # typecheck → lint → test, the gate before any commit
npm run preview:web   # the whole app in a browser, no build required
npm run audit:screens # renders all 26 screens at two widths and reports defects
npm run smoke:order   # signs in, adds an item and places an order, for real
```

The browser preview is the fastest way to see a change. It is not the device —
gestures, haptics and push do not apply — but layout and typography are honest,
and it needs no Apple account, no EAS and no cable.

---

## 3. The four things to understand

**Business logic is not in screens.** Pricing lives in `utils/cart.ts`,
commercial rules in `constants/config.ts`, data access behind `services/`.
Screens compose; they don't calculate. If you find yourself doing arithmetic in
a component, it belongs one layer down.

**Imagery resolves through one module, never a screen.** Screens pass a
`FoodAssetKey` to `<FoodImage>` and never `require()` a photograph; the logo is
only ever drawn by `<BrandMark>`. Both have masters that are never shipped —
`assets/food/masters/` and `assets/brand/masters/` — and one command each
(`assets:derive`, `assets:brand`) that regenerates everything downstream.
Adding or replacing artwork is: drop the file in, run that command.

**The guidelines are enforced, not just followed.** Buttons implement §22
exactly — four variants, three sizes at the published heights, all four states.
Colour pairs are asserted against §32.3's 4.5:1, and type roles against §11's
face assignments and §14.3's line-height band. None of it is eyeballed. If a
change breaks any of it, `npm run verify` says so.

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
> and a local Android SDK install.
>
> Everything upstream of the build server is verified. Both platforms prebuild
> clean and the generated manifests were read, not assumed. `expo-doctor` passes
> 19 of 21 checks — including the two that matter, native dependency versions
> and store-submission requirements. The two failures are this sandbox blocking
> `exp.host` and `reactnative.directory`; both are network checks, and both pass
> their local equivalents. Production bundles compile for both platforms with
> `EXPO_PUBLIC_USE_MOCK_API=0`.
>
> It has also been **run**, not only bundled. `npm run preview:web` renders it
> in a browser; driving the real ordering journey through it found six defects
> no test had caught, including a stale memo that left checkout permanently
> disabled once you picked a store. All six are fixed.
>
> React Native Web is not a device — gestures, haptics, push and native
> scrolling all differ. But for layout, typography and flow it is a far better
> proxy than a green test suite, and it costs nothing to look.
>
> What remains genuinely unknown is how it feels in the hand.

---

## 5. What is stubbed, and where to pick it up

Five integrations need something external. Each has a marked hook-in point.

| What                  | Where                                                                                | Needs                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Card capture**      | `app/account/payment-methods.tsx` — currently an explanatory alert                   | The gateway's PCI-compliant SDK. Never build your own card form.                                           |
| **Address geocoding** | `app/checkout/address.tsx` — anchors new addresses to the city centre                | A geocoder key                                                                                             |
| **Store map**         | `features/stores/components/StoreMapPreview.tsx` — schematic, pure RN, no native dep | Drop in react-native-maps or Mapbox; its props are already the ones a real map needs, so no caller changes |
| **Crash reporting**   | `ErrorBoundary` takes an `onError`                                                   | Sentry or Crashlytics                                                                                      |
| **Favourites sync**   | `store/favouritesStore.ts` — local and persisted                                     | `POST /v1/account/favourites`, so a heart follows the account to a new phone                               |

Also outstanding, and deliberate:

- **The logo masters are raster, lifted from the guidelines page.** Brand
  guidelines v1.0 was supplied as an image, not as artwork files, so
  `assets/brand/masters/` holds the lock-up and symbol separated out of that
  page rather than exported from the original. They are clean and hold at
  1024px — the symbol is redrawn from its coverage maps, not upscaled — but
  they are not vector-derived, so anything larger than an app icon (print,
  signage, a billboard-sized splash) wants the real master. Replacing them is
  the whole job: drop the two files in, run `npm run assets:brand`.
- **Only §3, §10–§14, §22, §23 and §32 of the guidelines were supplied.** Logo
  clear space is on page 05, which I have not seen; the icon uses generous
  spacing but has not been checked against the actual rule. _(Resolved since:
  §10.2 prints bb.q Red as `#E31937`, confirming the value the logo extract was
  normalised to — the guidelines page just renders it a few points darker.)_
- **§23.5 says Inter; §11 says Montserrat.** Resolved in favour of Montserrat —
  §11, §12, §13 and §14 are four pages of typography spec against one line, and
  they agree with each other. §23.5 looks like the outlier.
- **§12.2 puts UI buttons on Arial Bold; §11.2 puts them on Montserrat
  SemiBold.** Montserrat, since §13.3 and §13.4's callouts say the same.
- **The type and spacing changes have been measured and seen, but not held.**
  §23.7's 24px gutter replaced a 16px one, and the app moved from Helvetica
  Neue to Montserrat. `npm run assets:typefit` measures every static button
  label against §22.4's geometry — labels came out **30% wider** on average,
  worst case 42% — and the browser preview showed the rest: a wrapping CTA, a
  clipped tab label, an overflowing Apply button, all now fixed. What neither
  settles is how the heavier face reads in the hand. Every size is a token in
  `theme/typography.ts`, so trimming is a one-file change.
- **§10.2's 50/30/15/5 digital colour ratio is noted, not applied.** The app is
  mostly white with red as the accent, which is what the client's own mockups
  show and what leaves the food photography somewhere to sit. §10.1 allows the
  adjustment; §10.3's hierarchy — red leads, black supports, white spaces — is
  what the app follows. Worth a conversation if a designer disagrees.
- **Two departures from the drawings, both deliberate.** Disabled primary
  buttons use the pressed red for their label rather than the white the
  guidelines draw, because §22.9's own panel scores that pairing 2.1:1 and
  marks it Fail. And the tab bar keeps a filled icon for the active tab rather
  than §23.6's uniform line icons, because that gives the active state a
  non-colour signal, which is what §32.4 asks for. Both match the app mockups.
- **iOS `UIBackgroundModes`** omits `remote-notification`. User-facing alerts
  don't need it and Apple rejects apps declaring unused background modes. Add it
  only if the backend starts sending silent pushes.
- **`eas.json` submit placeholders** — fill `appleId`, `ascAppId`,
  `appleTeamId` before the first store submission.

---

## 6. Wiring the real backend

Set `EXPO_PUBLIC_USE_MOCK_API=0` and point `EXPO_PUBLIC_API_BASE_URL` at the API.

| Service               | Endpoints                                                       |
| --------------------- | --------------------------------------------------------------- |
| `menuService`         | `GET /v1/menu`, `/v1/menu/products/:id`                         |
| `storeService`        | `GET /v1/stores?lat&lng`, `/v1/stores/:id`                      |
| `orderService`        | `GET/POST /v1/orders`, `/v1/orders/:id`, `…/cancel`, `…/rating` |
| `rewardsService`      | `/v1/loyalty/*`, `/v1/promotions`, `/v1/vouchers/validate`      |
| `accountService`      | `/v1/account/*`, `/v1/support/*`                                |
| `authService`         | `/v1/auth/*`                                                    |
| `paymentService`      | `/v1/payments/*`                                                |
| `notificationService` | `POST /v1/account/push-tokens`                                  |

Six of those the app now _depends_ on rather than merely declares, because a
screen says something to the customer that only the endpoint can make true.
They are each on `audit:launch` with what they have to do:

| Endpoint                                | What the app has already told the customer                             |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `DELETE /v1/account`                    | "We remove your personal data within 30 days"                          |
| `PATCH /v1/account/preferences`         | A switch that turns promotions off, and a marketing-consent withdrawal |
| `POST /v1/auth/email/verify`            | "Send me the link" beside an unverified address                        |
| `DELETE /v1/account/push-tokens/:token` | That signing out stops this handset getting their order updates        |
| `POST /v1/orders`                       | The totals, which it must recompute rather than trust                  |
| `POST /v1/loyalty/redeem`               | A points balance the app deducts from at order time                    |

The first three are POPIA-adjacent: an app that offers erasure, opt-out or
verification and does not deliver it is worse than one that never offered.

A seventh is a gap rather than a promise. `POST /v1/account/addresses` takes
six text fields and returns them, and nothing geocodes on the way through — so
an address a customer types has no coordinates and the delivery-radius rule has
nothing to measure. The app used to fill that in with the Johannesburg CBD and
refuse or accept deliveries on the strength of it; it now records the absence
and refuses nobody it cannot measure, which means an address genuinely out of
range is accepted. Either that endpoint geocodes and returns `latitude` and
`longitude`, or a lookup gets wired into the form. Nothing else has to change:
the rule already reads the fields when they are there. This is the one place
where the honest behaviour is still the wrong outcome, so it is worth doing
early rather than last.

`services/apiClient.ts` owns auth headers, timeouts and error normalisation, so
moving to GraphQL means rewriting that one file, not every caller.

**One thing it does not do: validate.** `request<T>` casts the parsed JSON to
`T`. Every type in `src/types` is a promise about the wire that nothing checks
at runtime, so a field arriving as a string where a number is declared reaches
whatever consumes it. That is fine while the mock is the only source and the
seed matches the types by construction; it stops being fine the day a real
endpoint answers. It has already produced one small hole — a store's
coordinates were interpolated into a maps URL unchecked, which is now coerced
— and the next one will be somewhere less obvious. Worth a validation layer
inside `apiClient` before the backend goes live, so a malformed response
becomes one honest error rather than a strange screen three components away.

**Secrets:** tokens go to the platform keychain via `expo-secure-store`. Only
`EXPO_PUBLIC_*` values are inlined into the bundle. Card details are never
captured by our own form.

---

## 7. Guardrails already in place

These fail loudly rather than rotting quietly — leave them on.

- **`npm run verify`** — typecheck, lint, format, 640 tests. The pre-commit gate.
- **CI** (`.github/workflows/verify.yml`) runs that on every push, plus a Metro
  bundle for both platforms, a real prebuild audit of the native projects, and
  the asset checks.
- **`npm run assets:audit`** exits non-zero while any of the 16 products lacks
  its own photograph, so a new menu item can't ship on a placeholder.
- **`npm run smoke:order`** places an order: signs in, adds an item, chooses an
  address, submits, checks the confirmation carries a reference and that
  tracking shows the first status. Every unit test here checks a piece of that
  journey; this is the only thing that checks the pieces connect. It runs
  against the mock layer, so it needs no backend — which also makes it a check
  that the mock still models the real API.
- **`npm run audit:screens`** renders every screen at 390pt and 320pt and fails
  on anything sitting past the right edge, a page that scrolls sideways, a
  blank screen, a console error, or a §32.6 gap — an interactive element with
  no accessible name, or a focusable one with no visible focus ring. This is
  the check that found the defects the test suite could not see. It needs
  Playwright's Chromium once (`npx playwright install chromium`), or
  `CHROMIUM_PATH` pointed at one the machine already has. It signs in first:
  sweeping account screens signed out is not the screen anybody uses, and for a
  while that hid a real defect rather than finding one.
- **Eight more browser journeys**, each driving one thing a unit test cannot
  reach. They exist because every one of them caught something:
  - `audit:offline` — every data screen with the mock off and a host that does
    not answer. A screen that fetched nothing may only say so about itself, and
    must name the reason rather than blaming itself.
  - `audit:coldstart` — ordering as somebody who installed the app that
    morning: nothing saved, nothing ordered. The account the seed could never
    represent.
  - `audit:returning` — ordering _again_. Every other journey places a first
    order, which is the only order that reaches checkout with an address
    already in hand.
  - `audit:points` — earn the points the app promised and watch them land on
    the screen that states the balance.
  - `audit:tracking` — the wait counts down as the clock moves. Uses
    Playwright's clock, which drives timers as well as `Date`; a hand-rolled
    shim moves time without waking the thing that reads it.
  - `audit:handover` — one phone, two people. Favourites outlive a sign-out on
    purpose, so both halves have to hold at once.
  - `audit:guest` — what somebody who tapped "Continue as guest" can see.
  - `audit:delivery-range` — type an address in and try to have it delivered.
    The app has no geocoder, so a typed address has no coordinates; this holds
    the line that not knowing where somebody lives is a third answer, and that
    the radius rule still bites for an address that does carry them.
- **Two rules these browser checks must keep**, learned by breaking both.
  First, each one establishes the session it means to measure — signing in, or
  seeding one where there is no server to sign in against. Gating the account
  screens behind a sign-in silently turned half of `audit:offline` into a check
  of the guest view, and it kept passing. Second, no soft branches: a route
  that says nothing recognisable fails rather than warns. That soft branch is
  what let the first mistake go unreported for two days. A check written
  against one state of the app will keep reporting on that state after the app
  has moved, and will say nothing, because passing is what it was built to do.
- **`npm run audit:launch`** lists what only the franchise can supply — store
  list, prices, reward expiries, API host, store credentials, and every
  backend endpoint the app now depends on. Advisory by default; `--production`
  makes it fail the build, and `build:prod` calls it that way.
  All of these run in CI as their own job, and none is part of `npm run verify`
  — a browser sweep is minutes, and a pre-commit gate should be seconds.
- **Derivative drift checks** — CI re-derives both the food crops and the icon
  set and fails if either differs, catching anyone who edited a generated file
  by hand instead of its master. Icons are the likeliest to be quietly
  retouched in an image editor, which decouples them from the licensed logo.
- **Contrast is a test.** Every text-on-background pair the theme ships is
  asserted against §32.3 — 4.5:1 for normal text, 3:1 where the guidelines
  allow it. This found four real failures in the status palette when it was
  first written, including one that missed even the large-text bar.
- **Button labels are checked against §22.7.** The component uppercases by
  default, so a test reads every screen and fails if a long label was left
  without `preserveCase`.
- **Button labels are measured, not guessed.** `assets:typefit` computes real
  advance widths from the font file the app ships, at the narrowest screen
  worth supporting. React Native truncates an overlong label with an ellipsis
  rather than complaining, so this is the only way to see it without a device.
- **No screen can be orphaned.** A test walks the route tree and every string
  literal that looks like a route, and fails if a screen has no way in. Deleting
  the one link to a screen is easy and leaves working code that nobody can
  reach.
- **Fonts are checked two ways.** A role naming a weight the app never loads
  would render in the platform fallback and look almost right — a test reads
  the root layout and fails on it. A second fails if anyone tidies the
  per-weight imports back into a barrel import, which quietly ships all
  eighteen Montserrat cuts instead of the seven in use, for 4MB.
- **Logo proportions are asserted.** `BrandMark` sizes the lock-up from a fixed
  ratio so no caller can stretch it, and a test fails if that ratio stops
  matching the master — the exact thing that would break silently when someone
  drops in replacement artwork.
- **Data-integrity tests** assert every product references a real asset key,
  every recommendation points at a real product, option-group defaults are
  valid, and no category is empty. A malformed product fails the build.

---

## 8. Before the first store submission

A short list, because these are the things that fail a review rather than a
test. Everything here is already done except where marked.

|                      |                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android permissions  | Location, internet, vibrate. Nothing else — the three the toolchain adds unasked are blocked, and a test holds that line                                                                   |
| iOS background modes | None declared. Apple rejects apps claiming `remote-notification` without silent pushes                                                                                                     |
| Export compliance    | `ITSAppUsesNonExemptEncryption: false`, so submission does not stall on the encryption question                                                                                            |
| Card data            | Never captured by our code. A test greps the whole app for card, CVV and expiry fields                                                                                                     |
| Credentials          | Keychain via `expo-secure-store`. AsyncStorage holds profile and preferences only, enforced by `partialize` and asserted                                                                   |
| Bundle secrets       | Only `EXPO_PUBLIC_*` values, which are inlined and therefore public by definition. A test rejects any name implying a secret                                                               |
| POPIA                | Marketing consent and notification preferences reach the server and revert if that fails; account deletion asks for erasure rather than only signing out, and refuses to pretend it worked |
| Guest data           | Somebody who has not signed in is shown nothing belonging to an account, and their device does not ask for any. `audit:guest` holds that line                                              |
| **Still to do**      | Run `npm run audit:launch`. It is the live list — 21 items at the time of writing, every one needing your data, your credentials, or a real device. Nothing in this repo can close them    |

---

## 9. If I were picking this up

In order:

0. **Run `npm run audit:launch` and read it end to end.** It is the only
   document that stays current on its own, because it reads the repo rather
   than describing it. Several items are decisions rather than tasks — when
   loyalty points settle, whether the tier perks describe a programme you
   intend to run, and which of three shapes guest checkout should take. Those
   three were left open deliberately: each is a different business, not a
   different implementation, and guessing would have buried the question in
   code.
1. **Get it on a device and walk the ordering journey.** It has never run on
   hardware. That is the single largest unknown, and everything else is easier
   to judge afterwards. Offline _recovery_ is the specific thing to watch:
   losing signal is detected reliably and regaining it could not be shown in a
   browser.
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
