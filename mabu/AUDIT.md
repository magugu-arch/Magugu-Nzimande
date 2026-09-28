# Mábu app: completion audit

Audited 28 September 2026 against the brief (*Mabu Premium Restaurant App — Booking, Rewards, Notifications*).

## Summary

**About 72% complete, 28% to go.**

Everything the brief asks for is built and works in demo mode: the guest app, bookings, rewards, notifications,
events, vouchers, admin, and now a real API server with sign-in and PostgreSQL. Most of what remains is
connecting live services (they need accounts only Mábu can open), loading Mábu's real content, and releasing
to hosting and the app stores. Of the remaining 28%:

- **about 11 points** need something from Mábu first: real menu and prices, opening hours and policies, legal
  sign-off, high-resolution photographs, three design decisions, and provider accounts;
- **about 17 points** are engineering that starts as soon as those accounts exist: payment gateway, email
  provider, Dineplan, moving the database onto its relational tables, hosting, and store builds.

The percentages are weighted estimates of effort, not a count of screens.

## By workstream

| Workstream | Weight | Done | Status |
| --- | ---: | ---: | --- |
| Guest app: screens, navigation, design | 18 | 95% | All brief screens built in the supplied designs. Waits on three design decisions. |
| Booking engine (§29–33) | 12 | 80% | Search, hold, create, amend, reschedule, cancel, waitlist, idempotency, policy. The Dineplan adapter refuses until there is an API contract. |
| MÁBU Rewards (§34–36) | 8 | 95% | Earning, tiers, FIFO expiry, redemption, reversal, admin adjustments. Programme rules are placeholders. |
| Notifications (§37–42) | 8 | 75% | In-app inbox, Expo push (server side and device registration), templates, quiet hours, retries, consent. No email provider yet; SMS and WhatsApp off by design. |
| Events, vouchers, payments | 8 | 65% | Full flows in demo mode. Live payments refuse until a gateway's hosted checkout and webhook are added. |
| Admin and CMS | 7 | 90% | 14 admin screens: reservations, policy, rewards, templates, campaigns, vouchers, menu, events, messages, guests, payments, audit. |
| API server and data | 12 | 65% | Server built and tested on PostgreSQL. Still to do: relational tables, hosting, backups, monitoring. |
| Content | 8 | 40% | Brand, categories, venue and the Meerlust event are real. Dishes, wines, prices, hours and policies are labelled samples. Photos cut from design files are card-size only. |
| Security and POPIA | 5 | 60% | Hashed codes and sessions, rate limits, role checks, audit log, account deletion, draft legal pages. Needs legal review and a security review before launch. |
| Testing | 5 | 90% | 81 unit tests, schema check, server check, 92-screen sweep, 9 journeys, single-file check. |
| Release | 9 | 15% | Single-file demo and web export work. Still to do: EAS project, signing, TestFlight / Play testing, store listings, domain and hosting. |
| **Total** | **100** | **≈ 72%** | |

## Done in this round

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

## What is left

### Needs Mábu first

1. The real menu, wine list and prices, or access to the published menus (enter in Admin → Menu).
2. Opening hours, service periods, table durations, pacing, cancellation and amendment cut-offs, deposit rules.
3. Rewards programme rules: tiers, earn rates, catalogue, expiry.
4. Legal sign-off on the three draft pages, plus the legal entity name and registration number.
5. High-resolution originals of the dish photographs that are currently cut from the design files.
6. Three design decisions: the bag and **+** (ordering or favourites?), "MÁBU Private Functions" branding, and
   the home headline and tab bar in the home concept.
7. Accounts: a payment gateway (Peach, PayFast, Yoco or Stitch), an email provider, Dineplan API access (or a
   decision to use Mábu's own inventory), an Expo/EAS account, Apple Developer and Google Play accounts, and a
   public phone number.

### Engineering once those exist

1. **Payment gateway:** hosted checkout, webhook, refunds; switch vouchers, events and deposits to live.
2. **Email provider:** one `EmailSender` implementation, used for sign-in codes and notifications.
3. **Dineplan adapter**, if Dineplan stays the booking system of record.
4. **Relational database:** move the rows from `server_row` onto the tables in `001_initial.sql`, then allow
   more than one server instance.
5. **Hosting:** API server, PostgreSQL with backups, the web build on Mábu's domain, error monitoring and uptime
   checks.
6. **Store release:** EAS project, signing, TestFlight and Play internal testing, store listings and screenshots.
7. **Security review** before launch.

## How to see it

- The demo app is published as a private artifact page, and as one file (`npm run standalone` builds
  `dist-standalone/mabu.html`).
- Demo sign-in: any email, code `123456`. Accounts: `demo@mabu.app` (guest with history), `host@mabu.demo`
  (front of house), `admin@mabu.demo` (admin).
