import { jwtVerify } from 'jose';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before every page request:
 *  1. Records where a visitor came from (?ref= partner codes, ?src= or UTM
 *     source) in first-party cookies, so each booking carries its source code.
 *  2. Sends anyone without a valid staff session away from /admin (an
 *     optimistic check; every console page and action checks again).
 */

const ADMIN_COOKIE = 'st_staff';

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? 'soweto-towers-preview-only-secret-change-me-0001');
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    let ok = false;
    if (token) {
      try {
        await jwtVerify(token, secret(), { algorithms: ['HS256'] });
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = pathname === '/admin' ? '' : `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const partner = searchParams.get('ref');
  const source = searchParams.get('src') ?? searchParams.get('utm_source');
  const campaign = searchParams.get('utm_campaign');
  const thirtyDays = 60 * 60 * 24 * 30;
  if (partner && /^[A-Za-z0-9_-]{2,40}$/.test(partner)) {
    response.cookies.set('st_partner', partner.toUpperCase(), { maxAge: thirtyDays, sameSite: 'lax', path: '/' });
  }
  if (source && /^[A-Za-z0-9_.-]{2,40}$/.test(source)) {
    const value = campaign && /^[A-Za-z0-9_.-]{1,40}$/.test(campaign) ? `${source}/${campaign}` : source;
    response.cookies.set('st_src', value.toLowerCase(), { maxAge: thirtyDays, sameSite: 'lax', path: '/' });
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|images/|icons/|og/|favicon.ico|icon.svg|apple-icon.png|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|llms.txt).*)',
  ],
};
