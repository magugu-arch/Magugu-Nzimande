# NMU ONE

A mobile-first digital campus product for Nelson Mandela University: one app for
students, staff, parents and alumni, and an operator console for the teams that
run it. It sits as an orchestration layer over the university's existing
systems; this prototype runs end to end on synthetic data behind typed adapters.

> **Prototype.** Every name, balance, timetable, order and notification is
> synthetic. Nothing here is connected to an NMU system, and no NMU endpoint,
> credential or policy has been invented. See [docs/HANDOVER.md](docs/HANDOVER.md)
> for what NMU needs to confirm before any of it goes live.

| | |
|---|---|
| **App** | Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · Expo Router · TanStack Query · Zustand |
| **Console** | Next.js 16 (static export) · React 19 · TypeScript — in [`admin/`](admin/README.md) |
| **Shared** | `src/core`: domain models, permission policy, adapters, fixtures, assistant. Framework-free; both apps import it |

## Quick start

```bash
# The app (iOS, Android or web)
npm install
npm start               # press i / a / w, or scan with Expo Go

# The operator console
cd admin && npm install
npm run dev             # http://localhost:3000
```

No backend, keys or `.env` file are needed: the defaults run every integration
against the bundled mock adapters. [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
lists every setting.

### Demo personas

The sign-in screen offers four synthetic people. NMU SSO would normally decide
who someone is; in demo mode the presenter chooses.

| Persona | Who | Shows |
|---|---|---|
| **Thandi Mokoena** (student) | Final-year BCom Marketing | The full pitch journey: today, classes, fees, library, shuttle, lunch, events, graduation |
| **Dr Sipho Ndlovu** (staff) | Senior lecturer and NMU alumnus | Teaching schedule; switch to his alumni role from Profile |
| **Nomsa Mokoena** (parent) | Thandi's parent | A deliberately narrow view: only what Thandi has chosen to share |
| **Lwazi Dube** (alumni) | BSc Computer Science, 2014 | Mentoring, careers and giving |

The demo clock starts at **09:40 SAST on the next weekday**, so the story reads
the same whenever you present it. The console runs on the same clock.

## The pitch journey (brief §26)

Sign in as Thandi, then:

1. **Home** shows the next class, one critical notice (MKT302 has moved to EB212) and the next action.
2. Tap the class → room details → **Get directions** on the campus map.
3. **Fees**: balance, due date and the delayed NSFAS allowance.
4. **Library**: book a free study space.
5. **Shuttle**: live arrivals for Route A.
6. **Food**: order lunch from Campus Kitchen and pay through the payment hand-off.
7. A **pickup notification** arrives when the order is ready.
8. **Events**: find Spring Sounds on the Lawn and book a free ticket (QR code).
9. **Profile → Graduation**: confirm graduation. The same identity becomes **alumni**.
10. A **mentoring opportunity** arrives a few seconds later.
11. **Alumni → Giving**: the bursary giving journey.

`npm run e2e` drives exactly these taps in Chromium and keeps a screenshot of
each step in `.e2e/journey/`.

In the console, the same story from the other side: compose a notice as Ayanda
(communications), approve it as Lindiwe (approver), and watch its delivery
funnel fill in.

## What's in the box

```
src/
  app/            Expo Router screens: (app)/(tabs) is Home, Services, Campus,
                  Notifications, Profile; every other screen sits under (app)
  core/           Shared, framework-free logic (also used by admin/)
    domain/       Models and money
    permissions/  The one permission policy: roles, consent, lifecycle, route guards
    adapters/     Contracts, mock adapters, live BFF clients, registry
    fixtures/     Synthetic data, clearly marked
    assistant/    The grounded assistant: intents, approved articles, hand-off
    home/ campus/ transport/ notifications/ offline/ time/
  design/         Tokens, typography and components (Screen, Card, StateView…)
  features/       Feature logic: access guards, notifications, payments, search…
  state/          Session, preferences, governance (consent and audit)
  data/           TanStack Query hooks and the offline cache
  content/        Photo library, service directory, national emergency numbers
admin/            The operator console (Next.js)
e2e/              Browser journeys against the web build
__tests__/        Unit tests (app and console rules)
docs/             Environment, integrations, handover
```

### Principles the code holds to

- **One permission policy.** `core/permissions/policy.ts` decides every screen,
  service tile, assistant answer and console matrix. Parents see nothing about a
  student unless the student shares it; digital ID stays off until NMU approves it.
- **Adapters, not endpoints.** Every system sits behind a typed contract with a
  mock and a live BFF client. A live build with no BFF configured fails loudly
  (`not-configured`); it never falls back to demo data.
- **Never invent.** The assistant answers only from connected data or approved
  help articles, and hands off to a person otherwise. Campus Protection numbers
  are left blank until NMU confirms them; only South Africa's published national
  numbers are bundled.
- **Every state.** Screens handle loading, empty, error, offline and
  permission-denied, not just the happy path.
- **Sensitive data stays out of caches.** Money, results, wellbeing and guardian
  views are never stored for offline use.

## Checks

| Command | What it runs |
|---|---|
| `npm run verify` | Typecheck, lint, Prettier and 126 unit tests (app and console rules) |
| `npm run verify:web` | Web export, then the pitch journey and a sweep of every screen for four roles at two widths (184 screen loads: access rules, overflow, unnamed controls, placeholder copy) |
| `cd admin && npm run verify` | Console typecheck, lint, static build, then axe-core WCAG 2.2 AA on all 15 pages at 1366px and 390px and the full create → approve → deliver → measure workflow |

CI runs all three: [`.github/workflows/nmu-one.yml`](../.github/workflows/nmu-one.yml).

## Documentation

- [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md): every environment variable, for the app and the console.
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): the BFF contract, adapter by adapter, and what each NMU system must provide.
- [docs/HANDOVER.md](docs/HANDOVER.md): status, open decisions for NMU, and the path to production.
- [admin/README.md](admin/README.md): the operator console.
- [docs/NMU-ONE-Showcase-and-Audit.html](docs/NMU-ONE-Showcase-and-Audit.html): a single offline file with the pitch-journey and console screenshots, a completion audit and a cost estimate. Opens on a phone.
