// Supabase Edge Function: the app's /v1 API.
//
// STUB. This file is not deployed and has not been run against a Supabase
// project. It shows where the HTTP surface is served and where provider
// credentials live. It runs on Deno, so it is excluded from the workspace's
// TypeScript and lint checks; `supabase functions deploy api` checks it.
//
// The route handlers already exist and are tested: `createService` in
// packages/api-client composes the provider adapters into every payload the
// app asks for. What remains here is wiring: real adapters in place of the
// mocks, the caller's identity from their Supabase session, and JSON in and
// out.
//
// Secrets (ticketing, live match data, CMS, membership, rewards, push) are
// read from the function's environment with Deno.env.get(...). They never
// appear in the app bundle, and no provider is called from the device.

// import { createService } from '../../../packages/api-client/src/index.ts';
// import { createLiveAdapters } from './adapters.ts'; // one per IntegrationGate, each tested against its sandbox

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  const { pathname } = new URL(request.url);

  // 1. Identify the caller from the Authorization header (Supabase Auth) and
  //    the X-Device-Id header (guests). Never trust a role sent by the client:
  //    console roles come from public.user_roles.
  // 2. Build the request context: { locale: Accept-Language, account }.
  // 3. Call the matching method on the service and return its payload, e.g.
  //
  //      const service = createService({ adapters: createLiveAdapters(Deno.env), clock: () => new Date() });
  //      if (pathname === '/v1/home') return json(await service.getHome(ctx));
  //
  //    The full route table is `routes` in packages/api-client/src/contracts.ts.
  // 4. Apply public.check_rate_limit(...) to write routes, and
  //    public.claim_webhook_event(...) to provider webhooks.

  return json(
    {
      error: 'not_implemented',
      detail: `No live adapters are configured for ${pathname}. See docs/integrations.md.`,
    },
    501,
  );
});
