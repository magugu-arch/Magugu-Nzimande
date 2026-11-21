# Architecture overview

Home Affairs One is a non-production concept prototype: one static web app in which every back-end
"service" is a typed mock that runs in the browser. This document describes what is really in the
repository, how a request and a status event move through it, how that compares with the target
architecture proposed in the product brief (`docs/product/home-affairs-one-brief.md`), and what a
real build would need in place of each stand-in.

Status: describes the prototype as built. The target architecture is the brief's proposal, not a
description of DHA's systems, and has not been reviewed by a DHA architecture or security authority.

## What the prototype is, and is not

| It is                                                                                    | It is not                                                                               |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| One Next.js app (`apps/web`) built as a static export — HTML, CSS, JavaScript and images | A server, an API or a database. Nothing runs outside the person's browser               |
| A citizen experience, a staff console (`/staff`) and a partner sandbox (`/partner`)      | Separate deployables. The brief asks for them to be separate; see `decisions.md`        |
| Mock services behind typed ports, composed by a client-side gateway                      | An integration with any DHA, bank, payment, messaging or identity system                |
| Synthetic people, cases, places and sample service content, labelled as such             | A source of real fees, requirements, timeframes, office names or case outcomes          |
| A demonstration of patterns: idempotency, safe errors, audit, consent, masked references | A security boundary. Sign-in is a mock and route guards run in the browser only         |
| A `noindex` site with a concept ribbon on every screen                                   | An official Department of Home Affairs product, or a statement that DHA has approved it |

## Prototype runtime

Everything below runs in one browser tab. The only network traffic is the browser fetching the
static files of the site itself.

```text
 Browser tab
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │ Channel app — apps/web (Next.js static export)                                │
 │   citizen screens · /staff console · /partner sandbox                         │
 │   packages: design-system · accessibility · auth-client (mock session)        │
 │   hooks: useGatewayQuery / useGatewayMutation (TanStack Query, retries off)   │
 └──────────────────────────────────┬────────────────────────────────────────────┘
                                    │ typed ports (packages/api-contracts)
 ┌──────────────────────────────────▼────────────────────────────────────────────┐
 │ Client gateway — services/api-gateway                                         │
 │   simulated latency · timeout · retry with back-off · idempotency keys        │
 │   correlation ID · safe error mapping (GatewayError) · audit · call record    │
 └──────────────────────────────────┬────────────────────────────────────────────┘
                                    │ direct function calls (no network)
 ┌──────────────────────────────────▼────────────────────────────────────────────┐
 │ Mock services — services/*                                                    │
 │   identity-adapter · service-catalogue · application-workflow · appointments  │
 │   payments-adapter · notifications · whatsapp-adapter · support-desk          │
 │   audit-service                                                               │
 └──────────────────────────────────┬────────────────────────────────────────────┘
                                    │ collections, clock, ids, event bus
 ┌──────────────────────────────────▼────────────────────────────────────────────┐
 │ Local platform — infrastructure/local                                         │
 │   key-value store over localStorage (namespace `hao.v1:`) · clock (SAST) ·    │
 │   identifier counters · in-memory event bus · simulated network settings      │
 └───────────────────────────────────────────────────────────────────────────────┘
   sessionStorage: mock session (`hao.session.v1`)
   localStorage:   demo data, accessibility preferences, feature-flag overrides
```

## Target architecture (from the brief)

The brief (§11) proposes a "secure, API-first, modular architecture" in which "the app must not
connect directly to mainframe or register databases" and "every access should pass through an API
gateway and policy-enforcement layer". It labels this a conceptual target, not a picture of DHA's
current infrastructure. Its layers, summarised:

| Layer            | Components the brief lists                                                     | Design requirement the brief states                                     |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Experience       | iOS, Android, PWA/web, WhatsApp, email, SMS, agent/partner portal              | Channel-specific UX, shared design system, consistent case context      |
| Edge / API       | API gateway, WAF, OAuth/OIDC, rate limits, consent/purpose checks              | No direct database access; versioned APIs; identity and device trust    |
| Identity         | Customer identity provider, passkeys, MFA, proofing, issuer/verifier           | Assurance level by risk; secure recovery; trust governance              |
| Service domains  | Civic, passport, immigration, ETA, appointment, payment, notification, support | Bounded domains; clear system-of-record ownership                       |
| Workflow         | Case orchestration, document management, rules, SLA, staff tasks, appeals      | Human review, exception queues, traceable decisions, idempotent actions |
| Integration      | API adapters, event bus, partner connectors, message broker, ETL               | Decoupled from legacy; retry, dead-letter queues, reconciliation        |
| Data and insight | Operational data store, reporting, analytics, fraud signals, audit log         | Purpose limitation, lineage, retention, access separation               |
| Operations       | Observability, SIEM/SOC, secrets, HSM/KMS, backup, DR, support                 | Resilience with tested incident and recovery plans                      |

## Target layer → prototype stand-in → what a real build needs

| Target layer / component      | What stands in for it in the prototype                                                                                 | What a real build needs                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Web / PWA                     | `apps/web`, static export, web app manifest, a service worker that caches only the site's own static files             | Server-side enforcement behind it; security headers and CSP set by the host; approved hosting                     |
| iOS / Android apps            | Nothing. Deferred (PWA first)                                                                                          | Native apps with secure storage, platform biometrics and accessibility, per the brief §17                         |
| Staff console, partner portal | Routes `/staff` and `/partner` inside the same app, behind a client-side `RequireRole` guard                           | Separate deployables in a separate network zone, workforce identity, hardware-bound MFA, privileged access        |
| WhatsApp, email, SMS, push    | `whatsapp-adapter` mock (templates, opt-in, chat log). Email, SMS and push exist only as delivery-log rows             | Real provider adapters, an approved template registry, sender verification, delivery webhooks, fallback           |
| API gateway, WAF, rate limits | `services/api-gateway`: a client-side wrapper that applies call policy. No WAF, no rate limiting, no enforcement       | A gateway that authenticates, authorises, rate-limits and checks consent and purpose on the server                |
| Identity provider             | `packages/auth-client`: a session object in `sessionStorage`; a passkey stub that always succeeds                      | An approved OIDC provider, WebAuthn, proofing, recovery, risk signals, HSM/KMS — defined by DHA's trust framework |
| Service-domain APIs           | In-browser mocks behind `IdentityPort`, `CataloguePort`, `WorkflowPort`, `AppointmentsPort`, `PaymentsPort`, and so on | Domain services with OpenAPI contracts, owned by named system owners, in front of the systems of record           |
| Workflow / case management    | `application-workflow`: a case lifecycle held as data; staff actions; a "simulate next event" control                  | The department's case platform, with human tasks, SLA timers, appeals and document management                     |
| Rules and content             | `service-catalogue`: versioned sample content (`sample-0.1`) bundled into the app                                      | A content and rules service with legal owner approval, versioning and effective dates                             |
| Event bus, message broker     | An in-memory publish/subscribe bus inside one tab. Not durable, no ordering guarantees, no dead-letter queue           | A durable broker with a schema registry, retries, dead-letter queues and reconciliation                           |
| Operational data store        | JSON documents in the browser's `localStorage`                                                                         | Managed databases and object storage with encryption, retention schedules and access separation                   |
| Audit log                     | `audit-service`: an append-only interface over `localStorage`, with a check that refuses values that look like PII     | A tamper-evident, access-controlled audit store with retention rules, feeding a SIEM                              |
| Payments                      | `payments-adapter`: a sandbox record and a chosen outcome. No money, no card data                                      | A hosted payment page, signed server-side callbacks, reconciliation and refunds                                   |
| Observability                 | `GatewayCallRecord` events on the bus (service, method, outcome, attempts, duration)                                   | OpenTelemetry traces, central privacy-aware logs, metrics, SIEM/SOC                                               |
| Secrets, HSM/KMS, backup, DR  | Nothing. There are no secrets, keys or servers to protect                                                              | All of it, designed with DHA security and hosting authorities                                                     |
| Systems of record             | Nothing. `sourceOfTruth` on a case is the literal `DHA_WORKFLOW_ADAPTER_MOCK`                                          | Governed adapters to the authoritative registers; the brief is clear they remain the source of truth              |

## Request lifecycle through the gateway

This is what `services/api-gateway/src/index.ts` does for every call. Screens reach it through
`useGatewayQuery` and `useGatewayMutation` (`apps/web/src/lib/queries.ts`), which use one gateway
per browser tab.

1. **Proxy.** Each port is wrapped in a `Proxy`, so a call such as
   `gateway.workflow.submitApplication(input, { idempotencyKey })` is routed through one `invoke`
   function.
2. **Classify and tag.** The call gets a correlation ID (`CORR-…`). A method whose name starts with
   `get`, `list` or `search` is a read; anything else is a mutation.
3. **Idempotency.** A mutation must carry `{ idempotencyKey }` as its last argument. Without one it
   is refused with a `VALIDATION` error (the one exception is `audit.record`). If a result is
   already stored for that operation and key, it is returned at once and the service is not called
   again. The last 200 results are kept in the local store.
4. **Simulated conditions.** Each attempt reads the platform settings. `offline` fails immediately
   with `OFFLINE`. Otherwise the gateway waits the simulated latency (220 ms by default, 2.4 s in
   `slow` mode), and in `error` mode fails with `UNAVAILABLE`.
5. **Timeout.** The service call is raced against a timeout (8 seconds by default) that maps to
   `TIMEOUT`.
6. **Retry.** Retryable failures (`TIMEOUT`, `UNAVAILABLE`, `RATE_LIMITED`) are retried up to twice
   more, waiting 200 ms and then 400 ms. `OFFLINE` is never retried.
7. **Safe errors.** Whatever was thrown is mapped to a `GatewayError`: a category, a message that
   is safe to show a member of the public, and the correlation ID as a trace reference. Unknown
   failures become `UNKNOWN` with a generic message; stack traces and internal detail are dropped.
8. **Audit.** Every mutation is recorded in the audit service, and so is every read made by a staff
   or partner actor. The event holds the actor's opaque reference, `service.method`, the first
   opaque `…-DEMO-…` token found in the arguments, the outcome (`SUCCESS`, `DENIED` for
   `FORBIDDEN`, otherwise `FAILED`) and the correlation ID. A failure to write the audit event is
   swallowed so the journey continues; a real system would raise an alert.
9. **Call record.** A `GatewayCallRecord` is published on the `gateway.call` topic. It never
   contains arguments or results.
10. **Screen states.** The query hooks hand the `GatewayError` to `<QueryBoundary>`, which renders
    loading, offline, error with retry (showing the trace reference), empty or content.

Two limits to be honest about: the gateway's correlation ID is not passed into the mock services,
so case events carry their own separate `correlationId`; and the latency, offline and error
conditions are simulations set from the prototype controls, not measurements of anything.

## Event-driven status flow

Case status belongs to the workflow mock. Nothing else changes it.

1. A workflow call (submit, staff action, "simulate next event" and so on) applies one step. The
   step produces the next case state and a `CaseEvent` together, so status, next action and
   milestones cannot drift apart.
2. The workflow saves both and publishes the event on the bus topic `case.event`. Free text typed
   by people is kept out of events.
3. The gateway is subscribed to that topic and calls `notifications.handleCaseEvent(event)`. An
   event already handled is ignored, so a replay does not notify twice.
4. The notifications mock reads the case and the person's channel preferences, then:
   - writes one detailed message to the **secure inbox** (the only place case detail is written);
   - asks the WhatsApp mock to send an approved template with a masked reference and a placeholder
     secure link — only if the person has opted in, and only if the text passes the
     external-channel safety check;
   - writes one **delivery-log** row per channel (`DELIVERED`, `SUPPRESSED` with the reason, or
     `FAILED`). Push, email and SMS have no adapter: their row is the whole of the simulation.
5. Every write publishes `store.changed`; the web app refreshes its queries shortly afterwards, so
   the tracker, inbox and unread badge update without a reload. `gateway.whenIdle()` lets tests
   wait for the fan-out to finish.

## Repository layout

| Workspace                       | What it holds                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web`                      | The Next.js app: citizen experience, `/staff` console, `/partner` sandbox; static export       |
| `packages/shared-types`         | Assurance tiers, status taxonomy, channels, data classification, feature flags, `GatewayError` |
| `packages/api-contracts`        | Zod schemas for every record, the port interfaces, and shared demo identifiers                 |
| `packages/auth-client`          | Mock sign-in client: session, tiers, time-limited A3 step-up, passkey stub                     |
| `packages/accessibility`        | Text-size, contrast, motion and data-saver preferences; live-region and focus helpers          |
| `packages/design-system`        | Design tokens and accessible React components                                                  |
| `services/api-gateway`          | The policy wrapper that composes the mock services                                             |
| `services/identity-adapter`     | Demo personas, family links, consents, concept credentials, partner yes/no checks              |
| `services/service-catalogue`    | Versioned sample services and guidance; keyword search                                         |
| `services/application-workflow` | Drafts, submission, case lifecycle, staff actions, case events                                 |
| `services/appointments`         | Synthetic service points, slots and bookings                                                   |
| `services/payments-adapter`     | Payment sandbox stub                                                                           |
| `services/notifications`        | Channel preferences, secure inbox, delivery log, service alerts, case-event fan-out            |
| `services/whatsapp-adapter`     | Mock WhatsApp channel: opt-in, template registry, chat log, unsafe-content check               |
| `services/support-desk`         | Call-back, complaint and feedback requests with consented context only                         |
| `services/audit-service`        | Append-only audit trail that refuses values that look like personal information                |
| `infrastructure/local`          | The in-browser platform. `dev`, `staging` and `production` are intentionally empty             |
| `assets`                        | 60 photographic masters (never modified) and `manifest.json`                                   |
| `scripts`                       | Image derivation, asset check, icon rendering, a static file server for previews               |
| `tests`                         | Folders for contract, integration, e2e, accessibility and security tests                       |
| `docs`                          | Product brief, design, architecture, security, privacy and runbooks                            |

## Concept screens and diagram from the brief

The brief contained four images that could not be carried into its Markdown version. They are
described here so the intent is not lost. All four are illustrations from the brief; none is a real
DHA interface or system diagram.

- **Target digital service architecture (diagram).** Four channel boxes across the top — iOS and
  Android app; responsive web / PWA (public content, applications, staff and partner portals);
  WhatsApp Business (opt-in notifications, simple flows, help and secure hand-off); email / SMS /
  IVR — all point into one "Omnichannel experience and API gateway" box (channel adapters,
  notification orchestration, consent and preferences, service catalogue, rate limits, API
  security). That fans out to five domain boxes: identity and access; civic services; immigration
  and travel; case and workflow; comms and support. Those in turn point to "Authoritative DHA
  platforms" and "Government and partner systems", beside a "Data, security and operations" box. A
  band along the bottom lists the cross-cutting concerns: POPIA, privacy by design, zero-trust,
  accessibility, human review, auditability and service continuity.
- **Concept screen 1 — personalised home.** A phone frame headed "Home Affairs One · South Africa ·
  Concept UI". A greeting to a fictional person, a blue "Your digital identity" card showing an
  identity status with the line "Wallet availability subject to legal approval", a grid of quick
  service cards (Smart ID, immigration, passport, get help, birth), an "Up next" card for a
  passport application with a "View progress" link, and a five-item bottom navigation (Home,
  Services, Track, Messages, Profile). The brief notes that names, status text and credential
  wording are fictional placeholders.
- **Concept screen 2 — application tracker.** "Track an application" with a masked reference, a
  status card for a Smart ID replacement reading "In production" with an updated time, a vertical
  timeline of five milestones (application received, identity checks completed, biometrics
  captured, document production, collection / delivery — the last not yet reached), and a "Need
  assistance?" card offering a message or call-back. The brief adds that the tracker should only
  show live stage and timestamps and must not fabricate estimates.
- **Concept screen 3 — omnichannel communications.** "Messages & support — choose how we contact
  you", with one card per channel and its purpose: secure app inbox (official notices and
  documents), WhatsApp (opt-in reminders and simple service flows), email (receipts and formal
  correspondence), SMS (short alerts and fallback), call centre (assisted support and escalation),
  and a warning panel: "Never send ID documents in public DMs."
