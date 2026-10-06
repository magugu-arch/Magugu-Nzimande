# Completion audit: Zakes Bantwini, "The Architect"

As of **6 October 2026**, branch `claude/zakes-bantwini-website`. Measured against the build brief's
pages, deliverables and **§11 Build acceptance checklist**.

## Headline

| | |
| --- | --- |
| **Overall, to a launched site** | **≈ 67 % complete. ≈ 33 % of the work remains.** |
| Development work (developer hours) | ≈ 88 % done: about 1,040 hours built, about 140 hours left |
| Remaining work that needs the developer | ≈ 16 points of the 33: deployment, live integrations, real-device QA, UAT |
| Remaining work that needs management | ≈ 17 points of the 33: approved content and media, legal sign-off, accounts |

The software is built and tested. What stands between it and launch is mostly not code:
- approved content
- live accounts (hosting, database, payment gateway, email domain)
- legal review of the booking terms
- a round of testing with management

## How the percentage is worked out

Each stream is weighted by its share of the effort needed to reach a launched site.

| Stream | Weight | Done | Contributes | What is done / what remains |
| --- | ---: | ---: | ---: | --- |
| **Product build** (design, front end, booking engine, admin, CMS, data, security, automated tests) | 60 | 96 % | 57.6 | **Done:** all 20 routes; the full booking engine; admin; CMS; 86 unit/integration tests on two databases; browser smoke test; mobile performance budget. **Remains:** fixes from real-device testing, a shared rate-limiter for multi-server hosting, error monitoring. |
| **Integrations & deployment** | 10 | 20 % | 2.0 | **Done:** PayFast, Resend, Twilio and WhatsApp adapters and the sandbox gateway are built and tested end-to-end. **Remains:** Vercel and Supabase projects, domain and DNS, email-domain verification, live PayFast credentials and ITN test, WhatsApp template approval. |
| **Content & media** (management-supplied) | 15 | 10 % | 1.5 | **Done:** 41 images placed. **Remains:** 0 of 25 content entries approved. Missing: cover art, release metadata, audio previews, video sources, awards, press quotes, public emails, social links, technical rider, full-resolution originals. |
| **Legal & compliance** | 5 | 25 % | 1.25 | **Done:** consent wording stored with each signup; privacy page drafted; template cancellation terms flagged in the quote editor. **Remains:** attorney review of terms, privacy policy and the booking agreement. |
| **QA, UAT, training, launch** | 10 | 45 % | 4.5 | **Done:** automated suites green on file store and Postgres; 18 pages × 3 widths with axe; throttled mobile perf. **Remains:** real iOS/Android/Safari/Firefox pass, management UAT, CMS training, go-live checklist. |
| **Total** | 100 | | **≈ 67** | |

## Brief §11: build acceptance checklist

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All 41 supplied images available and mapped to a named section | ✅ Done | `src/content/media.ts` registry; every image has a role, sections, focal points and ratios. Masters kept byte-for-byte. |
| 2 | Homepage hero is cinematic, not a generic template | ✅ Done | Full-bleed IMG_6853 with masked type reveal and image motion. |
| 3 | Book Zakes is persistent and easy to reach from every major page | ✅ Done | Header CTA on desktop and mobile (`MENU \| ZAKES \| BOOK`), footer, every page's closing band. |
| 4 | Booking flow has clear states, validation, loading, errors and confirmations | ✅ Done | Five-step wizard with per-step validation, resumable draft, brief upload, review screen and reference. |
| 5 | Public availability does not leak private booking information | ✅ Done | The public API returns only available / limited / unavailable / past. The smoke test asserts nothing else leaks. |
| 6 | Quotes, contracts and payments are real workflows | ✅ Done* | Versioned quotes, typed-name agreement with terms hash, deposit via the gateway, verified webhook, management confirmation. *Live PayFast still needs merchant credentials. |
| 7 | Admin supports calendar, holds, quotes and booking status | ✅ Done | Month/week/day calendar, holds with expiry, quote editor, state machine, audit trail. |
| 8 | Music and video usable without unnecessary page loads | ✅ Done | Persistent mini-player across navigation; lite YouTube embed on demand. Audio and video sources await approval. |
| 9 | Mobile layout intentionally designed for booking and music discovery | ✅ Done | Separate phone layouts. Swept at 320 and 390 px with no horizontal overflow. |
| 10 | Accessibility and reduced-motion mode | ✅ Done | No serious or critical axe violations at 390/1440. Keyboard calendar, aria-live status, reduced-motion honoured. A human screen-reader pass is still recommended. |
| 11 | Responsive crops and focal points; no important face cropped | ✅ Done | Per-image desktop/mobile focal points and ratios. 37 masters are under 1600 px wide, so request the originals for full-bleed sharpness. |
| 12 | No invented facts, awards, event dates, lyrics, logos or retirement announcements | ✅ Done | Unverified entries are `placeholder` or `pending` and hidden in launch mode. The Handover never states retirement. Demo data is labelled "Sample" and refuses to seed a production database. |
| 13 | Performance tested on mobile network conditions | ✅ Done (new) | `npm run perf` uses Slow 4G and a 4× slower CPU at 390 px: LCP 0.9–2.5 s and CLS ≤ 0.035 on all 10 key pages. Runs in CI. |
| 14 | Environment variables used for all secrets | ✅ Done | `.env.example`. Nothing secret reaches the client bundle. Production refuses to start without `APP_SECRET`. |
| 15 | Error and empty states are designed | ✅ Done | Designed 404/error pages, empty catalogue/video/live/journal states and pending-approval states. |

**15 / 15 met in the build.** Items 6, 8 and 11 depend on material only management can supply.

## Brief deliverables

| Deliverable | Status |
| --- | --- |
| Full responsive website (all 20 routes in the brief) | ✅ |
| Image registry for all 41 assets | ✅ |
| CMS-ready content model | ✅ Now a working CMS in the admin (see below) |
| Booking request flow | ✅ |
| Admin booking interface | ✅ |
| Quote / contract / payment integration boundaries | ✅ PayFast + sandbox implemented; Peach is a stub behind the same interface |
| Notification adapters (email, SMS, WhatsApp) | ✅ |
| SEO metadata (Person, MusicAlbum, VideoObject, Event, Organization, OG, sitemap, robots) | ✅ |
| Analytics events (all 13 in the brief) | ✅ |
| README with environment variables and deployment steps | ✅ |

## Added in this round

- **Content management.** Releases, videos, journal, pillars, press kit and site settings are now editable in `/admin/content`, with:
  - approval states
  - hide/restore
  - revert to original
  - an asset library for cover art, audio previews, caption files and the rider

  Saving republishes the affected pages.
- **Team accounts** (`/admin/team`).
  - Owners add people with a one-time password, change roles and reset passwords.
  - Everyone can change their own password.
  - The last owner cannot be removed or demoted.
- **CSV exports** of bookings, proposals and consented community members. Spreadsheet-formula injection is neutralised and each export is recorded in the audit log.
- **Proposal triage** in the inbox: new → reviewed → archived.
- **Atomic booking steps.** Every booking action now commits all of its writes or none of them. Messages are sent only after the commit. A test injects a failure part-way through to prove it.
- **Security.**
  - Production Content-Security-Policy.
  - Links restricted to http(s): `z.url()` alone accepted `javascript:` URLs.
  - Uploaded files are byte-sniffed and served with a sandboxed CSP.
- **Fixtures.**
  - `npm run seed:demo`: a booking at every stage, sample listings, signups, proposals and one account per role.
  - A PDF brief and a cover-image fixture.
- **Wider smoke test.** It now also covers:
  - brief upload and download permissions
  - the menu dialog
  - community and collaboration forms
  - proposal triage
  - a public listing reaching /live
  - CMS edits and cover art reaching the site
  - CSV export
  - a new viewer signing in
  - CSP headers
- **Designed 404 everywhere.** Mistyped URLs outside the site's own routes used to get Next's plain black-on-white page. They now get the designed 404 inside the site's header and footer, and the smoke test checks for it.
- **Offline preview.** `preview/Zakes-Bantwini-Website-Preview.html`: every page, the booking and admin walkthrough, the image library, this audit and the costing, in one file.
- **Mobile performance test and fix.** The home and Architect hero copy waited for hydration (LCP 4.4 s on a throttled phone). It now animates from the first paint, bringing home LCP to 1.25 s.

## What management needs to supply

1. **Approve or replace every content entry.** There are 25: 4 releases, 6 videos, 8 journal stories, 5 pillars, the press kit and the streaming profiles. All of it can be done in `/admin/content`.
2. **Releases:**
   - official cover artwork
   - titles and years
   - tracklists and credits
   - Spotify / Apple Music / YouTube / Deezer links
   - any audio previews the site may stream
3. **Videos:** YouTube links or video files, captions and dates.
4. **Press kit:**
   - verified awards
   - approved press quotes
   - the technical rider (PDF)
   - performance formats
5. **Settings:** public booking and press email addresses, and official social profiles.
6. **Photography.** Full-resolution originals for the 37 images supplied under 1600 px wide. Images 21 and 27 contain generated lettering; confirm or replace them.
7. **Accounts:**
   - Vercel
   - Supabase
   - the domain
   - a sending domain for email
   - a PayFast merchant account
   - optionally WhatsApp Business (Meta) and Twilio
8. **Legal.** Attorney review of:
   - the booking agreement
   - the cancellation terms (the quote editor ships a marked template)
   - the privacy policy (POPIA)
   - the terms of use
9. **UAT.** Two people from management run real enquiries end to end on staging before launch.

## Known limits (honest list)

- **Rate limiting** is per server instance. On multi-instance hosting, move it to a shared store (≈ 4 h).
- **No error monitoring** (e.g. Sentry) or uptime alerting is wired yet (≈ 6 h).
- **Browser coverage.** Automated tests run in Chromium only. Safari/iOS, Firefox and Android devices need a manual pass.
- **E-signature** is a typed-name signature with a terms hash, a hashed IP and a timestamp. It is fine for most booking agreements, but if legal advice requires a qualified e-signature, swap in a provider such as DocuSign behind the same step.
- **Peach Payments** is a stub. PayFast is implemented, but not yet run against PayFast's own sandbox, because there are no credentials.
- **No Three.js scene.** The brief marked it optional, and the site's motion is CSS and Motion only.
