# Security and privacy

For review by the club's IT security, legal and privacy (POPIA) owners before launch.

## Data the app holds

| Data | Where | Who can read it | Retention (to agree) |
| --- | --- | --- | --- |
| Profile (display name, locale, privacy choices) | `profiles` | The supporter; support agents for support | Until account deletion |
| Email, password | Identity provider only | The supporter | Per identity provider |
| Notification preferences | `notification_preferences` | The supporter | Until account deletion |
| Membership state, last 4 of member number, tier | `member_accounts`, `membership_entitlements` | The supporter | Re-synced; deleted with account |
| Ticket summaries (no entry tokens) | `tickets` | The supporter | Season + agreed period |
| Wallet balance, redemptions | `reward_wallets`, `reward_transactions` | The supporter | Finance retention period |
| Fan Moments, media, consent versions | `fan_posts`, `fan_media`, private storage | Public once approved; author and moderators otherwise | Agreed retention; removed on request |
| Reports | `fan_reports` | The reporter and moderators | Agreed retention |
| Staff actions | `audit_logs` | Analysts and super admins | Agreed retention; append-only |

## Controls in this build

- **RLS on every table**, tested as each role (`supabase/tests/rls.test.ts`). UI visibility is never
  the control.
- **Least privilege staff roles** (`packages/contracts/src/rbac.ts`), mirrored in SQL and checked
  to match. Only super admins change roles, never their own; every change is audited.
- **Server-only secrets.** `EXPO_PUBLIC_*` holds only public values. Provider keys live in function
  secrets; the admin's session secret and service role key are server-only (`import 'server-only'`).
  CI and the local checks confirm neither appears in a client bundle.
- **Fail clearly.** Missing or invalid configuration stops the app or admin at start-up and names
  the variables. Production refuses demo adapters and demo sign-in.
- **Uploads are untrusted.** Type, size and duration limits are enforced in the app, in the
  database (`fan_media` constraints) and by the scanning step. Media is private; approved media is
  served by signed, short-lived URLs.
- **Safeguarding.** A moment that shows anyone under 18 needs a parent or guardian's agreement and
  starts escalated for an extra review. It cannot be deleted while held, so evidence is kept for
  the review.
- **Abuse controls.** One report per supporter per moment; Supabase Auth rate limits in
  `config.toml`; per-user rate limits on redemption and upload functions (to implement with the
  chosen platform).
- **Admin hardening.** HMAC-signed httpOnly SameSite=Strict cookies, eight-hour sessions, roles
  re-read per request, CSP, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **Logging.** Event names and non-personal identifiers only.

## Consent and choices (POPIA)

- Everything optional starts off: marketing email and SMS, analytics, personalisation, showing
  your name on Fan Moments, and every optional notification category.
- Registration asks separately for terms acceptance and marketing opt-in.
- Fan Moment consent records the terms and community-rules versions accepted; changing the text
  means bumping the version so consent is asked again.
- Privacy settings let supporters change any choice and reach data-access and deletion requests.
  Those requests are routed to the club's privacy team once connected; the demo says so plainly.

## Open items

- Identity provider, MFA for staff, and session policy.
- Malware/content scanning vendor for uploads.
- Retention periods and the deletion workflow (including storage objects and backups).
- Crash reporting and analytics vendors, configured without personal data.
- Incident response ownership and breach notification process.
