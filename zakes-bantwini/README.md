# Zakes Bantwini — The Architect

The official digital headquarters for Zakes Bantwini: music, film, live, bookings, story and legacy. Built to the *Zakes Bantwini Website Build Brief + Claude Code Directive* and its 41-image set.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · CSS Modules · Motion · Zod · Postgres · Vitest · Playwright.

```bash
cd zakes-bantwini
npm ci
cp .env.example .env.local      # set APP_SECRET and ADMIN_BOOTSTRAP_* at least
npm run dev                     # http://localhost:3000 (encodes image derivatives first)
```

Without `DATABASE_URL`, development uses a JSON file in `.data/` and the no-money sandbox payment gateway, so the whole booking journey works locally with nothing else installed. `npm run seed:demo -- --reset` fills it with sample bookings at every stage and one account per role (`owner@example.com`, `manager@example.com`, `viewer@example.com`; password `demo-password-change-me` unless `DEMO_PASSWORD` is set).

**Status:** see [`AUDIT.md`](AUDIT.md) (≈ 67 % of the way to launch; the rest is mostly management's content, accounts and legal sign-off) and [`COSTING.md`](COSTING.md) (market cost to build, to finish and to run). An offline, single-file preview of the whole site is in [`preview/`](preview/).

---

## What is built

| Area | Routes | Notes |
| --- | --- | --- |
| Home | `/` | The brief's ten sections: hero (image 06, masked type), three gates, story, pinned horizontal catalogue, live + private booking, The Architect, five pillars as interactive chapters, Handover, stories, final calls to action. |
| Music | `/music`, `/music/[album]` | Catalogue rail, typographic sleeves until approved artwork exists, tracklist, credits, streaming links, related films and stories. A persistent mini-player (play / pause / previous / next / volume / open) survives navigation. |
| Videos | `/videos`, `/videos/[slug]` | Cinematic grid; player with keyboard controls (Space/K, F, M, C, ←/→) and caption tracks, or a privacy-enhanced YouTube embed loaded only on play. |
| Live | `/live`, `/live/[event]` | Public shows from the admin only (none are seeded — no invented dates) with `MusicEvent` structured data; separate private/corporate booking path. |
| Book Zakes | `/book`, `/book/request` | Live availability calendar (accessible, keyboard-navigable), the 12-step process, and a five-step request wizard: date → event → location and travel → contact and brief upload → review. |
| Client portal | `/book/confirmation/[token]`, `/book/quote/[token]` | My booking, status timeline, quote, agreement signing, deposit and balance payments, documents, notifications, contact. Private, unguessable, never indexed. |
| Story, Architect, Handover | `/story`, `/architect`, `/handover` | Editorial chapters; Architect carries the five pillars with anchors; Handover is chapter-based scroll storytelling. No retirement is stated or implied. |
| Journal | `/journal`, `/journal/[slug]` | Music, Culture, Live, People, Studio, Legacy. |
| Press / EPK | `/press` | Short and long bio, original-resolution press photos, discography, performance information, rider (on request until supplied) — downloads tracked. |
| Collaborate, Community | `/collaborate`, `/community` | Structured proposal form; email + optional WhatsApp signup with explicit consent, the exact wording stored per person. |
| Admin | `/admin` | Dashboard, bookings (CSV export), booking detail (status, holds, quote editor, agreement, payments, documents, notes, notifications, audit trail), month/week/day calendar with date blocking, public events, inbox (proposal triage, consented community export), content management, asset library, team. |

SEO: per-page metadata, canonical URLs, Open Graph/X cards (1200×630 crops generated from the masters), `Person`, `Organization`, `MusicAlbum`, `MusicRecording`, `VideoObject` (only for videos with a real source and date), `MusicEvent`, `Article`; `sitemap.xml`; `robots.txt` (indexing is opt-in via `ALLOW_INDEXING=true`).

---

## The 41 images

`assets/masters/IMG_6848 … IMG_6888` are the supplied files, byte for byte, in the order received — checked against the contact sheet inside the brief: all 41 match their positions. `npm run images` encodes AVIF and WebP derivatives (never upscaled) plus blur placeholders and share cards into `public/media/` (gitignored) and writes `src/content/media.manifest.json` (committed). It runs before `dev` and `build`.

`src/content/media.ts` is the image registry and CMS media library: alt text, focal point (desktop and mobile), default desktop/mobile ratios, overlay, hover and priority for every image, plus its role and sections. Components only ever ask for an image by id.

**Things to know about the set**

- **Four rows of the brief's §08 text matrix describe a different picture from the file at that position.** Placement follows what each image shows:
  - 23 / IMG_6870 is a console session with two collaborators, not “reviewing physical archive”. Used for the Label and studio story.
  - 29 / IMG_6876 is the mood-board collaboration. It leads Collaborate.
  - 38 / IMG_6885 is the modern creative environment. It sits with The Architect.
  - 39 / IMG_6886 is the walking-away image. It closes the Handover and the footer.
- **37 of the 41 masters are 1080px wide.** Only 06, 26, 32 and 33 are 2K+. Full-bleed placements upscale on large screens, so please request the original files.
- **Images 21 and 27 contain generated lettering** on record sleeves and posters. Keep those areas out of tight crops, and replace them with documentary archive photography when it exists.
- The brief names 06, 26, 32 and 33 as `.jpeg`; they arrived as PNG and are kept as received.

---

## Content and approval

All copy and catalogue data are typed, Zod-validated collections behind async getters (`src/content/index.ts`). The designed starting content is the seed in `src/content/seed/`; **management edits it in the admin** (`/admin/content`), and each saved entry is stored in `content_entries` and laid over the seed entry by entry (`src/content/overlay.ts`). In the admin, management can:
- edit any release, video, story, pillar, the press kit and site settings;
- add new releases, videos and stories;
- hide or restore an entry, or revert it to the original;
- upload cover art, audio previews, caption files and the rider to the asset library (`/assets/[id]/[name]`, public, cached forever, byte ranges for audio).

Saving republishes the affected pages. Without a database, for example on a build machine, the seed alone renders. `npm run content:schema` exports the model as JSON Schema (`content-model.schema.json`).

Every entry has `approval: approved | pending | placeholder`.

- **Nothing factual was invented.** Release titles, years, artwork, tracklists, video sources, event dates, awards, press quotes, social links and contact addresses are slots or designed empty states. The journal, pillar and biography copy is written to the brief's positioning, without biographical claims or attributed quotes, and is marked *pending*.
- Unapproved content shows a small dashed marker in review builds.
- `CONTENT_PUBLISH_APPROVED_ONLY=true` is launch mode: only approved entries render and lists fall back to their empty states. It is read at build time.
- `npm run content:audit` lists everything awaiting management. With `--strict` it fails while anything is unapproved.

Default cancellation terms on quotes, and the privacy notice, are templates for management's legal adviser.

---

## Booking engine

```
NEW → IN_REVIEW → (ON_HOLD) → QUOTE_SENT → AWAITING_DEPOSIT → CONFIRMED → COMPLETED
                                         ↘ changes requested → IN_REVIEW        (CANCELLED from any open state)
```

- **References** are `ZB-YYYY-XXXX`, from an atomic per-year counter.
- **Client access** is a 256-bit link derived as HMAC(`APP_SECRET`, booking id). Only its SHA-256 is stored, so a database leak leaks no working links. The reference alone grants nothing.
- **Availability** states are AVAILABLE, ON_HOLD, CONFIRMED, TRAVEL and UNAVAILABLE. The public calendar and `/api/availability` expose only *available / limited / unavailable / past*. A confirmed show, a travel day and a blackout all read “unavailable”.
- **Calendar sync**: a sent quote holds the date, and confirmation blocks it. Dates held by a booking can only change through that booking, so the calendar and the booking never disagree.
- **Quotes** are in integer cents, with VAT on the subtotal. Deposit plus balance always equals the total, which the database also checks.
- **Acceptance** issues the performance agreement automatically. It is frozen text with a hash, signed by typed name, consent and timestamp, plus a keyed hash of the IP.
- **Payment never confirms a booking.** Management confirms, and only with a signed agreement and a received deposit. An owner can override, with a recorded reason.
- **Audit trail**: every change is written to `audit_log`.
- **Daily job** (`/api/cron/reminders`, scheduled in `vercel.json`): releases expired holds, sends balance reminders 7 and 1 days before the due date, and event reminders 14 and 2 days before the event.

### Payments — `src/lib/payments/`

`PaymentProvider` keeps the UX independent of the gateway.

- **PayFast** is implemented: signed checkout, plus ITN verification covering signature, source IP, amount and the server-to-server `validate` call. The webhook is `POST /api/payments/payfast/notify`.
- **Peach Payments** is a seam that fails loudly. Implement it against Peach's current API once there is a merchant account.
- **Sandbox** takes no money. It is the development default, and refused on production builds unless `ALLOW_SANDBOX_PAYMENTS=true`.
- Card data never touches this site, and secrets stay server-side.
- **Before go-live**, run a full deposit through PayFast's sandbox (`PAYFAST_SANDBOX=true`) with the real merchant credentials. This build was verified end to end only with the sandbox gateway.

### Notifications — `src/lib/notifications/`

Event-driven: enquiry received, quote ready/accepted, contract ready/signed, deposit requested/received, balance received, payment failed, booking confirmed, balance and event reminders.

- Email goes through Resend.
- SMS goes through Twilio, when configured.
- WhatsApp goes through the Meta Cloud API, only with the client's opt-in, using approved templates named `zb_<event>`.
- Management gets copies at `BOOKINGS_INBOX_EMAIL`.
- Unconfigured channels log instead of sending. Every attempt is recorded on the booking, and failures never undo a booking step.
- The provider adapters follow each API's documented request format but have not been exercised against live accounts here. Send a test of each before launch.

---

## Deployment (Vercel + Supabase)

1. Create a Supabase project. Copy the Postgres connection string (add `?sslmode=require`) and create a **private** storage bucket `booking-documents`.
2. Run `DATABASE_URL=… npm run db:migrate` to apply `db/migrations/*.sql`.
3. In Vercel, create a project with **root directory `zakes-bantwini`** and set the variables from `.env.example`. Required:
   - `NEXT_PUBLIC_SITE_URL`
   - `APP_SECRET`
   - `DATABASE_URL`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - `PAYMENTS_PROVIDER` plus that provider's keys
   - `RESEND_API_KEY` and `EMAIL_FROM`
   - `BOOKINGS_INBOX_EMAIL`
   - `CRON_SECRET`
   - `ALLOW_INDEXING=true` (production only)
4. Create the first owner. Either set `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD`, sign in once at `/admin`, then delete both variables. Or run `DATABASE_URL=… npm run admin:create -- you@domain "Your Name" owner`.
5. Set PayFast's notify URL to `https://<domain>/api/payments/payfast/notify` (it is also sent with every checkout).
6. Before launch, approve the content and build with `CONTENT_PUBLISH_APPROVED_ONLY=true`, or confirm `npm run content:audit -- --strict` passes.

Other hosts work too: `npm run build && npm start` on Node 20.9+. Use Postgres (not the file store) wherever more than one instance runs.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js (image derivatives are encoded first) |
| `npm run verify` | typecheck, lint, unit tests, content audit, production build |
| `npm test` | Vitest: quote maths, status machine, calendar privacy, PayFast signatures, auth, store contract, and the full booking journey. With `TEST_DATABASE_URL` set, store and journey suites also run against Postgres. |
| `npm run smoke` | After `build`: real browser against `next start`. The booking journey (with brief upload) end to end; the menu, community and collaboration forms, proposal triage, a listing reaching /live, CMS edits and cover art reaching the site, CSV export, team accounts, security headers; then every page at 320/390/1440 px (overflow, console errors, axe WCAG 2.1 AA, the designed 404). Screenshots go to `.smoke/`. Set `DATABASE_URL` to run it on Postgres. |
| `npm run perf` | After `build`: each key page cold at 390 px over Slow 4G with a 4× slower CPU; fails above LCP 4 s, CLS 0.1 or the page-weight budget. Writes `.smoke/perf.json`. |
| `npm run seed:demo` | Sample bookings at every stage, listings, signups, proposals and one account per role. Refuses production and non-local databases. |
| `npm run preview:build` | With a production server running (`PREVIEW_BASE_URL`), writes the single-file offline preview to `preview/`. |
| `npm run content:audit` | What still needs management (`--strict` to gate launch) |
| `npm run content:schema` | Export the content model as JSON Schema |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run admin:create` | Create or reset a management account |
| `npm run images` | Encode image derivatives (`-- --force` to redo all) |

---

## Security notes

- Admin passwords are hashed with scrypt.
- Admin sessions are HMAC-signed, HTTP-only cookies lasting eight hours, bound to the password hash: changing a password signs every session out.
- `src/proxy.ts` gates `/admin`, and every admin page and action re-checks the session against the database.
- Roles: owner, manager, viewer (read-only).
- Login is rate-limited per address and per account. Booking and form endpoints are rate-limited per IP and carry a honeypot field.
- These limits are per server instance. Add edge rules (Vercel Firewall or Cloudflare) when scaling out.
- Uploads are checked by type, size and magic bytes, stored privately, and served only to admins or to the owning client.
- Client pages, quotes and admin send `no-store` and `noindex`.
- Security headers are set in `next.config.ts`, including a production Content-Security-Policy. Uploaded public files carry their own sandboxed CSP.
- Links entered in the admin must be `http(s)`; `javascript:` and `data:` URLs are rejected.
- Every booking step runs in a database transaction, and client messages go out only after it commits.
- CSV exports neutralise spreadsheet formulas and are recorded in the audit log.
- Owners manage the team. One-time passwords are shown once, and the last owner can never be removed or demoted.

## Structure

```
assets/masters/        the 41 supplied images (originals)
db/migrations/         Postgres schema
e2e/                   browser smoke test, mobile performance test, fixtures
preview/               single-file offline preview of the site
scripts/               images, content audit/schema, migrations, admin accounts
src/app/(site)/        public site
src/app/admin/         management workspace
src/app/api/           booking, availability, payments, cron, documents
src/components/        UI, media, motion, player, video, booking, admin
src/content/           content model, seed content, media registry
src/lib/               booking domain, store, payments, notifications, storage, auth, analytics, SEO
tests/                 unit and integration tests
```
