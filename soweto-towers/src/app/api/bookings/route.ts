import { createAdventureBooking } from '@/lib/data/bookings';
import { attribution, rateLimit } from '@/lib/security';

/** Create a held booking and start payment. Prices are always recomputed here. */
export async function POST(request: Request) {
  if (!(await rateLimit('booking', 12, 600))) {
    return Response.json({ ok: false, errors: ['Too many attempts from this connection. Please wait a few minutes.'] }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ ok: false, errors: ['Something went wrong sending your booking.'] }, { status: 400 });
  const result = await createAdventureBooking(body, await attribution());
  if (!result.ok) return Response.json(result, { status: 422 });
  return Response.json(result);
}
