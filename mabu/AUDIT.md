# Mábu app and website: completion audit

Audited 29 September 2026 (fifth pass) against the brief (*Mabu Premium Restaurant App — Booking,
Rewards, Notifications*). Costings are in `COSTINGS.md`; the search plan is in `SEO.md`.

## Summary

| | Complete | Left |
| --- | ---: | ---: |
| **The app** (iPhone, Android and the service behind them) | **≈ 80%** | 20% |
| **The website** (the same product as a public site) | **≈ 63%** | 37% |

Everything the brief asks for is built and works in demo mode. The website is a real set of pages: 123
addresses, each with its own content, title, description and structured data, plus a sitemap and robots file.
What remains is mostly Mábu's own content, accounts nobody else can open, and putting it online.

The weighted total is where it was after the fourth pass. That is not a stalled round: this pass closed a
promise the privacy notice had already made, made the restaurant's own numbers durable, and fixed eighteen
screens' worth of accessibility problems — all inside workstreams that were already near their ceiling. The
ceiling is what is left.

**Nothing on the remaining 20% can be finished from here.** It is Mábu's content, Mábu's accounts and Mábu's
legal sign-off, plus the hosting, store submission and outside testing that follow from them. The engineering
that does not depend on somebody else is done.

The percentages are weighted estimates of effort, not a count of screens or pages.

## By workstream

| Workstream | Weight | Done | Status |
| --- | ---: | ---: | --- |
| Guest app: screens, navigation, design | 18 | 95% | All brief screens built in the supplied designs. Waits on three design decisions. |
| Booking engine (§29–33) | 12 | 80% | Complete in the app and server. The Dineplan adapter waits on an API contract (or use Mábu's own inventory). |
| MÁBU Rewards (§34–36) | 8 | 95% | Earning, tiers, FIFO expiry, redemption, reversal, adjustments. Programme rules are placeholders. |
| Notifications (§37–42) | 8 | 90% | In-app, push (Expo) and email (SMTP) built; audiences and a weekly cap on marketing. Needs an email account. |
| Events, vouchers, payments | 8 | 85% | PayFast hosted checkout built and tested locally. Needs a PayFast account and one sandbox payment. |
| Admin and CMS | 7 | 93% | 14 admin screens, campaign audiences with a reach preview, and conversion counts that survive a restart. |
| API server and data | 12 | 75% | Server, migrations and Docker ready. Still to do: relational tables, hosting, backups, monitoring. |
| Content | 8 | 40% | Brand, categories, venue and the Meerlust event are real. Dishes, wines, prices, hours and policies are samples. |
| Security and POPIA | 5 | 92% | Hashed codes and sessions with hard expiry, device list and revocation, new-device alerts, fresh-sign-in rule for money and policy, strict headers and body limits, verified payment notifications, website content policy, dependency gate. A guest can read back everything we hold about them. Needs legal sign-off and an external penetration test. |
| Testing | 5 | 97% | 101 unit and integration tests, schema check, server check on PostgreSQL, 122-screen sweep with a reduced-motion check, an axe-core accessibility gate, 9 journeys, single-file check, SEO check. |
| Release | 9 | 40% | Website build, EAS profiles, store copy, Docker image and single-file demo ready. Still to do: accounts, signing, store review, hosting. |
| **Total** | **100** | **≈ 80%** | |

## The website

The same product served as a public website, `dist-web/`: 123 pages, of which the public ones a search engine
can read and the personal ones are kept out of search.

| Part | Weight | Done | Status |
| --- | ---: | ---: | --- |
| Pages, design, accessibility | 30 | 98% | Every route is its own page; checked at 320 and 390pt, with reduced motion, and with axe-core — no serious or critical findings (`ACCESSIBILITY.md`). |
| Content: real menu, prices, hours, photography | 22 | 40% | Sample menu and prices; photos for cards are cut from the design files. |
| Search setup in the build | 14 | 95% | Titles, descriptions, canonicals, Open Graph, schema.org, sitemap.xml, robots.txt, share image, and a check that fails the build. |
| Bookings, vouchers and events working on the live site | 14 | 65% | They work against the demo back end; live needs the API hosted and PayFast and email connected. |
| Hosting, domain, https, backups | 8 | 0% | Nothing is online yet. |
| Search Console, Bing, Business Profile, directory links | 6 | 0% | About an hour's work once the domain is live (steps in `SEO.md`). |
| Legal pages approved, public phone number | 6 | 40% | Drafts written and linked; awaiting Mábu's attorneys and the number to publish. |
| **Total** | **100** | **≈ 63%** | |

## Done in the fifth pass

- **A guest can read back everything we hold about them** (POPIA §23): Profile → Your details → "See what we
  hold about you" shows their details, bookings, event bookings, vouchers, rewards with the full points ledger,
  favourites, notification choices and devices, in plain language and with a share action to keep a copy. Staff
  notes about a guest are not part of it. Asking for somebody else's record is refused.
- **The restaurant's conversion counts are real.** Funnel events are kept in the database rather than in one
  process's memory, so they survive a restart; the app batches events and sends them to the server; an unknown
  event name or a property that is not a plain primitive is dropped; nothing in an event can carry contact
  details; events are pruned after 90 days. The dashboard counts the last 30 days and shows how many events
  came from guests' devices.
- **An accessibility pass with axe-core** (`ACCESSIBILITY.md`), now a step in CI. It found 18 screens with
  serious problems; all are fixed: photographs announced once and decorative ones not at all, roles that match
  behaviour (a filter chip is a toggle, not a "selected" tab), a stepper that publishes its values, a named
  progress bar, `main` and `banner` landmarks, keyboard-reachable scrolling areas, underlined links inside
  sentences, and two real contrast failures — the board's copper as text (3.4:1) and a disabled control faded
  to 1.5:1.

## Done in the fourth pass

- **A security layer** (`SECURITY.md`): request limits and strict headers on every answer, hardened request
  bodies, sessions with a hard expiry and a device list a guest can revoke, an email when a new device signs in,
  and a fresh-sign-in rule before any staff change to money or policy. The website ships its own content
  security policy, checked in a browser and enforced by the build. CI fails on a high-severity advisory.
  An independent review of the new code found three real gaps — a step-up rule that named four handlers that do
  not exist, sessions keeping the lifetime of the role they were opened with, and the full booking policy
  readable by any signed-in guest — all fixed and covered by tests (`SECURITY.md`).

## Done in the third pass

- **The website became real pages.** Every route renders to its own HTML file at build time, with the menu,
  events and venue written into the page, so a search engine reads them without running JavaScript.
- **Search setup:** per-page titles and descriptions aimed at local searches, canonical addresses, social
  cards, schema.org (`Restaurant` with opening hours, `MenuItem` with price, `FoodEvent` with date and price,
  breadcrumbs), `sitemap.xml`, `robots.txt`, a share image, and a build that fails on a missing or duplicated
  title or description. Private pages are kept out of search by default.
- **A real bug found and fixed:** on the pre-rendered pages, a guest who asks their browser for less movement
  was left with hidden content (including the "Book your table" button). Entering animations are now
  native-only, and the screen sweep checks for hidden content with reduced motion.

## Done in the first pass

- **API server** (`server/`): emailed six-digit codes (hashed, expire after 10 minutes, 5 attempts, rate-limited),
  bearer sessions (hashed, 60 days), PostgreSQL or file storage written through after every call, scheduled
  jobs, CORS, and mock-only tools hidden. Optional direct inventory lets it take real bookings against Mábu's
  own pacing. `npm run server:check` runs sign-in, a booking and a restart on PostgreSQL over HTTP.
- **Push notifications:** devices register after sign-in; the server delivers through Expo (APNs and FCM) and
  drops devices that are no longer registered. Signing out ends the session on the server too.
- **Legal:** draft privacy notice (POPIA), terms of use and marketing consent pages, marked for legal review and
  linked from sign-in, profile and preferences.
- **Content:** every menu category now has at least three dishes; the leather menu cover heads the full menu.
- **Single-file app:** the whole app in one HTML file that opens from disk on a Mac, or from Files on Android,
  and as a hosted page. `npm run standalone:check` books a table through it.

## Done in the second pass

- **Email:** sign-in codes and notification email go out over SMTP, so any provider works; branded HTML part,
  header injection refused.
- **Payments:** PayFast hosted checkout: signed checkout form, notifications accepted only after signature,
  merchant, PayFast's own confirmation and amount all check out. The app opens the checkout after a voucher,
  ticket or deposit, and updates when the payment lands.
- **Marketing:** campaigns can target everyone, regulars, lapsed guests, Rewards members or birthdays this
  month, with a live reach count; no guest gets more than two marketing messages in seven days.
- **Deployment:** migrations apply automatically at start-up (once each, checksummed); Dockerfile and compose
  file for the API and PostgreSQL; EAS build profiles; a store listing draft with privacy answers.

## What is left

### Needs Mábu first

1. The real menu, wine list and prices, or access to the published menus (enter in Admin → Menu).
2. Opening hours, service periods, table durations, pacing, cancellation and amendment cut-offs, deposit rules.
3. Rewards programme rules: tiers, earn rates, catalogue, expiry.
4. Legal sign-off on the three draft pages, plus the legal entity name and registration number.
5. High-resolution originals of the dish photographs that are currently cut from the design files.
6. Three design decisions: the bag and **+** (ordering or favourites?), "MÁBU Private Functions" branding, and
   the home headline and tab bar in the home concept.
7. Accounts: PayFast merchant (or another gateway), an email account with SMTP, Dineplan API access (or a
   decision to use Mábu's own inventory), an Expo account, Apple Developer and Google Play accounts, hosting,
   a domain, and a public phone number.
8. The website's own launch: publish `dist-web/`, then Search Console, Bing and Google Business Profile — about
   an hour, steps in `SEO.md`.

### Engineering once those exist

1. **PayFast go-live:** one sandbox payment, then live credentials (refunds via the dashboard or its API).
2. **Email go-live:** SMTP credentials and a verified sender domain (SPF/DKIM).
3. **Dineplan adapter**, if Dineplan stays the booking system of record.
4. **Relational database:** move the rows from `server_row` onto the tables in `001_initial.sql`, then allow
   more than one server instance.
5. **Hosting:** run the Docker image and PostgreSQL with backups, the web build on Mábu's domain, error
   monitoring and uptime checks.
6. **Store release:** EAS project, signing, TestFlight and Play internal testing, store listings and screenshots.
7. **An external penetration test** before launch. The code-level review is done and the fixes are in;
   `SECURITY.md` lists what is protected and what is accepted.

## How to see it

- The demo app is published as a private artifact page, and as one file (`npm run standalone` builds
  `dist-standalone/mabu.html`).
- Demo sign-in: any email, code `123456`. Accounts: `demo@mabu.app` (guest with history), `host@mabu.demo`
  (front of house), `admin@mabu.demo` (admin).
