import { z } from '@bbq/types';
import { NextResponse } from 'next/server';
import {
  hiddenSlugs,
  isHidden,
  isSoldOut,
  recordAudit,
  setHidden,
  setSoldOut,
  visibleProducts,
} from '@/lib/catalogue-state';
import { PRODUCTS } from '@bbq/seed';

const BodySchema = z.object({
  slug: z.string().min(1),
  /** Shown in the catalogue but blocked at add-to-basket. */
  soldOut: z.boolean().optional(),
  /** Absent from the catalogue response entirely. A different state. */
  hidden: z.boolean().optional(),
});

/**
 * POST /api/admin/availability — mark an item sold out, or hide it.
 *
 * Not authenticated. The operations console is a separate auth boundary that
 * has not been built, so this must not reach an environment that serves real
 * customers until it is.
 */
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { slug, soldOut, hidden } = parsed.data;
  const product = PRODUCTS.find((candidate) => candidate.slug === slug);
  if (!product) {
    return NextResponse.json({ error: 'No such product' }, { status: 404 });
  }

  if (soldOut !== undefined && soldOut !== isSoldOut(slug)) {
    setSoldOut(slug, soldOut);
    recordAudit('operations', `${product.name} marked ${soldOut ? 'sold out' : 'available'}`);
  }

  if (hidden !== undefined && hidden !== isHidden(slug)) {
    setHidden(slug, hidden);
    recordAudit('operations', `${product.name} ${hidden ? 'hidden from' : 'restored to'} the menu`);
  }

  return NextResponse.json({ products: visibleProducts(), hidden: hiddenSlugs() });
}
