import { NextResponse, type NextRequest } from 'next/server';
import { runScheduledJobs } from '@/lib/booking/service';
import { safeEqual } from '@/lib/security/crypto';

/**
 * Daily scheduled job: hold expiry, balance reminders, event reminders.
 * Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends exactly
 * this when CRON_SECRET is set; see vercel.json).
 */
async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') ?? '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse('Unauthorized', { status: 401 });
  const result = await runScheduledJobs();
  return NextResponse.json(result);
}

export const GET = run;
export const POST = run;
