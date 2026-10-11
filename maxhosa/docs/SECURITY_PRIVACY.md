# Security and privacy

What this build does today, and what production requires before launch.
Nothing here is legal advice; POPIA, GDPR and consumer-law reviews are owed.

## In this build

- **No secrets.** `.env.example` holds placeholders only; only `EXPO_PUBLIC_*`
  values reach the bundle, and none is secret. Private commerce, courier and
  booking credentials belong to the integration service.
- **No personal data collected or sent.** Appointment details stay in memory
  and are never transmitted; notification switches send nothing; no analytics.
- **Device storage holds preferences only** (AsyncStorage): bag line
  references, saved product IDs, market, appearance, notification choices,
  optional sizes. No tokens, names, emails or addresses.
- **No payment surface.** No card fields exist; checkout is a simulated
  handoff, labelled “Demo — no real order or payment”.
- **Untrusted input is validated.** Carrier events are parsed with zod; codes
  not on the reviewed list become `unknown`.
- **Idempotent writes.** Checkout and booking reuse one key per attempt.
- **The offline demo** carries a Content-Security-Policy that forbids every
  network request, and holds only synthetic data.
- **The asset gate** fails the build on any image outside the 24-file
  allowlist or any excluded source.

## Required before production

| Area | Requirement |
|---|---|
| Accounts | OAuth 2.0 / OIDC with PKCE through the platform's customer-account API, system browser; tokens in Keychain/Keystore (`expo-secure-store`), never AsyncStorage or logs |
| Transport | HTTPS to known production domains only |
| Payments | Platform checkout only; no PAN/CVV anywhere; server-side order confirmation is the only success signal |
| Delivery data | Courier positions and proof of delivery shown only to the authenticated order owner, only during the delivery window; masked courier contact; no full address or phone in URLs, analytics or push previews; minimal location retention |
| Webhooks | Signature verification, replay protection, idempotency, reconciliation, audit log of failures |
| Notifications | Transactional and marketing consent recorded separately, server-side; previews carry no personal or order detail; frequency caps |
| Content | CMS content sanitised; no executable HTML rendered |
| Analytics | Consent-aware; no email, phone, address, order ID or payment data in events |
| Admin/staff tools | Role-based access; audited actions |
| Reviews | POPIA (and GDPR where relevant) data map, retention schedule, data-subject-rights process, breach plan, vendor assessments; OWASP MASVS-aligned review and an independent penetration test |
| Cultural stewardship | Brand-approved copy and reviewers for collection meaning, Xhosa orthography and context; no generated “traditional meaning” copy; image rights and consent |
