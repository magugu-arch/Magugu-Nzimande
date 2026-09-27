import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceSeed } from '../../src/data/services';
import { addDays, todayInSast } from '../../shared/format';
import type { Service } from '../../shared/types';
import { setRepository } from '../db';
import { createMemoryRepository } from '../db/memory';
import type { Repository } from '../db/types';
import { setEmailProvider } from '../email/providers';
import type { EmailMessage } from '../email/types';
import { setPaymentProvider } from '../payments';
import { createMockProvider, mockSign } from '../payments/mock';
import { PaymentVerificationError } from '../payments/types';
import { availableSlots, BookingError, createBooking, getPublicBooking, handlePaymentNotification, startPayment } from './booking';

const date = addDays(todayInSast(), 7);
const priced: Service[] = serviceSeed.map((s) => (s.id === 'custom-design' ? { ...s, priceCents: 200000, depositCents: 50000 } : s));
const client = { clientName: 'Thandi Mokoena', email: 'thandi@example.com', phone: '+27 82 000 0000', notes: '' };

let repo: Repository;
let sent: EmailMessage[];

beforeEach(() => {
  process.env.MIN_NOTICE_HOURS = '0';
  repo = createMemoryRepository({ services: priced, availability: [{ date, startTime: '09:00', endTime: '17:00' }] });
  setRepository(repo);
  setPaymentProvider(createMockProvider());
  sent = [];
  setEmailProvider({ name: 'test', send: async (m) => void sent.push(m) });
});

afterEach(() => {
  setRepository(null);
  setPaymentProvider(null);
  setEmailProvider(null);
  vi.useRealTimers();
});

const notify = (reference: string, outcome: 'paid' | 'failed', amount: number, signature = mockSign(reference, outcome, amount)) =>
  handlePaymentNotification('mock', { rawBody: new URLSearchParams({ reference, outcome, amount: String(amount), signature }).toString(), ip: '127.0.0.1' });

async function paidBookingFlow(option: 'deposit' | 'full' = 'deposit') {
  const { result } = await createBooking({ serviceId: 'custom-design', date, time: '10:00', ...client });
  const checkout = await startPayment(result.bookingId, option);
  return { bookingId: result.bookingId, reference: checkout.fields.reference!, amount: Number(checkout.fields.amount) };
}

describe('quote-required services (no price)', () => {
  it('confirm immediately, need no payment and email both client and studio', async () => {
    const { result } = await createBooking({ serviceId: 'consultation', date, time: '09:00', ...client });
    expect(result.paymentRequired).toBe(false);
    const b = await getPublicBooking(result.bookingId);
    expect(b?.status).toBe('confirmed');
    expect(b?.paymentStatus).toBe('not_required');
    expect(sent.map((m) => m.to).sort()).toEqual(['gratefulpty@gmail.com', 'thandi@example.com']);
  });
});

describe('double booking', () => {
  it('refuses a time that is already taken and stops offering it', async () => {
    await createBooking({ serviceId: 'consultation', date, time: '11:00', ...client });
    await expect(createBooking({ serviceId: 'fittings', date, time: '11:30', ...client })).rejects.toMatchObject({ status: 409 });
    expect(await availableSlots('fittings', date)).not.toContain('11:30');
  });

  it('refuses a time outside the opening hours even if posted directly', async () => {
    await expect(createBooking({ serviceId: 'consultation', date, time: '18:00', ...client })).rejects.toBeInstanceOf(BookingError);
  });

  it('lets only one of two simultaneous requests for the same slot through', async () => {
    const attempts = await Promise.allSettled([
      createBooking({ serviceId: 'consultation', date, time: '14:00', ...client }),
      createBooking({ serviceId: 'consultation', date, time: '14:00', ...client, email: 'other@example.com' }),
    ]);
    expect(attempts.filter((a) => a.status === 'fulfilled')).toHaveLength(1);
  });
});

describe('paid services', () => {
  it('hold the slot pending payment and do not confirm before a verified notification', async () => {
    const { bookingId } = await paidBookingFlow();
    const b = await getPublicBooking(bookingId);
    expect(b?.status).toBe('pending_payment');
    expect(sent).toHaveLength(0);
    expect(await availableSlots('custom-design', date)).not.toContain('10:00');
  });

  it('charge the deposit or the full price, never an amount from the browser', async () => {
    expect((await paidBookingFlow('deposit')).amount).toBe(50000);
    setRepository(createMemoryRepository({ services: priced, availability: [{ date, startTime: '09:00', endTime: '17:00' }] }));
    expect((await paidBookingFlow('full')).amount).toBe(200000);
  });

  it('confirm the booking and send confirmation + receipt on a verified payment', async () => {
    const { bookingId, reference, amount } = await paidBookingFlow();
    await notify(reference, 'paid', amount);
    const b = await getPublicBooking(bookingId);
    expect(b).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', amountPaidCents: 50000 });
    expect(sent.map((m) => m.subject)).toEqual(expect.arrayContaining([expect.stringMatching(/^Confirmed/), expect.stringMatching(/^Receipt/), expect.stringMatching(/^New booking/)]));
  });

  it('are idempotent: a repeated notification changes nothing and sends nothing', async () => {
    const { reference, amount } = await paidBookingFlow();
    await notify(reference, 'paid', amount);
    const count = sent.length;
    await notify(reference, 'paid', amount);
    expect(sent).toHaveLength(count);
  });

  it('reject a forged notification', async () => {
    const { bookingId, reference, amount } = await paidBookingFlow();
    await expect(notify(reference, 'paid', amount, 'ab'.repeat(32))).rejects.toBeInstanceOf(PaymentVerificationError);
    expect((await getPublicBooking(bookingId))?.status).toBe('pending_payment');
  });

  it('reject a notification for the wrong amount', async () => {
    const { bookingId, reference } = await paidBookingFlow();
    await expect(notify(reference, 'paid', 100)).rejects.toThrow(/Amount mismatch/);
    expect((await getPublicBooking(bookingId))?.paymentStatus).toBe('pending');
  });

  it('record a failed payment without confirming or freeing a paid booking', async () => {
    const { bookingId, reference, amount } = await paidBookingFlow();
    await notify(reference, 'failed', amount);
    expect(await getPublicBooking(bookingId)).toMatchObject({ status: 'pending_payment', paymentStatus: 'failed' });
  });

  it('release the slot when the hold lapses, and flag a late payment if someone else took it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${addDays(todayInSast(), 1)}T09:00:00+02:00`));
    const { bookingId, reference, amount } = await paidBookingFlow();

    vi.setSystemTime(new Date(Date.now() + 21 * 60_000));
    expect(await availableSlots('custom-design', date)).toContain('10:00');
    await expect(startPayment(bookingId, 'deposit')).rejects.toMatchObject({ status: 410 });

    await createBooking({ serviceId: 'consultation', date, time: '10:00', ...client, email: 'second@example.com' });
    sent = [];
    await notify(reference, 'paid', amount);
    expect((await getPublicBooking(bookingId))?.status).toBe('needs_attention');
    expect(sent.some((m) => m.subject.startsWith('ACTION NEEDED'))).toBe(true);
  });

  it('still honour a late payment if the slot is free', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${addDays(todayInSast(), 1)}T09:00:00+02:00`));
    const { bookingId, reference, amount } = await paidBookingFlow();
    vi.setSystemTime(new Date(Date.now() + 25 * 60_000));
    await notify(reference, 'paid', amount);
    expect((await getPublicBooking(bookingId))?.status).toBe('confirmed');
  });
});
