# bb.q Chicken South Africa — ordering website

The customer-facing ordering site for the bb.q Chicken South Africa master
franchise. Two stores at launch: Cresta Crossing (Beyers Naude Drive, Randburg)
and Waterfall Ridge (Allandale off-ramp, Midrand). Delivery, collection and
dine-in.

**Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 ·
Zod · Vitest

> The Expo mobile app lives at the repository root and is a separate
> deliverable. See the root [README](../../README.md) for it.

---

## Quick start

```bash
cd apps/web && npm install
cd ../../packages/types && npm install
cd ../../infra && npm install

cd ../apps/web
npm run dev            # http://localhost:3000
```

Three installs, not one. The website is deliberately **not** an npm workspace of
the Expo app at the root: React Native is sensitive to dependency hoisting, and
making the two share a lockfile would risk a working app to save a command.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Generates image derivatives, then builds |
| `npm start` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run brand:check` | Fails on a breach of the brand non-negotiables |
| `npm run assets:derive` | Regenerates image and logo derivatives from the masters |
| `npm run verify` | brand → typecheck → lint → test → build, in order |

Run `npm run verify` before opening a pull request.

---

## Layout

```
apps/web/                Next.js App Router
  src/app/               routes and API route handlers
  src/components/        interface, grouped by surface
  src/lib/               service layer, pricing, cart, state
packages/types/          Zod schemas shared by the API and every client
packages/ui/             design tokens
infra/seed/              the demo catalogue
infra/scripts/           the asset pipeline
```

`packages/` and `infra/` sit above the app and are consumed through TypeScript
path aliases (`@bbq/types`, `@bbq/ui/tokens`, `@bbq/seed`). `packages/types`
carries its own `zod` dependency and re-exports `z`, so exactly one zod instance
is in the module graph.

---

## The service boundary

No screen reads the seed modules. Everything goes through one function per
documented endpoint:

- `src/lib/api.ts` — server side, for server components and route handlers.
- `src/lib/client-api.ts` — browser side, over HTTP, parsing every response
  through its schema rather than casting it.

Pointing the site at a real API means changing the bodies in those two files.

### Endpoints

```
GET  /api/products                 catalogue, with availability
GET  /api/products/:slug           single product with options
GET  /api/stores                   stores, hours, services, delivery zones
GET  /api/promotions               active campaigns
GET  /api/rewards/catalog          redemption tiers
GET  /api/delivery/zones           serviceable suburbs by store
POST /api/delivery/quote           { suburb, subtotalCents } -> serviceable, fee, eta
POST /api/orders                   create, returns orderNumber and status
GET  /api/orders/:id               status for the journey screen
POST /api/orders/:id/advance       stands in for a kitchen display system
POST /api/payments/intent          501 — no provider selected
POST /api/payments/webhook         501 — no provider selected
GET/POST /api/admin/*              operations console: availability, services, orders
```

Order states run `received`, `preparing`, `ready`, `out_for_delivery`,
`completed`. Collection and dine-in skip `out_for_delivery` and relabel
`completed` as Collected or Served. `cancelled` is terminal from any state and
is refused without a reason.

**Server-side rules.** Nothing a client sends about money is used. Every line
is priced again from the catalogue — base price plus the deltas of the options
it actually carries — and a line whose claimed price disagrees is refused, not
quietly corrected: a disagreement is either tampering or a basket built before
a price changed, and the second case is owed the news rather than a different
amount at the till. `src/lib/order-integrity.ts` holds this, and
`tests/order-integrity.test.ts` drives it through the route handler rather than
the helpers, because the arithmetic was never the part that was wrong.

Refused by the API and not only by the interface: a store with the service
switched off, a sold-out or hidden item, a slug that was never on the menu, an
option group or choice the product does not have, the same discounting choice
claimed twice, and a delivery order to a suburb the chosen store does not
cover.

---

## Tests

Vitest, in `tests/`. Most suites drive the **route handlers** rather than the
helpers underneath them, because that is where the rules are actually enforced:
the pricing arithmetic was always correct, and the hole was that the numbers
handed to it came from the request.

`tests/fixtures.ts` holds the shared setup — building a valid order line at the
catalogue price, posting a create-order body, signing in to the console,
resetting state. Everything in it reads from the seed catalogue rather than
hard-coding a slug or a price, so a menu change moves the tests with it instead
of leaving them green against a product that no longer exists. Add a variant by
passing an override, not by writing a second definition.

`tests/setup.ts` gives each test file its own demo-state file. The state store
defaults to one path in the temp directory, so without this two suites that
both write it race and fail each other in ways neither shows when run alone.

---

## Money

Integer cents everywhere, formatted only at the edge through `<Price>`. The
arithmetic lives in `src/lib/pricing.ts` and is covered by tests: the discount
rounds once, delivery is measured on the subtotal **after** discount, and every
amount stays a whole number of cents.

---

## Images

The 16 supplied masters in `assets/food/masters` are never edited and never
served. `infra/scripts/generate-image-derivatives.mjs` produces two crops each —
portrait 4:5 and wide 16:9 — at 480 / 768 / 1200 wide, in WebP with a JPEG
fallback. `<FoodImage>` renders a plain `<picture>` with a srcset, so no image
optimiser runs at request time.

Derivatives are generated, not committed: 21 MB that rebuilds in twenty seconds.
`npm run build` regenerates them, so a master that goes missing fails the build.

The logo is the licensed master in `assets/brand/masters`. Its dark-ground
reversal is derived by keeping the wordmark bb.q Red and turning only the black
ink white — the variant the guidelines show on bb.q Black. Nothing is redrawn.

---

## Brand rules

`npm run brand:check` fails the build on the three non-negotiables that are
invisible in a diff:

1. **Spelling.** `bb.q Chicken`: lowercase `bb.q`, capital C. Bare `bbq` is fine
   in a file name, slug, class or order-number prefix.
2. **No fire language.** The product is twice fried in olive oil and tossed to
   order. The approved craft line is exactly
   `Twice fried in olive oil. Tossed to order.`
3. **One source of colour.** Raw hex lives only in
   `packages/ui/src/tokens.json` and `packages/ui/src/tokens.css`. A test
   asserts the two agree.

---

## Demo data

Every commercial value is unapproved sample data, gathered in
`infra/seed/demo-values.ts` and flagged in the interface through `<DemoFlag>`
and `<DemoNotice>`. Setting `DEMO_DATA` to `false` removes every flag at once.

Awaiting approved figures: menu pricing, delivery fee and threshold, trading
hours and suburb lists, rewards rules, promotion codes and dates, allergen and
energy values, store telephone numbers, halaal certification status, the payment
provider, and the delivery partner model.

---

## The operations console

Behind one shared operator passphrase, set through `BBQ_ADMIN_PASSWORD`. See
`.env.example`.

- **Fails closed.** With no passphrase configured nobody can sign in and every
  console write endpoint answers 503. A deployment that forgets the variable
  gets a locked console, which is recoverable, rather than a world-writable
  one, which is not.
- The session is an HMAC-signed, httpOnly, `SameSite=Strict` cookie lasting one
  eight-hour shift. Its signing key is derived from the passphrase, so
  rotating the passphrase ends every live session.
- Five wrong attempts lock sign-in for fifteen minutes, counted in the shared
  state file so the lockout holds across worker processes rather than being
  five attempts *each*.
- Every `/api/admin/*` endpoint carries the guard itself and runs it **before**
  parsing the body — the page redirect is convenience, not the boundary.

**What this is not.** One passphrase is not a staff directory. There are no
per-person accounts, no roles and no revocation of one person without changing
the passphrase for everyone, so the audit log can say an operator made a change
but not which one. That needs a user store and a way to reach an inbox, neither
of which this deployment has.

**Still open: `POST /api/orders/:id/advance`.** It stands in for a kitchen
display system, and the customer's own journey page calls it on a timer so the
states can be watched end to end. Putting it behind the console's session would
break that, so it is deliberately left reachable. It must become operator-only
when a real kitchen display system replaces it.

## Deliberately not built

Payment capture, driver dispatch, notifications, customer account tokens and a
real database.

Orders and console writes live in a JSON file (`BBQ_STATE_FILE`, defaulting to
the system temp directory) rather than in memory, because the server runs
several worker processes and they have to agree. It is a stopgap for Postgres:
two operators writing in the same instant can still lose an edit.
