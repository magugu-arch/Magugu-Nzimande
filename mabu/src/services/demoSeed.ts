import { createBackend, type Backend } from '@/domain/backend';
import { fixedClock } from '@/domain/shared/clock';
import { newIdempotencyKey } from '@/domain/shared/ids';
import { addDays, venueDate, venueWeekday } from '@/domain/shared/time';
import { slotIdOf } from '@/domain/reservations/slots';

/**
 * Demo accounts for the mock back end, so every screen has something true to
 * show on first launch. All history is created through the real services on
 * a clock set in the past — the ledger, inbox and audit trail are genuine,
 * not pasted in.
 */
export const DEMO_ACCOUNTS = {
  guest: { email: 'demo@mabu.app', name: 'Lerato Mokoena', phone: '082 555 0101' },
  staff: { email: 'host@mabu.demo', name: 'Front of House' },
  admin: { email: 'admin@mabu.demo', name: 'Mábu Admin' },
} as const;

function openDayOnOrAfter(date: string): string {
  let d = date;
  // Tuesday–Saturday serve dinner under the default policy.
  while (![2, 3, 4, 5, 6].includes(venueWeekday(d))) d = addDays(d, 1);
  return d;
}

export async function seedDemo(backend: Backend): Promise<void> {
  const { db } = backend;
  if (db.guests.find((g) => g.email === DEMO_ACCOUNTS.guest.email)) return;

  const staff = backend.guests.findOrCreate(DEMO_ACCOUNTS.staff);
  db.guests.update(staff.id, { role: 'staff', name: DEMO_ACCOUNTS.staff.name });
  const admin = backend.guests.findOrCreate(DEMO_ACCOUNTS.admin);
  db.guests.update(admin.id, { role: 'admin', name: DEMO_ACCOUNTS.admin.name });

  const guest = backend.guests.findOrCreate(DEMO_ACCOUNTS.guest);
  const actor = { id: guest.id, role: 'guest' as const };
  db.guests.update(guest.id, {
    occasions: [{ id: 'occ_demo', kind: 'birthday', label: 'My birthday', date: '11-14' }],
    preferences: { dietaryTags: [], seatingPreference: 'banquette' },
  });

  const today = venueDate(backend.ctx.clock.now());
  const staffActor = { id: staff.id, role: 'staff' as const };

  // Six weeks ago: join Rewards and dine for the first time.
  const firstDay = openDayOnOrAfter(addDays(today, -42));
  const first = createBackend({
    db,
    clock: fixedClock(`${firstDay}T09:00:00+02:00`),
    flags: backend.ctx.flags,
  });
  first.rewards.optIn(guest.id, actor);
  const firstVisit = await first.reservations.create(
    {
      venueId: 'mabu-waterfall',
      slotId: slotIdOf('mabu-waterfall', firstDay, '19:30'),
      partySize: 2,
      guest: DEMO_ACCOUNTS.guest,
      idempotencyKey: newIdempotencyKey(),
    },
    actor,
  );
  (first.ctx.clock as ReturnType<typeof fixedClock>).set(`${firstDay}T16:31:00+02:00`);
  await first.notifications.processDue();
  (first.ctx.clock as ReturnType<typeof fixedClock>).set(`${firstDay}T23:00:00+02:00`);
  await first.reservations.markCompleted(firstVisit.id, staffActor);

  // Three weeks ago: dine again, and buy a voucher — on the past clock.
  const pastDay = openDayOnOrAfter(addDays(today, -21));
  const past = createBackend({
    db,
    clock: fixedClock(`${pastDay}T09:00:00+02:00`),
    flags: backend.ctx.flags,
  });
  const visit = await past.reservations.create(
    {
      venueId: 'mabu-waterfall',
      slotId: slotIdOf('mabu-waterfall', pastDay, '18:30'),
      partySize: 2,
      occasion: 'date-night',
      guest: DEMO_ACCOUNTS.guest,
      idempotencyKey: newIdempotencyKey(),
    },
    actor,
  );
  // The scheduler runs when it would have on the day: the reminder goes out
  // before dinner, not after it.
  const clock = past.ctx.clock as ReturnType<typeof fixedClock>;
  clock.set(`${pastDay}T15:31:00+02:00`);
  await past.notifications.processDue();
  clock.set(`${pastDay}T22:30:00+02:00`);
  await past.reservations.markCompleted(visit.id, staffActor);
  await past.vouchers.purchase(
    {
      amountCents: 150000,
      forSelf: false,
      recipientName: 'Naledi Mokoena',
      recipientEmail: 'naledi@example.com',
      message: 'Happy anniversary — enjoy an evening at Mábu.',
      occasion: 'Anniversary',
      delivery: 'email',
      methodToken: 'tok_mock_success',
      idempotencyKey: newIdempotencyKey(),
    },
    actor,
  );

  // An upcoming table, on the real clock.
  const upcomingDay = openDayOnOrAfter(addDays(today, 5));
  await backend.reservations.create(
    {
      venueId: 'mabu-waterfall',
      slotId: slotIdOf('mabu-waterfall', upcomingDay, '18:30'),
      partySize: 4,
      occasion: 'birthday',
      occasionNote: 'Thabo turns 40',
      seatingPreference: 'banquette',
      guest: DEMO_ACCOUNTS.guest,
      idempotencyKey: newIdempotencyKey(),
    },
    actor,
  );
}
