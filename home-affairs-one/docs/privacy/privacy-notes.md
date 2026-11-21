# Privacy notes

Privacy-by-design notes for Home Affairs One: the privacy principles the product brief sets out,
how each is meant to show up in the product, what this prototype actually does, what it keeps on a
reviewer's device and how to remove it, and the privacy work the brief requires before any live
data is used.

Status: design notes for a synthetic-data prototype. This is not legal advice and not a privacy
impact assessment. Where it mentions POPIA it repeats what the brief says; it has not been reviewed
by DHA's Information Officer, a privacy office or legal services.

## What the brief says

The brief (§13) states that "POPIA sets minimum conditions for processing personal information,
regulates public and private bodies, addresses unsolicited electronic communications and automated
decision-making, and regulates cross-border flows of personal information", and that "the app
programme must include a privacy impact assessment and records-management plan before live data is
used." It then lists eight principles. They are the brief's wording of the design intent; what the
law requires in each case is for DHA's legal and privacy functions to confirm.

## Principles mapped to product behaviour

| Principle (brief §13)     | Intended product behaviour                                                                                    | What the prototype shows                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lawful basis and purpose  | Every field, API request, notification and sharing action has a documented purpose and authority              | Form fields can carry a `why` ("why the service needs this item"). Consent records hold a purpose and a legal basis — the wording is sample text. A partner check is refused without a stated purpose |
| Data minimisation         | Collect only what the service needs. Social login and public social data are never a source of legal identity | Contacts are always masked. A partner receives a yes/no answer only. An adviser receives a masked reference and a fixed sentence. External channels carry a masked reference. No social login exists  |
| Transparency              | Explain the data source, sharing partner, purpose, retention and correction route                             | Profile values shown in a form are labelled with their source. Consents list recipient and attributes. Channel definitions state what each carries and never carries                                  |
| Rights and remedies       | Access and correction requests, complaints, appeal and human review                                           | Complaints and feedback go to the support mock. A recorded decision carries a review route. There is **no** access, correction, export or deletion-request flow yet                                   |
| Security safeguards       | Encryption in transit and at rest, secrets management, key rotation, HSMs for signing keys, privileged access | None of these. See `docs/security/threat-model.md`, Part 2                                                                                                                                            |
| Retention                 | A records schedule per case type; temporary uploads and derived data deleted when no longer lawfully kept     | Assumed lifetimes only — see "Retention assumptions" below                                                                                                                                            |
| Cross-border              | Assess hosting, provider access, foreign missions and international messaging                                 | Missions abroad are synthetic service points. Nothing leaves the device, so no transfer takes place. The real question is open                                                                        |
| Children and guardianship | Explicit age, guardian-authority and safeguarding rules; no casual family-account access to a child's record  | A family link has an authority type, a verification state, a plain-language scope and an expiry. The workflow mock records the link on a draft or case but does not check it                          |

## Purpose before collection

The brief's design principles ask the product to "explain collection, purpose, retention, access
and sharing before the user submits" and to "show why a data item is needed and where it comes
from". The contracts support this: a form field has an optional `why`, a pre-filled value has a
`source`, an evidence item has a `retention` line, and a service has `cautions` to state limits
plainly. Whether every screen uses them is a matter for design review, not something this document
can vouch for.

## Consent per channel, receipts and withdrawal

The brief (§8) asks for "per-channel opt-in, purpose, timestamp, language, frequency and opt-out",
and for transactional and promotional messages to be kept apart.

| Behaviour                             | In the prototype                                                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| One preference per channel            | Secure inbox, push, WhatsApp, email, SMS. Each row has `enabled`, `purpose`, `language`, a consent reference and a time           |
| The secure inbox cannot be turned off | Switching it off is refused: it is the canonical place for official notices                                                       |
| Switching on records consent          | A `CONSENT-DEMO-…` reference and timestamp are stored on the row                                                                  |
| Switching off withdraws it            | The reference is cleared. Later notices are logged as `SUPPRESSED` with the reason "You have switched this channel off"           |
| WhatsApp needs its own opt-in         | The WhatsApp mock holds the opt-in and sends nothing without it. Opt-in and opt-out confirmations appear in the mock chat         |
| Purpose                               | Always `TRANSACTIONAL`. There is no promotional messaging                                                                         |
| Frequency                             | Not modelled                                                                                                                      |
| Defaults                              | Push, email and SMS are **on** for a new person; WhatsApp is off. This is a prototype assumption — see open questions             |
| Sharing with an institution           | A consent record names the recipient, attributes, purpose, expiry. Revoking it sets `revokedAt`; a later partner check is refused |

Two gaps to know about. A channel consent is a reference on the preference row, not a full consent
record: it does not appear in the consent list that `identity.listConsents` returns. And the two
mocks are not linked — revoking the seeded WhatsApp consent record does not by itself switch the
channel off; the channel preference does that.

## Children, guardians and delegates

The brief wants guardian authority designed "explicitly", with "no casual family-account access to a
child's identity record", and puts family and delegate access in a later phase that depends on
"identity, legal authority and consent". The prototype has one verified guardian link and one
pending delegate link as sample data, so that the screens can show scope, verification state and
expiry. It does not verify guardianship, check a child's age, or stop a person applying through an
unverified link. Those rules need DHA's legal decisions first.

## Retention assumptions

Every value below is an **ASSUMPTION** made so that the prototype has something to show. None is a
DHA retention rule. All must be replaced by a records schedule approved under the brief's legal and
privacy gate.

| Item                                          | Assumed in the prototype                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Unsubmitted draft                             | Expires 30 days after it is created; expired drafts are no longer returned |
| Evidence placeholder                          | "Deleted when the draft is deleted or the sample data is reset"            |
| Step-up to high assurance                     | Lasts 10 minutes                                                           |
| Secure link in an external message            | The payload carries an expiry 20 minutes ahead; the link is a placeholder  |
| A person's reply to a request for information | Acknowledged but not stored                                                |
| Closed cases, inbox messages, audit events    | Kept until the demo data is reset. No schedule                             |
| Idempotency results                           | The most recent 200                                                        |
| Sample consent and delegation expiries        | Seeded values (for example 90 and 180 days) for display only               |

## What the prototype stores on the device

Nothing is sent anywhere. There are no analytics, no third-party requests and no API calls; the
only network traffic is the browser downloading the site's own files.

| Where            | What                                                                                       | Removed by                                |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `sessionStorage` | The mock session (`hao.session.v1`): role, opaque reference, display name, tier            | Signing out, closing the tab, or a reset  |
| `localStorage`   | All synthetic demo data, under keys starting `hao.v1:`                                     | The in-app reset, or clearing site data   |
| `localStorage`   | Accessibility preferences (`hao.prefs.v1`) and any feature-flag overrides (`hao.flags.v1`) | Clearing site data (the reset keeps them) |
| Cache storage    | A service-worker cache of the site's static files (`hao-shell-v1`). No demo data           | Clearing site data                        |

To clear it:

1. **In the app:** use the "reset demo data" control, where the build has one. It calls `resetDemoData()`
   (`apps/web/src/lib/gateway.ts`), which removes every `hao.v1:` key, empties `sessionStorage` and
   reloads with fresh sample data.
2. **In the browser:** clear site data for the site's address (in Chrome or Edge: developer tools →
   Application → Storage → "Clear site data"). This also removes preferences, flag overrides and
   the offline cache.

The data is synthetic, but free-text boxes accept whatever is typed. Do not type real personal
information into the prototype, and reset the demo data on a shared device when you finish.

## Before live data

The brief is explicit that none of this may touch live data until the following exist. None has
been started in this repository.

- [ ] A privacy impact assessment (the brief also calls it a POPIA impact assessment).
- [ ] A records-management plan and a retention schedule for each case type.
- [ ] A legal-basis review, an agreed consent model and a cross-border processing review
      (Appendix C, gate 2 — accountable functions suggested there: legal services, the Information
      Officer and the privacy office, to be confirmed).
- [ ] A processing inventory and privacy clauses in supplier contracts (§23, privacy evidence).
- [ ] Tests of purpose, consent, access, retention, deletion, data export and cross-border transfer
      (§23).
- [ ] Access, correction, complaint, appeal and human-review routes designed with the service
      owners.
- [ ] Explicit rules for children, guardians and delegates.
- [ ] Supplier obligations for data residency, incident notification, audit and secure deletion
      (§20).
- [ ] DHA approval of "the legal basis, technical controls, data agreements, security assessment
      and accountable operational owner" before any pilot connects to live identity, biometric or
      immigration records (Appendix C).

Questions that need DHA's answer are numbered in `docs/product/open-questions.md`.
