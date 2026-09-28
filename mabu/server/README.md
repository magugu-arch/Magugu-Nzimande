# Mábu API server

The app's service layer (`src/domain`) behind HTTP. The same handler table the app's in-app mock calls is
mounted at `POST /rpc/<name>`; `GET /health` answers `{ ok: true }`.

```bash
npm run server:dev      # build, then run on :8787 with emails printed to the log (dev only)
npm run server:build    # → server/dist/main.mjs
npm run server:start    # production start (set the variables below)
npm run server:check    # end-to-end check on PostgreSQL (PGlite) over HTTP
```

Docker (PostgreSQL + API on one machine):

```bash
docker compose -f server/docker-compose.yml up --build     # from mabu/
```

Point the app at it with `EXPO_PUBLIC_USE_MOCK_API=0` and `EXPO_PUBLIC_API_BASE_URL=https://…`.

## What it does

- **Sign-in:** a six-digit code by email (10 minutes, 5 attempts, one live code per address), then a random
  bearer session (60 days, renewed in use). Codes and tokens are stored only as SHA-256 hashes. Code requests
  are limited to 5 per address per 15 minutes and 20 per IP per hour. With no email provider configured,
  sign-in refuses with `NOT_CONFIGURED` rather than pretending.
- **Identity:** the actor for every call comes from the session, never from the request body.
- **Persistence:** PostgreSQL when `DATABASE_URL` is set, otherwise a JSON file. Pending migrations are applied
  at start, each once, in a transaction, with a checksum so an edited migration stops the start-up. Calls run one at a time; each call's changed rows are written in one transaction before it answers.
- **Jobs:** reminders, expiry, retries and waitlist matching every minute.
- **Push:** devices register through `devices.register`; delivery goes through Expo's push service (APNs and
  FCM). Devices Expo reports as unregistered are forgotten.
- **Bookings:** with `MABU_DIRECT_INVENTORY=1` bookings are taken against the pacing in Admin → Booking policy,
  less bookings in this database. Turn it on only when phone and walk-in bookings are also entered here;
  otherwise leave it off (bookings refuse with `NOT_CONFIGURED`) until the Dineplan adapter is implemented.
- **Mock-only tools** (`admin.simulateFailure`) are not served.

## Environment

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `MABU_DATA_FILE` | JSON file when there is no database (default `data/mabu.json`) |
| `PORT` | default `8787` |
| `MABU_ALLOWED_ORIGINS` | comma-separated web origins allowed by CORS |
| `MABU_DIRECT_INVENTORY` | `1` to take bookings against Mábu's own pacing |
| `EXPO_ACCESS_TOKEN` | optional, Expo enhanced push security |
| `MABU_PUSH_ENABLED` | `false` turns push delivery off |
| `MABU_SMTP_URL` | `smtps://user:password@host:465` — sign-in codes and notification email |
| `MABU_EMAIL_FROM` | sender, e.g. `Mábu Restaurant <reservations@maburestaurant.com>` |
| `MABU_PAYFAST_MERCHANT_ID`, `MABU_PAYFAST_MERCHANT_KEY`, `MABU_PAYFAST_PASSPHRASE` | PayFast credentials (server only) |
| `MABU_PAYFAST_SANDBOX` | `1` to use PayFast's sandbox |
| `MABU_PUBLIC_URL` | this server's public https origin; PayFast returns and notifies here |
| `MABU_AUTO_MIGRATE` | `0` skips applying migrations at start |
| `MABU_DEV_LOG_EMAIL` | `1` prints emails (sign-in codes included) to the log; refused when `NODE_ENV=production` |
| `MABU_*` flags | the §22 / §45 flags from `.env.example`, without `EXPO_PUBLIC_` |

## Still to connect

- **An email account.** Email goes out over SMTP (`src/email.ts`); any provider works. It needs the provider's
  SMTP address and a verified sender on Mábu's domain. Until then sign-in works only with `MABU_DEV_LOG_EMAIL`.
- **PayFast account.** PayFast hosted checkout is built (`src/payfast.ts`): the app opens `/pay/<id>`, which
  posts a signed form to PayFast; the ITN at `/webhooks/payfast` is accepted only with a valid signature, our
  merchant id, PayFast's own confirmation and the right amount. It is written to PayFast's published
  specification but could not reach PayFast from the build environment: run one sandbox payment
  (`MABU_PAYFAST_SANDBOX=1`) before going live. Refunds are made in the PayFast dashboard. Another gateway is a
  new `PaymentProvider` of the same shape.
- **Relational tables.** Rows are kept as documents in `server_row`. They already match the shapes in
  `001_initial.sql`; moving each table onto its columns is the step before reporting at scale.
- **One instance.** Calls are serialised in one process. Run a single instance until the relational move.
