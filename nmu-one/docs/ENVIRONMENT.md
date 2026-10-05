# Environment variables

NMU ONE needs **no** environment variables to run: the defaults use the bundled
mock adapters and the demo clock. Copy `.env.example` to `.env.local` to change
anything.

Expo inlines `EXPO_PUBLIC_*` variables into the app bundle at build time, so
**nothing secret belongs here**. Credentials for NMU systems live only in the
backend-for-frontend (BFF); see [INTEGRATIONS.md](INTEGRATIONS.md).

All variables are read in one place, `src/core/config.ts`.

## App

| Variable | Default | Values | Effect |
|---|---|---|---|
| `EXPO_PUBLIC_DATA_MODE` | `mock` | `mock`, `live` | `mock` serves every domain from the synthetic adapters in `src/core/adapters/mock`. `live` uses the BFF clients in `src/core/adapters/live.ts`. Settings → About says which one is running. |
| `EXPO_PUBLIC_BFF_BASE_URL` | *(empty)* | `https://…` | Base URL of the NMU ONE BFF, e.g. `https://one-api.example.ac.za`. In live mode every request rejects with `not-configured` until this is set, so a live build can never show demo data by accident. |
| `EXPO_PUBLIC_OIDC_ISSUER` | *(empty)* | URL | NMU SSO's OpenID Connect issuer. In live mode, once this and the client ID are set, **Continue with NMU Single Sign-On** runs authorization code + PKCE against it (discovery at `<issuer>/.well-known/openid-configuration`). |
| `EXPO_PUBLIC_OIDC_CLIENT_ID` | *(empty)* | string | The public client ID NMU's identity team registers for NMU ONE. Public by design: PKCE needs no client secret. Register the redirect URIs `nmuone://auth/callback` (iOS, Android) and `https://<web host>/auth/callback` (web). |
| `EXPO_PUBLIC_NOTIFICATION_POLL_SECONDS` | `20` | seconds ≥ 2 | Live mode: how often the open app checks the inbox for new notifications, so new notices appear even for someone who keeps push off. |
| `EXPO_PUBLIC_DEMO_CLOCK` | `scenario` | `scenario`, `live` | `scenario` starts the clock at 09:40 SAST on the next weekday (today, unless it's a weekend) and lets it run, so the pitch reads the same at any hour. `live` uses the device clock. Use `live` for anything other than a demo. |
| `EXPO_PUBLIC_MOCK_LATENCY_MS` | `350` | ms ≥ 0 | Delay added to every mock call, so loading states are visible. `0` for snappy demos. |
| `EXPO_PUBLIC_MOCK_FAILURES` | *(empty)* | comma-separated domains | Mock domains that should fail, to demonstrate error states. Domains: `auth, academic, learning, finance, library, transport, residence, commerce, community, alumni, notifications, campus, support, guardian`. Example: `finance,transport`. |
| `EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS` | `20` | seconds ≥ 0 | Time between paying for a campus order and the mock kitchen marking it ready (which sends the pickup notification). |

Session length is fixed at 8 hours in `src/core/config.ts` (`sessionMinutes`);
change it there if NMU's security policy requires something else.

### Examples

```bash
# A presentation build with quick responses
EXPO_PUBLIC_MOCK_LATENCY_MS=0 npm run export:web

# Show the finance error states
EXPO_PUBLIC_MOCK_FAILURES=finance npm start

# The live build against the reference BFF on this machine
npm run bff                 # terminal 1: http://127.0.0.1:8787
npm run export:live         # terminal 2: web build in dist-live/
npm run e2e:live            # or: the pitch journey through both

# A live build for NMU's own BFF and SSO
EXPO_PUBLIC_DATA_MODE=live \
EXPO_PUBLIC_DEMO_CLOCK=live \
EXPO_PUBLIC_BFF_BASE_URL=https://one-api.example.ac.za \
EXPO_PUBLIC_OIDC_ISSUER=https://sso.example.ac.za \
EXPO_PUBLIC_OIDC_CLIENT_ID=nmu-one \
npx expo export
```

Web exports clear the bundler cache (`--clear`): Metro would otherwise reuse
a transformed `config.ts` from a build with different `EXPO_PUBLIC_*` values,
and a demo build could end up pointing at a BFF.

## Reference BFF (`bff/`)

`npm run bff` builds and starts it. It serves the whole contract over the mock
connectors (see [INTEGRATIONS.md](INTEGRATIONS.md#the-reference-bff)). These
are server-side variables, never inlined into the app.

| Variable | Default | Effect |
|---|---|---|
| `PORT` | `8787` | Port to listen on. |
| `BFF_PUBLIC_URL` | the request's host | The BFF's own address, used in discovery and payment-page links when it sits behind a proxy. |
| `BFF_DEV` | on | The development stand-ins: the NMU SSO sign-in page (`/dev-sso/*`), the payment page (`/dev-pay/*`) and persona sign-in without a code. `0` turns them all off, so only a real code exchange signs anyone in. |
| `BFF_DEV_PERSONA` | `student` | Who a code-less development sign-in returns. |
| `BFF_PAYMENT_PAGE` | off | `1` hands payments to the development payment page and confirms only what it approved. Off, payments confirm directly, like the mocks. |
| `BFF_SESSION_MINUTES` | `480` | How long an NMU ONE session lasts. The app reads the expiry from the session and asks the person to sign in again when it passes. |
| `BFF_ORDER_READY_SECONDS` | `20` | Time until the mock kitchen marks an order ready. |
| `BFF_CLOCK` | `scenario` | `scenario` or `live`, as `EXPO_PUBLIC_DEMO_CLOCK`. |
| `BFF_LATENCY_MS` | `0` | Delay added to every mock connector call. |
| `BFF_LOG` | off | `1` prints each audit-log entry as a JSON line. |

## Operator console (`admin/`)

| Variable | Default | Effect |
|---|---|---|
| `EXPO_PUBLIC_DEMO_CLOCK` | `scenario` | Passed through `admin/next.config.ts` so the console runs on the same clock as the app. Set at build time. |
| `NEXT_PUBLIC_CONSOLE_MODE` | *(demo)* | `live` makes the console sign staff in with NMU SSO and keep its data on the BFF. `npm run build:live` sets it. |
| `NEXT_PUBLIC_BFF_BASE_URL` | *(empty)* | The BFF the live console talks to (`/v1/console/*`). |
| `NEXT_PUBLIC_OIDC_ISSUER` | *(empty)* | NMU SSO's issuer, for staff sign-in. |
| `NEXT_PUBLIC_OIDC_CLIENT_ID` | `nmu-one-console` | The console's own OIDC client; register `https://<console host>/auth/callback/` as its redirect. |

`npm run build:live` reads `BFF_URL` (default `http://127.0.0.1:8787`) for the
last two and writes the build to `out-live/`. In demo mode the console keeps its
state in the browser's `localStorage` (one demo per demo day; **Reset demo**
starts over); live, it keeps only the session, for the life of the tab.

## Tests and tooling

| Variable | Used by | Effect |
|---|---|---|
| `CHROMIUM_PATH` | `e2e/*.mjs`, `admin/e2e/console.mjs` | Chromium to drive. Defaults to `/opt/pw-browsers/chromium` if present, else Playwright's own browser (`npx playwright install chromium`). |
| `NEXT_TELEMETRY_DISABLED` | console build | Set to `1` in CI. |
