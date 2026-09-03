# POS integration — what is needed from GAAP

GAAP Point-of-Sale has been chosen as the till system. This document says what
has been built against that choice, what cannot be built without GAAP, and
exactly what to ask them for.

It exists because GAAP's integration specification is **not public**. They work
through an integration partner programme and issue the document under
agreement, so unlike the other four vendors on this project — PayFast, Uber
Direct, Mailgun, Clickatell, all of which publish their APIs — the endpoint
names, authentication scheme and field names are not something that can be
read, derived or sensibly guessed.

Writing an adapter against a guess would be worse than writing none. It would
look finished, pass its own tests, and fail on the first real order in a way
that reads like a GAAP outage.

---

## What is built

Everything a POS integration needs that does not depend on a vendor's wire
format. In practice this is most of the work and all of the risk.

| | Where |
|---|---|
| The adapter interface a POS is plugged into | `apps/web/src/lib/fulfilment/adapters.ts` |
| The handoff record, with retry and a shortfall report | `apps/web/src/lib/fulfilment/handoff.ts` |
| The catalogue-to-till code map, and its completeness rule | `infra/seed/pos-codes.ts` |
| An order translated into the facts a till needs | `apps/web/src/lib/fulfilment/pos/payload.ts` |
| 19 tests over the mapping | `apps/web/tests/pos-mapping.test.ts` |

### The three states of the code map

A map is `absent`, `complete`, or `partial`, and the middle state is the one
worth designing around.

- **Absent** — no POS attached. The operations console is the kitchen display,
  every order still stands, and nothing is reported as a failed handoff. This is
  where the deployment is today and it works.
- **Complete** — every product, every modifier a customer can choose, every
  store and every service mode has a code.
- **Partial** — orders for mapped items reach the till and orders for unmapped
  ones are rejected there. Intermittently, per basket, in the middle of a
  service. That pattern takes a long time to recognise from the shop floor,
  which is why `posMapCompleteness()` names it as its own state and a test
  holds it.

An order that cannot be fully translated is refused as a whole rather than sent
short. A basket that reaches the kitchen with three of its four items is an
order made wrongly for a customer who paid for four.

---

## What to ask GAAP for

### 1. The integration specification

Specifically:

- **Transport and endpoint.** HTTP to a cloud endpoint, HTTP to a middleware
  box on the store LAN, or a watched directory. This decides whether the
  adapter can run from a hosted deployment at all, or whether it needs an agent
  in each store.
- **Authentication.** Scheme, where the credential goes, whether it is per
  merchant or per branch, and how it is rotated.
- **Order injection.** The request shape for a new order, and what a success
  looks like. Whether it returns their own order id.
- **Idempotency.** Whether a retried injection is deduplicated, and on which
  field. Without this a timeout that actually succeeded puts the same order
  through the till twice, which a kitchen reads as two of everything.
- **Availability.** Whether the till can be asked what is sold out, and how.
  Our adapter interface distinguishes "nothing is sold out" from "I could not
  ask", so the answer needs to be able to fail visibly.
- **Order status.** Whether GAAP can tell us an order was accepted, made or
  voided, by webhook or by polling.

### 2. The code list, per store

The two lists below are generated from the catalogue rather than typed, so they
are current by construction. Regenerate with:

```bash
cd apps/web && npx vitest run tests/pos-mapping.test.ts
```

- **28 product codes** — one per item on the menu.
- **Modifier codes** — one per option choice, keyed by group *and* label.
  The group matters: "Large" on a side is a different code from "Large" on a
  drink, and a map keyed on the label alone finds whichever was listed first,
  which is a wrong code the till accepts.
- **3 branch codes** — Cresta Crossing, Waterfall Ridge, Fourways Crossing.
- **3 order-type codes** — delivery, collection, dine-in.

### 3. A test environment

A non-production till or a sandbox tenant. Nothing about our signing, mapping
or retry behaviour can be confirmed correct against a specification alone —
that is what the other four adapters are also waiting on, and it is the honest
description of their state.

---

## What happens when the specification arrives

One new file implementing `PosAdapter`, and `infra/seed/pos-codes.ts` filled
in. Nothing else in the integration knows a code or an endpoint, which is the
point of having written it this way round.

Estimated at **4 days** once the specification and codes are in hand, against
the 6 originally costed for the whole workstream.
