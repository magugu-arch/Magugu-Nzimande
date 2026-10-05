# Handover

Where NMU ONE stands, what NMU needs to decide, and how to take it from prototype
to production. For running it, start with the [README](../README.md).

## Status

| Area | State |
|---|---|
| Mobile app | All primary experiences built for four roles (brief §3–§15). Runs on iOS, Android and web from one codebase. |
| Pitch journey (§26) | All 14 steps work and are tested end to end in a browser. |
| Operator console | Dashboard, notifications workflow, approvals, audiences, events, commerce, service directory, help content, moderation, roles, analytics and audit log. In live mode staff sign in with NMU SSO and every action runs on the BFF, as them. |
| Data | **Synthetic only.** Typed adapters with mock implementations for every system. |
| Live mode | A reference BFF (`bff/`) serves the whole contract over the mock connectors, with real sessions, authorization-code + PKCE sign-in, the permission policy enforced on the server, the payment hand-off and an audit log. It is also the console's backend. The live app runs the full pitch journey through it, and the live console the create → approve workflow. Not yet connected to any NMU system. |
| Accessibility | Built to WCAG 2.2 AA. Console pages pass axe-core automatically; app screens are checked for named controls, contrast tokens and reflow, and every line of text on a photograph is measured against the pixels behind it (844 lines, three phone widths). Sheets honour Reduce Motion. A manual screen-reader pass on real devices is still due. |
| Tests | 154 unit tests (including the BFF's security boundary, PKCE and the console's server-side rules), the pitch journey in demo, single-file and live mode, a 184-screen sweep across roles and widths, the contrast audit, iOS and Android bundle builds, and the console workflow with accessibility checks, in demo and live mode. |

This lives in the `nmu-one/` folder. The repository root holds a separate,
unrelated project with its own README, HANDOVER and RUNBOOK; nothing in NMU ONE
depends on it.

## Decisions NMU needs to make

These are deliberately **not** guessed in the code.

1. **The university's name in the app.** The brief says *Nelson Mandela
   University*, which is what the app uses. Some supplied images read differently;
   please confirm the exact name and any short form.
2. **Logo.** No vector logo was supplied, so the app uses a typographic
   "NMU / ONE" mark (`scripts/brand-assets.mjs`). Supply the approved logo files
   and brand guidance for app icons, and these can be regenerated.
3. **Alumni Mentorship photo.** 17 of the 18 photo slots use supplied
   photographs. *Alumni Mentorship* borrows another photo for now and is flagged
   in Settings → About (`src/content/photos.ts`, `standIn`). Drop the photo into
   `assets/photos/masters/` and run `npm run assets:photos`.
4. **Campus Protection numbers.** Only South Africa's published national
   emergency numbers (10111, 112, 10177) are bundled. Campus numbers are shown as
   "to be confirmed" and are never dialled until Protection Services confirms
   them (`src/core/fixtures/support.ts`).
5. **Help articles.** Every assistant article is a draft marked "for owner
   approval". Each owner (Library, Residence Life, Student Finance, Protection
   Services, Student Counselling…) must approve or rewrite theirs. The console's
   Help content page has the approval workflow.
6. **Digital student ID** is built but switched off (`PENDING_APPROVAL` in
   `src/core/permissions/policy.ts`) until NMU approves the infrastructure (§15).
7. **Providers.** Payment, donations, push notifications and campus mapping
   providers need choosing. The app has a hand-off for each and holds no card data.
8. **Parent access.** The rule built is: a parent sees nothing about a student
   unless the student shares it, scope by scope (key dates, fees, results,
   residence, wellbeing alerts), and can change it at any time. Confirm this
   matches NMU policy and POPIA advice.
9. **Audience sizes.** The console's reach estimates use an invented population.
   Brief §33 notes 33,353 enrolled students in 2025; staff, parent and alumni
   numbers need confirming.

## What is real and what is demo

| Real (production-shaped) | Demo only |
|---|---|
| Permission policy, consent rules, route guards | Every name, number, balance and timetable |
| Adapter contracts and live BFF clients | The mock SSO persona picker (hidden in live builds) |
| NMU SSO sign-in (code + PKCE), push registration, payment hand-off | The BFF's development SSO and payment pages |
| The reference BFF's sessions, server-side policy, ownership checks and audit | The BFF's mock connectors and in-memory stores |
| Console actions run on the server, as the signed-in operator | The console's six synthetic operators |
| Offline policy (no sensitive caching) | The schematic South Campus map |
| Assistant routing and grounding rules | Shuttle positions, menus, order timings |
| Notification priority, quiet hours, deep links | Console metrics and audience sizes |
| Design system, accessibility patterns | The demo clock (`EXPO_PUBLIC_DEMO_CLOCK=live` turns it off) |

## Path to production

1. **Identity.** Register an OIDC client with NMU SSO for the redirect URIs in
   [INTEGRATIONS.md](INTEGRATIONS.md#identity-nmu-sso), and replace the reference
   BFF's development sign-in page with the code exchange against NMU SSO. The
   app side is built.
2. **BFF.** Take `bff/` to production: replace its mock connectors with
   connectors to NMU systems, starting with the pitch-journey ones (timetable,
   fees and funding, library, transport, commerce, events, notifications);
   move sessions and the audit log to durable stores; run with `BFF_DEV=0`.
   The permission and consent checks are already there.
3. **Console backend.** Register the console's OIDC client, take operators and
   their roles from NMU's staff directory, and store the console's data in a
   database. The server-side actions, checks and audit are built.
4. **Security review.** Penetration test, privacy impact assessment (POPIA),
   and legal review of safety, location, finance and identity features (§33).
5. **Accessibility.** VoiceOver and TalkBack passes on real devices; test with
   large text sizes; an independent WCAG 2.2 AA audit.
6. **Pilot.** One faculty, measured against today's baselines for help-desk calls
   and campus commerce (§33 calls these hypotheses, not facts).

## Engineering notes

- **Shared core.** `src/core` is framework-free TypeScript used by the app and
  the console. Keep it that way: no React Native or Next.js imports.
- **Time.** Nothing calls `new Date()` for "now"; everything uses `clock.now()`
  from `src/core/time/clock.ts`. Times are formatted in SAST
  (`src/core/time/sast.ts`).
- **Permissions.** Add a capability to `CAPABILITIES`, grant it in `ROLE_GRANTS`,
  guard its route in `ROUTE_CAPABILITIES`. The tests check every route and service
  maps to a real capability.
- **Photos.** Masters in `assets/photos/masters/`; `npm run assets:photos` builds
  WebP sizes and `src/content/photoFiles.generated.ts`. Alt text and focal points
  live in `src/content/photos.ts`.
- **Expo.** The project tracks SDK 57; read the versioned docs before upgrading
  (see `AGENTS.md`).
- **Live mode locally.** `npm run e2e:live` builds the BFF, starts it and runs
  the pitch journey against `dist-live` (build it first with
  `npm run export:live`). The BFF is plain Node (`bff/tsconfig.json`), and its
  routes share `src/core` with the app, so a contract change that breaks one
  breaks the typecheck.
