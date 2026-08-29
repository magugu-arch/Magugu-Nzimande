import { REWARDS, REWARDS_RULES } from '@bbq/seed';
import { NextResponse } from 'next/server';

/** GET /api/rewards/catalog — redemption tiers. */
export function GET() {
  return NextResponse.json({ rewards: REWARDS, rules: REWARDS_RULES });
}
