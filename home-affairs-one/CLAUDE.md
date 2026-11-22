# Home Affairs One — working rules

A **non-production concept prototype** of a proposed South African digital identity and
citizen-services experience. It is not an official Department of Home Affairs (DHA) product.
The full brief is `docs/product/home-affairs-one-brief.md`; read the relevant section before
changing a feature.

## Hard rules (from the brief — do not relax them)

1. **Never invent DHA facts.** No real fees, requirements, eligibility rules, processing times,
   office names, legal text or case outcomes. Service content is sample content: say so in the UI
   (`<SampleNotice>`), keep it in the versioned catalogue, and use placeholder wording.
2. **Synthetic data only.** People are `PERSON-DEMO-…` tokens with a first name and initial.
   Nothing may look like a real South African ID number, passport number or case reference.
   No real documents, biometrics or uploads — evidence is a synthetic placeholder.
3. **No fake official marks.** No coat of arms, seals, DHA logos, uniforms, certificates, ID cards,
   QR codes or barcodes — not drawn, not generated, not imitated.
4. **Mock adapters only.** Screens talk to `gateway.*` (ports in `packages/api-contracts`). No
   network calls, no API keys, no production endpoints. Links out use `example.gov.za`.
5. **AI assists, never decides.** The service guide only finds and quotes versioned sample
   guidance with a citation. No decisions, eligibility verdicts or auto-submission, ever.
6. **WhatsApp and other external channels carry a masked reference and a secure link only.**
   Never case details, documents, one-time PINs or biometrics.
7. **Never attest for the person.** Declarations need an explicit tick; nothing auto-submits.
8. **Gated capabilities stay gated.** Wallet, biometric verification, service guide and partner
   integrations sit behind feature flags and are labelled "future / subject to approval".
9. **No PII in logs or audit events.** Audit records carry opaque references only.

## Layout

```
apps/web            Next.js (static export): citizen experience, /staff console, /partner sandbox
packages/           design-system, api-contracts, shared-types, auth-client, accessibility
services/           mock domain services behind typed ports, composed by services/api-gateway
infrastructure/local in-browser platform: storage, clock, ids, event bus
assets/             60 photographic masters (never modified) + manifest.json
docs/               product brief, design, architecture, security, privacy, runbooks
tests/              contract, integration, e2e, accessibility, security
```

## Engineering conventions

- TypeScript strict with `noUncheckedIndexedAccess`; no `any`; `import { type X }` for types.
- Prettier (single quotes, 100 columns, trailing commas). ESLint includes the full jsx-a11y set.
- Every state-changing port call takes `{ idempotencyKey }`. Reads never mutate.
- Errors crossing the gateway are `GatewayError` (safe message + trace reference).
- Every data-driven screen handles: loading, empty, offline, error + retry, and success. Use
  `<QueryBoundary>` in the web app rather than hand-rolling these.
- Photographs are used through `<Photo asset="A12" />` only. Alt text and focal points live in
  `assets/manifest.json`. Photographs are decoration and context — every label, status and
  message is rendered by the app, never taken from an image.
- Accessibility is a WCAG 2.2 AA target: real headings, labels on every control, visible focus,
  44px touch targets, no information by colour alone, respects reduced motion and text size.
- Plain language. Action labels ("Apply for a passport"), sentence case, no internal jargon.
- The look is dark and editorial (ADR-014): ink page, ivory type, gold accent. **No rounded
  corners anywhere** — radius tokens are `0`; never add pills, arches or circles. Clipping boxes
  use `overflow: hidden; overflow: clip;` so photographs keep their parallax.

## Commands (run from this folder)

```
npm run dev          # derive images, start Next dev server
npm run build        # derive images, static export to apps/web/out
npm run verify       # typecheck + lint + format check + unit tests + asset check
npm run test:e2e     # Playwright journeys and axe checks against the export
```

After each change: run `npm run verify`, and report files changed, results, known gaps and how
to roll back. Ask a human before adding dependencies, external integrations or anything
destructive.
