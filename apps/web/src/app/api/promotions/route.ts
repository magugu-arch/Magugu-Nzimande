import { PROMOTIONS } from '@bbq/seed';
import { NextResponse } from 'next/server';

/** GET /api/promotions — active campaigns. */
export function GET() {
  return NextResponse.json({ promotions: PROMOTIONS });
}
