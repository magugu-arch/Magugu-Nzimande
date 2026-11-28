import { createEventBooking } from '@/lib/data/bookings';
import { attribution, rateLimit } from '@/lib/security';

/** Event tickets and free RSVPs. */
export async function POST(request: Request) {
  if (!(await rateLimit('event-booking', 10, 600))) {
    return Response.json({ ok: false, errors: ['Too many attempts. Please wait a few minutes.'] }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const result = await createEventBooking(body, await attribution());
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
