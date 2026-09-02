# Release readiness

Required by §8 step 10 of the *Advanced App Functionality* brief, and written
against its acceptance criteria and §11 release gates.

`IMPLEMENTATION_AUDIT.md` is the before picture. This is the after, plus what
still stands between this repository and a store.

---

## 1. Acceptance criteria (§8)

| Criterion | State | Evidence |
| --------- | ----- | -------- |
| Customer can select/save address | Pass | `audit:returning` picks a non-default address and orders to it |
| Serviceability checked before checkout | Pass | `deliveryRange()` gates the Place order button; `audit:delivery-range` |
| Menu search and browsing work | Pass | `audit:screens` sweeps 31 routes; search covered in `menu.test.ts` |
| Required modifiers cannot be bypassed | Pass | `cart.test.ts` — enforcement is in `utils/cart`, not in a screen |
| Totals update correctly | Pass | `cart.test.ts`, `cartStore.test.ts`; all arithmetic through whole cents |
| Delivery, pickup and scheduling work | Pass | `tradingHours.test.ts`, `checkout/schedule`, `audit:coldstart` |
| Checkout retries cannot create duplicate orders | Pass | Two layers: the button is withheld after an uncertain payment (`checkoutRetry.test.tsx`), and an idempotency key now identifies the attempt to a backend (`idempotency.test.ts`) |
| Order status updates render consistently | Pass | `courierLeg.test.ts`; driven in a browser through the full courier leg |
| Push notifications triggerable from order events | Pass (client) | Registration, tap routing and cold-start routing built; needs a real EAS project id |
| Delivery integration behind a provider interface | Pass | `DeliveryProvider` at the brief's signature; `deliveryProvider.test.ts` |
| Secrets never committed to client code | Pass | `secrets.test.ts` asserts only publishable `EXPO_PUBLIC_*` values |

## 2. What this round added

**A delivery-provider boundary (§5).** `DeliveryProvider` with `quote`,
`create`, `getStatus` and `cancel` at the brief's exact signature, a registry
selected by `EXPO_PUBLIC_DELIVERY_PROVIDER`, and a mock provider. Adding an
authorised courier is a new file and a flag value — not a change to the order
service, the tracking screen, or any type.

**A courier leg in the order journey (§2, §6).** `courier_assigned` sits between
the counter and the road. The kitchen advances an order to "ready" and stops
there; everything past it is the provider's word, mapped through
`deliveryStatusToOrderStatus` in one place. `driverName` is copied off the job,
so a driver is named only once one is assigned.

**Idempotency (§7, §9).** A key minted per checkout attempt, held across
retries of that attempt, cleared once an order exists, and reused for the
courier job so one order cannot become two dispatches.

**A courier surface (§2).** `CourierTracking` renders ETA and courier state, and
gates a live map on `trackingAvailable` — a fact about the provider's
authorisation, not about the UI. The map itself is deliberately not drawn; see
blockers.

## 3. Release gates (§11)

| Gate | State |
| ---- | ----- |
| UX approval against brand guidelines | **Ready for review.** §8 colour, §11 typography, §22 buttons and §32 contrast are asserted in tests, not eyeballed |
| iOS and Android order-journey testing | **Blocked.** This environment cannot reach `api.expo.dev`, so no device build has run. Both platforms prebuild clean and bundle for production |
| Payment sandbox and failure/retry validation | **Blocked** on gateway credentials. The authorise → create → release sequence is built and tested; the SDK is not connected |
| POS / order-management integration | **Blocked.** No POS adapter exists. Named as a gap in the audit and not invented |
| Authorised delivery-provider onboarding | **Ready to receive.** The interface, registry, flag and mock are in place |
| Privacy, terms and data-processing review | **Ready for review.** Erasure, marketing consent and PII scrubbing implemented |
| Store submission readiness | **Blocked** on `eas init`, Apple team ids and store listings |
| Monitoring and rollback | **Ready.** `RUNBOOK.md` covers the fingerprint rollback policy and monitoring |

## 4. Blockers, and why each is a blocker rather than a task

Per §8's rule — document architectural and commercial dependencies rather than
inventing APIs or credentials. `npm run audit:launch` lists **23** such items and
fails a production build while they stand. The ones that bear on this round:

1. **No authorised delivery provider.** §12 requires contracts, credentials and
   technical approval between the bb.q and provider business entities. The
   boundary is built; a provider cannot be.
2. **No maps provider.** The courier map is a surface with a permission check
   and a data path, and no map. Drawing a fake one would be worse than drawing
   none, because it would look finished.
3. **No POS adapter.** The brief names POS integration under §2 integration
   readiness. Unlike delivery, the brief specifies no interface for it, and
   inventing a shape for a system nobody has named would be guessing.
4. **Address geocoding.** Typed addresses carry no coordinates, and a courier
   cannot route to an address nobody has located — the mock provider refuses
   exactly that case rather than pretending. Either the backend geocodes on
   `POST /v1/account/addresses`, or a lookup is wired into the form.
5. **Server-side idempotency.** The client now sends a key. A key nobody honours
   is decoration: `POST /v1/orders` and `POST /v1/payments/authorise` must both
   dedupe on it.
6. **Commercial values.** Prices, store phone numbers, delivery fees, tier earn
   rates and reward expiries are seeded and unsigned.

## 5. Deliberate deviations from the brief

Recorded so they read as decisions rather than oversights.

- **Money is not held in integer minor units.** All arithmetic is performed on
  integers and rounded to whole cents through `utils/money`, so the guarantee
  the rule exists for already holds. Converting the representation would touch
  every price and fixture in the repository against §8 rule 3.
- **`OrderStatus` is not the brief's fourteen-member union.** That list mixes
  payment-attempt, kitchen and courier vocabularies. Payment states live in
  `submitOrder`, courier states in `DeliveryStatus`, and what remains is the
  journey a customer actually follows. Reasoning in `types/order.ts`.

## 6. Verification for this round

- `npm run verify` — **61 suites, 962 tests**, typecheck and lint clean
- `npm run audit:screens` — 31 routes at 390pt and 320pt, no defects
- `audit:points`, `audit:returning`, `audit:guest`, `audit:offline`,
  `audit:handover` — all green
- The courier leg driven in a browser across a simulated 70 minutes: no driver
  named at placement; "Sipho is collecting your order" at assignment; "Sipho is
  on the way" after pickup; completed at the end. That run caught a real defect
  in this round's own work — the kitchen clock was walking the courier's steps
  and announcing a driver before one existed.
