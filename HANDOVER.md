# bb.q Chicken SA — Handover

Everything needed to take this over, in the order you'll need it.
`README.md` is the reference manual, `RUNBOOK.md` is for when it is live and
something needs changing or has gone wrong, and this is the orientation.

---

## 1. What was built

A production-oriented React Native customer ordering app for bb.q Chicken South
Africa, built to the supplied brief.

|                  |                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Stack            | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript strict · Expo Router · TanStack Query · Zustand |
| Screens          | 34 routes covering every journey in brief §4                                                            |
| Browser journeys | 10, driven end to end against the mock layer                                                            |
| Food photography | All 28 catalogue products, own artwork, no placeholders                                                 |
| Logo             | Licensed bb.q lock-up, both approved variants, all icons derived from it                                |
| Tests            | 66 suites; `npm test` prints the count                                                                  |
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
npm run audit:screens # renders all 35 routes at two widths and reports defects
npm run smoke:order   # signs in, adds an item and places an order, for real
npm run preview:single # builds the web export and folds it into one HTML file
```

`bundle:single` is for sending the app to somebody who has no toolchain — a
franchise partner, a reviewer, anyone with a browser. It inlines the bundle and
every photograph into a single document, so there is nothing to serve and
nothing to install. `preview:single` does the export and the fold together;
`bundle:single` on its own folds whatever is already in `.preview-web`, and
refuses if that is older than `src/` — the export defaults to `dist`, so the
two directories are easy to confuse and the failure is a file that looks
right and is not.
Two caveats worth stating when you send it: the photographs are re-encoded
smaller than the store build ships, and because there is only one document,
deep links into a route cannot work — the app opens at its own start and is
navigated from there.

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

Four integrations need something external. Each has a marked hook-in point.
(Favourites sync was the fifth; it is done — see below.)

| What                  | Where                                                                                | Needs                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Card capture**      | `app/account/payment-methods.tsx` — currently an explanatory alert                   | The gateway's PCI-compliant SDK. Never build your own card form.                                                                     |
| **Address geocoding** | `app/checkout/address.tsx` — saves a typed address with no coordinates at all        | A geocoder, or a backend that geocodes on POST. Until then the delivery radius cannot judge a typed address, and does not pretend to |
| **Store map**         | `features/stores/components/StoreMapPreview.tsx` — schematic, pure RN, no native dep | Drop in react-native-maps or Mapbox; its props are already the ones a real map needs, so no caller changes                           |
| **Crash reporting**   | `ux/errorReporting.ts` — errors are caught, scrubbed and routed; nothing receives them yet | One `ErrorReporter`, injected at startup. Sentry or Crashlytics                                                                 |
| **Analytics provider** | `ux/analytics.ts` — every event is sent, nothing receives them yet                  | One `AnalyticsAdapter`, injected at startup. The taxonomy and the call sites are done; only the vendor is missing                    |

**Error reporting is wired, and it scrubs.** §13 asks for one thing in one
sentence — "log operational errors without leaking sensitive customer
information" — and the second half is the work. `ErrorBoundary`'s `onError`
hook had existed since the beginning with nothing passed to it, so a render
crash went to a bare `console.error` and no further.

`ux/errorReporting.ts` now owns that path, and everything goes through `scrub`
on the way out. An error message is the least disciplined string in an
application: nobody writes one expecting it to be stored, so they accumulate
whatever was in scope — a request URL with an email in the query, a 401 body
quoting the bearer token, a `MalformedResponse` quoting the response field that
failed to parse. Point a crash reporter at that and you have a second customer
database, in a third-party system, that nobody declared and no retention policy
covers.

Redacted: emails, bearer tokens and JWTs, credential-named fields, SA mobile
numbers in every shape people type them, card-shaped digit runs, coordinates,
and every URL query string (the path survives — it is the part worth grouping
on). The scrubbing is deliberately blunt: it would rather redact a harmless
order note than let one email through, because an over-redacted breadcrumb
costs an engineer five minutes and an under-redacted one is a notifiable
incident.

Two call sites so far — the error boundary, and `apiClient`'s malformed-response
branch, which was printing parsed response bodies verbatim. Add more with
`reportError(error, { scope: 'a.stable.label' })`; `scope` is hand-written and
never free text from a customer.

**Analytics is wired; the provider is not chosen.** §15 asks for eleven events
and dashboards for conversion, cart abandonment, fulfilment mix, top items and
repeat ordering. All sixteen events (§15's eleven plus five the starter kit's
taxonomy had) are declared in `ux/analytics.ts` and sent from the app. Four
things to know:

- **The vendor is a one-line injection, and deliberately absent.** No SDK is in
  the bundle. `setAnalyticsAdapter(yourAdapter)` at startup is the whole
  integration; until then events log in development and go nowhere in
  production. An analytics SDK ships an identifier for every customer, which is
  not something to guess at on bb.q's behalf.
- **The brief gives the taxonomy twice and the two disagree.** §15 asks for
  `view_item, add_to_cart, begin_checkout, add_payment_info, purchase…`; the
  starter kit asks for `product_viewed, item_added, checkout_started…`. §15's
  names win because they are GA4's *reserved* ecommerce events — sent under
  those names they populate GA4's built-in funnel and monetisation reports,
  which is exactly the dashboard §15 asks for, and under any other name they
  are custom events somebody has to build those reports from scratch.
- **No personal information is in any payload.** Ids, counts and amounts only.
  `search` carries the length of the query and the number of results, never the
  words; `add_payment_info` carries the rail's type, never a brand, last four
  or expiry. `analytics.test.ts` reads the payload types as source and fails on
  a field named for anything identifying.
- **Events are typed, and every one is asserted to have a call site.** A
  misspelling is a compile error; an event declared and never sent fails a
  test. That second check has already earned itself — `select_modifier` was
  declared and unwired, which is invisible until a chart is empty.

**Favourites sync is done.** `features/favourites/sync.ts` carries hearted
products between the handset and the account: `GET /v1/account/favourites` on
sign-in, `PUT` of the whole list, debounced, as they change. Three decisions
worth knowing before you point it at a real backend:

- **The list is sent whole, not as deltas.** A favourite is a preference, not a
  transaction, so there is no partial state to protect. That makes a failed
  push free — local is still authoritative and the next push carries whatever
  the failed one was meant to say — which is why there is no outbox, no retry
  and no idempotency key. Deltas would need all three.
- **Sign-in merges by union.** Server-wins would delete the hearts a guest gave
  before signing in, which is the failure `favouritesStore` was written to
  avoid; local-wins would let a fresh handset erase the account's list. Union
  is the only rule that cannot lose a tap somebody meant.
- **The store still knows nothing about the network.** A heart never waits on a
  request, so it works offline and on a cold start exactly as before.

The backend owes a `PUT` that accepts `{ productIds: string[] }` and returns the
stored array, **scoped to the authenticated caller**. Ordering is the client's —
most recently hearted first — so store it as given rather than sorting it.

That scoping is not a footnote. The first version of the mock behind it was one
global array, and `audit:handover` caught what that produces: sign in, heart two
dishes, hand the phone over, and the next person's sign-in pulled a stranger's
list onto their account. `fetchFavourites` and `saveFavourites` therefore take a
`customerId` the real implementation ignores — the token does the scoping there
— purely so the mock cannot drift back into modelling a different contract.

Also outstanding, and deliberate:

- **The logo masters are raster, lifted from the guidelines page.** Brand
  guidelines v1.0 was supplied as an image, not as artwork files, so
  `assets/brand/masters/` holds the lock-up and symbol separated out of that
  page rather than exported from the original. They are clean and hold at
  1024px — the symbol is redrawn from its coverage maps, not upscaled — but
  they are not vector-derived, so anything larger than an app icon (print,
  signage, a billboard-sized splash) wants the real master. Replacing them is
  the whole job: drop the two files in, run `npm run assets:brand`.
- **Only §3, §8, §10–§14, §22, §23 and §32 of the guidelines were supplied.**
  Logo clear space is on page 05, which I have not seen; the icon uses generous
  spacing but has not been checked against the actual rule. _(Resolved since:
  §8.1 prints bb.q Red as `#E31937` with rgb, cmyk and Pantone 185 C, which is
  the value the logo extract was normalised to — the guidelines page just
  renders it a few points darker. §8.1's own swatches miss their printed hex by
  ~9 units, so that page is a reference for values, never for pixels.)_
- **§23.5 says Inter; §11 says Montserrat.** Resolved in favour of Montserrat —
  §11, §12, §13 and §14 are four pages of typography spec against one line, and
  they agree with each other. §23.5 looks like the outlier.
- **§12 puts body copy and UI buttons on Arial; §11.2 puts the whole hierarchy
  on Montserrat.** Montserrat, on both counts. Buttons were already resolved
  that way (§13.3 and §13.4's callouts agree); body copy and captions followed
  when §11 was supplied, because §11.1 names a two-member type system, §11.2's
  table covers body copy and captions explicitly, and §11's DO NOT forbids
  faces outside that system. **§12 itself has never been supplied to this
  project**, so it is being superseded unseen — this is the open question most
  worth putting to the brand team, and `theme/typography.ts` is a one-file
  revert if they say §12 governs. Worth knowing before you ask: the switch cost
  nothing in bundle size (every weight was already loaded for the headings) and
  `npm run audit:screens` finds no overflow at 390pt or 320pt, so it is a
  question of taste rather than of fit.
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
  show and what leaves the food photography somewhere to sit. _(Largely settled
  since §8 arrived: §8.3 is the Colour System page's own usage rule and it sets
  no ratio at all — red for "key brand moments, calls to action and highlights",
  black for text and contrast, white as a background that creates "clarity,
  space and a premium feel". That is a much better description of this app than
  §10.1's grudging "can be adjusted slightly". Still worth a designer's eye, but
  it is no longer a departure.)_
- **§8.3 bars unapproved colours; two token groups sit outside §8's palette.**
  The status hues (success, warning, error, info) have to: an error rendered in
  bb.q Red is indistinguishable from a call to action, which is the failure
  §32.4 exists to prevent — and the brief's own token block names them, so they
  are authorised there. The neutral scale is warm where §8.2's neutral tints are
  even grey, because those are UI inks tuned to clear §32.3's contrast floor
  rather than brand tints; §8.2's ramp is exported from `theme/colors.ts` as
  `tints` for anything that is genuinely a brand tint. A `cream` surface token
  (`#FFF5E6`, read off §23.4, and a third value again in the brief at `#F5F1EE`)
  was deleted rather than reconciled — §8 has no cream and nothing in the app
  ever rendered it.
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

**Validation is partial, on purpose.** `request<T>` casts the parsed JSON to
`T`, so every type in `src/types` is a promise about the wire. That is fine
while the mock is the only source and the seed matches the types by
construction, and it stops being fine the day a real endpoint answers. It
produced four holes before anything was done about it: a store's coordinates
interpolated into a maps URL, `deliveryRange` measuring `NaN` and reading it as
out of range, `directionsTargetFor` routing to `0, 0` — and one no consumer
could patch, where `formatPrice` rendered anything non-finite as `R 0.00`. A
backend returning money as strings, which is ordinary and done precisely to
keep float precision off the wire, would have put "R 0.00" on every menu tile
while the arithmetic coerced correctly and charged the real amount.

`request` now takes an optional `parse`, and `services/wireChecks.ts` supplies
one for the responses where a value the app cannot read becomes a number a
customer acts on: menu and product prices, order totals and ETAs, store
coordinates and delivery radii, the loyalty balance, voucher terms. A failure
raises `malformed_response` at the fetch, so the screen shows its own
"couldn't load" state and the console names the exact field and what arrived.

It is deliberately **not** a schema per endpoint. A schema has to be maintained
alongside the type, drifts from it silently, and rejects a response over a
field the app never reads. Each check asserts only what the app would otherwise
get wrong. The other endpoints — profile, addresses, notifications, support —
still cast, because a wrong value there is a wrong string on a screen rather
than a wrong number in a bill. Add a check when that stops being true, and add
it to `wireChecks` rather than to the consumer.

**Secrets:** tokens go to the platform keychain via `expo-secure-store`. Only
`EXPO_PUBLIC_*` values are inlined into the bundle. Card details are never
captured by our own form.

---

## 7. Guardrails already in place

These fail loudly rather than rotting quietly — leave them on.

- **`npm run verify`** — typecheck, lint, format, the whole test suite. The
  pre-commit gate.
- **CI** (`.github/workflows/verify.yml`) runs that on every push, plus a Metro
  bundle for both platforms, a real prebuild audit of the native projects, and
  the asset checks.
- **`npm run assets:audit`** exits non-zero while any of the 28 products lacks
  its own photograph, so a new menu item can't ship on a placeholder.
- **`npm run smoke:order`** places an order: signs in, adds an item, chooses an
  address, submits, checks the confirmation carries a reference and that
  tracking shows the first status. Every unit test here checks a piece of that
  journey; this is the only thing that checks the pieces connect. It runs
  against the mock layer, so it needs no backend — which also makes it a check
  that the mock still models the real API.
- **`npm run audit:screens`** renders every route at 390pt and 320pt and fails
  on anything sitting past the right edge, a page that scrolls sideways, a
  blank screen, a console error, a §32.6 gap — an interactive element with no
  accessible name, one hidden from a screen reader that still takes taps, or a
  focusable one with no visible focus ring — and a §22.9 gap: anything under
  44x44 to a thumb once its declared `hitSlop` is counted. This is the check
  that found the defects the test suite could not see.

  The accessibility half used to run on three routes out of twenty-nine, which
  is how the README came to claim every pressable cleared 44pt while ten did
  not. Only the focus-ring probe is expensive, so only that is still limited;
  everything else now runs everywhere. It needs
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
    purpose, so both halves have to hold at once. It starts by _registering_,
    not signing in: every other journey signs in, and that is exactly what let
    `register` and `signIn` disagree about who somebody is without anything
    noticing.
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
| **Still to do**      | Run `npm run audit:launch`. It is the live list — 24 items at the time of writing, every one needing your data, your credentials, or a real device. Nothing in this repo can close them    |

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
