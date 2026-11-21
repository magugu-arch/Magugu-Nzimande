# Threat model outline

An outline threat model for the **target** Home Affairs One system as the product brief describes
it, followed by a separate, plain account of what this prototype does and does not protect. The
target section is a starting point for a security team's own threat-modelling work; the controls
listed are the ones the brief proposes (`docs/product/home-affairs-one-brief.md`, mainly §8, §11,
§12, §13, §16 and §22), not controls that exist today.

Status: outline for discovery — not reviewed by a security team. No penetration test, code review,
scan or other security assessment of this prototype has been carried out.

## Part 1 — Target system (outline)

### Assets

| Asset                                                     | Why it matters                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Identity references and assurance state                   | Links an account to a person in the systems of record                             |
| Civil, immigration and case records (accessed, not owned) | The brief keeps the authoritative registers as the source of truth                |
| Biometric data                                            | Cannot be reissued if exposed. The brief keeps raw biometrics out of channel apps |
| Evidence documents                                        | Identity documents and supporting papers submitted with applications              |
| Credentials and issuer signing keys (future wallet)       | Forgery or key compromise undermines every credential                             |
| Family, guardianship and delegation links                 | Authority to act for a child or another adult                                     |
| Consent and disclosure records                            | Proof of what was shared, with whom, and on what basis                            |
| Sessions, device credentials and recovery state           | The route to account takeover                                                     |
| Staff and partner privileges                              | Broad access to other people's records                                            |
| Payment records                                           | Fees, refunds and reconciliation                                                  |
| Contact details and message content                       | Used for phishing if exposed; channels can leak case detail                       |
| Audit trail                                               | The record of who did what; needed for accountability and investigations          |
| Service content and rules                                 | Wrong guidance harms people even without a breach                                 |
| Availability of the service                               | People depend on it to obtain legal documents                                     |

### Actors

- **People using the service:** citizens, parents and guardians, delegates, residents, travellers,
  South Africans abroad, people using shared or borrowed devices.
- **Official roles:** case officers, supervisors, administrators, contact-centre advisers, staff at
  service points and missions.
- **Institutions:** accredited partners (banks, verifiers), and providers of messaging, payment,
  hosting, biometric, courier and identity services.
- **Adversaries to plan for:** account-takeover and identity fraudsters; people impersonating
  official channels; a malicious or coerced insider; a compromised partner or provider; automated
  abuse; a supply-chain attacker; someone with physical access to another person's device; a family
  member reaching for a record they have no authority over.

### Trust boundaries

1. A person's device ↔ the edge (API gateway, WAF).
2. The edge ↔ domain services and workflow.
3. Domain services ↔ the authoritative systems of record and biometric services.
4. The platform ↔ external providers (WhatsApp, email, SMS, push, payment, courier).
5. The public zone ↔ the staff zone, and each ↔ the partner zone.
6. South Africa ↔ foreign missions and any cross-border hosting or provider access.
7. Any AI component ↔ the approved knowledge base and ↔ case data.
8. Source control and the build pipeline ↔ running environments.

### Entry points

Public content; sign-in, recovery and step-up; application forms and evidence upload; payment
return and server-side callbacks; deep links from notifications; inbound WhatsApp messages and
provider webhooks; the partner API and portal; the staff console; contact-centre and IVR lookups;
capture devices at service points; the service-guide input; administrative and deployment
interfaces.

### Threats and the brief's intended controls

**Spoofing**

| Threat                                                  | Controls the brief proposes                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Account takeover through phishing or weak recovery      | Passkeys where supported, step-up for high-risk actions, secure recovery, device and risk monitoring                            |
| Deepfake or presentation attack during proofing         | DHA-approved proofing, liveness and presentation-attack detection, independent error and bias testing                           |
| Fake "official" WhatsApp, SMS, email or social accounts | Verified sender IDs and domains, a template registry, a published list of official channels, never asking for passwords or OTPs |
| Someone posing as staff or as an accredited partner     | Federated workforce identity, hardware-bound MFA, partner accreditation, mutual TLS or equivalent                               |
| Forged or replayed provider callbacks                   | Signed callbacks and webhooks with replay protection                                                                            |
| False claim of guardianship or delegated authority      | Explicit guardian-authority and safeguarding rules, verified links, scoped delegation with an end date                          |

**Tampering**

| Threat                                         | Controls the brief proposes                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Changed or duplicated submissions and payments | Modern TLS, idempotency keys, schema validation, signed callbacks                              |
| App data overwriting a legal record            | Registers stay authoritative; app profile fields must not silently overwrite them              |
| Altered or outdated guidance                   | Versioned policy content, legal owner approval, citations and effective dates                  |
| Forged credentials                             | Cryptographically verifiable credentials, issuer keys in HSM/KMS, status and revocation checks |
| Malicious dependency or build                  | Dependency pinning, SCA, secrets scanning, protected branches, signed builds                   |

**Repudiation**

| Threat                                            | Controls the brief proposes                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Staff deny viewing a record or making a decision  | Append-only audit of who accessed what, why, when, from where, and any change; actions attributed to staff |
| A person disputes that they submitted or declared | Explicit declaration, transaction confirmation, receipt with timestamp                                     |
| A partner denies making a verification request    | Transaction audit and user-visible disclosure records                                                      |

**Information disclosure**

| Threat                                                    | Controls the brief proposes                                                                                     |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Case detail exposed through notifications or lock screens | External channels carry a masked reference and a short-lived secure link only; detail stays in the secure inbox |
| Personal information in logs or error messages            | Privacy-aware logs redacted at source; safe error messages with a trace reference; correlation IDs without PII  |
| Guessable or meaningful identifiers                       | Opaque identifiers and scoped tokens; the national ID number is never the public case ID                        |
| Verifiers receiving more than they need                   | Consent- and purpose-bound APIs, scopes, selective disclosure                                                   |
| Insiders browsing records                                 | RBAC and ABAC, purpose-based authorisation, time-limited elevation, enhanced audit                              |
| Casual family access to a child's record                  | Explicit age, guardian-authority and safeguarding rules                                                         |
| Lost, shared or kiosk devices                             | No biometric images kept on the device by default; kiosk timeout and privacy curtain                            |
| Exposure through providers or cross-border processing     | Supplier security assessment, contractual breach notification and audit rights, transfer assessment             |
| Case data leaking into AI models                          | Never train public models on submitted documents or live cases; log model and knowledge versions                |

**Denial of service**

| Threat                                             | Controls the brief proposes                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Volumetric attack, bots, or legitimate peak demand | DDoS protection, rate limiting, horizontal scaling                                                 |
| Slow or unavailable back-end systems               | Adapters, queues, retries, reconciliation, circuit breakers, operational dashboards                |
| Bank, courier, payment or messaging outage         | More than one channel or provider where feasible, failover, fallback to the next consented channel |
| Ransomware or destructive insider action           | SOC/SIEM, segmentation, backups, tested disaster recovery, incident exercises                      |

**Elevation of privilege**

| Threat                                                       | Controls the brief proposes                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Acting above the assurance tier actually proofed             | Assurance proportional to risk, step-up, enforcement at the API gateway and policy layer             |
| A partner reaching beyond its scope or tenant                | Partner isolation, purpose-bound scopes, contract tests before onboarding                            |
| Staff gaining or keeping excess access                       | Least privilege, privileged access management, time-limited elevation                                |
| AI output treated as a decision, or steered by injected text | AI assists and never adjudicates; humans decide; evaluation for prompt injection and harmful content |

## Part 2 — What the prototype does and does not protect

The prototype has **no server**. Everything runs in the visitor's browser, so every check can be
read, changed or skipped by anyone who opens the developer tools. Read this section before drawing
any conclusion about security from a demonstration.

### What it does not protect

- **Sign-in proves nothing.** Choosing a demo persona creates the session. Any six digits are
  accepted as the "code", the passkey stub always succeeds, and anyone can sign in as staff or as a
  partner.
- **Route guards are usability aids, not security controls.** `RequireTier` and `RequireRole` run in
  the browser and only decide what to render. The tier check on submission compares a tier that the
  client itself supplies.
- **The session is an unsigned JSON object** in `sessionStorage`. It can be edited by hand.
- **All data sits unencrypted in `localStorage`**, readable and editable by anyone with access to
  the device or browser profile, and by any other page served from the same origin. If the site is
  hosted under a sub-path of a shared origin, treat that whole origin as able to read it.
- **The audit trail is append-only in its interface only.** It lives in the same `localStorage` and
  can be altered or cleared. A failed audit write is swallowed without an alert.
- **Feature flags hide features; they do not secure them.** The code for gated previews ships to
  every visitor, as does the staff console and partner sandbox.
- **`noindex` is not access control.** Anyone with the address can open the site.
- **No rate limiting, abuse controls, security headers or content security policy** are set by the
  app. A static host would have to add headers.
- **Free-text fields** (a support request, a staff request for information) are stored on the device
  as typed. All data is meant to be synthetic: do not type real personal information.

### What it does exercise — as patterns

| Pattern                                 | Where to see it                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Safe error messages                     | Only `GatewayError` leaves the gateway: a category, a public-safe message and a trace reference                                 |
| Masked references on external channels  | `maskReference`, `SafeNotificationPayloadSchema`, `assertSafeForExternalChannel` in the WhatsApp mock; no one-time-PIN template |
| Audit without personal information      | Audit events carry opaque references; `findPiiRisk` refuses anything that looks like a contact detail or identity number        |
| Idempotency                             | The gateway refuses a mutation without a key and replays a stored result when a key repeats                                     |
| No real data                            | Schemas require `…-DEMO-…` tokens and `synthetic: true`; evidence is a placeholder; there is no file input                      |
| Consent- and scope-bound partner checks | `requestVerification` returns yes/no only, refuses without live consent or outside scope, and records every request             |
| Decisions made by people only           | `RECORD_DECISION` requires `reviewedByHuman: true`; the event simulator never records a decision                                |
| No attestation on a person's behalf     | `submitApplication` refuses anything but an explicit `declarationAccepted: true`                                                |
| Minimum context on hand-off             | The support desk passes an adviser a masked reference and a fixed sentence, not the person's own words                          |

These show how the rules could be expressed in code. They are not evidence that the rules would
hold against an attacker: none of them is enforced anywhere an attacker cannot reach.

## Before any pilot

Drawn from the brief's launch gates (§23), security baseline (§13) and approval gates (Appendix C).
None of this has been done.

- [ ] A security team runs a full threat-modelling exercise and replaces this outline.
- [ ] Security architecture approved: identity assurance, system-of-record boundaries, API
      standards, hosting and data residency.
- [ ] The mock sign-in is replaced by an approved identity provider, with secure recovery and
      step-up enforced on a server.
- [ ] Staff and partner surfaces are split into separate deployables in a separate network zone,
      with workforce identity, hardware-bound MFA and privileged access management.
- [ ] Every check now made in the browser is enforced at an API gateway and policy layer.
- [ ] SAST, DAST, SCA and secrets scanning are in the pipeline; builds are signed.
- [ ] Independent penetration test and identity-assurance review, with a remediation report and
      formally accepted residual risks.
- [ ] Append-only audit storage, central privacy-aware logging and SIEM/SOC monitoring.
- [ ] Supplier security assessments for hosting, messaging, payment, biometric and courier
      providers.
- [ ] Incident response, backup, disaster recovery, rollback and outage communication plans tested.
- [ ] No unresolved critical security blockers.
- [ ] No connection to live identity, biometric or immigration records until DHA has approved the
      legal basis, technical controls, data agreements, security assessment and an accountable
      operational owner.
