import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { cancelPending, markPaid } from '@/lib/data/bookings';
import { notifyStaff } from '@/lib/notify';
import { verifyItn } from '@/lib/payments/payfast';

/**
 * PayFast Instant Transaction Notification. PayFast expects a fast 200; the
 * booking is only confirmed when all four checks pass (see lib/payments/payfast).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  const result = await verifyItn(raw, ip, async (bookingId) => {
    if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
    const db = await getDb();
    const [b] = await db
      .select({ total: schema.bookings.total, applied: schema.bookings.voucherApplied })
      .from(schema.bookings)
      .where(eq(schema.bookings.id, bookingId));
    return b ? b.total - b.applied : null;
  });

  if (!result.valid || !result.bookingId) {
    console.error('PayFast ITN rejected', result.reasons);
    await notifyStaff('PayFast notification rejected', [`Reasons: ${result.reasons.join('; ')}`, `Booking: ${result.bookingId ?? 'unknown'}`]);
    return new Response('OK', { status: 200 });
  }

  if (result.status === 'COMPLETE') {
    const out = await markPaid(result.bookingId, { provider: 'payfast', paymentRef: result.pfPaymentId ?? '', amount: result.amount });
    if (!out.ok) {
      await notifyStaff(
        'PayFast payment needs a look',
        [`Booking ${result.bookingId}: ${out.reason ?? 'not confirmed'}`, `PayFast ID ${result.pfPaymentId}`],
        '/admin/bookings',
      );
    }
  } else if (result.status === 'CANCELLED' || result.status === 'FAILED') {
    await cancelPending(result.bookingId);
  }
  return new Response('OK', { status: 200 });
}
