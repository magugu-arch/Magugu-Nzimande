import {
  AppointmentSchema,
  AppointmentSlotSchema,
  DEMO,
  ServicePointSchema,
  type AccessFeature,
  type ServicePointKind,
} from '@hao/api-contracts';
import { createLocalPlatform, HOUR, MINUTE } from '@hao/local-platform';
import { describe, expect, it } from 'vitest';
import { createAppointmentsService, nextWorkingDays, SEED_SERVICE_POINTS } from './index';

/** A Saturday, 10:00 in South Africa. */
const START = new Date('2026-11-21T08:00:00Z');
const key = (name: string) => ({ idempotencyKey: `test-${name}` });

function setup(now: Date = START) {
  const platform = createLocalPlatform({ now: () => now });
  return { platform, appointments: createAppointmentsService(platform) };
}

const P = DEMO.servicePoints;
const S = DEMO.services;

describe('appointments: service points', () => {
  it('seeds ten synthetic service points that match the contract and the shared ids', async () => {
    const { appointments } = setup();
    const points = await appointments.listServicePoints();
    for (const point of points) ServicePointSchema.parse(point);
    expect(points.map((point) => point.id)).toEqual(Object.values(P));
    expect(points).toEqual(SEED_SERVICE_POINTS);
  });

  it('gives each point the kind, photograph and time zone its shared id implies', async () => {
    const { appointments } = setup();
    const byId = new Map((await appointments.listServicePoints()).map((p) => [p.id, p]));
    const expected: [string, ServicePointKind, string, string][] = [
      [P.officeCentral, 'SERVICE_OFFICE', 'A02', 'Africa/Johannesburg'],
      [P.officeNorth, 'SERVICE_OFFICE', 'A46', 'Africa/Johannesburg'],
      [P.officeCoast, 'SERVICE_OFFICE', 'A38', 'Africa/Johannesburg'],
      [P.bankCentral, 'PARTNER_BANK', 'A41', 'Africa/Johannesburg'],
      [P.bankEast, 'PARTNER_BANK', 'A41', 'Africa/Johannesburg'],
      [P.mobileRural, 'MOBILE_UNIT', 'A39', 'Africa/Johannesburg'],
      [P.mobileValley, 'MOBILE_UNIT', 'A39', 'Africa/Johannesburg'],
      [P.kioskMall, 'KIOSK', 'A44', 'Africa/Johannesburg'],
      [P.missionEurope, 'MISSION_ABROAD', 'A26', 'Europe/London'],
      [P.missionAsiaPacific, 'MISSION_ABROAD', 'A26', 'Asia/Singapore'],
    ];
    for (const [id, kind, assetId, timeZone] of expected) {
      expect(byId.get(id)).toMatchObject({ kind, assetId, timeZone });
    }
    for (const point of byId.values()) {
      const abroad = point.kind === 'MISSION_ABROAD';
      expect(point.country === 'South Africa').toBe(!abroad);
    }
  });

  it('uses obviously fictional names and only known service codes', async () => {
    const { appointments } = setup();
    const codes = new Set<string>(Object.values(S));
    for (const point of await appointments.listServicePoints()) {
      expect(point.name).toMatch(/^Sample /);
      expect(point.availabilityNote.length).toBeGreaterThan(0);
      for (const code of point.services) expect(codes.has(code)).toBe(true);
      expect(new Set(point.services).size).toBe(point.services.length);
    }
    expect(new Set(SEED_SERVICE_POINTS.map((point) => point.name)).size).toBe(10);
  });

  it('spreads accessibility features so every filter has something to show', async () => {
    const { appointments } = setup();
    const points = await appointments.listServicePoints();
    const count = (feature: AccessFeature) =>
      points.filter((point) => point.accessibility.includes(feature)).length;
    expect(count('STEP_FREE')).toBeGreaterThanOrEqual(4);
    for (const feature of [
      'HEARING_LOOP',
      'SIGN_LANGUAGE_BY_BOOKING',
      'QUIET_HOUR',
      'ASSISTED_DIGITAL',
      'ACCESSIBLE_PARKING',
    ] as const) {
      expect(count(feature)).toBeGreaterThanOrEqual(1);
    }
    expect(points.some((point) => point.accessibility.length <= 1)).toBe(true);
    expect(new Set(points.map((point) => point.availability))).toEqual(
      new Set(['OPEN', 'LIMITED', 'CLOSED_TODAY', 'NOT_REPORTED']),
    );
  });

  it('filters by kind', async () => {
    const { appointments } = setup();
    const banks = await appointments.listServicePoints({ kind: 'PARTNER_BANK' });
    expect(banks.map((point) => point.id)).toEqual([P.bankCentral, P.bankEast]);
  });

  it('filters by service, and the kiosk offers no capture service', async () => {
    const { appointments } = setup();
    const birth = await appointments.listServicePoints({ serviceCode: S.birthRegistration });
    expect(birth.map((point) => point.id)).toEqual([
      P.officeCentral,
      P.officeNorth,
      P.officeCoast,
      P.mobileRural,
      P.mobileValley,
      P.missionEurope,
      P.missionAsiaPacific,
    ]);
    const kiosk = await appointments.getServicePoint(P.kioskMall);
    expect(kiosk.capabilities).toContain('SELF_SERVICE');
    for (const code of [
      S.smartIdReplacement,
      S.smartIdFirst,
      S.adultPassport,
      S.birthRegistration,
    ]) {
      expect(kiosk.services).not.toContain(code);
    }
  });

  it('keeps only points that have every requested accessibility feature', async () => {
    const { appointments } = setup();
    const both = await appointments.listServicePoints({
      accessibility: ['HEARING_LOOP', 'SIGN_LANGUAGE_BY_BOOKING'],
    });
    expect(both.map((point) => point.id)).toEqual([P.officeCentral, P.missionEurope]);
    const none = await appointments.listServicePoints({ accessibility: [] });
    expect(none).toHaveLength(10);
  });

  it('keeps only points reporting open or limited service when asked', async () => {
    const { appointments } = setup();
    const open = await appointments.listServicePoints({ openNow: true });
    expect(open.every((point) => ['OPEN', 'LIMITED'].includes(point.availability))).toBe(true);
    expect(open.map((point) => point.id)).not.toContain(P.bankEast);
    expect(open.map((point) => point.id)).not.toContain(P.mobileValley);
    expect(await appointments.listServicePoints({ openNow: false })).toHaveLength(10);
  });

  it('matches free text against name, area and region, ignoring case', async () => {
    const { appointments } = setup();
    const ridge = await appointments.listServicePoints({ query: 'example RIDGE' });
    expect(ridge.map((point) => point.id)).toEqual([P.mobileRural]);
    const provinceC = await appointments.listServicePoints({ query: 'province c' });
    expect(provinceC.map((point) => point.id)).toEqual([P.officeCoast, P.mobileValley]);
    expect(await appointments.listServicePoints({ query: '   ' })).toHaveLength(10);
    expect(await appointments.listServicePoints({ query: 'nowhere' })).toEqual([]);
  });

  it('separates missions abroad from domestic points', async () => {
    const { appointments } = setup();
    const abroad = await appointments.listServicePoints({ abroad: true });
    expect(abroad.map((point) => point.id)).toEqual([P.missionEurope, P.missionAsiaPacific]);
    const domestic = await appointments.listServicePoints({ abroad: false });
    expect(domestic).toHaveLength(8);
    expect(domestic.some((point) => point.kind === 'MISSION_ABROAD')).toBe(false);
    expect(await appointments.listServicePoints({})).toHaveLength(10);
  });

  it('combines filters with AND', async () => {
    const { appointments } = setup();
    const result = await appointments.listServicePoints({
      serviceCode: S.adultPassport,
      accessibility: ['STEP_FREE'],
      openNow: true,
      abroad: false,
      query: 'demo central',
    });
    expect(result.map((point) => point.id)).toEqual([P.officeCentral, P.bankCentral]);
  });

  it('throws NOT_FOUND for an unknown service point', async () => {
    const { appointments } = setup();
    await expect(appointments.getServicePoint('SP-DEMO-9999')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
    await expect(appointments.listSlots('SP-DEMO-9999')).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
  });
});

describe('appointments: slots', () => {
  it('skips the weekend when counting working days', () => {
    const days = nextWorkingDays(START, 5).map((day) => new Date(day).toISOString());
    expect(days).toEqual([
      '2026-11-22T22:00:00.000Z', // Monday 23 November, 00:00 SAST
      '2026-11-23T22:00:00.000Z',
      '2026-11-24T22:00:00.000Z',
      '2026-11-25T22:00:00.000Z',
      '2026-11-26T22:00:00.000Z',
    ]);
    // Late on a Thursday evening in South Africa: Friday, then Monday.
    const thursdayNight = new Date('2026-11-26T21:30:00Z');
    expect(nextWorkingDays(thursdayNight, 2).map((day) => new Date(day).toISOString())).toEqual([
      '2026-11-26T22:00:00.000Z',
      '2026-11-29T22:00:00.000Z',
    ]);
  });

  it('offers six 40-minute slots on each of the next five working days', async () => {
    const { appointments } = setup();
    const slots = await appointments.listSlots(P.officeCentral);
    for (const slot of slots) AppointmentSlotSchema.parse(slot);
    expect(slots).toHaveLength(30);
    expect(slots.slice(0, 6).map((slot) => slot.startsAt)).toEqual([
      '2026-11-23T09:00:00+02:00',
      '2026-11-23T09:40:00+02:00',
      '2026-11-23T10:20:00+02:00',
      '2026-11-23T11:00:00+02:00',
      '2026-11-23T13:00:00+02:00',
      '2026-11-23T13:40:00+02:00',
    ]);
    expect(slots.at(-1)?.startsAt).toBe('2026-11-27T13:40:00+02:00');
    for (const slot of slots) {
      expect(slot.slotId).toBe(`${P.officeCentral}:${slot.startsAt}`);
      expect(Date.parse(slot.endsAt) - Date.parse(slot.startsAt)).toBe(40 * MINUTE);
      expect([1, 2, 3, 4, 5]).toContain(new Date(Date.parse(slot.startsAt) + 2 * HOUR).getUTCDay());
    }
  });

  it('is deterministic and shows a mix of free and taken slots at every point', async () => {
    const first = setup().appointments;
    const second = setup().appointments;
    let taken = 0;
    for (const id of Object.values(P)) {
      const slots = await first.listSlots(id);
      expect(await second.listSlots(id)).toEqual(slots);
      const free = slots.filter((slot) => slot.available).length;
      expect(free).toBeGreaterThanOrEqual(15);
      taken += slots.length - free;
    }
    // About one in five of the 300 slots is marked as taken.
    expect(taken).toBeGreaterThan(30);
    expect(taken).toBeLessThan(100);
  });
});

describe('appointments: bookings', () => {
  it('seeds Lerato’s mission appointment on a real slot, three working days ahead', async () => {
    const { appointments } = setup();
    const seeded = await appointments.getAppointment(DEMO.appointments.leratoMission);
    AppointmentSchema.parse(seeded);
    expect(seeded).toMatchObject({
      personToken: DEMO.persons.lerato,
      caseId: DEMO.cases.passportAbroadScheduled,
      servicePointId: P.missionEurope,
      servicePointName: 'Sample mission — Europe West',
      purpose: 'Passport application — identity capture (sample)',
      startsAt: '2026-11-25T10:20:00+02:00',
      endsAt: '2026-11-25T11:00:00+02:00',
      timeZone: 'Europe/London',
      status: 'BOOKED',
    });
    expect(await appointments.listAppointments(DEMO.persons.lerato)).toEqual([seeded]);
    expect(await appointments.listAppointments(DEMO.persons.thandi)).toEqual([]);

    const slots = await appointments.listSlots(P.missionEurope);
    const held = slots.find((slot) => slot.startsAt === seeded.startsAt);
    expect(held).toMatchObject({ available: false });
  });

  it('books an available slot and then shows it as taken', async () => {
    const { appointments } = setup();
    const slot = (await appointments.listSlots(P.bankCentral)).find((s) => s.available);
    if (!slot) throw new Error('expected an available slot');

    const booked = await appointments.book(
      {
        personToken: DEMO.persons.thandi,
        servicePointId: P.bankCentral,
        slotId: slot.slotId,
        purpose: 'Smart ID replacement — identity capture (sample)',
        caseId: DEMO.cases.smartIdActionRequired,
      },
      key('book'),
    );
    AppointmentSchema.parse(booked);
    expect(booked).toMatchObject({
      // The seeded appointment already uses 1001.
      appointmentId: 'APPT-DEMO-1002',
      personToken: DEMO.persons.thandi,
      caseId: DEMO.cases.smartIdActionRequired,
      draftId: null,
      servicePointId: P.bankCentral,
      servicePointName: 'Sample partner bank point — Demo Central',
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      timeZone: 'Africa/Johannesburg',
      status: 'BOOKED',
      bookedAt: '2026-11-21T10:00:00+02:00',
    });

    const after = await appointments.listSlots(P.bankCentral);
    expect(after.find((s) => s.slotId === slot.slotId)?.available).toBe(false);
    expect(await appointments.listAppointments(DEMO.persons.thandi)).toEqual([booked]);
  });

  it('refuses a slot that is taken, unknown or at another point', async () => {
    const { appointments } = setup();
    const slots = await appointments.listSlots(P.officeCentral);
    const free = slots.find((slot) => slot.available);
    const taken = slots.find((slot) => !slot.available);
    if (!free || !taken) throw new Error('expected both free and taken slots');
    const input = {
      personToken: DEMO.persons.thandi,
      servicePointId: P.officeCentral,
      purpose: 'Identity capture (sample)',
    };

    await expect(
      appointments.book({ ...input, slotId: taken.slotId }, key('taken')),
    ).rejects.toMatchObject({
      category: 'CONFLICT',
      safeMessage: 'That time has just been taken. Please choose another.',
    });
    await expect(
      appointments.book({ ...input, slotId: 'not-a-slot' }, key('unknown')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });

    await appointments.book({ ...input, slotId: free.slotId }, key('first'));
    await expect(
      appointments.book(
        { ...input, personToken: DEMO.persons.sipho, slotId: free.slotId },
        key('second'),
      ),
    ).rejects.toMatchObject({ category: 'CONFLICT' });

    await expect(
      appointments.book(
        { ...input, servicePointId: 'SP-DEMO-9999', slotId: free.slotId },
        key('p'),
      ),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
    await expect(
      appointments.book({ ...input, purpose: ' ', slotId: free.slotId }, key('v')),
    ).rejects.toMatchObject({ category: 'VALIDATION' });
  });

  it('reschedules to another free slot at the same point', async () => {
    const { appointments } = setup();
    const seeded = await appointments.getAppointment(DEMO.appointments.leratoMission);
    const oldSlotId = `${P.missionEurope}:${seeded.startsAt}`;
    const target = (await appointments.listSlots(P.missionEurope)).find((slot) => slot.available);
    if (!target) throw new Error('expected an available slot');

    const moved = await appointments.reschedule(seeded.appointmentId, target.slotId, key('move'));
    AppointmentSchema.parse(moved);
    expect(moved).toMatchObject({
      appointmentId: seeded.appointmentId,
      servicePointId: P.missionEurope,
      startsAt: target.startsAt,
      endsAt: target.endsAt,
      status: 'BOOKED',
      bookedAt: seeded.bookedAt,
      updatedAt: '2026-11-21T10:00:00+02:00',
    });

    const slots = await appointments.listSlots(P.missionEurope);
    expect(slots.find((slot) => slot.slotId === target.slotId)?.available).toBe(false);
    expect(slots.some((slot) => slot.slotId === oldSlotId)).toBe(true);

    // Moving to the time it already has is refused rather than silently accepted.
    await expect(
      appointments.reschedule(seeded.appointmentId, target.slotId, key('same')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
  });

  it('refuses to reschedule to a taken slot or a slot at another point', async () => {
    const { appointments } = setup();
    const taken = (await appointments.listSlots(P.missionEurope)).find((slot) => !slot.available);
    const elsewhere = (await appointments.listSlots(P.officeCentral)).find((s) => s.available);
    if (!taken || !elsewhere) throw new Error('expected slots');
    await expect(
      appointments.reschedule(DEMO.appointments.leratoMission, taken.slotId, key('a')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
    await expect(
      appointments.reschedule(DEMO.appointments.leratoMission, elsewhere.slotId, key('b')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
    await expect(
      appointments.reschedule('APPT-DEMO-9999', elsewhere.slotId, key('c')),
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });
  });

  it('cancels once, frees the slot, and refuses to cancel or reschedule afterwards', async () => {
    const { appointments } = setup();
    const slot = (await appointments.listSlots(P.officeNorth)).find((s) => s.available);
    if (!slot) throw new Error('expected an available slot');
    const booked = await appointments.book(
      {
        personToken: DEMO.persons.sipho,
        servicePointId: P.officeNorth,
        slotId: slot.slotId,
        purpose: 'Identity capture (sample)',
        draftId: DEMO.drafts.siphoPassport,
      },
      key('book'),
    );
    expect(booked.draftId).toBe(DEMO.drafts.siphoPassport);

    const cancelled = await appointments.cancel(booked.appointmentId, key('cancel'));
    AppointmentSchema.parse(cancelled);
    expect(cancelled.status).toBe('CANCELLED');
    expect((await appointments.getAppointment(booked.appointmentId)).status).toBe('CANCELLED');

    const slots = await appointments.listSlots(P.officeNorth);
    expect(slots.find((s) => s.slotId === slot.slotId)?.available).toBe(true);

    await expect(appointments.cancel(booked.appointmentId, key('again'))).rejects.toMatchObject({
      category: 'CONFLICT',
    });
    await expect(
      appointments.reschedule(booked.appointmentId, slot.slotId, key('move')),
    ).rejects.toMatchObject({ category: 'CONFLICT' });
    await expect(appointments.cancel('APPT-DEMO-9999', key('missing'))).rejects.toMatchObject({
      category: 'NOT_FOUND',
    });
  });

  it('keeps bookings for the next service instance on the same device', async () => {
    const { appointments, platform } = setup();
    const slot = (await appointments.listSlots(P.officeCoast)).find((s) => s.available);
    if (!slot) throw new Error('expected an available slot');
    const booked = await appointments.book(
      {
        personToken: DEMO.persons.thandi,
        servicePointId: P.officeCoast,
        slotId: slot.slotId,
        purpose: 'Identity capture (sample)',
      },
      key('book'),
    );
    const reopened = createAppointmentsService(platform);
    expect(await reopened.getAppointment(booked.appointmentId)).toEqual(booked);
  });
});
