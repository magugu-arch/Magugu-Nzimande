import { NextResponse } from 'next/server';

/**
 * Partner links: sowetotowers.co.za/p/HOTELX tags every booking that follows
 * with the partner's code (30 days), then lands on the booking page.
 */
export async function GET(request: Request, ctx: RouteContext<'/p/[code]'>) {
  const { code } = await ctx.params;
  const url = new URL('/book', request.url);
  const res = NextResponse.redirect(url, 302);
  if (/^[A-Za-z0-9_-]{2,40}$/.test(code)) {
    res.cookies.set('st_partner', code.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', path: '/' });
    res.cookies.set('st_src', 'partner', { maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', path: '/' });
  }
  return res;
}
