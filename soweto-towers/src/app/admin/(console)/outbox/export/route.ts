import { getStaff } from '@/lib/auth/session';
import { audit, subscribersCsv } from '@/lib/data/admin';
import { ymdInSast } from '@/lib/time';

/** Opt-in list as CSV for WhatsApp and email tools. Staff only; every export is logged (POPIA). */
export async function GET() {
  const staff = await getStaff();
  if (!staff) return new Response('Sign in first.', { status: 401 });
  const csv = await subscribersCsv();
  await audit(staff, 'subscribers_exported', {});
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="soweto-towers-opt-ins-${ymdInSast(new Date())}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
