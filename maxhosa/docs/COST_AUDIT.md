# Cost audit: what it costs to build the MAXHOSA AFRICA app

*12 October 2026 · ZAR, excluding VAT unless stated · planning estimates, not a quote*

## The answer

| Question | Answer |
|---|---|
| **What does the app cost to build?** | **R7 million to R14 million** for a premium iOS and Android app, from zero. That is the brief's own planning range. A bottom-up estimate from team, rates and phases lands inside it, at **R7.1m to R11.8m**. |
| **What does it cost to finish from where it is now?** | **R6.1m to R10.8m** (R7.0m to R12.4m including 15% VAT), over **about 7 to 12 months** with a team of 5 to 6. The concept build already done saves about R1m. |
| **What is the first amount to commit?** | **Discovery: R0.7m to R1.0m**, over 4 to 6 weeks. It confirms the platforms and turns these ranges into a fixed quote. |
| **Can it be done in smaller steps?** | Yes. **Phase 1 only** (commerce, accounts, orders, tracking) from here: **R4.3m to R7.1m**. **Phase 2** (booking, events service, notifications, CRM, store locator, message centre) later: **R1.8m to R3.7m**. |
| **What does it cost to run?** | **R1.2m to R2.4m a year**: maintenance and upgrades, hosting, monitoring, builds and store fees. |

The widest swing is MAXHOSA's commerce platform. If the store exposes usable
APIs (for example Shopify's Storefront and Customer Account APIs), cost sits
near the bottom of each range. If checkout, accounts or fulfilment need
custom work, it sits near the top.

## What is being priced

**In scope:** the brief's recommended baseline. That is a premium iOS and
Android app covering Phase 1 (home and editorial, catalogue, search and
filters, product pages, saved items, bag, the platform's checkout, accounts,
orders, delivery tracking, help) and Phase 2 (appointments, events and RSVP,
restock alerts, notifications with consent, CRM connection, store locator,
secure message centre). It is built on MAXHOSA's real platforms, tested on
real devices, approved by the brand and released to both stores.

**Not in scope:** Phase 3 (global localisation, personalisation, 3D/AR,
multi-carrier and proof-of-delivery work), which the brief keeps
phase-gated. Also excluded: photography and content production, translation,
the commerce platform's licence, payment-provider fees, the courier
contract, CRM and email-marketing licences, and any proprietary rider network.

## Rates and team

Blended South African agency rates for 2026, excluding VAT. Freelancers
usually cost less. International agencies usually cost more.

| Role | Rate per hour |
|---|---:|
| Product lead / delivery manager | R1,100 |
| Senior product designer | R1,000 |
| UX researcher | R950 |
| Senior React Native engineer | R1,050 |
| Backend / integration engineer | R1,050 |
| QA and accessibility engineer | R800 |
| DevOps and release | R1,000 |
| **Blended across the team** | **≈ R1,000** |

Each person works 160 hours a month.

## Cost to finish, by stage

| Stage | Team (people at once) | Duration | Hours | Low | High |
|---|---|---|---:|---:|---:|
| Phase 0: discovery | Product lead, designer, researcher, ½ mobile lead, ½ backend (≈ 4) | 4–6 weeks | 640–960 | R0.7m | R1.0m |
| Phase 1: real commerce, accounts, orders, tracking | Product ½, designer ¾, 2 React Native, 1 backend, 1 QA, DevOps ¼ (≈ 5.5) | 3–5 months | 2,640–4,400 | R2.6m | R4.4m |
| Phase 2: booking, events service, push, CRM, store locator, message centre | ≈ 5 | 2–4 months | 1,600–3,200 | R1.6m | R3.2m |
| Hardening and release: security test, accessibility audit, device lab, store submission | Mixed, plus external testers | ~1 month | 400–800 | R0.4m | R0.8m |
| **Subtotal** | | **≈ 7–12 months** | **≈ 5,300–9,400** | **R5.3m** | **R9.4m** |
| Contingency (15%) | | | | R0.8m | R1.4m |
| **Total to finish (ex VAT)** | | | | **R6.1m** | **R10.8m** |
| Including 15% VAT | | | | R7.0m | R12.4m |

## Cost to finish, by workstream

The same subtotal, split by what the money buys. Product and delivery
management is spread across every line.

| Workstream | Low | High | Head start from the concept build |
|---|---:|---:|---|
| Discovery, research, service blueprint, costed backlog | R0.70m | R1.00m | Brief audit, asset gate, integration questions |
| Design system on the approved CI, and usability testing | R0.30m | R0.55m | Provisional tokens, components and motion system, WCAG-tested |
| Commerce integration: catalogue, market pricing, stock, cart, checkout handoff | R0.95m | R1.70m | Typed provider interfaces, mock adapter, every screen |
| Customer accounts and orders (OAuth with PKCE, order history, guest) | R0.45m | R0.80m | Guest flows, order screens |
| Delivery tracking: carrier webhooks, normaliser, notifications | R0.40m | R0.75m | Tracker UI, normaliser and its tests |
| Appointments: booking system integration, slot locking | R0.30m | R0.55m | Enquiry flow, idempotent mock |
| Events service: fixtures back-office, RSVP capacity, waitlist, emails, calendar feed, invite links, web event pages | R0.40m | R0.75m | Calendar, RSVP sheet, .ics and invite flows |
| Notifications and CRM: push, consent records, preference centre, CRM bridge | R0.35m | R0.70m | Preference centre with consent per kind |
| Store locator and secure message centre | R0.25m | R0.55m | Not started |
| App polish on real data: states, analytics, localisation hooks | R0.30m | R0.55m | Loading, empty and error states on mocks |
| QA, accessibility, performance, device testing | R0.45m | R0.75m | 78 app tests, 132 offline-demo checks, 21 web checks |
| Security review, penetration test, POPIA/GDPR review | R0.20m | R0.40m | Security and privacy notes |
| Release and DevOps: EAS builds, store submissions, monitoring, CI/CD | R0.25m | R0.35m | CI runs the checks |
| **Subtotal** | **R5.30m** | **R9.40m** | |

## Cost from zero, for comparison

The same team, rates and phases, without the concept build, gives:

| Stage | Low | High |
|---|---:|---:|
| Discovery | R0.7m | R1.0m |
| Phase 1, including the design system and every screen (4–6 months) | R3.5m | R5.3m |
| Phase 2 | R1.6m | R3.2m |
| Hardening and release | R0.4m | R0.8m |
| Contingency (15%) | R0.9m | R1.5m |
| **Total from zero** | **R7.1m** | **R11.8m** |

This lands inside the brief's R7m–R14m range for a premium iOS and Android
app. The difference from the cost to finish (about R1m) is what the concept
build already covers.

## The other options in the brief

The brief gives these as alternative budgets. Don't add them to the phase
costs.

| Option | Planning range | When it fits |
|---|---:|---|
| Mobile web / PWA enhancement | R1.5m–R3.5m | To prove mobile conversion before going native. The Expo web export and the offline demo are a head start. |
| **Premium iOS + Android app** | **R7m–R14m** | **The recommended baseline, if the platform's APIs are reusable** |
| Global luxury omnichannel | R15m–R30m+ | Complex CRM, retail, localisation, clienteling and advanced product experiences (Phase 3) |

## One-off third-party costs

| Item | Estimate | Where it sits |
|---|---:|---|
| Penetration test (external) | R80k–R200k | Security line |
| Accessibility audit (external) | R50k–R120k | QA line |
| POPIA / GDPR legal review | R30k–R100k | Security line |
| Test devices / device cloud | R30k–R80k | Hardening |
| Apple Developer Program (yearly) and Google Play (one-off) | < R5k | Release line |
| Photography, copy and cultural review | — | Excluded: brand cost |
| Translation | — | Excluded until languages are chosen |

## Running costs after launch (yearly)

| Item | Low | High |
|---|---:|---:|
| Maintenance, OS and SDK upgrades, small improvements (15–20% of build) | R1.00m | R2.00m |
| Integration service hosting (compute, database, queues) | R70k | R200k |
| Monitoring and crash reporting | R20k | R50k |
| EAS builds and over-the-air updates | R20k | R40k |
| Email and messaging for confirmations, maps, domains | R40k | R60k |
| **Total** | **≈ R1.2m** | **≈ R2.4m** |

Excluded here, as above: the commerce platform, payment and courier fees, and
CRM licences.

## What moves the number

| Driver | Effect |
|---|---|
| **Commerce platform APIs** | Reusable APIs save R1m–R3m. A platform without them adds about the same. |
| **Events and ticketing** | An existing system with an API saves most of the R0.40m–R0.75m events line. |
| **Courier** | Scan-based tracking through an aggregator is in this budget. A live map needs a same-day courier with a location feed, which is Phase 3 money. |
| **Content readiness** | Late copy, photography or SKU mapping keeps a 5-person team waiting at about R0.9m a month. |
| **Scope trims** | Deferring the message centre and store locator saves R0.25m–R0.55m. Launching on iOS first saves little: React Native shares about 90% of the work. |
| **Team location** | Freelance or offshore rates can lower the blended rate. Senior React Native skills and time-zone overlap with the brand are the usual trade-off. |

## How to pay for it in steps

1. **Discovery at a fixed fee** (R0.7m–R1.0m). Its output is a costed backlog
   and a quote for Phase 1.
2. **Phase 1 against that quote**, billed monthly, with a release-approval gate
   at the end.
3. **Phase 2 quoted after Phase 1's analytics review.** Spend 15% contingency
   only on approved changes.

## Confidence

These are planning figures, about ±30%. They become a quote only after
discovery confirms the platform, payments, courier, booking and events
systems. See [COMPLETION_AUDIT.md](COMPLETION_AUDIT.md) for how complete the
app is today (about 30%) and what remains.
