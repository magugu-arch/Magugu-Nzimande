import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth/admin';
import { todayIso } from '@/lib/booking/dates';
import { STATUS_META } from '@/lib/booking/status';
import { BUDGET_RANGES, COLLABORATION_TYPES, EVENT_TYPES, PERFORMANCE_FORMATS } from '@/lib/booking/types';
import { toCsv } from '@/lib/csv';
import { newId } from '@/lib/security/crypto';
import { getStore } from '@/lib/store';

const label = (list: readonly { key: string; label: string }[], key: string | null) => list.find((x) => x.key === key)?.label ?? key ?? '';
const rand = (cents: number | null | undefined) => (cents === null || cents === undefined ? '' : (cents / 100).toFixed(2));

async function bookings(): Promise<string> {
  const store = getStore();
  const [rows, customers, events, quotes, payments] = await Promise.all([
    store.list('bookings', { orderBy: { field: 'createdAt', dir: 'desc' } }),
    store.list('customers'),
    store.list('events', { where: { kind: 'private' } }),
    store.list('quotes'),
    store.list('payments', { where: { status: 'complete' } }),
  ]);
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const c = byId(customers);
  const e = byId(events);
  return toCsv(
    ['Reference', 'Status', 'Requested', 'Event date', 'Event type', 'Format', 'Venue', 'City', 'Country', 'Attendance', 'Budget range', 'Client', 'Organisation', 'Email', 'Phone', 'WhatsApp opt-in', 'Quote total (R)', 'Quote status', 'Deposit received (R)', 'Balance received (R)'],
    rows.map((b) => {
      const customer = c.get(b.customerId);
      const event = e.get(b.eventId);
      const latest = quotes.filter((q) => q.bookingId === b.id && q.status !== 'draft').sort((x, y) => y.version - x.version)[0];
      const paid = (kind: 'deposit' | 'balance') => payments.filter((p) => p.bookingId === b.id && p.kind === kind).reduce((sum, p) => sum + p.amountCents, 0);
      return [
        b.reference,
        STATUS_META[b.status].label,
        b.createdAt.slice(0, 10),
        event?.date,
        label(EVENT_TYPES, b.eventType),
        label(PERFORMANCE_FORMATS, b.performanceFormat),
        event?.venue,
        event?.city,
        event?.country,
        b.expectedAttendance,
        label(BUDGET_RANGES, b.budgetRange),
        customer?.fullName,
        customer?.organisation,
        customer?.email,
        customer?.phone,
        customer?.whatsappOptIn,
        rand(latest?.totalCents),
        latest?.status,
        rand(paid('deposit')),
        rand(paid('balance')),
      ];
    }),
  );
}

/** Only people who agreed to be contacted, with the exact wording they agreed to (POPIA). */
async function community(): Promise<string> {
  const rows = await getStore().list('community_signups', { orderBy: { field: 'createdAt', dir: 'desc' } });
  return toCsv(
    ['Email', 'Email consent', 'Phone', 'WhatsApp consent', 'Joined', 'Source', 'Consent wording'],
    rows.filter((s) => s.emailConsent || s.whatsappConsent).map((s) => [s.emailConsent ? s.email : '', s.emailConsent, s.whatsappConsent ? s.phone : '', s.whatsappConsent, s.createdAt, s.source, s.consentText]),
  );
}

async function proposals(): Promise<string> {
  const rows = await getStore().list('collaboration_requests', { orderBy: { field: 'createdAt', dir: 'desc' } });
  return toCsv(
    ['Received', 'Status', 'Type', 'Name', 'Organisation', 'Email', 'Phone', 'Timeline', 'Budget', 'Message'],
    rows.map((p) => [p.createdAt, p.status, label(COLLABORATION_TYPES, p.type), p.name, p.organisation, p.email, p.phone, p.timeline, p.budget, p.message]),
  );
}

const DATASETS = { bookings, community, proposals } as const;

/** CSV downloads for owners and managers. Every export is written to the audit log. */
export async function GET(_request: Request, ctx: RouteContext<'/admin/export/[dataset]'>) {
  const { dataset } = await ctx.params;
  const admin = await getAdmin();
  if (!admin) return new NextResponse('Sign in first', { status: 401 });
  if (admin.role === 'viewer') return new NextResponse('Exports need a manager or owner role', { status: 403 });
  if (!(dataset in DATASETS)) return new NextResponse('Not found', { status: 404 });

  const body = await DATASETS[dataset as keyof typeof DATASETS]();
  await getStore().insert('audit_log', { id: newId(), bookingId: null, actor: admin.name, action: 'export_downloaded', detail: { dataset }, createdAt: new Date().toISOString() });
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="zakes-bantwini-${dataset}-${todayIso()}.csv"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
