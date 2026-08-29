import { NextResponse } from 'next/server';
import { visibleProducts } from '@/lib/catalogue-state';

/** GET /api/products — catalogue, with availability. Hidden products are absent. */
export function GET() {
  return NextResponse.json({ products: visibleProducts() });
}
