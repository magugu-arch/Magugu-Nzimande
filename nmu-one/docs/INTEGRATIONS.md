# Integrations

NMU ONE is an orchestration layer over NMU's existing systems (brief §7). The app
never calls those systems directly. It talks to one **backend-for-frontend
(BFF)** that NMU ONE owns. The BFF holds every credential, calls each
specialist system, and maps the answers into NMU ONE's domain models.

```
 NMU ONE app ──HTTPS + bearer──▶ NMU ONE BFF ──▶ NMU SSO (OIDC)
 (src/core/adapters/live.ts)     (bff/)      ──▶ Student information system
                                             ──▶ Finance, funding, payment provider
                                             ──▶ LMS, library, transport, residence
 Operator console ──────────────────────────▶ ──▶ Commerce, alumni CRM, push service
```

> **Nothing below is an NMU endpoint.** The `/v1/...` routes are NMU ONE's own
> BFF contract, designed here. How the BFF reaches each NMU system is for NMU's
> IT teams to decide; this prototype makes no assumptions about their APIs.

## How the adapters work

Each system sits behind a typed contract in `src/core/adapters/contracts.ts`,
with three implementations:

| Implementation | File | Used when |
|---|---|---|
| Mock | `src/core/adapters/mock/*.ts` | `EXPO_PUBLIC_DATA_MODE=mock` (default). Synthetic data from `src/core/fixtures`, with realistic latency and failure injection. |
| Live | `src/core/adapters/live.ts` | `EXPO_PUBLIC_DATA_MODE=live`. Thin `fetch` clients of the BFF routes below. |
| Test | `setProvidersForTesting()` | Unit tests. |

Screens never import an adapter. They call hooks in `src/data/hooks.ts`, which
call `providers` from `src/core/adapters/registry.ts`. Switching from mock to
live changes no screen code.

### Conventions for every route

- JSON over HTTPS. `Authorization: Bearer <access token>` on every request after sign-in.
- `X-NMU-Role: <role>` says which of the person's roles the app is acting in (someone can be staff and an alumnus). The BFF refuses a role the person doesn't hold, and applies the policy for the role named.
- Requests time out after 15 seconds.
- The BFF answers with NMU ONE's domain models (`src/core/domain/models.ts`): money in integer cents (`{ cents, currency: 'ZAR' }`) and times as ISO 8601 instants.
- The BFF enforces permissions itself. The app's checks (`src/core/permissions/policy.ts`) shape the experience; they are not the security boundary.
- Errors map to `AdapterError` kinds, which the screens already handle:

| HTTP | Kind | What the person sees |
|---|---|---|
| 401 | `unauthorised` | Signed out, asked to sign in again |
| 403 | `forbidden` | The permission-denied state |
| 404 | `not-found` | "Not found" with a way back |
| 409 | `conflict` | e.g. "That study space was just booked" |
| 400, 422 | `invalid` | The form's error message |
| other / network | `unavailable` / `offline` | Error or offline state, with retry |
| no BFF URL set | `not-configured` | Error state; never demo data |

## The contract, by system

Each table lists the BFF route, what it returns, and the NMU system that would
supply it. "Me" routes act on the signed-in person, identified by the token,
never by an ID in the URL.

### Identity: NMU SSO

| Route | Returns | Notes |
|---|---|---|
| `POST /v1/auth/session` | `SignInResult` | Exchanges an OIDC authorization code (+ PKCE verifier) for an NMU ONE session. |
| `POST /v1/auth/refresh` | `AuthSession` | Body: `{ refreshToken }`. |
| `POST /v1/auth/sign-out` | — | Revokes the session. |
| `GET /v1/me/student` | `StudentProfile` | Student number, programme, graduation eligibility. |
| `GET /v1/me/staff` | `StaffProfile` | |
| `POST /v1/me/lifecycle/alumni` | `User` | Moves the **same identity** to the alumni stage (brief §14). The BFF decides eligibility. |

The person's roles come from SSO claims; NMU ONE never asks someone to pick a
role they don't hold. Tokens are kept only in the device keychain
(`expo-secure-store`; `sessionStorage` on web) and in memory.

**How live sign-in works** (`src/features/auth/sso.ts`, `src/core/auth/oidc.ts`):

1. The app reads `<EXPO_PUBLIC_OIDC_ISSUER>/.well-known/openid-configuration`
   and checks the issuer matches and S256 PKCE is supported.
2. It makes a random 32-byte verifier and state (`expo-crypto`) and opens the
   authorize URL with `response_type=code`, the S256 challenge and the state.
   iOS and Android use the system authentication session
   (`expo-web-browser`); the web build sends the whole tab, keeping the
   verifier in that tab's `sessionStorage` for ten minutes at most.
3. NMU SSO returns to `nmuone://auth/callback` (web: `/auth/callback`). The
   app rejects a response whose state isn't its own, then posts
   `{ code, codeVerifier, redirectUri }` to `POST /v1/auth/session`.
4. The BFF exchanges the code with NMU SSO **as a confidential client**,
   maps the claims to an NMU ONE `User`, and returns its own opaque session.
   NMU SSO's tokens never reach the device.

The app is a public client and holds no secret; a stolen code is useless
without the verifier. `src/app/+native-intent.tsx` keeps the router from
also opening the redirect while the browser session is waiting for it.

### Academic: student information system

| Route | Returns |
|---|---|
| `GET /v1/academic/timetable?from&to` | `TimetableEntry[]`, including venue changes and cancellations |
| `GET /v1/academic/teaching?from&to` | `TimetableEntry[]` for staff |
| `GET /v1/academic/assessments` | `Exam[]` |
| `GET /v1/academic/results` | `Result[]` (published results only) |
| `GET /v1/academic/progress` | `AcademicProgress` |
| `GET /v1/academic/modules` | `Module[]` |
| `GET /v1/academic/calendar` | `AcademicDate[]` (public calendar) |

### LMS

| Route | Returns |
|---|---|
| `GET /v1/learning/modules/{code}/links` | `LmsLink[]`. `url` may be `null` until the LMS deep-link format is confirmed; the app then says so rather than guessing a link. |

### Finance and funding

| Route | Returns |
|---|---|
| `GET /v1/finance/account` | `FeeAccount`, with an `asAt` time that the app always shows |
| `GET /v1/finance/transactions` | `FeeTransaction[]` |
| `GET /v1/finance/funding` | `FundingStatus` (e.g. NSFAS allowance status) |
| `POST /v1/payments` | `PaymentIntent` with the approved payment provider. Body: `{ amount, method, purpose, returnUrl }`. Must be **idempotent**. When the provider has a hosted page, `redirectUrl` is its address. |
| `POST /v1/payments/{id}/confirm` | `Receipt`, once the provider confirms. Only the person who started the payment can confirm it. |
| `GET /v1/payments/receipts/{id}` | `Receipt` |

NMU ONE never sees card details. **The hand-off** (`src/features/money/payment.tsx`):
when a payment comes back with a `redirectUrl`, the app opens the provider's
page (the system browser on a phone; a provider window on the web, opened
from one more tap because browsers block windows that aren't). The provider
returns to `returnUrl` (`nmuone://payments/return`, or `/payments/return` on
the web) with `paymentId` and `status`. The app confirms only an `approved`
return for that payment; a cancel says nothing was charged. The BFF must
still check with the provider before issuing a receipt: the return URL is a
convenience, not proof of payment. Without a `redirectUrl` the app confirms
straight away, as the mocks do.

### Library

| Route | Returns |
|---|---|
| `GET /v1/library/search?q` | `LibraryResource[]` |
| `GET /v1/library/spaces?day` | `StudySpace[]` with free slots |
| `POST /v1/library/bookings` | `StudySpaceBooking`; `409` if the slot has gone |
| `GET /v1/library/bookings` | `StudySpaceBooking[]` |
| `POST /v1/library/bookings/{id}/cancel` | — |

### Transport

| Route | Returns |
|---|---|
| `GET /v1/transport/routes` | `ShuttleRoute[]` |
| `GET /v1/transport/arrivals?stop` | `ShuttleArrival[]`, marked `live` or `scheduled` |
| `GET /v1/transport/disruptions` | `ServiceDisruption[]` |

### Residence

| Route | Returns |
|---|---|
| `GET /v1/residence` | `Residence`, with open requests |
| `POST /v1/residence/requests` | `ResidenceRequest` |

### Campus

| Route | Returns |
|---|---|
| `GET /v1/campus/map` | `CampusMap`: buildings, entrances and a walking graph. The prototype's South Campus map is **schematic**; a mapping provider is still to be chosen. |
| `GET /v1/campus/directory` | `DirectoryPerson[]`: work contact details only |

### Commerce

| Route | Returns |
|---|---|
| `GET /v1/commerce/vendors` | `Vendor[]` with opening hours and whether they take orders |
| `GET /v1/commerce/vendors/{id}/menu` | `MenuItem[]` with availability |
| `POST /v1/commerce/orders` | `Order`, after payment |
| `GET /v1/commerce/orders`, `GET /v1/commerce/orders/{id}` | `Order` status and pickup code |

When an order is ready the BFF sends a push notification (`orders` category) with
the action `/dining/order/{id}`.

### Events and societies

| Route | Returns |
|---|---|
| `GET /v1/events`, `GET /v1/events/{id}` | `CampusEvent` |
| `POST /v1/events/{id}/tickets` | `Ticket` with its QR code. Body: `{ paymentId }` (null for free events) |
| `GET /v1/me/tickets` | `Ticket[]` |
| `GET /v1/societies` | `Society[]`, with `joined` for the signed-in person |
| `POST /v1/societies/{id}/membership` | — |

### Notifications

| Route | Returns |
|---|---|
| `GET /v1/notifications` | `AppNotification[]` for the signed-in person |
| `POST /v1/notifications/{id}/read` | — |
| `POST /v1/notifications/read-all` | — |
| `POST /v1/me/devices` | — Body: `{ token, platform: 'ios' \| 'android' }`. Registers this device's Expo push token for the signed-in person. |

Live delivery is by push (`expo-notifications`). Once the person has allowed
notifications (Settings → Notifications; signing in never prompts), the app
registers its Expo push token with `POST /v1/me/devices` at each sign-in
(`src/features/notifications/push.ts`). While open, the live app also checks
the inbox every `EXPO_PUBLIC_NOTIFICATION_POLL_SECONDS`, so someone who keeps
push off still sees new notices as banners. Every notification carries an
`action.href`: an NMU ONE route such as `/money/funding`. The app opens it
when tapped, and settles the notice when the person visits that screen.

### Support, safety and help content

| Route | Returns |
|---|---|
| `GET /v1/support/safety-contacts` | `SafetyContact[]`. Campus numbers must be confirmed by Protection Services (`verified: true`) before they are shown as callable |
| `GET /v1/support/wellbeing` | `WellbeingService[]` |
| `GET /v1/support/routes` | `SupportRoute[]` |
| `POST /v1/safety/location-shares` | Starts a time-limited location share with Campus Protection |
| `POST /v1/safety/location-shares/{id}/stop` | Stops it |
| `GET /v1/content/knowledge` | `KnowledgeArticle[]`: **approved articles only**. The assistant answers from nothing else |

Safety contacts are also bundled in the app, so they work with no signal at all.

### Parents and guardians

| Route | Returns |
|---|---|
| `GET /v1/guardian` | The guardian's profile and linked students, with the scopes each student shares |
| `GET /v1/guardian/students/{id}/updates` | Only what the student shares |
| `GET /v1/guardian/students/{id}/fees` | `FeeAccount`, only if the student shares `fees`; otherwise `403` |
| `GET /v1/me/guardians` | The student's linked guardians |
| `POST /v1/me/guardians/{id}/sharing` | The student changes what a guardian may see. Body: `{ sharing }` |

Consent is the student's to give and withdraw at any time (brief §3). The BFF
must enforce it on every guardian route; the app's checks are a convenience.

### Alumni and giving: alumni CRM

| Route | Returns |
|---|---|
| `GET /v1/alumni/profile` | `AlumniProfile` |
| `GET /v1/alumni/mentoring` | `MentoringOpportunity[]` |
| `POST /v1/alumni/mentoring/{id}` | Body: `{ accept }` |
| `GET /v1/alumni/jobs` | `Job[]` |
| `GET /v1/alumni/stories`, `GET /v1/alumni/chapters` | Stories and chapters |
| `GET /v1/giving/campaigns` | `GivingCampaign[]` |
| `POST /v1/giving/pledges` | A pledge, paid through the approved donations provider |

## The reference BFF

`bff/` is a working BFF for this contract: a dependency-free Node server
(`bff/src`) that serves every route above from the same mock connectors the
app uses in demo mode. It exists so the live client, sign-in and the security
boundary can be proved end to end before NMU's systems are connected, and as
the starting point for the production BFF.

What it already does, and the production BFF must keep doing:

- **Sessions:** opaque bearer tokens it issues itself, with refresh rotation
  and sign-out (`bff/src/auth.ts`).
- **The permission policy on every route** (`bff/src/routes.ts` names each
  route's capability): the app's own `decide()` from `src/core/permissions`,
  run server-side for the role in `X-NMU-Role`, the person's lifecycle stage
  and, for a parent, only what the student shares.
- **Ownership:** bookings, payments and guardian links belong to one person;
  nobody can confirm or cancel someone else's.
- **Sign-in:** authorization code + PKCE; codes are single-use, expire in a
  minute and are bound to the verifier and the redirect URI.
- **An audit log** of sensitive reads, payments, lifecycle changes and
  denials.

What a production BFF replaces: each mock connector with a connector to the
NMU system (one file per domain in `src/core/adapters/mock` shows the shape);
the development SSO page with a real code exchange against NMU SSO; the
development payment page with the provider; the in-memory sessions and audit
log with durable stores; and it runs with `BFF_DEV=0`. Settings are in
[ENVIRONMENT.md](ENVIRONMENT.md#reference-bff-bff).

`npm run e2e:live` starts it and runs the full pitch journey against the live
web build: sign-in through the development SSO page, both payments through
the development provider page, and the audit log printed at the end.
`__tests__/bff.test.ts` covers the boundary: sessions, roles, parent consent,
PKCE and payment ownership.

## The operator console

The console (`admin/`) shares the domain models and permission policy. Every
console action is a plain function in `admin/src/lib/actions.ts`: it checks
the operator's permission, makes the change and writes the audit entry. In demo
mode the console runs them in the browser. In live mode
(`NEXT_PUBLIC_CONSOLE_MODE=live`) staff sign in with NMU SSO and the BFF runs
the same functions, as the operator it signed in:

| Route | Returns | Notes |
|---|---|---|
| `POST /v1/console/session` | `{ session, operator }` | Body: `{ code, codeVerifier, redirectUri }` from the console's own OIDC client (`nmu-one-console`). Codes issued to the app are refused, and an app session can't call the console (or the reverse). |
| `GET /v1/console/state` | `ConsoleData` | Campaigns, audiences, events, vendors, articles, moderation, operators and the audit log. The console refreshes it every five seconds. |
| `POST /v1/console/actions/{name}` | `{ message, id?, data }` | `name` is one of the actions in `ActionArgs` (`saveCampaign`, `approveCampaign`, `requestChanges`, `deliverNow`, `withdrawCampaign`, `sendEmergency`, `saveSegment`, `createEvent`, `setEventStatus`, `setVendor`, `setItemAvailable`, `updateArticle`, `approveArticle`, `moderate`, `setOperatorRole`). 403 when the role doesn't allow it; 422 with the reason when the rules don't (for example, approving your own notice). |

Scoped publishing, separation of duties (nobody approves their own notice,
administrators included) and the audit trail are therefore enforced on the
server, which also sends scheduled notices when they fall due. The reference
BFF (`bff/src/console.ts`) holds this in memory; a production BFF keeps it in
a database, takes operators and their roles from NMU's staff directory, and
hands approved notices to the push service.

## Offline and caching

`src/core/offline/policy.ts` decides what may be stored on the device. Today's
timetable, notifications, campus information, tickets and safety contacts are
cached. **Money, funding, results, guardian views and wellbeing are never
cached** (brief §25), and the BFF should send `Cache-Control: no-store` on those
routes too.

## Checklist for going live

- [ ] NMU registers an OIDC client for NMU ONE with the redirect URIs `nmuone://auth/callback` and `https://<web host>/auth/callback`. *(The app side is built.)*
- [ ] The production BFF: the reference BFF's connectors replaced with NMU systems, a real code exchange, durable sessions and audit log, hosted with `BFF_DEV=0`; `EXPO_PUBLIC_BFF_BASE_URL` points at it.
- [ ] Each system owner agrees what their adapter may return (minimum necessary data).
- [ ] Payment and donations providers are chosen; the BFF returns their hosted page as `redirectUrl` and verifies each payment with them. *(The app's hand-off is built.)*
- [ ] Protection Services confirms campus numbers; help-article owners approve their articles.
- [ ] Push notifications: an EAS project ID and push credentials, sending from the BFF to the registered tokens, and quiet hours honoured there too. *(Device registration is built.)*
- [ ] Operator console: an OIDC client for staff (`nmu-one-console`), operators and roles from NMU's staff directory, and a database for its data. *(Live sign-in and server-side actions are built.)*
- [ ] Privacy, security and legal review of safety, location, finance and identity features (brief §33).
