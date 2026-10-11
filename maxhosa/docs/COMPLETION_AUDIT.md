# Completion audit

*As of 11 October 2026, after the events and fixtures build.*

## The short answer

| | |
|---|---|
| **Concept and offline demo** | **Done.** Everything the brief asks a concept to show works on sample data, and is tested. |
| **Production app** (Phase 0 + 1 + 2 on the App Store and Google Play, with real integrations) | **About 30% complete (between 25% and 35%). About 70% of the work remains.** |
| **Cost to finish from here** | **About R6 million to R11 million** (ZAR, excluding VAT), over **about 7 to 12 months** with a team of 5 to 6 people. |
| **Cost to build the whole app from zero** | **R7 million to R14 million** (ZAR, excluding VAT). This is the brief's own planning range for a premium iOS and Android app, and the bottom-up estimate below agrees with it. |
| **Running costs after launch** | About **R1.2 million to R2.4 million a year**: maintenance, OS updates, hosting, monitoring and store fees. |

All of these figures are planning estimates, not quotes. The biggest unknown
is the commerce platform. If MAXHOSA's store exposes usable APIs (for example
Shopify's Storefront and Customer Account APIs), cost lands near the bottom
of each range. If it doesn't, or if checkout, accounts or fulfilment need
custom work, cost lands near the top.

## What "complete" means here

"Complete" means the app the brief recommends as its baseline: **a premium iOS
and Android app**, covering Phase 1 (core commerce MVP) and Phase 2
(clienteling: appointments, events and RSVP, restock, notifications, a store
locator and a message centre). It is connected to MAXHOSA's real platforms,
tested on real devices, approved by the brand and released to both stores.
Phase 3 (global optimisation) is phase-gated in the brief and is not counted.

## How the percentage is worked out

Each workstream is weighted by its share of the effort a production build
needs. "Done" is how much of that workstream this build actually delivers,
not how much it appears to deliver.

| Workstream | Weight | Done | Contributes | What exists / what is missing |
|---|---:|---:|---:|---|
| **Phase 0 discovery**: platform audit, research, service blueprint, costed backlog, brand assets | 8% | 10% | 0.8 | 24-image asset gate and manifest, commerce audit questions, concept prototype. **Missing:** platform/API audit (the storefront was unreachable from the build environment), customer and staff interviews, service blueprint, risk register, brand asset handover |
| **Design system and UX** | 10% | 55% | 5.5 | Provisional tokens (WCAG AA-tested), components, Apple-style motion system, every flow designed and built. **Missing:** approved CI (logo, typefaces, palette), usability testing, brand design reviews |
| **Phase 1 app screens** (home, shop, product, saved, bag, checkout handoff, orders, tracker, account) | 15% | 75% | 11.3 | All screens built and tested on mocks, with loading, empty and error states. **Missing:** sign-in and account flows against a real provider, real-data edge cases, localisation hooks |
| **Phase 2 app screens** (appointments, **events and fixtures**, notifications, restock, delivery preferences, store locator, message centre) | 8% | 55% | 4.4 | Appointments, events calendar with RSVP, waitlist and invitations, notifications centre, restock, delivery preferences. **Missing:** store locator, secure message centre, iOS Live Activity |
| **Commerce integration** (catalogue, market pricing, stock, cart, checkout, accounts, orders) | 16% | 10% | 1.6 | Typed provider interfaces and mock adapters that the real adapters slot into. **Missing:** every real adapter |
| **Integration service** (courier webhooks, booking slot locking, event capacity, push notifications, consent records, CRM bridge, calendar feed, invite links) | 14% | 5% | 0.7 | Interfaces designed (idempotency, no head-counts, venue privacy). **Missing:** the service itself |
| **Content and cultural review** (approved copy, collection stories, full-resolution photography mapped to SKUs, size guides, event data) | 6% | 5% | 0.3 | Placeholder copy is labelled as placeholder, and nothing is invented. **Missing:** all approved content; masters for the 24 images |
| **QA, accessibility and security** | 10% | 25% | 2.5 | 75 unit tests, 20 web routes rendered, 114 offline-demo checks with the network cut, contrast tests. **Missing:** device matrix, VoiceOver and TalkBack passes, performance budgets, security review and penetration test, POPIA/GDPR reviews, analytics |
| **Release and operations** (store accounts, metadata, privacy labels, EAS builds, crash reporting, support process, launch) | 8% | 10% | 0.8 | CI runs the checks. **Missing:** everything else |
| **Delivery management and governance** | 5% | 15% | 0.8 | Task board, integration status, docs. **Missing:** sprint cadence with the brand, acceptance gates per phase |
| **Total** | **100%** | | **≈ 28.7% → about 30%** | |

The range (25% to 35%) reflects the weights more than the "done" column. If
the platform turns out to need heavy custom integration, the integration rows
grow and the build is nearer 25% done. If the platform's APIs are clean, it is
nearer 35%.

### What the events and fixtures work added

The calendar is built as a self-marketing loop. Every fixture is a reason to
open the app, a look to shop and an invite to pass on:

- **Home** leads with the next fixture. **Discover** previews the next three. **Account → My events** gathers the guest's RSVPs.
- **Events calendar**: a month grid in South African time that can be swiped between months, with city filters, upcoming and past lists, and a tap on a day to filter by it.
- **Event page**: date (with local time for visitors abroad), place type (never the address), reminder, the shoppable **event edit**, and, after the night, **shop the looks**.
- **RSVP** in one sheet: going, waitlist or invitation requested. A drop-in needs no RSVP. The calendar, invite and event-edit follow-ups come straight after.
- **Add to calendar**: the phone's own new-event form in the app. A valid `.ics` file in the demo and on the web.
- **Invite a friend**: the phone's share sheet.
- **Wear it to…** on a product page links each piece to the next event it is chosen for.
- **Follow fixtures** is marketing, so it is off by default and only turns on with consent.
- No invented scarcity: the app is never given a head-count, so it can only say "Spaces available" or "Waitlist open".

For the loop to work in production it still needs: an events back-office
(who creates fixtures, capacity and invitations), RSVP and confirmation
emails, a calendar subscription feed, **invite links that open a public event
page or the app** (universal links / app links, which is what turns a shared
invite into a new customer), and attribution analytics (invite → install →
RSVP → purchase). Those are counted in the integration-service, release and
QA rows above.

## Cost to finish: bottom-up estimate

**Assumptions**

- A South African digital product team, at blended agency rates of
  R800 to R1,100 an hour (ZAR, excluding VAT, 2026), with 160 hours per person
  per month.
- The brief's phase durations: discovery 4 to 6 weeks, Phase 1 3 to 5 months,
  Phase 2 2 to 4 months.
- This concept build carries forward. It reduces design and front-end time but
  is not counted as production-ready: every screen still needs review against
  real data and the approved CI.
- Not included: photography and content production, the commerce platform's
  own licence and fees, payment-provider fees, the courier contract, and any
  proprietary rider network (the brief says not to fund one by default).

| Stage | Team (people at the same time) | Duration | Low | High |
|---|---|---|---:|---:|
| Phase 0: discovery | Product lead, designer, researcher, ½ mobile lead, ½ backend (≈ 4) | 4–6 weeks | R0.7m | R1.0m |
| Phase 1: real commerce, accounts, orders, tracking | Product ½, designer ¾, 2 React Native, 1 backend, 1 QA, DevOps ¼ (≈ 5.5) | 3–5 months | R2.6m | R4.4m |
| Phase 2: booking, events service, push, store locator, message centre, CRM | ≈ 5 | 2–4 months | R1.6m | R3.2m |
| Hardening and release: security test, accessibility audit, device lab, store submission | Mixed, plus external testers | ~1 month | R0.4m | R0.8m |
| Subtotal | | ≈ 7–12 months | R5.3m | R9.4m |
| Contingency (15%) | | | R0.8m | R1.4m |
| **Total to finish** | | | **≈ R6.1m** | **≈ R10.8m** |

Cross-check: the brief puts a premium iOS and Android app at **R7m to R14m**
from zero. Subtracting the share this build already covers (design system,
screens and tests, about R1m to R3m of agency time) gives roughly R6m to
R11m. The two methods agree.

### Cheaper and bigger alternatives (from the brief)

- **Mobile web / PWA enhancement: R1.5m to R3.5m.** This validates mobile
  conversion before a native build. The Expo web export and the offline demo
  are a head start.
- **Global luxury omnichannel: R15m to R30m+.** This adds complex CRM,
  retail, localisation, clienteling and advanced product experiences
  (Phase 3).

The brief notes that these are alternative budgeting views, so the phase
costs and these option ranges should not be added together.

### Running costs after launch (yearly)

| Item | Estimate |
|---|---|
| Maintenance, OS and SDK upgrades, small improvements (15–20% of build) | R1.0m–R2.0m |
| Integration service hosting, push, monitoring, crash reporting, EAS builds | R0.15m–R0.35m |
| Apple Developer Program and Google Play (Google's fee is one-off) | < R5,000 |
| **Total** | **≈ R1.2m–R2.4m** |

## What would move these numbers most

1. **Platform audit result.** Reusable commerce APIs could save R1m to R3m.
   A platform without them could add the same amount.
2. **Who runs events.** An existing events or ticketing system with an API is
   cheaper than building capacity, waitlist and invitation rules in the
   integration service.
3. **Courier.** Scan-based tracking from an aggregator is cheap. Live map
   tracking needs a contracted same-day courier with a location feed, which
   is a Phase 3-scale cost.
4. **Content readiness.** Approved copy, full-resolution photography and SKU
   mapping on time keep the build from waiting on content.

## Next three steps

1. **Run discovery** (4–6 weeks). Confirm the platform, payments, courier,
   booking and events systems. Hand over brand assets and the masters for the
   24 images (plus approval and rights for the event image).
2. **Turn this audit into a costed backlog** against the confirmed platform,
   and replace these ranges with a quote.
3. **Move one connector from `mock` to "verified in sandbox"**, starting
   with the catalogue (see INTEGRATION_STATUS). That also shows how much of
   this concept carries straight over.
