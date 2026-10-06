import { NextResponse, type NextRequest } from 'next/server';
import { getStorage } from '@/lib/storage';
import { getStore, StoreNotConfigured } from '@/lib/store';

/**
 * Public files management uploaded in the admin: cover art, audio previews,
 * caption tracks, the technical rider. Content-addressed by id, so they cache
 * for good. Byte ranges are honoured because Safari will not play audio
 * without them.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/assets/[id]/[name]'>) {
  const { id, name } = await ctx.params;
  let asset;
  try {
    asset = await getStore().get('public_assets', id);
  } catch (error) {
    if (error instanceof StoreNotConfigured) return new NextResponse('Not found', { status: 404 });
    throw error;
  }
  if (!asset || asset.filename !== name) return new NextResponse('Not found', { status: 404 });

  const body = await getStorage().get(asset.storageKey);
  const headers: Record<string, string> = {
    'content-type': asset.contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    // Nothing served from here may run script, whatever a file turns out to contain.
    'content-security-policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    'content-disposition': `inline; filename="${asset.filename}"`,
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    const size = body.length;
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
    }
    const slice = body.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(slice), {
      status: 206,
      headers: { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(slice.length) },
    });
  }
  return new NextResponse(new Uint8Array(body), { headers: { ...headers, 'content-length': String(body.length) } });
}
