# Data classification

How data is labelled in this prototype, how the brief's core entities map to the synthetic records
that stand in for them, where those records are kept on a reviewer's device, and the handling rules
a real build would need. It also lists what must never reach a channel app or an external channel,
and the rules for logs and audit events.

Status: working assumptions for a prototype that holds synthetic data only. The class definitions
and the mapping below are proposals, to be replaced by DHA's information-classification policy and
a records schedule. Nothing here has been reviewed by a security, privacy or records team.

## The scheme used in code

`packages/shared-types` defines four class names — `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`,
`RESTRICTED` — and nothing more. The meanings below are this prototype's assumption. The brief
(§16) rates entities "Internal/public content", "High" or "Very high"; the third column shows how
we have mapped those ratings.

| Class          | Working meaning (assumption)                                                        | Brief's rating   | Example                                    |
| -------------- | ----------------------------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| `PUBLIC`       | Approved for anyone to read without signing in                                      | Public content   | Published service guidance, service points |
| `INTERNAL`     | Not personal, but not for publication: drafts, operational detail                   | Internal content | Unapproved content versions, queue names   |
| `CONFIDENTIAL` | Personal information about one person's account or dealings                         | High             | Contact details, an appointment, a payment |
| `RESTRICTED`   | Identity, civil status, family, case, credential, consent, biometric and audit data | Very high        | A case record, a guardianship link         |

Today only one field carries a class: every `ApplicationCase` is created with
`dataClassification: 'RESTRICTED'`, following the example object in the brief's Appendix B. Other
records are classified by this document, not by a field.

## Core entities

The entities and ratings are the brief's (§16). All prototype records are synthetic. "Stored" names
the collection in the browser's `localStorage`, under the key prefix `hao.v1:col.`.

| Entity (brief)       | Rating / class             | Synthetic stand-in in the prototype                                                                  | Stored in the prototype                                                        | Handling rules for a real build                                                                                    |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Person Account       | High / `CONFIDENTIAL`      | `PersonAccount`: a `PERSON-DEMO-…` token, first name and initial, masked contacts, `synthetic: true` | `identity.accounts`; a copy of name and tier in the session                    | Held by the identity platform. Channel apps show masked contacts. Recovery state protected                         |
| Identity Reference   | Very high / `RESTRICTED`   | The person token plus `assuranceTier` and `verifiedAt`. No DHA identifier is represented at all      | `identity.accounts`                                                            | Opaque token in the channel; the link to a national identifier stays server-side. Audit every lookup               |
| Family Relationship  | Very high / `RESTRICTED`   | `FamilyLink`: `LINK-DEMO-…`, a related person's first name and initial, scope, verification state    | `identity.family-links`                                                        | Guardian authority verified by an authorised process; scoped; start and end recorded; no casual family access      |
| Service Definition   | Internal/public / `PUBLIC` | Sample catalogue `sample-0.1`; every item is `sample: true`; fees are `SAMPLE` or `TO_BE_CONFIRMED`  | Not stored: bundled in the app's code                                          | Versioned with an effective date; approved by the accountable service and legal owners before publication          |
| Application Case     | Very high / `RESTRICTED`   | `ApplicationCase` (`CASE-DEMO-…`), `ApplicationDraft` (`DRAFT-DEMO-…`), `CaseEvent` (`EVT-DEMO-…`)   | `workflow.cases`, `workflow.drafts`, `workflow.events`                         | Owned by the case system. Opaque case IDs. Shown only to an authenticated, authorised person                       |
| Evidence Item        | Very high / `RESTRICTED`   | A placeholder with no content: "Synthetic placeholder — no real file"                                | Inside the draft record                                                        | Secure object storage, checksum, malware scan, retention schedule; temporary uploads deleted when no longer lawful |
| Appointment          | High / `CONFIDENTIAL`      | `Appointment` (`APPT-DEMO-…`) at a synthetic service point (`SP-DEMO-…`)                             | `appointments.appointments`, `appointments.service-points`                     | Linked by user or case token only; reminders through consented channels with a masked reference                    |
| Payment Record       | High / `CONFIDENTIAL`      | `PaymentRecord` (`PAY-DEMO-…`): sample amount, an opaque `tok_demo_…`, `sandbox: true`               | `payments.payments`                                                            | Hosted payment page; provider token only; no card data stored; signed server-side callback; reconciliation         |
| Credential           | Very high / `RESTRICTED`   | `ConceptCredential` tiles: claim **names** only, never values; `status: 'CONCEPT_ONLY'`              | Not stored: built from static content on request                               | Defined by the DHA trust framework. Nothing is represented as valid until law, standards and operations allow      |
| Consent / Disclosure | Very high / `RESTRICTED`   | `ConsentRecord` (`CONSENT-DEMO-…`), `VerificationRequest` (`VERIFY-DEMO-…`, a yes/no result only)    | `identity.consents`, `identity.verification-requests`                          | A durable receipt: purpose, recipient, attributes, legal basis, time, expiry, revocation. Visible to the person    |
| Message Event        | High / `CONFIDENTIAL`      | `InboxMessage` (`MSG-DEMO-…`), `MessageEvent` (`NTF-DEMO-…`), mock WhatsApp log entries              | `notifications.inbox`, `notifications.messageEvents`, `whatsapp.webhookEvents` | Detail in the secure inbox only. Delivery records hold channel, template, consent state and status — not content   |
| Audit Event          | Very high / `RESTRICTED`   | `AuditEvent` (`AUD-DEMO-…`) with opaque references only                                              | `audit.events`                                                                 | Append-only and tamper-evident; restricted access; retention set by policy; fed to security monitoring             |

Other things the prototype keeps on the device, which the brief's list does not name:

| Item                         | Where                                            | Note                                                                           |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------ |
| Mock session                 | `sessionStorage`, key `hao.session.v1`           | Role, opaque reference, display name, tier. Ends when the tab closes           |
| Support requests             | `support.requests`                               | Includes the free text a reviewer typed. Do not type real personal information |
| Channel preferences, opt-ins | `notifications.preferences`, `whatsapp.optIns`   | Consent references per channel                                                 |
| Idempotency results          | `hao.v1:gateway.idempotency`                     | A copy of the last 200 mutation results, so a retry can be replayed            |
| Platform settings, counters  | `hao.v1:platform.settings`, `…platform.counters` | Simulated network mode; identifier counters                                    |
| Accessibility preferences    | `localStorage`, key `hao.prefs.v1`               | Text size, contrast, motion, data saver                                        |
| Feature-flag overrides       | `localStorage`, key `hao.flags.v1`               | Present only if a flag was changed on this device                              |

## Never in the channel app or on an external channel

Each line is a rule the brief states. The prototype follows them by not representing the data at
all.

- **Raw biometrics.** "No raw biometrics in channel apps"; no biometric images kept on a device by
  default (§11, §13).
- **Card data.** Hosted payment with a server-side callback; "no card data storage" (§11).
- **The national ID number as an identifier.** Opaque identifiers and scoped tokens; never the
  public case ID (§16).
- **Full identity or passport numbers, biometric details or legal documents in push
  notifications**, and no sensitive identity details on lock screens or in app previews (§6, §8).
- **One-time PINs, biometric data, passport scans or sensitive case documents on WhatsApp.**
  WhatsApp carries approved templates, a masked reference and a secure link (§8, Appendix A).
- **Detailed case data or identity attributes by SMS**; SMS carries a short masked reference and an
  official link (§8).
- **Identity records or documents by email to unverified addresses**, or unencrypted in bulk (§8).
- **ID documents, account changes, authentication or case resolution in public social DMs** (§8).
- **Passwords or OTPs requested by any channel or handled informally by staff** (§8).
- **Secrets** in source control, prompts, mobile bundles, logs or test fixtures (§18).
- **Real identity documents, biometrics, passports or population-register data** in development
  (§18).
- **Submitted identity documents or live cases as training data** for public AI models (§13).
- **Social login or public social data** as a source of legal identity (§13).
- **Direct connections to the databases of record.** Access goes through the gateway and
  policy-enforcement layer (§11).

## Logging and audit rules

What the brief asks for: append-only security and case audit trails that record "who accessed what,
why, when, source, decision and any change" (§13); audit events for sensitive actions "without
logging PII or tokens" (Appendix A); privacy-aware logs redacted at source (§17); correlation IDs
that trace a request "without leaking PII" (§16).

What the prototype does:

- An audit event holds: time, actor role and opaque reference, action, resource type and opaque
  reference, purpose, outcome (`SUCCESS`, `DENIED`, `FAILED`), channel and correlation ID. It does
  not record a source IP address or device, which the brief's Audit Event entity includes.
- The audit mock stores only those fields and refuses an event when any field contains an `@`, or a
  run of six or more digits outside one of the prototype's own `…-DEMO-…` tokens, or when a
  reference contains a space. The refusal names the field and the rule, never the value.
- The gateway audits every mutation, and every read by a staff or partner actor. The `purpose` it
  records is the fixed value `service-request`; a real system needs a meaningful, enforced purpose.
- The gateway's call record (service, method, outcome, attempts, duration) never includes
  arguments or results.
- Case events carry fixed, app-written sentences. Free text typed by a person is kept out of them.
- Errors shown to people are a safe message and a trace reference only.
- ESLint warns on `console.log`; only `console.warn` and `console.error` are allowed in app code.

Proposed rules for a real build, in addition: logs and audit are separate stores with separate access;
audit retention is set by the records schedule (an open decision — see
`docs/architecture/decisions.md`, D-08); privileged access to logs is itself audited; nothing is
logged from request bodies, evidence or message content.
