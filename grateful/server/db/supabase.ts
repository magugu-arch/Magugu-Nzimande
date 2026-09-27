import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Service } from '../../shared/types';
import type { Busy, Window } from '../slots';
import type { Booking, ConfirmResult, Payment, Repository } from './types';

/**
 * Supabase (Postgres) storage. Uses the service-role key, so this file must
 * only ever run on the server — it is imported from server/db/index.ts and
 * nowhere under src/.
 *
 * Money crosses this boundary as rands (numeric) in the database and integer
 * cents everywhere else.
 */

type Row = Record<string, unknown>;

const toCents = (v: unknown): number | null => (v == null ? null : Math.round(Number(v) * 100));
const toRands = (c: number) => (c / 100).toFixed(2);
const hhmm = (t: unknown) => String(t).slice(0, 5);

const service = (r: Row): Service => ({
  id: String(r.id),
  slug: String(r.slug),
  name: String(r.name),
  description: String(r.description ?? ''),
  durationMinutes: Number(r.duration_minutes),
  priceCents: toCents(r.price),
  depositCents: toCents(r.deposit_amount),
  image: String(r.image ?? 'whiteGarment'),
  sortOrder: Number(r.sort_order ?? 0),
  active: Boolean(r.active),
});

const booking = (r: Row): Booking => ({
  id: String(r.id),
  serviceId: String(r.service_id),
  clientName: String(r.client_name),
  email: String(r.email),
  phone: String(r.phone),
  date: String(r.date),
  time: hhmm(r.time),
  durationMinutes: Number(r.duration_minutes),
  notes: String(r.notes ?? ''),
  status: r.status as Booking['status'],
  paymentStatus: r.payment_status as Booking['paymentStatus'],
  paymentReference: (r.payment_reference as string | null) ?? null,
  holdExpiresAt: (r.hold_expires_at as string | null) ?? null,
  createdAt: String(r.created_at),
});

const payment = (r: Row): Payment => ({
  id: String(r.id),
  bookingId: String(r.booking_id),
  amountCents: toCents(r.amount) ?? 0,
  currency: 'ZAR',
  option: r.option as Payment['option'],
  provider: String(r.provider),
  reference: String(r.reference),
  providerReference: (r.provider_reference as string | null) ?? null,
  status: r.status as Payment['status'],
  createdAt: String(r.created_at),
});

function must<T>(res: { data: T; error: { message: string } | null }): T {
  // The message goes to the server log only; routes return a generic error.
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

export function createSupabaseRepository(url: string, serviceRoleKey: string): Repository {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const getBooking = async (id: string) => {
    const rows = must(await db.from('bookings').select('*').eq('id', id).limit(1));
    return rows?.[0] ? booking(rows[0]) : null;
  };
  const getPaymentById = async (id: string) => {
    const rows = must(await db.from('payments').select('*').eq('id', id).limit(1));
    return rows?.[0] ? payment(rows[0]) : null;
  };

  return {
    async listServices({ includeInactive = false } = {}) {
      let q = db.from('services').select('*').order('sort_order');
      if (!includeInactive) q = q.eq('active', true);
      return (must(await q) ?? []).map(service);
    },
    async getService(id) {
      const rows = must(await db.from('services').select('*').eq('id', id).limit(1));
      return rows?.[0] ? service(rows[0]) : null;
    },
    async listAvailability(from, to): Promise<Window[]> {
      const rows = must(await db.from('availability').select('date,start_time,end_time').eq('status', 'open').gte('date', from).lte('date', to));
      return (rows ?? []).map((r) => ({ date: String(r.date), startTime: hhmm(r.start_time), endTime: hhmm(r.end_time) }));
    },
    async listBusy(from, to, now): Promise<Busy[]> {
      const rows = must(
        await db
          .from('bookings')
          .select('date,time,duration_minutes,status,hold_expires_at')
          .gte('date', from)
          .lte('date', to)
          .in('status', ['confirmed', 'pending_payment']),
      );
      return (rows ?? [])
        .filter((r) => r.status === 'confirmed' || (r.hold_expires_at && new Date(String(r.hold_expires_at)) > now))
        .map((r) => ({ date: String(r.date), time: hhmm(r.time), durationMinutes: Number(r.duration_minutes) }));
    },
    async reserveBooking(b) {
      const rows = must(
        await db.rpc('reserve_booking', {
          p_service_id: b.serviceId,
          p_client_name: b.clientName,
          p_email: b.email,
          p_phone: b.phone,
          p_date: b.date,
          p_time: b.time,
          p_duration_minutes: b.durationMinutes,
          p_notes: b.notes,
          p_status: b.status,
          p_payment_status: b.paymentStatus,
          p_hold_expires_at: b.holdExpiresAt,
        }),
      ) as Row[] | null;
      return rows?.[0] ? { ok: true, booking: booking(rows[0]) } : { ok: false, reason: 'slot_taken' };
    },
    getBooking,
    async updateBookingStatus(id, status, paymentStatus) {
      const patch: Row = { status };
      if (paymentStatus) patch.payment_status = paymentStatus;
      const rows = must(await db.from('bookings').update(patch).eq('id', id).select('*'));
      return rows?.[0] ? booking(rows[0]) : null;
    },
    async createPayment(p) {
      const rows = must(
        await db
          .from('payments')
          .insert({
            booking_id: p.bookingId,
            amount: toRands(p.amountCents),
            currency: p.currency,
            option: p.option,
            provider: p.provider,
            reference: p.reference,
            provider_reference: p.providerReference,
            status: p.status,
          })
          .select('*'),
      );
      must(await db.from('bookings').update({ payment_reference: p.reference }).eq('id', p.bookingId));
      return payment(rows![0]!);
    },
    async getPaymentByReference(reference) {
      const rows = must(await db.from('payments').select('*').eq('reference', reference).limit(1));
      return rows?.[0] ? payment(rows[0]) : null;
    },
    async failPayment(reference, status, providerReference) {
      const rows = must(
        await db
          .from('payments')
          .update({ status, ...(providerReference ? { provider_reference: providerReference } : {}) })
          .eq('reference', reference)
          .neq('status', 'paid')
          .select('*'),
      );
      if (rows?.[0]) {
        must(await db.from('bookings').update({ payment_status: status }).eq('id', rows[0].booking_id).neq('payment_status', 'paid'));
        return payment(rows[0]);
      }
      const current = must(await db.from('payments').select('*').eq('reference', reference).limit(1));
      return current?.[0] ? payment(current[0]) : null;
    },
    async confirmPayment(reference, providerReference): Promise<ConfirmResult | null> {
      const rows = must(await db.rpc('confirm_payment', { p_reference: reference, p_provider_reference: providerReference })) as Row[] | null;
      const r = rows?.[0];
      if (!r) return null;
      const [b, p] = await Promise.all([getBooking(String(r.booking_id)), getPaymentById(String(r.payment_id))]);
      if (!b || !p) return null;
      return { outcome: r.outcome as ConfirmResult['outcome'], booking: b, payment: p } as ConfirmResult;
    },
    async addSubscriber(email, consent) {
      const existing = must(await db.from('newsletter_subscribers').select('id').eq('email', email).limit(1));
      must(await db.from('newsletter_subscribers').upsert({ email, consent }, { onConflict: 'email' }));
      return { created: !existing?.length };
    },
    async addContactMessage(msg) {
      must(await db.from('contact_messages').insert(msg));
    },
  };
}
