# Integrations

NMU ONE is an orchestration layer over NMU's existing systems (brief §7). The app
never calls those systems directly. It talks to one **backend-for-frontend
(BFF)** that NMU ONE owns. The BFF holds every credential, calls each
specialist system, and maps the answers into NMU ONE's domain models.

```
 NMU ONE app ──HTTPS + bearer──▶ NMU ONE BFF ──▶ NMU SSO (OIDC)
 (src/core/adapters/live.ts)     (to build)  ──▶ Student information system
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

**Still to build for live sign-in:** the app-side browser step: open the
issuer's authorize URL with PKCE (for example with `expo-auth-session`), receive
the code on the `nmuone://` redirect, then call `POST /v1/auth/session`. The
config variables and the session store are already in place.

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
| `POST /v1/payments` | Payment intent with the approved payment provider. Body: `{ amount, method, purpose }`. Must be **idempotent**. |
| `POST /v1/payments/{id}/confirm` | `Receipt`, once the provider confirms |
| `GET /v1/payments/receipts/{id}` | `Receipt` |

NMU ONE never sees card details. **Still to build:** the hand-off to the
provider's hosted page between creating and confirming a payment; the mock
confirms immediately.

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

Live delivery is by push (`expo-notifications`). Every notification carries an
`action.href`: an NMU ONE route such as `/money/funding`. The app opens it when
tapped, and settles the notice when the person visits that screen. **Still to
build:** registering the device's push token with the BFF (a `POST /v1/me/devices`
route would complete the contract).

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

## The operator console

The console (`admin/`) shares the domain models and permission policy. Its
actions are in `admin/src/lib/store.ts`; in demo mode they write to the browser.
A live console needs BFF routes for: notification campaigns (create, submit,
approve or return, schedule, withdraw, metrics), audiences (with reach counts
only), events, vendors and menus, help articles, moderation reports, operator
roles, and the audit log. Each must check the operator's permissions on the
server and write an audit entry. Separation of duties (nobody approves their own
notice) must be enforced there too.

## Offline and caching

`src/core/offline/policy.ts` decides what may be stored on the device. Today's
timetable, notifications, campus information, tickets and safety contacts are
cached. **Money, funding, results, guardian views and wellbeing are never
cached** (brief §25), and the BFF should send `Cache-Control: no-store` on those
routes too.

## Checklist for going live

- [ ] NMU registers an OIDC client for NMU ONE; the app-side PKCE browser step is built.
- [ ] The BFF is built and hosted; `EXPO_PUBLIC_BFF_BASE_URL` points at it.
- [ ] Each system owner agrees what their adapter may return (minimum necessary data).
- [ ] Payment and donations providers are chosen and the hand-off pages integrated.
- [ ] Protection Services confirms campus numbers; help-article owners approve their articles.
- [ ] Push notifications: provider credentials, the device-registration route and quiet-hours handling.
- [ ] Privacy, security and legal review of safety, location, finance and identity features (brief §33).
