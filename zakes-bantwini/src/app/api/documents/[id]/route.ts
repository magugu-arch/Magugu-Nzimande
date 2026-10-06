import { NextResponse, type NextRequest } from 'next/server';
import { getAdmin } from '@/lib/auth/admin';
import { bookingIdForToken } from '@/lib/booking/service';
import { getStorage } from '@/lib/storage';
import { getStore } from '@/lib/store';

/**
 * Private document download. Admins may fetch any document; a client may
 * fetch only documents marked client-visible on their own booking, proven by
 * their portal token (?t=…).
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/api/documents/[id]'>) {
  const { id } = await ctx.params;
  const doc = await getStore().get('documents', id);
  if (!doc) return new NextResponse('Not found', { status: 404 });

  const admin = await getAdmin();
  if (!admin) {
    const token = request.nextUrl.searchParams.get('t') ?? '';
    const bookingId = token ? await bookingIdForToken(token) : null;
    if (!bookingId || bookingId !== doc.bookingId || !doc.clientVisible) return new NextResponse('Not found', { status: 404 });
  }

  const body = await getStorage().get(doc.storageKey);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'content-type': doc.contentType,
      'content-length': String(body.length),
      'content-disposition': `attachment; filename="${doc.filename.replace(/"/g, '')}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
