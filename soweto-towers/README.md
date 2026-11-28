# Soweto Towers website

The website for **Soweto Towers** (also known as **Orlando Towers**), the adventure centre on the painted cooling towers of the former Orlando Power Station in Orlando East, Soweto.

It is built to sell as well as inform. Visitors can book a timed slot and pay online, buy a gift voucher, get tickets for events and request a table at the restaurant. They can chat with the crew and receive their ticket, reminders and Scream Clip on WhatsApp. The crew runs the day from a staff console on any phone or laptop.

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Postgres with Drizzle ORM. No configuration is needed for a full local preview.

---

## Quick start

```bash
cd soweto-towers
npm install
npm run dev
```

Open <http://localhost:3000>. With nothing configured, everything runs locally:

- **Database:** a built-in Postgres (PGlite) in `.data/`, loaded with demo bookings, a chat and enquiries.
- **Payments:** a simulated checkout page (test mode, no money moves).
- **Messages:** emails, WhatsApps and push alerts are simulated and listed in the console's Outbox.

**Staff console:** <http://localhost:3000/admin>, demo sign-in `crew@sowetotowers.co.za` / `jumpmaster`. The demo account only exists in the built-in database. It is never created when `DATABASE_URL` points at a real database.

---

## What's in it

### For visitors

| Area                                     | What it does                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Home**                                 | Art-directed hero, the adventures with live prices, bundles, safety, the free Scream Clip, groups, gifts, events, restaurant, plan-your-visit and FAQ.                                                                                                             |
| **Live status strip**                    | Shows whether the towers are open now, today's hours and today's sunset (closing is always at sunset). Staff can set _hold_ or _closed_ for weather.                                                                                                               |
| **Adventures**                           | A page each for the 100m bungee, straightjacket bungee, SCAD freefall, zipline, paintball, lift ride and base jump: price, group price, rules, what's included, FAQ, and structured data for Google.                                                               |
| **Booking** (`/book`)                    | Six steps, built for phones: adventure or bundle, people, date and time, safety, details, review and pay. See _How booking works_ below.                                                                                                                           |
| **Tickets**                              | QR ticket page, add to Apple/Google/Outlook calendar, push reminders, works offline at the gate, share on WhatsApp.                                                                                                                                                |
| **Gift a Jump** (`/gift`)                | Vouchers for a bundle, an adventure or an amount, delivered by WhatsApp or email on a chosen date, or printed. A live preview updates as you type. Each voucher page has a QR code that opens the booking with the code filled in. Unused value stays on the code. |
| **Events**                               | Listing and detail pages, free RSVPs or paid tickets, spaces left, Event structured data.                                                                                                                                                                          |
| **Restaurant**                           | Chaf-Pozi page with the menu (no prices yet) and a table request form. A "Jump & Lunch" option in the booking passes a table request to the crew.                                                                                                                  |
| **Groups, schools, corporate, partners** | Enquiry forms that land in the console inbox, with an email alert to the crew. Partner links (`/p/CODE`) credit bookings to hotels and tour operators.                                                                                                             |
| **Find my jump**                         | Look up a booking by reference and email to get the ticket and the Scream Clip or full edit.                                                                                                                                                                       |
| **Chat**                                 | "Ask the crew" on every page. It answers common questions at once (prices, hours, weather, safety), staff reply from the console, and the visitor can hand over to WhatsApp at any point.                                                                          |
| **Journal**                              | Articles that answer what people search for, for example "Soweto Towers or Orlando Towers?".                                                                                                                                                                       |

### For the crew: staff console (`/admin`)

| Page         | Use                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Today**    | Today's schedule by slot, check-ins, tower status (open / hold / closed, which alerts booked visitors), gate sales. |
| **Scan**     | Camera QR scanner for tickets, with clear _valid / already in / not valid_ results and undo.                        |
| **Bookings** | Search, booking detail, re-send confirmation, cancel, attach Scream Clips and full edits (the jumper is notified).  |
| **Inbox**    | Chats, enquiries and table requests. Confirming a table sends the guest a WhatsApp.                                 |
| **Events**   | Create, publish, cancel.                                                                                            |
| **Vouchers** | Issue complimentary vouchers, void, look up.                                                                        |
| **Settings** | Capacity per slot and the share sold online, prices (no deploy needed), closures and special hours.                 |
| **Outbox**   | Every email, WhatsApp and push message with its status, a push broadcast, and CSV export.                           |
| **Reports**  | Participants, booking sources and partners, bundle mix, revenue.                                                    |
| **Team**     | Add or remove crew (admin only). Everyone can change their password and turn on two-step sign-in.                   |

Every action checks the signed-in role, and important ones are written to an audit log. Sessions last one shift (12 hours). A two-step code can only be used once, and changing a password signs out every other device.

---

## How booking works

- **Prices** live in one catalog (`src/content/catalog.ts`). Staff can override them in Settings.
  - Group rates apply automatically from 6 people.
  - Bundles: The Jump R630, Jump + Film R760, The Full Tower R1,090.
- **Slots** are 30 minutes from opening until the last start before sunset. Each slot has a capacity per resource (bridge, SCAD, zipline, lift, paintball arena).
  - Only part of each slot is sold online (70% by default), so walk-ins still get a place.
  - A straightjacket jump takes two bridge places.
  - Paintball needs 24 hours' notice and 2 to 10 players.
  - All of these numbers are starting points; see _Content to confirm_.
- **No double booking.** Each booking takes a database lock on its resource and date, then re-checks capacity before saving. Unpaid bookings hold their places for 15 minutes.
- **Safety rules are enforced before payment:**
  - weight limits per adventure, checked for each person;
  - nobody under 12 goes up;
  - under-18s need a guardian's name;
  - everyone confirms the medical exclusions.
- **Vouchers** are checked live and reserved during payment. If the payment fails, the balance is restored. When a voucher covers everything, the booking is confirmed without a payment step.
- **Paying:** PayFast (card, instant EFT, wallets). The return page waits for PayFast's server-to-server confirmation; a browser redirect never counts as payment. Each confirmation is checked four ways: signature, that it came from PayFast's servers, the amount, and PayFast's validation call. Payments that arrive after a hold expired are flagged for the crew.

---

## Notifications and messaging

| Moment                                                   | Email | WhatsApp | Push |
| -------------------------------------------------------- | :---: | :------: | :--: |
| Booking confirmed (ticket link)                          |   ✓   |    ✓     |      |
| Day before: reminder with first slot time                |   ✓   |    ✓     |  ✓   |
| Tower on hold / closed / open again                      |       |    ✓     |  ✓   |
| Scream Clip or full edit ready                           |   ✓   |    ✓     |      |
| Day after: welcome to the #100mClub and a review request |   ✓   |    ✓     |      |
| Gift voucher delivered on the chosen date                |   ✓   |    ✓     |      |
| Table confirmed at Chaf-Pozi                             |       |    ✓     |      |
| New chat, enquiry or table request (to the crew)         |   ✓   |          |      |

- **Email** goes through Resend.
- **WhatsApp** uses the Meta Cloud API with approved templates (see the list below).
- **Push** uses the Web Push standard (Android, desktop, and iPhone once the site is added to the Home Screen).

With no keys set, each message is recorded as _simulated_ in the Outbox, so the whole flow can be checked before going live. WhatsApp messages only go to people who ticked the WhatsApp box.

A daily job (`/api/cron/daily`, 17:00 SAST) runs four tasks:

- release expired holds;
- send tomorrow's reminders;
- send yesterday's #100mClub follow-ups;
- deliver scheduled gift vouchers.

### WhatsApp templates to submit for approval

Create these in WhatsApp Manager with language `en`. Use the same names and the same number of variables; the wording can be adjusted. A URL button's link ends in a `{{1}}` that the site fills in.

| Name                | Category  | Body variables                                                                | Button                                                   |
| ------------------- | --------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| `booking_confirmed` | Utility   | {{1}} first name, {{2}} what's booked, {{3}} date and time, {{4}} booking ref | URL `https://sowetotowers.co.za/ticket/{{1}}`            |
| `visit_reminder`    | Utility   | {{1}} first name, {{2}} first slot time, {{3}} what's booked                  | URL `https://sowetotowers.co.za/ticket/{{1}}`            |
| `tower_hold`        | Utility   | {{1}} first name, {{2}} update                                                |                                                          |
| `tower_closed`      | Utility   | {{1}} first name, {{2}} update                                                |                                                          |
| `tower_open`        | Utility   | {{1}} first name, {{2}} update                                                |                                                          |
| `scream_clip_ready` | Utility   | {{1}} first name                                                              | (optional) URL `https://sowetotowers.co.za/find-my-jump` |
| `after_visit`       | Marketing | {{1}} first name                                                              | (optional) URL to your Google review page                |
| `gift_a_jump`       | Utility   | {{1}} recipient's first name, {{2}} from, {{3}} gift, {{4}} voucher code      | URL `https://sowetotowers.co.za/voucher/{{1}}`           |
| `table_confirmed`   | Utility   | {{1}} first name, {{2}} day, {{3}} time, {{4}} party size                     |                                                          |

Example body for `booking_confirmed`: _Sawubona {{1}}! {{2}} is booked for {{3}}. Booking {{4}}. Show the QR code on your ticket at the gate._

---

## Search, sharing and apps

- **Both names in every title.** Each page has a description, a canonical URL and a 1200×630 share image. The images are under 100 KB, so WhatsApp previews always load; regenerate them with `npm run assets:og`.
- **Structured data (JSON-LD):**
  - Organization, WebSite;
  - TouristAttraction + SportsActivityLocation, with hours that close at sunset;
  - Product/Offer per adventure, ItemList of bundles;
  - Event, Restaurant with Menu, FAQPage, BreadcrumbList, BlogPosting.
- **`sitemap.xml`** lists every page with its images; **`robots.txt`**; **`/llms.txt`** is a plain-language summary for AI assistants.
- **Old links keep their rankings.** The old WordPress URLs (`/bungee-jump`, `/paintball`, `/shop`, `/product/…`, `/contact-us`…) redirect permanently (301) to the new pages.
- **Previews are hidden from search engines** until `NEXT_PUBLIC_SITE_ENV=production`.
- **Installable app.** On Android, iPhone ("Add to Home Screen") and Mac, the site installs like an app:
  - shortcuts to Book, Status and Find my jump;
  - tickets and vouchers open with no signal;
  - offline fallback page.
- **Performance:**
  - images served as AVIF/WebP at the right size, with blur placeholders;
  - fonts self-hosted;
  - pages prerendered, with only live parts (availability, spaces left, status) fetched per request.
- **Accessibility:**
  - semantic landmarks and a skip link;
  - 44px touch targets and visible focus;
  - respects reduced motion, reduced transparency and increased contrast settings.
- **Security:**
  - Content Security Policy, HSTS, no framing;
  - rate limits and spam traps on every form;
  - signed staff sessions, two-step sign-in, audit log;
  - constant-time token checks; payments verified server-side.

---

## Shareable one-file page

`share/Soweto-Towers.html` is the whole story on a single page (adventures and prices, bundles, safety, groups, gifts, Chaf-Pozi, hours and directions, questions, contact), in one file of under 1 MB:

- **Everything is inside the file:** photos, font and icons. It opens with no internet connection.
- **Identity option 01:** the S + T monogram, Archivo type, and bone, tower black and crimson. Text is set larger and heavier than usual for reading on a phone (17px at weight 450, headings at 700).
- **Works with scripts off.** It works in WhatsApp's document viewer on iPhone, in Android browsers and in Files or Quick Look. Two small optional scripts add the booking planner below, and make in-page links scroll without following the "#" link, so they also work in app previewers that show the file inside a frame (where "#" links would otherwise replace the page).
- **A menu beside Book:** the button's two bars turn into an X, and a frosted panel grows from it with every section plus WhatsApp and Call. The button is a checkbox drawn as a button, so it opens in any viewer, scripts or not. Choosing a section closes it as the page scrolls there; the X and a tap outside close it too, and Escape where scripts run. Opening and closing never move the page. With Reduce Motion it simply fades.
- **Parallax from CSS alone:** photos drift more slowly than the page inside their frames, the adventure photos slide sideways as the cards are swiped, and on phones the opening photo holds still while the panel slides up over it. Text always moves with the finger. It uses scroll-driven animations (Chrome and Android, and Safari from version 26); elsewhere, and whenever Reduce Motion is on, the photos stay still.
- **A booking planner:** choose the adventure (the three bundles, straightjacket, SCAD, zipline, paintball or the lift ride), how many people, a day on a calendar and a time, add a name and a note, then send the request on WhatsApp or by email. The calendar and times follow the website's rules (closed Monday to Wednesday, opening times, 30-minute slots up to half an hour before sunset, paintball's hourly games on Friday to Sunday a day ahead, same-day cut-offs), and the estimate uses the website's prices, group rates and bundle savings. Every booking button on the page opens it with that adventure chosen. It runs offline, so it can't see live availability: the message asks the crew to confirm the time. `scripts/share-page/` holds the planner and its data; `src/lib/booking/share-planner.test.ts` checks its calendar and times against the booking engine for two years of days.
- **Without scripts** (WhatsApp's iPhone viewer) the booking buttons open WhatsApp or email with a message to fill in, as before. Phone, email and map buttons open the right apps.
- **Title, description, share-image tags and structured data are included**, so the same file can also be put online as it is.

Send it as a document on WhatsApp or email. After changing prices, hours or content, rebuild it with `npm run share:page`; it reads the same content files as the website.

---

## Configuration

Every setting is listed with an explanation in [`.env.example`](./.env.example). Copy it to `.env.local` and fill in what you have; anything left empty falls back to the simulated behaviour described above.

---

## Going live checklist

1. **Database.** Create a Postgres database, ideally in South Africa or close to it. Set `DATABASE_URL` and run `npm run db:migrate`. The built-in database is for previews only: on serverless hosting it lives in memory and resets.
2. **Staff access.**
   - Set `AUTH_SECRET` (a long random string) plus `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
   - Sign in, change the password, turn on two-step sign-in, then add the crew.
3. **PayFast.**
   - Set the sandbox merchant ID, key and passphrase, with `PAYFAST_SANDBOX=1`.
   - Test a paid booking, a cancelled payment and a gift voucher end to end.
   - Then switch to the live credentials and set `PAYFAST_SANDBOX=0`.
4. **Email.** Verify the sending domain in Resend (SPF and DKIM), then set `RESEND_API_KEY`, `EMAIL_FROM` and `STAFF_NOTIFY_EMAIL`.
5. **WhatsApp.** Set up the WhatsApp Business Platform number and submit the templates above. Once they are approved, set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
6. **Push.** Run `npx web-push generate-vapid-keys` and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
7. **Daily job.** `vercel.json` already schedules it on Vercel. Set `CRON_SECRET`; Vercel sends it automatically. On other hosting, call `GET /api/cron/daily` once a day with `Authorization: Bearer <CRON_SECRET>`.
8. **Domain.** Point `sowetotowers.co.za` at the deployment and set `NEXT_PUBLIC_SITE_URL`. Only then set `NEXT_PUBLIC_SITE_ENV=production`, which lets search engines in.
9. **Google.**
   - In Search Console, add `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and submit `/sitemap.xml`.
   - On the Google Business Profile:
     - set the booking link to `/book`;
     - match the opening hours and the map pin;
     - put the review link in `NEXT_PUBLIC_GOOGLE_REVIEW_URL`.
10. **Analytics (optional).** Set the GA4, Meta Pixel and TikTok Pixel IDs. A consent banner appears only when at least one is set, and nothing loads before consent.
11. **Content.** Work through _Content to confirm_ below.
12. **Final check.** Run `npm run verify` and the end-to-end tests against a preview, never against the live site.

---

## Content to confirm with Soweto Towers

Prices, contacts, hours and rules come from the current sowetotowers.co.za pages (28 November 2026). These items still need a decision or sign-off:

- [ ] **Bundle prices:** The Jump R630, Jump + Film R760, The Full Tower R1,090. They are new; prices can be changed in Settings.
- [ ] **Full HD video price:** the old site shows both R170 and R150. The site uses R170.
- [ ] **"World's highest SCAD freefall"** (home page): carried over from the old site. Keep it only if it can be backed up.
- [ ] **Free 10-second Scream Clip on WhatsApp** for every jumper: the media team needs a routine for it. Clips are attached in the console under Bookings.
- [ ] **Capacity per slot** and the share sold online: confirm with the jump masters (Settings).
- [ ] **Opening hours:** Thursday from 12:00, Friday to Sunday from 10:00, closing at sunset; Monday to Wednesday closed.
- [ ] **WhatsApp number:** which line runs WhatsApp Business (currently 071 674 4343).
- [ ] **Map pin:** check against the Google Business Profile.
- [ ] **Crew names on the About page:** each person's consent to be named.
  - Kagiso Ngwenya's role (listed only as "Crew").
  - Lawrence Sithole's title. The site shows "Director · Site manager"; the old site names him as a new director and lists him as Site Manager.
- [ ] **Chaf-Pozi menu:** dishes are listed without prices until the menu is supplied.
- [ ] **Base jumps:** who handles the applications that come in through the enquiry form.
- [ ] **Sample events** (launch calendar): dates, times and prices. Unpublish or edit them in the console, or set `SEED_SAMPLE_EVENTS=0` before the first start.
- [ ] **Legal pages** (terms, privacy under POPIA, indemnity): drafts that need review by a lawyer. Three placeholders are still open:
  - the refund and cancellation policy;
  - the Information Officer's name;
  - data retention periods.
- [ ] **Photography:** the supplied images look computer-generated, and the murals in them differ from the real towers. Replace them with real photographs before launch. The page layouts and the image file names stay the same.

---

## Scripts

| Command                                           | What it does                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                                     | Local development server                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run build` / `npm start`                     | Production build / serve it                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run typecheck` · `npm run lint` · `npm test` | TypeScript (after `next typegen`, which writes the route types a fresh checkout lacks), ESLint, unit tests (booking rules, two-step codes)                                                                                                                                                                                                                                                                                          |
| `npm run e2e`                                     | Browser tests against a running server on the demo database (`BASE_URL`, default `http://localhost:3000`). They cover:<br>• on an emulated iPhone: booking and payment, voucher purchase and redemption, events, chat, Find my jump<br>• in the staff console: sign-in, gate check-in, password change signing out other devices, two-step codes<br>• on a slow connection: typing and tapping before the page has finished loading |
| `npm run verify`                                  | Typecheck, lint, unit tests and build in one go                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run db:generate` / `npm run db:migrate`      | Create a migration after changing `src/lib/db/schema.ts` / apply migrations to `DATABASE_URL`                                                                                                                                                                                                                                                                                                                                       |
| `npm run assets:import`                           | Import new key images into `public/images/`, then run `npm run assets:manifest`                                                                                                                                                                                                                                                                                                                                                     |
| `npm run assets:icons`                            | Regenerate favicon, app icons and the maskable icon from the brand mark                                                                                                                                                                                                                                                                                                                                                             |
| `npm run assets:og`                               | Regenerate the share images in `public/og/`                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run share:page`                              | Rebuild the one-file page `share/Soweto-Towers.html`                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run format`                                  | Prettier                                                                                                                                                                                                                                                                                                                                                                                                                            |

CI (`.github/workflows/soweto-towers.yml`) runs typecheck, lint, unit tests, a production build and the browser tests on every push that touches this folder.

`package.json` overrides the esbuild inside drizzle-kit's old loader (`@esbuild-kit/core-utils`) to 0.25.12, the version drizzle-kit itself runs, which clears npm audit's advisory for esbuild 0.24 and older. `drizzle-kit generate` and `check` work with it; remove the override once drizzle-kit drops that loader. That loader is also the source of the two "Merged into tsx" notices from `npm ci`: drizzle-kit 0.31.11, its latest stable release, still depends on it.

Linting runs on ESLint 10 (ESLint 9 has reached end of life). Three plugins inside `eslint-config-next` (eslint-plugin-react 7.37.5, eslint-plugin-import 2.32.0 and eslint-plugin-jsx-a11y 6.10.2) haven't widened their ESLint peer range past 9 yet, so `package.json` overrides that range to the project's own ESLint. Before switching, every rule they enable was tested by linting files built to break each one: ESLint 9 and 10 reported identical findings, with no crashes and no install warnings. Remove the three overrides once those plugins list ESLint 10 themselves (`npm ls eslint` shows them marked "overridden" until then).

---

## Known limits

- **Forms need JavaScript.** Next.js 16.4 answers a form posted _without_ JavaScript on a prerendered page with an incomplete page (blank in the browser). Every browser that runs the site has JavaScript, so the realistic case is a tap that lands before the page has finished loading on a slow connection. That case is handled: `src/lib/boot-script.ts` holds the submission and sends it the moment the form is ready, and the slow-network browser test checks it. Revisit this when upgrading Next.js.
- **Find my jump renders in the browser.** The lookup form reads `?ref=` from the address, so it appears once the page's JavaScript has loaded.
- **Unknown adventure, journal and event addresses** (for example `/adventures/nope`) show the branded not-found page with a `noindex` tag but a 200 status, because those pages stream. Addresses that match no page at all return a real 404.

---

## Project layout

```
src/
  app/
    (site)/          public pages (home, book, adventures, events, gift, ticket, voucher, …)
    admin/           staff console, sign-in and server actions
    api/             availability, bookings, payments (PayFast notify, demo), chat, push, calendar files, daily job, status
    sitemap.ts, robots.ts, manifest.ts, llms.txt
  components/        site shell, booking flow, brand mark, console UI
  content/           catalog (prices and rules), site facts, FAQ, journal, menu, crew, images
  lib/
    booking/         pricing, slots and safety rules (pure, unit-tested) and request validation
    data/            database queries (bookings, availability, events, settings, console)
    db/              schema, connection, seed
    payments/        PayFast and the simulated provider
    notify/          email, WhatsApp, push and the message templates
    auth/            passwords, sessions, two-step codes
drizzle/             SQL migrations
public/              images, share images, icons, service worker, legacy emblem (brand/)
scripts/             image, icon and share-image generators, migrations, screenshot helpers
tests/e2e/           Playwright browser tests
```

---

## Brand

- **Logo: identity option 01, the S + T monogram.** An S drawn from two circles whose top stroke runs on as the T's crossbar (the bridge), with the T's stem in crimson (the drop). The artwork is taken from the identity options document and lives in `src/components/brand/st-identity.ts`; `Logo.tsx` draws the horizontal lockup (header), the stacked lockup with VERTICAL ADVENTURE CENTRE (footer) and the monogram (crew console, vouchers). Icons and share images are generated from the same artwork (`npm run assets:icons`, `npm run assets:og`).
- **Palette:** bone `#F3EFE7` and paper `#FAF8F4` surfaces, tower black `#151412` for text and dark cards, and one accent, crimson `#C8102E` (`#B10E28` for crimson text on light, `#F47C8C` on dark). Tokens are in `src/app/globals.css`.
- **Type:** Archivo (in `src/fonts/`, SIL Open Font License) for headings and text alike. Text is 17px at weight 450, headings are bold sentence case with tight tracking, and small labels are tracked capitals after a crimson stroke, the T's drop. Nothing on a public page is smaller than 12px.
- **Previous emblem:** kept at `public/brand/legacy-emblem.png` in case it should come back.
