# Costing: what this kind of work costs (South Africa, October 2026)

All figures are in South African rand and **exclude VAT** unless stated. Where a price is in US
dollars, it is converted at **R16.50 = US$1**: the rate was about R16.38 in early October 2026, and
the October forecast range is R16.25–R17.33.

The hours below are **estimates** of what a competent team would spend on this scope. The rates and
service prices are taken from the sources listed at the end.

---

## 1. What it costs to build what exists now

The scope has four parts:
- a cinematic 20-route site
- a full booking workflow (request → quote → agreement → deposit → confirmation)
- a management admin with calendar and CMS
- tests, CI and documentation

| # | Workstream | Hours |
| --- | --- | ---: |
| 1 | Discovery, brief analysis, information architecture | 24 |
| 2 | Art direction, UI/UX design system, desktop/tablet/mobile layouts, motion spec | 120 |
| 3 | Front-end build: 20 public routes, responsive layouts, motion system, persistent audio player, video player | 190 |
| 4 | Image pipeline and 41-image registry: focal crops, AVIF/WebP derivatives, OG images | 24 |
| 5 | Booking engine: request wizard, availability calendar, status machine, client portal, quotes, agreement and signature, payment-provider abstraction (PayFast + sandbox), email/SMS/WhatsApp notifications, reminders | 210 |
| 6 | Management admin: auth and roles, dashboard, bookings, quote editor, month/week/day calendar, public events, inbox, team, CSV exports, audit trail | 140 |
| 7 | Content management: content model, editors, approvals, asset library | 80 |
| 8 | Data and security: Postgres schema and migrations, transactions, private document storage, CSP, rate limits, session security | 50 |
| 9 | SEO and analytics: structured data, Open Graph, sitemap, 13 tracked events | 20 |
| 10 | Quality: 86 unit/integration tests on two databases, browser smoke test with accessibility checks, mobile performance budget, CI | 70 |
| 11 | Documentation and handover | 16 |
| 12 | Project management (≈ 10 %) | 95 |
| | **Total** | **≈ 1,040 h** |

### At current market rates

| Who builds it | Rate / hour | Cost (excl. VAT) |
| --- | ---: | ---: |
| Senior independent freelancers (South Africa) | R650 | **≈ R676,000** |
| South African agency, mid-market | R950 | **≈ R988,000** |
| Premium South African studio (Johannesburg / Cape Town top tier) | R1,250 | **≈ R1,300,000** |
| International agency (US/UK, ≈ US$120/h) | ≈ R1,980 | **≈ R2,060,000** |

**Where the rates come from:**
- **Freelancers:** senior freelance web developers in South Africa charge direct clients about US$40–65/h, which is R660–R1,070 (SoloHourly).
- **Agencies:** listed South African agencies sit at US$25–99/h. The median is about US$37/h in Johannesburg listings and US$75/h in Cape Town, which is R610–R1,240 (GoodFirms, Clutch, DesignRush).
- **Employee wages are lower:** web developers average R325–R370/h and full-stack developers R584/h (PayScale, Indeed). That is a salary, not a billing rate.

**Why the small "website packages" don't compare.** South African price guides quote:
- R20,000–R60,000 for booking systems and web apps
- R80,000+ for full web applications

Those are template or plugin builds (for example WordPress with a booking plugin). They do not include:
- a bespoke quote → agreement → deposit → confirmation workflow
- a management calendar with holds
- a CMS with approvals
- private document storage
- the tested quality bar this brief asks for

The brief's own bar is "a premium international music and culture platform".

---

## 2. What it costs to finish

### Developer work remaining (≈ 140 hours)

| Task | Hours |
| --- | ---: |
| Deployment and environments: Vercel, Supabase database and storage, env vars, cron, domain/DNS, email SPF/DKIM/DMARC | 12 |
| Live integration testing: PayFast sandbox then live ITN, Resend, WhatsApp templates submitted to Meta, optional Twilio | 16 |
| Cross-browser and real-device QA (iOS Safari, Android Chrome, Firefox, Edge), plus fixes | 24 |
| Shared rate-limiter, error monitoring, uptime alerts | 10 |
| Content-loading support and CMS training with management | 16 |
| User-acceptance testing round with management, plus fixes | 24 |
| Pre-launch security review | 16 |
| Image refresh when full-resolution originals arrive | 8 |
| Project management | 14 |
| **Total** | **140 h** |

| Rate | Cost to finish (excl. VAT) |
| ---: | ---: |
| R650/h | ≈ R91,000 |
| **R950/h** | **≈ R133,000** |
| R1,250/h | ≈ R175,000 |

### Third-party one-off costs

| Item | Cost | Source |
| --- | --- | --- |
| Website legal package: terms of use, POPIA privacy policy, cookie guidance | from **R12,500** excl. VAT | MJK Inc. |
| Booking agreement and cancellation terms (a standard commercial contract) | **R8,000–R30,000** | Global Law Experts, 2026 SA bands |
| `.co.za` domain | about **US$3.50–10 a year** (≈ R60–R165) | domainoffer.net |
| Content, photography and video | Supplied by management. Not costed here. | |

---

## 3. What it costs to run (monthly)

| Service | Plan | Monthly | Notes |
| --- | --- | ---: | --- |
| Hosting: Vercel | Pro, 1 seat | **$20 ≈ R330** | Includes $20 of usage credit. Metered usage beyond that. |
| Database and file storage: Supabase | Pro | **$25 ≈ R415** | Includes a Micro compute instance. Real-world small apps land around $25–36. |
| Transactional email: Resend | Pro | **$20 ≈ R330** | 50,000 emails a month. Booking volumes are far below this. |
| Analytics: Plausible | Starter or Growth | **$9–19 ≈ R150–R315** | Cookieless, so no consent banner is needed for it. |
| **Platform subtotal** | | **≈ R1,225–R1,390** | |
| WhatsApp Business (optional) | Per message, from 1 Oct 2026 | ≈ **R0.12** utility, ≈ **R0.62** marketing | Utility replies inside a 24-hour customer window are free. Add VAT. |
| SMS: Twilio (optional) | Per message | **$0.1355 ≈ R2.24** | Charged per segment. WhatsApp is about 20× cheaper per update. |
| Payments: PayFast | No monthly fee | **Card 3.2 % + R2; Instant EFT ≈ 2 % (min R2)** | Custom pricing above about R50,000 a month in volume. |
| Maintenance and support (recommended) | 4–8 h/month | **R3,800–R7,600** at R950/h | Security updates, backups check, small changes. The international benchmark is €200–800/month. |

### What payment fees mean in practice

The worked example is a R230,000 deposit.

| Payment method | Fee |
| --- | ---: |
| By card through PayFast | ≈ **R7,362** |
| By Instant EFT through PayFast | ≈ **R4,600** |
| By ordinary bank EFT, recorded in the admin ("Record payment") | **R0** gateway fee |

The admin supports all three. For large corporate deposits, offering bank EFT saves real money.

---

## 4. Summary

| | Low | Typical | High |
| --- | ---: | ---: | ---: |
| Market cost to build what exists now | R676,000 | **R988,000** | R1,300,000 |
| Cost to finish (developer) | R91,000 | **R133,000** | R175,000 |
| Legal (one-off) | R20,500 | **R31,000** | R42,500 |
| Running costs, platform only (per month) | R1,225 | **R1,300** | R1,390 |
| Maintenance retainer (per month) | R3,800 | **R5,700** | R7,600 |
| **First year after today: finish + legal + 12 months running and support** | **≈ R172,000** | **≈ R248,000** | **≈ R325,000** |

Add 15 % VAT where the supplier is VAT-registered. Payment-gateway and messaging fees scale with
bookings and are excluded from the totals.

---

## Sources

- [SoloHourly: freelance web developer rates in South Africa](https://solohourly.com/rates/web-developer-rates-in-south-africa)
- [PayScale: web designer & developer hourly pay, South Africa](https://www.payscale.com/research/ZA/Job=Web_Designer_%26_Developer/Hourly_Rate/7f3a5407/Mid-Career-Web-Development)
- [Indeed: full stack developer salaries, South Africa](https://za.indeed.com/cmp/Communicate-Recruitment/salaries/Full-Stack-Developer)
- [GoodFirms: web development agencies, Cape Town](https://www.goodfirms.co/companies/web-development-agency/cape-town)
- [Clutch: design agencies, South Africa](https://clutch.co/za/agencies/design.md)
- [DesignRush: software development companies, South Africa](https://www.designrush.com/agency/software-development/za?page=2)
- [SoWebsites: website cost South Africa 2026](https://sowebsites.co.za/blog/website-cost-south-africa-2026)
- [ProCompare: website cost South Africa](https://www.procompare.co.za/pro-info-centre/success-tips/website-cost-south-africa)
- [Vercel pricing 2026 (Schematic)](https://schematichq.com/blog/vercel-pricing) · [MakerKit Vercel cost](https://makerkit.dev/blog/saas/vercel-cost)
- [Supabase pricing 2026 (MakerKit)](https://makerkit.dev/blog/md/saas/supabase-pricing)
- [Resend pricing 2026 (Automation Atlas)](https://automationatlas.io/answers/resend-pricing-explained-2026/)
- [Plausible pricing 2026 (ToolPick)](https://www.toolpick.dev/pricing/plausible)
- [PayFast fees](https://payfast.io/fees)
- [Twilio SMS pricing, South Africa](https://www.twilio.com/en-us/sms/pricing/za)
- [Briefly: Meta to charge WhatsApp Business API per message from 1 October 2026](https://briefly.co.za/people/250520-meta-charge-whatsapp-business-api-users-message-1-october-2026/)
- [ChatMaxima: WhatsApp API pricing South Africa](https://chatmaxima.com/whatsapp-api-pricing/south-africa/)
- [domainoffer.net: .co.za price comparison](https://domainoffer.net/price-compare-co.za)
- [MJK Inc.: website legal package](https://mjkinc.co.za/website-legal-package) · [POPIA compliance package](https://mjkinc.co.za/packages/popia-compliance)
- [Global Law Experts: contract lawyer fees in South Africa](https://globallawexperts.com/contract-lawyer-fees-south-africa/)
- [Kolonell: website maintenance retainer costs 2026](https://kolonell.com/en/blog/website-maintenance-retainer-scope-cost-2026)
- [ValutaFX: USD/ZAR history](https://www.valutafx.com/history/usd-zar-2026-08-20) · [LongForecast: USD/ZAR](https://longforecast.com/dollar-to-rand-forecast-2017-2018-2019-2020-2021-usd-to-zar)
