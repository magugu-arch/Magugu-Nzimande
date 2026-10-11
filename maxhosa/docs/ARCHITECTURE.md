# Architecture

## Shape

A single Expo app (SDK 57, React Native 0.86, React 19, strict TypeScript,
Expo Router) in `maxhosa/`, beside — and fenced off from — the bb.q app at the
repository root. The brief's monorepo was not adopted: one app plus a shared
data file does not need workspaces, and the brief says not to add an elaborate
monorepo to look sophisticated.

```
maxhosa/
  src/app/            routes (Expo Router)
  src/components/     design-system components
  src/design/         tokens, motion, theme
  src/domain/         types and pure rules (money, catalogue, delivery)
  src/providers/      Commerce · Delivery · Booking · Events providers + mocks
  src/store/          zustand stores (bag, saved, prefs, shop filters)
  src/features/       hooks that join providers, stores and formatting
  data/               sample catalogue shared with the offline demo
  assets/maxhosa/     the 24 verified images (+ recorded additions) + manifest
  demo/               offline HTML demo sources (classic scripts)
  deliverables/       built offline demo, README, ZIP
  scripts/            asset gate, demo build/test, web screenshots
```

## Data flow

```
 screen ──► features hook ──► provider interface ──► mock adapter (today)
   ▲                                              └► platform adapter (after discovery)
   └── domain rules (trackingView, filterProducts, money) — pure, tested
```

- **One source of truth.** Prices, stock, orders and tracking are read from a
  provider every time; the device stores only preferences, the bag's line
  references and saved product IDs.
- **Money** is `{ amount: string; currencyCode }`, summed in integer minor
  units (`src/domain/money.ts`).
- **External data is validated** at the boundary (`RawCarrierEventSchema`,
  zod). Unknown carrier codes become `unknown`, never a stage.
- **Delivery is separate from commerce.** The platform owns the order and
  fulfilment; the courier owns scans, estimates and positions. Merchant and
  courier events are labelled separately so “packed” never reads as “with the
  courier”.
- **Idempotency** on checkout, booking and RSVP: one key per attempt, so
  double taps and retries cannot create two orders, bookings or places.
- **Events never carry a head-count.** The events provider turns capacity
  into `open | full | drop-in | invite-only`, so the app can say “Spaces
  available” or “Waitlist open” but cannot invent “only 3 left”. Venues stay
  with the provider; the app shows the kind of place only.
- **Add to calendar** uses the system's own new-event form
  (`expo-calendar/legacy`): SDK 57's object API needs a calendar instance,
  which on Android means calendar permission; the system form needs none.
  On web, `features/calendar.web.ts` hands the browser an `.ics` file built
  by `domain/events.ts`.

## Production integration service (not built)

The app never holds private credentials or calls courier APIs directly. A
lean service is needed for: carrier/aggregator webhooks (verify signatures,
de-duplicate, normalise, reconcile), booking (slot locking, capacity), push
notifications (consent, deduplication, frequency caps), and any CRM bridge.
The mock providers model exactly the interface that service would expose.

## Navigation and presentation

- Native stack for pushed screens (edge-swipe back is the platform's).
- **Native sheets** (`presentation: 'formSheet'`) for bag, checkout, filters,
  size guide, market, delivery preferences and “what is real” — the iOS
  sheet controller provides detents, drag, flick-to-dismiss and the parent
  scaling back.
- A custom translucent tab bar over the content; screens draw their own
  scroll-linked header (see DESIGN.md).

## Testing

- `npm test` — 75 Jest tests: money, catalogue filters (including price
  bands), delivery rules, the four providers (idempotency, slot holds,
  preference cut-off, RSVP capacity, waitlist and invitations), event dates
  in SAST, calendar-file validity and octet folding, asset registry
  (24 verified + recorded additions), WCAG contrast of every token pair,
  motion maths, stores, and UI tests that the tracker never shows an
  unconfirmed status or ETA as fact.
- `npm run assets:verify` — the 24-image gate, plus recorded additions.
- `npm run export:web && npm run shots:web` — renders 20 routes through
  react-native-web and fails on errors, blank screens or overflow.
- `npm run demo:build && npm run demo:test` — the offline demo in Chromium
  with the network cut (114 checks, including the events loop).
- Not yet run: iOS simulator, Android emulator, real devices (see TASK_BOARD).
