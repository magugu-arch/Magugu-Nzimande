# Myron Golden — website

A premium personal-brand and business-education site for Myron Golden, built
from the _Myron Golden Website Brief v3_ (14 October 2026). It is a working
**preview**: every page, interaction and form works, but integrations,
imagery, copy and catalogue details still need the owner's approval before
launch (see [Launch checklist](#launch-checklist)).

Nothing here has been deployed.

## Stack

| Layer     | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Framework | Next.js 16.4.0 (App Router, Turbopack, Cache Components, Partial Prefetch) |
| UI        | React 19.3.0, Tailwind CSS 4.3, Motion 14.2 for gesture-driven springs     |
| Forms     | Server Actions + Zod 4.6 validation                                        |
| Type      | Cormorant Garamond (display) and Manrope (interface) via `next/font`       |
| Tests     | Vitest 5 (unit), Playwright 1.64 (end-to-end, desktop and mobile)          |
| Runtime   | Node.js ≥ 20.9 (CI uses 22)                                                |

This folder is a self-contained project inside the Expo app's repository. The
app's root `tsconfig.json`, ESLint and Jest configs ignore it, and it has its
own CI workflow (`.github/workflows/myron-site.yml`).

## Getting started

```bash
cd myron-golden-site
npm ci
cp .env.example .env.local   # optional — the defaults run a preview
npm run dev                  # http://localhost:3000
```

| Script                 | Does                                                                       |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run dev`          | Development server                                                         |
| `npm run build`        | Production build                                                           |
| `npm start`            | Serve the production build                                                 |
| `npm run verify`       | Typecheck, lint, formatting and unit tests — run before every push         |
| `npm run test:e2e`     | Playwright against a production build (`npm run build` first)              |
| `npm run screenshots`  | Every route at 360–1920px into `.screenshots/`; fails on sideways scroll   |
| `npm run export:html`  | The whole site as one downloadable HTML file (needs `npm run build` first) |
| `npm run export:check` | Opens that file from disk and exercises it; fails on any error             |

## Preview and production modes

`NEXT_PUBLIC_SITE_MODE` is the guard rail the brief asks for.

|                               | `preview` (default)                         | `production`                                  |
| ----------------------------- | ------------------------------------------- | --------------------------------------------- |
| Demo events, library, stories | Shown, labelled **Demo**                    | Removed at the data layer                     |
| Draft programs and books      | Shown, labelled **Awaiting confirmation**   | Hidden; their URLs return 404                 |
| Forms with no webhook         | Validate, log field names, say so on screen | Refuse, and show a failure state              |
| Indexing                      | `noindex` everywhere, robots disallow all   | Indexable; sitemap lists published pages only |
| Preview ribbon, `/review`     | Present                                     | Absent (`/review` is a 404)                   |

Both modes build in CI. `NEXT_PUBLIC_*` values are fixed at build time, so
build with the mode you intend to serve.

## Pages

| Route                                                    | Purpose                                                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                                                      | Hero, credibility strip, five pathways, programs, books, learning, events, stories, mailing list |
| `/about`                                                 | Biography, teaching pillars, portrait gallery with a gesture-driven viewer                       |
| `/work-with-myron`                                       | Decision hub: free learning → books → challenge → coaching → speaking                            |
| `/programs`, `/programs/[slug]`                          | Catalogue with status flags; detail pages hand off to the official platform                      |
| `/books`, `/books/[slug]`                                | Books with official purchase links; mock-up covers are labelled as such                          |
| `/events`, `/events/[slug]`                              | Upcoming/Past, list/month views, format/type/month filters; expiry is automatic                  |
| `/events/[slug]/book`                                    | Booking: seats, details, order summary; Stripe Checkout for paid seats                           |
| `/bookings/confirmed`, `/bookings/cancelled`             | Where Stripe returns people; "paid" only when Stripe says so                                     |
| `/checkout/demo`                                         | Preview only: the payment step (details, card, Pay) standing in for Stripe until a key is set    |
| `/cart`, `/orders/confirmed`                             | Book cart (add, change, remove, clear with undo) and Stripe Checkout for books                   |
| `/api/stripe/webhook`                                    | Stripe's signed notice that a payment settled; records it against the booking reference          |
| `/learn`, `/learn/[slug]`                                | Library with search, topic and type filters; click-to-load video                                 |
| `/insights`, `/insights/[slug]`                          | Articles                                                                                         |
| `/speaking`                                              | Topics, formats, booking process, full enquiry form                                              |
| `/press`                                                 | Copy-ready bios (marked draft until approved), photography requests                              |
| `/contact`                                               | Routing cards and contact form; `?topic=press` etc. preselects                                   |
| `/login`                                                 | Hand-off to the member platform — no login form, no credentials                                  |
| `/privacy` `/terms` `/cookies` `/refunds` `/disclosures` | Placeholders that point to the official policies until approved text is supplied                 |
| `/search`, `/thank-you`, 404, error                      | System pages                                                                                     |
| `/review`                                                | Preview only: every unconfirmed fact, the asset register, demo enquiries                         |

## Architecture

```
src/
  app/            routes, server actions (actions.ts, bookings/actions.ts), sitemap, robots
  app/api/        the Stripe webhook
  proxy.ts        real 404s for unknown slugs (see below)
  components/     layout, cards, forms, media (Photo, Gallery, Parallax, VideoFacade), ui
  content/        typed records — the CMS-ready content model
  lib/            data access, events, booking, payments, search, validation, delivery,
                  motion physics, SEO
tests/unit        Vitest
tests/e2e         Playwright
```

**One gate for what the public sees.** Pages never filter by status
themselves; they call `lib/content.ts`, which applies the preview/production
rules. "Demo data never ships" is true by construction.

**Content model.** `src/content/types.ts` mirrors the brief's §8 models
(Program, Book, Event, Content, Testimonial, Enquiry, Media asset). Every
record carries `source`, `lastReviewed` and `needsConfirmation`. Moving to a
headless CMS (the brief suggests Sanity) means replacing the arrays in
`src/content/*.ts` with queries in `lib/content.ts`; the field names map
one-to-one, and no page changes. Add `cacheTag` to those queries and call
`revalidateTag` from a CMS webhook.

**Caching.** Pages are static. Upcoming-versus-past is computed in a cached
function (`lib/events-server.ts`, `cacheLife('hours')`), so an event leaves
"upcoming" within the hour after it ends. Search and the contact topic read
the URL and stream behind `<Suspense>`.

**Detail pages and instant navigation.** Program, book, event and library
pages render their content straight into the static HTML, so readers and
crawlers without JavaScript get the whole page (brief §10). Reading the slug
outside `<Suspense>` would make Next.js flag the route as possibly blocking a
client navigation; wrapping it in `<Suspense>` instead turns the static HTML
into a skeleton. So these segments set `export const instant = false`, and
every card linking to them uses `<Link prefetch>`, which prefetches the whole
page and keeps navigations instant in production.

**Reveal on scroll** is a CSS scroll-driven animation (`animation-timeline:
view()`), not a script. A script that marks elements as revealed races React
hydration and causes mismatches; the CSS version is tied directly to scroll
position and falls back to plain, visible content where unsupported.

**Proxy.** With Partial Prerendering the static shell is sent before a page
can call `notFound()`, which would make unknown slugs a "soft 404" (right
content, 200 status). `src/proxy.ts` checks slugs against the same data layer
first, so they get a real 404.

**Workspace root.** `next.config.ts` pins `turbopack.root` and
`outputFileTracingRoot` to this folder; otherwise Next.js picks the Expo app's
lockfile one level up as the root.

## Images

28 distinct images are in `public/images/myron/`, re-encoded from the
supplied PNGs (2–3 MB each) to progressive JPEGs (5.3 MB in total).
`next/image` serves AVIF/WebP at the right width. The register in
`src/content/assets.ts` keeps the brief's IDs, filenames, alt text, placement,
status and production notes, plus rights and subject-approval fields.

- 30 files were supplied; two were exact duplicates, which leaves 28.
- 24 of the brief's 32 IDs are covered. MG-01 (identity reference, never
  published), MG-10, MG-12, MG-13, MG-20, MG-21, MG-22 and MG-25 were not
  supplied at full resolution. MG-33 to MG-36 were supplied in addition.
- Every image is a **concept visual**. The two book images are generated
  mock-ups. Wherever a book image appears it carries a "Placeholder mock-up —
  not the official cover" label, and the Book structured data has no image
  until real artwork is supplied.

## Interaction design

The motion follows Apple's _Designing Fluid Interfaces_ (WWDC 2018); the
physics lives in `src/lib/motion.ts` and is unit-tested.

- **Response on press.** Buttons and cards scale on `:active` within 100ms.
- **Mobile menu** (`MobileDrawer.tsx`) is a sheet that tracks the finger 1:1
  after a 10px threshold, rubber-bands past fully open, and decides
  close-or-stay from the flick's projected resting point. It hands the release
  velocity to a critically damped spring, adding a little bounce only after a
  flick. It can be grabbed mid-animation. The scrim dims continuously with the
  drag, and the sheet enters and leaves along the same path.
- **Photo viewer** (`Gallery.tsx`) grows out of the thumbnail that was
  pressed and shrinks back into it. Horizontal swipes move at most one photo
  per flick using the same projection; a downward drag dismisses. X and Y run
  on separate springs. Arrow keys, Home/End and Escape work, and focus
  returns to the thumbnail.
- **Header** is transparent over the hero. On scroll, a translucent material
  arrives (blur and tint animate together) with a scroll-edge fade instead of
  a hard rule.
- **Parallax** on the hero photo and the gold geometry runs only on wide
  screens with a fine pointer, uses transforms only, and never moves text.
- **Reduced motion** swaps slides and springs for short cross-fades. **Reduced
  transparency** makes materials solid. **Increased contrast** strengthens
  borders and text.

## Accessibility

Target WCAG 2.2 AA. Skip link; landmarks; one `h1` per page (tested);
visible focus rings on both surfaces; real labels with hints and errors
wired through `aria-describedby`; an error summary that takes focus;
focus-trapped dialogs that make the page `inert` and restore focus;
`aria-live` counts for filters; video only on request, with captions on.
`tests/e2e/a11y.spec.ts` runs axe (WCAG 2.2 A/AA plus best practices) on
every route and fails on any violation.

## Forms and delivery

The speaking enquiry, contact and newsletter forms post to Server Actions,
are validated with Zod on the server, and have a honeypot and a per-IP rate
limit. They deliver JSON to webhooks you configure (`.env.example`),
HMAC-signed when `WEBHOOK_SIGNING_SECRET` is set. A success message appears
only when delivery succeeded. The speaking confirmation always says it is
not a booking. Logs carry field names, never personal data.

The rate limiter is in memory, so it is per instance. On serverless or
multi-instance hosting, back it with a shared store (Upstash Redis or the
host's limiter).

## Bookings and payments

Events can take bookings on the site. Each event's `booking` field
(`src/content/types.ts`) sets the seat name, the price per seat in US cents,
the most seats per order and whether booking is open. An event with an
outside `ticketUrl` keeps sending people there instead.

- **Price decides the flow.** A price → card payment through **Stripe
  Checkout**. `0` → free registration. `null` → the price is not confirmed,
  so the form sends a booking request and nobody is asked to pay. Prices are
  never estimated, and the form never sends one: the server reads it from the
  event record.
- **The form** (`components/booking/BookingForm.tsx`) is one page: seats,
  details, confirm, with the order summary beside it on wide screens. The
  seat stepper keeps focus at its limits; the total rolls in the direction of
  the change on a critically damped spring (cross-fade with reduced motion).
  It is a real form posting to a Server Action, so it also works without
  JavaScript.
- **Paying.** The action (`app/bookings/actions.ts`) re-checks everything, sends
  the full details to the team (`BOOKING_WEBHOOK_URL`) with a reference such as
  `MG-7KQ2-H9TX`, then opens a Checkout Session and redirects to Stripe's
  hosted page. Card details never reach this site, and names, phone numbers
  and access needs never go into Stripe metadata; the reference ties the two
  together. Sessions use an idempotency key, so a double-submit cannot open
  two checkouts.
- **After payment.** `/bookings/confirmed` asks Stripe for the session and
  says "Payment received" only when Stripe reports it paid.
  `/api/stripe/webhook` verifies Stripe's signature (HMAC-SHA256, 5-minute
  replay window) and records settled payments; if recording fails it answers
  500, so Stripe retries. Receivers should de-duplicate on `stripeEventId`.
- **Guard rails.** Checkout stays off without `STRIPE_SECRET_KEY`. A live key
  works only in production **and** with `PAYMENTS_LIVE_APPROVED=true`, set
  with the owner's written approval; a test key is refused in production;
  production also needs a booking destination. While checkout is off,
  production shows "Send booking request" instead of a Pay button; preview
  keeps the Pay button so the flow can be reviewed, and stops before Stripe
  with "nothing was charged" and an offer to send a request instead. `/review`
  shows the current state.
- **Demo data.** Two upcoming demo events take bookings: free registration
  and a $100.00 **demo price**, labelled as such wherever it appears. Like
  all demo records, they do not exist in production.
- **Not included yet:** seat inventory (capacity is not enforced; it needs a
  database), refunds from the site (handled in the Stripe dashboard), tax,
  discount codes and booking emails sent by the site (the team's webhook
  receiver or Stripe's receipts handle confirmation emails).

To try paid checkout end to end, set a Stripe **test** key and run
`stripe listen --forward-to localhost:3000/api/stripe/webhook` for the webhook
secret.

## Book cart

Books can be bought on the site through a cart. Each book's `shop` field sets
its price per copy (US cents) and the most copies per order.

- **Prices.** `priceCents` comes from the authorised price list and is null
  until then, so production keeps the official purchase link and shows no
  cart at all. The two active books carry a `demoPriceCents` of $20.00 that
  only preview uses, labelled "Demo price" wherever it appears. Mock-up
  covers stay labelled in the cart ("Placeholder cover").
- **The cart** lives in the visitor's browser (`localStorage`, synced across
  tabs) and holds slugs and quantities only. "Add to cart" confirms beside
  the button with a link to the cart; the bag in the header counts the books
  and its badge pops when one is added. `/cart` has a quantity picker and
  Remove for each line, the subtotal, and Clear cart. Clearing has no "are
  you sure?"; instead, Undo is offered for ten seconds.
- **Checkout** (`app/cart/actions.ts`) rebuilds the order from the server's
  catalog, so a price cannot be changed in the browser, and refuses a cart
  that no longer matches it. It sends the order to `ORDER_WEBHOOK_URL`
  (falling back to the booking, then the enquiry webhook), then opens Stripe
  Checkout with one line per book, US address collection (`SHOP_SHIP_TO`) and
  the shipping rate in `STRIPE_SHIPPING_RATE_ID`. Production refuses book
  checkout without a shipping rate.
- **After payment.** `/orders/confirmed` asks Stripe and thanks the buyer only
  when the order is paid, then empties the cart. The webhook records the paid
  order with the delivery address the team ships to. A cancelled checkout
  returns to `/cart` with the cart untouched and says nothing was charged.
- **Not included yet:** stock levels, sales tax (Stripe Tax can be switched
  on), discount codes, digital editions and refunds from the site.

## Payment step in preview

Until a Stripe key is set, Check out (cart) and Continue to payment (paid
event seats) lead to `/checkout/demo`, a stand-in for Stripe's hosted page,
so the whole journey can be reviewed: contact, delivery address (books
only), card, Pay, a short processing pause, and a confirmation with the
reference. Event bookings are still validated and recorded by the server
first; the cart empties after a paid demo order.

It cannot take a payment. Only Stripe's published test cards are accepted
(4242 4242 4242 4242 succeeds; 4000 0000 0000 0002 declines; 4000 0000 0000
9995 fails for insufficient funds); any other number, real or not, is
refused. The card fields have no `name`, the form has no action, and nothing
typed is stored or sent. Card numbers are grouped as typed and the brand is
shown; errors appear by the field once it is left, and all together on Pay.
Production answers 404 for the page and never links to it; with a Stripe
key set, checkout goes to Stripe instead. The rules live in
`lib/demo-payment.ts` (unit-tested) and are ported to the single-file export,
where the same journey works offline.

## Single-file export

`npm run export:html` writes `dist/myron-golden-site.html`: every page of the
site in one self-contained file (about 3.5 MB) that opens from disk with no
server. It is built from the real pages, not a mock-up:

- The production build is started and every page is captured with JavaScript
  off, so the file holds exactly the server-rendered HTML. Each page becomes a
  `<template>`; a small hash router (`#/about`, `#/programs/…`) shows one at a
  time. Internal links, anchors and `?topic=` links are rewritten to match.
- Styles and fonts are inlined. The images are embedded once each as WebP
  (1280px wide, 1600px for the wide heroes).
- `scripts/standalone/runtime.js` re-creates the interactions without React:
  the menu sheet and photo viewer (same spring physics, flick projection and
  rubber-banding as the site), event and library filters, search over an
  embedded index, the video facade, copy buttons and the hero parallax. The
  month calendar view is omitted; the list carries every event.
- Forms cannot send from a file. They validate, then say plainly that nothing
  was sent; the booking form says no seats were booked and nothing was charged.
  The book cart works in the file (add, change, remove, clear and undo, kept
  in the browser), and Check out explains that no payment was taken.
  Its seat stepper and total work as on the site.
- Sections Next.js streams behind `<Suspense>` arrive as a hidden block that
  a script swaps in. Capture runs with scripts off, so the export makes the
  same swap itself; without it, those sections would export as loading
  placeholders.
- **Metadata.** The `<head>` carries the title, description, canonical URL,
  Open Graph and Twitter cards, robots (`noindex` for a preview build), theme
  colour, icon, generator, date and commit, plus Person, Organization,
  WebSite and Book structured data. `#mg-site-metadata` embeds the review
  trail as JSON: every record's source, review date and outstanding
  confirmations; the asset register with alt text, rights and approval
  status; social accounts; the page list; and the search index. The same
  JSON is served at `/site-metadata.json` in preview.

Pass `--site-url https://the-final-domain` to set the canonical and social
image URLs (default: `NEXT_PUBLIC_SITE_URL`, then `https://myrongolden.com`).
CI builds the file, checks it and keeps it as a workflow artifact.

## Known issues

- Fixed in this round: every form accepted a submission with its consent box
  unticked. An unticked checkbox sends no field at all, and Zod 4 skips
  refinements on absent optional keys, so `.optional().refine()` let it
  through. Consent is now a required enum, with a regression test that posts
  each form without the field.
- `npm audit` reports five high-severity advisories, all one chain in
  development tooling: `eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces` (stack exhaustion on deeply nested
  glob patterns). No patched `braces` exists, and npm's suggested fix is a
  downgrade to Next 14's lint config. It runs only at lint time on this repo's
  own patterns; production dependencies have no advisories.
- Automated contrast checks run on page load without scrolling can flag a few
  elements near the bottom of the viewport: they are mid-way through the
  scroll-driven reveal, so partly transparent. Scrolled into view they pass,
  and with reduced motion they never fade. `tests/e2e/a11y.spec.ts` audits
  with reduced motion for that reason.

## Ready vs requires owner credentials or approval

| Area                                                                | State                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pages, navigation, search, filters, calendar, gallery, video facade | **Ready** (preview data)                                                                                       |
| Forms (validation, spam, rate limit, states)                        | **Ready**. Delivery needs webhook URLs, plus a shared rate-limit store for multi-instance hosting              |
| Email list / CRM                                                    | Needs the owner's ESP or CRM and a webhook; double opt-in is configured there                                  |
| Analytics                                                           | Needs `NEXT_PUBLIC_GA_ID`; consent banner and events are wired, off until set                                  |
| Member portal                                                       | Needs `NEXT_PUBLIC_MEMBER_PORTAL_URL`                                                                          |
| Event bookings and payments                                         | **Ready** in preview and Stripe test mode. Live payments need a Stripe account, owner approval and real prices |
| Book cart and checkout                                              | **Ready** in preview with demo prices. Needs confirmed prices per copy and a Stripe shipping rate              |
| Program checkout                                                    | Not on this site, by design: every program hands off to its official platform                                  |
| CMS                                                                 | Content model ready; CMS choice and accounts needed                                                            |
| Events                                                              | All six are demo fixtures; needs the authorised calendar                                                       |
| Learning library                                                    | All eight are demo fixtures; needs official video IDs, dates and transcripts                                   |
| Social links                                                        | TikTok `@myrongoldenofficial` confirmed; YouTube, Instagram, Facebook, X and LinkedIn hidden until confirmed   |
| Legal pages                                                         | Placeholders that link to the official policies; need approved text                                            |
| Logo                                                                | A typeset wordmark stands in for the official logo                                                             |

## Launch checklist

From the brief's §13 and its owner sign-off table. `/review` lists the
record-level detail.

- [ ] Approve brand direction, palette, type and motion
- [ ] Approve biography, speaker introduction and any credentials or claims
- [ ] Supply exact book covers, confirm synopses, formats, ISBNs and purchase URLs
- [ ] Confirm each program's status, inclusions, price display and destination
- [ ] Supply verified events (dates, time zones, venues, tickets, refund terms)
- [ ] For each event booked on the site: confirm price per seat, seats per order and refund terms
- [ ] For each book sold on the site: confirm the price per copy and copies per order; create the Stripe shipping rate
- [ ] Payments: Stripe account in the owner's name, test-mode run-through, webhook endpoint and secret, written approval, then `PAYMENTS_LIVE_APPROVED=true` with the live key
- [ ] Replace or approve every concept image; obtain likeness and rights sign-off
- [ ] Supply approved testimonials with written consent, if any
- [ ] Confirm the remaining social accounts
- [ ] Supply privacy, terms, cookie, refund and disclosure documents
- [ ] Configure webhooks, analytics, member portal URL and a shared rate-limit store
- [ ] Set `NEXT_PUBLIC_SITE_MODE=production` and the final `NEXT_PUBLIC_SITE_URL`; build
- [ ] Run `npm run verify`, `npm run test:e2e`, `npm run screenshots`, Lighthouse and schema validation
- [ ] Submit the sitemap in Search Console after launch
