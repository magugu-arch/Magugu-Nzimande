# Architecture

## Layers

```
src/
  content/        CMS seam: branches, menu, events, campaign pages, reward rules,
                  and the 28-asset manifest typed as BrandImageAsset.
  domain/         Every business rule. No framework, no DOM, no network.
    types.ts        Brief §12, §13.5 and §13.9 types (verbatim where given).
    db.ts           Tables, UNIQUE constraints, transactions with rollback.
    outbox.ts       Durable domain events, idempotent consumers, retries, dead letter.
    booking/        Policy (deposits, cancellation), provider contract, BookingService.
    payments/       Payment state machine, PaymentService, reconciliation, settlement CSV.
    notifications/  Consent and suppression, templates, channel adapters, orchestrator.
    rewards/        Ledger, FIFO expiry, vouchers.
    marketing/      Attribution (UTM, first/last touch), campaigns and audiences.
    events/         Paid event places.
    sandbox/        SANDBOX reservation provider, payment gateway, signed webhooks.
    roles.ts        Staff permissions, enforced inside services.
    analytics.ts    Privacy-aware event log, funnels, brief §13.14 KPIs.
    system.ts       Composition root: wires adapters and services, runs workers.
  web/            Preact UI: screens, sheets, motion, the browser sandbox runner.
test/             node:test suites against the composed system.
```

The UI never computes a price, a deposit, an eligibility decision or a state
transition. It calls a service and renders what comes back.

## The browser sandbox versus production

| Concern | This build | Production |
|---|---|---|
| Services | `createTashasSystem()` in the page | The same call in a Node API process |
| Storage | `Database` in memory, snapshotted to `localStorage` | PostgreSQL with the schema below |
| Workers | `settle()` every 700 ms | Queue workers (outbox dispatcher, booking/payment/notification workers, campaign scheduler) |
| Reservation provider | `SandboxReservationProvider` | Adapter for the provider Tashas contracts |
| Payment gateway | `SandboxPaymentGateway` with a stand-in hosted page | Adapter for the contracted gateway's hosted checkout |
| Email, push | Sandbox adapters that accept and record | Provider adapters; SMS/WhatsApp only when approved |
| Secrets | Published sandbox signing keys only | Server environment variables (see `.env.example`) |

Provider calls happen between short transactions, never inside one, so the
service code is already shaped for network I/O.

## State machines

**Booking attempt** (brief §13.2)

```
draft → availability-selected → pending-payment → requested → confirmed
                 │                     │              │
                 │                     │              ├→ reconciliation → confirmed | failed (refunded)
                 │                     │              └→ failed
                 │                     └→ availability-selected (payment failed, hold valid) | expired
                 ├→ waitlisted
                 └→ expired | failed
```

**Booking**: `confirmed → amended* → completed | no-show | cancelled`;
`waitlisted → cancelled`. Completed and no-show come only from verified provider
webhooks.

**Payment** (brief §13.3): `created → pending → requires-action → authorised →
succeeded → refund-pending → partially-refunded → refunded`, with `failed` and
`cancelled` terminal. Out-of-order reports are recorded and ignored.

**Campaign**: `draft → pending-approval → approved → scheduled → sent`, with
`paused` and `cancelled`; approval must come from someone other than the author
(administrators excepted).

## Events

Published in the same transaction as the change that caused them (outbox):
`booking.started|confirmed|amended|cancelled|completed|no-show|waitlisted|failed|reconciliation-required`,
`payment.succeeded|failed|cancelled|refunded`, `reward.earned|redeemed`,
`event-booking.confirmed`, `campaign.conversion`, `guest.consent-changed`.

Consumers: notifications (messages and reminders), rewards (earn on
`booking.completed`), event tickets (confirm on payment), campaigns (refresh
conversion stats). Each delivery is recorded per consumer, so a consumer that
failed is retried without re-running the others.

## API surface (brief §13.10)

| Route | Service call |
|---|---|
| `GET /api/branches` | `content.branches` (published, verified only in production) |
| `GET /api/branches/:id/availability` | `bookings.availability(branchId, date, partySize)` |
| `POST /api/booking-attempts` | `bookings.startAttempt()` then `selectSlot()`, `setGuestDetails()` |
| `POST /api/bookings` | `bookings.submit(attemptId, { policyAccepted })` |
| `GET /api/bookings/:id` | `bookings.booking(id)` with guest/staff authorisation |
| `POST /api/bookings/:id/reschedule` | `bookings.reschedule(id, change, { actor, idempotencyKey })` |
| `POST /api/bookings/:id/cancel` | `bookings.cancel(id, { actor, idempotencyKey })` |
| `POST /api/payments/checkout` | created inside `bookings.submit` / `tickets.reserve` from the server quote |
| `GET /api/payments/:id/status` | `payments.syncStatus(id)` |
| `POST /api/payments/:provider/webhook` | `payments.handleWebhook(rawBody, headers)` |
| `POST /api/reservations/:provider/webhook` | `bookings.handleProviderWebhook(rawBody, headers)` |
| `POST /api/payments/:id/refund` | `payments.refund({ …, actor, idempotencyKey })` |
| `GET/PUT /api/guest/preferences` | `guests.preferences()`, `guests.setPreference()`, `consent.grant/withdraw()` |
| `GET /api/guest/notifications` | `notifications.inbox(guestId)` |
| `/api/campaigns/*` | `campaigns.create/submitForApproval/approve/schedule/sendNow/pause/cancel/preview/stats` |

Every mutating route takes an `Idempotency-Key` header and passes it through.
Webhook routes read the raw body before any JSON parsing, because signatures are
computed over the bytes.

## PostgreSQL schema

The in-memory `Database` mirrors these tables and their UNIQUE constraints.

```sql
create table guests (
  id text primary key, name text not null, email text, phone text,
  contact_hash text not null, birthday date, home_branch_id text,
  push_token text, push_token_valid boolean not null default false,
  utc_offset_minutes int not null default 120,
  is_demo_population boolean not null default false,
  created_at timestamptz not null, erased_at timestamptz
);
create index on guests (contact_hash);

create table booking_attempts (
  id text primary key, guest_id text references guests, branch_id text not null,
  selected_slot jsonb, state text not null, hold_id text, expiry_at timestamptz,
  idempotency_key text not null unique, correlation_id text not null,
  guest_details jsonb, deposit_amount_minor int not null default 0,
  policy_version text, policy_accepted_at timestamptz, payment_id text, booking_id text,
  failure_reason text, provider_create_attempts int not null default 0,
  attribution jsonb, amends_booking_id text,
  created_at timestamptz not null, updated_at timestamptz not null
);

create table bookings (
  id text primary key, reference text not null unique, guest_id text not null references guests,
  branch_id text not null, provider text not null, external_id text, status text not null,
  date date not null, time time not null, period text not null, starts_at timestamptz not null,
  party_size int not null check (party_size > 0), policy_version text not null,
  deposit_amount_minor int not null, deposit_paid_minor int not null, deposit_refunded_minor int not null,
  payment_ids text[] not null default '{}', occasion text, special_request text, seating text,
  attempt_id text, attribution jsonb, version int not null default 1,
  created_at timestamptz not null, updated_at timestamptz not null
);

create table booking_events (
  id text primary key, booking_id text, provider_event_id text unique, event_type text not null,
  payload_redacted jsonb not null, signature_verified boolean not null,
  received_at timestamptz not null, processed_at timestamptz, outcome text not null
);

create table payments (
  id text primary key, provider text not null, provider_payment_id text unique,
  purpose text not null, reference_id text not null, booking_attempt_id text, guest_id text,
  amount_minor int not null check (amount_minor > 0), currency char(3) not null,
  status text not null, refunded_minor int not null default 0,
  idempotency_key text not null unique, gateway_reference text, checkout_url text,
  description text not null, metadata jsonb not null, history jsonb not null,
  created_at timestamptz not null, updated_at timestamptz not null
);

create table payment_events (
  id text primary key, provider_event_id text unique, payment_id text, event_type text not null,
  raw_payload_redacted jsonb not null, signature_verified boolean not null,
  received_at timestamptz not null, processed_at timestamptz, outcome text not null
);

create table refunds (
  id text primary key, payment_id text not null references payments, amount_minor int not null,
  reason text not null, status text not null, approved_by text not null, provider_reference text,
  idempotency_key text not null unique, created_at timestamptz not null, updated_at timestamptz not null
);

create table guest_consents (
  id text primary key, guest_id text not null, contact_hash text not null, purpose text not null,
  channel text not null, status text not null, consent_text_version text not null,
  consent_text text not null, source text not null, captured_at timestamptz not null,
  withdrawn_at timestamptz
);
create index on guest_consents (guest_id, channel, captured_at desc);

create table guest_preferences (
  id text primary key, guest_id text not null, category text not null, enabled boolean not null,
  channels text[] not null, updated_at timestamptz not null, unique (guest_id, category)
);

create table suppression (
  id text primary key, contact_hash text, guest_id text, channel text not null,
  reason text not null, created_at timestamptz not null
);
create index on suppression (contact_hash);

create table notifications (
  id text primary key, guest_id text not null, category text not null, kind text not null,
  template_id text not null, template_version int not null, title text not null, body text not null,
  payload jsonb not null, dedupe_key text not null unique, scheduled_at timestamptz not null,
  status text not null, suppressed_reason text, campaign_id text, channels text[] not null,
  link jsonb, read_at timestamptz, created_at timestamptz not null
);
create index on notifications (status, scheduled_at);

create table notification_deliveries (
  id text primary key, notification_id text not null references notifications, guest_id text not null,
  channel text not null, provider_message_id text, status text not null, attempts int not null,
  last_error text, next_attempt_at timestamptz, sent_at timestamptz
);

create table reward_ledger (
  id text primary key, guest_id text not null, type text not null, points int not null,
  reference_type text not null, reference_id text not null, idempotency_key text not null unique,
  created_at timestamptz not null, expires_at timestamptz, reverses_entry_id text, note text
);

create table vouchers (
  id text primary key, code text not null unique, guest_id text not null, offer_id text not null,
  title text not null, status text not null, issued_at timestamptz not null,
  expires_at timestamptz not null, redeemed_at timestamptz, ledger_entry_id text not null
);

create table campaigns (
  id text primary key, name text not null, status text not null, channel text not null,
  template_id text not null, audience jsonb not null, audience_rule_version int not null,
  consent_policy_version text not null, landing_slug text not null, utm jsonb not null,
  frequency_cap_per_week int not null, attribution_window_days int not null,
  scheduled_at timestamptz, created_by text not null, approved_by text, sent_at timestamptz,
  stats jsonb not null, history jsonb not null, created_at timestamptz not null, updated_at timestamptz not null
);

create table domain_outbox (
  event_id text primary key, event_type text not null, schema_version int not null,
  aggregate_id text not null, correlation_id text not null, payload jsonb not null,
  occurred_at timestamptz not null, published_at timestamptz, attempts int not null default 0,
  next_attempt_at timestamptz, delivered_to text[] not null default '{}', status text not null,
  last_error text
);
create index on domain_outbox (status, next_attempt_at);

create table event_bookings (
  id text primary key, reference text not null unique, event_id text not null, guest_id text not null,
  party_size int not null, status text not null, amount_minor int not null, payment_id text,
  idempotency_key text not null unique, attribution jsonb,
  created_at timestamptz not null, updated_at timestamptz not null
);

create table audit_log (
  id text primary key, at timestamptz not null, actor jsonb not null, action text not null,
  entity_type text not null, entity_id text not null, details jsonb not null
);
create index on audit_log (entity_id, at);

create table staff_alerts (
  id text primary key, at timestamptz not null, severity text not null, title text not null,
  body text not null, entity_type text not null, entity_id text not null,
  resolved_at timestamptz, resolved_by text
);

create table branch_overrides (
  branch_id text primary key, policy jsonb not null, updated_at timestamptz not null, updated_by text not null
);
```

Retention (to be set with Tashas legal): analytics events and delivery logs are
the first candidates for short retention; payments, refunds and the audit log
follow finance's requirements; erased guests keep only the contact hash on the
suppression list.

## Swapping a sandbox adapter for a real one

1. Implement `ReservationProvider` (`src/domain/booking/provider.ts`) or the
   brief's `PaymentProvider` plus the named fields in `NamedPaymentProvider`.
   Declare capabilities honestly; the UI only offers what is declared.
2. Map the provider's states onto the documented state machines and write that
   mapping next to the adapter.
3. Verify webhooks with the provider's documented method over the raw body, and
   keep the deduplication by provider event id.
4. Pass the new adapter to `createTashasSystem` on the server. Nothing in
   `booking/service.ts`, `payments/service.ts` or the UI changes.
5. Write contract tests against the provider's sandbox, alongside the existing
   suites, and keep the sandbox adapters for development and demos.
