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

| Script                | Does                                                                     |
| --------------------- | ------------------------------------------------------------------------ |
| `npm run dev`         | Development server                                                       |
| `npm run build`       | Production build                                                         |
| `npm start`           | Serve the production build                                               |
| `npm run verify`      | Typecheck, lint, formatting and unit tests — run before every push       |
| `npm run test:e2e`    | Playwright against a production build (`npm run build` first)            |
| `npm run screenshots` | Every route at 360–1920px into `.screenshots/`; fails on sideways scroll |

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
  app/            routes, server actions (actions.ts), sitemap, robots
  proxy.ts        real 404s for unknown slugs (see below)
  components/     layout, cards, forms, media (Photo, Gallery, Parallax, VideoFacade), ui
  content/        typed records — the CMS-ready content model
  lib/            data access, events, search, validation, delivery, motion physics, SEO
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

**Proxy.** With Partial Prerendering the static shell is sent before a page
can call `notFound()`, which would make unknown slugs a "soft 404" (right
content, 200 status). `src/proxy.ts` checks slugs against the same data layer
first, so they get a real 404.

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

## Ready vs requires owner credentials or approval

| Area                                                                | State                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pages, navigation, search, filters, calendar, gallery, video facade | **Ready** (preview data)                                                                                     |
| Forms (validation, spam, rate limit, states)                        | **Ready**. Delivery needs webhook URLs, plus a shared rate-limit store for multi-instance hosting            |
| Email list / CRM                                                    | Needs the owner's ESP or CRM and a webhook; double opt-in is configured there                                |
| Analytics                                                           | Needs `NEXT_PUBLIC_GA_ID`; consent banner and events are wired, off until set                                |
| Member portal                                                       | Needs `NEXT_PUBLIC_MEMBER_PORTAL_URL`                                                                        |
| Payments / checkout                                                 | **Not built, by design.** Every offer hands off to its official platform                                     |
| CMS                                                                 | Content model ready; CMS choice and accounts needed                                                          |
| Events                                                              | All six are demo fixtures; needs the authorised calendar                                                     |
| Learning library                                                    | All eight are demo fixtures; needs official video IDs, dates and transcripts                                 |
| Social links                                                        | TikTok `@myrongoldenofficial` confirmed; YouTube, Instagram, Facebook, X and LinkedIn hidden until confirmed |
| Legal pages                                                         | Placeholders that link to the official policies; need approved text                                          |
| Logo                                                                | A typeset wordmark stands in for the official logo                                                           |

## Launch checklist

From the brief's §13 and its owner sign-off table. `/review` lists the
record-level detail.

- [ ] Approve brand direction, palette, type and motion
- [ ] Approve biography, speaker introduction and any credentials or claims
- [ ] Supply exact book covers, confirm synopses, formats, ISBNs and purchase URLs
- [ ] Confirm each program's status, inclusions, price display and destination
- [ ] Supply verified events (dates, time zones, venues, tickets, refund terms)
- [ ] Replace or approve every concept image; obtain likeness and rights sign-off
- [ ] Supply approved testimonials with written consent, if any
- [ ] Confirm the remaining social accounts
- [ ] Supply privacy, terms, cookie, refund and disclosure documents
- [ ] Configure webhooks, analytics, member portal URL and a shared rate-limit store
- [ ] Set `NEXT_PUBLIC_SITE_MODE=production` and the final `NEXT_PUBLIC_SITE_URL`; build
- [ ] Run `npm run verify`, `npm run test:e2e`, `npm run screenshots`, Lighthouse and schema validation
- [ ] Submit the sitemap in Search Console after launch
