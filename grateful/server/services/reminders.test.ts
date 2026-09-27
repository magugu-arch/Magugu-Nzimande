import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addDays, todayInSast } from '../../shared/format';
import type { EmailMessage } from '../email/types';
import { route } from '../router';
import { realServices, resetStudio, sampleClients, setupStudio } from '../test/fixtures';
import { createStudioBooking } from './admin';
import { createBooking, sendReminders } from './booking';

const tomorrow = addDays(todayInSast(), 1);
let outbox: EmailMessage[];

beforeEach(() => {
  outbox = setupStudio({ services: realServices, date: tomorrow }).outbox;
});
afterEach(() => {
  resetStudio();
  delete process.env.CRON_SECRET;
});

describe('day-before reminders', () => {
  it('emails each client booked for tomorrow exactly once, however often the job runs', async () => {
    await createBooking({ serviceId: 'consultation', date: tomorrow, time: '10:00', ...sampleClients[0]! });
    await createBooking({ serviceId: 'fittings', date: tomorrow, time: '14:00', ...sampleClients[1]! });
    outbox.length = 0;
    expect(await sendReminders()).toMatchObject({ date: tomorrow, sent: 2, skipped: 0 });
    expect(outbox.map((m) => m.subject)).toEqual(expect.arrayContaining([expect.stringMatching(/^Tomorrow at 10:00/), expect.stringMatching(/^Tomorrow at 14:00/)]));
    expect(await sendReminders()).toMatchObject({ sent: 0 });
    expect(outbox).toHaveLength(2);
  });

  it('skips, but marks, bookings with no email address', async () => {
    await createStudioBooking({ serviceId: 'fittings', date: tomorrow, time: '09:00', clientName: 'Phone client', phone: '082 000 0000', email: '', notes: '', notifyClient: false });
    outbox.length = 0;
    expect(await sendReminders()).toMatchObject({ sent: 0, skipped: 1 });
    expect(await sendReminders()).toMatchObject({ sent: 0, skipped: 0 });
  });

  it('runs from the cron endpoint only with the scheduler secret', async () => {
    const call = (auth?: string) =>
      route({ method: 'GET', path: '/api/cron/reminders', query: new URLSearchParams(), headers: auth ? { authorization: auth } : {}, ip: '1.1.1.1', rawBody: '' });
    expect((await call('Bearer anything')).status).toBe(401); // no secret configured: disabled
    process.env.CRON_SECRET = 'cron-secret-for-tests-123';
    expect((await call('Bearer wrong')).status).toBe(401);
    const ok = await call('Bearer cron-secret-for-tests-123');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ date: tomorrow });
  });
});
