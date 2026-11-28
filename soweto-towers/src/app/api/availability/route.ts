import { getActivity, type ActivityId } from '@/content/catalog';
import { dayAvailability, rangeAvailability } from '@/lib/data/availability';
import { isYmd } from '@/lib/time';

/**
 * GET /api/availability?activity=bungee-jump&date=2027-02-12   → slots for a day
 * GET /api/availability?activity=bungee-jump&from=2027-02-01&days=42 → day summaries
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const activity = url.searchParams.get('activity') ?? '';
  if (!getActivity(activity)) return Response.json({ error: 'Unknown activity' }, { status: 400 });
  const date = url.searchParams.get('date');
  const headers = { 'Cache-Control': 'no-store' };
  if (date) {
    if (!isYmd(date)) return Response.json({ error: 'Bad date' }, { status: 400 });
    const a = await dayAvailability(activity as ActivityId, date);
    return Response.json(a, { headers });
  }
  const from = url.searchParams.get('from') ?? '';
  const days = Math.min(70, Math.max(1, Number(url.searchParams.get('days') ?? 42)));
  if (!isYmd(from)) return Response.json({ error: 'Bad from date' }, { status: 400 });
  return Response.json({ days: await rangeAvailability(activity as ActivityId, from, days) }, { headers });
}
