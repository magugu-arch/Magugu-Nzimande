# Implementation audit

The bb.q Chicken mobile app, read against *Advanced App Functionality & AI-Assisted
Development Brief* (the brief). Written before any change, as the brief's §8 asks.

Baseline at the time of reading: **45 suites, 761 tests, all passing.**

---

## 1. What is already here

| Layer | Found |
|---|---|
| Mobile | Expo SDK 57, React Native 0.86, React 19, TypeScript strict |
| Navigation | Expo Router, typed routes, 31 screens |
| Server state | TanStack Query |
| Local state | Zustand — cart, auth, fulfilment, favourites |
| Service boundary | `src/services/*` behind one `apiClient`, mock layer toggled by `EXPO_PUBLIC_USE_MOCK_API` |
| Money | Rand with cent-rounded arithmetic (`src/utils/money.ts`) |
| Tests | 44 files, covering cart, reconciliation, pricing, rewards, routes, a11y |

The brief's §7 directory shape (`/app`, `/src/components`, `/features`, `/services`,
`/lib`, `/types`, `/theme`) is already the shape of this repository, with `lib`
named `utils` and `theme` named `constants/theme`. Not worth renaming.

### §10 screen inventory, against what exists

| Brief area | State |
|---|---|
| Onboarding | Present — welcome, location, permissions rationale |
| Home | Present — address, campaigns, categories, featured, favourites |
| Search | Present — `features/menu/search.ts`, tested |
| Menu | Present — store context, categories, filters |
| Product | Present — image, description, modifiers, quantity, live price |
| Cart | Present — edit, remove, promotion, fulfilment |
| Checkout | Present — address, store, schedule, payment, summary |
| Order tracking | Present — timeline, ETA, directions |
| Orders | Present — active, past, reorder |
| Account & Rewards | Present — profile, addresses, preferences, points, offers |

Every screen in the brief's inventory exists. The gaps are behavioural, not
navigational, and they are below.

---

## 2. Gaps against the brief

### 2.1 No idempotency on order creation — **acceptance criterion, unmet**

> "checkout retries cannot create duplicate orders" (§8) · "idempotency keys for
> orders/payments" (§7)

`grep -rn "idempoten" src` returns nothing. `placeOrder` increments a module
counter and mints a new order on every call, so a retried checkout — a flaky
network, a double tap that beats the disabled state, a resumed app — produces a
second order at full price. Nothing downstream can tell the two apart.

This is the highest-severity gap in the brief, because the failure is silent and
the customer is charged for it.

### 2.2 Order states stop short of the brief's machine

The app models six: `received`, `preparing`, `ready`, `out_for_delivery`,
`completed`, `cancelled`. §6 asks for fourteen, and the ones missing are the ones
that carry money and couriers: `AWAITING_PAYMENT`, `PAYMENT_AUTHORISED`,
`COURIER_REQUESTED`, `COURIER_ASSIGNED`, `REFUNDED`.

Transitions are also not *enforced*. `statusSequence()` describes an order's
path, and `buildTimeline` renders it, but nothing rejects an illegal move — an
order can go from `completed` back to `preparing` if a caller says so. §6 asks
for enforcement and for every critical change to be logged.

### 2.3 No delivery-provider seam — **§5, absent**

There is no `quote / create / getStatus / cancel` interface, no
`DeliveryStatus` union, no mock provider. Delivery today is a fee rule and an
ETA computed from `preparationMinutes`. Nothing is wrong with it, but there is
nowhere for an authorised provider to be connected without editing the
ordering flow, which is precisely what §5 means by "Uber-ready".

### 2.4 Modifier rules are enforced by the screen, not the domain

`unmetOptionGroups` correctly blocks add-to-cart when a required group is
unfilled, and `reconcileCart` re-checks `minSelect`/`maxSelect` when the menu
moves under a saved basket. Both are real and tested.

But `cartStore.addLine` itself accepts anything it is handed. The rule lives in
`app/product/[id].tsx`, so a second caller — reorder, a deep link, a future
"add again" on the order screen — can put an invalid line in the cart without
going near the check. The guard should sit where the data enters.

### 2.5 Money is rand, not minor units — **deliberate deviation, see §4**

---

## 3. Things found that the brief did not ask about

**The website's tests were failing the app's test run.** The root Jest config
globbed the whole repository, so it collected `apps/web/tests/*` — Vitest suites
for the separate website deliverable — and failed five of them on imports only
Vitest resolves. The app's own 761 tests were passing underneath. Fixed by
ignoring `apps/` from the root runner; the website keeps its own `npm run verify`.

This was mine, introduced when the website was added, and it would have read to
anyone else as "the app has failing tests".

---

## 4. Deliberate deviations

**Money stays in rand.** §7 asks for integer minor units. The app stores rand
with at most two decimals and routes *every* arithmetic operation through
`toCents` / `sumRand` / `multiplyRand`, which convert to integer cents, operate,
and convert back. The property the brief is protecting — no float error in a
total — already holds, and there is a `money.test.ts` holding it.

Converting the storage unit would touch every price literal in the seed data,
every screen that renders one, and the API contract, for a representational
change with no behavioural difference. §8 says to preserve working code unless
a measurable improvement is required. Recorded here rather than done, and new
money paths added by this work use integer minor units natively so the boundary
is the old code, not the new.

---

## 5. Blockers — not inventable

Per §8's rule, these are documented rather than faked:

| Blocker | Needs |
|---|---|
| Real delivery integration | Authorised provider account, credentials, API docs. §12 is explicit that this brief does not grant them. |
| Payment capture | Gateway selection, merchant credentials, sandbox. |
| Courier map tracking | A provider exposing authorised tracking data. |
| Push delivery | APNs/FCM credentials and a server to send from. |
| POS integration | Store systems and their API. |

Each gets an interface and a mock in this work, so the seam exists and the
customer experience does not have to be rebuilt when the credentials arrive.

---

## 6. Plan

In order, highest severity first:

1. Idempotency keys on order creation, with retry returning the original order.
2. The full order state machine, with enforced transitions and an event log.
3. `DeliveryProvider` interface plus a mock, behind a feature flag.
4. Move modifier validation into the cart domain.
5. Tests for all four.
6. `RELEASE_READINESS.md`.
