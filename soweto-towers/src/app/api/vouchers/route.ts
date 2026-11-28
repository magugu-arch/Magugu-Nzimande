import { checkVoucher, createVoucherOrder } from '@/lib/data/bookings';
import { attribution, rateLimit } from '@/lib/security';

/** GET ?code= checks a Gift a Jump code; POST orders new vouchers. */
export async function GET(request: Request) {
  if (!(await rateLimit('voucher-check', 15, 600))) {
    return Response.json({ valid: false, reason: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  }
  const code = new URL(request.url).searchParams.get('code') ?? '';
  return Response.json(await checkVoucher(code), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  if (!(await rateLimit('voucher-order', 8, 600))) {
    return Response.json({ ok: false, errors: ['Too many attempts. Please wait a few minutes.'] }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const result = await createVoucherOrder(body, await attribution());
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
