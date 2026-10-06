import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayIso } from '@/lib/booking/dates';
import { DEFAULT_CANCELLATION_TERMS } from '@/lib/booking/quote';
import type { BookingRequestData } from '@/lib/booking/schemas';
import {
  acceptQuote,
  adminChangeStatus,
  adminConfirmBooking,
  adminHoldDate,
  adminSaveQuote,
  adminSendQuote,
  adminSetAvailability,
  BookingError,
  getPortal,
  handlePaymentNotification,
  publicAvailability,
  requestQuoteChanges,
  runScheduledJobs,
  signContract,
  startPayment,
  submitBookingRequest,
  type Actor,
} from '@/lib/booking/service';
import { sandboxSignature } from '@/lib/payments/sandbox';
import { setStoreForTesting } from '@/lib/store';
import type { Store } from '@/lib/store/types';
import { storeHarnesses } from './stores';

/** The same store, except that inserting into `table` fails — inside transactions too. */
function failingInsert(base: Store, table: string): Store {
  const wrap = (target: Store): Store =>
    new Proxy(target, {
      get(t, prop) {
        if (prop === 'insert') {
          return (tbl: string, row: unknown) => {
            if (tbl === table) throw new Error(`injected failure writing ${table}`);
            return (t.insert as (a: string, b: unknown) => Promise<unknown>)(tbl, row);
          };
        }
        if (prop === 'transaction') return <R,>(fn: (tx: Store) => Promise<R>) => t.transaction((tx) => fn(wrap(tx)));
        const value = Reflect.get(t, prop) as unknown;
        return typeof value === 'function' ? value.bind(t) : value;
      },
    });
  return wrap(base);
}

const manager: Actor = { id: 'admin-1', name: 'Booking Manager', role: 'manager' };
const viewer: Actor = { id: 'admin-2', name: 'Viewer', role: 'viewer' };

let store: Store;
const date = addDays(todayIso(), 60);

function request(overrides: Partial<BookingRequestData> = {}): BookingRequestData {
  return {
    eventDate: date,
    startTime: '19:00',
    endTime: '23:00',
    eventType: 'corporate',
    performanceFormat: 'headline',
    expectedAttendance: 1200,
    budgetRange: 'discuss',
    venue: 'The Venue',
    city: 'Durban',
    country: 'South Africa',
    travelRequired: true,
    travelNotes: 'Flights from Johannesburg',
    accommodationRequired: false,
    accommodationNotes: null,
    productionNotes: null,
    additionalInfo: null,
    fullName: 'Lerato Dlamini',
    organisation: 'Acme Holdings',
    email: 'Lerato@Example.com',
    phone: '+27 82 000 0000',
    whatsappOptIn: false,
    privacyConsent: true,
    ...overrides,
  };
}

const quote = () => ({
  lines: [
    { kind: 'performance' as const, description: 'Headline performance', amountCents: 20_000_000 },
    { kind: 'travel' as const, description: 'Return flights and ground transport', amountCents: 1_500_000 },
  ],
  taxApplicable: true,
  taxRateBps: 1500,
  depositPercent: 50,
  depositDueDate: addDays(todayIso(), 7),
  balanceDueDate: addDays(date, -14),
  validUntil: addDays(todayIso(), 14),
  cancellationTerms: DEFAULT_CANCELLATION_TERMS,
  clientMessage: 'Looking forward to it.',
});

async function pay(ref: string, amount: number, outcome: 'complete' | 'failed') {
  const body = new URLSearchParams({ ref, amount: String(amount), outcome, sig: sandboxSignature(ref, String(amount), outcome) });
  return handlePaymentNotification('sandbox', { body: body.toString(), contentType: 'application/x-www-form-urlencoded', ip: '127.0.0.1' });
}

describe.each(storeHarnesses())('booking journey — $name', (harness) => {
  beforeEach(async () => {
    store = await harness.fresh();
    setStoreForTesting(store);
  });
  afterAll(() => harness.close());

  it('runs request → review → quote → accept → sign → deposit → confirm', async () => {
    const { reference, token } = await submitBookingRequest(request(), null);
    expect(reference).toMatch(/^ZB-\d{4}-0001$/);

    let portal = (await getPortal(token))!;
    expect(portal.booking.status).toBe('NEW');
    expect(portal.customer.email).toBe('lerato@example.com');
    expect(await store.count('notifications', { where: { event: 'enquiry_received' } })).toBeGreaterThan(0);

    await adminChangeStatus(portal.booking.id, 'IN_REVIEW', manager);
    const draft = await adminSaveQuote(portal.booking.id, quote(), manager);
    expect(draft.totalCents).toBe(24_725_000);
    await adminSendQuote(draft.id, manager);

    portal = (await getPortal(token))!;
    expect(portal.booking.status).toBe('QUOTE_SENT');
    expect((await publicAvailability(date, date))[date]).toBe('limited');

    // Deposit cannot be paid before the quote is accepted and the agreement signed.
    await expect(startPayment(token, 'deposit')).rejects.toBeInstanceOf(BookingError);

    await acceptQuote(token, draft.id);
    portal = (await getPortal(token))!;
    expect(portal.booking.status).toBe('AWAITING_DEPOSIT');
    expect(portal.contract?.status).toBe('sent');
    expect(portal.contract?.terms).toContain(reference);

    await expect(startPayment(token, 'deposit')).rejects.toThrow(/Sign the agreement/);
    await signContract(token, portal.contract!.id, 'Lerato Dlamini', true, '196.0.0.1');

    // Management cannot confirm before the deposit arrives.
    await expect(adminConfirmBooking(portal.booking.id, manager, false)).rejects.toThrow(/paid deposit/);

    const checkout = await startPayment(token, 'deposit');
    expect(checkout.fields.amount).toBe(String(draft.depositCents));
    const ref = checkout.fields.ref!;

    expect((await pay(ref, draft.depositCents + 1, 'complete')).ok).toBe(false);
    expect((await pay(ref, draft.depositCents, 'complete')).ok).toBe(true);
    expect((await pay(ref, draft.depositCents, 'complete')).ok).toBe(true); // retried webhook is a no-op

    portal = (await getPortal(token))!;
    expect(portal.depositPaid).toBe(true);
    expect(portal.booking.status).toBe('AWAITING_DEPOSIT'); // payment alone never confirms

    await adminConfirmBooking(portal.booking.id, manager, false);
    portal = (await getPortal(token))!;
    expect(portal.booking.status).toBe('CONFIRMED');
    expect((await publicAvailability(date, date))[date]).toBe('unavailable');

    const audit = await store.list('audit_log', { where: { bookingId: portal.booking.id } });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(['request_submitted', 'quote_sent', 'quote_accepted', 'contract_signed', 'payment_complete', 'status_changed']),
    );
  });

  it('refuses requests for unavailable or past dates', async () => {
    await adminSetAvailability(date, 'TRAVEL', 'In transit', manager);
    await expect(submitBookingRequest(request(), null)).rejects.toThrow(/unavailable/);
    await expect(submitBookingRequest(request({ eventDate: '2000-01-01' }), null)).rejects.toThrow(/passed/);
  });

  it('lets a client ask for changes, which returns the booking to review', async () => {
    const { token } = await submitBookingRequest(request(), null);
    const p = (await getPortal(token))!;
    await adminChangeStatus(p.booking.id, 'IN_REVIEW', manager);
    const q = await adminSaveQuote(p.booking.id, quote(), manager);
    await adminSendQuote(q.id, manager);
    await requestQuoteChanges(token, q.id, 'Could the set be 90 minutes?');
    const after = (await getPortal(token))!;
    expect(after.booking.status).toBe('IN_REVIEW');
    expect((await store.get('quotes', q.id))?.clientResponseNote).toContain('90 minutes');
    await expect(acceptQuote(token, q.id)).rejects.toThrow(/no longer open/);
  });

  it('blocks viewers from changing anything', async () => {
    const { token } = await submitBookingRequest(request(), null);
    const p = (await getPortal(token))!;
    await expect(adminChangeStatus(p.booking.id, 'IN_REVIEW', viewer)).rejects.toThrow(/role/);
  });

  it('records failed payments and tells the client', async () => {
    const { token } = await submitBookingRequest(request(), null);
    const p = (await getPortal(token))!;
    await adminChangeStatus(p.booking.id, 'IN_REVIEW', manager);
    const q = await adminSaveQuote(p.booking.id, quote(), manager);
    await adminSendQuote(q.id, manager);
    await acceptQuote(token, q.id);
    const signed = (await getPortal(token))!;
    await signContract(token, signed.contract!.id, 'Lerato Dlamini', true, '1.1.1.1');
    const checkout = await startPayment(token, 'deposit');
    await pay(checkout.fields.ref!, q.depositCents, 'failed');
    expect(await store.count('notifications', { where: { bookingId: p.booking.id, event: 'payment_failed' } })).toBeGreaterThan(0);
    expect((await getPortal(token))!.depositPaid).toBe(false);
  });

  it('releases expired holds on the daily job', async () => {
    const { token } = await submitBookingRequest(request(), null);
    const p = (await getPortal(token))!;
    await adminHoldDate(p.booking.id, manager, 0);
    expect((await publicAvailability(date, date))[date]).toBe('limited');
    await new Promise((r) => setTimeout(r, 5));
    const result = await runScheduledJobs();
    expect(result.released).toBe(1);
    expect((await getPortal(token))!.booking.status).toBe('IN_REVIEW');
    expect((await publicAvailability(date, date))[date]).toBe('available');
  });

  it('leaves nothing half-done when a step fails part-way', async () => {
    const { token } = await submitBookingRequest(request(), null);
    const p = (await getPortal(token))!;
    await adminChangeStatus(p.booking.id, 'IN_REVIEW', manager);
    const q = await adminSaveQuote(p.booking.id, quote(), manager);
    await adminSendQuote(q.id, manager);

    // Accepting writes the quote, then the booking status and calendar, then the
    // agreement. Make the last of those fail: the first two must not survive.
    setStoreForTesting(failingInsert(store, 'contracts'));
    await expect(acceptQuote(token, q.id)).rejects.toThrow(/injected/);
    setStoreForTesting(store);

    expect((await store.get('quotes', q.id))?.status).toBe('sent');
    expect((await store.get('bookings', p.booking.id))?.status).toBe('QUOTE_SENT');
    expect(await store.count('audit_log', { where: { bookingId: p.booking.id, action: 'quote_accepted' } })).toBe(0);
    expect(await store.count('notifications', { where: { bookingId: p.booking.id, event: 'quote_accepted' } })).toBe(0);

    // And the step still works once the fault clears.
    await acceptQuote(token, q.id);
    expect((await getPortal(token))!.booking.status).toBe('AWAITING_DEPOSIT');
  });

  it('never resolves a portal from a guessed or malformed token', async () => {
    await submitBookingRequest(request(), null);
    expect(await getPortal('not-a-token')).toBeNull();
    expect(await getPortal('A'.repeat(43))).toBeNull();
  });
});
