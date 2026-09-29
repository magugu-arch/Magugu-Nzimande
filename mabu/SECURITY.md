# Mábu: security

How the app, the API and the website protect a guest's account and Mábu's data, what is deliberately left to
the restaurant, and how to report a problem. Written 29 September 2026.

## Reporting a problem

Email **reservations@maburestaurant.com**. The website serves the same address at
`/.well-known/security.txt`. Please give us a working day before telling anyone else.

## Signing in

- **No passwords.** A guest enters their email and receives a six-digit code. There is nothing to reuse from
  another site's breach, and nothing for us to lose.
- A code lives **10 minutes**, may be tried **5 times**, and is used once.
- Codes and session keys are stored only as SHA-256 hashes, so a copy of the database cannot be used to sign in
  as anybody. Codes are compared in constant time.
- Limits: 5 codes per address per 15 minutes, 20 per client address per hour, and 20 code attempts per client
  address per hour.
- With no email provider configured the server **refuses** to sign anyone in rather than pretending.

## Sessions

| | Idle life | Hard life |
| --- | --- | --- |
| Guest | 60 days | 180 days |
| Staff and admin | 12 hours | 7 days |

- A session in use is renewed up to its hard life, which is never extended: a stolen token dies on a known date.
- Each session remembers its device ("Mábu app on iPhone") and a **salted hash** of the address it was opened
  from. The address itself is never stored.
- A guest sees every sign-in under **Profile → Sign-ins and devices**, and can end all the others in one tap.
- Signing out on the device also ends the session on the server.
- When an account is opened on a device it has not seen, the guest is **emailed**. The email carries no code.
- The role is read from the guest record on **every call**, so taking a staff role away takes effect at once,
  without waiting for a session to expire.

## Staff and admin

- Every role check happens on the server. Hiding a screen in the app is courtesy only.
- **A change to money or policy needs a sign-in from the last half hour**: booking policy, points adjustments,
  reward rules and settings, vouchers, payment reconciliation, campaigns and menu prices. An unattended staff
  device cannot be used to make them; the app asks the person to sign in again.
- Sensitive staff actions are written to an audit log with who, what and when.

## The API

- Every answer carries `Content-Security-Policy: default-src 'none'`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` that turns off
  location, camera, microphone and payment, `Cache-Control: no-store`, and HSTS when served over https.
- Browsers may call it only from the origins in `MABU_ALLOWED_ORIGINS`.
- A caller may make 240 requests a minute from one address and 120 on one session; over that, the answer is a
  429 saying how long to wait.
- Bodies are capped at 64 KB and refused when nested more than 12 deep, carrying more than 2 000 values, or
  holding a string over 8 000 characters. `__proto__`, `constructor` and `prototype` keys are dropped before
  anything reads the body.
- Every response carries a request id, which is what the logs record. Logs never contain codes, tokens or card
  details.
- Errors return a stable code and a sentence a guest can read; the technical detail stays in the log.
- Tools that only make sense against the in-app demo (`admin.simulateFailure`) are not served.

## Payments

- Mábu never sees a card. The guest pays on **PayFast's** own page.
- A payment notification is accepted only when the signature matches, the merchant id is ours, PayFast's own
  validate endpoint confirms it, **and the amount equals the intent's**. A repeated notification is harmless.
- A guest can only reopen their own checkout.

## The website

`npm run export:web` writes the rules into the export:

- `_headers` (Netlify, Cloudflare Pages) and `nginx-security.conf` carry a content security policy that allows
  this site's own files, the start-up script **by hash**, and connections only to the Mábu API — plus HSTS,
  `frame-ancestors 'none'`, nosniff and a `Permissions-Policy`.
- The build **fails** if any page would break that policy (an inline script, or a script or stylesheet from
  another origin). The policy was also checked in a browser: the app runs under it with no violations.
- `.well-known/security.txt` gives the reporting address.
- Profiles, bookings, sign-in, notifications and the staff area are `noindex` and disallowed in `robots.txt`.

## Personal information (POPIA)

- We collect what hosting a guest needs: name, email, phone, their bookings, preferences and occasions, rewards
  and notification choices, and a push token if they allow notifications. Not location, not contacts, never card
  numbers.
- Dietary and accessibility notes can reveal health or religion. They are shown only to the team serving that
  table and are never used for marketing.
- Marketing goes only to guests who opted in, never more than twice in seven days, and never during quiet hours.
- A guest can **read back everything we hold** about them — Profile → Your details → "See what we hold about
  you" — and keep a copy. Staff notes about a guest are not part of it.
- A guest can delete their account in the app: name and contact details go at once; bookings and financial
  records are kept without them for as long as tax law requires.
- **Funnel events** (which screens are opened, which bookings are started and finished) are kept for 90 days
  with an opaque guest id. Every property is a primitive the app chose from a fixed list: there is no field for
  a name, an email, a phone number or an address, an unknown event name is dropped, and a device can send at
  most 50 events in a call.
- The privacy notice, terms and marketing consent are drafted in the app and await Mábu's attorneys.

## The review of this layer

An independent review of the new code found three things, all fixed and covered by tests:

1. **The fresh-sign-in rule named four handlers that do not exist**, so it never applied to reversing points,
   saving reward rules and settings, cancelling a voucher (which refunds the purchaser) or changing voucher
   policy. The names are corrected, the list is wider, and the server now **refuses to start** if the list names
   a handler that does not exist, so the same typo cannot switch the rule off again.
2. **A session kept the lifetime of the role it was opened with.** Staff are promoted from an existing guest
   account, so a promoted person carried a 60-day guest session with staff powers. A session's life is now
   measured against the role held *now*: promoting someone applies the 12-hour staff limit to their existing
   sessions at once.
3. **The full booking policy, including pacing, was readable by any signed-in guest** through the staff
   handler. It now requires a staff role; guests still get the public policy, which carries no pacing.

Redeeming a voucher is deliberately *not* behind the fresh-sign-in rule: front of house does it at the table
all evening, and it needs the guest's own code. Cancelling one is, because that refunds money and needs no code.

## What is checked automatically

`npm run verify` and CI run, on every push:

- 101 tests, of which 23 cover the server: strict headers, the body guard, the limiter, code attempt limits,
  session listing and revocation, the new-device email, the fresh-sign-in rule (including that it names only
  real handlers), session lifetimes under a role change, the staff-only booking policy, and the PayFast
  notification (tampered, wrong amount and unconfirmed are all refused).
- `npm run server:check` repeats the important ones against real PostgreSQL over real HTTP.
- `npm run db:check` applies the schema and tries to break each invariant.
- `npm run audit:deps` fails the build on a dependency with a **high** severity advisory.

## Known and accepted

- **Moderate advisories inside Expo's own toolchain** (`decode-uri-component`, `uuid`) have no fix that does not
  downgrade the SDK. They are build-time and framework paths, not code the app calls with guest input. Reviewed
  again at each SDK upgrade.
- **Bearer token storage.** The app keeps its session token in device storage (on the web, `localStorage`). The
  strict content policy and React's escaping are what keep a script from reading it.
- **One server instance.** Calls are serialised in one process. The limiter counts in memory, so it is per
  instance; when a second instance is added, the limiter and the session store both need to be shared.
- **PayFast is unverified against the real gateway.** Written to the published specification, but the build
  environment cannot reach PayFast: run one sandbox payment before going live.
- **No penetration test yet.** The code-level review above is done; this is not an external test. Worth commissioning one before
  launch.

## Before launch

1. Set `MABU_SESSION_SALT` to a long random secret, so device hashes survive a restart.
2. Serve the API over https only, with `MABU_PUBLIC_URL` set (that turns HSTS on).
3. Set `MABU_ALLOWED_ORIGINS` to the website's origin, and nothing else.
4. Keep `MABU_DEV_LOG_EMAIL` unset in production; the server refuses to start with it in production anyway.
5. Restrict the database to the API's own network, with backups and a tested restore.
6. Give staff their own accounts. Roles are per person, and the audit log names them.
7. Commission an external penetration test.
