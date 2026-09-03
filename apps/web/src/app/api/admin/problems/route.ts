import { z } from '@bbq/types';
import { NextResponse } from 'next/server';
import { refuseUnlessOperator } from '@/lib/admin-auth';
import { readAudit } from '@/lib/catalogue-state';
import { handoffFor, pushToPos, requestCourier, unacknowledged } from '@/lib/fulfilment/handoff';
import { activeCourier, activePos } from '@/lib/fulfilment/registry';
import { listSuppressed, suppressionFor, unsuppress } from '@/lib/notifications/suppression';
import { readOrder } from '@/lib/order-store';

/**
 * POST /api/admin/problems — doing something about what the Problems tab shows.
 *
 * The tab listed two kinds of quiet failure and offered nothing to do about
 * either. It printed "worth retrying" beside a refused handoff, which is worse
 * than saying nothing: it names an action and then does not provide it. This is
 * that action.
 *
 * Both operations are deliberately narrow. Retrying is the same call that
 * failed, not a way to push an arbitrary order at the till; restoring an
 * address only undoes a bounce, never a complaint.
 */

const BodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('retry-handoff'),
    orderId: z.string().min(1),
    kind: z.enum(['pos', 'courier']),
  }),
  z.object({ action: z.literal('unsuppress'), address: z.string().min(1) }),
]);

/** What every reply carries, so the console re-renders from one shape. */
const problems = () => ({
  audit: readAudit(),
  unacknowledged: unacknowledged(),
  suppressed: listSuppressed(),
});

export async function POST(request: Request) {
  const refusal = refuseUnlessOperator(request);
  if (refusal) return refusal;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (parsed.data.action === 'unsuppress') {
    const { address } = parsed.data;
    const entry = suppressionFor(address);
    if (!entry) {
      return NextResponse.json({ error: 'That address is not suppressed' }, { status: 404 });
    }

    /**
     * A complaint and an unsubscribe are the customer's decision, and an
     * operator undoing one would put us back to emailing somebody who asked us
     * to stop. `unsuppress` already refuses; the check is repeated here to say
     * why, because "nothing happened" is the least useful answer a console can
     * give.
     */
    if (!unsuppress(address)) {
      return NextResponse.json(
        {
          error:
            entry.reason === 'complaint'
              ? 'That customer reported us as spam. Only they can restore it.'
              : 'That customer unsubscribed. Only they can restore it.',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(problems());
  }

  const { orderId, kind } = parsed.data;
  const order = readOrder(orderId);
  if (!order) return NextResponse.json({ error: 'No such order' }, { status: 404 });

  const record = handoffFor(orderId, kind);
  if (!record) {
    return NextResponse.json({ error: 'That order was never handed off' }, { status: 404 });
  }
  if (record.ok) {
    // Retrying a success would put the same order through the till twice, which
    // a kitchen reads as two of everything. `attempt` refuses it as well; this
    // says so rather than answering with an unchanged list.
    return NextResponse.json({ error: 'That handoff already succeeded' }, { status: 409 });
  }
  if (!record.retryable) {
    return NextResponse.json(
      { error: `Not worth retrying: ${record.error ?? 'the adapter refused it'}` },
      { status: 409 },
    );
  }

  const adapter = kind === 'pos' ? activePos() : activeCourier();
  if (!adapter) {
    return NextResponse.json(
      { error: `No ${kind} system is attached to this deployment` },
      { status: 503 },
    );
  }

  const retried =
    kind === 'pos' ? await pushToPos(order, activePos()) : await requestCourier(order, activeCourier());

  return NextResponse.json({
    ...problems(),
    // Named rather than inferred from the list, so the console can say what
    // happened to the row the operator pressed.
    outcome: retried?.ok ? 'accepted' : (retried?.error ?? 'The retry did not go through'),
  });
}
