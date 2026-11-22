# Home Affairs One — concept prototype

> **Not an official Department of Home Affairs (DHA) product.** This is a working concept built
> from the _Home Affairs One_ product brief. It is not connected to any Home Affairs system. Every
> person, application, office, message and fee in it is invented, and service details are
> placeholders until the department supplies and approves them.

One trusted front door to identity and civic services: apply, track, be contacted and get help in
one place, on a phone, on the web or with a person beside you. The prototype makes the brief's
ideas clickable so they can be discussed, tested with people and challenged.

## Run it

Needs Node 20.9 or newer.

```bash
cd home-affairs-one
npm install
npm run dev          # http://localhost:3000
```

Choose **Sign in to the demo** and pick a person. Each one shows the service from a different side:

| Person                                | What you see                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Thandi M.** — citizen, verified     | An application that needs a next step, a passport in production, messages on every channel |
| **Sipho D.** — parent / guardian      | A linked child profile, an application being checked, a draft to resume                    |
| **Aisha K.** — visitor, basic account | Empty states, and what a basic account can and cannot do                                   |
| **Lerato N.** — citizen abroad        | A mission appointment shown in two time zones                                              |

There is also a separate **staff console** (`/staff/`) and an **accredited-partner sandbox**
(`/partner/`), each with its own mock sign-in.

**Profile → Prototype controls** switches the gated features on and off, simulates a slow, offline
or failing connection (to see every loading, offline and error state), shows the gateway's call
log, and resets the sample data.

## What is in it

| Area           | What works                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public layer   | Welcome, service catalogue and service pages, service-point finder (list and schematic map), help, guidance, official-channels page — no sign-in needed  |
| Account        | Mock sign-in with a passkey stand-in or a one-time code, assurance levels A0–A3, a time-limited step-up for sensitive actions, recovery guidance         |
| Apply          | Guided, saveable application with "why we ask", synthetic evidence, review and declaration, payment sandbox (approve / decline / time out), confirmation |
| Track          | One timeline per application, driven by workflow events; next actions; appointments; receipts; withdraw                                                  |
| Appointments   | Choose a service point, book, change or cancel; times shown in both time zones abroad                                                                    |
| Messages       | Secure inbox, per-channel consent with receipts, a delivery log of what was sent or held back and why, WhatsApp channel mock                             |
| Help           | Call-back and complaint requests that carry only the context the person agrees to share                                                                  |
| Profile        | Sign-in and security, family and delegates, privacy and consent receipts, accessibility and low-data settings                                            |
| Gated previews | Digital wallet concept, service guide, partner verification — behind feature flags, labelled as future                                                   |
| Staff console  | Work queue, case review, human-only decisions, support requests, dashboard, audit log                                                                    |

The brief's capability matrix is wider than a prototype. `docs/product/open-questions.md` lists
what needs DHA decisions, and `docs/architecture/decisions.md` records where this build
deliberately differs from the brief (for example: one web app instead of separate native and staff
apps).

## How it is built

```
 apps/web (Next.js, static export)
   citizen screens · /staff console · /partner sandbox
        │  screens only ever call…
        ▼
 services/api-gateway        timeout · retry · idempotency · correlation ID
        │                    safe errors · audit · call log
        ▼
 services/*                  identity · catalogue · workflow · appointments
   (mock adapters behind     notifications · payments sandbox · WhatsApp mock
    typed ports)             audit · support desk
        │
        ▼
 infrastructure/local        storage, clock, ids and event bus — in the browser
```

There is no server. Every integration is a typed port (`packages/api-contracts`) with an in-browser
mock behind it, so a real build swaps the mock for an HTTP client without touching the screens.
Sample data lives in the browser's own storage and never leaves the device.

```
apps/web               the web app / PWA
apps/mobile            placeholder — native app deferred (see its README)
apps/staff-console     placeholder — the console lives at apps/web/src/app/staff for now
packages/              design-system · api-contracts · shared-types · auth-client · accessibility
services/              the mock domain services and the gateway
infrastructure/local   the in-browser platform
assets/                60 photographic masters (unchanged) + manifest.json
docs/                  product brief, design, architecture, security, privacy, runbooks
tests/                 contract · integration · security · e2e · accessibility
scripts/               image derivation, asset check, icons, static server, screen capture, single-file build
share/                 the single-file app and its social preview image
```

## The rules it follows

These come from the brief and are binding on every change (`CLAUDE.md`, `.claude/rules/`):

- **No invented DHA facts.** No real fees, requirements, timeframes, office names or outcomes.
  Service content is sample content, versioned and labelled.
- **Synthetic data only.** No real identity numbers, documents, biometrics or uploads.
- **No official marks.** No seals, logos, uniforms, certificates, ID cards, QR codes or barcodes.
- **Mock adapters only.** No network calls, keys or production endpoints.
- **AI assists, never decides.** The service guide is a keyword search over sample guidance with
  citations; no model is connected. Decisions are recorded only by an official.
- **Outside channels carry a masked reference and a secure link** — never case detail.
- **Nothing is attested or submitted for the person.**
- **Future capabilities stay behind flags** and are labelled as subject to approval.
- **Audit and logs hold opaque references only.**

Several of these are enforced by tests (`tests/security`, `tests/integration`) rather than by
convention.

## Photographs

The 60 supplied photographs are illustrative, AI-generated concept images. They do not show real
offices, staff, citizens or documents.

- Masters are in `assets/masters/`, byte-for-byte as supplied and named by upload filename.
- `assets/manifest.json` gives each one an ID (A01–A60), alt text, a focal point for safe crops,
  its screen placements and a review status. `docs/design/asset-manifest.md` is the readable
  register, and the app's About page shows the same list.
- `npm run assets:derive` builds responsive WebP derivatives; `npm run assets:check` fails if a
  master is missing, changed, undescribed or unused.
- **Two images are flagged for review** (A35, A52): they contain a national-flag motif, which the
  brief's photography rules exclude. They are cropped to the people and should be replaced or
  approved before any public use.

## Commands

```bash
npm run dev          # derive images, start the dev server
npm run build        # derive images, static export to apps/web/out
npm run preview      # serve the export at http://127.0.0.1:4173
npm run verify       # typecheck, lint, format check, all Vitest suites, asset check
npm run test:e2e     # Playwright: every screen on phone and desktop, journeys, axe (build first)
node scripts/capture-screens.mjs --device phone   # screenshots of every screen into .shots/
```

To host under a sub-path (for example GitHub Pages), build with
`NEXT_PUBLIC_BASE_PATH=/your/sub-path npm run build` and serve `apps/web/out`.
`NEXT_PUBLIC_FLAG_PROFILE=pilot` builds with every gated feature off.

## Share it

| What                     | Where                                                                                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single-file app**      | `share/Home_Affairs_One_Concept_Prototype.html` — about 4.5 MB. Scripts, styles, fonts, link-preview metadata and all 60 photographs are embedded. Works offline and makes no requests. |
| **Interactive Artifact** | https://claude.ai/artifact/NhACnhfDPah6Sdty9rodYk — private until its owner shares it from the page's Share menu.                                                                       |
| **Social preview image** | `share/og-image.jpg` (1200 × 630), for link previews once the app is hosted.                                                                                                            |

| On       | How it opens                                                                                                                                                                                                                           |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android  | Send the HTML file as a document (for example on WhatsApp) and open it in Chrome: the whole prototype works, from the file.                                                                                                            |
| iPhone   | The file opens in iPhone's file preview, which does not run scripts, so it shows a **static preview** of the concept with its images. For the interactive prototype on iPhone, open a link (the Artifact, or a hosted copy) in Safari. |
| WhatsApp | Send the file as a document, or send a link. A hosted link shows a title, description and preview image when the file is built with `--site-url` and `--og-image-url`.                                                                 |

```bash
npm run build:single   # writes share/Home_Affairs_One_Concept_Prototype.html
npm run check:single   # opens that file from disk and walks every screen, with and without scripts
node scripts/make-og-image.mjs
# once hosted, rebuild so link previews carry the address and image:
node scripts/build-single-file.mjs --site-url https://your-host/ --og-image-url https://your-host/og-image.jpg
```

The single file is the same screens as the web app. Only three things are swapped
(`apps/web/single-file/`): the framework's links and navigation, for a router that works from a
file; and the image lookup, for embedded copies.

## Documentation

|                                                 |                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `docs/product/home-affairs-one-brief.md`        | The brief, converted from the approved Word document                  |
| `docs/product/open-questions.md`                | Numbered questions that need DHA decisions                            |
| `docs/design/building-screens.md`               | How every screen is put together                                      |
| `docs/design/asset-manifest.md`                 | The 60-image register                                                 |
| `docs/architecture/overview.md`, `decisions.md` | Target and prototype architecture; decision log                       |
| `docs/security/`                                | Threat-model outline, data classification, secure development         |
| `docs/privacy/`                                 | Privacy notes and the responsible-AI position                         |
| `docs/runbooks/`                                | Local development, manual accessibility testing, release and rollback |

## Known limits

- It is a prototype: nothing is secured by a server. Sign-in is a stand-in and the route guards
  are usability aids, not controls.
- English only. The other official languages need professionally reviewed translations.
- WCAG 2.2 AA is the target. Automated checks run in CI; the manual checks in
  `docs/runbooks/manual-accessibility-testing.md` have not been carried out with real users or
  assistive-technology testers.
- No native app, no real identity provider, payments, messaging or case system — by design, until
  DHA approves architecture, rules and sandbox access.
