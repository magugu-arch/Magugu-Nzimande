import { CreatePaymentIntentRequestSchema } from '@bbq/types';
import { NextResponse } from 'next/server';
import { openIntent, recordProviderRef } from '@/lib/payments/ledger';
import { publicBaseUrl } from '@/lib/deployment';
import { activeProvider } from '@/lib/payments/registry';

/**
 * POST /api/payments/intent — opens a payment against an order.
 *
 * Still answers 501 when no gateway is configured, which on this deployment is
 * always: selecting a provider and issuing merchant credentials is somebody's
 * commercial decision, not something engineering can produce (CLAUDE.md §8).
 * What changed is that there is now a real path behind the refusal rather than
 * only the refusal, so attaching a provider is an adapter and two environment
 * variables.
 *
 * The request names an order and nothing else. There is deliberately no amount
 * in the schema: the price is read off the order inside the ledger, the same
 * rule the order route already applies to its lines.
 */
export async function POST(request: Request) {
  const provider = activeProvider();
  if (!provider) {
    return NextResponse.json(
      {
        error: 'No payment provider is configured',
        detail:
          'Select a provider and supply merchant credentials before enabling payment capture.',
      },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body' }, { status: 400 });
  }

  const parsed = CreatePaymentIntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Name the order to pay for' }, { status: 400 });
  }

  const opened = openIntent(parsed.data.orderId, provider.name);
  if (!opened.ok) {
    return NextResponse.json({ error: opened.error }, { status: opened.status });
  }

  const { intent } = opened;
  const base = publicBaseUrl();
  const journeyPath = `/journey?order=${encodeURIComponent(intent.orderId)}`;
  const result = await provider.createIntent({
    reference: intent.id,
    amountCents: intent.amountCents,
    currency: 'ZAR',
    description: `bb.q Chicken order ${intent.orderNumber}`,
    // Named here because only this route knows which order is being paid for.
    // Left undefined when the deployment has no public URL, which sends the
    // adapter to its own fallback rather than to a relative path a gateway
    // would resolve against its own domain.
    returnUrl: base ? `${base}${journeyPath}&payment=done` : undefined,
    cancelUrl: base ? `${base}${journeyPath}&payment=cancelled` : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  recordProviderRef(intent.id, result.providerRef);

  return NextResponse.json({
    intent: { ...intent, providerRef: result.providerRef },
    redirectUrl: result.redirectUrl,
  });
}
