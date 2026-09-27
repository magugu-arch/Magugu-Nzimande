# Grateful — website

The website for **Grateful (Pty) Ltd**, a fashion design studio in Mulbarton, Johannesburg. The site speaks as the studio throughout; no individual is named. It's an editorial, black-and-white, Baskerville-led site with real booking, payment and email flows, built from the *Grateful UI/UX + Claude Code brief* and the *Grateful CI manual*.

React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion · Lucide · React Router · Supabase · PayFast · Resend

```bash
cd grateful
npm install
npm run dev          # http://localhost:5173 — the whole site, API included
```

No accounts or keys are needed to run it locally. With no environment set, the site uses an in-memory database with sample availability, a **mock payment gateway** (its own test checkout page) and a **console mailer** that prints each email to the terminal. The full journey works end to end: book, pay, get the webhook, see the confirmation, receive the emails.

To try the paid checkout locally, run `DEMO_PRICING=true npm run dev`. This gives the services sample prices. It only works in development.

## What's where

```
src/                 the browser app
  pages/             Home, Work (+ /work/:slug), About, Services, Booking, Payment, Confirmation, Contact
  components/        layout/ (Header, MobileNav, Footer), ui/, booking/, forms/, work/
  data/              site.ts (contact, hours, terms), services.ts (seed), work.ts, images.ts
  assets/logo/       the logo, vector-extracted from the CI manual
shared/              types, validation (zod) and formatting used by both browser and server
server/              the API: router, booking rules, slots, security
  db/                Repository interface → supabase.ts (production) / memory.ts (dev, tests)
  payments/          PaymentProvider interface → payfast.ts / mock.ts
  email/             EmailProvider → Resend / console, plus branded HTML templates
api/[...path].ts     Vercel serverless entry. Every /api/* request goes through server/router.ts
supabase/            migrations/0001_init.sql (schema + transactional functions), seed.sql
public/images/       the three supplied photographs + WebP derivatives
```

## Brand decisions

- **Colour:** `#000` and `#fff` only. Secondary text and rules use those two colours at lower opacity. The CI names no accent colour, so there isn't one.
- **Type:** Baskerville is set as *Baskervville*, the open web cut of the same face, self-hosted as a variable font (regular to bold, plus italics). A quiet sans (Inter) is used only for small uppercase labels and form inputs, as the brief allows.
- **Logo:** the `g | GRATEFUL` lockup and the `g` monogram are the vector artwork from page 2 of the CI manual. They weren't redrawn or reset in type. They're inlined so they follow the text colour (monotone on black or on white, as the CI shows).
- **Photography:** monochrome on the Home, About and Services pages. The Work page shows original colour, and the homepage tiles return to colour on hover.
- **Reference image:** used for its principles only: dash-joined stacked headings, bracketed labels like `(FASHION)`, asymmetric grids and large crops. The layout itself is original.

## Nothing invented

The brief forbids making up prices, credentials, clients, dates or project names. So:

- **Every service is "Quote required"** and books *without* payment. To take payment for a service, set `price` (and optionally `deposit_amount`) in the `services` table. The Booking and Payment pages then add the deposit/full choice and checkout automatically. No code changes are needed.
- **Portfolio items** are labelled *Garment Study 01–03*, with `year: null`. The UI hides null fields. Edit `src/data/work.ts`.
- **Service durations** (60/90/45/90 min) are scheduling estimates. **Opening hours** say "By appointment" and **sample availability** is Tue–Fri 09:00–17:00 and Sat 09:00–13:00. Confirm all of these with the studio.
- **Social links** are null and hidden until they're added in `src/data/site.ts`.
- **Privacy notice** (`/privacy`) is a POPIA-shaped template describing what the site actually collects. Items in [brackets] (Information Officer, retention periods, hosting regions, date) must be completed, and the notice reviewed, before launch.

## Booking and payment rules

1. The browser lists slots, but `POST /api/booking` **re-derives them on the server** and refuses anything that isn't open.
2. `reserve_booking()` (Postgres) claims a slot in a single transaction, with an advisory lock per date. A `btree_gist` **exclusion constraint** makes overlapping active bookings impossible at the database level.
3. Paid services are held as `pending_payment` for 20 minutes (`BOOKING_HOLD_MINUTES`). Lapsed holds are released inside the same transaction that would otherwise be blocked by them.
4. `POST /api/payment` works out the amount from the service (deposit or full). The browser never sends an amount. The server returns a signed PayFast form, so the passphrase stays on the server.
5. A booking becomes `confirmed` **only** through `POST /api/webhooks/payfast`, and only after all of these pass: signature ✓, PayFast source host ✓, PayFast's `/eng/query/validate` says `VALID` ✓, and the amount matches what we charged ✓. `confirm_payment()` is idempotent, because gateways retry.
6. If someone pays after their hold has lapsed and another person has taken the slot, the booking is flagged `needs_attention`. The client and the studio are both emailed, and the refund or rebooking is handled by a person.
7. After a successful payment, the confirmation page polls until the webhook has landed. Coming back from checkout doesn't prove payment on its own.

All times are Africa/Johannesburg (fixed UTC+02:00). `date` and `time` are stored as wall-clock values, and `starts_at`/`ends_at` as `timestamptz`.

## Emails

Sent through `server/email/providers.ts` (Resend, or console in development). Templates in `server/email/templates.ts` use the site's black-and-white Baskerville style and escape all user input.

| Trigger | To |
| --- | --- |
| Booking confirmed (free, or after verified payment) | client + studio |
| Payment successful → receipt | client |
| Paid for a slot that's no longer free | client + studio (action needed) |
| Booking cancelled (admin API) | client |
| Contact enquiry | studio (reply-to = sender) |
| Newsletter signup (first time only) | subscriber |

An email failure is logged, but it never undoes a booking or a payment, because the database is the record. Every newsletter email carries a signed, one-click unsubscribe link (`/unsubscribe`, signed with `NEWSLETTER_SECRET`).

## Studio dashboard

**`/studio`**: where the studio team runs bookings day to day. Sign in with the `ADMIN_TOKEN` value. It has:

- **Diary:** the next seven days of bookings, **Add a booking** for ones taken by phone, WhatsApp or in person (free times only; the client can optionally be emailed), with call/WhatsApp/email links, **reschedule** (only free times are offered) and **cancel** (confirmed on the card before it acts). Both email the client.
- **Opening hours:** open single days or a weekly pattern, and close, reopen or delete blocks. The booking page follows at once.
- **Services & prices:** price, deposit, duration, wording and visibility per service. A blank price means "Quote required".
- **Enquiries:** contact messages to mark replied or archive.
- **Overview figures:** today, next 7 days, awaiting payment, needs attention, new enquiries, subscribers.

The plain-language guide for the studio is **[STUDIO_GUIDE.md](STUDIO_GUIDE.md)**. The dashboard isn't linked from the site, is excluded in `robots.txt`, and is sent with `X-Robots-Tag: noindex`. The token is kept in `sessionStorage` only.

Under the dashboard sits the admin API. Every call needs `Authorization: Bearer $ADMIN_TOKEN`:

| | |
| --- | --- |
| `GET /api/admin/overview` | the figures along the top |
| `GET /api/admin/bookings?from=&to=` | the diary |
| `GET /api/admin/bookings/:id/options?date=` | free times a booking could move to |
| `GET /api/admin/slots?serviceId=&date=` · `POST /api/admin/bookings` | free times for, and saving of, a booking the studio enters |
| `POST /api/admin/bookings/:id/reschedule` `{ date, time }` | move a confirmed booking |
| `POST /api/admin/bookings/:id/cancel` | cancel and free the slot |
| `GET /api/admin/services` · `PATCH /api/admin/services/:id` | read and edit services (the deposit is checked against the price) |
| `GET /api/admin/hours?from=&to=` · `POST /api/admin/hours` · `PATCH`/`DELETE /api/admin/hours/:id` | opening hours (one date, or `from`/`to`/`weekdays`) |
| `GET /api/admin/messages` · `PATCH /api/admin/messages/:id` | enquiries |

## Reminders, health and launch checks

- **Day-before reminders.** `GET /api/cron/reminders` emails everyone booked for tomorrow, once each (`reminder_sent_at`, migration 0003). `vercel.json` schedules it daily at 14:45 UTC (16:45 in Johannesburg). It is disabled until `CRON_SECRET` is set; Vercel's scheduler sends that secret automatically. The diary shows "Reminder emailed" on each booking that has had one.
- **`GET /api/health`** returns 200 when the environment is ready for real bookings and 503 otherwise, with pass/fail per check and never a value. Point an uptime monitor at it.
- **`npm run check:launch [-- --env-file=.env.production]`** prints every launch setting with ✓/✗ and the fix. It exits 1 while anything required is missing.

## Security

- Service-role, PayFast and Resend secrets are read only in `server/`. No `VITE_` variables exist, so nothing secret can be bundled.
- All input is validated server-side with the same zod schemas the forms use, and control characters are stripped.
- Ten wrong studio keys from one address in 15 minutes lock that address out of the admin API for the rest of the window.
- Public forms have per-IP rate limits, a honeypot field and a minimum fill time. The rate limits are in-memory per instance: put the host's WAF in front for more.
- RLS is on for every table with no policies, so the anon key can't do anything.
- Production refuses to start with the in-memory database or the mock gateway.
- Card details never touch the site: PayFast's hosted checkout handles them.

## Going live

1. **Supabase:** create a project, then run every file in `supabase/migrations` in order (`0001`–`0003`), then `supabase/seed.sql` (or `supabase db push`). Replace the sample availability with real hours, and set prices where they apply.
2. **Reminders:** set `CRON_SECRET` (16+ random characters).
3. **PayFast:** create a merchant account and test on the sandbox first (`PAYFAST_SANDBOX=true`). Set `PAYMENT_PROVIDER=payfast` and the merchant ID, key and passphrase.
4. **Newsletter:** set `NEWSLETTER_SECRET` to a long random string.
5. **Resend:** verify a sending domain, then set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`.
6. **Vercel:** import the repo with **root directory `grateful`**, add the variables from `.env.example`, and set `SITE_URL` to the real domain (PayFast's notify URL is built from it). Then run `npm run check:launch` against those values: it should print "Ready to launch."

## Scripts

| | |
| --- | --- |
| `npm run dev` | site + API with hot reload |
| `npm run build` | typecheck and production build to `dist/` |
| `npm test` | Vitest: slot rules, double booking, holds, payment verification, PayFast signatures, reschedule, unsubscribe, API routes. Shared fixtures live in `server/test/fixtures.ts` |
| `npm run smoke` | real browser against the dev server: every page at 320/390/1440px (sideways scroll, console errors, axe), then a free and a paid booking end to end, then the studio dashboard (sign in, find the booking, reschedule, set a price, open hours) |
| `npm run check:launch` | lists every setting the live site needs, with ✓/✗ and how to fix it; exits 1 until ready |
| `npm run verify` | typecheck, lint, test, build: what CI runs (followed by `smoke`) |
| `npm run build:single` | the same preview as **one self-contained HTML file** (`dist-single/index.html`, about 2 MB: scripts, styles, fonts and photos inlined) that opens by double-clicking on a Mac or tapping it on Android. A copy is kept at `preview/Grateful-Website-Preview.html` |
| `npm run build:demo` | static click-through preview in `dist-demo/`, with the API simulated in the browser (`src/lib/demoApi.ts`). Nothing is saved or sent. Never deploy it as the real site |
