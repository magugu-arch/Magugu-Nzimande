import { NextResponse } from 'next/server';
import { currentStores } from '@/lib/catalogue-state';

/** GET /api/stores — stores, hours, services and delivery zones. */
export function GET() {
  return NextResponse.json({ stores: currentStores() });
}
