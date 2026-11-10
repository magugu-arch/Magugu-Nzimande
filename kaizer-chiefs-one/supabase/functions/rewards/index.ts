// GET /rewards/catalog · /rewards/me/wallet · POST /rewards/me/redemptions
//
// Redemption is idempotent: the client sends an Idempotency-Key (a UUID per
// attempt). The first request records a pending row in reward_transactions;
// retries with the same key find that row and never redeem twice. A
// redemption is reported confirmed only with the provider's reference.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logEvent, requireSecrets, unavailable } from '../_shared/respond.ts';

const SECRETS = ['REWARDS_BASE_URL', 'REWARDS_API_KEY'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const path = new URL(req.url).pathname;

  const secrets = requireSecrets(SECRETS);
  if (!secrets.ok) {
    logEvent('rewards.not_configured', { missing: secrets.missing.join(',') });
    return unavailable('integration_pending', 'Khosi Rewards is not connected yet.');
  }

  if (req.method === 'POST' && path.endsWith('/me/redemptions')) {
    const auth = req.headers.get('Authorization');
    if (!auth) return unavailable('not_authenticated', 'Sign in to redeem.', 401);
    const key = req.headers.get('Idempotency-Key') ?? '';
    if (!UUID.test(key))
      return unavailable('error', 'A valid Idempotency-Key header is required.', 400);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: auth } },
      },
    );
    const { data: user } = await userClient.auth.getUser();
    if (!user?.user) return unavailable('not_authenticated', 'Sign in to redeem.', 401);

    // Rate limit per supporter before touching the provider (implementation
    // depends on the chosen platform, e.g. a counter table or gateway rule).

    // Provider call goes here:
    //   1. insert into reward_transactions (user_id, reward_id, idempotency_key)
    //      on conflict (user_id, idempotency_key) do nothing — with the service role;
    //   2. if the row already existed, return its current state;
    //   3. call the provider with the same idempotency key;
    //   4. update the row to confirmed/failed with the provider reference.
    logEvent('rewards.redeem_adapter_missing', { user: user.user.id });
    return unavailable(
      'integration_pending',
      'Nothing was redeemed. The rewards adapter is not connected yet.',
    );
  }

  return unavailable(
    'integration_pending',
    'The rewards adapter has not been written for this provider yet.',
  );
});
