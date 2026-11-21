# Data model

Postgres, written for Supabase. The migrations are in `supabase/migrations`;
144 tests in `supabase/tests` apply them to PostgreSQL 18 and try to break the
rules below. Nothing here has been applied to a real Supabase project.

Every date and time is `timestamptz` (stored in UTC, shown in venue-local
time by the app). Row-level security is on for every table.

## Tables

| Table                                       | Purpose                                                                                                  | Who reads                                                                    | Who writes                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `users`                                     | One row per account. Deletion anonymises it; the row stays as a tombstone.                               | The owner                                                                    | The service. The owner cannot change status or contact fields.                                                    |
| `profiles`                                  | Display name, language, favourite teams, accessibility preferences                                       | The owner                                                                    | The owner                                                                                                         |
| `preferences`                               | Service notification preferences only                                                                    | The owner                                                                    | The owner                                                                                                         |
| `marketing_consents`                        | Current marketing consent, per purpose. No row means not given.                                          | The owner                                                                    | The owner                                                                                                         |
| `consent_log`                               | Append-only evidence of every consent given or withdrawn                                                 | The owner                                                                    | Triggers only. Nobody can edit or delete, the service role included.                                              |
| `user_roles`                                | Console roles (editor, moderator, club_admin, partner_admin)                                             | The person themselves, and club admins                                       | Club admins. Nobody can grant themselves a role.                                                                  |
| `memberships`                               | Link to the club's membership system and eligibility                                                     | The owner                                                                    | The service. A supporter cannot mark themselves verified.                                                         |
| `teams`, `players`                          | Rugby reference data. A player name is set only from an official team sheet.                             | Everyone                                                                     | The service                                                                                                       |
| `fixtures`                                  | Fixtures from the approved feed, kick-off in UTC                                                         | Everyone                                                                     | The service                                                                                                       |
| `fixture_overrides`                         | A club admin's correction laid over the feed: visibility and a notice. It cannot hold a score.           | Club admins. The API applies it for everyone else.                           | Club admins                                                                                                       |
| `match_events`                              | Append-only revisions. A correction is a new row with the same provider event id.                        | Everyone                                                                     | The service. Nobody can edit or delete.                                                                           |
| `media_assets`                              | Every stored file. Type, size and path are constrained; a supporter's file must sit in their own folder. | Public for approved club and partner media                                   | Editors, partners, and supporters for their own Fan Cam uploads                                                   |
| `content_items`                             | Editorial content as language variants: English required, Welsh optional                                 | Published items: everyone. Drafts: editors and club admins.                  | Editors write drafts. Only a club admin can publish or schedule.                                                  |
| `partners`                                  | Commercial partners. `approved` is false for placeholder slots.                                          | Approved partners: everyone. All: console staff.                             | Club admins                                                                                                       |
| `partner_campaigns`, `offers`               | Labelled placements and offers, with dates and terms                                                     | Approved and in date: everyone. All: staff with `campaigns.read`.            | A partner admin for their own partner. Only a club admin approves. One approved campaign per placement at a time. |
| `rewards_wallets`                           | Link to the rewards provider. Balance and tier are nullable and have no default.                         | The owner                                                                    | The service only                                                                                                  |
| `reward_transactions`                       | Provider-issued ledger. `provider_txn_id` is unique; amount is nullable.                                 | The owner                                                                    | The service only                                                                                                  |
| `webhook_events`                            | One row per provider delivery, so each is processed once                                                 | Nobody                                                                       | The service                                                                                                       |
| `activity_definitions`                      | A poll, prediction, quiz, Fan Cam or challenge, with its window                                          | Approved: everyone                                                           | Editors draft; club admins approve                                                                                |
| `fan_cam_consents`                          | The three explicit Fan Cam permissions. All three must be true.                                          | The owner                                                                    | The owner                                                                                                         |
| `fan_activities`                            | One row per entry. Fixed once made; the owner can only withdraw it.                                      | The owner. Moderators for Fan Cam. Other supporters never.                   | The owner, inside the activity's window and the rate limit                                                        |
| `moderation_cases`                          | A case for every Fan Cam photo and every report. Deciding the case approves or rejects the entry.        | Moderators                                                                   | Moderators. Nobody moderates their own entry.                                                                     |
| `notifications`                             | A send to a segment (a rule, never a list of people), with consent check and status                      | Staff with `notifications.schedule`; a supporter sees ones addressed to them | Club admins draft and schedule; the service sends                                                                 |
| `device_tokens`                             | Push tokens. A token moves with the device when another account signs in on it.                          | The owner                                                                    | The owner, through `register_device_token`                                                                        |
| `audit_logs`                                | Append-only history of who changed what. Holds changed fields, never personal data or reward values.     | Club admins                                                                  | Triggers only. Nobody can edit or delete.                                                                         |
| `feature_flags`                             | Remote switches                                                                                          | Everyone                                                                     | Club admins                                                                                                       |
| `rate_limit_hits`                           | Counters for `check_rate_limit`                                                                          | Nobody                                                                       | The service                                                                                                       |
| `retention_policies`, `storage_purge_queue` | What is purged and when; files awaiting deletion                                                         | The service only                                                             | The service only                                                                                                  |

Approved Fan Cam photos reach other supporters through the `fan_cam_gallery`
view, which carries no account id.

## Roles and permissions

The matrix lives in `packages/domain/src/roles.ts` and is mirrored in
`app.role_permissions`. A test checks the two are equal, value by value. A
console role comes from `user_roles`, never from a claim the client sends.

| Permission               | editor | moderator | partner_admin | club_admin | service |
| ------------------------ | :----: | :-------: | :-----------: | :--------: | :-----: |
| `content.read`           |   ✓    |     ✓     |               |     ✓      |    ✓    |
| `content.write`          |   ✓    |           |               |     ✓      |    ✓    |
| `content.publish`        |        |           |               |     ✓      |    ✓    |
| `fixtures.override`      |        |           |               |     ✓      |    ✓    |
| `campaigns.read`         |   ✓    |           |       ✓       |     ✓      |    ✓    |
| `campaigns.write`        |        |           | ✓ own partner |     ✓      |    ✓    |
| `campaigns.approve`      |        |           |               |     ✓      |    ✓    |
| `moderation.review`      |        |     ✓     |               |     ✓      |    ✓    |
| `notifications.schedule` |        |           |               |     ✓      |    ✓    |
| `roles.manage`           |        |           |               |     ✓      |    ✓    |
| `audit.read`             |        |           |               |     ✓      |    ✓    |
| `flags.manage`           |        |           |               |     ✓      |    ✓    |
| `rewards.adjust`         |        |           |               |            |    ✓    |

No person can adjust rewards. Balances belong to the rewards provider, and a
person editing one would break its audit trail. The service role cannot be
granted to a person.

## Retention

`purge_expired()` applies these. It can be run only by the service.

| Policy                                            | Action                                       | After                              |
| ------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| Push tokens not seen, or revoked                  | Delete                                       | 180 days                           |
| Rejected Fan Cam entry and its photo              | Delete                                       | 30 days after the decision         |
| Withdrawn Fan Cam entry and its photo             | Delete                                       | 1 day after withdrawal             |
| Votes, predictions, quiz answers, challenge steps | Remove the link to a person; keep the counts | 180 days after the activity closes |
| Decided moderation cases                          | Remove notes and reporter                    | 365 days                           |
| Finished notification records                     | Delete                                       | 365 days                           |
| Settled webhook deliveries                        | Delete                                       | 90 days                            |
| Rate-limit counters                               | Delete                                       | 1 day                              |
| Processed storage-purge entries                   | Delete                                       | 30 days                            |

These periods are working values for the concept. The club's data protection
officer sets the real ones.

`delete_my_account()` removes a supporter's contact details and profile,
withdraws their consents, and leaves an audit record with no personal data in
it. One supporter cannot delete another's account.
