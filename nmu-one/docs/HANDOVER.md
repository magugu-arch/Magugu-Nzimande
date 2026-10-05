# Handover

Where NMU ONE stands, what NMU needs to decide, and how to take it from prototype
to production. For running it, start with the [README](../README.md).

## Status

| Area | State |
|---|---|
| Mobile app | All primary experiences built for four roles (brief §3–§15). Runs on iOS, Android and web from one codebase. |
| Pitch journey (§26) | All 14 steps work and are tested end to end in a browser. |
| Operator console | Dashboard, notifications workflow, approvals, audiences, events, commerce, service directory, help content, moderation, roles, analytics and audit log. |
| Data | **Synthetic only.** Typed adapters with mock implementations for every system; live BFF clients ready but unconnected. |
| Accessibility | Built to WCAG 2.2 AA. Console pages pass axe-core automatically; app screens are checked for named controls, contrast tokens and reflow. A manual screen-reader pass on real devices is still due. |
| Tests | 126 unit tests, the pitch journey, a 184-screen sweep across roles and widths, and the console workflow with accessibility checks. |

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
| Adapter contracts and live BFF clients | The mock SSO persona picker |
| Offline policy (no sensitive caching) | The schematic South Campus map |
| Assistant routing and grounding rules | Shuttle positions, menus, order timings |
| Notification priority, quiet hours, deep links | Console metrics and audience sizes |
| Design system, accessibility patterns | The demo clock (`EXPO_PUBLIC_DEMO_CLOCK=live` turns it off) |

## Path to production

1. **Identity.** Register an OIDC client with NMU SSO; build the PKCE browser
   step (see [INTEGRATIONS.md](INTEGRATIONS.md#identity-nmu-sso)); remove the persona picker
   from live builds.
2. **BFF.** Build the routes in INTEGRATIONS.md, starting with the pitch-journey
   systems: timetable, fees and funding, library, transport, commerce, events and
   notifications. Enforce permissions and consent there.
3. **Console backend.** Move the console's store actions to BFF calls, with
   server-side permission checks and audit.
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
