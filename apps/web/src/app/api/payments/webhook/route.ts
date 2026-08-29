import { NextResponse } from 'next/server';

/**
 * POST /api/payments/webhook — provider callback, idempotent.
 *
 * Unimplemented alongside the intent endpoint. When a provider is chosen, the
 * handler must verify the signature before reading the body, and must key on
 * the provider's event id so a redelivered event settles an order once.
 */
export function POST() {
  return NextResponse.json(
    { error: 'No payment provider is configured' },
    { status: 501 },
  );
}
