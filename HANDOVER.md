# Pappas — Handover

Everything needed to take this over, in the order you'll need it.
`README.md` is the reference manual, `RUNBOOK.md` is for when it is live and
something needs changing or has gone wrong, `docs/DELIVERY_INTEGRATION.md` is
the Uber Eats and Mr D layer, and this is the orientation.

---

## 1. What was built

A production-oriented React Native app for **Pappas**, Greek and Mediterranean,
on Nelson Mandela Square — built to the supplied brief and its Uber Eats + Mr D
extension.

|                  |                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| Stack            | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · Expo Router · TanStack Query · Zustand |
| Screens          | 41 routes covering every journey in the brief                                                           |
| Delivery         | Pappas Direct built and live; Uber Eats and Mr D built and switched off pending contracts               |
| Browser journeys | 10, driven end to end against the mock layer                                                            |
| Photography      | 13 supplied Pappas masters, cropped clear of poster type; 45 dishes draw on them                        |
| Brand mark       | Reconstructed from the CI sheet — **replace with official artwork before production**, see §5           |
| Tests            | 61 suites; `npm test` prints the count                                                                  |
| Bundle           | 24 MB exported, of which 2.9 MB JavaScript                                                              |
| Branch           | `claude/pappas-uber-eats-mrd-integration-wtik4s`                                                        |

It runs **end to end with no backend**. A bundled mock service layer serves
menu, store, orders, reservations, rewards and payments. Every service already
declares the endpoint and response type the real API must return.

### The one thing to understand before anything else

**Pappas has not supplied prices, trading hours, contact details or loyalty
rules, and the app does not invent them.** The brief forbids it in two places
(§15, §17.15) and the restaurant's own site was unreachable from the build
environment, so there was nothing to verify against.

Rather than seed plausible numbers, "not supplied" is a typed state:
`data/businessInput.ts` defines `Fact<T>` as either a verified value or an
explicit `AwaitingBusinessInput`, and the screens render the difference. A
dish with no price shows an em dash, not `R 0.00`. The reserve flow requests a
table rather than confirming one. About says the hours are on request.

`npm run audit:placeholders` is the live list of what is outstanding — **7
restaurant details, 45 prices, 9 loyalty figures and 9 shared photographs** at
the time of writing. That report is the shortest path from here to a
launchable app, and none of it is engineering work.

This discipline paid for itself: four real defects surfaced that a seeded
catalogue would have hidden, including a zero-cost reward that computed as
affordable and redeemed for R0.

---

## 2. First thirty minutes

```bash
npm install
npm start           # press i / a, or scan with Expo Go
```

Sign in with any valid email and a password of 8+ characters. The OTP is always
`1234` — the screen says so.

Then walk the two journeys that matter:

- **Reserve** — Reserve tab → date, party size, time → details → request. This
  is the primary journey; the brief puts Discover and Reserve ahead of Order,
  and at a restaurant on the Square most guests eat in.
- **Order** — Menu → a dish → customise → cart → checkout → place → track.

Heart a couple of dishes on the way and they turn up on Home and behind a Menu
filter.

```bash
npm run verify           # typecheck → lint → format → test, the gate before any commit
npm run preview:web      # the whole app in a browser, no build required
npm run audit:screens    # renders all 34 sweepable routes at two widths and reports defects
npm run audit:placeholders # what Pappas still has to supply
npm run smoke:order      # signs in, adds an item and places an order, for real
npm run bundle:single    # folds the web export into one self-contained HTML file
```

`bundle:single` is for sending the app to somebody who has no toolchain — an
investor, a reviewer, anyone with a browser. It inlines the bundle and every
photograph into a single 11.6 MB document, so there is nothing to serve and
nothing to install. Run `expo export --platform web` first; it reads that
build. Two caveats worth stating when you send it: the photographs are
re-encoded smaller than the store build ships, and because there is only one
document, deep links into a route cannot work — the app opens at its own start
and is navigated from there.

The browser preview is the fastest way to see a change. It is not the device —
gestures, haptics and push do not apply — but layout and typography are honest,
and it needs no Apple account, no EAS and no cable.

---

## 3. The five things to understand

**Business logic is not in screens.** Pricing lives in `utils/cart.ts`,
commercial rules in `constants/config.ts`, data access behind `services/`.
Screens compose; they don't calculate. If you find yourself doing arithmetic in
a component, it belongs one layer down.

**Imagery resolves through one module, never a screen.** Screens pass a
`FoodAssetKey` to `<FoodImage>` and never `require()` a photograph; the mark is
only ever drawn by `<BrandMark>`. Masters live in `assets/pappas/` and are
never shipped; `npm run assets:pappas` regenerates every crop, and
`npm run assets:brand` regenerates the icon set. Adding or replacing artwork
is: drop the file in, run the command.

**Unknown is a value, not a blank.** See §1. If you are about to write a
default price, a default opening time or a default phone number, use
`awaiting()` from `data/businessInput.ts` instead and let the screen say so.

**Money never touches raw floats.** All arithmetic rounds through cents, so
`0.1 + 0.2` is `0.3` and totals never drift. Use the helpers in
`utils/money.ts` — and for a *dish*, use `features/menu/price.ts`, which knows
the difference between a price of zero and no price at all.

**No provider credential ever reaches the handset.** The Uber Eats and Mr D
adapters call a Pappas-hosted broker, never a provider API. See §6.

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

> The build was not run from here. This environment's egress policy returns 403
> for `api.expo.dev`, `cdp.expo.dev` and `dl.google.com`, which blocks both EAS
> and a local Android SDK install.
>
> Everything upstream of the build server is verified. Both platforms prebuild
> clean and the generated manifests were read, not assumed. Production bundles
> compile for both platforms with the mock layer off.
>
> It has also been **run**, not only bundled — in a browser, repeatedly, and
> that is where most of the defects came from. A hero whose top bar overlapped
> its own headline. An onboarding carousel whose Next button moved the
> photograph and not the words, so the introduction could not be finished. Nine
> screens still carrying the previous brand's copy. Type set at a weight that
> reads on a desktop and disappears on a handset. None of those failed a test.
>
> React Native Web is not a device — gestures, haptics, push and native
> scrolling all differ. But for layout, typography and flow it is a far better
> proxy than a green test suite, and it costs nothing to look.
>
> What remains genuinely unknown is how it feels in the hand.

---

## 5. What is stubbed, and where to pick it up

| What                   | Where                                                                                      | Needs                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **Card capture**       | `app/account/payment-methods.tsx` — currently an explanatory alert                         | The gateway's PCI-compliant SDK. Never build your own card form                                            |
| **Address geocoding**  | `app/checkout/address.tsx` — saves a typed address with no coordinates                     | A geocoder, or a backend that geocodes on POST. Until then the delivery radius cannot judge a typed address |
| **Store map**          | `features/stores/components/StoreMapPreview.tsx` — schematic, pure RN, no native dep       | react-native-maps or Mapbox; its props are already the ones a real map needs                               |
| **Crash reporting**    | `ux/errorReporting.ts` — errors are caught and scrubbed; nothing receives them yet          | One `ErrorReporter`, injected at startup. Sentry or Crashlytics                                            |
| **Analytics provider** | `ux/analytics.ts` — every event is sent, nothing receives them yet                          | One `AnalyticsAdapter`, injected at startup. Taxonomy and call sites are done                              |
| **Channel broker**     | `integrations/delivery/providers/ExternalChannelAdapter.ts` — posts to a broker that does not exist yet | A Pappas-side service. Endpoint spec in `docs/DELIVERY_INTEGRATION.md`                          |

### The brand mark is a reconstruction

**This is the item most likely to embarrass you if it ships unnoticed.**

Pappas supplied the mark in sixteen photographs and on a CI sheet, not as a
vector file. `BrandMark` therefore *sets* the wordmark in Cinzel — the face the
CI sheet itself specifies — rather than tracing the original, and draws the
olive sprig to match. Every measurement is read off the CI sheet's panel 01, so
it is a faithful reconstruction. It is still a reconstruction.

Get the licensed artwork, drop it in, run `npm run assets:brand`, and delete
the reconstruction path. Until then, do not use this mark for print, signage or
anything larger than an app icon.

### Other things outstanding, and deliberate

- **Gold never carries text on a photograph.** The CI palette's Sunset Gold is
  1.7:1 on beige and worse on a lit photograph, which is a light ground that
  also moves. Every gold eyebrow in the app sits on white over imagery, and
  `accentInk` — a darkened cut — carries gold text on light panels. The rule is
  written beside the token in `theme/colors.ts`. It has been broken once
  already; it will be broken again.
- **The type scale has legibility floors and they are tested.** Montserrat is
  geometric and lays down less ink than the faces most UI scales are tuned on;
  on this warm ground, at arm's length, Regular disappears. Reading roles are
  Medium or heavier, nothing is under 12px, and `typography.test.ts` holds
  both. This was a customer report, not a hypothesis.
- **iOS `UIBackgroundModes`** omits `remote-notification`. User-facing alerts
  don't need it and Apple rejects apps declaring unused background modes.
- **`eas.json` submit placeholders** — fill `appleId`, `ascAppId`,
  `appleTeamId` before the first store submission.

---

## 6. Uber Eats and Mr D

Full detail is in `docs/DELIVERY_INTEGRATION.md`. The orientation:

**Three channels behind one interface.** `DeliveryProvider` is implemented by
`PappasDirectAdapter`, `UberEatsAdapter` and `MrDAdapter`. Screens ask the
registry for a provider and never know which one answered. Adding a fourth
channel is one file.

**Two of the three are switched off**, because no contract exists yet.
`EXPO_PUBLIC_UBER_EATS_ENABLED` and `EXPO_PUBLIC_MR_D_ENABLED` default to
false, independently, so either can be turned on the day its contract is
signed without a code change and without disturbing the other.

**No credential is in the app, and none must ever be.** The external adapters
post to a Pappas-hosted broker at `EXPO_PUBLIC_CHANNEL_BROKER_URL`; the broker
holds the provider keys and signs the webhooks. Anything in `EXPO_PUBLIC_*` is
readable by anyone who downloads the app, so there is deliberately no
`UBER_EATS_API_KEY` anywhere in this repo.

**The status maps for both external providers are empty, and that is honest.**
`webhooks.ts` maps each provider's status vocabulary onto the canonical one.
Uber Eats and Mr D publish theirs under contract, and neither contract exists,
so those maps are `{}` rather than a plausible guess. An unmapped status is
ignored rather than misread — the brief's own instruction: if official contracts
or credentials are unavailable, do not invent them.

**What the layer already does correctly, and is tested:** forward-only status
transitions with terminal-state locking; idempotency keyed on order *intent*
rather than attempt, so a double-tap cannot create two orders; bounded webhook
de-duplication; capability declaration per channel (Mr D declares no pickup and
no scheduled orders); loyalty attribution limited to Pappas Direct, because
Pappas cannot see a marketplace customer's account.

**The outstanding blockers are commercial, not technical** — merchant accounts,
API credentials, the status vocabularies, and the catalogue/price mapping each
marketplace requires. They are listed per provider in the delivery doc.

---

## 7. Wiring the real backend

Set `EXPO_PUBLIC_USE_MOCK_API=0` and point `EXPO_PUBLIC_API_BASE_URL` at the API.

| Service               | Endpoints                                                       |
| --------------------- | --------------------------------------------------------------- |
| `menuService`         | `GET /v1/menu`, `/v1/menu/products/:id`                         |
| `storeService`        | `GET /v1/stores?lat&lng`, `/v1/stores/:id`                      |
| `orderService`        | `GET/POST /v1/orders`, `/v1/orders/:id`, `…/cancel`, `…/rating` |
| `reservationService`  | `/v1/reservations/*`                                            |
| `rewardsService`      | `/v1/loyalty/*`, `/v1/promotions`, `/v1/vouchers/validate`      |
| `accountService`      | `/v1/account/*`, `/v1/support/*`                                |
| `authService`         | `/v1/auth/*`                                                    |
| `paymentService`      | `/v1/payments/*`                                                |
| `notificationService` | `POST /v1/account/push-tokens`                                  |

Six of those the app now _depends_ on rather than merely declares, because a
screen says something to the customer that only the endpoint can make true.
They are each on `audit:launch`:

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
nothing to measure. The app records the absence and refuses nobody it cannot
measure, which means an address genuinely out of range is accepted. Either that
endpoint geocodes and returns `latitude` and `longitude`, or a lookup gets
wired into the form. This is the one place where the honest behaviour is still
the wrong outcome, so do it early rather than last.

`services/apiClient.ts` owns auth headers, timeouts and error normalisation, so
moving to GraphQL means rewriting that one file, not every caller.

**Validation is partial, on purpose.** `request<T>` casts parsed JSON to `T`.
`services/wireChecks.ts` supplies real parsing for the responses where a value
the app cannot read becomes a number a customer acts on: menu and product
prices, order totals and ETAs, store coordinates and delivery radii, the
loyalty balance, voucher terms. A failure raises `malformed_response` at the
fetch, so the screen shows its own "couldn't load" state and the console names
the exact field. It is deliberately not a schema per endpoint — each check
asserts only what the app would otherwise get wrong.

**Secrets:** tokens go to the platform keychain via `expo-secure-store`. Only
`EXPO_PUBLIC_*` values are inlined into the bundle. Card details are never
captured by our own form.

---

## 8. Guardrails already in place

These fail loudly rather than rotting quietly — leave them on.

- **`npm run verify`** — typecheck, lint, format, the whole test suite. The
  pre-commit gate.
- **CI** (`.github/workflows/verify.yml`) runs that on every push, plus a Metro
  bundle for both platforms, a real prebuild audit of the native projects, and
  the asset checks.
- **`npm run audit:placeholders`** lists every fact Pappas still has to supply
  and which of the 45 dishes lacks its own photograph, so a new menu item can't
  ship on a placeholder.
- **`npm run audit:screens`** renders every route at 390pt and 320pt and fails
  on anything past the right edge, a page that scrolls sideways, a blank
  screen, a console error, an interactive element with no accessible name, one
  hidden from a screen reader that still takes taps, a focusable one with no
  visible focus ring, a control nested inside another control, and anything
  under 44x44 to a thumb once its declared `hitSlop` is counted. This is the
  check that finds what the test suite cannot see. Needs Playwright's Chromium
  once, or `CHROMIUM_PATH` pointed at one the machine already has.
- **`npm run smoke:order`** places an order end to end and checks the
  confirmation carries a reference and that tracking shows the first status.
- **Eight more browser journeys**, each driving one thing a unit test cannot
  reach, and each of which caught something: `audit:offline`,
  `audit:coldstart`, `audit:returning`, `audit:points`, `audit:tracking`,
  `audit:handover` (one phone, two people), `audit:guest`,
  `audit:delivery-range`.
- **Two rules these browser checks must keep**, learned by breaking both.
  First, each one establishes the session it means to measure. Second, no soft
  branches: a route that says nothing recognisable fails rather than warns. A
  check written against one state of the app will keep passing after the app
  has moved, and will say nothing, because passing is what it was built to do.
- **`npm run audit:launch`** lists what only Pappas can supply. Advisory by
  default; `--production` makes it fail the build, and `build:prod` calls it
  that way.
- **Contrast is a test**, and on photographs it is a *measurement*: the hero
  was checked by sampling the rendered background behind each line and
  computing the real WCAG ratio. That found three failures whose medians looked
  fine — the failures were scattered bright spots no eye catches reliably.
- **No other restaurant's words.** `brandCopy.test.ts` scans all 184 source
  files, comments stripped, for the vocabulary of the app this was built from.
  Nine surfaces still carried it when that test was written.
- **Legibility floors on the type scale** — nothing under 12px, reading roles
  at Medium or heavier, line-height ratios, eyebrow tracking.
- **No screen can be orphaned.** A test walks the route tree and every string
  that looks like a route, and fails if a screen has no way in.
- **Fonts are checked two ways** — a role naming an unloaded weight would
  render in the platform fallback and look almost right; and a barrel import
  would quietly ship every Montserrat cut instead of the seven in use.
- **Data-integrity tests** assert every dish references a real asset key, every
  recommendation points at a real dish, option-group defaults are valid, no
  category is empty, and every search suggestion returns at least one dish.
- **Derivative drift checks** — CI re-derives the food crops and the icon set
  and fails if either differs, catching anyone who edited a generated file by
  hand instead of its master.

---

## 9. Before the first store submission

|                      |                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Android permissions  | Location, internet, vibrate. Nothing else — the three the toolchain adds unasked are blocked, and a test holds that line                                                                   |
| iOS background modes | None declared. Apple rejects apps claiming `remote-notification` without silent pushes                                                                                                    |
| Export compliance    | `ITSAppUsesNonExemptEncryption: false`, so submission does not stall on the encryption question                                                                                            |
| Card data            | Never captured by our code. A test greps the whole app for card, CVV and expiry fields                                                                                                     |
| Credentials          | Keychain via `expo-secure-store`. AsyncStorage holds profile and preferences only, enforced by `partialize` and asserted                                                                   |
| Bundle secrets       | Only `EXPO_PUBLIC_*` values, which are inlined and therefore public by definition. A test rejects any name implying a secret — including any provider API key                              |
| POPIA                | Marketing consent and notification preferences reach the server and revert if that fails; account deletion asks for erasure rather than only signing out, and refuses to pretend it worked |
| Guest data           | Somebody who has not signed in is shown nothing belonging to an account. `audit:guest` holds that line                                                                                     |
| **Still to do**      | Official brand artwork. `npm run audit:placeholders`. `npm run audit:launch`. Every one needs Pappas's data, credentials, or a real device                                                 |

---

## 10. If I were picking this up

In order:

0. **Run `npm run audit:placeholders` and take it to Pappas.** It is the
   shortest path to a launchable app and none of it is engineering. Prices,
   trading hours, a phone number, the loyalty rules. The app is built around
   not guessing at these; it will render every one of them the moment they
   arrive, as a data change.
1. **Get the official brand artwork** and replace the reconstruction. See §5.
2. **Get it on a device and walk the reserve journey.** It has never run on
   hardware. That is the single largest unknown. Offline *recovery* is the
   specific thing to watch: losing signal is detected reliably and regaining it
   could not be shown in a browser.
3. **Wire the real menu endpoint.** Lowest-risk backend swap — the shape is
   defined and the seed documents it.
4. **Then payments**, because it is the one that must not be improvised, and it
   gates the rest of checkout being genuinely testable.
5. **Then the channel broker**, when the first marketplace contract is signed.
   Nothing in the app changes; a flag goes true.
6. Leave the store map until last. The schematic version works, and a native
   map is a day of native config for a screen customers use briefly.

Two cautions.

The mock service layer is convincing enough that it is easy to forget it is
mock. When something behaves suspiciously well, check
`EXPO_PUBLIC_USE_MOCK_API` before concluding the backend works.

And the browser preview flatters. It has no notch, so `insets.top` is 0 where a
handset gives 47 — which is exactly how a hero shipped with its wordmark
overlapping its own headline, worse on every real phone than in any preview.
Look at it on hardware before you believe a layout.
