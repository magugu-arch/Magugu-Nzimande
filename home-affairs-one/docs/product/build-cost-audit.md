# Build-cost audit — what it costs to build an app like this

_Prepared 22 November 2026. Indicative ranges in South African rand, excluding VAT._

> **This is an estimate, not a quote.** It is an independent, order-of-magnitude costing of a
> concept. It uses no figures from, and is not endorsed by, the Department of Home Affairs. Nothing
> here describes what any real Home Affairs system costs. Replace the rates below with real
> supplier rates before using any number in a proposal.

A designed, shareable version of this audit is built by `node scripts/build-audit-page.mjs` into
`share/Home_Affairs_One_Build_Cost_Audit.html`.

## The short answer

| Tier  | What it is                                                        | Range (excl. VAT) | Most likely | Time        | Team          |
| ----- | ----------------------------------------------------------------- | ----------------- | ----------- | ----------- | ------------- |
| **1** | **Concept prototype** — what exists today, built conventionally   | **R1.1m – R3.1m** | about R1.9m | 10–14 weeks | 5–6 people    |
| **2** | **Working pilot** — real sign-in, three services, limited rollout | **R14m – R41m**   | about R25m  | 9–12 months | 10–14 people  |
| **3** | **National service** — the brief's full scope, every service      | **R230m – R680m** | about R415m | 2.5–3 years | 60–90 at peak |

Each tier is roughly ten to fifteen times the one before it. The step is not more screens. It is
connecting to real systems, proving the service is secure, and running it for millions of people.

A lighter option sits below Tier 1: a **pitch prototype** — about 20 key screens in a design file
with a clickable demo and no code — at **R250k – R700k** over 3–5 weeks.

Running costs come after the build: about **R9m – R22m a year** for a pilot and
**R70m – R190m a year** for a national service, most of it people.

## What was audited

The numbers start from the prototype in this repository, measured on the day of the audit.

| Measure                          | Count                                                |
| -------------------------------- | ---------------------------------------------------- |
| Screens                          | 54, for three audiences: citizen, staff, partner     |
| Design-system components         | 41                                                   |
| Mock services                    | 10, behind 9 typed ports                             |
| Sample services in the catalogue | 13                                                   |
| Application code                 | about 28,400 lines of TypeScript, 7,250 lines of CSS |
| Automated checks                 | 388 unit tests, 48 browser and accessibility tests   |
| Photographs                      | 60, each with alt text and a focal point             |
| Documents                        | 14 (brief, design, architecture, security, privacy)  |

**Where it stands against a production service**

| Area             | State today                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| Design and flows | Complete for a concept: every journey in the brief's first release is shown |
| Accessibility    | Automated checks pass on every screen. No testing with disabled people yet  |
| Security         | None on a server: there is no server. Sign-in is a stand-in                 |
| Integrations     | None. Every system is a mock behind a typed contract                        |
| Content          | Sample content only. No approved requirements, fees or timeframes           |
| Languages        | English only                                                                |
| Native apps      | None. It is a web app that can be added to a home screen                    |

The prototype is about **a tenth of the effort of a working pilot** (about 275 person-days against
about 2,730). It is the front of house: what the service should feel like. The other nine-tenths
are the parts a person never sees.

## How the numbers are built

`cost = effort × day rate + third-party costs + contingency`

**Day rates (blended across roles, per person-day, excl. VAT)**

| Rate   | Used for                                           |
| ------ | -------------------------------------------------- |
| R5,000 | Low end: a small studio or a team of freelancers   |
| R6,800 | Working figure for Tiers 1 and 2                   |
| R9,000 | High end: an established consultancy, senior-heavy |

Tier 3 uses R6,000 / R7,500 / R9,500, because a national programme needs larger suppliers and more
senior specialists.

**Where the rates come from.** Salary surveys for 2026 put senior developers in South Africa at
roughly R50,000 to R100,000 a month (Indeed: about R51,600; Payscale: about R60,000; OfferZen:
about R69,000 at six to ten years and about R100,000 beyond ten). That is R2,400 to R4,800 a
working day in salary. Agencies bill at roughly twice the cost of employment to cover on-costs,
bench time, management and margin, and a team blends senior, mid-level and junior people.
Directory listings for South African agencies mostly show US$25–$49 an hour, with a median near
US$37; those are self-reported and skew to smaller firms.

**Contingency** is 15% for the pilot and 20% for the national service, because the unknowns grow
with the number of systems to connect.

## Tier 1 — Concept prototype

A clickable, coded prototype like this one: 54 screens, a design system, mock services, sample
content, tests and documentation. No real data, no server.

| Work                                   | Person-days   |
| -------------------------------------- | ------------- |
| Discovery and service mapping          | 10 – 15       |
| Flows and screen design for 54 screens | 25 – 40       |
| Visual design and design system        | 25 – 40       |
| Art direction and 60 photographs       | 10 – 20       |
| Front-end build with mock services     | 70 – 110      |
| Content design                         | 15 – 25       |
| Accessibility                          | 8 – 15        |
| Testing and automation                 | 20 – 30       |
| Documentation                          | 10 – 15       |
| Product and delivery management        | 20 – 30       |
| **Total**                              | **213 – 340** |

- Low: 213 days × R5,000 = **R1.07m**
- Most likely: 275 days × R6,800 = **R1.87m**
- High: 340 days × R9,000 = **R3.06m**

Add R50k – R200k if the photographs are commissioned or licensed rather than generated.

## Tier 2 — Working pilot

A real service for a limited group — one region, or 50,000 to 250,000 people. It has web and
mobile apps for iOS and Android, sign-in through an approved identity provider, three services
working end to end against existing back-office systems, a secure inbox with notifications,
appointments, payments through one gateway, a staff console, an audit trail, two or three
languages, an accessibility audit, a privacy impact assessment and security testing.

| Team                                    | Person-months |
| --------------------------------------- | ------------- |
| Product, delivery and business analysis | 16 – 26       |
| Design, research and content            | 14 – 22       |
| Mobile apps                             | 14 – 24       |
| Web front end                           | 8 – 14        |
| Back end and workflow                   | 20 – 32       |
| Identity and integration                | 8 – 14        |
| Testing and test automation             | 10 – 16       |
| Platform, operations and security       | 10 – 12       |
| **Total**                               | **100 – 160** |

| Third-party cost                                     | Range             |
| ---------------------------------------------------- | ----------------- |
| Security testing, two rounds                         | R0.5m – R1.4m     |
| Accessibility audit and testing with disabled people | R0.2m – R0.6m     |
| Privacy and legal work                               | R0.2m – R0.6m     |
| Research recruitment and incentives                  | R0.2m – R0.7m     |
| Translation, two or three languages                  | R0.1m – R0.4m     |
| Cloud, environments and tooling during the build     | R0.6m – R1.5m     |
| Devices, app-store accounts, licences                | R0.2m – R0.3m     |
| **Total**                                            | **R2.0m – R5.5m** |

|             | Labour                            | Third party | + 15% contingency |
| ----------- | --------------------------------- | ----------- | ----------------- |
| Low         | 100 months × 21 × R5,000 = R10.5m | R2.0m       | **R14.4m**        |
| Most likely | 130 months × 21 × R6,800 = R18.6m | R3.5m       | **R25.4m**        |
| High        | 160 months × 21 × R9,000 = R30.2m | R5.5m       | **R41.1m**        |

## Tier 3 — National service

The brief's full scope: every service in the catalogue, all eleven official languages, service
points and missions abroad, a wallet, partner verification, and operations around the clock.

| Team                                          | Person-years  |
| --------------------------------------------- | ------------- |
| Identity, sign-in and account recovery        | 14 – 26       |
| Applications and workflow, every service      | 24 – 44       |
| Appointments and service points               | 10 – 18       |
| Messaging, notifications and consent          | 10 – 18       |
| Payments and receipts                         | 8 – 14        |
| Staff console and case tools                  | 14 – 26       |
| Apps, design system and eleven languages      | 16 – 30       |
| Platform, reliability and security operations | 14 – 26       |
| Data, analytics and reporting                 | 5 – 9         |
| Programme, architecture and assurance         | 5 – 9         |
| **Total**                                     | **120 – 220** |

|             | Labour                           | Third party | + 20% contingency |
| ----------- | -------------------------------- | ----------- | ----------------- |
| Low         | 120 years × 220 × R6,000 = R158m | R35m        | **R232m**         |
| Most likely | 170 years × 220 × R7,500 = R281m | R65m        | **R415m**         |
| High        | 220 years × 220 × R9,500 = R460m | R110m       | **R684m**         |

Third-party costs here are identity and access licences, cloud with disaster recovery, messaging,
security-operations tooling, independent assurance and testing, translation and research.

**A reference point, not a comparison.** The UK government budgeted £305m over three years for
GOV.UK One Login, which covers sign-in and identity checking only. UK labour costs several times
what South African labour does, so the figure does not transfer. It shows that a national
identity service is a programme of this order, not a larger app project.

## Running it, each year

|                                  | Pilot          | National service |
| -------------------------------- | -------------- | ---------------- |
| Team to run and improve it       | R6.6m – R15.8m | R53m – R125m     |
| Cloud and disaster recovery      | R0.6m – R1.8m  | R8m – R25m       |
| Messaging (SMS, WhatsApp, email) | R0.5m – R2.0m  | R5m – R20m       |
| Security and assurance           | R0.6m – R1.5m  | R3m – R8m        |
| Licences and tools               | R0.3m – R1.0m  | R3m – R10m       |
| **Total a year**                 | **R9m – R22m** | **R70m – R190m** |

Messaging is driven by volume. SMS costs the most per message and in-app notifications the least,
which is one reason the design sends people back to the secure inbox.

## What moves the number most

1. **Connecting to existing systems.** The largest unknown. Each system needs an owner, a tested
   interface and a fallback for when it is down.
2. **How strongly identity must be proven.** A verified account costs far more than a basic one;
   biometric checks cost more again.
3. **Native apps or web only.** Two app stores add build, testing and release work to every change.
4. **Languages.** Eleven official languages multiply content, testing and support.
5. **Low-data and offline use.** Worth it for reach; it adds engineering and testing.
6. **The security and assurance regime.** Independent testing, monitoring and audit are recurring.
7. **Pace.** Running squads in parallel shortens the calendar and raises the cost.
8. **Procurement route and supplier mix.** One prime contractor, several specialists, or an
   in-house team each price differently.

## Not included

- Modernising the back-office systems the service would connect to
- Hardware, connectivity and kiosks at service points
- Staff training and change management
- Legal drafting and any regulatory change
- Contact-centre staff
- Public awareness and marketing
- VAT

## What AI-assisted delivery changes

This prototype was built with AI assistance in days, not the 10–14 weeks estimated above for a
conventional team. That saving is real at Tier 1, where the work is design exploration, front-end
code, tests and documents. It does not carry through in proportion. In Tiers 2 and 3 most of the
cost is integration, security assurance, research with real people, governance and operations. A
cautious planning assumption is 10–25% off the engineering effort, not off the total.

## From estimate to quote

A 6–8 week discovery, at about **R1.2m – R2.5m**, would replace these ranges with a priced
proposal. It would confirm the scope of the first release, test the feasibility of each
integration with its system owner, settle the security architecture and the procurement route,
and produce a delivery plan.

## Limits of this audit

- The effort figures are judgement, built from the size of this prototype and the brief's scope.
  They have not been checked against supplier quotes.
- The rate assumptions rest on public salary surveys and directory listings, which are
  self-reported and vary in method.
- No exchange rate is applied. Directory rates are quoted in US dollars as found.
- The national tier is the least certain. Treat it as an order of magnitude.

## Sources

- [OfferZen — software developer salaries in South Africa](https://www.offerzen.com/blog/software-developer-salary-south-africa)
- [Indeed — senior developer salaries in South Africa](https://za.indeed.com/career/senior-developer/salaries)
- [Payscale — senior software developer salary in South Africa](https://www.payscale.com/research/ZA/Job=Senior_Software_Developer/Salary)
- [GoodFirms — software development companies in South Africa](https://www.goodfirms.co/directory/country/top-software-development-companies/south-africa)
- [SuperbCompanies — mobile app development companies in South Africa](https://superbcompanies.com/categories/mobile-app-development-companies-in-south-africa/)
- [Civil Service World — One Login expected to cost £305m](https://civilserviceworld.com/news/article/one-login-expected-to-cost-305m-and-deliver-175bn-benefits)
