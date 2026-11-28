import { z } from 'zod';
import { activeProvider } from '@/lib/payments';
import { bookingById, cancelPending, markPaid } from '@/lib/data/bookings';

/**
 * Simulated checkout for previews and testing. Disabled as soon as real
 * PayFast keys are configured, so it can never confirm a live booking.
 */
const schema = z.object({ id: z.uuid(), action: z.enum(['pay', 'cancel']) });

export async function POST(request: Request) {
  if (activeProvider() !== 'demo') return Response.json({ error: 'Live payments are on.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad request' }, { status: 400 });
  const d = await bookingById(parsed.data.id);
  if (!d) return Response.json({ error: 'Not found' }, { status: 404 });
  if (parsed.data.action === 'cancel') {
    await cancelPending(d.booking.id);
    return Response.json({ ok: true });
  }
  const out = await markPaid(d.booking.id, {
    provider: 'demo',
    paymentRef: `SIM-${Date.now().toString(36).toUpperCase()}`,
    amount: d.booking.total - d.booking.voucherApplied,
  });
  return Response.json(out, { status: out.ok ? 200 : 409 });
}
