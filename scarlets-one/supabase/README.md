# Database: schema, row-level security and tests

Postgres for Scarlets One, written for Supabase. Concept build: nothing here
has been applied to a real Supabase project.

## What is here

| Path                                         | What it is                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `migrations/0001_extensions_and_roles.sql`   | Extensions, the `app` schema, the permission matrix                                            |
| `migrations/0002_core_tables.sql`            | The tables (33) with their constraints                                                         |
| `migrations/0003_rls_policies.sql`           | Grants and row-level security for every table                                                  |
| `migrations/0004_functions_and_triggers.sql` | Audit history, consent log, approval stamps, Fan Zone gate, rate limiting, webhook idempotency |
| `migrations/0005_retention.sql`              | Retention policies, `purge_expired()`, account deletion                                        |
| `migrations/0006_storage_and_realtime.sql`   | Storage bucket policies and realtime publication (Supabase only)                               |
| `tests/`                                     | 144 tests that apply the migrations to a real PostgreSQL and try to break the rules            |
| `functions/api/index.ts`                     | Edge Function stub for the `/v1` API. Not deployed.                                            |

## Running the tests

```sh
npm test -w @scarlets/db        # from the workspace root
```

The tests run PostgreSQL 18 in-process (PGlite), so they need no database
server. Each file applies `tests/supabase_shim.sql` (the roles and the `auth`
schema that Supabase provides) and then every migration in order, as a role
that is neither superuser nor `BYPASSRLS`. Each case then switches role and
JWT subject exactly as PostgREST does for a request, and asserts on the
SQLSTATE the database answers with.

## What the tests prove

- A supporter reads and writes only their own profile, preferences,
  membership, wallet, transactions, entries, device tokens and consent.
- Published content is public; drafts are not. An editor can draft and cannot
  publish or schedule. A club admin publishes, and the publication is stamped.
- A partner admin works only on their own partner's campaigns and cannot
  approve them. At most one approved campaign runs on a placement at a time.
- No person, club admin included, can write a reward transaction or a wallet
  balance. Only the service role can, and provider events are idempotent.
- No reward column has a default value. The migrations seed no wallet,
  transaction, membership or offer.
- One vote per supporter per poll. A Fan Cam photo needs all three consents,
  starts as pending whatever the sender claims, cannot be approved before its
  file scan passes, and is shown to nobody else until a moderator approves it.
  The sender can withdraw it and it cannot be reinstated.
- Match events are append-only revisions. The audit log and the consent log
  cannot be updated or deleted, by the service role or the superuser.
- Marketing consent is stored apart from service notifications, starts off,
  and every change is logged.
- The permission matrix in the database equals `rolePermissions` in
  `packages/domain`, checked value by value.
- Every date column is `timestamptz`. Every function pins its `search_path`.
- Retention purges what its policies say, and account deletion removes
  contact details while keeping an audit record with no personal data in it.

## Applying to a Supabase project

```sh
supabase link --project-ref <ref>
supabase db push
```

## Not verified here

These need a real Supabase project and are untested in this repository:

- The real `auth` schema and its triggers (the tests use a stand-in).
- Storage policies and the realtime publication in migration 0006. The tests
  run them against a hand-written stand-in for Supabase's `storage` schema,
  not the real one.
- Deploying and running the Edge Function.
- Performance under matchday load, and index choices against real data.
