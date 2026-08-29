import { NextResponse } from 'next/server';

/**
 * POST /api/payments/intent — provider adapter.
 *
 * Deliberately not implemented: no provider has been selected and no merchant
 * credentials exist (CLAUDE.md section 8). It answers 501 rather than a
 * plausible-looking success, so nothing downstream can mistake this build for a
 * live integration.
 */
export function POST() {
  return NextResponse.json(
    {
      error: 'No payment provider is configured',
      detail:
        'Select a provider and supply merchant credentials before enabling payment capture.',
    },
    { status: 501 },
  );
}
