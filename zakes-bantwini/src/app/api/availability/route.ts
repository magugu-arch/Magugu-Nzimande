import { NextResponse, type NextRequest } from 'next/server';
import { addDays, daysBetween, isIsoDate, todayIso } from '@/lib/booking/dates';
import { publicAvailability } from '@/lib/booking/service';

/**
 * GET /api/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Day → available | limited | unavailable | past. Nothing else: no booking,
 * client or venue ever leaves through this endpoint.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = params.get('from') ?? todayIso();
  const to = params.get('to') ?? addDays(from, 41);
  if (!isIsoDate(from) || !isIsoDate(to) || to < from || daysBetween(from, to) > 120) {
    return NextResponse.json({ error: 'Use from/to as YYYY-MM-DD, at most 120 days apart.' }, { status: 400 });
  }
  const days = await publicAvailability(from, to);
  return NextResponse.json({ from, to, days }, { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } });
}
