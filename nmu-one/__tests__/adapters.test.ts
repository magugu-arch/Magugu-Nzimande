import { AdapterError } from '@/core/adapters/errors';
import { createMockProviders } from '@/core/adapters/registry';
import { connectivity, providerContext, setMockLatencyForTesting } from '@/core/adapters/runtime';
import { resetMockState } from '@/core/adapters/mock/state';
import { createLiveProviders } from '@/core/adapters/live';
import type { AppNotification, Role } from '@/core/domain/models';
import { zar } from '@/core/domain/money';
import { setClockForTesting } from '@/core/time/clock';
import { addDays, sastDate, startOfSastDay } from '@/core/time/sast';

const p = createMockProviders();
const NOW = sastDate(2026, 10, 5, 9, 40);

async function signInAs(persona: 'student' | 'staff' | 'parent' | 'alumni', role?: Role) {
  const { user } = await p.auth.signIn(persona);
  providerContext.set({ userId: user.id, role: role ?? user.roles[0]! });
  return user;
}

beforeEach(() => {
  resetMockState();
  setMockLatencyForTesting(0);
  setClockForTesting(NOW);
  connectivity.setOnline(true);
  providerContext.set({ userId: null, role: null });
});

afterAll(() => {
  setClockForTesting(null);
  setMockLatencyForTesting(null);
});

describe('mock adapters behave like a back end', () => {
  it('refuses data to someone who is not signed in', async () => {
    await expect(p.finance.getAccount()).rejects.toMatchObject({ kind: 'unauthorised' });
  });

  it('fails fast with `offline` when there is no connection', async () => {
    await signInAs('student');
    connectivity.setOnline(false);
    await expect(
      p.academic.getTimetable({ from: NOW.toISOString(), to: addDays(NOW, 1).toISOString() }),
    ).rejects.toMatchObject({ kind: 'offline' });
  });

  it('returns copies, so callers cannot change the back end by accident', async () => {
    await signInAs('student');
    const a = await p.finance.getAccount();
    a.balance.cents = 0;
    expect((await p.finance.getAccount()).balance.cents).toBe(425000);
  });

  it('gives today the pitch timetable', async () => {
    await signInAs('student');
    const today = await p.academic.getTimetable({
      from: startOfSastDay(NOW).toISOString(),
      to: addDays(startOfSastDay(NOW), 1).toISOString(),
    });
    expect(today.map((e) => e.moduleCode)).toEqual(['MKT301', 'MKT302', 'MKT304', 'MKT390']);
    expect(today[1]!.room.code).toBe('EB212');
  });

  it('keeps the statement consistent with the balance, and applies payments', async () => {
    await signInAs('student');
    const tx = await p.finance.getTransactions();
    const sum = tx.reduce((s, t) => s + t.amount.cents, 0);
    expect(sum).toBe((await p.finance.getAccount()).balance.cents);
    const intent = await p.finance.createPayment({
      amount: zar(1000),
      method: 'card',
      purpose: 'fees',
    });
    const receipt = await p.finance.confirmPayment(intent.id);
    expect(receipt.reference).toMatch(/^NMU-/);
    expect((await p.finance.getAccount()).balance).toEqual(zar(3250));
    // Confirming twice never charges twice.
    await p.finance.confirmPayment(intent.id);
    expect((await p.finance.getAccount()).balance).toEqual(zar(3250));
  });

  it('refuses a double booking of a study slot', async () => {
    await signInAs('student');
    const spaces = await p.library.getStudySpaces(startOfSastDay(NOW).toISOString());
    const slot = spaces[0]!.slots.find((s) => s.available)!;
    await p.library.bookStudySpace({ spaceId: spaces[0]!.id, start: slot.start, end: slot.end });
    await expect(
      p.library.bookStudySpace({ spaceId: spaces[0]!.id, start: slot.start, end: slot.end }),
    ).rejects.toMatchObject({ kind: 'conflict' });
    const after = await p.library.getStudySpaces(startOfSastDay(NOW).toISOString());
    expect(after[0]!.slots.find((s) => s.start === slot.start)!.available).toBe(false);
  });

  it('keeps each person’s bookings their own, while everyone’s count as taken', async () => {
    resetMockState(); // seed against the pinned clock
    await signInAs('student');
    const mine = await p.library.getBookings();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ spaceName: 'Silent Pod 1', status: 'confirmed' });
    expect(mine[0]!.start).toBe(sastDate(2026, 10, 7, 16).toISOString());
    expect(mine[0]).not.toHaveProperty('userId');

    await signInAs('staff');
    expect(await p.library.getBookings()).toEqual([]);
    const day = await p.library.getStudySpaces(sastDate(2026, 10, 7).toISOString());
    const pod = day.find((s) => s.id === 'sp1')!;
    expect(pod.slots.find((s) => s.start === mine[0]!.start)!.available).toBe(false);
    await expect(p.library.cancelBooking(mine[0]!.id)).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('matches each alumnus to mentoring that fits their own degree', async () => {
    await signInAs('staff', 'alumni');
    const [staffMatch] = await p.alumni.getMentoring();
    expect(staffMatch?.field).toBe('Research supervision');
    expect(staffMatch?.matchReason).toContain('MCom in Marketing');
    await signInAs('alumni');
    expect((await p.alumni.getMentoring())[0]?.field).toBe('Product management');
  });

  it('moves an order to ready and delivers the pickup notification', async () => {
    jest.useFakeTimers();
    try {
      const user = await signInAs('student');
      const received: AppNotification[] = [];
      const off = p.notifications.subscribe((n) => received.push(n));
      const intent = await p.finance.createPayment({
        amount: zar(62),
        method: 'campus-wallet',
        purpose: 'order',
      });
      await p.finance.confirmPayment(intent.id);
      const order = await p.commerce.placeOrder({
        vendorId: 'campus-kitchen',
        lines: [{ itemId: 'ck-bowl-chicken', quantity: 1 }],
        paymentId: intent.id,
      });
      expect(order.status).toBe('placed');
      jest.advanceTimersByTime(60_000);
      expect((await p.commerce.getOrder(order.id)).status).toBe('ready');
      expect(received.map((n) => n.title)).toContain('Your order is ready for pickup');
      expect((await p.notifications.list()).some((n) => n.id === `n-${order.id}-ready`)).toBe(true);
      expect(user.id).toBeTruthy();
      off();
    } finally {
      jest.useRealTimers();
    }
  });

  it('refuses an order whose payment did not cover the total', async () => {
    await signInAs('student');
    const intent = await p.finance.createPayment({
      amount: zar(10),
      method: 'card',
      purpose: 'order',
    });
    await p.finance.confirmPayment(intent.id);
    await expect(
      p.commerce.placeOrder({
        vendorId: 'campus-kitchen',
        lines: [{ itemId: 'ck-bowl-chicken', quantity: 1 }],
        paymentId: intent.id,
      }),
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it('issues one ticket per person and counts it against capacity', async () => {
    await signInAs('student');
    const before = await p.community.getEvent('spring-sounds');
    const t1 = await p.community.bookTicket('spring-sounds', null);
    const t2 = await p.community.bookTicket('spring-sounds', null);
    expect(t2.id).toBe(t1.id);
    expect((await p.community.getEvent('spring-sounds')).spotsLeft).toBe(before.spotsLeft - 1);
  });

  it('requires payment for a paid ticket', async () => {
    await signInAs('student');
    await expect(p.community.bookTicket('alumni-careers', null)).rejects.toMatchObject({
      kind: 'invalid',
    });
  });
});

describe('guardian sharing is the student’s decision', () => {
  it('hides fees from a parent until the student shares them, and filters updates at the source', async () => {
    await signInAs('student');
    const [g] = await p.guardian.getMyGuardians();
    await p.guardian.setGuardianSharing(g!.guardianId, ['key-dates']);

    const parent = await signInAs('parent');
    expect(parent.roles).toEqual(['parent']);
    const studentId = (await p.guardian.getProfile()).linkedStudents[0]!.studentId;
    await expect(p.guardian.getStudentAccount(studentId)).rejects.toMatchObject({
      kind: 'forbidden',
    });
    const updates = await p.guardian.getUpdates(studentId);
    expect(updates.every((u) => u.scope === 'key-dates')).toBe(true);

    await signInAs('student');
    await p.guardian.setGuardianSharing(g!.guardianId, ['key-dates', 'fees']);
    await signInAs('parent');
    expect((await p.guardian.getStudentAccount(studentId)).balance).toEqual(zar(4250));
  });

  it('never lets a parent change the sharing', async () => {
    await signInAs('parent');
    await expect(p.guardian.setGuardianSharing('u-demo-parent', ['results'])).rejects.toMatchObject(
      { kind: 'forbidden' },
    );
  });

  it('keeps student data from other roles', async () => {
    await signInAs('staff');
    await expect(p.finance.getAccount()).rejects.toMatchObject({ kind: 'forbidden' });
    await expect(p.academic.getResults()).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('Student → Alumni with one identity (brief §14)', () => {
  it('keeps the same user id and moves role and lifecycle', async () => {
    jest.useFakeTimers();
    try {
      const before = await signInAs('student');
      const after = await p.auth.transitionToAlumni(before.id);
      expect(after.id).toBe(before.id);
      expect(after.roles).toEqual(['alumni']);
      expect(after.lifecycle).toBe('alumni');
      providerContext.set({ userId: after.id, role: 'alumni' });
      expect((await p.alumni.getProfile()).graduationYear).toBe(2026);
      jest.advanceTimersByTime(10_000);
      const feed = await p.notifications.list();
      expect(feed.map((n) => n.id)).toEqual(
        expect.arrayContaining(['n-grad-welcome', 'n-grad-mentor']),
      );
      // The student-era inbox is archived.
      expect(feed.some((n) => n.id === 'n-nsfas')).toBe(false);
      await expect(p.auth.transitionToAlumni(before.id)).rejects.toMatchObject({
        kind: 'conflict',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('honours the active role for people with two', async () => {
    await signInAs('staff', 'alumni');
    expect((await p.alumni.getProfile()).qualification).toBe('MCom Marketing');
    providerContext.set({ userId: 'u-demo-staff', role: 'staff' });
    await expect(p.alumni.getProfile()).rejects.toMatchObject({ kind: 'forbidden' });
  });
});

describe('live adapters never fall back to demo data', () => {
  it('refuse to run without a configured BFF', async () => {
    const live = createLiveProviders();
    await expect(live.finance.getAccount()).rejects.toMatchObject({ kind: 'not-configured' });
    await expect(live.academic.getExams()).rejects.toMatchObject({ kind: 'not-configured' });
  });
});
