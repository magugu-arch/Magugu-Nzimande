import { NextResponse, type NextRequest } from 'next/server';
import { BookingRequest, fieldErrors } from '@/lib/booking/schemas';
import { BookingError, submitBookingRequest, type UploadedFile } from '@/lib/booking/service';
import { clientIp, rateLimit } from '@/lib/security/rate-limit';

/** POST multipart/form-data — the booking wizard's submission. */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`booking:${clientIp(request.headers)}`, 6, 60 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests from this connection. Please try again later, or contact the booking team.' },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'The request could not be read.' }, { status: 400 });
  }

  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) if (typeof value === 'string') fields[key] = value;

  // Bots fill the hidden field. Answer as if it worked, store nothing.
  if (typeof fields.website === 'string' && fields.website.length > 0) {
    return NextResponse.json({ reference: 'ZB-0000-0000', url: '/book' }, { status: 201 });
  }

  const parsed = BookingRequest.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Some details need attention.', fields: fieldErrors(parsed.error) }, { status: 400 });
  }

  let brief: UploadedFile | null = null;
  const file = form.get('brief');
  if (file instanceof File && file.size > 0) {
    brief = { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
  }

  try {
    const { reference, token } = await submitBookingRequest(parsed.data, brief);
    return NextResponse.json({ reference, url: `/book/confirmation/${token}` }, { status: 201 });
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === 'conflict' ? 409 : 400;
      const field = error.message.toLowerCase().includes('date') ? 'eventDate' : error.message.toLowerCase().includes('file') || error.message.includes('Upload') ? 'brief' : '_';
      return NextResponse.json({ error: error.message, fields: { [field]: error.message } }, { status });
    }
    console.error('[booking] request failed', error);
    return NextResponse.json({ error: 'Something went wrong on our side. Your request was not saved — please try again.' }, { status: 500 });
  }
}
