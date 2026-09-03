import { NextResponse } from 'next/server';
import { settle } from '@/lib/payments/ledger';
import { activeProvider } from '@/lib/payments/registry';

/**
 * POST /api/payments/webhook — the gateway telling us what happened.
 *
 * This is a URL anyone on the internet can post to, so the order of operations
 * is the security property and not an implementation detail:
 *
 *   1. Read the raw bytes. Not `request.json()` — a signature covers what was
 *      sent, and re-serialising parsed JSON does not reliably reproduce it.
 *   2. Verify the signature. Before parsing, before looking anything up, before
 *      the body is treated as meaning anything at all.
 *   3. Only then parse, and settle exactly once on the provider's event id.
 *
 * Step 2 before step 3 is the whole thing. An integration that parses first and
 * verifies later has, for the duration of that mistake, a public endpoint that
 * marks orders paid.
 */
export async function POST(request: Request) {
  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json({ error: 'No payment provider is configured' }, { status: 501 });
  }

  const rawBody = await request.text();

  // Awaited: a gateway may need a round trip of its own to confirm a callback
  // is genuine, and PayFast does.
  if (!(await provider.verify(rawBody, request.headers))) {
    // Deliberately says nothing about what was wrong with it. A caller probing
    // for the shape of a valid callback learns nothing from this reply.
    return NextResponse.json({ error: 'Signature rejected' }, { status: 401 });
  }

  const event = provider.parse(rawBody);
  if (!event) {
    // Verified, so it really is from the provider — just not an event we act
    // on, or not one we understand. 400 rather than 500: nothing here is broken.
    return NextResponse.json({ error: 'Unrecognised event' }, { status: 400 });
  }

  const result = settle(event);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // 200 on a replay as well as on a first delivery. A gateway that reads
  // anything else keeps redelivering, and the redelivery is exactly the case
  // the applied-event list exists to make harmless.
  return NextResponse.json({
    received: true,
    replayed: result.replayed,
    status: result.intent.status,
  });
}
