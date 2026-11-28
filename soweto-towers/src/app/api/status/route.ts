import { getSetting } from '@/lib/data/settings';

/** Live tower status for the strip on every page. Never cached: weather holds must show at once. */
export async function GET() {
  const status = await getSetting('tower_status');
  return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
}
