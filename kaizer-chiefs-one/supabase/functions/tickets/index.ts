// GET /tickets/me · /tickets/me/:id/secure
//
// Ticket summaries come from the ticketing provider (synchronised into
// public.tickets). Entry tokens are fetched from the provider at the moment
// of display, returned with a short expiry, and never stored or logged.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { logEvent, requireSecrets, unavailable } from '../_shared/respond.ts';

const SECRETS = ['TICKETING_BASE_URL', 'TICKETING_CLIENT_ID', 'TICKETING_CLIENT_SECRET'] as const;
const MAX_TTL_SECONDS = 300;

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization');
  if (!auth) return unavailable('not_authenticated', 'Sign in to see your tickets.', 401);

  // A user-scoped client: RLS guarantees a supporter can only see their own tickets.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return unavailable('not_authenticated', 'Sign in to see your tickets.', 401);

  const secrets = requireSecrets(SECRETS);
  if (!secrets.ok) {
    logEvent('tickets.not_configured', { missing: secrets.missing.join(',') });
    return unavailable('integration_pending', 'The ticketing provider is not connected yet.');
  }

  const match = new URL(req.url).pathname.match(/\/me\/([0-9a-f-]{36})\/secure$/);
  if (match) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id, provider_ref, status')
      .eq('id', match[1])
      .maybeSingle();
    if (!ticket) return unavailable('not_eligible', 'That ticket is not on your account.', 404);
    if (ticket.status !== 'active')
      return unavailable('not_eligible', 'This ticket can no longer be used for entry.', 409);
    // Provider call goes here: request a token for ticket.provider_ref with
    // the client credentials, cap its expiry at MAX_TTL_SECONDS, and return
    // { ticketId, token, format, issuedAt, expiresAt }. Do not log the token.
    logEvent('tickets.secure_adapter_missing', { ticket: ticket.id, maxTtl: MAX_TTL_SECONDS });
    return unavailable(
      'integration_pending',
      'Entry codes are issued once the ticketing adapter is connected.',
    );
  }

  return unavailable(
    'integration_pending',
    'The ticketing adapter has not been written for this provider yet.',
  );
});
