import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays } from '../../shared/format';
import { repository } from '../db';
import { realServices, resetStudio, sampleClients, setupStudio, TEST_DATE as date } from '../test/fixtures';
import { addOpeningHours, createStudioBooking, overview, rescheduleOptions, updateService } from './admin';
import { availableDates, availableSlots, createBooking } from './booking';

let outbox: { to: string; subject: string }[];
beforeEach(() => {
  outbox = setupStudio({ services: realServices }).outbox;
});
afterEach(resetStudio);

describe('studio dashboard', () => {
  it('sets a price and deposit, which turns on payment for that service', async () => {
    await updateService('custom-design', { priceCents: 150_000, depositCents: 50_000 });
    const { result } = await createBooking({ serviceId: 'custom-design', date, time: '10:00', ...sampleClients[0]! });
    expect(result.paymentRequired).toBe(true);
  });

  it('refuses a deposit larger than the price, or a deposit with no price', async () => {
    await expect(updateService('fittings', { priceCents: 10_000, depositCents: 20_000 })).rejects.toMatchObject({ status: 400 });
    await expect(updateService('fittings', { depositCents: 5_000 })).rejects.toMatchObject({ status: 400 });
  });

  it('hides a service from booking when it is switched off', async () => {
    await updateService('fittings', { active: false });
    await expect(availableSlots('fittings', date)).rejects.toMatchObject({ status: 404 });
  });

  it('opens a weekly pattern of days and skips days already open', async () => {
    const from = addDays(date, 1);
    const to = addDays(date, 14);
    const res = await addOpeningHours({ from, to, weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '08:00', endTime: '12:00' });
    expect(res.added).toHaveLength(14);
    const again = await addOpeningHours({ date: from, startTime: '10:00', endTime: '14:00' });
    expect(again.skipped).toEqual([from]);
  });

  it('stops offering a day once its hours are closed', async () => {
    const [block] = await repository().listOpeningHours(date, date);
    await repository().setOpeningHoursStatus(block!.id, 'closed');
    expect(await availableSlots('consultation', date)).toEqual([]);
    expect(await availableDates('consultation', date.slice(0, 7))).not.toContain(date);
  });

  it('offers reschedule times that exclude other bookings but not the booking itself', async () => {
    const { result: a } = await createBooking({ serviceId: 'consultation', date, time: '09:00', ...sampleClients[0]! });
    await createBooking({ serviceId: 'consultation', date, time: '11:00', ...sampleClients[1]! });
    const options = await rescheduleOptions(a.bookingId, date);
    expect(options).toContain('09:00');
    expect(options).toContain('09:30');
    expect(options).not.toContain('11:00');
    expect(options).not.toContain('10:30');
  });

  it('counts the week, awaiting payment and new enquiries for the overview', async () => {
    await createBooking({ serviceId: 'consultation', date, time: '09:00', ...sampleClients[0]! });
    await repository().addContactMessage({ name: 'Aisha', email: 'aisha@example.com', phone: '', subject: '', message: 'Hello there, a question.' });
    const o = await overview();
    expect(o.newMessages).toBe(1);
    // TEST_DATE is a week out, so it counts as upcoming but not as today or this week.
    expect(o).toMatchObject({ todayCount: 0, weekCount: 0, awaitingPayment: 0, needsAttention: 0, subscribers: 0 });
  });

  it('records a phone booking as confirmed, blocks the slot, and emails only the studio by default', async () => {
    const b = await createStudioBooking({ serviceId: 'fittings', date, time: '13:00', clientName: 'Walk-in client', phone: '082 555 0000', email: '', notes: '', notifyClient: false });
    expect(b.status).toBe('confirmed');
    expect(await availableSlots('fittings', date)).not.toContain('13:00');
    expect(outbox.map((m) => m.to)).toEqual(['gratefulpty@gmail.com']);
  });

  it('emails the client too when asked and an address is given', async () => {
    await createStudioBooking({ serviceId: 'consultation', date, time: '09:00', ...sampleClients[1]!, notifyClient: true });
    expect(outbox.map((m) => m.to).sort()).toEqual(['gratefulpty@gmail.com', sampleClients[1]!.email]);
  });

  it('refuses a phone booking that clashes or falls outside opening hours', async () => {
    await createBooking({ serviceId: 'consultation', date, time: '10:00', ...sampleClients[0]! });
    const base = { serviceId: 'consultation', clientName: 'X', phone: '082 000 0000', email: '', notes: '', notifyClient: false, date };
    await expect(createStudioBooking({ ...base, time: '10:30' })).rejects.toMatchObject({ status: 409 });
    await expect(createStudioBooking({ ...base, time: '20:00' })).rejects.toMatchObject({ status: 409 });
  });
});
