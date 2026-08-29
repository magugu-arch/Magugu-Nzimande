import { NextResponse } from 'next/server';
import { findProduct } from '@/lib/catalogue-state';

/** GET /api/products/:slug — a single product with its option groups. */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const product = findProduct(slug);
  if (!product) {
    return NextResponse.json({ error: 'No such product' }, { status: 404 });
  }
  return NextResponse.json({ product });
}
