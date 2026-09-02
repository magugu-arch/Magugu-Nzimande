# Implementation audit — against the Advanced App Functionality brief

Required by §8 step 1 of *bb.q Chicken — Advanced App Functionality & AI-Assisted
Development Brief*: write this before major refactors.

What follows compares the repository as it stands against that brief, section by
section. It is deliberately unflattering where the app falls short and
deliberately specific where it does not, because the point of the exercise is to
find the gaps, not to award marks.

**Summary.** Most of the brief was already built. The customer-facing vertical
slice — Home → Menu → Product → Cart → Checkout → Order tracking — is complete
and driven end to end in a real browser by nine journey audits. Three things
named explicitly in the brief are missing, and one of them is the centrepiece of
§5:

| # | Gap | Brief |
| - | --- | ----- |
| 1 | No delivery-provider abstraction of any kind — no interface, no mock, no `src/providers/` | §2, §5, §7 |
| 2 | No courier leg in the order journey; no `DeliveryJob`, no courier states | §2, §6 |
| 3 | No idempotency key on order creation | §7, §9 |

---

## §2 — Functionality to add

| Capability | State | Note |
| ---------- | ----- | ---- |
| Location & serviceability | **Built** | Current location, saved addresses, delivery notes, per-branch `deliveryRadiusKm`, and `deliveryRange()` gating checkout. Geocoding of typed addresses is an open backend dependency, already recorded in `audit:launch`. |
| Menu discovery | **Built** | Home feed, 7 surfaced categories, search, featured, promotions, favourites synced per customer. |
| Product customisation | **Built** | Modifier groups with `minSelect`/`maxSelect`, required-group enforcement that a screen cannot bypass, live price. |
| Cart & checkout | **Built** | Persistent cart (reconciled against the live menu on open), promo codes, fulfilment choice, itemised totals. |
| Delivery & pickup | **Built** | Delivery, collection, dine-in; scheduling with lead time and horizon; per-branch trading hours. |
| **Live order journey** | **Partial** | Six statuses: received → preparing → ready → out_for_delivery → completed, plus cancelled. The brief's journey has a courier leg — *courier assigned → on the way* — and the app has none. `driverName` is a bare optional string with nothing behind it. |
| **Map tracking** | **Missing** | Nothing renders a courier position, and nothing expresses whether tracking is even available. |
| Payments | **Built** | `paymentService` abstracts the rail; no card form anywhere; authorise-then-create with release on failure. Capture happens in the provider SDK, which is an open commercial dependency. |
| Account & loyalty | **Built** | Profile, history, favourites, addresses, tier ladder, rewards, vouchers. |
| Notifications & support | **Built** | Push registration, tap routing, cold-start routing, order-linked help. |
| **Integration readiness** | **Partial** | Typed API contracts, structured error reporting and 16 analytics events are in place. There is no delivery-provider adapter and no POS adapter. |

## §5 — Delivery-integration readiness

The brief specifies an interface, by name and signature:

```ts
quote(...)  create(...)  getStatus(...)  cancel(...)
```

and a `DeliveryStatus` union of seven members, and says: *"Do not implement a
third-party provider until authorised credentials and official API documentation
are supplied. Provide a mock provider."*

**None of it exists.** There is no `src/providers/`, no interface, no mock, no
feature flag. This is the single largest gap against the brief and the one that
"Uber-ready" actually means: the app cannot today accept a courier integration
without opening up the order service and the tracking screen.

## §6 — Order state machine

The brief lists fourteen `OrderStatus` members. The app has six.

Some of that difference is correct and should stay. `DRAFT`,
`AWAITING_PAYMENT` and `PAYMENT_AUTHORISED` are payment-attempt states, not
things a customer reads on a tracking screen, and the app already models the
authorise-then-create sequence properly in `submitOrder`. Collapsing those into
the customer-facing status would make the tracking timeline worse, not better.

The real gap is the courier leg. `COURIER_REQUESTED`, `COURIER_ASSIGNED` and
`OUT_FOR_DELIVERY` are three distinct facts about a delivery order and the app
has one of them. A customer whose order is boxed and waiting for a driver sees
"Ready", which is what a collection customer sees when the food is on the
counter for them.

## §7 / §9 — Security and API contract

| Requirement | State |
| ----------- | ----- |
| Environment variables for secrets; nothing hardcoded | **Met** — `EXPO_PUBLIC_*` publishable values only, asserted by a test |
| Secure token storage | **Met** — `expo-secure-store` |
| Input validation | **Met** |
| Server-side authorisation | **Met by contract** — the client never trusts its own totals; `PlaceOrderInput` documents that the server must recompute |
| **Idempotency keys for orders/payments** | **Missing** — `PlaceOrderInput` carries none. Checkout blocks the *button* after an uncertain payment, which handles the human retry and not the machine one: a network retry, a backgrounded app or a resumed request creates a second order against a real backend. |
| Webhook signature verification | Backend concern; out of scope for the client |
| Audit log for critical state changes | **Partial** — analytics and error reporting exist; order-state audit is a backend concern |

## §4 — Pricing: "integer minor units"

The brief says to hold money in integer minor units. The app holds rand as
numbers and routes every operation through `toCents`/`fromCents`, so all
arithmetic is performed on integers and rounded to whole cents — `0.1 + 0.2` is
`0.3`, and totals do not drift. There is a test suite pinning this.

I have **not** converted the representation. The behaviour the rule exists to
guarantee is already guaranteed, the change would touch every price in the
codebase and every seeded fixture, and §8 rule 3 says to preserve working code
unless there is a measurable improvement. Recording it here as a deliberate
deviation rather than an oversight.

## §10 — Screen inventory

All eleven areas exist across 34 routes. `audit:screens` sweeps 34 of them at
390pt and 320pt for overflow, blank screens, console errors, accessibility gaps
and touch-target size.

---

## What this audit led to

1. A `DeliveryProvider` interface at the brief's exact signature, a mock
   provider behind a feature flag, and a provider registry — so an authorised
   integration is a new file rather than a refactor.
2. A courier leg in the order journey, driven by the provider's own
   `DeliveryStatus` rather than restated beside it.
3. An idempotency key minted per checkout attempt and carried on
   `PlaceOrderInput`.

No third-party provider is implemented. Per §12, that requires credentials,
contracts and technical approval that this repository does not have and must not
invent.
