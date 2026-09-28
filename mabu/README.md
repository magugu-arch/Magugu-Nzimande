# Mábu — Premium Restaurant App

Reservation-first guest app and restaurant admin for **Mábu Restaurant, Waterfall Wilds, Midrand**, built to
the *Mábu Premium Restaurant App — Claude Code Brief (Booking, Rewards, Notifications)*.

**Stack:** Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · Expo Router (`js-tabs`) ·
TanStack Query · Zustand · PostgreSQL schema (tested in PGlite)

This is a separate Expo project inside the repository. The bb.q Chicken app at the root is untouched; the root
lint, typecheck and Jest configs ignore `mabu/`, and it has its own CI workflow (`.github/workflows/mabu.yml`).

---

## Quick start

```bash
cd mabu
npm install
npm start            # i / a / w, or scan with Expo Go
```

It runs end to end with **no server**: `EXPO_PUBLIC_USE_MOCK_API` defaults to `1`, so the real service layer
runs in-process and saves to device storage after every call. Sign in with any email; the one-time code is
shown on screen (`123456`).

| Demo account | What it shows |
|---|---|
| `demo@mabu.app` | Two past visits, a gift voucher, an upcoming birthday table, 650 Rewards points, inbox history |
| `host@mabu.demo` | Front of house: reservations desk, check-in, voucher and reward-code redemption |
| `admin@mabu.demo` | Everything: policy, rewards, templates, campaigns, menu CMS, payments, audit |

Admin › *Reset demo data* starts again.

### Commands

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run verify` | typecheck → lint → format check → Jest → schema check |
| `npm test` | 73 unit, integration and component tests |
| `npm run db:check` | Applies `server/migrations` to real PostgreSQL (PGlite) and attacks each invariant |
| `npm run export:web` | Web build into `dist-web/` |
| `npm run shots` | Renders 40 routes × 2 widths × 3 roles; fails on overflow, blank screens, console errors, unnamed buttons |
| `npm run e2e` | Nine journeys through the real UI (booking, double-tap, vouchers incl. decline, events, waitlist, rewards, preferences, staff) |
| `npm run verify:web` | `export:web` + `shots` + `e2e` |
| `npm run assets:photos` | Rebuilds photos, the photo registry, icon, splash and favicon from `assets/photos/masters` |

---

## What is built

**Guest (bottom nav: Home · Discover · Book · Events · Profile, Book as the brass centre button)**

- **Splash** — wordmark, subtle motion, brand statement.
- **Home** (§5) — cinematic hero *African Luxury. Refined by Fire.*, Book Your Table / Explore the Menu, today's hours
  and location, *Our essence*, menu highlights, next event, wine spotlight, *Give the gift of Mábu*, stories, the
  board's brand-icon panel as quick links, call / email / directions. A provider-confirmed time is on screen **two
  taps** from Home.
- **Book** (§6, §30–31) — party & children, month calendar with available / full / closed days, times grouped by
  lunch and dinner, occasion, seating, dietary / accessibility / special notes, guest details autofilled from the
  profile, policy and deposit review, confirmation, add to calendar, share, directions; **manage**: amend,
  reschedule, cancel (late cancellation stated before the guest confirms), history. **Waitlist** when full, with an
  urgent notification and a deep link that pre-selects the freed table.
- **Discover & Menu** (§8–10) — Food / Desserts / Wine, the thirteen §9 categories, search by dish or ingredient
  (accent-insensitive), verified-only dietary filters, signature & chef's selection, sold-out states, dish detail
  sheet with provenance, preparation, modifiers, allergens and wine pairings, wine list by style, collections,
  favourites, sharing, gallery.
- **Events** (§11) — list and detail (menu teaser, wine partner, dress, age), seats, price or *Price on request*,
  availability chip, payment, waitlist when sold out, calendar, share, cancellation with refund.
- **Vouchers** (§12) — preset or custom value, self or someone else, message and occasion, payment, unique
  code + QR, *My vouchers* with balance; 36-month validity (CPA s63).
- **MÁBU Rewards** (§34–35) — opt-in, tier and progress, balance, available and tier-locked rewards, terms, redeem
  → confirm → one-time code + QR, earning and redemption history, expiry warning, referral code.
- **Notifications** (§37–39) — in-app centre, preference centre by category and channel, quiet hours, marketing
  consent with timestamp and source, OS permission prompt.
- **Profile** — *Your Mábu Journey*: bookings & events, vouchers, favourites, details, dietary & seating
  preferences, occasions, account deletion (POPIA).
- **Visit, Support, Private functions** — directions (Google / Apple / Waze), hours, arrival notes, FAQ, contact
  form, enquiry.

**Restaurant (Profile › Staff & admin)** (§18, §44) — dashboard (bookings, covers, waitlist, event occupancy,
voucher sales, conversion), reservations desk (by day or search; complete, no-show, cancel, staff notes, audit
trail, offer freed tables to the waitlist), **booking policy** editor, **reward rules / catalogue / expiry / ledger
adjustments and reversals**, **versioned notification templates**, **campaign scheduling**, voucher and reward-code
redemption, **menu & wine CMS**, event capacity / pricing / check-in, delivery log and mock outbox, guest CRM,
payment reconciliation, audit log. Staff see the service tools; admin-only tools are enforced on the server.

---

## Architecture

```
src/
  domain/            the service layer — pure TypeScript, no React Native
    reservations/    types (§7, §32), policy, slots, providers/, lifecycle service
    rewards/         ledger, tiers, rules engine, redemption, expiry, reversal
    notifications/   templates, providers, queue/dedupe/retry/quiet hours, campaigns
    experiences/ vouchers/ payments/ guests/ menu/ commerce/
    events/          typed domain event bus (§43)
    automation.ts    §41 trigger table + scheduled jobs
    rpc.ts           the API: one typed handler table
    db.ts            the tables (PostgreSQL shape in server/migrations)
  services/          api client (mock or HTTP transport), config, queries, demo seed
  app/               Expo Router screens
  components/        design system (§25) — ui/, mabu/, brand/, admin/
  content/           CMS seed data and the generated photo registry
  theme/             colour, type and layout tokens from the brand board
server/migrations/   PostgreSQL schema
scripts/             photo pipeline, screen sweep, journeys, schema check
```

- **One API surface.** `src/domain/rpc.ts` is a table of `(actor, args) → result` handlers. The mock transport
  calls it in-process; a server mounts the same table at `POST /rpc/<name>`, resolving `actor` from the session
  token and passing `Idempotency-Key`. Every role and ownership rule lives in the services, not the UI.
- **Providers behind adapters.** `ReservationProvider` (`MabuDirectReservationAdapter`,
  `DineplanReservationAdapter`), `CommerceProvider` (`MabuDirectCommerceAdapter`, `UberEatsAdapter`, `MrDAdapter`),
  `PaymentProvider`, `NotificationProvider` per channel. Unconfigured ones answer `*_NOT_CONFIGURED`; the UI turns
  that into Call / Email reservations.
- **Decoupled by events.** A completed reservation publishes `reservation.completed`; rewards earn from it and
  notifications announce it without reservation code knowing either exists. A failing subscriber never undoes the
  booking.
- **Safety rules (§23, §33, §42)** — slots come only from the provider and are re-verified on create; every
  booking / payment / redemption takes an idempotency key (concurrent retries share one promise); webhooks are
  stored and de-duplicated; payment state reconciles separately; one delivery row per message and channel;
  marketing needs flag + consent + preference; push, SMS and WhatsApp templates may only use lock-screen-safe
  variables, checked at render and at save; analytics can never fail a guest action.

### SDK 57 notes

The Expo docs site is blocked from the build environment, so the installed SDK 57 typings were the reference:

- `Tabs` from `expo-router` is deprecated — the app uses `expo-router/js-tabs`.
- `expo-calendar`: `createEventInCalendarAsync` now throws. iOS uses `getDefaultCalendarSync().addEventWithForm()`
  under write-only access; Android uses the intent from `expo-calendar/legacy`; web falls back to Google Calendar.
- React Native Web ignores `accessibilityState`, so controls use `aria-*` props, which RN 0.86 maps on every platform.
- Jest needs `react-native-worklets/jest/resolver` and Reanimated's own mock.

---

## Hand-over report (brief §28 DELIVERABLE)

### 1. Files

Everything is under `mabu/`, plus `.github/workflows/mabu.yml`. At the root only `tsconfig.json`,
`eslint.config.js` and `jest.config.js` changed, to exclude `mabu/`.

### 2. Database migrations

`server/migrations/001_initial.sql` — 35 tables covering every §28 / §46 entity (Guest, MenuItem, WineItem,
MenuCollection, Event, Reservation, ReservationEvent, WaitlistEntry, Voucher, Favourite, RewardAccount,
RewardRule, Reward, RewardTransaction, NotificationPreference, NotificationMessage, NotificationDelivery,
NotificationTemplate, ProviderOrder, ProviderWebhookEvent, …). Constraints enforce the invariants: non-negative
balances, exactly-once earning, single reversal, one live notification per dedupe key, one delivery per channel,
unique webhooks, voucher balance bounds, event capacity, CPA voucher expiry. `npm run db:check` proves each one.

### 3. Environment variables

See `.env.example`. Client: `EXPO_PUBLIC_USE_MOCK_API`, `EXPO_PUBLIC_API_BASE_URL`, and `EXPO_PUBLIC_`-prefixed
copies of the §22 / §45 flags (these only decide what is shown). Server: the same flag names unprefixed —
`flagsFromEnv()` reads both — plus secrets that must **never** be `EXPO_PUBLIC_`: database URL, payment gateway
keys, email / SMS / push provider keys, Dineplan credentials.

`MABU_BOOKING_PROVIDER` defaults to `mabu-direct`, not §45's `dineplan`: with no Dineplan contract the adapter can
only refuse, so defaulting to it would ship an app nobody can book in. Set it to `dineplan` once the adapter is
implemented.

### 4. Commands

See *Commands* above. CI runs `verify`, the iOS and Android bundles, the screen sweep and the journeys.

### 5. Tests added and results

- **73 Jest tests** — reservations (21), rewards (12), notifications (14), vouchers / events / commerce / flags /
  jobs (14), API surface & schema parity (7), accessibility of stateful components (5). All pass. They cover every
  §48 gate, including exactly-once visit rewards, one-time redemption, expiry that cannot go negative,
  retry-safe dedupe, marketing blocked without consent, and services working while analytics fails.
- **Schema check** — the migration applied to PostgreSQL, 19 checks, all pass.
- **Screen sweep** — 80 renders, all clean.
- **E2E journeys** — 9 of 9 pass.

### 6. Provider / API credentials still required

Dineplan API contract and credentials (or Mábu's chosen booking system) · a South African payment gateway merchant
account and hosted-checkout keys (Peach, PayFast, Yoco, Stitch…) · transactional email provider · APNs / FCM
(Expo push) credentials and an EAS project · SMS / WhatsApp Business provider, templates and consent process if
wanted · Uber Eats / Mr D merchant contracts only if ordering is switched on · map provider key if a live map
replaces the directions card.

### 7. Assumptions to confirm with Mábu (§50)

- **All dish, wine and price content is sample** and is labelled as such in the app. The published menus could
  not be fetched from the build environment. Only the venue, the reservations email, the thirteen categories and
  the Meerlust Wine Pairing (27 Oct 2026, 18:30–22:00, R900) come from the brief. The Chef's Table and Festive events
  are samples, marked *Sample event*.
- Opening hours, service periods (lunch Tue–Sun, dinner Tue–Sat), table durations, pacing, the 24 h cancellation
  and 4 h amendment cut-offs, reminders at 24 h and 3 h, deposit rules (off), seating areas, reward tiers
  (Member 0 / Signature 1 500 / Privé 4 000), earning rules, catalogue and 12-month points expiry — all
  placeholders, all editable in admin.
- The public phone number is unknown, so it is `null` and every *Call* action is hidden until it is set.
- Logo: the wordmark is set in Playfair Display from the board until vector logo files are supplied.
- Photography: thirteen supplied photographs are used full-size (fillet, sliced wagyu, kingklip, black-rice
  seafood, seafood linguine, chocolate fondant, cocktails, chef plating, the Mábu wine pour, the Private Functions
  welcome, and three interiors). The supplied menu designs (Starters, Signature Cuts, Vegetarian, Fish & Seafood)
  set the menu screen's layout and the sample dishes and prices; their category hero photographs and 20 dish
  thumbnails are cut from the design files (`COMPOSITES` in `scripts/derive-photos.mjs`) and used at card size.
  The remaining dish tiles and textures are
  cut from the brand board and used only at card and thumbnail sizes. The Mábu-labelled bottle is kept off pages
  about another producer's wine. Drop higher-resolution files into
  `assets/photos/masters/` with the same names and run `npm run assets:photos`.

### 8. Remaining technical blockers

- **The HTTP server.** The API is defined and typed (`rpc.ts`) and the schema exists, but no deployed Node service
  yet mounts the handlers over PostgreSQL (a `Database` implementation backed by `pg` is the missing piece), with
  OTP email delivery, sessions and rate limiting on sign-in. Until then the app runs in mock mode.
- Live provider adapters (Dineplan, payments, push / email / SMS) wait on the credentials in §6.
- Push registration to a server-side token store is not wired, since there is no server yet; on a device, mock
  pushes appear as local notifications.
- Legal copy (privacy policy, terms, POPIA consent wording) is to be supplied by Mábu.
