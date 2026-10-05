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
| `EXPO_PUBLIC_OIDC_ISSUER` | *(empty)* | URL | NMU SSO's OpenID Connect issuer. Used for authorization-code + PKCE sign-in. |
| `EXPO_PUBLIC_OIDC_CLIENT_ID` | *(empty)* | string | The public client ID NMU's identity team registers for NMU ONE. Public by design: PKCE needs no client secret. |
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

# A live build (fails clearly until the BFF and SSO exist)
EXPO_PUBLIC_DATA_MODE=live \
EXPO_PUBLIC_DEMO_CLOCK=live \
EXPO_PUBLIC_BFF_BASE_URL=https://one-api.example.ac.za \
EXPO_PUBLIC_OIDC_ISSUER=https://sso.example.ac.za \
EXPO_PUBLIC_OIDC_CLIENT_ID=nmu-one \
npx expo export
```

## Operator console (`admin/`)

| Variable | Default | Effect |
|---|---|---|
| `EXPO_PUBLIC_DEMO_CLOCK` | `scenario` | Passed through `admin/next.config.ts` so the console runs on the same clock as the app. Set at build time. |

The console keeps its demo state in the browser's `localStorage` (one demo per
demo day; **Reset demo** starts over). It has no live mode yet: the store's
actions in `admin/src/lib/store.ts` are where BFF calls would go, behind the
same permission checks.

## Tests and tooling

| Variable | Used by | Effect |
|---|---|---|
| `CHROMIUM_PATH` | `e2e/*.mjs`, `admin/e2e/console.mjs` | Chromium to drive. Defaults to `/opt/pw-browsers/chromium` if present, else Playwright's own browser (`npx playwright install chromium`). |
| `NEXT_TELEMETRY_DISABLED` | console build | Set to `1` in CI. |
