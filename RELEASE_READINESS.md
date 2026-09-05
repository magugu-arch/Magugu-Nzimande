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
| Menu search and browsing work | Pass | `audit:screens` sweeps 41 routes; search covered in `menu.test.ts` |
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

## 2a. Fixed after the first pass

Two things found by asking what the new code actually does rather than whether
its tests pass.

**A courier dispatched for orders already delivered.** `attachDelivery` asked
only whether the kitchen had finished, and `completed` is past `ready` — so
every delivery order in the history qualified. Opening the Orders tab
dispatched a driver for an order delivered last week, once per order per fetch,
against a network that bills for it. The seeded history did it to BBQ-4821
every time. Terminal orders now return early; the job is kept as part of the
record and never asked about again.

**`quote()` was on the interface and nothing called it.** An interface method
nobody invokes is a promise about a boundary rather than a boundary. Checkout
now asks the courier network whether it will serve the address — a different
question from the branch's `deliveryRadiusKm`, which says how far bb.q will
drive rather than whether anybody will drive it. Only a *located* address the
provider positively declines blocks an order: a refusal caused by the app never
geocoding the address is the app's own gap, and refusing over it would turn a
documented limitation into a lost order. A provider that is unreachable never
blocks either. Verified by `audit:delivery-range`, which still shows a typed-in
address being accepted.

## 2b. Fixtures, and the defect they found

The seeded history was two orders — both completed, both already rated, neither
carrying a discount, one delivery and one collection. That is a tidier customer
than anyone has, and it left whole states of the app with no example to render.
Added: a **cancelled** delivery order carrying the voucher it was paid with, a
**dine-in** order with a table number and *no rating*, a **scheduled**
collection order carrying a redeemed reward, and a saved address with **no
coordinates** — which is what almost every real address in this app is, since
the add-address form has no geocoder behind it.

They earned their keep on the first render. A cancelled order drew the entire
journey it never took — *Preparing · Ready · Driver assigned · Out for delivery
· Completed — Enjoy. Thanks for ordering with bb.q.* — because `cancelled` is
not a member of `statusSequence`, so `indexOf` returned -1, nothing was marked
reached, and every step rendered anyway. A thank-you for food that was never
made, under the word "Cancelled". Nothing could catch it: the unit tests had no
cancelled order to build a timeline from, and the browser sweep had no route to
visit. It now shows what happened and stops — received, then cancelled — and
`cancelOrder` rebuilds the timeline rather than keeping the one describing a
journey that has just stopped.

Two more things the fixtures unlocked rather than fixed: "Rate this order"
renders only on a completed order with no rating, so the entry to the rating
flow was previously unreachable without placing an order and waiting; and the
screen sweep grew from 31 routes to 34.

## 2c. Fixtures for the "you cannot have that" paths

`product.available` and `option.available` are read in four places — the option
picker, `defaultSelectionFor`, `reconcileCart` and `planReorder` — and every one
of the 23 seeded products and 78 seeded options was available. All of that code
worked and none of it had ever run.

Two fixtures: the sharing bucket of fries is **sold out**, and an older order
carries a **Winter Pumpkin Soup** that has since left the menu. Between them
they exercise a withdrawn option being skipped by the default selection, a saved
basket being broken rather than quietly resized into a different meal, and
"Order again" naming a dish it cannot re-add.

Unlike the cancelled-order fixture, these found no defect. The option picker
already drew a greyed label with a "Sold out" caption and refused the tap, and
the reorder notice already named the dish rather than counting it — confirmed in
a browser: *"Sharing bucket · Sold out · +R 48.00"*, `aria-disabled="true"`,
tapping does nothing. That is worth recording as a result: the fixtures prove
the behaviour rather than expose it.

## 2d. A card that has run out

Both seeded cards expired years from now, so the app had never held a card it
could not pay with. `expiry` was carried on `PaymentMethod`, printed on two
screens as "Expires 03/27", and compared to the clock **nowhere**. An expired
card was therefore offered at checkout as an ordinary option, indistinguishable
from a working one, and the customer learned it was dead from the gateway —
after committing to the order, at the point in the journey where a failure
costs the most.

Seeded a third card, `payment-visa-expired`, marked 03/24. `cardHasExpired`
reads the date the app already holds; checkout stops offering a card it cannot
pay with, and the account screen says "Expired 03/24" instead of "Expires". No
commercial rule was invented here — the gateway refuses the card either way;
all that changed is whether the customer finds out before or after they press
Place order. Two details the implementation is explicit about: a card is valid
**through the end** of its month, and an expiry string the app cannot parse is
never treated as expired.

The filter computes its "already covered" set from the *surviving* cards, so a
customer whose only card has expired is still offered SnapScan, Instant EFT and
cash — the same case the rails exist for.

**And a second defect, found only in the browser.** With the payment list open,
checkout drew

```
SnapScan
SnapScan
```

for all three rails: the caption was `expiry ? expiryLabel(…) : describePaymentMethod(…)`,
and a rail's label *is* its description. Both strings were exactly what their
own unit tests expect, so nothing failed and nothing could have — the defect
exists only where the two are rendered together. `paymentCaption` now returns
the description only when it differs from the label, so a rail says its name
once and a saved card with no expiry still reads "Credit or debit card".

## 2e. A voucher nobody ever spent, and the second door it opened

Every seeded voucher was either live or **both** used and expired. The vouchers
screen writes a three-way caption — "Already used" / "Expired 12 Aug" /
"Expires 12 Aug" — and `used` is tested first, so the red expired line had
never rendered anywhere in the app. Seeded `CHEESE40`: past its date, never
spent. That is also the state customers actually write in about; "used" is a
receipt, this is the one they meant to get to and didn't.

**What the fixture led to is the real finding.** There are two doors into the
cart's voucher slot — typing a code in the cart, and tapping a card on the
vouchers screen — and each wrote the terms object out field by field. The
cart's copy carried `expiresAt`. The vouchers screen's listed four fields and
stopped. So a voucher *tapped* rather than *typed* reached the basket with no
date on it, `voucherExpired` had nothing to read, and the entire staleness
guard — built, unit-tested, and previously driven in a browser — was simply
absent on that path.

Nothing could have caught it. The two objects share four identically-spelled
fields and differ only in an optional fifth, which is exactly the shape a type
checker must accept; the defect lived in the gap between two call sites, where
neither one is wrong on its own.

Proved both ways in a browser, on a pinned clock: tap SPICY15 with a box in the
basket, move the clock on eight days without leaving the screen, and the old
build sat there for ninety seconds of ticking still taking the discount off.
The fixed build says *"That code expired on Mon, 31 Aug"* and stops taking it.
`voucherTerms()` is now the one derivation both doors use, so a term added to
`VoucherTerms` is carried through both or through neither.

## 2f. A branch that has declared itself shut

`Store.isOpenNow` is the kitchen's own veto, distinct from its timetable —
`isTradingNow` has honoured it since it was written, and its doc comment names
what it is for: *"a power cut, a burst pipe, a shift nobody turned up for, all
of which the kitchen knows and the timetable does not."* All seven seeded
branches were `true`, so **the veto had never once fired**, and everything
downstream of it had never run against the case it exists for. In a country
with scheduled load-shedding that is not an exotic state.

Seeded one branch — Menlyn Park — shut today, everything else about it
ordinary. It found **two defects and a contradiction**.

**Scheduling was a way straight through a shut kitchen.** The blocker offered
*"closed — schedule for later"*, and the scheduling checks after it validate
the chosen time against the **timetable**, which for this branch says open. So:
pick a slot an hour out, every check passes, `missingFulfilmentRequirement`
returns **null**, and the order goes to a kitchen that has told the app it is
not cooking. Reproduced by reverting the fix — the old code returns no blocker
at all. The comment on that scheduling rule says it exists to stop scheduling
being a way around the closed-kitchen rule; it stopped it for one of the two
ways a kitchen closes.

`closureReason()` now separates them. A timetable closure reopens at a time
printed on the card, so "schedule for later" is right. An unplanned closure
carries no reopening at all, so there is no later to schedule for and the copy
no longer pretends there is: *"bb.q Chicken Menlyn Park is not taking orders
right now"*. The distinction is deliberately narrow — a branch flagged shut at
three in the morning is still reported against its timetable, because it is
shut either way and "opens at ten" is the more useful answer.

**A default branch nobody could order from.** `preferredStore` picks "the first
branch that could actually take the order" and checked the opening date and the
delivery radius — not whether the branch was trading. Its own doc comment
describes the failure twice over: *"a customer arrives at checkout, finds a
store silently chosen for them, and is blocked on it… for a store they never
picked."* A shut branch is the third instance of exactly that, and `audit:coldstart`
failed on it the moment one branch was seeded shut.

**And a card arguing with itself.** *"Closed"* printed beside *"10:00 – 22:00"*
at two in the afternoon — the badge read the flag, the hours row read the
timetable, and neither knew about the other. It now reads "Temporarily closed"
and withholds the window that would contradict it. An open branch is unchanged.

## 2g. A geocoding boundary, and three states with no data

**The boundary.** The add-address form was six text fields with nothing behind
them, so `deliveryRange` answered `'unknown'` for almost every address the app
held and the radius rule could never refuse an order that genuinely was out of
range. `GeocodingProvider` is now the boundary a real service plugs into —
registry, flag, mock — the same shape as `DeliveryProvider`, so connecting one
is a new file and a flag value.

Two decisions worth stating. **Only an `exact` fix is kept**: an approximate
one — a suburb centroid, a street without a number — can sit a kilometre from
the door, and a kilometre is most of the margin the radius rule works in.
Keeping it would be the original CBD defect wearing a better label. And **the
mock deliberately locates almost nothing**, because a stand-in that returned a
plausible coordinate for any string would make every screen look finished while
recreating exactly that defect.

Proved end to end in a browser: a located Johannesburg address is accepted by
the Johannesburg branch and refused by the Cape Town one — *"bb.q Chicken V&A
Waterfront does not deliver to Melrose Arch — collect instead"* — which is the
half of the radius rule that had never once fired.

**Three fixtures.** A **collection-only branch** (`supportsDelivery` and
`supportsCollection` were `true` on all seven, so half of `supportsFulfilment`
had never excluded anything, and the transition that drops a chosen branch when
the customer switches fulfilment had never run for delivery). A **lapsed
reward** — `rewardExpired` is read in three places and not one of the seven
rewards carried a date, so all three read "never expires"; the new one is
seeded `redeemable: true` on purpose, because the point is that the date
overrules the record. And an **account that never clicked the email link**,
which is what most real accounts look like and which the seed described for
nobody, so the warning badge and the "Send me the link" button rendered on a
screen the sweep visits every run and never showed.

**And the launch audit was quietly lying.** The geocoding blocker was gated on
whether the address form mentioned `latitude` — a proxy standing in for "has a
geocoder". Wiring the boundary in set that field, so the blocker went silent
while the thing it warns about was still missing. It now reads the provider
registry and asks the question it means. Proved both ways: register a second
provider and it clears; remove it and it returns. An audit that under-reports
is worse than one that nags.

`audit:launch` is at 22 items, down from 23 — reward expiry cleared itself,
correctly, because it counts rewards without a date rather than restating that
there are none.

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

- `npm run verify` — **75 suites**, typecheck and lint clean (`npm test` prints the case count)
- `npm run audit:screens` — 41 routes at 390pt and 320pt, no defects
- `audit:points`, `audit:returning`, `audit:guest`, `audit:offline`,
  `audit:handover`, `audit:delivery-range` — all green
- The courier leg driven in a browser across a simulated 70 minutes: no driver
  named at placement; "Sipho is collecting your order" at assignment; "Sipho is
  on the way" after pickup; completed at the end. That run caught a real defect
  in this round's own work — the kitchen clock was walking the courier's steps
  and announcing a driver before one existed.
