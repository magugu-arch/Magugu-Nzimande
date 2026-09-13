import { FEES } from '@bbq/seed';
import { DeliveryQuoteRequestSchema, type DeliveryQuote } from '@bbq/types';
import { NextResponse } from 'next/server';
import { currentStores, findStore } from '@/lib/catalogue-state';
import { deliveryFeeOf } from '@/lib/pricing';

/**
 * POST /api/delivery/quote — can this address be delivered to, and for how much.
 *
 * Answers for the branch it is told about. That is the fix and it is a small
 * one: this used to search every branch and answer yes if any of them covered
 * the suburb, while the order route asked whether *this* branch covered it.
 * The three seeded branches have disjoint zone lists, so a customer with Cresta
 * selected who typed a Fourways address was told "We deliver there. About 45
 * minutes", filled in the rest of checkout, and was refused at placement.
 *
 * When the named branch does not cover it but another does, the refusal says
 * which — because "we do not deliver to this suburb yet" is false in that case,
 * and it loses a sale that only needed the customer to switch branch.
 *
 * With no `storeId` it keeps answering the wide question, which is the one the
 * stores page asks: does this business deliver here at all.
 */
export async function POST(request: Request) {
  const parsed = DeliveryQuoteRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    /**
     * The schema's wording, and the field it belongs to.
     *
     * This answered "Invalid quote request" with the raw Zod issues attached
     * under `issues` — a key no client has ever read, describing our schema
     * rather than the customer's problem. Meanwhile the rule they had actually
     * broken carried "Enter your suburb" and nobody ever saw it.
     *
     * The order route found the same thing on the endpoint one step later and
     * wrote down why: a message that is not about what the person did is a form
     * they cannot fix. This runs earlier — it is what decides whether they can
     * have it delivered at all — so it is the first refusal at checkout most
     * customers will ever meet.
     */
    const fields = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return NextResponse.json(
      { error: fields[0]?.message ?? 'Check the delivery address', fields },
      { status: 400 },
    );
  }

  const { suburb, subtotalCents, storeId } = parsed.data;
  const wanted = suburb.trim().toLowerCase();

  const covers = (candidate: { services: { Delivery: boolean }; zones: readonly string[] }) =>
    candidate.services.Delivery && candidate.zones.some((zone) => zone.toLowerCase() === wanted);

  /**
   * The branch being asked about, when one was named and it exists.
   *
   * A `storeId` naming no branch is treated as not having named one, rather
   * than refused: the caller is asking a question this endpoint can still
   * answer, and a 400 here would take down a checkout screen over a stale id
   * in somebody's browser storage.
   */
  const asked = storeId ? findStore(storeId) : null;
  const serving = asked && covers(asked) ? asked : asked ? null : currentStores().find(covers);

  if (!serving) {
    // Another branch that does cover it, so the refusal can offer a way on.
    const elsewhere = currentStores().find(covers);

    const quote: DeliveryQuote = elsewhere
      ? {
          serviceable: false,
          reason: `${asked?.name ?? 'That branch'} does not deliver to ${suburb.trim()}, but ${elsewhere.name} does.`,
          alternativeStoreId: elsewhere.id,
        }
      : {
          serviceable: false,
          reason:
            'We do not deliver to this suburb yet. Collection is available at both stores.',
        };
    return NextResponse.json({ quote });
  }

  const quote: DeliveryQuote = {
    serviceable: true,
    /**
     * The same function the basket and the order route price with.
     *
     * The free-delivery threshold was written out here a second time, beside
     * `deliveryFeeOf` which exists to answer exactly this. The two agreed
     * because both read the same seed constant — and every fee in that seed is
     * a [CONFIRM] placeholder, so the day real numbers arrive is the day a
     * second copy of the rule starts quoting one price and charging another.
     *
     * One line stands in for the basket's line count: a quote is about an
     * address rather than a basket, and `deliveryFeeOf` returns nothing for an
     * empty one.
     */
    feeCents: deliveryFeeOf('Delivery', subtotalCents, 1),
    // The quoted window's upper bound, so the number at checkout is never
    // beaten by the one the customer is actually waiting for.
    etaMinutes: FEES.deliveryEtaMinutes.max,
    storeId: serving.id,
  };
  return NextResponse.json({ quote });
}
