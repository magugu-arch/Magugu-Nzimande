# Architecture decision log

Short records of the decisions that shaped the prototype, so that anyone picking it up knows what
was chosen, why, and what it costs. The second half lists the decisions that are **not** ours to
make: the brief's "release architecture decisions to record" (Appendix B), which need the
Department of Home Affairs (DHA) and are all still open.

Status: prototype decisions, taken by the prototype team. None has been reviewed or approved by
DHA. Each can be reversed; "Superseded" entries will be kept, not deleted.

## Prototype decisions

### ADR-001 — Static export with in-browser mocks

- **Context.** The brief (§18, Appendix A) asks for a prototype on synthetic data with mocked
  services, and forbids production endpoints, credentials and real records.
- **Decision.** Build `apps/web` with Next.js `output: 'export'`. Every service is a mock that runs
  in the browser; data is kept in `localStorage` through `infrastructure/local`.
- **Consequences.** The site can be hosted from any static file host and nothing leaves the device.
  There is no server, so nothing can be enforced: access checks are usability aids only. Data is
  per browser, not shared between reviewers, and is lost when site data is cleared.
- **Status.** Accepted for the prototype. Must be replaced before any pilot.

### ADR-002 — One deployable for citizen, staff and partner surfaces

- **Context.** The brief's repository structure has `apps/web`, `apps/mobile` and a separate,
  protected `apps/staff-console`, and asks for "separate protected staff and accredited-partner
  surfaces".
- **Decision.** For the prototype, the staff console (`/staff`) and partner sandbox (`/partner`) are
  routes inside `apps/web`, behind a client-side role guard.
- **Consequences.** One build to review and host. But staff and partner code ships to every
  visitor, and the guard is not a security control. Before any pilot these must be split: separate
  deployables, a separate network zone, workforce identity and privileged access management.
- **Status.** Accepted for the prototype only. Splitting is a pre-pilot requirement.

### ADR-003 — Ports and adapters, with one gateway policy wrapper

- **Context.** The brief asks that all integrations sit behind typed adapters, and that every
  external call has a timeout, retry policy, idempotency, error mapping and observability.
- **Decision.** Screens only call `gateway.*`. Port interfaces live in
  `packages/api-contracts/src/ports.ts`; `services/api-gateway` wraps every port method with the
  same policy (latency simulation, timeout, retry with back-off, idempotency, correlation ID,
  `GatewayError` mapping, audit, call record).
- **Consequences.** A real build can swap each mock for an HTTP client without changing screens.
  The policy is written once. The wrapper runs in the browser, so it shows the pattern; it is not
  the server-side gateway the brief requires.
- **Status.** Accepted.

### ADR-004 — An idempotency key on every mutation

- **Context.** The brief (§16) asks for idempotency keys on submit, payment, appointment and retry
  operations.
- **Decision.** Every state-changing port method takes `{ idempotencyKey }`. The gateway refuses a
  mutation without one and replays the stored result when a key repeats. Reads (`get…`, `list…`,
  `search…`) never mutate.
- **Consequences.** A double tap or a retry cannot apply twice. Callers must create one key per
  user intent and reuse it when retrying. Stored results live in `localStorage` (last 200); a real
  system needs a server-side store with an expiry policy.
- **Status.** Accepted.

### ADR-005 — No real uploads; evidence is a synthetic placeholder

- **Context.** The brief forbids real identity documents, biometrics and personal case files in
  development.
- **Decision.** There is no file input. `attachSampleEvidence` records a labelled placeholder with
  no content; `EvidenceItem.synthetic` is always `true`.
- **Consequences.** The evidence step of a journey can be shown without any risk of someone
  uploading a real document. Upload, malware scanning, storage and retention are not exercised.
- **Status.** Accepted.

### ADR-006 — Feature-flag profiles

- **Context.** The brief requires flags for the wallet, biometric verification, AI and partner
  integrations, and treats the wallet as legally gated.
- **Decision.** Four flags (`wallet`, `biometricVerification`, `aiGuide`, `partnerIntegrations`) with
  two profiles: `prototype` (on, as labelled previews) and `pilot` (all off). The profile is chosen
  at build time with `NEXT_PUBLIC_FLAG_PROFILE`; per-device overrides are kept in `localStorage`.
- **Consequences.** Gated capabilities can be shown and discussed without implying they are
  approved. Flags are client-side, so they hide features; they do not secure them.
- **Status.** Accepted.

### ADR-007 — Self-hosted fonts and no third-party requests

- **Context.** A concept that looks like a public service should not leak visits to third parties,
  and should work on poor connections.
- **Decision.** Fonts are bundled from `@fontsource-variable` packages. There are no analytics, tag
  managers, CDNs, map tiles or embedded third-party content. Outbound links use `example.gov.za`.
- **Consequences.** The only requests are for the site's own files. There is no usage analytics, so
  evidence about how people use the prototype must come from moderated research.
- **Status.** Accepted.

### ADR-008 — Photographs through a manifest; masters never modified

- **Context.** The brief supplies 60 illustrative, AI-generated photographs and (Appendix F) asks
  for a governed asset register.
- **Decision.** Masters stay byte-for-byte in `assets/masters`. `assets/manifest.json` holds alt
  text, focal point, placement and review status. `scripts/derive-assets.mjs` builds WebP
  derivatives; `npm run assets:check` fails if a master's checksum changes, a field is missing or
  an image is unused. Screens use `<Photo asset="A12" />` only.
- **Consequences.** Alt text and crops are consistent, and provenance is checkable. Photographs are
  decoration and context: every label and status is rendered by the app. Two images (A35, A52) are
  flagged "needs review" because they contain a flag motif or a uniform.
- **Status.** Accepted.

### ADR-009 — `noindex` and a permanent concept ribbon

- **Context.** The brief says the prototype must not imply government approval.
- **Decision.** The root layout sets `robots: noindex, nofollow`. A ribbon reading "Concept
  prototype · not an official service · synthetic data" is part of the app shell on every screen,
  and the page title and web app manifest carry "(concept prototype)".
- **Consequences.** The site should not appear in search results and cannot easily be mistaken for
  a live service. `noindex` is a request to well-behaved crawlers, not access control.
- **Status.** Accepted. Not to be relaxed.

### ADR-010 — No native mobile app yet (PWA first)

- **Context.** The brief proposes iOS and Android apps alongside a responsive web / PWA.
- **Decision.** Build the responsive web app only, with a manifest and an offline shell.
  `apps/mobile` is deferred.
- **Consequences.** One codebase proves the journeys on phones and desktops. Native-only concerns —
  secure storage, platform biometrics, app attestation, push, store review — are untested.
- **Status.** Accepted for the prototype. Revisit when the channel strategy is confirmed.

### ADR-011 — Mock session with assurance tiers and a time-limited step-up

- **Context.** The brief (§12) proposes tiers A0–A4 and step-up for high-risk actions.
- **Decision.** `packages/auth-client` keeps a session object in `sessionStorage`. A
  verified-contact sign-in is capped at A1 and a passkey sign-in at A2; a step-up raises a verified
  passkey session to A3 for 10 minutes; staff and partners hold a separate A4 tier.
- **Consequences.** Screens can show progressive assurance. Nothing is proved: choosing a persona
  is the whole "sign-in". The caps and the 10-minute lifetime are prototype assumptions.
- **Status.** Accepted for the prototype. Real values need the decisions listed below.

### ADR-012 — Status is event-driven and owned by the workflow

- **Context.** The brief asks for event-driven status and says the case platform owns case status.
- **Decision.** Only the workflow mock changes a case, one step at a time, producing a case event
  for each change. Notifications subscribe to those events. A decision can only be recorded by an
  explicit staff action that confirms human review.
- **Consequences.** The tracker, inbox and delivery log always agree. The bus is in-memory and
  per tab: there is no durability, ordering guarantee or reconciliation.
- **Status.** Accepted.

### ADR-013 — The service guide is keyword search, with no AI model

- **Context.** The brief wants an AI guide that assists and never adjudicates, grounded in approved
  content. No approved content or assurance process exists yet.
- **Decision.** The guide is plain keyword search over versioned sample guidance and always shows a
  citation. No model is connected.
- **Consequences.** There is nothing to hallucinate and no data is sent to a model provider. It
  also means none of the AI guardrails are tested. See `docs/privacy/ai-use.md`.
- **Status.** Accepted.

### ADR-014 — "After dark": a dark editorial theme, square shapes and parallax

- **Context.** The brief (§9) proposes a light palette with rounded cards. The product owner asked
  for a more premium look after a dark editorial reference — full-bleed photography, a serif
  headline with an italic accent, small monospaced labels, square blocks — and asked for every
  pill and arch shape to go and for parallax to be added.
- **Decision.** Keep the brief's hues and rearrange them as one dark theme: Midnight Navy taken
  down to ink for the page, ivory type, Warm Gold as the single accent (buttons, links, rules, the
  mark). Every radius token is `0`; the arch mask and the arch in the mark are retired, and the
  mark is redrawn as a square doorway. Photographs drift as they cross the screen, using CSS
  scroll-driven animations with a small scripted fallback, and stand still under reduced motion.
  Eyebrows, tags and buttons are set small, wide and uppercase in CSS; the copy itself stays in
  sentence case. The top and bottom bars are translucent layers the page scrolls under.
- **Consequences.** This departs from the brief's light palette. There is one theme: no light
  option yet, although printing turns the page light. Uppercase labels read less easily at length,
  so button labels must stay short. Text and background pairs, control borders and the zero radii
  are held by unit tests; parallax, reduced motion and "no rounded corners" by browser tests. The
  look has not been tested with low-vision users or in bright sunlight, and should be before a
  pilot. A box that clips must use `overflow: hidden; overflow: clip;` or photographs inside it
  stop drifting.
- **Status.** Accepted for the prototype. To be confirmed with DHA brand and accessibility owners.

## Decisions still to be made with DHA

The brief (Appendix B, "Release architecture decisions to record") lists these. The prototype makes
no assumption about any of them. All are **OPEN**.

| #    | Decision                                                    | Status | Prototype stand-in                                |
| ---- | ----------------------------------------------------------- | ------ | ------------------------------------------------- |
| D-01 | Hosting and data residency                                  | OPEN   | Static files; data stays in the browser           |
| D-02 | Identity provider, assurance, passkeys and account recovery | OPEN   | Mock session; passkey stub                        |
| D-03 | Population-register integration                             | OPEN   | None. Profile values are labelled as mock         |
| D-04 | Biometric integration                                       | OPEN   | None. Flag-gated preview with no capture          |
| D-05 | Wallet format, issuer/verifier trust and revocation         | OPEN   | Concept tiles marked `CONCEPT_ONLY`               |
| D-06 | Case / workflow system                                      | OPEN   | `application-workflow` mock                       |
| D-07 | APIs and events                                             | OPEN   | TypeScript ports; in-memory bus                   |
| D-08 | Audit retention                                             | OPEN   | Audit events in `localStorage`, no retention rule |
| D-09 | SIEM, privileged access and resilience                      | OPEN   | None                                              |
| D-10 | Messaging ownership, consent and webhooks                   | OPEN   | Mock orchestrator and WhatsApp mock               |
| D-11 | Payments, refunds and reconciliation                        | OPEN   | Sandbox stub, sample amounts                      |
| D-12 | Service levels and continuity                               | OPEN   | None                                              |

Related questions for DHA are numbered in `docs/product/open-questions.md`.
