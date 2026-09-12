import { OrderLineSchema, z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { repriceForReorder } from '@/lib/order-integrity';

/**
 * POST /api/basket/reprice — what a basket built earlier is worth now.
 *
 * Built for the reorder buttons, which had no way to ask. Both of them walked a
 * past order's lines and put each one straight into the basket — the name it
 * had then, the options it had then, the price it cost then — and the first
 * anybody heard that the catalogue had moved on was a 409 from the order route
 * at the end of checkout, naming slugs.
 *
 * The pricing rule is not repeated here. It is `repriceForReorder`, which
 * shares its per-line half with the check `POST /api/orders` runs, so there is
 * one answer to what a line costs. Doing this arithmetic in the browser instead
 * would have been a second implementation of the option deltas — and a delta
 * can be negative, so a second implementation that drifts does not merely show
 * a wrong number, it shows a cheaper one.
 *
 * Open, like the order endpoints it serves: a guest reorders from the journey
 * screen with no session, and nothing here reads or writes anything about a
 * person. It answers only about the lines it was handed.
 */

const BodySchema = z.object({
  lines: z.array(OrderLineSchema).min(1, 'Send the lines to price'),
});

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return NextResponse.json(
      { error: fields[0]?.message ?? 'Send a basket to price', fields },
      { status: 400 },
    );
  }

  /**
   * Always 200, including when every line was dropped.
   *
   * An empty basket is the answer to the question rather than a failure to
   * answer it: the customer's old order is entirely off the menu, which is
   * something to tell them, not an error to make their browser handle.
   */
  return NextResponse.json(repriceForReorder(parsed.data.lines));
}
