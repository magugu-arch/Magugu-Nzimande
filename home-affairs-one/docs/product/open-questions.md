# Open questions for DHA

Questions that need a decision from the Department of Home Affairs (DHA) before Home Affairs One
can move beyond a synthetic-data prototype. They start from the product brief
(`home-affairs-one-brief.md`): its discovery questions (§02), the executive decisions it requests
(§24), the release decisions in Appendix B and the assumptions in Appendix C. To these we have
added the questions the prototype itself raises — places where we had to assume something to make a
screen work.

Status: all open. Nothing in the "prototype assumes" column is a DHA fact, rule or commitment; each
is a placeholder chosen by the prototype team and will change when the question is answered.

How to use this list: refer to a question by its number (for example "Q-17"). Do not renumber; add
new questions at the end of a group with the next free number, and mark answered ones "Answered"
with a date and a link rather than deleting them.

Sources: **§02**, **§24**, **App. B**, **App. C** are the brief; **Proto** is a question raised by
building the prototype.

## 1. Identity and trust

| #    | Question                                                                                                                                             | Source | Prototype assumes                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Q-01 | What are the legal bases and current policy rules for remote identity proofing?                                                                      | §02    | Nothing; proofing is not simulated                                            |
| Q-02 | Which digital identity regulations, draft policies and trust framework will have been formally approved when procurement begins?                     | §02    | The wallet stays gated and is labelled a concept                              |
| Q-03 | Will DHA establish a digital identity and credential workstream aligned with the final regulatory framework and international standards?             | §24    | —                                                                             |
| Q-04 | Which identity provider, and what approach to assurance, passkeys and account recovery?                                                              | App. B | A mock session; a passkey stub                                                |
| Q-05 | Are the brief's five assurance tiers (A0–A4) the right model, and what should the public call them?                                                  | Proto  | Public, Basic account, Verified account, High assurance, Staff or institution |
| Q-06 | Which assurance tier does each service need — to read guidance, to start, and to submit?                                                             | Proto  | A3 to submit the three online applications; A2, A1 or A0 for the rest         |
| Q-07 | May a session signed in with a passkey alone view personal case status?                                                                              | Proto  | Yes: a passkey sign-in reaches A2; a one-time code alone stops at A1          |
| Q-08 | How long should a step-up to high assurance last — a time window, or a single action?                                                                | Proto  | A 10-minute window                                                            |
| Q-09 | What proofing lifts an account to "verified" and to "high assurance", where can it be done, and how for people without a South African phone number? | Proto  | Not modelled                                                                  |
| Q-10 | What makes account recovery "ready"?                                                                                                                 | Proto  | A passkey and two verified contact channels                                   |
| Q-11 | What, if anything, may be shown about a wallet before the law allows credentials?                                                                    | Proto  | Concept tiles listing attribute names only, never values                      |
| Q-12 | Under what lawful authority, and at which capture points, may biometric verification happen? Is any remote capture intended?                         | Proto  | A flagged preview with no capture of any kind                                 |
| Q-13 | Which workforce identity service, roles and queues apply to staff?                                                                                   | Proto  | Two invented roles and four invented queues                                   |
| Q-14 | Which attributes may an accredited institution ask about, on what authority, and is a yes/no answer enough?                                          | Proto  | Three invented scopes; yes/no only; refused without live consent              |

## 2. Service rules and content

| #    | Question                                                                                                                             | Source | Prototype assumes                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------- |
| Q-15 | Which one or two journeys form the MVP, judged on volume, legal readiness, API availability, public value and operational readiness? | §24    | Smart ID replacement, adult passport and birth registration as examples |
| Q-16 | Who owns and approves service content — requirements, fees, eligibility, timeframes — and through what sign-off and versioning?      | Proto  | Sample content, version `sample-0.1`, labelled as sample                |
| Q-17 | Is the brief's nine-family status taxonomy acceptable, and what should each status be called in each official language?              | Proto  | English labels such as "Received" and "We need something from you"      |
| Q-18 | How may decisions be explained: outcome wording, reason categories, and the review or appeal route?                                  | Proto  | "Decision recorded", a reason category and a placeholder review route   |
| Q-19 | May the tracker ever show an expected timeframe, and from which live operational data?                                               | Proto  | The workflow mock states none                                           |
| Q-20 | How long is an unsubmitted draft kept, and how is the expiry shown?                                                                  | Proto  | 30 days                                                                 |
| Q-21 | What is the exact declaration wording, who may accept it (applicant, guardian, delegate), and is a step-up needed at that moment?    | Proto  | An explicit tick; high assurance to submit                              |
| Q-22 | Which fees apply, who maintains them, and what are the refund rules?                                                                 | Proto  | A labelled sample amount, or "to be confirmed"                          |
| Q-23 | Which services may be completed online, which are guidance with a hand-off, and which are information only?                          | Proto  | Three online; the rest hand-off or information                          |
| Q-24 | What are the legal bases and policy rules for guardianship, minor applications and digital document issuance?                        | §02    | Not modelled                                                            |
| Q-25 | Which evidence may be submitted remotely for each service, in what formats, and with what checks?                                    | Proto  | No uploads; a placeholder stands in for evidence                        |

## 3. Integration and data

| #    | Question                                                                                                                                                                           | Source | Prototype assumes                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| Q-26 | Which service APIs exist, which are planned, and which currently need staff-mediated processing?                                                                                   | §02    | None; every service is a mock                   |
| Q-27 | What are the actual systems of record for birth, marriage, death, identity, passport, citizenship, visa, ETA and refugee case data?                                                | §02    | None named                                      |
| Q-28 | Will DHA authorise a service and systems discovery across current portals, identity systems, ETA, the population register, the partner banking model, payments and communications? | §24    | —                                               |
| Q-29 | Will DHA approve an integration and security architecture proof of concept using synthetic data and sandbox-only connectors?                                                       | §24    | —                                               |
| Q-30 | Where will the service be hosted, and what are the data-residency requirements?                                                                                                    | App. B | Static files; data stays in the browser         |
| Q-31 | How will population-register and biometric integration work, and who owns it?                                                                                                      | App. B | No integration                                  |
| Q-32 | Which case or workflow system, and which API and event standards?                                                                                                                  | App. B | A workflow mock and an in-memory event bus      |
| Q-33 | What are the requirements for audit retention, SIEM, privileged access and resilience?                                                                                             | App. B | An audit mock with no retention rule            |
| Q-34 | Which payment arrangements apply, including refunds and reconciliation?                                                                                                            | App. B | A sandbox stub                                  |
| Q-35 | Which case events will source systems emit, and can they map to the status taxonomy without manual re-keying?                                                                      | Proto  | Fifteen invented event types                    |
| Q-36 | Can one correlation ID be carried from channel to case to partner?                                                                                                                 | Proto  | Gateway and workflow IDs are separate today     |
| Q-37 | Do the back-end systems accept idempotency keys for submit, payment and booking? If not, where is duplicate protection applied?                                                    | Proto  | The client gateway applies it                   |
| Q-38 | What is the source of truth for service points — locations, capabilities, hours, accessibility features and live availability?                                                     | Proto  | Ten synthetic service points on a schematic map |
| Q-39 | Which profile fields may be read from authoritative systems and shown for confirmation, and what is the correction route?                                                          | Proto  | Mock values labelled with their source          |

## 4. Channels and messaging

| #    | Question                                                                                             | Source | Prototype assumes                                                            |
| ---- | ---------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| Q-40 | Who owns messaging, consent records and provider webhooks, including the official sender identities? | App. B | A mock orchestrator                                                          |
| Q-41 | Which notification templates are approved, by whom, and how are they versioned?                      | Proto  | Eight invented templates, each "v1"                                          |
| Q-42 | Must every channel be an explicit opt-in, or may transactional notices be on by default?             | Proto  | Push, email and SMS on by default; WhatsApp off until opted in               |
| Q-43 | May the secure inbox be mandatory?                                                                   | Proto  | Yes; it cannot be switched off                                               |
| Q-44 | How long should a secure link in a message live, and must it be single-use?                          | Proto  | A placeholder link with a 20-minute expiry                                   |
| Q-45 | Is "last four characters" an acceptable masked reference?                                            | Proto  | Yes: `••••2481`                                                              |
| Q-46 | What are the fallback order, quiet hours and frequency limits across channels?                       | Proto  | Not modelled                                                                 |
| Q-47 | Which low-risk options may a WhatsApp menu offer?                                                    | Proto  | Service points, general guidance, call-back; anything personal is handed off |
| Q-48 | Is a web app (PWA) acceptable for a pilot, or are iOS and Android apps required from the start?      | Proto  | PWA only                                                                     |
| Q-49 | Which languages are required on each messaging channel?                                              | Proto  | English only                                                                 |

## 5. Operations and support

| #    | Question                                                                                                                 | Source | Prototype assumes                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------- |
| Q-50 | Which banks, branches, courier providers and foreign missions are onboarded, and what service-level commitments apply?   | §02    | None named                                      |
| Q-51 | Who is the DHA product owner, and who sits on the cross-functional steering group?                                       | §24    | —                                               |
| Q-52 | Who handles call-backs and complaints, and what context may be passed to an adviser with the person's consent?           | Proto  | A masked reference and one fixed sentence       |
| Q-53 | Who hosts the staff console, on which devices and network, and what may staff do from it rather than in the case system? | Proto  | A route in the same app, for demonstration only |
| Q-54 | Should this channel ever record a decision, or only display one recorded elsewhere?                                      | Proto  | A staff action that confirms human review       |
| Q-55 | Who publishes service alerts, disruption notices and fraud warnings, and through what process?                           | Proto  | Sample alerts                                   |
| Q-56 | How do staff assist a person at a service point without handling their credentials?                                      | Proto  | Not modelled                                    |
| Q-57 | What service levels and continuity arrangements apply?                                                                   | App. B | None stated                                     |
| Q-58 | Which baselines and service-performance measures will be set and published from the first pilot?                         | §24    | No analytics are collected                      |

## 6. Legal and privacy

| #    | Question                                                                                                                            | Source | Prototype assumes                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------ |
| Q-59 | What data hosting, cross-border transfer and records-retention standards must the programme meet?                                   | §02    | —                                                |
| Q-60 | Who completes the legal-basis review, POPIA impact assessment, retention schedule, consent model and cross-border review, and when? | App. C | Not started                                      |
| Q-61 | What legal-basis wording must people see for each collection and each consent?                                                      | Proto  | Sample wording, marked as sample                 |
| Q-62 | What is the retention period for each record type: drafts, cases, evidence, messages, delivery logs, consents and audit events?     | Proto  | See `docs/privacy/privacy-notes.md`              |
| Q-63 | How will access, correction and deletion requests be made and fulfilled?                                                            | Proto  | No such flow exists                              |
| Q-64 | At what age may a person hold their own account, how is guardian authority proved and ended, and what may a guardian see and do?    | Proto  | One sample guardian link; no rules enforced      |
| Q-65 | Is delegation between adults allowed, and with what scope, duration and proof?                                                      | Proto  | One sample delegate link, pending                |
| Q-66 | For missions and people abroad, which processing happens where, and which international messaging providers may be used?            | Proto  | Synthetic missions; nothing leaves the device    |
| Q-67 | Will the working name "Home Affairs One" go through brand, language and legal review?                                               | App. C | A working name, with a concept ribbon            |
| Q-68 | Will an AI guide be permitted, under what assurance, and who owns its knowledge base?                                               | Proto  | Keyword search only; no model                    |
| Q-69 | May AI-generated photographs be used at all, and should the two images showing a flag motif or a uniform (A35, A52) be replaced?    | Proto  | Concept use only; the two are flagged for review |

## 7. Accessibility and language

| #    | Question                                                                                                                         | Source | Prototype assumes                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| Q-70 | Which accessibility and language standards must the programme meet?                                                              | §02    | WCAG 2.2 AA as a target; English only                         |
| Q-71 | Which languages come first, for which content (interface, guidance, legal notices, notifications), and who reviews translations? | Proto  | No language packs yet                                         |
| Q-72 | Is sign-language content or interpreter booking required, and where?                                                             | Proto  | An invented service-point feature, "sign language by booking" |
| Q-73 | Is voice guidance or read-aloud for low literacy in scope for a pilot?                                                           | Proto  | Not built                                                     |
| Q-74 | Who audits accessibility, and who recruits disabled people for testing?                                                          | Proto  | A manual test procedure only                                  |
| Q-75 | Which name, date and address conventions must be supported?                                                                      | Proto  | A first name and an initial; South African date formats       |
| Q-76 | Is a low-data mode enough for people with costly or limited data?                                                                | Proto  | A "use less data" setting that loads the smallest images      |
| Q-77 | What assisted route must exist at pilot for people without a smartphone, or on a shared device?                                  | Proto  | Not modelled                                                  |

## 8. Delivery and procurement

| #    | Question                                                                                                                                               | Source | Prototype assumes                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------- |
| Q-78 | Does DHA approve "Home Affairs One" as a working product concept for discovery, not as a final public brand?                                           | §24    | —                                            |
| Q-79 | Will DHA commission user research and prototype testing with South Africans across languages, provinces, ages, abilities and levels of digital access? | §24    | No research has been done                    |
| Q-80 | Which procurement standards must the programme meet?                                                                                                   | §02    | —                                            |
| Q-81 | Which enterprise standards govern the choice of stack — hosting, gateway, workflow, identity?                                                          | App. C | The brief's options are for evaluation only  |
| Q-82 | What are the funding and procurement route, the pilot cohort, the exit criteria and the rollback plan?                                                 | App. C | No budget, price or service level is implied |
| Q-83 | Is it agreed that the staff console and partner portal are separate deployables in a separate zone before any pilot?                                   | Proto  | One app for the prototype (ADR-002)          |
| Q-84 | Who owns the source, where is it hosted, and what pipeline and security tooling are required?                                                          | Proto  | No pipeline or scanning for this folder      |
| Q-85 | Is this prototype to be thrown away after discovery, or carried forward once the architecture and controls are approved?                               | Proto  | Built to be replaceable behind typed ports   |
| Q-86 | When will the programme facts the brief relied on (dated November 2026) be revalidated?                                                                | App. C | The prototype states none of them            |
