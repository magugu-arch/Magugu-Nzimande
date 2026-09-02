# Release readiness

The bb.q Chicken mobile app, against the eight release gates in §11 of *Advanced
App Functionality & AI-Assisted Development Brief*.

Companion to [`IMPLEMENTATION_AUDIT.md`](./IMPLEMENTATION_AUDIT.md), which was
written before the work and says what was wrong. This one says where it now
stands and what a person has to do next.

**Verified on this branch:** 49 suites, 820 tests passing · `tsc --noEmit` clean ·
`eslint .` clean.

---

## 1. The gates at a glance

| § | Gate | Status | Who clears it |
|---|---|---|---|
| 11.1 | UX approval against brand guidelines | **Ready for review** | bb.q Chicken brand owner |
| 11.2 | iOS and Android order-journey testing | **Partly** — logic tested, devices not | QA on real hardware |
| 11.3 | Payment sandbox, failure and retry validation | **Blocked** — no gateway | Merchant + gateway account |
| 11.4 | POS / order-management integration | **Blocked** — no POS | Store systems owner |
| 11.5 | Delivery-provider onboarding | **Seam ready, unconnected** | bb.q Chicken ↔ provider onboarding |
| 11.6 | Privacy, terms, data-processing review | **Not started** | Legal / DPO |
| 11.7 | Store submission readiness | **Blocked** — no accounts | Store account holder |
| 11.8 | Production monitoring and rollback | **Not started** | Platform owner |

Nothing below claims a gate is cleared. Four are engineering work that is now
done; four need a person with an account, a contract or a signature, and §8's
rule is to document those rather than invent them.

---

## 2. What this branch implemented

Four gaps from the audit, highest severity first.

### 2.1 Checkout retries can no longer create a duplicate order

The acceptance criterion in §8. Before this, `placeOrder` minted a new order on
every call: a flaky network, a double tap that beat the disabled state, or a
resumed app charged the customer twice with nothing downstream able to tell the
two apart.

A checkout attempt now mints one key and holds it. The same key goes to the
payment authorisation and to the order, so a retry of *either* half replays the
first result instead of doing the work again. The key is only released once an
order comes back — a failure keeps it, because a failure is exactly when the
customer taps again.

- `src/features/checkout/idempotency.ts` — the scope, and `randomKey()`
  (`crypto.randomUUID` → `getRandomValues` → a time-and-random fallback, so it
  works on an older runtime rather than throwing).
- `src/services/orderService.ts`, `src/services/paymentService.ts` — ledgers
  keyed by the idempotency key. The order replay returns *above* the points and
  voucher recording, so a retry cannot spend a voucher twice either.
- `src/types/order.ts` — `idempotencyKey` is required on `PlaceOrderInput`, not
  optional. A caller cannot omit it by accident.

### 2.2 The order lifecycle is enforced, not described

§6 asks for the transitions to be enforced and every critical change logged. The
app modelled six customer-facing statuses and nothing rejected an illegal move.

`src/features/orders/stateMachine.ts` holds all fourteen states, an explicit
transition table, and `transition()` which throws `IllegalTransitionError`
rather than accepting a move. `recordTransition()` is the §6 log — from, to,
when, which actor, and an optional reason.

The six-status customer vocabulary is unchanged and still what the timeline
renders; `customerStatus()` maps the fourteen onto it, so courier plumbing
(`COURIER_REQUESTED`, `COURIER_ASSIGNED`) does not leak into what a customer
reads.

### 2.3 A delivery seam an authorised provider can connect through

§5's "Uber-ready" means there is somewhere to connect *without* editing the
ordering flow. `src/providers/delivery/` is that place: `quote / create /
getStatus / cancel`, a `DeliveryStatus` union, and a registry selected by
`EXPO_PUBLIC_DELIVERY_PROVIDER`.

The only provider registered is the mock, and `hasAuthorisedDeliveryProvider()`
returns `false`. The mock refuses honestly rather than always saying yes: it
declines a dropoff nothing has geocoded, expires its quotes, will not dispatch
against a quote it never gave, and reports `trackingAvailable: false` because it
has no courier to track. A screen built against it cannot come to depend on
behaviour a real provider will not supply.

### 2.4 Modifier rules moved into the cart domain

Required and min/max rules were enforced in `app/product/[id].tsx`. Correct
there, but it meant any *other* caller could put an invalid line in the basket —
and reorder is another caller.

`optionSelectionProblem()` in `src/utils/cart.ts` is now the single answer to
"is this configuration legal", and `cartStore.addLine` calls it before building
a line, returning a refusal string instead of `void`. Reorder collects refusals
and still adds the items that are fine: a six-item reorder where one product has
gained a required choice puts the other five in the basket and says what
happened to the sixth.

---

## 3. What is tested

| Suite | Tests | Holds |
|---|---:|---|
| `__tests__/idempotency.test.ts` | 11 | A retry returns the first order; the key survives failure; payment and order agree |
| `__tests__/orderStateMachine.test.ts` | 23 | Illegal moves refused; every state reaches a terminal one; no state loops to itself |
| `__tests__/deliveryProvider.test.ts` | 12 | Unlocated dropoff refused; one order never gets two couriers; status never goes backwards |
| `__tests__/modifierRules.test.ts` | 13 | The basket refuses what the rules refuse, and is unchanged when it does |

Plus the 761 that were already passing. Nothing was skipped or relaxed to get
here.

**`__tests__/docsAccuracy.test.ts` is worth knowing about**: it reads the counts
out of `README.md` and `HANDOVER.md` and compares them against the repository.
It caught this branch's own handover going stale at 45 suites. If a documented
number is wrong, the suite fails.

---

## 4. Gate by gate

### 11.1 · UX approval against brand guidelines — ready for review

Brand rules are enforced mechanically, not by memory: the `bb.q Chicken`
spelling, the approved palette, and the prohibition on fire language are checked
in CI. `npm run audit:screens` sweeps every route for touch targets under 44pt
and missing accessibility labels.

What a machine cannot approve is whether the result *looks* like bb.q Chicken.
That is a person's signature, and it has not been given.

### 11.2 · iOS and Android order-journey testing — partly

The order journey is covered as logic: cart reconciliation, pricing, promotions,
rewards, the state machine, and now idempotency. Every route renders under test.

Not covered, and not coverable here: real devices, real OS permission dialogs,
real network loss mid-checkout, Dynamic Island and notch layout, VoiceOver and
TalkBack in practice, and the two stores' own review passes. A simulator sweep
is not device testing and this document does not present it as one.

### 11.3 · Payment sandbox, failure and retry validation — blocked

`paymentService` is a mock. There is no gateway selected, no merchant account,
no sandbox credentials. §12 does not grant them.

What is ready for the day they exist: authorisation takes an idempotency key and
replays rather than re-authorising, so the retry half of this gate is already
built and tested against the mock. **Do not** validate the retry path against the
mock and call the gate cleared — it has to be re-run against the gateway's own
sandbox, including its declines, timeouts and 3-D Secure interruptions.

Per §7: no secret belongs in the client. The gateway keys go server-side, and
the app talks to an endpoint that holds them.

### 11.4 · POS / order-management integration — blocked

No store system, no API, no contract. Orders currently resolve against seeded
store data. The order state machine is the seam this will attach to — a POS
acceptance becomes `ACCEPTED`, a kitchen start becomes `PREPARING` — but nothing
is connected.

### 11.5 · Delivery-provider onboarding — seam ready, unconnected

Deliberately unfinished, per §12: connect only after the relevant bb.q Chicken
and provider business entities complete onboarding and receive authorised
integration details.

When those arrive, the work is a second implementation of `DeliveryProvider`
plus an env flag — not a change to checkout. Two things to get right at that
point: webhook signature verification on status callbacks (§7), and credentials
held server-side rather than in the app.

### 11.6 · Privacy, terms and data-processing review — not started

The app collects addresses, location, order history and contact details. It
needs a privacy policy, terms, a data-processing position (South Africa's POPIA
applies), and the App Store privacy-nutrition answers that follow from them.
This is legal work, not engineering work, and none of it has been done.

### 11.7 · Store submission readiness — blocked

There is no Apple Developer account, no Google Play account, no EAS credentials
and no signing identity in this environment. `eas.json` exists; nothing has been
built with it or submitted.

Also outstanding for submission: 11.6 above, final store copy and screenshots,
and an age-rating questionnaire.

### 11.8 · Production monitoring and rollback — not started

No crash reporting, no error tracking, no release-health dashboard, no
documented rollback. Before a first release: a crash reporter, a decision on
whether OTA updates are the rollback mechanism, and someone named who watches
the first days.

---

## 5. Deliberate deviation, restated

**Money stays in rand, not integer minor units.** §7 asks for minor units. The
app stores rand with at most two decimals and routes every arithmetic operation
through `toCents` / `sumRand` / `multiplyRand` — convert to integer cents,
operate, convert back — so the property §7 protects, no float error in a total,
already holds and `money.test.ts` holds it.

Converting the storage unit would touch every price literal, every screen that
renders one, and the API contract, for a representational change with no
behavioural difference. §8 says to preserve working code unless a measurable
improvement is required. New money paths added by this work use integer minor
units natively (`feeMinor`, `orderValueMinor` on the delivery provider), so the
boundary is the old code rather than the new.

A reviewer who disagrees should say so before the API contract is fixed with a
partner — it is much cheaper to change now than after.

---

## 6. What to do next, in order

1. **Legal first.** 11.6 blocks 11.7 and has the longest lead time of anything
   on this list.
2. **Select a payment gateway** and stand up the server-side endpoint that holds
   its keys. Re-validate the retry path against its sandbox.
3. **Open the store accounts** and get one internal-distribution build onto real
   devices. Most of 11.2 falls out of having that build.
4. **Add crash reporting** before anyone outside the team installs it.
5. **Delivery onboarding** when the business entities are ready — the code side
   is a provider implementation and a flag.
6. **POS integration** last: it is the one most dependent on decisions nobody
   has made yet.

---

## 7. Honest limits of this document

Written from the repository and the brief. It has not been reviewed by anyone at
bb.q Chicken, it does not carry any approval, and every gate marked blocked is
blocked on something no amount of further coding here would produce. The brief's
own §13 notes that the App Store listing it benchmarks could not be reliably
resolved, so "parity with that app" is not a claim anyone should make from this
work either — including this document.
