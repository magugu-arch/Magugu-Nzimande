# Tashas guest app

A working, PWA-first build of the Tashas guest app from the development brief
(`docs/BRIEF.md`): café discovery, menu, table booking with deposits, rewards,
notifications with consent, campaigns, and a staff operations dashboard. It
lives in its own package beside the bb.q Chicken app in this repository and
shares nothing with it.

**Everything runs against clearly labelled sandbox providers.** No table is
reserved at a café, no money moves and no message is sent. Café details, menu,
prices, events, reward rules, policies and message wording are sample content,
marked as such in the UI, until Tashas supplies approved data. The 28 supplied
photographs are the only imagery used.

## Quick start

```bash
cd tashas
npm install
npm test          # 85 domain tests (node:test, no browser needed)
npm run build     # verifies the originals, derives images, writes the app
open release/tashas-app.html
```

Node 22.18 or later (type stripping is used to run the TypeScript tests
directly). The build also needs Python 3 with Pillow, as the repository's other
image scripts do.

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm test` | Domain test suites in `test/` |
| `npm run assets:verify` | Checks all 28 originals against the manifest (size and SHA-256) |
| `npm run assets:derive` | WebP derivatives of the originals into `build/derived/` |
| `npm run build` | `release/tashas-app.html`, `build/artifact.html` and `build/pwa/` |
| `npm run qa` | Playwright pass at phone, Android, tablet and desktop, light and dark: overflow, console errors, both booking paths, gestures, 28 images, offline download |
| `npm run verify` | typecheck → test → build → qa |

## What you get

- **`release/tashas-app.html`** (about 3 MB): the whole app in one file, with
  the app code, styles, the display font and all 28 images inline. It opens
  offline from disk. The app's own **Download HTML** button rebuilds exactly
  this file from the running page.
- **`build/pwa/`**: the same app plus a web manifest, service worker and icons,
  for hosting on a stable HTTPS domain, where it can be installed on iOS and
  Android. A local file is never installable, and the app does not claim it is.
- **`assets/originals/`**: the 28 supplied JPEGs, unchanged, with
  `assets/Tashas_28_Image_Asset_Metadata.json` as the source of truth.
  `assets/handover/Tashas_28_Image_Asset_Library.html` is the supplied gallery,
  kept as the companion handover tool.

## How it is built

TypeScript throughout. `src/domain/` is framework-free and holds every business
rule; `src/web/` is a Preact UI that calls it; `src/content/` is the CMS seam
for branch, menu, event, campaign and reward data. A future Next.js site, an
Expo build or a Node API imports the same domain code. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the module map, state
machines, API mapping and PostgreSQL schema.

In this build the domain runs in the browser as a sandbox: an in-memory
database with UNIQUE constraints and transactional rollback, snapshotted to
`localStorage`, with a queue runner standing in for background workers. In
production the same services run on the server behind the API in brief §13.10
and only the provider adapters change.

### Booking, payment and messaging, end to end

- Availability comes from the reservation provider and is re-checked before a
  slot is held and again before confirmation. Holds expire; a lapsed hold is
  renewed only if the table is still free.
- Deposits are computed on the server from the café's current policy, in ZAR
  cents. A changed policy makes the guest review again.
- Payment goes through a hosted checkout. The return URL is ignored; only a
  signed, deduplicated webhook or the gateway's status API can mark a payment
  successful.
- A timeout after the provider saved the booking is reconciled by idempotency
  key before anything is retried or reported. A paid deposit with no table
  enters reconciliation, alerts staff and tells the guest the truth; staff
  retry or refund (or the setting refunds automatically).
- Change, cancel and waitlist follow the café's policy, with top-ups and
  partial refunds of the deposit difference.
- Visit outcomes arrive only as signed provider webhooks; points are earned
  from them once, however often they are delivered.
- Every committed change publishes a domain event through an outbox; consumers
  are idempotent, retry with backoff and dead-letter after five attempts.
- Notifications decide per channel at send time: preferences, per-channel
  marketing consent (wording, version, source, time), the suppression list,
  frequency caps, quiet hours and open service issues. Service messages never
  depend on marketing consent. Email and push are sandbox adapters; SMS and
  WhatsApp are switched off until approved.
- Campaigns need a second person's approval, preview their audience with the
  same rules the send applies, and report observed delivery, opt-outs and
  attributed bookings. UTM attribution survives landing page → booking →
  payment without personal data in any URL.

### Trying the failure paths

The booking review step has a **Sandbox: simulate a provider problem**
disclosure, and **Operations → Sandbox** (as Administrator) has the full set:
timeouts, a stolen slot, refusal after payment, an outage, duplicate or lost
webhooks, email failures, automatic refunds, and a clock you can move forward
to fire reminders, expiries and scheduled campaigns. Switch staff roles at the
top of Operations to see permissions enforced.

## Download, share and WhatsApp

- **Download HTML** saves `tashas-app.html`. Inside the Claude artifact viewer
  it uses the viewer's downloads capability; elsewhere it is a normal browser
  download.
- **Share** uses `navigator.share` with file sharing where the platform
  supports it, and says so plainly where it does not.
- **WhatsApp** shares a link only when the app has a public HTTPS address
  (set it in Operations → Sandbox once deployed, or it is detected when the
  app is served over HTTPS as its own page). Opened from a file or a preview
  frame, it explains that no shareable link exists and offers the download.

## Deploying

1. `npm run build`.
2. Upload `build/pwa/` to a static HTTPS host (any CDN or object store with
   HTTPS). Serve `index.html` with `Cache-Control: no-cache` so updates reach
   people; the service worker caches the shell for offline use.
3. Set the public address in Operations → Sandbox so WhatsApp shares it.
4. `robots.txt` blocks indexing on purpose. Remove it only once content is
   approved and the canonical domain is decided (brief §8).

**Rollback:** redeploy the previous `build/pwa/` folder. The service worker
cache name includes the build time, so the older version replaces the newer
one on next load.

Moving from sandbox to live means implementing `ReservationProvider` and
`PaymentProvider` for the chosen providers on a server, plus the email and push
adapters; the brief's credentials checklist is in Profile → About and in
Operations → Sandbox, and summarised below.

## Marketing strategy deck

`release/Tashas_App_Marketing_Strategy.pdf` is a 24-page presentation of what
the app does for the business, how it works as its own marketing channel, the
launch plan and three investment options. Its source is `marketing/deck.html`.
The page is built from the supplied photography (`marketing/img/`) and from
screens of this app (`marketing/shots/`).

```bash
npm run build                    # the app the screens come from
node marketing/capture.mjs       # refresh marketing/shots/
node marketing/build-deck.mjs    # write the PDF; --preview <dir> also saves PNGs
```

The deck loads Exo 2 from Google Fonts, so building it needs network access.
Its prices, rand figures and the break-even table are proposals and
illustrations, labelled as such in the deck. They are not Tashas data.

## Still needed from Tashas and its providers

1. Reservation provider: contract, café coverage, availability, hold, create,
   amend, cancel and waitlist APIs, webhook signing, rate limits, sandbox access.
2. Payment gateway: merchant account, methods, hosted checkout or SDK, webhook
   verification, refunds, settlement exports, disputes, sandbox access.
3. Deposit, cancellation, no-show and refund policies per café.
4. Email and push providers and sender identities; SMS/WhatsApp providers,
   senders and approved templates if wanted.
5. Rewards policy: earning, rewards, tiers, expiry.
6. Privacy notice, consent wording, retention periods and POPIA sign-off.
7. Verified café data (addresses, phones, hours, Google Business Profile links,
   "Inspired By" stories) and which supplied interiors may represent which café.
8. Approved menus per café with verified dietary and allergen information.
9. Maps and analytics access, and a stable HTTPS domain.

## Honest limits of this build

- It is a single-page app. Brief §8 asks for server-rendered, crawlable branch
  pages with LocalBusiness JSON-LD, sitemaps and canonical URLs; those need the
  approved branch data and a real domain, so they are not generated here, and
  the build is marked `noindex`.
- Ordering, gift-voucher purchase and referrals are not built: the brief makes
  them conditional on Tashas confirming support. The UI says so where they would
  appear.
- The map is a schematic of South Africa; a live map needs a maps provider key.
- The domain tests cover the acceptance list in brief §13.15 against the
  sandbox adapters. Contract tests against real providers come with the real
  adapters.
- Privacy and consent wording, templates and policies are samples for review,
  not legal text.
