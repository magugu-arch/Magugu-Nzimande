# Production runbook

The six things the brief's Definition of Done asks a runbook to cover:
environment variables, API endpoints, deployment, rollback, monitoring and
analytics.

`README.md` is the reference manual and `HANDOVER.md` the orientation. This is
the one to open when something is live and needs changing, or has gone wrong.

> **Read first.** Two values in this repository are placeholders, and both are
> load-bearing here: `app.json`'s `updates.url` is a zeroed project id, and
> `eas.json`'s submit block has no `appleId` / `ascAppId` / `appleTeamId`.
> `eas init` writes the first. Nothing in the rollback section works until it
> has been run.

---

## 1. Environment variables

Everything the client reads is in `.env.example`; copy it to `.env.local`.
Only `EXPO_PUBLIC_*` is inlined into the bundle by Expo's babel plugin — which
is also why `constants/config.ts` reads each one as a literal
`process.env.NAME` rather than a dynamic lookup, which would compile to
`undefined` on device.

| Variable | What it does | Notes |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Backend origin | `app.json`'s `extra.apiBaseUrl` is the fallback |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Request timeout | Default 15 000 |
| `EXPO_PUBLIC_USE_MOCK_API` | `1` serves everything from the bundled mock layer | **`audit:launch --production` fails the build if this is on** |
| `EXPO_PUBLIC_SEED_PROFILE` | `full` or `new-customer` — which customer the mock pretends to be | Mock layer only; cannot affect a real build |
| `EXPO_PUBLIC_MAPS_PROVIDER` / `_API_KEY` | Store locator map | The map is still schematic; see the stub list |
| `EXPO_PUBLIC_PAYMENT_PROVIDER` / `_PUBLIC_KEY` | Gateway | **Publishable key only.** A secret key in an `EXPO_PUBLIC_` var ships to every handset |
| `EXPO_PUBLIC_PUSH_PROJECT_ID` | Expo push project | Written by `eas init` |

No secret belongs in any of these. Anything that must stay secret lives on the
backend.

---

## 2. API endpoints

The full service-to-endpoint table is in `HANDOVER.md` §6. Two things matter
operationally:

**Six endpoints are promises, not preferences.** The app already tells a
customer something that only the endpoint can make true — erasure within 30
days, a marketing opt-out, a verification email, push stopping at sign-out,
totals recomputed server-side, and a points balance it deducts from. `npm run
audit:launch` lists them with what each has to do, and `--production` makes
them fail a build. Three are POPIA-adjacent: an app that offers erasure or
opt-out and does not deliver it is worse than one that never offered.

**Totals are recomputed server-side or not at all.** `POST /v1/orders` must
price the basket itself. The client's totals are a display, and the brief is
explicit: never trust client-side totals.

---

## 3. Deployment

```bash
eas build --profile production --platform all     # npm run build:prod
eas submit --profile production --platform all    # npm run submit:prod
```

`npm run build:prod` runs `audit:launch --production` first, so a build with
the mock layer on cannot reach a store.

Profiles, from `eas.json`:

| Profile | Channel | For |
|---|---|---|
| `development` | development | Dev client, internal distribution |
| `development-simulator` | development | iOS simulator |
| `preview` | preview | Stakeholder review, **mock API** |
| `preview-live` | preview | Same build shape, real API |
| `production` | production | Store |

Before the first submission, fill `appleId`, `ascAppId` and `appleTeamId` in
`eas.json`.

---

## 4. Rollback

**This is the section to read before you need it.**

`runtimeVersion` is on the `fingerprint` policy, and that one line decides what
can be rolled back quickly and what cannot:

- **JavaScript, styling, copy, most business logic** — shipped and reverted
  over the air, in minutes, without a store review.
- **Anything native** — a new dependency with native code, a permission, an
  icon, an SDK upgrade — changes the fingerprint. Those builds do not accept
  the old bundle and the old builds do not accept the new one. There is no OTA
  route; it is a new build and a new submission.

### Rolling back a JavaScript release

```bash
eas update:list --branch production          # find the update before the bad one
eas update:rollback --channel production     # or: republish the known-good update
```

`checkAutomatically` is `ON_LOAD` and `fallbackToCacheTimeout` is `0`, so a
handset checks on launch and does **not** block the splash waiting for an
answer. Practical consequence: a rollback reaches a customer on their *next*
cold start, not immediately, and anyone mid-session keeps the bad bundle until
they relaunch. Plan the comms accordingly — for a checkout-breaking bug, that
gap is the thing to communicate to the stores.

### Rolling back a native release

There is no un-shipping a store build. The options, in order of speed:

1. **Halt the phased release** in App Store Connect / Play Console. Fastest,
   and it only stops the spread — it does not recover anyone already updated.
2. **OTA a fix onto the new build**, if the bug is in JavaScript. Usually the
   real answer: the native release is fine and the defect rode along in the JS.
3. **Submit the previous build again** with a bumped version. Slowest — a
   review cycle — and the only route for a genuinely native defect.

### The one that is not a rollback

A bad `POST /v1/orders` deployment cannot be fixed from the app at all. The
client is a display; pricing, promotions and eligibility are the backend's.
Roll the backend back.

---

## 5. Monitoring

Nothing is wired to a vendor yet — both adapters are injection points with no
SDK bundled, because choosing either ships a device identifier for every
customer and wants an opinion on data residency. What exists is the plumbing
and the taxonomy, so the first day of a chosen provider is configuration
rather than instrumentation.

### Errors

`ux/errorReporting.ts`. Inject one `ErrorReporter` at startup and every path
below reports to it. Everything is scrubbed first — emails, tokens, credential
fields, SA mobile numbers, card-shaped digits, coordinates and URL query
strings — so the reporter never becomes an undeclared customer database.

Scopes in use, which are what to group and alert on:

| Scope | Means |
|---|---|
| `render` | A crash caught by the error boundary. The customer saw a recovery screen |
| `api.malformed:<path>` | Backend and app disagree about a response shape. Somebody has to change one of them |

Add more with `reportError(error, { scope: 'a.stable.label' })`. `scope` is
hand-written and never free text from a customer.

### What to watch first

- **`render` crashes on checkout routes.** The one place a crash costs an order.
- **`api.malformed`.** It means a contract broke, and it is silent to the
  customer, who only sees "we couldn't read that".
- **`purchase` volume against `begin_checkout`.** The abandonment rate, and the
  fastest signal that a release broke the funnel — see below.

---

## 6. Analytics

`ux/analytics.ts`. Sixteen typed events across the whole journey; inject one
`AnalyticsAdapter` and they start flowing. Full reasoning in `HANDOVER.md` §5.

Two operational points:

**Event names are GA4's reserved ecommerce names where one exists** —
`view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`,
`search`, `view_cart`. Configure the provider to treat them as such and the
built-in funnel and monetisation reports populate themselves. Rename them and
somebody rebuilds those reports by hand.

**The dashboards the brief asks for, and the events behind them:**

| Dashboard (§15) | Built from |
|---|---|
| Conversion | `view_item` → `add_to_cart` → `begin_checkout` → `purchase` |
| Cart abandonment | `begin_checkout` against `purchase` |
| Fulfilment mix | `select_fulfilment` |
| Top items | `view_item` and `add_to_cart`, by `productId` / `categoryId` |
| Repeat ordering | `reorder`, against `purchase` |

`purchase` carries `orderId` so the warehouse can deduplicate. It fires once
per placed order today, but a retry that reached the kitchen twice would
otherwise double a day's revenue in a chart nobody would think to question —
deduplicate on it rather than trusting the client.

No payload carries personal information: ids, counts and amounts only.
`search` sends the query's length and result count, never the words.
`analytics.test.ts` fails on a payload field named for anything identifying.
