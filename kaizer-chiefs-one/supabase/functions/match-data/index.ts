// GET /match-data/fixtures?from&to · /matches/:id · /squads/:teamId
//
// Proxies the club's licensed match data provider. Until the club selects a
// provider and supplies credentials, every route answers integration_pending:
// this function never fabricates fixtures, scores, line-ups or statistics.
import { logEvent, requireSecrets, unavailable } from '../_shared/respond.ts';

const SECRETS = ['MATCH_FEED_BASE_URL', 'MATCH_FEED_API_KEY'] as const;

Deno.serve((req) => {
  const url = new URL(req.url);
  if (req.method !== 'GET') return unavailable('error', 'Method not allowed', 405);

  const secrets = requireSecrets(SECRETS);
  if (!secrets.ok) {
    logEvent('match_data.not_configured', { missing: secrets.missing.join(',') });
    return unavailable('integration_pending', 'The match data provider is not connected yet.');
  }

  // Provider mapping goes here once the club chooses a feed: fetch with the
  // secret key, map into the shared Fixture/Match/Squad contracts, record an
  // integration_sync_logs row, and return ok(data, 'match-feed', updatedAt).
  logEvent('match_data.adapter_missing', { path: url.pathname });
  return unavailable(
    'integration_pending',
    'The match data adapter has not been written for this provider yet.',
  );
});
