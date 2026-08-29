import { NextResponse } from 'next/server';
import { currentStores } from '@/lib/catalogue-state';

/** GET /api/delivery/zones — serviceable suburbs, by store. */
export function GET() {
  const zones = currentStores()
    .filter((store) => store.services.Delivery)
    .map((store) => ({ storeId: store.id, storeName: store.name, suburbs: store.zones }));
  return NextResponse.json({ zones });
}
