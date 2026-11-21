# Secure development checklist

The engineering rules from the product brief (§18 "Claude Code implementation blueprint" and
Appendix A "master build prompt") turned into a checklist for anyone who changes this repository —
a person or Claude Code. It also records how the repository enforces those rules today, and which
of the brief's expected controls are not yet in place.

Status: a contributor guide for a synthetic-data prototype. It is not a secure development
life-cycle approved by DHA, and no security review of the code has taken place.

## Before you start

- [ ] Read `CLAUDE.md`, `.claude/rules/guardrails.md`, and the architecture and security documents
      in `docs/`. The brief asks for this before any coding.
- [ ] Read the section of the brief that covers the feature you are changing.
- [ ] Write a short plan: what will change, which files, what you are assuming.

## The rules

### Data and content

- [ ] **Synthetic data only.** People are `PERSON-DEMO-…` tokens with a first name and an initial.
      Nothing may look like a real South African identity number, passport number or case
      reference.
- [ ] **No real documents, biometrics or uploads.** Evidence is a labelled placeholder. Do not add a
      file input.
- [ ] **Never invent DHA facts.** No law, fees, requirements, eligibility rules, processing times,
      office names, statuses or case outcomes. Sample content lives in the versioned catalogue,
      carries `sample: true`, and is labelled as sample on screen.
- [ ] **No fake official marks.** No logos, seals, coat of arms, uniforms, certificates, ID cards,
      QR codes, barcodes, government notices or official legal text.
- [ ] **No personal information in logs or audit events.** Opaque references only.

### Secrets and configuration

- [ ] **No secrets anywhere in the repository** — not in source, prompts, bundles, logs, test
      fixtures or documentation. The prototype needs none; if a change seems to need one, stop.
- [ ] **`NEXT_PUBLIC_…` variables are public.** They are compiled into the JavaScript that every
      visitor downloads. Use them for build options only (`NEXT_PUBLIC_BASE_PATH`,
      `NEXT_PUBLIC_FLAG_PROFILE`).
- [ ] A real build uses environment variables and an approved secret store, as the brief requires.

### Integrations and adapters

- [ ] **Mock adapters only.** Screens call `gateway.*`. No `fetch`, no API keys, no production or
      sandbox endpoints. Links out use `example.gov.za`.
- [ ] **Every integration sits behind a typed port** in `packages/api-contracts/src/ports.ts`, with a
      Zod schema for each record.
- [ ] **Every state-changing port method takes `{ idempotencyKey }`.** Method names that start with
      `get`, `list` or `search` are treated as reads and must not change anything.
- [ ] **Failures leave the gateway as `GatewayError`** — a safe message and a trace reference, never
      a stack trace or internal detail.
- [ ] **External channels carry a masked reference and a secure link only.** Never case details,
      documents, one-time PINs or biometrics.
- [ ] **Do not connect to databases of record**, in the prototype or in any design that follows it.

### Dependencies

- [ ] **Ask a human before adding a dependency.** State what it is for, its licence, and whether it
      makes network requests.
- [ ] **No third-party runtime requests.** No analytics, CDNs, hosted fonts, map tiles or embeds.
- [ ] Commit `package-lock.json` changes together with the `package.json` change that caused them.

### Feature flags and gated capabilities

- [ ] The wallet, biometric verification, the service guide and partner integrations stay behind
      `wallet`, `biometricVerification`, `aiGuide` and `partnerIntegrations`.
- [ ] Every gated capability is labelled "future / subject to approval" wherever it appears.
- [ ] The `pilot` profile keeps all four off. Do not change a profile default without approval.
- [ ] Nothing in the wallet may be presented as a valid credential.

### People stay in control

- [ ] **Never auto-submit and never attest for a person.** A declaration needs the person's own
      explicit tick.
- [ ] **AI assists, never decides.** The service guide finds and quotes versioned sample guidance
      with a citation. No eligibility verdicts, no decisions.
- [ ] **Only a staff action can record a decision**, and it must confirm human review.

### Quality that is part of security

- [ ] Every data-driven screen handles loading, empty, offline, error with retry, exception and
      success. Use `<QueryBoundary>`.
- [ ] Accessibility is a WCAG 2.2 AA target: labels, headings, visible focus, 44 px targets, no
      meaning by colour alone.
- [ ] Do not describe a client-side guard, flag or mock as a security control — in code comments,
      on screen or in documents.

## Human-approval gates

Stop and ask an accountable person before any of these. The brief and `.claude/rules/guardrails.md`
both require it.

| Needs approval first                              | Why                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Schema or data migrations                         | Can destroy or corrupt records                                    |
| Destructive operations                            | Not reversible                                                    |
| Any deployment                                    | Makes the prototype visible to others; production is out of scope |
| Activating any external API or integration        | Breaks the "mocks only" boundary                                  |
| Changing security policy, guards or flag defaults | Changes what the prototype claims and shows                       |
| Adding a dependency                               | Supply-chain and licence exposure                                 |

## What Claude Code may and may not do

The brief treats Claude Code as "a development accelerator inside a controlled software-engineering
process", not as an authority.

| May                                                                          | May not                                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Read the repository and the brief; propose a plan                            | Invent legal rules, fees, requirements, statuses or outcomes            |
| Change code, tests and documents in small increments                         | Handle production credentials or connect to real DHA systems or records |
| Run `npm run verify` and the other scripts in `package.json`                 | Use real identity documents, biometrics, passports or register data     |
| Build and extend mock adapters behind the existing ports                     | Generate logos, seals, government notices or official legal text        |
| Report files changed, commands run, results, known gaps and how to roll back | Cross a human-approval gate on its own initiative                       |

## How the repository enforces this today

| Control                 | Command                | What it checks                                                                                                    |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Type checking           | `npm run typecheck`    | TypeScript `strict`, `noUncheckedIndexedAccess`, unused locals and parameters, for the workspaces and the web app |
| Linting                 | `npm run lint`         | Next.js core-web-vitals and TypeScript rules, the `jsx-a11y` recommended set, inline type imports, `no-console`   |
| Formatting              | `npm run format:check` | Prettier                                                                                                          |
| Unit and contract tests | `npm test`             | Vitest, for tests beside the code and under `tests/contract`, `tests/integration` and `tests/security`            |
| Asset check             | `npm run assets:check` | 60 masters present and unchanged; alt text, focal point, placement and review status; every image in use          |
| All of the above        | `npm run verify`       | Runs the five checks in order                                                                                     |
| Journeys and axe checks | `npm run test:e2e`     | Playwright specs under `tests/e2e` and `tests/accessibility`, run against the static export                       |

Rules that are built into the code rather than left to review:

- Zod schemas require synthetic shapes: token patterns such as `PERSON-DEMO-…` and
  `CASE-DEMO-…`, and literal `synthetic: true`, `sample: true`, `sandbox: true` and
  `CONCEPT_ONLY` fields.
- The gateway refuses a mutation that has no idempotency key, and lets nothing but a `GatewayError`
  out.
- The audit mock refuses an event that looks as if it contains personal information.
- The WhatsApp mock refuses unapproved templates and any text that fails its external-channel
  safety check.
- `.gitignore` excludes `.env` and `.env*.local`.

These checks only help when someone runs them. Passing them is not a security assessment.

## Not yet in place

The brief's security baseline (§13) and stack (§17) expect most of the following; the one item the
brief does not name is marked. None exists for this prototype; each is a gap to close before any
pilot.

| Gap                                                                                       | Brief reference                                     |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Static analysis for security (SAST)                                                       | §13 application security; §18 sprint 7              |
| Dynamic testing (DAST) and penetration testing                                            | §13; §23 security                                   |
| Dependency vulnerability scanning (SCA)                                                   | §13; §17 "vulnerability gates"                      |
| Secrets scanning                                                                          | §13                                                 |
| Signed builds and a reproducible, protected pipeline                                      | §17 delivery                                        |
| Continuous integration for this folder                                                    | §18 sprint 0 ("CI green")                           |
| Strict dependency pinning (versions use `^` ranges; the lockfile fixes what is installed) | §13                                                 |
| OpenAPI contracts (ports are TypeScript interfaces with Zod schemas)                      | §16                                                 |
| Security headers and a content security policy at the host                                | Not named in the brief; our addition                |
| A reviewed threat model                                                                   | §18 sprint 2 and 7; `threat-model.md` is an outline |
| Load, resilience and disaster-recovery testing                                            | §23 resilience                                      |
| Mobile app attestation and reverse-engineering tests                                      | §13; §23 (no mobile app exists yet)                 |

When one of these is added, record it here and in `docs/runbooks/release-and-rollback.md`.
