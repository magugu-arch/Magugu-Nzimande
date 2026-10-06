import { NextResponse, type NextRequest } from 'next/server';
import { handlePaymentNotification } from '@/lib/booking/service';
import { PaymentsNotConfigured } from '@/lib/payments';
import { clientIp } from '@/lib/security/rate-limit';

/**
 * Payment provider webhooks (PayFast ITN and friends). Verification —
 * signature, source, amount, server confirmation — happens in the provider
 * adapter; this route only hands over the raw body.
 */
export async function POST(request: NextRequest, ctx: RouteContext<'/api/payments/[provider]/notify'>) {
  const { provider } = await ctx.params;
  try {
    const result = await handlePaymentNotification(provider, {
      body: await request.text(),
      contentType: request.headers.get('content-type') ?? '',
      ip: clientIp(request.headers),
    });
    return new NextResponse(result.ok ? 'OK' : 'REJECTED', { status: result.ok ? 200 : 400 });
  } catch (error) {
    if (error instanceof PaymentsNotConfigured) return new NextResponse('NOT CONFIGURED', { status: 503 });
    console.error('[payments] notification failed', error);
    return new NextResponse('ERROR', { status: 500 });
  }
}
