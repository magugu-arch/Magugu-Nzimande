# Integration contracts

Every provider sits behind a server-side function. The mobile app calls
`{SUPABASE_URL}/functions/v1/{function}{path}` with the public anon key and, when signed in, the
supporter's access token. Each response uses one envelope, validated by the app against the
shared schemas in `packages/contracts`:

```json
{ "status": "ok", "data": { … }, "provenance": { "source": "match-feed", "providerRef": null,
  "fetchedAt": "2026-11-10T12:00:00Z", "updatedAt": "2026-11-10T11:58:00Z", "state": "live" } }

{ "status": "unavailable", "reason": "integration_pending", "message": "…" }
```

`reason` is one of `integration_pending`, `not_configured`, `offline`, `error`,
`not_authenticated`, `not_eligible`, `demo_restricted`. The app turns any malformed response into
an honest error rather than rendering partial data.

| Provider interface | Function routes | Data contract | Secrets (names only) |
| --- | --- | --- | --- |
| `ContentProvider` | `GET content/home`, `GET content/items/:id` | `HomeFeed`, `ContentItem` | `CMS_BASE_URL`, `CMS_API_KEY` |
| `MatchDataProvider.getFixtures(range)` | `GET match-data/fixtures?from&to` | `Fixture[]` | `MATCH_FEED_BASE_URL`, `MATCH_FEED_API_KEY` |
| `MatchDataProvider.getMatch(id)` | `GET match-data/matches/:id` | `Match` | same |
| `MatchDataProvider.getSquad(teamId)` | `GET match-data/squads/:teamId` | `Squad` | same |
| `MembershipProvider.getMember(userId)` | `GET membership/me` | `MemberAccount` | `MEMBERSHIP_BASE_URL`, `MEMBERSHIP_API_KEY` |
| `MembershipProvider.getEntitlements(userId)` | `GET membership/me/entitlements` | `Entitlement[]` | same |
| `TicketProvider.listTickets(userId)` | `GET tickets/me` | `TicketSummary[]` | `TICKETING_BASE_URL`, `TICKETING_CLIENT_ID`, `TICKETING_CLIENT_SECRET` |
| `TicketProvider.getSecureTicket(id)` | `GET tickets/me/:id/secure` | `SecureTicket` (expires ≤ 300 s after issue) | same |
| `RewardsProvider.getWallet(userId)` | `GET rewards/me/wallet` | `RewardWallet` | `REWARDS_BASE_URL`, `REWARDS_API_KEY` |
| `RewardsProvider.listRewards()` | `GET rewards/catalog` | `Reward[]` | same |
| `RewardsProvider.redeem(userId, rewardId, key)` | `POST rewards/me/redemptions` + `Idempotency-Key: <uuid>` | `Redemption` | same |
| `CommerceProvider.getProducts()` | `GET commerce/products` | `Product[]` | `COMMERCE_BASE_URL`, `COMMERCE_API_KEY` |
| `CommerceProvider.getProductLink(id)` | `GET commerce/products/:id/link` | `{ url }` | same |
| `FanMomentsProvider` | `GET fan-moments/feed`, `GET fan-moments/me`, `DELETE fan-moments/me/:id`, `POST fan-moments/reports`, upload flow below | `FanPost[]`, `FanReport` | storage + `MODERATION_SCAN_*` |
| `NotificationProvider.sendCampaign(c)` | server only, from the admin | `Campaign` | `EXPO_ACCESS_TOKEN` or APNs/FCM credentials |

Stubs exist for `match-data`, `tickets` and `rewards` (`supabase/functions`); each answers
`integration_pending` until its secrets are set and its adapter is written. Writing an adapter means
mapping the provider's payload into the contract type, recording an `integration_sync_logs` row and
returning `ok(...)`.

## Rules for every adapter

1. **Provenance.** Return `source`, `fetchedAt` and the provider's `updatedAt`. The app marks data
   stale against `MAX_AGE_MS` (60 s for a live match, 6 h for fixtures, 10 min for tickets).
2. **No fabrication.** If the provider has no value, return `null`. The schemas reject invented
   values in demo mode; live adapters must not invent them either.
3. **Idempotency.** Redemptions (and any future payment or ticket operation) take a client UUID
   per attempt. The function records it in `reward_transactions` with
   `on conflict (user_id, idempotency_key) do nothing` before calling the provider, and passes the
   same key to the provider. A retry returns the existing row's state.
4. **Ticket tokens.** Fetched at display time, expire within five minutes, never written to a table,
   a log or analytics. The app renders them only while unexpired and refreshes on expiry.
5. **Logging.** Event names and non-personal identifiers only. No tokens, keys, emails, phone
   numbers or member numbers.

## Fan Moments upload flow (to wire with the approved storage and scanning service)

1. App validates type, size and duration (`validateFanMedia`) and collects consent.
2. App asks `fan-moments/uploads` for a signed upload URL scoped to `fan-media/<user id>/<post id>/`.
3. App uploads to private storage. Storage policies allow writes only into the user's own folder.
4. Function inserts the `fan_posts` row (trigger forces `pending_review`, or `escalated` when the
   moment shows children) and the `fan_media` row with `scan_status = 'pending'`.
5. Scanner job strips EXIF and location metadata, runs malware and content scanning, and sets
   `scan_status`. Rejected files are deleted.
6. Moderators decide in the admin; `moderate_fan_post` records the reason and the audit entry.
7. Approved media is served by short-lived signed URLs only.
