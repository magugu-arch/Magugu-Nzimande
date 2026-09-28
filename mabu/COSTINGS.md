# Mábu app: what this work costs

Prepared 28 September 2026. South African market rates, excluding VAT. Estimates, not quotes.

## Market rates in 2026

| Who | Rate |
| --- | --- |
| South African agency, blended (developers, designer, QA, project management) | R750 – R1 100 an hour; premium agencies up to R1 800 |
| Senior freelance developer | R600 – R1 200 an hour |
| Junior developer | R300 – R500 an hour |

Published South African project ranges: a simple app R60 000 – R250 000; a mid-complexity app with payments and
integrations R250 000 – R900 000; enterprise-grade work above R1 million.

## What this app would cost to have built

The Mábu app is a guest app (33 screens), a staff and admin app (14 screens) and a server, with bookings,
waitlist, events and tickets, gift vouchers, a rewards programme, push and email notifications, targeted
campaigns, payments, POPIA handling and automated tests. That puts it at the top of the mid-complexity band.

| Work | Hours |
| --- | ---: |
| Discovery, UX and visual design | 120 – 180 |
| Guest app | 450 – 650 |
| Staff and admin app | 150 – 220 |
| Server, database, rewards and notification engines | 300 – 450 |
| Integrations: payments, email, push, booking and delivery adapters | 80 – 140 |
| Testing and test automation | 120 – 200 |
| Project management, store submission, launch | 80 – 120 |
| **Total** | **1 300 – 1 960** |

| Built by | Rate used | Cost |
| --- | --- | ---: |
| South African agency | R750 – R1 100 an hour | **R975 000 – R2 150 000** |
| Senior freelancers | R600 – R900 an hour | **R780 000 – R1 760 000** |

A realistic agency quote for this scope is **about R1.0 – R1.6 million** and 6 to 9 months.

## What is left to finish (from the audit)

About 23% of the work remains; roughly half of it waits on Mábu (content, decisions, accounts). The engineering
still to do:

| Work | Hours |
| --- | ---: |
| PayFast sandbox test and go-live | 8 – 12 |
| Email go-live (SMTP, sender domain) | 4 – 8 |
| Dineplan adapter (if Dineplan stays) | 40 – 60 |
| Relational database move | 60 – 90 |
| Hosting, backups, monitoring | 20 – 30 |
| Store builds, submission, review fixes | 20 – 30 |
| Security review and fixes | 20 – 30 |
| Website hosting and launch (publish, Search Console, listings) | 6 – 10 |
| Loading real content, final QA | 10 – 20 |
| **Total** | **186 – 290** |

At a blended R850 an hour that is **about R160 000 – R245 000** of remaining engineering at market rates.

A website of this kind — about 80 pages, search-ready, fed from the same content as the app — is quoted
separately in South Africa at roughly R45 000 – R120 000. Here it comes out of the same build: the pages are
the app's own screens.

## Running costs once live

| Item | Cost |
| --- | --- |
| Apple Developer Program | US$99 a year (about R1 800) |
| Google Play developer account | US$25 once (about R450) |
| Hosting: API server and managed PostgreSQL with backups | about R800 – R2 500 a month |
| Email (SMTP provider) | R0 – R400 a month at restaurant volumes |
| Expo | free tier to start; Production plan US$199 a month only if builds and updates outgrow it |
| Push notifications (Expo push service) | no charge |
| PayFast | 3.2% + R2 per card payment; 2% (minimum R2) for Instant EFT; no monthly fee |
| Domain | about R100 – R200 a year |

Dollar amounts converted at about R18 to the US dollar; check the rate on the day.

## Against the LegacyLeverage proposal

The proposal prices the build at **R225 000 + R4 500 a month**. That is well under the market cost of the same
scope (R1.0 – R1.6 million from an agency), and close to the market cost of only the work that remains
(R155 000 – R240 000). The monthly fee covers hosting (R800 – R2 500) with room for support and updates.

## Sources

- The Formula, *App Development Cost South Africa (2026)* — theformula.co.za/app-development-cost-guide/
- CrazyClicks Digital, *App Development Cost South Africa: Real Prices for 2026* — crazyclicks.co.za/app-development-cost/
- Syniq Solutions, *How much does it cost to build a mobile app in South Africa? (2026)* — syniqsolutions.co.za
- Glenwood Dev Apps, *Mobile App Development Cost South Africa, 2026* — glenwooddevapps.com
- Payfast, *Our fees* — payfast.io/fees/ ; SME South Africa, *PayFast review 2026*
- Expo, *Subscriptions, plans, and add-ons* — docs.expo.dev/billing/plans/
