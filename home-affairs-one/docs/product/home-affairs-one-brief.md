<!--
  Converted from the approved reference artifact
  "Home Affairs One — Comprehensive App Briefing with 60 Images and Claude Code" (Word, 21 November 2026).
  Text only: the 60 photographs are in assets/masters/ and registered in docs/design/asset-manifest.md;
  the three concept-screen mock-ups and the architecture diagram are described in docs/architecture/.
  This file is a conversion, not an edit. If it and the Word document disagree, the Word document wins.
-->

**HOME  
AFFAIRS ONE**

**THE NATIONAL DIGITAL IDENTITY  
& CITIZEN SERVICES ECOSYSTEM**

One trusted identity. Every service. Every channel. Anywhere.

**PRODUCT VISION • UI/UX STRATEGY • SERVICE DESIGN • TECHNICAL ARCHITECTURE • CLAUDE CODE BLUEPRINT**

A strategic concept and implementation-ready product brief for the  
Department of Home Affairs, Republic of South Africa

**Prepared by LegacyLeverage Creative Agency \| 21 November 2026**

**CONSOLIDATED CREATIVE + PRODUCT EDITION \| 60 VISUAL ASSETS EMBEDDED \| 60 ORIGINAL IMAGE PROMPTS \| CLAUDE CODE HANDOFF**

**WORKING CONCEPT — NOT AN OFFICIAL DHA PRODUCT OR POLICY**

# Contents

This document is structured as a product and delivery blueprint. It is intended for executive discussion, service-design workshops, technical discovery and a Claude Code-assisted prototype build.

**01** Executive proposition and decision summary

**02** South African context: what exists and what is changing

**03** International benchmark and transferable patterns

**04** Product vision, outcomes and design principles

**05** Users, service catalogue and product boundaries

**06** Information architecture and app navigation

**07** Priority journeys and service blueprints

**08** Omnichannel communications: app, web, WhatsApp, email, SMS and social

**09** UI/UX direction and conceptual screen models

**10** Feature and capability matrix

**11** Target architecture and integration matrix

**12** Digital identity, credentials and trust model

**13** Security, privacy, POPIA and responsible AI

**14** AI assistant, automation and future technology

**15** International and diaspora expansion

**16** Data model and API contract principles

**17** Technology stack and engineering standards

**18** Claude Code implementation blueprint

**19** Delivery roadmap and workstreams

**20** Operating model, governance and procurement

**21** KPIs, service-level measures and benefits

**22** Risk register and mitigations

**23** Testing, launch and acceptance matrix

**24** Executive decisions and next steps

**Appendix A** Claude Code master build prompt

**Appendix B** Reference architecture and sample data objects

**Appendix C** Research sources and assumptions

Appendix D 60-image visual asset register and gallery

Appendix E Full 60-prompt cinematic photography library

Appendix F Claude Code visual-asset integration handoff

# 01 \| Executive proposition and decision summary

Home Affairs One is a proposed national digital front door for civic identity, immigration and citizen services. It should connect to authoritative DHA systems and partner channels rather than create a second population register.

The proposal is to design and deliver a secure, accessible, multilingual, mobile-first service ecosystem that allows South Africans, residents, travellers and authorised institutions to complete suitable Home Affairs tasks through one coherent experience. The ecosystem combines native Android and iOS apps, a responsive web/PWA experience, a secure digital identity layer when legally enabled, WhatsApp Business messaging, email, SMS, contact-centre support and assisted service points.

## The strategic idea

Home Affairs One turns the department’s “Home Affairs @ home” direction into an integrated customer experience: discover a service, understand what is required, authenticate, apply, pay, book or choose a partner service point, receive progress updates, resolve exceptions and securely access issued credentials. Routine journeys should move online where policy, law and operational controls allow; people who need help must retain access to human and physical channels.

## Why now

The department has already begun major service modernisation. The 2026/27 public performance plan describes a digital-first vision and references mobile apps, banking integrations, automation, document verification and AI-enabled fraud detection \[1\]. The official “Home Affairs @ home” programme was announced as a five-year transformation direction in 2024 \[2\]. On 18 November 2026, DHA announced adult passport applications at 480 bank branches and a national passport service footprint of 708 locations; its speech also reported 833 branches offering Smart ID replacement services \[3\]. These are foundations to integrate, not features to duplicate.

South Africa’s Digital ID regulatory framework is progressing but should not be treated as fully live by assumption. The draft regulations were published for comment in May 2026, with optional smartphone credentials proposed alongside physical documents \[4\]. On 1 October 2026, the Minister said public comments were still being processed before finalising the rules \[5\]. The proposed wallet therefore has a legally gated release plan.

## The proposed experience promise

- One account and one consistent service journey across channels.

- One secure inbox and one application timeline, even when a service spans multiple agencies or partners.

- One identity layer with assurance appropriate to the action, not a blanket requirement for high-friction biometrics on every visit.

- One clear explanation of requirements, fees, processing stages, exceptions and next actions.

- One inclusive access model that supports smartphones, web, WhatsApp assistance, call centres and physical service points.

## Executive recommendations

| **Decision area** | **Recommendation**                                                                                                                                                               |
|-------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Product name      | Use “Home Affairs One” as a working concept name only; conduct brand, language and legal review before adoption.                                                                 |
| Strategic posture | Build as a channel and service orchestration layer around authoritative DHA systems; avoid a destructive “big bang” replacement.                                                 |
| First release     | Launch secure account, service discovery, application initiation, tracking, appointments/service-point locator, secure inbox and help; prioritise ID/passport journeys with DHA. |
| Digital wallet    | Design for future credentials but release only after legal authority, standards, trust framework and operational readiness are confirmed.                                        |
| WhatsApp          | Use as a consent-based notification and guided-assistance channel; never make WhatsApp the identity authority or store of record.                                                |

# 02 \| South African context: what exists and what is changing

## Current service landscape

The Department already operates online services and a growing network of decentralised access points. The current eHomeAffairs portal supports selected online ID and passport applications, payments and bookings, while the service description notes that a branch visit may still be required for biometric capture or verification \[6\]. A newer My Home Affairs Online portal describes account creation, applications, tracking, branch appointments, citizenship reinstatement and partner-branch access \[7\].

The current transformation context also includes the Electronic Travel Authorisation (ETA), launched in August 2026 with biometric verification, machine-learning capabilities and upgraded electronic movement-control infrastructure \[8\]. The proposal should integrate with these existing products through governed APIs and workflow interfaces, not create competing processes.

## Verified programme markers as at 21 November 2026

| **Publicly reported milestone**                                                            | **What it means for the app programme**                                                                                                | **Source**   |
|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|--------------|
| Home Affairs @ home: five-year digital-first vision                                        | Align app roadmap to the department’s direction to digitise routine services and reduce the need for in-person visits.                 | \[2\]        |
| Smart ID replacement: 753 bank branches announced 11 Nov 2026                              | Service-point locator, partner eligibility, branch capability, booking/walk-in rules and application status must be accurate and live. | \[9\]        |
| Adult passports at 480 bank branches announced 18 Nov 2026; 708 passport service locations | Service catalogue must be rules-driven by branch, customer category, document type and date; avoid static branch lists.                | \[3\]        |
| ETA launched 12 Aug 2026                                                                   | Traveller journeys require international UX, multi-language content, travel rules, payment and case-status integration.                | \[8\]        |
| Digital ID: draft regulations in May; comments being considered in October                 | Wallet must be a gated capability. Do not represent a mock credential as a valid legal identity document.                              | \[4\], \[5\] |
| Current portal advertises application tracking and partner-branch search                   | Unify these services with mobile channels and a consistent customer timeline.                                                          | \[7\]        |

## Product implication: unify the experience, not the databases

A “single app” does not mean a single monolithic system. The correct pattern is a single, recognisable front door with federated identity, reusable service components, secure workflow APIs, event-driven status updates and authoritative systems retaining responsibility for legal records. The population register remains the source of truth; app profile fields must not silently overwrite legal records.

## Discovery questions that must be answered with DHA

- Which service APIs exist, which are planned, and which currently require staff-mediated processing?

- What are the actual systems of record for birth, marriage, death, identity, passport, citizenship, visa, ETA and refugee case data?

- What are the legal bases and current policy rules for remote identity proofing, guardianship, minor applications and digital document issuance?

- Which banks, branches, courier providers and foreign missions are onboarded, and what service-level commitments apply?

- What current digital identity regulations, draft policies and trust framework have been formally approved by the time procurement begins?

- What data hosting, cross-border transfer, records retention, accessibility, language and procurement standards must the programme meet?

# 03 \| International benchmark and transferable patterns

The global lesson is not “copy the most features”. The lesson is to combine trusted identity, a clear service catalogue, interoperable data exchange, low-friction access, accessible patterns and a joined-up communications layer.

| **Platform / country**            | **What stands out**                                                                                                                                        | **Pattern to adapt for South Africa**                                                                                                  | **Caution / boundary**                                                                                            |
|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| Singpass — Singapore              | Trusted digital identity; login to 2,700+ services across 800 agencies/businesses; biometric or 2FA access; document signing and data pre-fill. \[10\]     | Reusable sign-in, consent-based data retrieval, document signing and an identity wallet that works across public and private services. | National trust, legal and identity infrastructure must be built before broad federation.                          |
| LifeSG — Singapore                | 100+ government services, benefits, reminders, application status, personal profile and appointments in one app. \[11\]                                    | Life-event journeys, personalised dashboard, proactive reminders and service discovery built around user needs.                        | Do not overwhelm the home screen with every departmental service.                                                 |
| GOV.UK app and Design System — UK | Personalised access, saved topics, browsing history and experimental AI answers; shared accessible design components and service standards. \[12\], \[13\] | Plain language, tested patterns, reusable UI components, research-led service design, transparent performance measurement.             | Avoid AI answers being treated as official decisions; retain clear links to policy and case officers.             |
| myGov — Australia                 | Official app for account access, inbox messages, service links and a digital wallet for some government cards and certificates. \[14\]                     | Secure government inbox, wallet structure, notifications and access to multiple agencies.                                              | Keep identity proofing and service access separate from generic content browsing.                                 |
| UAE Pass — United Arab Emirates   | National mobile identity for public and private services and digital signatures. \[15\]                                                                    | One identity and signature capability, available on mobile, integrated into multiple services.                                         | Requires a national identity assurance and trust framework.                                                       |
| DigiLocker — India                | Secure digital document wallet, issuer-backed documents, consent-based sharing and instant verification. \[16\]                                            | Verified document issuance and sharing, document provenance and institution-to-institution verification.                               | Do not treat user-uploaded scans as issuer-verified credentials.                                                  |
| EU Digital Identity Wallet        | Cross-border public/private access, document storage and selective sharing; intended for use across EU member states. \[17\]                               | Design credentials and APIs for standards-based portability, selective disclosure and future international interoperability.           | South Africa cannot assume foreign credentials are legally recognised without bilateral and standards agreements. |

## The recommended global design pattern

Combine the LifeSG “life-event” model, Singpass trusted authentication, myGov secure inbox, DigiLocker issuer-verifiable documents, UAE Pass digital signatures and GOV.UK service design discipline. Keep the service accessible for people who are not digitally confident, do not have a modern smartphone, or need a human caseworker.

## Global principles to adopt

- Once-only data principle: ask only for information that the department is legally permitted to collect and cannot safely retrieve from an authoritative source.

- Selective disclosure: share only the attributes required for a specific purpose, with a clear statement of who is requesting the information and why.

- Standards-first identity: align identity proofing and authentication with NIST SP 800-63-4 and interoperable credential standards where appropriate. \[18\], \[19\]

- Joined-up channels: users should not have to repeat their case history when they move from app to call centre, email or branch.

- Open, accessible components: build a reusable design system and publish APIs and component standards where public-sector policy permits.

# 04 \| Product vision, outcomes and design principles

## Vision statement

To make trusted Home Affairs services simple to access, easy to understand and secure to complete — wherever a person lives, works or travels — while protecting the integrity of South Africa’s national identity system.

## Product outcomes

| **Outcome**            | **Citizen impact**                                              | **Department impact**                                | **Indicative measure**                                                             |
|------------------------|-----------------------------------------------------------------|------------------------------------------------------|------------------------------------------------------------------------------------|
| Access and inclusion   | More services reachable from mobile, web and assisted channels. | Fewer avoidable visits; wider geographic coverage.   | Digital completion rate; assisted completion rate; access by province and channel. |
| Speed and transparency | Clear status, next step and expected action.                    | Lower avoidable enquiries; improved case visibility. | Median end-to-end time; status enquiry rate; SLA attainment.                       |
| Trust and integrity    | Secure authentication and verified documents.                   | Reduced fraud exposure and stronger audit trails.    | Fraud loss; identity proofing exception rate; security incidents.                  |
| Service quality        | Consistent guidance, accessible language and proactive updates. | Lower abandonment and repeat applications.           | Completion and abandonment; complaint rate; customer effort score.                 |
| Interoperability       | Less repeated paperwork across public and partner services.     | Reusable identity and integration capabilities.      | API reuse; data re-entry reduction; partner service uptime.                        |
| International reach    | Better access for citizens abroad and eligible travellers.      | More predictable consular and immigration workflows. | Overseas case completion; ETA decision and support metrics.                        |

## Design principles

- People first, cases second: organise around what people are trying to achieve — “register a birth”, not “form CIV-01”.

- No dead ends: every unavailable service explains why, what to do next, alternative channels and how to get help.

- Progressive assurance: ask for stronger proof only when the service action and risk require it.

- No wrong door: users can start on WhatsApp, web, mobile or a branch and continue without losing the context that can lawfully be carried forward.

- Explain decisions: show the status, reason category, outstanding requirement and appeal/review route where legally applicable.

- Accessible by default: large touch targets, screen-reader semantics, keyboard support, high contrast, captions and plain language.

- Digital optionality: retain physical Smart ID and other legally recognised options and assisted access.

- Privacy at every step: explain collection, purpose, retention, access and sharing before the user submits.

- Built to evolve: API-first, event-driven, modular, standards-based and independently testable.

# 05 \| Users, service catalogue and product boundaries

## Primary user groups

| **User group**                                     | **Needs / context**                                                                 | **Product response**                                                                                               |
|----------------------------------------------------|-------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| South African citizens                             | Birth registration, ID, passport, family events, citizenship, proof of identity.    | Citizen profile, civic service journeys, document wallet when authorised, application timeline, reminders.         |
| Parents and guardians                              | Register a child, manage minor applications, prove guardianship and consent.        | Family profiles with delegated access, guardian verification, clear consent and child-protection rules.            |
| Permanent residents and eligible foreign nationals | Status, documents, renewals, proof of lawful status and immigration processes.      | Separate resident journeys; eligibility rules and evidence requirements by legal category.                         |
| Visitors and travellers                            | ETA, visas, travel guidance, pre-arrival checks and case status.                    | International-friendly web/app journeys, passport country selection, ETA and visa guidance.                        |
| South Africans abroad                              | Passport and civic services through missions, consulates and authorised channels.   | Overseas service directory, timezone-aware appointment booking, remote support and courier/collection information. |
| People needing assistance                          | Low data, shared phones, limited digital literacy, disability or language barriers. | Assisted digital, branch and mobile-unit channels; accessible design; non-smartphone fallback.                     |
| Accredited institutions                            | Identity and document verification with lawful authority.                           | Separate institutional portal and API access with purpose limitation, consent/authority and audit.                 |
| DHA staff and partners                             | Case processing, exceptions, appointments, service health and audit.                | Role-based staff workbench, queues, workflow controls, operational dashboards and partner portal.                  |

## Proposed service catalogue

| **Domain**               | **Initial / core services**                                                                                      | **Future or complex services**                                                                          |
|--------------------------|------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Identity                 | Smart ID replacement; first-time ID where eligible; identity status checks; profile and identity support.        | Digital ID credential issuance and selective disclosure, only after legal and technical approval.       |
| Passports                | Adult passport applications; renewals/replacements; appointment/service point; progress and collection/delivery. | Minor applications, emergency travel document journeys, enhanced ePassport services, overseas renewals. |
| Birth and family         | Birth registration guidance; birth certificate application; correction pathway; family-linked child profiles.    | Integrated hospital birth notifications, cross-agency life-event workflows, complex late registration.  |
| Marriage and civil union | Marriage registration guidance, certificate requests and status.                                                 | Digital appointment/certificate workflows subject to law and registrar operations.                      |
| Death and estate events  | Death registration guidance and certificate request/status.                                                      | Secure downstream notifications to authorised agencies, with consent and clear legal basis.             |
| Citizenship              | Citizenship information, application initiation, reinstatement portal hand-off and progress.                     | Complex determinations, appeals and document-heavy case management.                                     |
| Immigration              | ETA, visa information, eVisa application, status and appointment.                                                | Residence permits, work/study categories, asylum/refugee workflows, case-specific legal processes.      |
| Travel and border        | ETA information, traveller pre-check, application status, travel alerts.                                         | Interoperable traveller credentials and trusted carrier integrations subject to border policy.          |
| Support and complaints   | FAQs, secure messaging, call-back, complaint and feedback.                                                       | AI triage and case routing with human escalation and audit.                                             |

Scope is proposed. Some service types have complex legal or operational prerequisites; they should be surfaced as guidance and secure hand-off before full end-to-end digital processing is enabled.

# 06 \| Information architecture and app navigation

## Recommended main navigation

| **Navigation item** | **Purpose**                                               | **Primary modules**                                                                                        |
|---------------------|-----------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Home                | Personalised starting point and next best action.         | Profile status, saved services, recent applications, reminders, service alerts.                            |
| Services            | Find and start a service.                                 | Identity, passports, birth/family, marriage, death, citizenship, immigration/travel.                       |
| My Applications     | Track all cases in one timeline.                          | Status, milestones, requests for information, bookings, payments, delivery/collection.                     |
| Digital Wallet      | View or present valid digital credentials when available. | Digital ID, official certificates, credential sharing, proof and revocation status.                        |
| Messages            | Official communications and support.                      | Secure inbox, WhatsApp preferences, email/SMS preferences, call-back and complaints.                       |
| Profile             | Manage user account and preferences.                      | Identity verification level, contact details, language, accessibility, family/delegates, privacy controls. |

## Home screen content hierarchy

1.  Greeting + context: “Good morning, Thandi” and a clear statement of what the app can do.

2.  One primary action: continue an unfinished application or address an outstanding request.

3.  Quick service cards: Smart ID, passport, birth/family, immigration, appointments and help.

4.  Application timeline: status, last updated, what happens next and estimated SLA only when backed by live operational data.

5.  Service point finder: nearby authorised branches, partner banks, mobile units and missions; filters by service, accessibility and availability.

6.  Official alerts: major disruptions, service changes, fraud/scam alerts and travel updates.

## Navigation rules

- Use action labels (“Apply for a passport”) rather than internal department terminology.

- Keep no more than five primary navigation destinations visible on mobile; group secondary items under “More”.

- Support universal search across services, guidance, appointments and case references.

- Allow a signed-in user to resume a partially completed form from any approved channel.

- Keep a public, no-login layer for service information, branch search and general help.

- Never show sensitive identity details on lock-screen notifications or in unprotected app previews.

# 07 \| Priority journeys and service blueprints

## Journey A — Replace a Smart ID

| **Step**              | **Citizen experience**                                                                 | **System / control**                                            |
|-----------------------|----------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| 1\. Discover          | Select “Replace Smart ID”; see eligibility, fee, available channels and documents.     | Rules service returns current eligibility and channel options.  |
| 2\. Authenticate      | Sign in; use passkey/device biometrics and risk-based step-up where needed.            | Identity provider; session risk; verified contact details.      |
| 3\. Pre-fill          | Confirm required profile information; review any pre-populated fields.                 | Authoritative read APIs; user correction pathway.               |
| 4\. Submit and pay    | Review declaration, consent, fee and payment options.                                  | Application service; payment provider; idempotency and receipt. |
| 5\. Choose fulfilment | Select eligible bank/branch, mobile unit or other permitted collection/delivery route. | Live service-point capability, calendar and routing.            |
| 6\. Verify / capture  | Complete biometric capture or verification through authorised approved channel.        | DHA/partner device; biometric match; exception queue.           |
| 7\. Track             | Receive secure inbox update and optional WhatsApp/SMS notification.                    | Case events drive status; no manual re-keying.                  |
| 8\. Receive           | Collection or delivery instruction; secure acknowledgement.                            | Dispatch/collection integration; identity check at handover.    |

## Journey B — Register a birth

A parent or guardian receives a clear “Register a birth” guided journey. The app explains statutory timeframes and required evidence, supports secure identity/guardian checks, and routes the case to the appropriate registration workflow. Where a hospital or health facility integration exists and is legally approved, pre-populate verified birth notification data; do not allow the app to create or alter the legal birth record without the required registrar validation. If a case is late, disputed or incomplete, route to a specialist queue with a named next action.

## Journey C — Traveller obtains ETA

A traveller selects nationality, travel purpose and arrival context, receives official eligibility guidance, completes an application, uploads or captures required evidence through secure controls, pays if required, receives status and can present the valid outcome to relevant authorities. The app should link to the authoritative ETA system and clearly state that an application receipt is not travel authorisation. The DHA announced ETA as a modern digital immigration system in August 2026 \[8\].

## Journey D — Citizen abroad

A South African living overseas chooses country and nearest embassy/consulate or approved service route, sees services available at that mission, views time-zone-aware appointments, starts an application, receives secure communications and gets collection/courier guidance. Digital application should be enabled only where regulations, biometric capture and delivery operations allow it. The department has stated an intention to extend digitised ID/passport access to citizens abroad \[20\].

## Journey E — Help without losing context

A user starts with the app’s AI-supported service guide, chooses WhatsApp for a simple clarification or requests a call-back. The hand-off transfers a case token and the minimum context the user has consented to share. A staff member sees the same application timeline and previous conversation summary. Sensitive documents are submitted only through the secure app/web upload flow.

# 08 \| Omnichannel communication strategy

Communications must work as one governed service, not six disconnected inboxes. The case-management platform owns the case status; the notification orchestrator distributes approved messages to the user’s chosen channels and logs delivery outcome. The secure app inbox remains the canonical location for detailed notices and personal documents.

## Channel role matrix

| **Channel**                           | **Best use**                                                                               | **Permitted content**                                                                  | **Do not use for**                                                                                                             |
|---------------------------------------|--------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| iOS / Android push                    | Time-sensitive prompts and reminders.                                                      | Generic alert, masked reference, secure deep link.                                     | Full ID/passport numbers, biometric details or legal documents.                                                                |
| In-app secure inbox                   | Formal case notices and document access.                                                   | Detailed status, outstanding evidence, receipts, official letters and consent records. | Unverified third-party messages.                                                                                               |
| WhatsApp Business Platform            | Opt-in reminders, FAQ, simple structured routing, call-back request, service-point links.  | Approved templates; minimal case reference; secure hand-off link; service notices.     | Biometric capture, passport scans, sensitive personal records, final legal decisions or authoritative identity authentication. |
| Email                                 | Formal correspondence, account alerts, receipts and links to secure inbox.                 | Non-sensitive summaries and secure links; attachments only where policy permits.       | Unencrypted bulk identity records or documents sent to unverified addresses.                                                   |
| SMS                                   | Low-bandwidth fallback and critical reminders.                                             | Short masked reference and official URL/short code.                                    | Detailed case data or sensitive identity attributes.                                                                           |
| Contact centre / IVR                  | Human assistance, accessibility, complex cases and escalation.                             | Verified case lookup using step-up controls; call-back scheduling.                     | Unauthenticated disclosure of personal case details.                                                                           |
| Social platforms                      | Public information, education, campaign updates, service disruption notices and listening. | Public service info; direct users to authenticated channels.                           | Accepting ID document uploads, changing account data, authenticating identity or resolving cases in public DMs.                |
| Branch / bank / mobile unit / mission | Biometrics, assisted digital, exceptional cases and lawful in-person processes.            | Approved capture/verification, identity checks, assisted applications.                 | Unlogged staff workarounds or unofficial handling of user passwords/OTP.                                                       |

## WhatsApp solution architecture

- Operate a verified official WhatsApp Business Account through Meta WhatsApp Business Platform / Cloud API, using approved templates, documented opt-in/opt-out and delivery webhooks. \[21\], \[22\]

- Use interactive buttons or Flows for low-risk routing only: choose a service or language, request a call-back, locate a service point or read general guidance. \[22\]

- For a personal case update, send only a masked reference and a short-lived secure deep link; require Home Affairs One authentication before showing details.

- Never use WhatsApp as the identity authority or default repository for OTPs, biometric data, passport scans or sensitive case documents.

- Provide direct human escalation and a call-back route; reconcile message events with the secure inbox and case timeline.

## Communication governance

| **Control**                        | **Required implementation**                                                                                                                                                  |
|------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Consent and preferences            | Per-channel opt-in, purpose, timestamp, language, frequency and opt-out; distinguish transactional from promotional communication.                                           |
| Sender integrity and anti-phishing | Approved sender IDs/domains, template registry, content approval and event log; publish official channels and never ask for passwords, OTPs or payment to personal accounts. |
| Delivery and fallback              | Retries, rate limits, provider SLAs, email SPF/DKIM/DMARC and WhatsApp delivery webhooks; fall back to the next consented channel.                                           |
| Privacy and social listening       | Minimise notification data; use short-lived secure links; move case conversations from public DMs to verified channels and retain records under policy.                      |

# 09 \| UI/UX direction and conceptual screen models

## Design direction

The visual system should feel like a trusted national service: calm, clear, contemporary and dignified. Use a restrained national palette with deep navy for trust, white and soft neutral surfaces for clarity, blue for primary actions, teal/green for success and amber for attention. Red should be reserved for errors or important warnings, not used to make routine screens feel alarming. The palette below is a proposed design direction, not official DHA brand guidance.

| **Token**     | **Proposed value** | **Use**                                     |
|---------------|--------------------|---------------------------------------------|
| Midnight Navy | \#102A43           | Navigation, headings, trust surfaces.       |
| Action Blue   | \#1261A0           | Primary buttons, links, focus states.       |
| Teal          | \#0F766E           | Secondary emphasis and informational tags.  |
| Success Green | \#1A7F5A           | Completed and verified states.              |
| Warm Gold     | \#D5A52A           | Attention and waiting states.               |
| Surface       | \#F2F6F9           | Cards and panels.                           |
| Error Red     | \#C83B3B           | Critical error and destructive action only. |

## Core UI principles

- Content first: plain-language summary before form fields.

- One dominant action per screen, with clear secondary and back actions.

- Short, saveable forms split into meaningful steps with progress indication.

- Use strong field labels and examples; never rely on placeholder text alone.

- Show why a data item is needed and where it comes from.

- Provide review-before-submit screens, fee summary and declaration.

- Design empty, loading, offline, error, retry and exception states at the same quality as happy paths.

- Support dynamic text size, screen readers, switch access, captions, audio guidance and keyboard navigation.

## Concept screen 1 — Personalised home

Illustrative UI only. Names, status text and credential wording are fictional design placeholders, not live user records or an approved Home Affairs interface.

## Concept screen 2 — Application tracker

The tracker should only show live stage and timestamps from connected workflow systems; do not fabricate ETAs or imply a document is valid before issue.

# 09 \| UI/UX direction (continued)

## Concept screen 3 — Omnichannel communications

The app should explain channel purpose and safety. A user may opt out of non-essential channels without losing access to statutory services.

## Responsive design requirements

| **Form factor**   | **Design requirements**                                                                                                      |
|-------------------|------------------------------------------------------------------------------------------------------------------------------|
| Mobile 360–430 px | Single column, sticky primary CTA, thumb-friendly controls, minimal data entry, biometric unlock through OS where supported. |
| Tablet / kiosk    | Large touch controls, high contrast, timeout and privacy curtain, assisted-mode staff hand-off.                              |
| Desktop web       | Multi-column forms where appropriate, clear status timeline, document upload, accessible tables and printable receipts.      |
| Low-bandwidth web | Compressed images, progressive enhancement, small payloads, resumable forms and no auto-play media.                          |
| WhatsApp          | Concise menus, short structured prompts, official number indicators and secure hand-off to app/web.                          |

# 10 \| Feature and capability matrix

| **Capability**           | **Functional scope**                                              | **Release**         | **Priority** | **Dependency**                        |
|--------------------------|-------------------------------------------------------------------|---------------------|--------------|---------------------------------------|
| Identity account         | Registration, sign-in, verified contact, profile, secure recovery | MVP                 | Critical     | DHA identity and access platform      |
| Passkeys / MFA           | Device passkey, recovery, step-up authentication                  | MVP                 | Critical     | Identity provider; NIST alignment     |
| Service catalogue        | Search, filters, eligibility, requirements, fees, channels        | MVP                 | High         | Content and policy rules CMS          |
| Application workspace    | Draft/save/resume, upload, declarations, submit                   | MVP                 | Critical     | Case management / workflow APIs       |
| Application timeline     | Milestones, last update, requests, next actions                   | MVP                 | High         | Event stream from case systems        |
| Smart ID                 | Replacement / eligible applications and branch route              | MVP integration     | Critical     | DHA + bank partner orchestration      |
| Adult passport           | Application, fee, partner/branch selection, status                | MVP integration     | Critical     | DHA + partner branches                |
| Birth registration       | Guidance, application initiation and case tracking                | Phase 2             | High         | Civil registration systems            |
| Marriage services        | Registration and certificate request journeys                     | Phase 2             | Medium       | Civil registration systems            |
| Death services           | Registration/certificate guidance and status                      | Phase 2             | High         | Civil registration systems            |
| Citizenship              | Application guidance, secure hand-off, tracking                   | Phase 2             | High         | Citizenship casework                  |
| ETA / visas              | Traveller account, ETA hand-off/integration, status               | MVP / Phase 2       | Critical     | ETA / immigration platform            |
| Resident/permit services | Permit, renewal, appointment and casework                         | Phase 3             | High         | Immigration case management           |
| Digital wallet           | Legal credentials, selective sharing, revocation                  | Gated Phase 3       | Critical     | Digital ID issuer and trust framework |
| Document verification    | QR / online verifier, consent and audit                           | Gated Phase 3       | Critical     | Credential verification service       |
| Appointments             | Booking, reschedule, cancellation, reminders                      | MVP                 | High         | Branch and partner calendars          |
| Service point finder     | Map/list, service capability, accessibility, hours                | MVP                 | High         | DHA / banks / mobile units / missions |
| Payments                 | Secure payment, receipt, refunds/reconciliation                   | MVP                 | Critical     | Government-approved payment gateway   |
| Secure inbox             | Official notices, receipts, action requests                       | MVP                 | Critical     | Notification / content service        |
| WhatsApp                 | Opt-in messaging, FAQ flows, call-back and deep links             | MVP limited         | High         | Meta Cloud API integration            |
| Email and SMS            | Transactional messaging and fallback                              | MVP                 | High         | Messaging gateway                     |
| AI service guide         | Search, FAQ, eligibility guidance with citations                  | Phase 2             | High         | Approved knowledge base + RAG         |
| Human support            | Ticket, call-back, agent hand-off and history                     | MVP                 | High         | CRM / contact centre                  |
| Family/delegate access   | Guardian authority, minor cases, scoped delegation                | Phase 2             | Critical     | Identity, legal authority and consent |
| Institution portal       | Accredited verification requests and audit                        | Phase 3             | Critical     | Partner identity federation / API     |
| Overseas services        | Mission directory, timezone, overseas workflows                   | Phase 2             | High         | Foreign mission systems               |
| Fraud reporting          | Report suspected fraud, protect account, case status              | Phase 2             | High         | Fraud/risk management system          |
| Service alerts           | Outages, disruptions, travel / emergency notices                  | MVP                 | Medium       | Operations status feed                |
| Analytics                | Service funnel, SLA, channel and inclusion measures               | MVP internal        | High         | Governed data platform                |
| Staff workbench          | Case queue, review, exception, audit, SLA dashboard               | Parallel workstream | Critical     | Case management / IAM                 |

MVP means first public product increment; MVP integration does not mean replacing the underlying DHA service. Scope requires confirmation with product owners and the department’s systems-of-record inventory.

# 11 \| Target architecture and integration matrix

Use a secure, API-first, modular architecture with a channel layer, identity and access service, service-domain APIs, workflow orchestration, event notifications, integration adapters and governed data/analytics. The app must not connect directly to mainframe or register databases. Every access should pass through an API gateway and policy-enforcement layer.

Conceptual target architecture. It is not a representation of DHA’s current internal infrastructure. Final topology must be based on a technical discovery and security architecture review.

## Architecture layers

| **Layer**        | **Components**                                                                   | **Design requirement**                                                       |
|------------------|----------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| Experience       | iOS, Android, PWA/web, WhatsApp, email, SMS, agent/partner portal.               | Channel-specific UX, shared design system and consistent case context.       |
| Edge / API       | API gateway, WAF, OAuth/OIDC, rate limits, consent/purpose checks.               | No direct database access; versioned APIs; strong identity and device trust. |
| Identity         | Customer identity provider, passkeys, MFA, proofing, credential issuer/verifier. | Assurance level by risk; secure recovery; standards and trust governance.    |
| Service domains  | Civic, passport, immigration, ETA, appointment, payment, notification, support.  | Bounded domains and clear system-of-record ownership.                        |
| Workflow         | Case orchestration, document management, rules, SLA, staff tasks and appeals.    | Human review, exception queues, traceable decisions and idempotent actions.  |
| Integration      | API adapters, event bus, partner connectors, message broker, ETL.                | Decoupled from legacy; retry, dead-letter queues and reconciliation.         |
| Data and insight | Operational data store, reporting, analytics, fraud signals, audit log.          | Purpose limitation, lineage, retention and access separation.                |
| Operations       | Observability, SIEM/SOC, secrets, HSM/KMS, backup, DR, support.                  | 24/7 critical service resilience with tested incident and recovery plans.    |

## Integration matrix

| **System / partner**                 | **Integration purpose**                                           | **Pattern**                           | **Control / dependency**                                                   |
|--------------------------------------|-------------------------------------------------------------------|---------------------------------------|----------------------------------------------------------------------------|
| Population Register                  | Authoritative identity and civil status lookup/update.            | Secure API + event model              | DHA data owner; least privilege; legal basis; audit each request.          |
| ABIS / biometric systems             | Identity proofing and duplicate/fraud detection.                  | Controlled biometric service API      | No raw biometrics in channel apps; liveness, PAD, false-match monitoring.  |
| Passport / document production (GPW) | Document issue, production status and secure delivery.            | Workflow API + event callbacks        | Document serialisation, secure status and reconciliation.                  |
| ETA / eMCS / immigration             | Traveller, ETA, visa and border case status.                      | Domain API / event integration        | BMA/DHA roles, travel rules, system availability, human review.            |
| Bank branches                        | Smart ID/passport service-point capabilities and capture process. | Partner API / partner portal          | Accreditation, branch service matrix, device certification and SLA.        |
| Payment gateway                      | Fees, refunds, reconciliation and receipt.                        | Hosted payment + server-side callback | PCI scope reduction; signed webhook; no card data storage.                 |
| WhatsApp Cloud API                   | Templates, inbound flows and delivery events.                     | Webhook + API adapter                 | Opt-in, approved templates, data minimisation, access control.             |
| Email/SMS provider                   | Transactional delivery and fallback.                              | Messaging gateway                     | Sender verification, failover, anti-phishing and delivery receipts.        |
| Foreign missions                     | Overseas appointment and service workflows.                       | Federated portal/API                  | Consular data protection, time zones, local operations and access control. |
| Accredited verifiers                 | Lawful identity or document checks.                               | Consent/purpose-bound API             | Accreditation, scopes, transaction audit, user-visible disclosures.        |

# 12 \| Digital identity, credentials and trust model

## Identity is not a login screen

A username/password or a phone’s Face ID is not, by itself, a government-grade identity proof. Home Affairs One should distinguish account authentication, identity proofing, legal identity status and authority to act on behalf of another person. Apply assurance proportional to risk and to the legal consequence of the action. NIST SP 800-63-4 provides current guidance on proofing, authentication and federation, including risk-based assurance controls \[18\].

## Recommended assurance tiers

| **Tier**                 | **Example actions**                                                                                                   | **Controls**                                                                                                                                           |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| A0 — Public / anonymous  | View requirements, fees, public branch map, travel guidance.                                                          | No personal data; basic abuse controls.                                                                                                                |
| A1 — Basic account       | Save preferences, receive general reminders, draft non-sensitive forms.                                               | Verified email/phone; passkey or MFA; account recovery.                                                                                                |
| A2 — Verified account    | View personal case status, make appointment, manage contact channels.                                                 | Identity proofing appropriate to service, MFA/passkey, device/risk monitoring.                                                                         |
| A3 — High assurance      | Submit identity-changing applications, access protected credentials, approve legal declarations or delegated actions. | DHA-approved proofing, strong MFA, step-up controls, liveness/biometric check where lawful, transaction confirmation and audit.                        |
| A4 — Institution / staff | Access population or case data in an official role.                                                                   | Federated workforce identity, hardware-bound MFA, role/attribute access, purpose-based authorisation, privileged access management and enhanced audit. |

## Digital wallet roadmap

Prepare for a wallet capable of holding DHA-issued digital credentials such as digital identity and civil certificates, but do not issue or represent a credential as legally valid until regulations, accreditation, cryptographic trust, issuer obligations, revocation and verification rules are approved. The draft 2026 regulations proposed optional digital credentials that coexist with physical documents and regulated data sharing \[4\]; the Minister’s October 2026 speech described finalisation as still in progress \[5\].

### Wallet capabilities to design for

- Credential issuance by an authorised DHA issuer, signed and cryptographically verifiable.

- Secure storage protected by device hardware and a user-controlled access method.

- Selective disclosure: share only required attributes (e.g., over-18 proof rather than full birth date where legally accepted).

- QR or proximity presentation with verifier identity, purpose and expiry shown to the user.

- Verifier portal/API that checks issuer, signature, validity, status and revocation.

- Recovery and re-issuance when a device is lost, replaced or compromised.

- Offline verification only where trust policy, expiry, revocation freshness and device security allow it.

- A clear alternative physical credential and human service pathway.

## Credential standards

Use open standards and interoperability as a design requirement. W3C Verifiable Credentials Data Model 2.0 is a Recommendation published in May 2025 and defines issuer-holder-verifier exchange for tamper-evident claims \[19\]. Select concrete formats, cryptographic suites and protocols only through the DHA trust framework and interoperability working group. The EU wallet is a useful policy/architecture comparator, not automatic legal recognition for South African credentials \[17\].

# 13 \| Security, privacy, POPIA and responsible AI

## Privacy and legal principles

POPIA sets minimum conditions for processing personal information, regulates public and private bodies, addresses unsolicited electronic communications and automated decision-making, and regulates cross-border flows of personal information \[23\]. The app programme must include a privacy impact assessment and records-management plan before live data is used.

- Lawful basis and purpose: every field, API request, notification and sharing action must have a documented purpose and authority.

- Data minimisation: collect only what is required for that service; do not make social login or public social data a source of legal identity.

- Transparency: explain data source, sharing partner, purpose, retention and correction route.

- Rights and remedies: support access/correction requests, complaints, appeal and human review pathways consistent with law.

- Security safeguards: encryption in transit and at rest, secrets management, key rotation, hardware security modules for signing keys and strict privileged access.

- Retention: define record schedules for each case type; delete temporary uploads and derived data when lawful retention no longer applies.

- Cross-border: assess hosting, service-provider access, foreign missions and international messaging against POPIA transfer conditions and government policy.

- Children and guardianship: design age, guardian authority and safeguarding rules explicitly; no casual family-account access to a child’s identity record.

## Security baseline

| **Control domain**   | **Minimum design baseline**                                                                                                                                                     |
|----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Authentication       | Passkeys where supported; phishing-resistant MFA for staff/admins; step-up authentication for high-risk transactions; secure recovery.                                          |
| Authorisation        | RBAC + ABAC; purpose-bound scopes; tenant/partner isolation; least privilege; time-limited staff elevation.                                                                     |
| Encryption           | Modern TLS for all network traffic; strong encryption at rest; managed keys and rotation; HSM/KMS for issuer and signing keys.                                                  |
| Biometrics           | Use only under lawful authority; liveness and presentation-attack detection; independent bias/error testing; secure capture; no biometric images retained on device by default. |
| Application security | Threat modelling; secure SDLC; SAST/DAST/SCA; dependency pinning; secrets scanning; mobile app attestation where justified.                                                     |
| Audit                | Append-only security and case audit trails; record who accessed what, why, when, source, decision and any change.                                                               |
| Resilience           | DDoS protection, rate limiting, backups, disaster recovery, offline/assisted fallback and tested incident response.                                                             |
| Supply chain         | Security assessment of cloud, messaging, payment, biometric, courier and identity providers; contractual breach notification and audit rights.                                  |

## AI: assist, never silently adjudicate

AI can reduce confusion and workload, but final determinations that affect citizenship, immigration status, identity, asylum/refugee protection or access to legal rights must remain under legally accountable human and rules-based decision processes. AI outputs must be labelled as assistance, grounded in approved policy content, logged and reviewable.

- Use retrieval-augmented generation over versioned DHA-approved sources; show citations and effective dates, state uncertainty and route unresolved questions to a person.

- Never use AI to make final identity matches, visa decisions, citizenship determinations, asylum/refugee decisions or legal eligibility decisions.

- Use AI only for guidance, translation assistance, completeness hints, triage and human-reviewed summaries; never train public models on submitted identity documents or live cases, and log model and knowledge versions.

# 14 \| AI assistant, automation and future technology

## Home Affairs digital guide

The proposed assistant is a service guide, not an unofficial decision-maker. It should help a person understand what service they need, what information to prepare, how to navigate a form, what a status means and how to reach a person. It can operate in the app, website and a limited WhatsApp guidance flow, but must use channel-specific safety rules.

| **Capability**                | **Use case**                                                                                           | **Guardrail**                                                                      |
|-------------------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|
| Conversational service search | “I need to renew my passport for my child.” Identify likely service and ask only needed clarification. | Use service catalogue rules; show source links; do not guess eligibility.          |
| Form copilot                  | Explain fields, flag missing information, save draft.                                                  | User reviews every field; no automatic submission or declaration acceptance.       |
| Document checklist assistant  | Check file presence, format, legibility and completeness.                                              | Do not assert legal authenticity; refer to authorised checks.                      |
| Case status explainer         | Translate a valid system status into plain language.                                                   | Only use authenticated case events; show last sync timestamp.                      |
| Translation and accessibility | Plain-language summaries, language switching, read-aloud and captions.                                 | Human-reviewed critical legal translations; user can switch to source language.    |
| Agent copilot                 | Summarise case history and suggest next step to authorised staff.                                      | Staff verifies facts; every action attributed to staff; monitor automation bias.   |
| Fraud signal triage           | Detect anomalous patterns and route to investigation.                                                  | Human investigation; explainable reason codes; bias and false-positive monitoring. |

## Future-ready capabilities

- Proactive life-event guidance: optional reminders for document expiry, passport renewal window or scheduled appointment; never infer life events without lawful source and user control.

- Verifiable document exchange: citizens share a digitally signed certificate with a bank or agency without sending a scan, where the law allows it.

- Digital consent receipts: user can see what was shared with which institution and revoke future access where applicable.

- Real-time service capacity: show live appointment, branch and mobile-unit capability based on verified operational data.

- Multilingual voice interface: voice guidance for low-literacy or accessibility use, with clear confirmation before any submission.

- Fraud-resistant communication: official message directory, signed notification metadata and in-app warnings about impersonation.

- Cross-border identity: standards-based credential verification and interoperable travel processes subject to agreements and legal recognition.

- Privacy-preserving analytics: aggregate service performance and fairness monitoring without exposing identifiable case data to dashboards.

# 15 \| International and diaspora expansion

## National rollout first; international capability by design

The product architecture should be international-ready but should not launch all immigration or consular services at once. Use language, jurisdiction, time zone, currency, service rules, identity assurance and document requirements as configurable dimensions. The same UI can support citizens abroad, foreign nationals applying to enter South Africa, and accredited entities verifying documents, but these are separate legal and operational journeys.

## International user groups

| **Group**                             | **Potential services**                                                                                             | **Key requirements**                                                                                        |
|---------------------------------------|--------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| South Africans abroad                 | Passport renewal/replacement, birth registration abroad, citizenship and civil certificates, mission appointments. | Mission-specific service rules, time zones, biometrics, secure courier/collection, foreign payment options. |
| Foreign visitors                      | ETA, visa information, application, payment, status, travel guidance.                                              | Nationality rules, multi-language support, passport-country mapping, privacy and payment compliance.        |
| Foreign residents in South Africa     | Permits, renewals, status and appointments.                                                                        | Legal category rules, case privacy, interpreter support and human review.                                   |
| Accredited institutions abroad        | Document verification and proof of identity where authorised.                                                      | Trust framework, bilateral agreements, legal recognition, data transfer controls and audit.                 |
| Airlines / carriers / travel partners | Trusted travel-status checks or ETA integration where formally approved.                                           | Role-limited API, purpose limits, security testing, no exposure of unrelated personal data.                 |

## Internationalisation checklist

- Country selector and clear “South Africa services” distinction.

- Language packs and right-to-left support readiness where future languages require it.

- Date, number, address and name conventions; do not assume western name order.

- Accessible identity proofing for users without a South African phone number.

- Currency, payment and refund rules controlled by authorised finance policy.

- Timezone display in user local time plus the mission’s local time.

- Country-specific privacy, data transfer, sanctions and provider screening as required.

- Clear explanation of visa/ETA decision authority and travel-document validity.

# 16 \| Data model and API contract principles

## Core entities (conceptual)

| **Entity**           | **Key fields / purpose**                                                                                   | **Sensitivity**         |
|----------------------|------------------------------------------------------------------------------------------------------------|-------------------------|
| Person Account       | Account ID, verified contact channels, locale, device credentials, account recovery state.                 | High                    |
| Identity Reference   | DHA person identifier/token, source-system reference, assurance tier, verification timestamp.              | Very high               |
| Family Relationship  | Person A/B, relationship type, legal authority, guardian proof, start/end, verification status.            | Very high               |
| Service Definition   | Service code, eligibility rules, requirements, fee references, available channels, version/effective date. | Internal/public content |
| Application Case     | Case ID, service code, applicant token, status, timestamps, assigned queue, next action.                   | Very high               |
| Evidence Item        | Document type, secure object reference, source, checksum, scan status, retention schedule.                 | Very high               |
| Appointment          | Location, service capability, date/time, booking status, user/case token.                                  | High                    |
| Payment Record       | Payment reference, amount, currency, provider token, reconciliation status, receipt.                       | High                    |
| Credential           | Issuer, credential type, subject token, claims, issued/expiry time, signature, status/revocation.          | Very high               |
| Consent / Disclosure | Purpose, recipient, data attributes, legal basis, timestamp, expiry/revocation.                            | Very high               |
| Message Event        | Channel, template, recipient token, consent state, delivery status, content version.                       | High                    |
| Audit Event          | Actor, action, resource, purpose, timestamp, outcome, source IP/device, correlation ID.                    | Very high               |

## API design rules

- Use versioned REST/JSON for synchronous service APIs; use events for status changes, dispatch and asynchronous partner workflows.

- Use OpenAPI contracts, schema validation, API lifecycle ownership and deprecation windows.

- Use opaque identifiers and scoped tokens; do not expose national ID number as the public case ID.

- Idempotency keys for application submit, payment, appointment and retry operations.

- Use correlation IDs from channel to case to external partner for tracing without leaking PII.

- Use signed callbacks/webhooks, replay protection and mutual TLS or equivalent for sensitive partners.

- Return standard error categories with a safe user message and trace reference; do not expose internal stack details.

- Build contract tests and sandbox environments before onboarding a bank, mission, courier or agency.

## Suggested status taxonomy

| **Status family** | **User-facing state**              | **Rules**                                                          |
|-------------------|------------------------------------|--------------------------------------------------------------------|
| Draft             | Not submitted                      | User can edit; draft expiry policy visible.                        |
| Submitted         | Received                           | Receipt and timestamp; no approval implication.                    |
| In validation     | Identity / evidence checks         | Show what is being checked, without disclosing fraud controls.     |
| Action required   | We need information from you       | List required item, due date and secure upload CTA.                |
| Scheduled         | Appointment confirmed              | Show time, location, service availability and rescheduling rules.  |
| Processing        | In progress                        | Use live status event and last-updated time.                       |
| Decision          | Approved / declined / referred     | Display official notice and applicable review/appeal route.        |
| Fulfilment        | In production / ready / dispatched | Secure collection/delivery instructions and handover verification. |
| Closed            | Completed / withdrawn / cancelled  | Retain receipt and case history per policy.                        |

# 17 \| Technology stack and engineering standards

The final stack must be selected through DHA enterprise architecture, hosting, procurement and cyber-security standards. The following is a recommended reference stack for a proof-of-concept and scalable production design, not a claim that these technologies are mandated or already approved.

| **Layer**            | **Recommended options**                                                                                                | **Selection note**                                                                                             |
|----------------------|------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| iOS / Android        | React Native + TypeScript, or Flutter if the department has an established Dart capability.                            | Use a single cross-platform design system but native modules for secure storage, biometrics and accessibility. |
| Web / PWA            | Next.js / React + TypeScript.                                                                                          | Responsive and accessible; shared API contracts and design tokens.                                             |
| Design system        | Figma library + Storybook + tokens; WCAG 2.2 AA target.                                                                | Reusable components, documented interaction and content patterns.                                              |
| Backend              | Java / Kotlin Spring Boot, .NET, or approved enterprise stack.                                                         | Prefer existing DHA capability; domain services behind API gateway.                                            |
| API / gateway        | Kong, Apigee, Azure API Management or government-approved equivalent.                                                  | Use existing government platform where available; avoid vendor lock-in.                                        |
| Workflow / case      | Camunda / Flowable / existing DHA case platform.                                                                       | Long-running case processes, human tasks, SLA timers and audit.                                                |
| Identity             | Approved OIDC provider, passkeys/WebAuthn, HSM/KMS and federation.                                                     | DHA trust framework must define identity proofing and credential issuance.                                     |
| Messaging            | WhatsApp Business Platform, SMTP provider, SMS gateway, push services.                                                 | Use adapter pattern; one preference/consent service.                                                           |
| Data                 | PostgreSQL for app-domain data; existing authoritative registers remain system of record; object storage for evidence. | Data separation, encryption, retention and clear ownership.                                                    |
| Events / integration | Kafka / RabbitMQ / managed event bus; API adapters; schema registry.                                                   | Select based on approved standards, throughput and operational capacity.                                       |
| Observability        | OpenTelemetry, central logs, metrics, traces, SIEM/SOC.                                                                | Privacy-aware logs; redact sensitive data at source.                                                           |
| Delivery             | GitHub Enterprise/GitLab, CI/CD, automated tests, IaC, container platform.                                             | Protected branches, signed builds, vulnerability gates and reproducibility.                                    |

## Non-functional targets for design discovery

| **Measure**   | **Initial target to validate**                                                                         | **Notes**                                                                      |
|---------------|--------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| Availability  | 99.9% for core self-service; higher tiers for critical identity/payment APIs based on business impact. | Set SLOs with service owners; do not promise before load testing.              |
| Performance   | 95th percentile under 2.5s for key non-upload app/API interactions under agreed load.                  | Separate channel performance from slow authoritative back-end calls.           |
| Recovery      | Define RTO/RPO by service domain; test DR at least annually and after major architecture changes.      | Identity, payment and case events require ordered recovery and reconciliation. |
| Accessibility | WCAG 2.2 AA target for web; equivalent mobile accessibility criteria and assistive-tech tests.         | W3C Recommendation and user testing to govern acceptance.                      |
| Scalability   | Horizontal scale for campaign peaks, visa peaks and national rollouts.                                 | Capacity based on forecast and concurrency, not population alone.              |
| Observability | End-to-end correlation ID across channel, APIs, workflow and external callbacks.                       | Dashboards for users, operations, partners and executives.                     |

# 18 \| Claude Code implementation blueprint

Claude Code should be used as a development accelerator inside a controlled software-engineering process. It must not be treated as an autonomous authority to invent legal rules, handle production credentials or connect to real DHA records. Begin with a working prototype using synthetic data and mocked services; connect approved sandbox APIs only after access and architecture review.

## Repository structure

home-affairs-one/

apps/

mobile/ \# React Native iOS + Android

web/ \# Next.js responsive portal / PWA

staff-console/ \# Separate protected operations console

services/

api-gateway/

identity-adapter/

service-catalogue/

application-workflow/

appointments/

notifications/

payments-adapter/

whatsapp-adapter/

audit-service/

packages/

design-system/

api-contracts/

auth-client/

accessibility/

shared-types/

infrastructure/

local/ dev/ staging/ production/

docs/

product/ architecture/ security/ privacy/ runbooks/

tests/

contract/ integration/ e2e/ accessibility/ security/

.claude/

CLAUDE.md

rules/

## Claude Code operating rules

- Read CLAUDE.md and the docs/architecture and docs/security documents before coding.

- Do not invent Home Affairs law, fees, requirements, application status or eligibility rules. Use versioned synthetic fixtures until verified policy/rules are provided.

- Never connect to production DHA systems or use real identity documents, biometrics, passports or population-register data during development.

- Never store secrets in source control, prompts, mobile bundles, logs or test fixtures. Use environment variables and approved secret stores.

- Require human approval before schema migrations, destructive operations, production deployment, external API activation or changes to security policy.

- Use TypeScript strict mode, linting, formatting, unit tests, contract tests, accessibility tests and security scanning.

- Every feature must include loading, empty, offline, error, retry, exception and success states.

- Do not generate fake logos, official seals, government notices or official legal text. Use approved assets only.

- Keep all external integrations behind adapters and mocked interfaces.

- Write a short implementation plan before editing; after changes, report files changed, tests run, known gaps and rollback plan.

## Recommended build sequence

| **Sprint / phase**         | **Claude Code task**                                                                | **Exit condition**                                                    |
|----------------------------|-------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| 0\. Foundations            | Monorepo, CI, design tokens, app shell, lint/test pipelines, mock server.           | Reproducible local build and CI green.                                |
| 1\. UX shell               | Home, Services, Applications, Messages, Profile, responsive navigation.             | Clickable flows, accessibility review, no live data.                  |
| 2\. Authentication         | OIDC mock, passkey interface stub, verified-contact journey, protected route tests. | Threat model reviewed; secrets absent; no claim of DHA verification.  |
| 3\. Service catalogue      | Versioned content, service cards, requirements, rules stubs and localisation.       | Content sign-off workflow and service catalogue tests.                |
| 4\. Application journey    | Draft/save/resume, synthetic upload, declarations, payment sandbox stub.            | Happy path + exception path + idempotency and audit tests.            |
| 5\. Tracking and messages  | Timeline, notification preferences, secure inbox and fake WhatsApp adapter.         | Event-driven status and opt-out tests pass.                           |
| 6\. Partner/staff surfaces | Branch search, partner sandbox API, staff queue prototype.                          | Role and purpose checks, partner contract tests.                      |
| 7\. Security and release   | Threat model, DAST/SAST/SCA, mobile privacy review, load, DR and accessibility.     | Security approval and go-live checklist signed by accountable owners. |

# 19 \| Delivery roadmap and workstreams

Indicative sequencing below assumes a properly funded multidisciplinary programme and access to DHA product owners, policy specialists, architecture, security teams and integration partners. Dates and duration must be baselined after discovery; no fixed go-live date should be committed before API, legal and operational readiness are known.

| **Phase**                        | **Indicative duration** | **Primary outcomes**                                                                                                                               | **Key workstreams**                                                                              |
|----------------------------------|-------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| 0 — Mobilise & discover          | 0–8 weeks               | Product charter, service inventory, current-state architecture, user research, legal/privacy review, baseline metrics.                             | Executive sponsorship, service design, architecture, policy, data mapping, procurement.          |
| 1 — Prototype & validate         | 8–16 weeks              | Tested UX prototype, design system, user testing, technical proof of concept and sandbox contracts.                                                | Research, Figma, mobile/web shell, identity patterns, integration prototypes.                    |
| 2 — MVP build                    | 4–7 months              | Account, catalogue, secure application initiation, Smart ID/passport journey integration where APIs are approved, tracking, inbox, branch locator. | Mobile/web, API, workflow, messaging, analytics, partner onboarding.                             |
| 3 — National scale               | 7–12 months             | Provincial rollout, more civic services, call-centre integration, assisted digital, operational dashboards and service resilience.                 | Operations, contact centre, change, partner capacity, accessibility, security.                   |
| 4 — Wallet and advanced services | 12–18+ months           | Digital credentials subject to legal readiness, document verification, family/delegation, broader immigration and institution APIs.                | Trust framework, credential issuer, verifiers, governance and cross-government interoperability. |
| 5 — International expansion      | 18+ months              | Citizens abroad, missions, foreign travellers, cross-border verification partnerships.                                                             | Consular service, localisation, legal recognition, foreign payments and partner agreements.      |

## Parallel workstreams

- Product and service design: service inventory, user research, journeys, content, design system, accessibility.

- Identity, security and privacy: identity proofing, trust framework, POPIA, threat modelling, fraud, audit.

- Core platforms and integration: APIs, workflow, event bus, document management, payments, partner adapters.

- Channels and communications: mobile, web, WhatsApp, email, SMS, IVR and staff hand-off.

- Operations and change: caseworker processes, training, branch/partner readiness, support, service management.

- Data and performance: baseline, data quality, dashboards, experimentation and published service measures.

## Rollout approach

Pilot by service and geography rather than by app download alone. Select one or two high-volume journeys with mature process ownership; include metro, township, rural and overseas users in testing. Expand only when operational queues, partner systems, call-centre support and caseworker capacity can absorb the new channel. Retain branch and assisted alternatives throughout.

# 20 \| Operating model, governance and procurement

## Product governance

| **Role**                             | **Accountability**                                                                                           |
|--------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Executive sponsor                    | Own strategic outcomes, resolve cross-agency barriers and approve stage gates.                               |
| Product owner (DHA)                  | Own service outcomes, roadmap, priority, user needs and acceptance decisions.                                |
| Service owners                       | Own process, policy interpretation, requirements, fees, SLAs and case exceptions.                            |
| Chief architect / architecture board | Approve target architecture, integration standards, data ownership and technology exceptions.                |
| CISO / security operations           | Own security architecture, threat model, cyber operations, incident response and risk acceptance.            |
| Information Officer / privacy team   | Own POPIA compliance, privacy impact assessments, data subject rights, retention and vendor privacy clauses. |
| Legal / policy                       | Confirm statutory authority, regulations, delegations, notices, evidence requirements and appeals.           |
| Operations / contact centre          | Own caseworker procedures, support tiers, training, quality and service continuity.                          |
| Partner management                   | Accredit banks, missions, couriers, technology providers and verifiers; monitor SLA and audit.               |
| Independent assurance                | Conduct accessibility, security, privacy, algorithmic fairness, penetration and service-quality reviews.     |

## Procurement principles

- Procure outcomes and open interfaces, not a closed app tied to one vendor.

- Require source-code ownership or durable government rights, documented APIs, data portability and exit provisions.

- Separate identity, messaging, payment and hosting risks; prevent one provider from becoming an unreviewable single point of failure.

- Require security certifications and independent testing relevant to the service risk, not marketing claims.

- Include operational support, training, service design, change management and long-term maintenance in the total cost of ownership.

- Ensure suppliers and subcontractors meet POPIA, data residency, incident notification, audit and secure deletion obligations.

- Make accessibility and inclusive research contractual acceptance criteria.

## Service operations

Define service ownership across business hours and after-hours critical incidents. Establish a single operations view for API health, case backlogs, branch/partner availability, message delivery, payment reconciliation and security alerts. Provide users with honest outage messaging and alternative routes. Every integration needs an owner, SLA, escalation path, contact and tested failure mode.

# 21 \| KPIs, service-level measures and benefits

Measure whether the platform solves user problems and improves departmental outcomes. Downloads, logins and chatbot conversations are adoption signals, not proof of service success.

| **KPI group**  | **Measures**                                                                                              | **How to segment / guard against gaming**                                              |
|----------------|-----------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Access         | Unique people served; successful task completion by channel; assisted completion; service-point coverage. | Province, rural/urban, disability, age band where lawful, language, domestic/overseas. |
| Speed          | Median and 90th-percentile time to submit; end-to-end completion; time awaiting user vs department.       | By service, complexity, channel and partner; publish definitions.                      |
| Quality        | Abandonment, rework, duplicate applications, missing evidence, failed payment and repeat contact.         | Distinguish user error from unclear guidance or system outage.                         |
| Trust          | Account takeover, fraud loss, false acceptance/rejection, privacy incidents, unauthorised access.         | Track false positives/negatives and demographic fairness; independent review.          |
| Communication  | Message delivery, click-through to authenticated service, opt-out, unresolved enquiry and response time.  | Never optimise clicks at expense of privacy or channel consent.                        |
| Operations     | Case backlog, SLA attainment, exception queue age, API uptime, partner reconciliation.                    | Separate department wait time and third-party wait time.                               |
| Inclusion      | Successful completion with assistive tech, low bandwidth, language choice and assisted routes.            | Test with users; avoid inferring sensitive characteristics.                            |
| Cost and value | Cost per completed service, cost of avoidable visits, support cost and integration reuse.                 | Baseline and finance validation before benefit claims.                                 |

## Initial service targets to validate during baseline

| **Measure**            | **Target-setting approach**                                                                                                            |
|------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Application completion | Set a service-specific target after usability testing and current-state baseline; seek measurable reduction in abandonment.            |
| Status enquiries       | Reduce repeat “what is happening?” contacts through accurate event updates, not by hiding support routes.                              |
| Accessibility          | No critical WCAG 2.2 AA blockers at release; recurring user testing with disabled people.                                              |
| Security               | Zero known critical vulnerabilities at release; incident response and remediation times defined by severity.                           |
| Message delivery       | Define provider-specific delivery SLOs and fallback thresholds; do not promise delivery where carrier/provider is outside DHA control. |
| System reliability     | Define per-service SLO, error budget and transparent outage handling; test disaster recovery.                                          |

# 22 \| Risk register and mitigations

| **Risk**                     | **Rating**  | **Exposure**                                                                           | **Mitigation**                                                                                                               |
|------------------------------|-------------|----------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| Digital exclusion            | High        | A smartphone-first channel leaves rural, elderly, disabled or low-income users behind. | Keep assisted access, web, call centre, mobile units and partner locations; optimise low data and accessible workflows.      |
| Identity compromise          | Critical    | Account takeover or deepfake/liveness attack exposes identity and case information.    | NIST-aligned assurance, step-up controls, liveness PAD, device risk, recovery controls and active fraud operations.          |
| Biometric error or bias      | High        | False match/reject impacts lawful access and dignity.                                  | Independent test sets, appeal/human review, alternative path, vendor transparency and ongoing performance monitoring.        |
| Privacy breach               | Critical    | Sensitive identity, family, immigration or biometric data is exposed.                  | POPIA impact assessment, minimisation, encryption, access controls, audit, vendor assurance and incident plan.               |
| Legacy integration fragility | High        | Unavailable or inconsistent back-end systems cause duplicate or stuck cases.           | API adapters, queues, retries, reconciliation, circuit breakers and operational dashboards.                                  |
| Incorrect legal guidance     | High        | AI or content gives outdated or wrong requirements.                                    | Versioned policy content, legal owner approval, citations/effective dates, fallback and human escalation.                    |
| WhatsApp misuse / phishing   | High        | Impersonation, insecure document exchange or user confusion.                           | Verified official identity, strict templates, minimum data, signed domains, in-app secure hand-off and public scam guidance. |
| Partner failure              | High        | Bank, courier, payment or messaging outages interrupt services.                        | Multiple channels/providers where feasible, contract SLAs, failover and partner monitoring.                                  |
| Digital ID legal delay       | Medium/High | Wallet capability cannot legally launch on planned date.                               | Release-gate wallet; launch non-wallet value first; keep credential module behind feature flags.                             |
| Scope and programme overload | High        | Trying to deliver every service simultaneously creates complexity and delays.          | Journey-based MVP, stage gates, product governance and evidence-led prioritisation.                                          |
| Cyber / availability attack  | Critical    | DDoS, ransomware, supply chain or insider incident disrupts core services.             | SOC/SIEM, segmentation, backups, DR, incident exercises, secure build pipeline and privileged access controls.               |
| Vendor lock-in               | Medium/High | Critical identity or messaging services cannot be moved.                               | Open standards, exportable data, documented APIs, source rights, exit plans and portability tests.                           |

# 23 \| Testing, launch and acceptance matrix

| **Test domain** | **What must be tested**                                                                                | **Release evidence**                                                        |
|-----------------|--------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| User research   | Citizen, resident, parent/guardian, traveller, citizen abroad, disabled and low-literacy users.        | Research report, usability issues, design decisions and retest.             |
| Functional      | Eligibility, form validation, save/resume, upload, fees, booking, payment, status and notification.    | Service-specific functional test suite and business acceptance.             |
| Integration     | API contracts, timeouts, duplicate callbacks, event ordering, partner outage and reconciliation.       | Contract/integration tests, sandbox approval and runbooks.                  |
| Identity        | Proofing, recovery, passkey, MFA, account linking, impersonation and delegation.                       | Independent identity assurance/security review.                             |
| Accessibility   | Screen readers, switch control, keyboard, contrast, text scaling, captions and language switching.     | Accessibility audit and user test evidence.                                 |
| Security        | Threat model, penetration test, SAST/DAST/SCA, mobile reverse engineering, secrets and API abuse.      | Security sign-off, remediation report and accepted residual risks.          |
| Privacy         | Purpose, consent, access, retention, deletion, data export and cross-border transfer.                  | POPIA impact assessment, processing inventory and vendor clauses.           |
| AI assurance    | Grounded responses, hallucinations, prompt injection, outdated policy, harmful content and escalation. | Evaluation set, versioned knowledge base, human review and monitoring plan. |
| Resilience      | Load spikes, network loss, provider failure, backups, disaster recovery and failover.                  | Load report, DR exercise evidence and availability SLO.                     |
| Operations      | Call centre, branch, partner, complaints, fraud escalation, manual fallback and outage communication.  | Training, process maps, support model and go-live readiness sign-off.       |

## Launch gates

- Legal authority, regulations, service rules and content approved by accountable DHA owners.

- Security architecture, privacy impact, records retention and data sharing approved.

- All integrations have named system owners, sandbox evidence, SLAs and rollback plans.

- User testing demonstrates successful completion and accessible alternatives.

- Caseworker, call-centre, partner and incident teams are trained and resourced.

- No unresolved critical security or accessibility blockers.

- Status and notification content reconciled against authoritative systems.

- A rollback, outage and customer communication plan is tested.

# 24 \| Executive decisions and next steps

## Decisions requested

7.  Approve “Home Affairs One” as a working product concept for discovery, not as a final public brand.

8.  Appoint a DHA product owner and cross-functional steering group with service, identity, architecture, policy, legal, security, privacy, operations and communications representation.

9.  Authorise a service and systems discovery across current portals, identity systems, ETA, population register, partner banking model, payments and communications.

10. Select one or two MVP journeys based on volume, legal readiness, API availability, public value and operational readiness.

11. Commission a user-research and Figma prototype sprint with South African users across languages, provinces, age groups, abilities and digital access levels.

12. Establish a digital identity and credential workstream aligned with the final regulatory framework and international standards.

13. Approve an integration and security architecture proof-of-concept using synthetic data and sandbox-only connectors.

14. Set measurable baselines and publish a service-performance framework from the first pilot.

## Recommended first 90 days

| **Window**  | **Action**                                                                                  | **Deliverable**                                                                   |
|-------------|---------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|
| Weeks 1–2   | Mobilise; nominate owners; establish governance; confirm source-of-truth map.               | Project charter, RACI, discovery plan, decision log.                              |
| Weeks 3–5   | Service inventory, user research, current portal audit, policy mapping and partner mapping. | Current-state report, pain-point map, service blueprint and API inventory.        |
| Weeks 6–8   | Create UX prototype and design system; test with users; validate WhatsApp/email patterns.   | Clickable prototype, test results, accessibility backlog and content style guide. |
| Weeks 9–10  | Build technical proof of concept with mocked identity, service catalogue and case tracker.  | Demo on Android/iOS/web with sandbox APIs and synthetic data.                     |
| Weeks 11–12 | Threat model, privacy impact, architecture review, pilot scope and benefits baseline.       | MVP backlog, architecture decision record, risk register and stage-gate pack.     |

## Closing proposition

South Africa does not need another disconnected government portal. It needs a trusted, service-led national experience that unifies access while respecting the legal and operational authority of each system. Home Affairs One can become that front door: secure enough for identity, clear enough for everyday use, inclusive enough for the whole country, and standards-based enough to grow across government and international services.

# Appendix A \| Claude Code master build prompt

Copy the block below into Claude Code after placing this briefing in the repository at docs/product/home-affairs-one-brief.md. Replace only environment-specific items after the department has supplied approved architecture, rules and sandbox credentials. Keep all data synthetic until an authorised test environment is formally approved.

You are the senior product engineering team building a non-production prototype of “Home Affairs One”, a South African national digital identity and citizen services ecosystem.

MANDATORY CONSTRAINTS

1\. This is a prototype and integration shell, not an official DHA system. Do not imply government approval.

2\. Never invent DHA law, fees, service requirements, case outcomes, immigration rules or document validity. Use a versioned mock policy catalogue and clearly label it as sample data.

3\. Use synthetic people, ID-like tokens and case references only. Never process actual South African identity documents, biometric samples, passports, population-register records or personal case files.

4\. No production endpoints, credentials, API keys or data. All integrations must be mocks or approved sandbox adapters.

5\. Do not implement final legal/immigration/citizenship/asylum decisions with AI. AI may explain approved guidance, help navigate forms and summarise cases for human review only.

6\. Do not store or transmit ID documents, OTPs, biometrics or detailed personal case data in WhatsApp or public social DMs. WhatsApp may send opt-in notices and deep links to secure authenticated journeys.

7\. Use privacy-by-design, data minimisation, RBAC/ABAC, audit logs, secure secrets management and accessible interfaces.

PRODUCT EXPERIENCE

Build a mobile-first experience for iOS, Android and responsive web/PWA. Primary navigation: Home, Services, My Applications, Digital Wallet (feature-flagged and marked “future / subject to legal approval”), Messages, Profile. Provide separate protected staff and accredited-partner surfaces.

MVP MODULES

\- Account shell with mock OIDC, verified-contact state, passkey UI stub and secure recovery patterns.

\- Service catalogue with categories for identity, passports, birth/family, marriage, death, citizenship, immigration/ETA and help.

\- Guided application journey with save/resume, clear required fields, review/declaration and simulated payment.

\- Application tracker driven by mock case events and timestamps.

\- Service point finder with mock capabilities, hours, accessibility filters and map/list view.

\- Secure inbox and notification preferences.

\- WhatsApp adapter mock showing opt-in, approved-template model, webhook events and secure hand-off.

\- Human help, call-back request, complaint and outage states.

DESIGN

Create a premium, calm, high-trust government design system. Proposed palette: midnight navy \#102A43, action blue \#1261A0, teal \#0F766E, success green \#1A7F5A, warm gold \#D5A52A, neutral surfaces \#F2F6F9. Do not imitate official seals or create fake DHA logos. Use plain language, excellent responsive design and WCAG 2.2 AA as a target. Build reusable components and document states: loading, empty, offline, error, retry, pending, action-required, success and unavailable.

ARCHITECTURE

Use a monorepo with apps/mobile, apps/web, apps/staff-console, services for API gateway adapters, identity, catalogue, workflow, appointments, notifications, payments mock, WhatsApp mock and audit; packages for design-system, contracts, auth-client, accessibility and shared-types. Keep integrations behind typed adapters. Use OpenAPI contracts, synthetic fixtures, idempotency keys, correlation IDs and event-driven status updates. Do not connect directly to databases of record.

ENGINEERING RULES

\- TypeScript strict mode, lint, format, unit tests, integration/contract tests and e2e tests.

\- Use environment variables and secret manager interfaces; commit no secrets.

\- Add audit events for sensitive actions without logging PII or tokens.

\- Add accessibility tests and manual screen-reader test instructions.

\- Add threat model, privacy notes, data classification and retention assumptions in docs/security.

\- Use feature flags for wallet, biometric verification, AI and all partner integrations.

\- Never auto-submit or legally attest on behalf of the user.

\- Every external call must have timeout, retry policy, idempotency, error mapping and observability.

WORKFLOW

Before each implementation phase: inspect the repo, read CLAUDE.md and product docs, write a concise plan, identify assumptions and files to change. Implement in small increments. After each increment run tests, lint and typecheck. Report exact files changed, commands run, results, known limitations and rollback steps. Ask for human approval before destructive migrations, external integrations, production deployment or security-policy changes.

DELIVERY ORDER

Phase 0: repository and design-system foundation.

Phase 1: responsive navigation and three key screens.

Phase 2: mock authentication and service catalogue.

Phase 3: application draft/submit and status tracker.

Phase 4: inbox, channel preferences, WhatsApp mock and support.

Phase 5: staff console, partner sandbox and operational dashboard.

Phase 6: accessibility, privacy, threat-model, load and resilience testing.

FIRST TASK

Do not start coding immediately. First inspect the repository and this brief. Produce: (a) proposed architecture, (b) key user flows, (c) data classification, (d) threat model outline, (e) sprint plan, (f) open questions requiring DHA decisions. Wait for explicit approval before implementing Phase 0.

# Appendix B \| Reference architecture and sample data objects

## Example application object (synthetic only)

{

"caseId": "CASE-DEMO-000041",

"serviceCode": "SMART_ID_REPLACEMENT",

"applicantToken": "PERSON-DEMO-7X3Q",

"status": "ACTION_REQUIRED",

"statusUpdatedAt": "2026-11-21T10:40:00+02:00",

"nextAction": {

"type": "SELECT_SERVICE_POINT",

"description": "Choose an approved service point for the next step",

"dueAt": null

},

"channelPreferences": {

"secureInbox": true,

"whatsapp": false,

"email": true,

"sms": true

},

"dataClassification": "RESTRICTED",

"sourceOfTruth": "DHA_WORKFLOW_ADAPTER_MOCK"

}

The example is invented synthetic data for interface prototyping. It is not a real DHA case, API schema or actual status contract.

## Example notification payload (safe notification)

{

"eventId": "EVT-DEMO-1392",

"channel": "WHATSAPP_TEMPLATE",

"recipientToken": "CONTACT-DEMO-8821",

"templateKey": "application_status_changed_v1",

"maskedReference": "••••2481",

"message": "There is an update to your Home Affairs application. Sign in to view details.",

"secureDeepLink": "https://example.gov.za/app/case/short-lived-token",

"consentRef": "CONSENT-DEMO-88",

"expiresAt": "2026-11-21T11:00:00+02:00"

}

## Release architecture decisions to record

- Hosting and data residency; identity provider, assurance, passkeys and account recovery.

- Population-register and biometric integration; wallet format, issuer/verifier trust and revocation.

- Case/workflow system; APIs, events, audit retention, SIEM, privileged access and resilience.

- Messaging ownership, consent and webhooks; payments, refunds, reconciliation, service levels and continuity.

# Appendix C \| Research sources and assumptions

The recommendations distinguish official South African programme information, international platform examples, standards and proposed product design. Source references below were consulted on 21 November 2026. Dates and claims should be revalidated at procurement and detailed design because government programmes and regulations can change.

**\[1\] DHA Annual Performance Plan 2026/27 —** Department of Home Affairs. Digital transformation strategy and Home Affairs @ home direction. [<u>Open source</u>](https://www.dha.gov.za/images/AnnualReports/DHA-APP-2026-27_260326.pdf)

**\[2\] Five-year digital-first vision: Home Affairs @ home —** South African Government, 30 Sep 2024. Official strategic vision to digitise routine services. [<u>Open source</u>](https://www.gov.za/news/media-statements/minister-leon-schreiber-announces-new-five-year-strategic-vision-turn-home)

**\[3\] Home Affairs triples access to passport services overnight —** South African Government, 18 Nov 2026. Adult passport applications at participating bank branches and national service footprint. [<u>Open source</u>](https://www.gov.za/news/media-statements/home-affairs-triples-access-passport-services-overnight-18-nov-2026)

**\[4\] Draft Digital Identity regulations for public comment —** South African Government, 5 May 2026. Proposed optional digital credentials and data-sharing framework. [<u>Open source</u>](https://www.gov.za/news/media-statements/minister-leon-schreiber-invites-public-comment-draft-digital-identity)

**\[5\] Home Affairs Quantum Leap: A Vision for the Future of Government —** South African Government, 1 Oct 2026. Minister stated draft regulation comments were being processed before finalisation. [<u>Open source</u>](https://www.gov.za/news/speeches/minister-leon-schreiber-home-affairs-quantum-leap-vision-future-government-01-oct)

**\[6\] eHomeAffairs —** Department of Home Affairs. Existing online ID/passport application, payment and booking description. [<u>Open source</u>](https://ehome.dha.gov.za/ehomeaffairsv3?AspxAutoDetectCookieSupport=1)

**\[7\] My Home Affairs Online —** Department of Home Affairs. Current portal: appointments, citizenship reinstatement, partner branches, account and tracking. [<u>Open source</u>](https://myhomeaffairsonline.dha.gov.za/)

**\[8\] Launch of South Africa’s Electronic Travel Authorisation —** South African Government, 12 Aug 2026. ETA announcement and digital immigration system context. [<u>Open source</u>](https://www.gov.za/news/speeches/minister-leon-schreiber-launch-south-africa%E2%80%99s-electronic-travel-authorisation-12-aug)

**\[9\] Smart ID services scale to over 750 bank branches —** South African Government, 11 Nov 2026. Smart ID service-point expansion. [<u>Open source</u>](https://www.gov.za/news/media-statements/minister-leon-schreiber-announces-expansion-smart-id-replacement-services-11)

**\[10\] Singpass —** GovTech Singapore, updated 15 Sep 2026. Digital identity, service access, biometric/2FA, signing and data pre-fill. [<u>Open source</u>](https://www.tech.gov.sg/products-and-services/for-citizens/digital-services/singpass/)

**\[11\] LifeSG app —** Government of Singapore. 100+ services, benefits, reminders, application status and appointments. [<u>Open source</u>](https://www.life.gov.sg/app)

**\[12\] GOV.UK app —** UK Government, updated 13 Feb 2026. Personalised government content, local services and experimental GOV.UK Chat. [<u>Open source</u>](https://www.gov.uk/guidance/download-the-govuk-app)

**\[13\] GOV.UK Design System —** Government Digital Service. Reusable accessible components, patterns and guidance. [<u>Open source</u>](https://design-system.service.gov.uk/)

**\[14\] myGov app —** Australian Government. Account access, inbox, services and selected digital cards/certificates. [<u>Open source</u>](https://my.gov.au/en/about/help/mygov-app)

**\[15\] UAE Pass —** UAE Government. National mobile identity and digital signature. [<u>Open source</u>](https://u.ae/en/about-the-uae/digital-uae/digital-transformation/platforms-and-apps/the-uae-pass-app)

**\[16\] DigiLocker ecosystem —** Government of India, MeitY. Issuer-backed digital document wallet and sharing/verification ecosystem. [<u>Open source</u>](https://www.digilocker.gov.in/web/ecosystem)

**\[17\] EU Digital Identity Wallet —** Council of the European Union, reviewed 11 Nov 2026. Cross-border digital identity wallet and document-sharing direction. [<u>Open source</u>](https://www.consilium.europa.eu/en/policies/eudi-wallet/)

**\[18\] NIST SP 800-63-4 Digital Identity Guidelines —** NIST, July 2025. Current identity proofing, authentication and federation guidance. [<u>Open source</u>](https://csrc.nist.gov/pubs/sp/800/63/4/final)

**\[19\] W3C Verifiable Credentials Data Model v2.0 —** W3C Recommendation, 15 May 2025. Issuer-holder-verifier model and verifiable credential data model. [<u>Open source</u>](https://www.w3.org/TR/vc-data-model/)

**\[20\] Home Affairs marks two years of progress under GNU —** South African Government, 3 Jul 2026. Official digital transformation update and stated future access for citizens abroad. [<u>Open source</u>](https://www.gov.za/news/media-statements/home-affairs-marks-two-years-progress-under-gnu-03-jul-2026)

**\[21\] WhatsApp Business Platform overview —** Meta for Developers. Cloud API, messaging, templates, webhooks, authentication and authorization. [<u>Open source</u>](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/)

**\[22\] Interactive WhatsApp message templates —** Meta for Developers. Approved templates, call-to-action and quick-reply buttons. [<u>Open source</u>](https://developers.facebook.com/docs/whatsapp/api/messages/message-templates/interactive-message-templates)

**\[23\] Protection of Personal Information Act 4 of 2013 —** South African Government. Personal information protection, processing conditions and cross-border flows. [<u>Open source</u>](https://www.gov.za/documents/protection-personal-information-act)

**\[24\] GOV.UK Service Standard —** UK Government. Whole-problem service design, security, privacy, measurement and open standards. [<u>Open source</u>](https://www.gov.uk/service-manual/service-standard)

## Assumptions and limitations

- “Home Affairs One” is a proposed working name, not an official Department product, endorsement or final brand identity.

- Current programme facts are based on official public releases surfaced in the research, with the most recent relevant South African release dated 18 November 2026.

- The Digital ID credential wallet is a future design provision; final laws, regulations, technical trust rules and operating model must be confirmed before release.

- All proposed features require legal, security, privacy, policy, architecture, procurement and operational assessment by the Department.

- Technology stack recommendations are options for evaluation, not final vendor selections or procurement specifications.

- No budget, tender price, delivery guarantee or legally binding service-level commitment is implied.

- The Claude Code prompt is for a synthetic-data prototype and must be amended after DHA approves the architecture and development controls.

## Recommended approval gates before a public pilot

| **Gate**                             | **Approval focus**                                                                                                                            | **Accountable functions (to be confirmed)**         |
|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| 1\. Mandate and scope                | Confirm executive sponsor, service priorities, target users, measurable outcomes and pilot boundaries.                                        | Executive leadership; service owners                |
| 2\. Legal and privacy                | Complete legal-basis review, POPIA impact assessment, retention schedule, consent model and cross-border processing review.                   | Legal services; Information Officer; privacy office |
| 3\. Architecture and security        | Approve identity assurance, system-of-record boundaries, API standards, hosting/data residency, threat model and independent testing.         | CIO / CTO; CISO; architecture authority             |
| 4\. Operations and inclusion         | Validate branch and partner workflows, assisted-digital support, language coverage, accessibility, offline contingencies and staff readiness. | Operations; provincial offices; service centres     |
| 5\. Procurement and controlled pilot | Confirm procurement route, provider due diligence, cost model, service levels, pilot cohort, exit criteria and rollback plan.                 | SCM; finance; programme board; pilot owner          |

No pilot should connect to live identity, biometric or immigration records until the Department has approved the legal basis, technical controls, data agreements, security assessment and accountable operational owner. Begin with synthetic data and a bounded, independently reviewed prototype.

# APPENDIX D \| 60-IMAGE VISUAL ASSET REGISTER

The following 60 image files were supplied for this consolidated Home Affairs One briefing. Each image is embedded at readable size and indexed by its upload sequence (A01–A60). The file sequence is an asset catalogue, not a verified one-to-one mapping to the prompt IDs in Appendix E; the design team should assign final screen placements during creative review.

## Creative-use and governance note

- These photographs are illustrative AI-generated concept assets. They do not document actual DHA branches, employees, citizens, live cases, transactions or service outcomes.

- Use the images as clean photographic layers. Build approved app UI, labels, maps, official marks, government notices and factual service content separately in the product design system.

- Do not treat abstract or blurred screens as real UI, and do not publish invented DHA marks, official uniforms, real-looking identity documents, personal data, QR codes or barcodes. Replace or supplement concept visuals with approved photography and assets before public release.

## VISUAL SET 01 \| Citizen access, everyday life and inclusion

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A01 | Citizen using a smartphone at home, preparing for an ordinary day.</strong></p>
<p>Source file: IMG_7983.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A02 | Contemporary public-service centre with visitors and reception counters.</strong></p>
<p>Source file: IMG_7984.jpeg | 1344 × 752 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A03 | Wheelchair user receiving assistance at an accessible service counter.</strong></p>
<p>Source file: IMG_7985.jpeg | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A04 | Older adult using a smartphone in a relaxed community setting.</strong></p>
<p>Source file: IMG_7986.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A05 | Citizen speaking with a service adviser across a consultation desk.</strong></p>
<p>Source file: IMG_7987.png | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A06 | Young adult using a smartphone in a calm home or café setting.</strong></p>
<p>Source file: IMG_7988.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A07 | Urban pedestrians using mobile services in a modern city streetscape.</strong></p>
<p>Source file: IMG_7989.jpeg | 1344 × 752 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A08 | Resident using a smartphone in a rural community setting.</strong></p>
<p>Source file: IMG_7990.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A09 | Parent and child sharing a mobile service experience at home.</strong></p>
<p>Source file: IMG_7991.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A10 | Intergenerational family sharing a moment around a table.</strong></p>
<p>Source file: IMG_7992.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

## VISUAL SET 02 \| Onboarding, support and life events

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A11 | Close-up of a smartphone with neutral, abstract screen imagery.</strong></p>
<p>Source file: IMG_7993.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A12 | Citizen using a smartphone outside a contemporary service environment.</strong></p>
<p>Source file: IMG_7994.jpeg | 1344 × 752 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A13 | Private consultation between a citizen and a service representative.</strong></p>
<p>Source file: IMG_7995.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A14 | Service adviser helping a customer understand a digital journey on a phone.</strong></p>
<p>Source file: IMG_7996.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A15 | Traveller using a phone in an airport lounge with carry-on luggage.</strong></p>
<p>Source file: IMG_7997.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A16 | Visitor receiving assistance at a public-service counter.</strong></p>
<p>Source file: IMG_7998.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A17 | Service representative handing over a closed, unmarked document wallet.</strong></p>
<p>Source file: IMG_7999.png | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A18 | Professional managing a digital task on a laptop.</strong></p>
<p>Source file: IMG_8001.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A19 | Citizen checking a smartphone at a desk in a calm interior.</strong></p>
<p>Source file: IMG_8002.jpeg | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A20 | Adult couple portrait for a marriage or civil-union life-event story.</strong></p>
<p>Source file: IMG_8003.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

## VISUAL SET 03 \| Family, identity and service journeys

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A21 | Parent and school-age child sharing a phone and discussing a service.</strong></p>
<p>Source file: IMG_8004.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A22 | Parents with a newborn, representing the birth-registration life event.</strong></p>
<p>Source file: IMG_8005.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A23 | Young adult holding a smartphone outside a contemporary building.</strong></p>
<p>Source file: IMG_8006.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A24 | Visitor at an assisted identity-capture station while a staff member explains the process.</strong></p>
<p>Source file: IMG_8007.png | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A25 | Traveller using a phone in an airport lounge with luggage nearby.</strong></p>
<p>Source file: IMG_8008.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A26 | Visitor and staff member working through a digital service on a tablet.</strong></p>
<p>Source file: IMG_8009.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A27 | Citizen using a phone for a support conversation.</strong></p>
<p>Source file: IMG_8010.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A28 | Adult using a smartphone at home in a relaxed setting.</strong></p>
<p>Source file: IMG_8011.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A29 | Citizen using a phone and laptop in a home-office environment.</strong></p>
<p>Source file: IMG_8012.jpeg | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A30 | Man reviewing a smartphone at a desk with a notebook and tea.</strong></p>
<p>Source file: IMG_8013.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

## VISUAL SET 04 \| Travel, communication and service locations

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A31 | Traveller using a smartphone in an airport with luggage beside him.</strong></p>
<p>Source file: IMG_8014.png | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A32 | Man using a smartphone at a table in a contemporary interior.</strong></p>
<p>Source file: IMG_8015.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A33 | Close-up of a smartphone showing a deliberately defocused message screen.</strong></p>
<p>Source file: IMG_8016.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A34 | Contact-centre adviser wearing a headset at a workstation.</strong></p>
<p>Source file: IMG_8017.png | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A35 | Travellers moving through a busy airport service hall.</strong></p>
<p>Source file: IMG_8018.jpeg | 1344 × 752 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A36 | Traveller waiting in an airport lounge with documents and luggage kept unidentifiable.</strong></p>
<p>Source file: IMG_8019.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A37 | Assisted service counter with a wheelchair user and staff member.</strong></p>
<p>Source file: IMG_8020.jpeg | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A38 | Modern public-service building entrance with an accessible approach.</strong></p>
<p>Source file: IMG_8021.jpeg | 1344 × 752 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A39 | Mobile service outreach vehicle supporting a local community.</strong></p>
<p>Source file: IMG_8022.jpeg | 1344 × 752 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A40 | Younger person helping an older adult use a smartphone.</strong></p>
<p>Source file: IMG_8023.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

## VISUAL SET 05 \| Staff operations, assisted channels and trust

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A41 | Service representative explaining a tablet-based journey to a visitor.</strong></p>
<p>Source file: IMG_8024.png | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A42 | Inclusive public-service waiting area with visitors seated.</strong></p>
<p>Source file: IMG_8025.jpeg | 1344 × 752 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A43 | Close-up of a consent or permission action on a mobile device.</strong></p>
<p>Source file: IMG_8026.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A44 | Visitor using a self-service kiosk in a public-service centre.</strong></p>
<p>Source file: IMG_8027.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A45 | Operations team reviewing abstract performance dashboards.</strong></p>
<p>Source file: IMG_8028.jpeg | 1344 × 752 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A46 | Public-service counter conversation between a citizen and a staff member.</strong></p>
<p>Source file: IMG_8029.png | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A47 | Service professional working at a desktop computer.</strong></p>
<p>Source file: IMG_8030.jpeg | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A48 | Adviser supporting a visitor who is using a smartphone at a desk.</strong></p>
<p>Source file: IMG_8031.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A49 | Woman using a laptop and smartphone in a home-office setting.</strong></p>
<p>Source file: IMG_8032.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A50 | Man using a smartphone in a community or café setting.</strong></p>
<p>Source file: IMG_8033.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

## VISUAL SET 06 \| Privacy, future identity and national inclusion

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A51 | Still life with a smartphone, closed folder and hands, supporting a privacy theme.</strong></p>
<p>Source file: IMG_8034.jpeg | 1024 × 1024 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A52 | Professional using a laptop and phone in a contemporary apartment or office.</strong></p>
<p>Source file: IMG_8035.jpeg | 1344 × 752 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A53 | Citizen leaving a service environment with a phone and plain folder.</strong></p>
<p>Source file: IMG_8036.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A54 | Close-up of an unmarked document sleeve beside a smartphone.</strong></p>
<p>Source file: IMG_8037.jpeg | 1024 × 1024 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A55 | Diverse community group, including a wheelchair user, sharing a public space.</strong></p>
<p>Source file: IMG_8038.jpeg | 1344 × 752 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A56 | Vertical public-information campaign portrait of a woman holding a phone.</strong></p>
<p>Source file: IMG_8039.jpeg | 752 × 1344 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A57 | Woman using a smartphone at a desk in a contemporary environment.</strong></p>
<p>Source file: IMG_8040.png | 1024 × 688 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A58 | Woman using a smartphone and laptop at a table.</strong></p>
<p>Source file: IMG_8041.jpeg | 896 × 1120 px</p></td>
</tr>
</tbody>
</table>

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p></p>
<p><strong>A59 | Smartphone showing abstract credential tiles for a future digital-wallet concept.</strong></p>
<p>Source file: IMG_8042.jpeg | 896 × 1120 px</p></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><p></p>
<p><strong>A60 | Diverse professionals collaborating around a tablet in a meeting.</strong></p>
<p>Source file: IMG_8043.jpeg | 1024 × 688 px</p></td>
</tr>
</tbody>
</table>

# APPENDIX E \| FULL 60-PROMPT CINEMATIC PHOTOGRAPHY LIBRARY

This appendix carries forward the original 60 production-ready prompts from the LegacyLeverage Home Affairs One Cinematic Photography Prompt Library. Prompts are preserved as authored, with placement, output ratio and camera direction so creative and engineering teams can trace the intended use.

## Recommended photographic direction

- Premium public-service editorial photography using authentic South African people and places; dignity, accessibility, trust and human connection.

- Generate clean photography only. Build interface, typography, status labels, maps, buttons, government marks and document UI separately in Figma or the product design system.

- Screens and documents must remain blank, abstract or defocused. Never generate real-looking identity cards, passports, certificates, QR codes, barcodes, official seals, names, numbers or legal statuses.

- Do not invent DHA logos, coat of arms, staff uniforms, official vehicles, signage, branch names or government claims. Use approved assets only.

- Treat all AI photographs as illustrative concept assets, not evidence of actual branches, service events, employees, customers or transactions.

- Review anatomy, hands, faces, devices, cultural credibility, accessibility, privacy and accidental text at 100% zoom before approval.

## Original output guidance

| Use                 | Ratio | 2K working size | Typical placement                           |
|---------------------|-------|-----------------|---------------------------------------------|
| Hero / wide feature | 16:9  | 2048 × 1152 px  | Home hero, campaigns and service banners    |
| Editorial landscape | 3:2   | 1920 × 1280 px  | Service journeys, support and branch scenes |
| Portrait feature    | 4:5   | 1536 × 1920 px  | People, profile stories and service cards   |
| Vertical story      | 9:16  | 1152 × 2048 px  | Stories and vertical campaign placements    |
| Square tile         | 1:1   | 1792 × 1792 px  | Feature tiles, wallet and security details  |
| Editorial portrait  | 3:4   | 1344 × 1792 px  | Portrait-first cards and profile modules    |

## 01 \| One front door — national service hero

**PLACEMENT** Home dashboard hero; website landing page; launch campaign **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Sony A1 II • 24–70mm f/2.8 at 28mm • 1/500 sec • eye-level environmental wide

> Create a premium documentary photograph for a modern South African public-service digital platform. In a bright, contemporary civic environment, show a confident adult South African woman in her early thirties in the foreground using a smartphone naturally, with a softly layered background of other citizens of different ages entering a calm, welcoming public-service space. The composition communicates one connected front door to essential services, dignity, ease and trust. Leave the left third clean and slightly darker for a future headline and keep the phone screen angled away and completely unreadable. Use authentic contemporary South African faces, clothing and architecture without flags, government seals, logos, fabricated signage or identifiable records. Natural window light, subtle warm highlights, balanced neutral colour, editorial realism. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 02 \| Everyday identity — people behind the service

**PLACEMENT** Home feature tile; human-centred product story **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/500 sec • intimate waist-up portrait

> Photograph an authentic, unposed moment of an adult South African woman at home preparing for an ordinary day, checking a phone beside her keys and handbag. Her expression is calm and focused, not posed for an advertisement. A softly lived-in modern South African home gives context without showing wealth stereotypes or personal paperwork. Frame her slightly off-centre with gentle window light, realistic skin texture, natural hands and a softly blurred background. Phone screen must be blank or turned away. The image should convey that secure government services fit into real life. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 03 \| A connected country — urban service access

**PLACEMENT** Website feature banner; national reach story **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • NIKKOR Z 24–70mm f/2.8 at 35mm • 1/800 sec

> Create a cinematic editorial wide photograph of a contemporary South African city street in soft morning light. Show a natural mix of pedestrians moving through a clean public transport and commercial district, with one adult checking a smartphone while walking safely near the edge of the frame. Include subtle, believable South African urban character in architecture and street life, but no readable signs, brand marks or recognisable government buildings. Preserve broad negative space in the upper-left for interface copy. The visual idea is connected public service across a modern, diverse country, not a technology advertising cliché. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 04 \| Beyond the city — rural access and inclusion

**PLACEMENT** Low-bandwidth service story; inclusion landing card **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 35mm f/1.4 • 1/640 sec • environmental portrait

> Create a respectful documentary photograph of an adult resident in a rural South African community using a smartphone outside a modest community building. The setting should feel real and dignified: open landscape, practical clothing, natural light and a small number of people in the background. Avoid romanticising poverty, displaying visible personal data or implying that the person is unable to use technology. Show the phone from behind or with a blank screen. The frame should express that essential public services must work beyond major cities and under variable network conditions. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 05 \| A family across generations — shared civic life

**PLACEMENT** Home family services tile; campaign story **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Fujifilm GFX100 II • GF 80mm f/1.7 • 1/500 sec

> Capture a warm, documentary family portrait in a contemporary South African home: an older adult, a middle-aged parent and a young adult sharing a relaxed moment around a kitchen table. A smartphone and a closed, unmarked folder are present as subtle props, not the centre of the scene. Their expressions should feel natural and intergenerational, with skin tones and facial features represented authentically. Soft directional window light and nuanced warm-neutral colour. No visible documents, readable text, official logos or posed stock-photo smiles. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 06 \| A calm service centre at first light

**PLACEMENT** Service discovery hero; branch locator feature **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • 14–30mm f/4 at 20mm • tripod • 1/10 sec

> Create a premium architectural photograph of a modern, welcoming public-service reception area in South Africa just after opening. Show clear circulation, comfortable seating, natural daylight, accessible pathways and discreet service counters. The facility should look plausible and human-scaled, not futuristic or luxurious. Do not show government logos, seals, department names, readable signage, invented queue numbers or identifiable staff badges. Keep the central space uncluttered and reserve a clean area for an app headline. Architectural lines must be straight and believable. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 07 \| A confident first sign-in

**PLACEMENT** Welcome/onboarding screen; account creation story **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 85mm f/1.4 • 1/640 sec • close environmental portrait

> Create a professional editorial portrait of an adult South African man in his late twenties completing a simple sign-in on his smartphone at a bright home desk. He looks attentive and reassured. Keep the handset visible in a natural grip but make its display softly out of focus with no readable content, no logos and no personal information. A warm, uncluttered environment and gentle side light convey a straightforward, trustworthy first step. Authentic skin detail, realistic hands and restrained colour grading. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 08 \| A parent setting up family access

**PLACEMENT** Family profile onboarding; guardian and dependent journey **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/500 sec

> Photograph an adult South African parent seated beside a school-age child at a dining table, calmly reviewing a smartphone together. The adult is clearly the person controlling the device; the child is included naturally and respectfully. No child names, school logos, personal papers or readable phone screen. Use soft daylight, credible family interaction, realistic clothing and understated domestic detail. The photograph should suggest safe, permission-based family and guardian access, not surveillance or biometric capture. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 09 \| Older adult using digital services independently

**PLACEMENT** Accessible onboarding; senior support content **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Nikon Z8 • 85mm f/1.8 • 1/500 sec

> Create an empathetic but confident portrait of an older South African woman independently using a smartphone in a bright community setting. Her expression is engaged and self-assured. Show a comfortable grip and a screen turned away or softly unreadable. Avoid stereotypes of helplessness or confusion. Include a subtle blurred background with another person available for help, without making assistance the focus. Natural skin texture, gentle daylight and realistic documentary styling. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 10 \| Inclusive digital access — mobility and choice

**PLACEMENT** Accessibility feature page; inclusive service campaign **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 35mm f/1.4 • 1/400 sec

> Capture a candid, respectful photograph of a wheelchair user in a modern public-service environment using a smartphone at a comfortable height. A staff member is nearby but not taking over. Ensure the space has believable turning room, level access and accessible counter design. The subject is active and in control. Avoid medicalised framing, staged pity or visible personal data. Keep the screen unreadable. Bright, natural light and accurate wheelchair construction are essential. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 11 \| Secure device sign-in — passkey moment

**PLACEMENT** Passkey and device biometric explainer; security feature tile **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 90mm f/2.8 Macro G OSS • 1/250 sec

> Create a highly realistic close-up photograph of an adult hand holding a modern smartphone while the thumb rests naturally near the device authentication area. The screen shows only abstract, soft light shapes with no interface text, no biometric graphic, no face scan, no QR code and no readable personal information. Use a premium macro perspective, precise reflections, natural skin detail and a softly blurred home background. Communicate secure, convenient device-level sign-in without implying that the app itself stores raw biometric data. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 12 \| Identity verification with human support

**PLACEMENT** Identity proofing; assisted verification explainer **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • 70–200mm f/2.8 at 105mm • 1/320 sec

> Photograph a professional service interaction between an adult citizen and a trained service representative at a clean public-service counter. The representative explains a process while the citizen listens and holds a phone. The workstation is present but all screens, forms, badges and documents are unreadable or turned away. The exchange must feel respectful, transparent and calm. Do not depict fingerprint capture or facial recognition as casual actions. Soft directional light, real skin texture and a candid long-lens perspective. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 13 \| Safe account recovery — help without panic

**PLACEMENT** Account recovery; lost-device support content **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 85mm f/1.2 • 1/500 sec

> Create an editorial portrait of an adult South African professional seated at a desk, using a second trusted device while a switched-off smartphone rests beside it. The person looks focused and reassured, not distressed. Suggest recovery and account protection through the quiet setting and careful posture rather than literal padlock graphics. No visible passwords, OTPs, recovery codes, emails or readable screen content. Premium natural window light and understated photographic realism. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 14 \| Smart ID replacement — assisted service journey

**PLACEMENT** Smart ID replacement service tile; application guidance **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/500 sec

> Show an adult South African woman at a modern service desk discussing a replacement identity document application with a trained representative. She holds a phone and a plain, unmarked document sleeve; no actual identity card is shown. The staff member points to a neutral screen that is defocused. Their expressions are attentive and composed. The scene must communicate a guided process and clear next steps, not a confirmed government transaction. No logos, ID numbers, official seals, badges or readable text. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 15 \| Biometric capture — professional controlled setting

**PLACEMENT** Biometric appointment information; branch preparation **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 70–200mm f/2.8 at 85mm • 1/320 sec

> Create a realistic documentary photograph of a citizen seated at an authorised service workstation while a trained operator prepares a dedicated biometric capture device. Show professional boundaries, clean equipment and a clear explanation before capture. Do not show a fingerprint image, face template, iris detail, real biometric data or any screen containing personal information. The citizen remains in control and the operator behaves professionally. Neutral, clinical-but-welcoming lighting and precise equipment detail. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 16 \| First identity milestone — young adult

**PLACEMENT** First-time ID guidance; youth service campaign **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Fujifilm GFX100 II • GF 110mm f/2 • 1/500 sec

> Capture a natural portrait of a South African young adult, around 18, outside a university or further-education campus, holding a smartphone and smiling with quiet pride. Make the individual clearly an adult. The background is softly blurred and recognisably local without readable campus logos or signs. No ID card, application form or personal details should be visible. The photograph should convey independence and a positive first adult civic milestone. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 17 \| Preparing for a passport application

**PLACEMENT** Passport service discovery; travel document application **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • NIKKOR Z 50mm f/1.2 • 1/400 sec

> Photograph an adult South African traveller at a home desk preparing for a passport application. A closed, plain travel wallet, smartphone and luggage tag with no readable information are arranged naturally on the desk. The person checks a blank or fully defocused phone screen. Use believable daylight, honest skin and material textures, and an uncluttered composition. Do not depict a real or simulated passport, coat of arms, passport number, visa label or official document. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 18 \| Passport collection — secure handover

**PLACEMENT** Passport collection/delivery; application completion story **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 70–200mm f/2.8 at 100mm • 1/500 sec

> Create a candid, documentary photograph of a service representative handing a closed, unbranded protective document sleeve to an adult citizen across a counter. The sleeve must be plain with no passport cover, national emblem, document title or visible contents. Both people appear attentive and professional. The background is a clean public-service interior with no readable signage. Convey completion, reassurance and secure handover without implying that the pictured scene is a real DHA transaction. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 19 \| Travel-ready moment — documents secured

**PLACEMENT** Passport wallet; travel preparation feature **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 35mm f/1.4 • 1/500 sec

> Create a premium travel editorial photograph of an adult South African traveller in an airport lounge placing a closed plain document wallet beside a smartphone and carry-on bag. The traveller looks toward the departure area. Any phone screen, boarding pass, passport or travel document must be blank, obscured or out of focus, with no legible codes, names, numbers or insignia. Use natural airport daylight, controlled reflections and realistic materials. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 20 \| Birth registration — the first family milestone

**PLACEMENT** Birth registration guidance; newborn/family services **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 85mm f/1.4 • 1/320 sec

> Photograph a tender, authentic moment of two South African parents with their newborn in a calm maternity-room or home setting. The baby is safely held and comfortably clothed. The parents share a quiet look of joy and focus. No hospital branding, patient labels, wristbands, medical records or visible identifying details. Use gentle window light and a close, intimate composition. The image is about the importance of registering a birth and welcoming a child, not a medical claim or a specific real family. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 21 \| Family profile — guardian and child connection

**PLACEMENT** Family accounts; guardian-authorised journeys **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Nikon Z8 • 50mm f/1.8 • 1/500 sec

> Create a natural photograph of a South African parent and school-age child sitting together on a sofa while the parent manages a smartphone. The child is engaged in conversation, not asked to operate the device. Frame both faces with warm but restrained daylight and realistic textures. The screen must be turned away or unreadable. Do not show school identifiers, names, forms or sensitive family data. Convey trusted guardianship and carefully scoped family access. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 22 \| Marriage and civil union — a life event

**PLACEMENT** Marriage/civil union service guidance; life-event feature **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Fujifilm GFX100 II • GF 80mm f/1.7 • 1/500 sec

> Capture an intimate, documentary portrait of a South African couple of adult age after a simple civil ceremony, standing together in a bright civic or neutral architectural setting. Their clothing is elegant but not extravagant. A small bouquet may be present. Avoid staged wedding clichés, official seals, certificates, readable paperwork or recognisable government signage. Their expressions should feel genuine and personal. Soft, natural light, rich skin detail and a refined editorial finish. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 23 \| Death registration — compassionate guidance

**PLACEMENT** Death registration information; bereavement support content **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 85mm f/1.4 • 1/320 sec

> Create a compassionate, restrained documentary photograph of an adult South African person receiving quiet support from a trained service representative in a private consultation room. The citizen is composed but reflective; the staff member listens attentively. No visible death certificate, medical file, cause-of-death information, names or official insignia. Avoid dramatic grief or intrusive emotion. Soft natural light, respectful distance and human dignity are essential. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 24 \| Citizenship guidance — considered conversation

**PLACEMENT** Citizenship information; application initiation support **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • 85mm f/1.8 • 1/400 sec

> Photograph an adult South African resident in a professional, calm consultation with a public-service adviser at a desk. They review a closed, plain folder and a phone with an unreadable screen. The atmosphere should suggest a complex application being explained clearly, not a legal decision being made. No national symbols, official forms, readable labels, visible personal records or government logos. Natural skin texture and a composed editorial style. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 25 \| Visa information — international applicant

**PLACEMENT** Visa and immigration service discovery; international portal **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 50mm f/1.2 • 1/500 sec

> Create a realistic editorial photograph of an adult international applicant seated at a desk in a neutral, contemporary setting, reviewing travel plans on a laptop and smartphone. Their passport, if present, must be closed, plain and unmarked with no national emblem or readable contents. The screens are defocused. The person appears thoughtful and prepared. Avoid implying a visa approval or immigration decision. Premium natural light and believable travel details. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 26 \| ETA application — traveller before departure

**PLACEMENT** Electronic Travel Authorisation guidance; traveller journey **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 24–70mm f/2.8 at 35mm • 1/500 sec

> Photograph an adult international traveller seated in a modern airport departure area, calmly completing a travel-related task on a smartphone. A carry-on bag and softly blurred flight information screens provide context, but all screen content must be unreadable. Do not show a passport page, visa, entry stamp, boarding pass details or a confirmation screen. The image should suggest preparation and digital convenience, never imply that an application receipt grants permission to travel. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 27 \| Arrival control — people and process

**PLACEMENT** Border/arrival guidance; traveller information page **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • NIKKOR Z 24–70mm f/2.8 at 35mm • 1/250 sec

> Create a credible documentary wide photograph of an international airport arrival hall in South Africa. Show arriving travellers moving through an orderly, well-designed space with a uniformed border official visible at a respectful distance. Do not reproduce actual official uniforms, badges, border signage, passport-control screens or any real government insignia. The environment should be plausible rather than a replica of a specific port. Natural airport light and clear depth; no readable personal data. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 28 \| Resident services — work and study life

**PLACEMENT** Residence/permit guidance; international residents **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Fujifilm GFX100 II • GF 80mm f/1.7 • 1/500 sec

> Capture a confident portrait of an adult international resident in South Africa, a professional or postgraduate student, seated in a bright home or campus common area with a laptop and smartphone. Their expression is relaxed and focused. No readable documents, visa stickers, passport pages, institution logos or employer marks. The image should represent lawful residents as part of everyday South African life and communicate clarity around residence-related services. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 29 \| South African citizen abroad — consular connection

**PLACEMENT** Overseas mission directory; citizen-abroad services **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 35mm f/1.4 • 1/400 sec

> Create a premium documentary photograph of an adult South African living overseas at a clean, contemporary consular reception or neutral diplomatic service environment. A staff member is assisting with a booking on a tablet. Avoid country flags, consular seals, embassy signage, real office layouts or readable documents. Include subtle cues of international context through architecture and daylight rather than obvious travel clichés. Communicate continuity of service across borders. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 30 \| Consular help — calm assistance at a distance

**PLACEMENT** Overseas assistance; emergency help and contact-centre journey **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 85mm f/1.4 • 1/320 sec

> Photograph an adult South African traveller in a quiet airport or hotel lobby speaking with a support adviser through a smartphone call. The traveller appears reassured and attentive, with a suitcase nearby. Do not show distress, medical emergencies, passport details, booking records or readable screen content. Use gentle available light and a close but respectful portrait. The emotional message is that support remains reachable when a person is far from home. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 31 \| Application progress — clear next step

**PLACEMENT** My Applications dashboard; progress tracker feature **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Nikon Z8 • 50mm f/1.8 • 1/500 sec

> Create a close environmental photograph of an adult citizen seated at a tidy desk checking a smartphone application status. The person looks attentive and reassured. The phone display must be blank, softly blurred or turned away; do not generate interface text, dates, case numbers, status labels or official logos. Include a notebook with no writing and a cup of tea. The visual should support transparency and control while leaving the actual application timeline to be rendered in the product UI. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 32 \| Secure inbox — official message moment

**PLACEMENT** In-app secure messages; notices and receipts **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 90mm f/2.8 Macro • 1/250 sec

> Photograph a hand holding a smartphone as a new secure message is opened, with the screen deliberately out of focus and no words, sender names, case references or notification previews readable. In the softly blurred background, an adult South African user sits in a bright home setting. Focus on natural hand anatomy, precise glass reflections and realistic device detail. This is a photo asset, not a UI mock-up; the real secure inbox interface will be composited separately. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 33 \| WhatsApp-style guided assistance — official channel

**PLACEMENT** WhatsApp opt-in assistance; channel choice explainer **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/400 sec

> Create a realistic photograph of an adult citizen using a smartphone to ask a simple public-service question while seated in a calm everyday environment. The phone screen is angled away or blank; do not depict the WhatsApp logo, a fake verified badge, chat text, QR codes or any personal information. Include a second person in soft background focus to suggest human support remains available. The image should represent convenient, consent-based guidance with secure hand-off for private details. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 34 \| Email and notification continuity

**PLACEMENT** Email/SMS/push communication settings; preference centre **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • 50mm f/1.8 • 1/320 sec

> Create an editorial desk photograph of an adult using a smartphone beside a laptop while reviewing a message notification. Both displays are blank or defocused with absolutely no readable text, email addresses, OTPs, codes or personal records. Keep the person and devices naturally arranged, with soft daylight and a modern South African home-office context. The photograph should evoke one consistent service conversation across devices without visually favouring a specific commercial messaging brand. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 35 \| Contact-centre adviser — human escalation

**PLACEMENT** Call-back and contact-centre service; support page **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 35mm f/1.4 • 1/320 sec

> Photograph a professional South African contact-centre adviser wearing a discreet headset, speaking warmly while reviewing a case on two monitors. Screens must be blurred with no readable information; no logos, customer names, phone numbers or case data. Show a modern, calm, well-lit support environment with other advisers softly out of focus. The adviser should look attentive and empathetic, not posed. This image represents a human support route integrated with digital channels. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 36 \| Multilingual voice guidance — accessibility by voice

**PLACEMENT** AI service guide; voice and language support **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 85mm f/1.4 • 1/500 sec

> Capture an intimate portrait of an adult South African user speaking naturally to a smartphone using voice assistance at home. The phone is held comfortably; the screen is blank or unseen. The user’s expression is engaged, with no exaggerated surprise. A softly blurred family member or quiet home context may appear in the background. Communicate language choice, low-literacy support and convenient voice interaction without implying that an AI system makes legal decisions. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 37 \| Public-service building — clear and welcoming arrival

**PLACEMENT** Branch finder; service-point detail and opening information **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • 14–30mm f/4 at 18mm • tripod • 1/60 sec

> Create a high-end architectural photograph of a plausible modern civic service building in South Africa, viewed from the public approach. Include step-free access, clear circulation and a welcoming entrance. Do not depict or invent a real Department of Home Affairs building, logo, coat of arms, official sign, exact street address or branch identity. The façade should be generic and realistic, with a few people entering naturally. Balanced daylight, vertical lines corrected, clean sky area for a future location label. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 38 \| Service counter — respectful human interaction

**PLACEMENT** Branch visit guidance; service desk appointment **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 35mm f/1.4 • 1/320 sec

> Photograph a realistic public-service counter interaction in a clean South African civic environment. An adult citizen is speaking with a professional staff member across an accessible counter. Both are at eye level and engaged in the conversation. Show queue organisation and privacy screens subtly in the background. No official uniforms, branded lanyards, government logos, visible personal documents or readable monitors. Natural skin texture, restrained neutral palette and authentic documentary composition. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 39 \| Bank partner service point — convenient access

**PLACEMENT** Partner-bank locator; ID/passport services at authorised partners **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 50mm f/1.4 • 1/400 sec

> Create a realistic editorial photograph of an adult customer being assisted at a modern financial-service counter that could plausibly host a public-service partner service. The setting must remain unbranded and must not resemble a specific bank branch. A staff member guides the customer through a phone-based booking; all screens are unreadable. Avoid bank logos, bank cards, identity documents, official department marks or claims that a specific location offers a service. Communicate convenience and coordinated service access. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 40 \| Mobile service outreach — reaching remote communities

**PLACEMENT** Mobile service point; rural and community outreach feature **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • 24–70mm f/2.8 at 35mm • 1/500 sec

> Capture a documentary wide photograph of a generic mobile public-service vehicle parked at a community facility in a rural South African setting. Adults approach a temporary service point in an orderly way while a staff member offers guidance. The vehicle must be plain, with no government logo, department name, number plate details or invented official branding. Show practical accessibility, daylight and authentic local context. Do not portray the service as a specific existing DHA deployment. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 41 \| Accessible service counter — communication choice

**PLACEMENT** Accessibility services; sign-language and assistance options **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 70–200mm f/2.8 at 85mm • 1/400 sec

> Photograph a respectful interaction at a public-service reception where a deaf adult citizen communicates with a staff member using sign language, with an interpreter or trained colleague present if appropriate. The citizen is centred and in control of the exchange. The environment is quiet, accessible and well lit. No official logos, readable documents, badges or screens. Avoid staged gestures; use accurate, natural hands and authentic facial expression. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 42 \| Assisted digital — a helpful guide beside the user

**PLACEMENT** Digital inclusion; branch and assisted-digital support **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Nikon Z8 • 85mm f/1.8 • 1/500 sec

> Create a candid portrait of a trained community digital-support worker sitting beside an older adult, explaining how to use a smartphone. The older adult holds the phone and performs the action; the helper points gently without taking control. Both appear confident and respected. Screen is blank or turned away. The setting is a clean community support area. No logos, readable paperwork or personal details. The image must express empowerment rather than dependency. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 43 \| Self-service kiosk — simple guided interaction

**PLACEMENT** Kiosk/tablet assisted mode; service-point locator **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 24–70mm f/2.8 at 35mm • 1/320 sec

> Photograph an adult citizen using a modern self-service touchscreen kiosk in a generic public-service centre. The kiosk design should be plausible, minimal and accessible, with large touch targets implied but no readable text, logos or official marks on the screen. A staff guide is available in the background. Include realistic reflections, correct hand contact and suitable privacy spacing. Do not make the device look like airport check-in or retail checkout hardware. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 44 \| Orderly waiting — clarity before the appointment

**PLACEMENT** Appointment booking; queue information; service-day guidance **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Nikon Z8 • 24–70mm f/2.8 at 35mm • 1/250 sec

> Create a wide documentary photograph of a calm, orderly waiting area inside a generic civic service centre. Show a modest number of adults seated with clear circulation, accessible seating and a visible but unreadable queue display. No distress, crowding or humiliating depictions of citizens. No department branding, readable numbers, forms or screens. The atmosphere is respectful and well organised, illustrating how appointments and accurate service information can make in-person visits easier. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 45 \| Caseworker reviewing an application — human oversight

**PLACEMENT** Staff workbench; case review and exception handling **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/320 sec

> Photograph a professional public-service caseworker in a contemporary office carefully reviewing an application on a desktop monitor. The screen must be defocused with no readable personal records, biometric data or legal decision. The caseworker is attentive and thoughtful, with a notebook closed on the desk. Use realistic office light and a natural side profile. Communicate accountable human review and careful processing, not automated approval. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 46 \| Service operations room — connected national picture

**PLACEMENT** Internal operations dashboard; service reliability and analytics **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Sony A1 II • FE 24–70mm f/2.8 at 28mm • 1/80 sec

> Create a cinematic, realistic wide photograph of a small public-service digital operations team in a modern operations room, collaborating around a large wall display showing abstract, non-readable data visualisations. No actual dashboards, maps with precise locations, names, case volumes, government seals or security-sensitive information should be visible. Staff should appear focused and collaborative. Balanced screen glow and ambient light; credible technology, not a science-fiction control room. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 47 \| Institutional verification — trusted partner request

**PLACEMENT** Accredited verifier portal; bank or agency integration **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • 50mm f/1.8 • 1/320 sec

> Capture a professional at an accredited institution using a secure tablet or desktop to verify a document with a customer present. Screens must be abstract and unreadable; no QR code, ID number, face image, bank logo or government mark. The customer is aware of the process and the professional explains the purpose. Use a modern, neutral office with credible lighting and natural expressions. Communicate purpose-limited verification and consent, not unrestricted access to citizen records. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 48 \| Consent-led sharing — the person remains in control

**PLACEMENT** Consent receipt; verified sharing and data access controls **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 100mm f/2.8 Macro • 1/250 sec

> Create a precise close-up photograph of an adult hand confirming a simple share action on a smartphone while another person waits respectfully in soft background focus. The screen is blank or abstract and contains no text, identity details, permissions list, names, QR code or logos. The body language should convey deliberate consent and user control. Premium macro detail, natural hand anatomy, realistic glass reflections and quiet daylight. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 49 \| Digital credential wallet — future-ready concept

**PLACEMENT** Future digital wallet explainer; credential presentation concept **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 90mm f/2.8 Macro • 1/250 sec

> Create a premium product-style photograph of a smartphone displaying a purely abstract set of neutral credential tiles with simple geometric shapes and no words, numbers, portrait, QR code, barcode, flag, coat of arms or document design. An adult hand holds the phone in a clean contemporary environment. This image is a conceptual visual metaphor only and must not resemble a valid South African ID, passport, licence or legally recognised credential. Crisp reflections, controlled light and realistic device materials. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 50 \| Privacy protection — safeguarding personal information

**PLACEMENT** Privacy/security page; POPIA and trust narrative **OUTPUT** 1:1 • 1792 × 1792 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 100mm f/2.8 Macro • 1/200 sec

> Create a high-end macro still life of a modern smartphone lying beside a closed, plain document folder on a clean desk. A narrow line of reflected light across the phone glass suggests careful protection and trust. No padlock icon, fake security badge, readable personal information, document edge text, QR code, logo or screen content. Deep navy and neutral surface tones with one restrained blue highlight. Realistic materials and fine controlled reflections. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 51 \| Secure document verification — provenance, not a scan

**PLACEMENT** Credential verification feature; institutional trust content **OUTPUT** 1:1 • 1792 × 1792 px  
**CAMERA / LENS** Nikon Z8 • 105mm macro lens • 1/250 sec

> Create an editorial macro photograph of a professional holding a generic, unmarked document sleeve near a modern smartphone used for verification. The screen is blank and the sleeve has no national emblem, text, serial number, portrait, barcode or QR code. Emphasise tactile material, careful handling and optical detail. The composition should communicate that trust comes from authoritative verification, not from a photograph of a document. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 52 \| Digital consent receipt — transparent data sharing

**PLACEMENT** Consent history and privacy controls; account settings feature **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Sony A1 II • FE 50mm f/1.4 • 1/320 sec

> Photograph an adult South African professional reviewing privacy settings on a smartphone at a desk. A laptop sits nearby, both screens blank or defocused. The person looks calm and in control. Use clean, natural light and realistic hand placement. Do not generate readable settings, data-sharing recipients, dates, identity attributes or interface labels. The image should support a clear visual story about seeing what has been shared and managing permissions. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 53 \| One service across time zones — South Africans abroad

**PLACEMENT** Diaspora services; overseas missions and international support **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Fujifilm GFX100 II • GF 32–64mm f/4 at 45mm • 1/250 sec

> Create a cinematic, authentic wide editorial photograph of an adult South African professional living overseas, seated beside a window in a contemporary apartment and speaking to a family member by video call on a laptop. The view outside suggests a foreign city without naming a landmark. The device screens are blurred and show no faces or text. A small, plain travel wallet rests on the desk. The image should express continuity with home and access to public services from abroad. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 54 \| Cross-border service coordination

**PLACEMENT** International/consular interoperability; institutional collaboration **OUTPUT** 3:2 • 1920 × 1280 px  
**CAMERA / LENS** Nikon Z8 • 35mm f/1.8 • 1/320 sec

> Photograph a small, diverse group of professionals from different regions collaborating around a table in a contemporary international service setting. They review a tablet and printed blank sheets while discussing a shared process. Avoid flags, government logos, maps showing sensitive borders, readable documents or identifiable real officials. Their posture should be collaborative and practical, not ceremonial. Natural window light, realistic materials and a premium editorial documentary finish. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 55 \| Know the official channel — anti-scam awareness

**PLACEMENT** Fraud prevention campaign; official contact and safety education **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 85mm f/1.4 • 1/500 sec

> Create a realistic portrait of an adult South African woman pausing before responding to a smartphone message, then turning to a trusted official-looking information page on a laptop. All screens are blank or unreadable; no fake warning symbols, scam text, phone numbers, URLs or agency logos. Her expression is thoughtful and cautious rather than frightened. The image should support public education about checking official channels and never sharing passwords or one-time codes. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 56 \| Language choice — a service that speaks clearly

**PLACEMENT** Multilingual service selection; plain-language and voice campaign **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 85mm f/1.4 • 1/500 sec

> Capture an adult South African man in a relaxed community setting using a smartphone while listening through one earbud. His expression shows understanding and confidence. Include subtle everyday cultural context without stereotyped props. Phone screen is turned away or blank; no text, flags, official marks or personal information. Soft natural light and a close environmental portrait convey the importance of language choice and clear guidance. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 57 \| Public service that includes every generation

**PLACEMENT** National inclusion campaign; social and editorial feature **OUTPUT** 16:9 • 2048 × 1152 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 35mm f/1.4 • 1/500 sec

> Create a wide, cinematic documentary photograph showing a naturally diverse group of South African adults across generations in a public community space, engaged in conversation and everyday activity. Include older adults, working-age adults and young adults, with different abilities represented naturally. Avoid uniform posing or an artificial stock-photo lineup. Use genuine interactions, believable local environment, nuanced daylight and enough negative space for campaign copy. No logos, text, flags or visible records. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 58 \| Mobile-first public information campaign portrait

**PLACEMENT** Vertical social campaign; app-store/editorial promotional creative **OUTPUT** 9:16 • 1152 × 2048 px  
**CAMERA / LENS** Nikon Z8 • 50mm f/1.8 • 1/500 sec

> Create a vertical cinematic editorial portrait of an adult South African citizen standing in a bright, contemporary public setting, holding a smartphone at chest height and looking slightly toward the camera with calm confidence. Place the person in the middle-lower portion of the frame and preserve clean negative space in the upper third for campaign typography to be added later. The phone display must be invisible or blank. No government logos, slogans, readable text, flags or fake app interface. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 59 \| Appointment day — prepared and informed

**PLACEMENT** Appointment reminders; what to bring and where to go **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Canon EOS R5 Mark II • RF 50mm f/1.2 • 1/400 sec

> Photograph an adult South African citizen at home checking a smartphone beside a plain folder and keys before leaving for an appointment. The person appears prepared and relaxed. The folder must be empty or closed, with no forms, ID documents, labels or personal records visible. Screen blank or turned away. Use realistic morning light, natural domestic details and an authentic, unposed expression. The image should suggest clear preparation and fewer surprises. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

## 60 \| Service completed — confidence and continuity

**PLACEMENT** Success state story; post-application reassurance **OUTPUT** 4:5 • 1536 × 1920 px  
**CAMERA / LENS** Sony A1 II • FE 85mm f/1.4 • 1/640 sec

> Create a warm, restrained portrait of an adult South African citizen leaving a modern public-service environment after completing an appointment. They hold a phone and a plain unmarked sleeve, with a subtle expression of relief and confidence. Do not show an actual ID, passport, certificate, receipt, official sign or document contents. Use natural late-afternoon light, shallow depth of field and documentary realism. Avoid exaggerated celebration or implying a particular application outcome. Photorealistic high-end editorial photography; natural skin texture and believable anatomy; realistic hands, devices, fabrics and materials; physically plausible light; balanced dynamic range; restrained colour grading; crisp natural detail. No CGI, illustration, plastic skin, duplicated people, malformed hands, extra limbs, fake logos, official insignia or uniforms, watermarks, readable text, personal data, real document details, QR/barcodes, OTPs, passwords or legible screens.
>
> **POST-PRODUCTION** *Add approved interface, official marks and factual service content separately in design software.*

# APPENDIX F \| CLAUDE CODE VISUAL-ASSET INTEGRATION HANDOFF

The original Appendix A contains the full Claude Code master build prompt. This supplementary handoff makes the 60 supplied images and design rules explicit for the implementation team.

## 1. Prepare the repository and asset library

1\. Place the product brief in docs/product/home-affairs-one-brief.md and keep this consolidated Word file as the approved reference artifact.

2\. Copy the 60 original image files into public/assets/home-affairs-one/ without changing their content. Preserve the upload filenames and add stable asset aliases A01–A60 in a manifest.

3\. Create docs/design/asset-manifest.md with each asset ID, source filename, pixel dimensions, subject description, recommended UI placement and review status.

4\. Create docs/security/, docs/privacy/, docs/architecture/ and docs/runbooks/ before integrating live services. Keep all service integrations mocked until written DHA approval and sandbox access are supplied.

## 2. Copy-and-paste first-session prompt for Claude Code

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>You are the senior product design and engineering team building a non-production prototype of Home Affairs One, a proposed South African national digital identity and citizen-services experience. Read the complete product brief, the 60-prompt photography library and the supplied visual asset manifest before making changes.<br />
<br />
IMPORTANT: This is a concept prototype, not an official Department of Home Affairs system, endorsement, policy or legal service. Do not invent law, fees, service requirements, eligibility, application status, processing times, official names or government claims. Use clearly labelled synthetic data and mock API adapters only. Do not connect to production DHA systems or process real identity records, passports, biometrics or personal case files.<br />
<br />
Use the 60 supplied photographs as visual assets in the interface, matching each asset to the most appropriate screen and journey. Do not fabricate or render official logos, seals, uniforms, certificates, identity cards, passport details, QR codes, barcodes or readable personal data. Screens within photographs are illustrative only; build real UI in code. Include image alt text and responsive crops.<br />
<br />
Build a calm, premium, accessible, mobile-first experience for mobile and responsive web/PWA, with a separate protected staff surface. Use the architecture and stack recommendations in the brief as design inputs, subject to architecture review. Implement the MVP modules: account shell with mock authentication, service catalogue, guided application draft/save/resume, simulated payment, application tracker, service-point finder using synthetic locations and capabilities, secure inbox, notification preferences, WhatsApp mock adapter, and human-help handoff.<br />
<br />
Keep Digital Wallet, biometric verification, AI assistance and partner integrations behind feature flags and mark future capabilities as subject to legal, security and operational approval. AI may only explain approved, versioned guidance and support navigation; it must not make legal, identity, immigration, citizenship, asylum or refugee decisions.<br />
<br />
Use TypeScript strict mode, reusable components, design tokens, keyboard and screen-reader support, WCAG 2.2 AA as a target, and explicit loading, empty, offline, error, retry, pending, action-required, success and unavailable states. Keep secrets out of source control and logs. Place every external integration behind a typed adapter with timeouts, idempotency, safe errors and audit events.<br />
<br />
Before coding, inspect the repository and report: (1) architecture proposal, (2) user flows and screen map, (3) asset-to-screen mapping, (4) data classification and mock API boundaries, (5) privacy/security risks, (6) milestone plan, and (7) open questions requiring DHA decisions. Do not modify files until a human approves that plan. After each approved implementation phase, run lint, typecheck and tests, and report changed files, test results, known gaps and rollback steps.</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 3. Recommended visual components and usage

- Home / welcome: choose high-level human-centred portraits and welcoming environment imagery; leave negative space for genuine interface copy.

- Service catalogue: use life-event photography for identity, birth, family, marriage, death, citizenship and travel journeys.

- Application tracking and secure inbox: use close-up device photography only as decorative context; all actual status and message content must be rendered by the app.

- Service-point discovery: use generic building, counter, kiosk, waiting-area and mobile-outreach visuals. Never label a generic generated building as a real DHA branch.

- Accessibility and assisted digital: use images that show the person retaining control of the device, with respectful assistance and genuine access needs.

- Trust and privacy: use abstract device/sleeve visuals; show consent purpose and sharing recipients in actual UI components, not generated text in photos.

## 4. Implementation acceptance checklist

- All 60 asset files are present, named, optimised into derivatives and referenced through a manifest; original masters remain unchanged.

- Every use of an image has meaningful alt text, responsive sizing and a safe crop for small screens.

- All real service requirements, fees, statuses and locations remain placeholders until verified by DHA owners.

- No sensitive personal data, real identity documents, biometric samples or production secrets are present in code, fixtures, screenshots or logs.

- Accessibility, privacy, security, integration contracts and operational exception paths are tested before any pilot.

- The prototype is clearly labelled as a concept and has no false claim of DHA approval, legal validity or live service integration.
