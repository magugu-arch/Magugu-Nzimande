# Mábu app: completion audit

Audited 28 September 2026 (second pass, same day) against the brief (*Mabu Premium Restaurant App — Booking,
Rewards, Notifications*). Costings are in `COSTINGS.md`.

## Summary

**About 77% complete, 23% to go** (up from 72% this morning).

Everything the brief asks for is built and works in demo mode. Since the first audit: email delivery over SMTP,
PayFast payments, campaign audiences with a weekly marketing cap, automatic database migrations, a Docker setup,
EAS build profiles and a store listing draft. What remains is mostly accounts only Mábu can open, Mábu's real
content, and release work. Of the remaining 23%:

- **about 11 points** need something from Mábu first (content, decisions, accounts);
- **about 12 points** are engineering, most of which starts once those accounts exist.

The percentages are weighted estimates of effort, not a count of screens.

## By workstream

| Workstream | Weight | Done | Status |
| --- | ---: | ---: | --- |
| Guest app: screens, navigation, design | 18 | 95% | All brief screens built in the supplied designs. Waits on three design decisions. |
| Booking engine (§29–33) | 12 | 80% | Complete in the app and server. The Dineplan adapter waits on an API contract (or use Mábu's own inventory). |
| MÁBU Rewards (§34–36) | 8 | 95% | Earning, tiers, FIFO expiry, redemption, reversal, adjustments. Programme rules are placeholders. |
| Notifications (§37–42) | 8 | 90% | In-app, push (Expo) and email (SMTP) built; audiences and a weekly cap on marketing. Needs an email account. |
| Events, vouchers, payments | 8 | 85% | PayFast hosted checkout built and tested locally. Needs a PayFast account and one sandbox payment. |
| Admin and CMS | 7 | 92% | 14 admin screens, now with campaign audiences and reach preview. |
| API server and data | 12 | 75% | Server, migrations and Docker ready. Still to do: relational tables, hosting, backups, monitoring. |
| Content | 8 | 40% | Brand, categories, venue and the Meerlust event are real. Dishes, wines, prices, hours and policies are samples. |
| Security and POPIA | 5 | 65% | Hashed codes and sessions, rate limits, role checks, audit log, verified payment notifications, draft legal pages. Needs legal and security review. |
| Testing | 5 | 92% | 86 unit tests, schema check, server check on PostgreSQL, 92-screen sweep, 9 journeys, single-file check. |
| Release | 9 | 30% | EAS profiles, store copy, Docker image and single-file demo ready. Still to do: accounts, signing, store review, hosting. |
| **Total** | **100** | **≈ 77%** | |

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
   and a public phone number.

### Engineering once those exist

1. **PayFast go-live:** one sandbox payment, then live credentials (refunds via the dashboard or its API).
2. **Email go-live:** SMTP credentials and a verified sender domain (SPF/DKIM).
3. **Dineplan adapter**, if Dineplan stays the booking system of record.
4. **Relational database:** move the rows from `server_row` onto the tables in `001_initial.sql`, then allow
   more than one server instance.
5. **Hosting:** run the Docker image and PostgreSQL with backups, the web build on Mábu's domain, error
   monitoring and uptime checks.
6. **Store release:** EAS project, signing, TestFlight and Play internal testing, store listings and screenshots.
7. **Security review** before launch.

## How to see it

- The demo app is published as a private artifact page, and as one file (`npm run standalone` builds
  `dist-standalone/mabu.html`).
- Demo sign-in: any email, code `123456`. Accounts: `demo@mabu.app` (guest with history), `host@mabu.demo`
  (front of house), `admin@mabu.demo` (admin).
