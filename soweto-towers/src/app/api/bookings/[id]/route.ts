import { bookingById, vouchersForBooking } from '@/lib/data/bookings';

/**
 * Status for the payment return page. The booking id is a random UUID that only
 * the buyer's browser and the payment provider have seen.
 */
export async function GET(_: Request, ctx: RouteContext<'/api/bookings/[id]'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const d = await bookingById(id);
  if (!d) return Response.json({ error: 'Not found' }, { status: 404 });
  const b = d.booking;
  const paid = b.status === 'paid';
  const vouchers = paid && b.kind === 'voucher' ? await vouchersForBooking(b.id) : [];
  return Response.json(
    {
      ref: b.ref,
      kind: b.kind,
      status: b.status,
      total: b.total,
      payable: b.total - b.voucherApplied,
      summary: (b.meta as { summary?: string }).summary ?? '',
      visitDate: b.visitDate,
      ticketUrl: paid && b.kind !== 'voucher' ? `/ticket/${b.ref}?t=${b.ticketToken}` : null,
      vouchers: vouchers.map((v) => ({ code: v.code, url: `/voucher/${v.code}?t=${v.token}`, label: v.label, recipient: v.recipientName })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
