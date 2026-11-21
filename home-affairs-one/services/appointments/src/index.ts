/**
 * Mock appointments service: synthetic service points, slots and bookings.
 *
 * Stands in for branch, partner and mission calendars. Nothing here is a real
 * place or a real opening time, and no booking leaves the device.
 */
import {
  DEMO,
  type Appointment,
  type AppointmentSlot,
  type AppointmentsPort,
  type ServicePoint,
  type ServicePointFilter,
} from '@hao/api-contracts';
import { createCollection, DAY, HOUR, MINUTE, type Platform } from '@hao/local-platform';
import { GatewayError, type MutationOptions } from '@hao/shared-types';
import { SEED_SERVICE_POINTS } from './service-points';

export { SEED_SERVICE_POINTS } from './service-points';

/* ------------------------------ slots ------------------------------ */

const SAST_OFFSET_MS = 2 * HOUR;
/** Start times offered each working day, as [hour, minute]. */
const SLOT_TIMES: readonly (readonly [number, number])[] = [
  [9, 0],
  [9, 40],
  [10, 20],
  [11, 0],
  [13, 0],
  [13, 40],
];
const SLOT_LENGTH_MS = 40 * MINUTE;
const WORKING_DAYS_AHEAD = 5;

const SLOT_TAKEN_MESSAGE = 'That time has just been taken. Please choose another.';

/**
 * The instants at which the next `count` working days begin (00:00 SAST),
 * starting from tomorrow. Saturdays and Sundays are skipped; the prototype has
 * no public-holiday calendar.
 */
export function nextWorkingDays(now: Date, count: number): number[] {
  // Shift into SAST so the UTC getters read the South African calendar date.
  const shifted = new Date(now.getTime() + SAST_OFFSET_MS);
  const todayShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const days: number[] = [];
  for (let offset = 1; days.length < count; offset += 1) {
    const dayShifted = todayShifted + offset * DAY;
    const weekday = new Date(dayShifted).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(dayShifted - SAST_OFFSET_MS);
  }
  return days;
}

/** Small deterministic string hash (FNV-1a), used to mark some slots as already taken. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/* ----------------------------- service ----------------------------- */

function matchesFilter(point: ServicePoint, filter: ServicePointFilter): boolean {
  if (filter.kind !== undefined && point.kind !== filter.kind) return false;
  if (filter.serviceCode !== undefined && !point.services.includes(filter.serviceCode)) {
    return false;
  }
  if (filter.accessibility?.some((feature) => !point.accessibility.includes(feature))) {
    return false;
  }
  if (
    filter.openNow === true &&
    point.availability !== 'OPEN' &&
    point.availability !== 'LIMITED'
  ) {
    return false;
  }
  if (filter.abroad !== undefined && (point.kind === 'MISSION_ABROAD') !== filter.abroad) {
    return false;
  }
  const terms = words(filter.query ?? '');
  if (terms.length > 0) {
    const pointWords = words(`${point.name} ${point.area} ${point.region}`);
    // Every word typed must start a word in the name, area or region. A single
    // letter ("Province C") has to match a whole word, or it would match anything.
    const found = (term: string) =>
      pointWords.some((word) => (term.length === 1 ? word === term : word.startsWith(term)));
    if (!terms.every(found)) return false;
  }
  return true;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function createAppointmentsService(platform: Platform): AppointmentsPort {
  const servicePoints = createCollection<ServicePoint>(
    platform,
    'appointments.service-points',
    (point) => point.id,
  );
  const appointments = createCollection<Appointment>(
    platform,
    'appointments.appointments',
    (appointment) => appointment.appointmentId,
  );

  function seedAppointments(): Appointment[] {
    const mission = SEED_SERVICE_POINTS.find(
      (point) => point.id === DEMO.servicePoints.missionEurope,
    );
    const thirdWorkingDay = nextWorkingDays(platform.clock.now(), 3)[2];
    if (!mission || thirdWorkingDay === undefined) return [];
    const startsAt = thirdWorkingDay + 10 * HOUR + 20 * MINUTE;
    // The workflow mock records this booking on the case three days ago, less 15 minutes.
    const bookedAt = platform.clock.iso(
      new Date(platform.clock.now().getTime() - (3 * DAY - 15 * MINUTE)),
    );
    return [
      {
        appointmentId: DEMO.appointments.leratoMission,
        personToken: DEMO.persons.lerato,
        caseId: DEMO.cases.passportAbroadScheduled,
        draftId: null,
        servicePointId: mission.id,
        servicePointName: mission.name,
        purpose: 'Passport application — identity capture (sample)',
        startsAt: platform.clock.iso(new Date(startsAt)),
        endsAt: platform.clock.iso(new Date(startsAt + SLOT_LENGTH_MS)),
        timeZone: mission.timeZone,
        status: 'BOOKED',
        bookedAt,
        updatedAt: bookedAt,
      },
    ];
  }

  function ensureSeeded(): void {
    if (!servicePoints.exists()) servicePoints.replaceAll([...SEED_SERVICE_POINTS]);
    if (!appointments.exists()) appointments.replaceAll(seedAppointments());
  }

  function requireServicePoint(id: string): ServicePoint {
    ensureSeeded();
    const point = servicePoints.get(id);
    if (!point) {
      throw new GatewayError('NOT_FOUND', { safeMessage: 'We could not find that service point.' });
    }
    return point;
  }

  function requireAppointment(appointmentId: string): Appointment {
    ensureSeeded();
    const appointment = appointments.get(appointmentId);
    if (!appointment) {
      throw new GatewayError('NOT_FOUND', { safeMessage: 'We could not find that appointment.' });
    }
    return appointment;
  }

  /**
   * Synthetic slots for the next five working days.
   *
   * Simplification: slot times are generated as South African clock times and
   * recorded with the +02:00 offset for every point, including missions
   * abroad. A real calendar would generate them in each mission's own time
   * zone; here the mission's `timeZone` is carried for display only.
   */
  function slotsFor(point: ServicePoint): AppointmentSlot[] {
    const held = new Set(
      appointments
        .find((appointment) => appointment.servicePointId === point.id)
        .filter((appointment) => appointment.status === 'BOOKED')
        .map((appointment) => appointment.startsAt),
    );
    const slots: AppointmentSlot[] = [];
    for (const dayStart of nextWorkingDays(platform.clock.now(), WORKING_DAYS_AHEAD)) {
      for (const [hour, minute] of SLOT_TIMES) {
        const start = dayStart + hour * HOUR + minute * MINUTE;
        const startsAt = platform.clock.iso(new Date(start));
        const slotId = `${point.id}:${startsAt}`;
        slots.push({
          slotId,
          servicePointId: point.id,
          startsAt,
          endsAt: platform.clock.iso(new Date(start + SLOT_LENGTH_MS)),
          // Roughly one slot in five is shown as already taken, so the booking
          // screen always has both states to show.
          available: !held.has(startsAt) && hash(slotId) % 5 !== 0,
        });
      }
    }
    return slots;
  }

  function requireAvailableSlot(point: ServicePoint, slotId: string): AppointmentSlot {
    const slot = slotsFor(point).find((candidate) => candidate.slotId === slotId);
    if (!slot?.available) throw new GatewayError('CONFLICT', { safeMessage: SLOT_TAKEN_MESSAGE });
    return slot;
  }

  function nextAppointmentId(): string {
    let id = platform.ids.next('APPT-DEMO');
    while (appointments.get(id)) id = platform.ids.next('APPT-DEMO');
    return id;
  }

  return {
    async listServicePoints(filter = {}) {
      ensureSeeded();
      return servicePoints.find((point) => matchesFilter(point, filter));
    },

    async getServicePoint(id) {
      return requireServicePoint(id);
    },

    async listSlots(servicePointId) {
      return slotsFor(requireServicePoint(servicePointId));
    },

    async listAppointments(personToken) {
      ensureSeeded();
      return appointments
        .find((appointment) => appointment.personToken === personToken)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    },

    async getAppointment(appointmentId) {
      return requireAppointment(appointmentId);
    },

    async book(input, _options: MutationOptions) {
      const point = requireServicePoint(input.servicePointId);
      const purpose = input.purpose.trim();
      if (purpose.length === 0) {
        throw new GatewayError('VALIDATION', {
          safeMessage: 'Tell us what the appointment is for.',
        });
      }
      const slot = requireAvailableSlot(point, input.slotId);
      const now = platform.clock.iso();
      return appointments.put({
        appointmentId: nextAppointmentId(),
        personToken: input.personToken,
        caseId: input.caseId ?? null,
        draftId: input.draftId ?? null,
        servicePointId: point.id,
        servicePointName: point.name,
        purpose,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timeZone: point.timeZone,
        status: 'BOOKED',
        bookedAt: now,
        updatedAt: now,
      });
    },

    async reschedule(appointmentId, slotId, _options: MutationOptions) {
      const appointment = requireAppointment(appointmentId);
      if (appointment.status !== 'BOOKED') {
        throw new GatewayError('CONFLICT', {
          safeMessage: 'This appointment can no longer be changed. You can book a new one.',
        });
      }
      const point = requireServicePoint(appointment.servicePointId);
      if (slotId === `${point.id}:${appointment.startsAt}`) {
        throw new GatewayError('CONFLICT', {
          safeMessage: 'Your appointment is already at that time. Choose a different time.',
        });
      }
      const slot = requireAvailableSlot(point, slotId);
      return appointments.put({
        ...appointment,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        updatedAt: platform.clock.iso(),
      });
    },

    async cancel(appointmentId, _options: MutationOptions) {
      const appointment = requireAppointment(appointmentId);
      if (appointment.status !== 'BOOKED') {
        throw new GatewayError('CONFLICT', {
          safeMessage:
            appointment.status === 'CANCELLED'
              ? 'This appointment has already been cancelled.'
              : 'This appointment has already taken place, so it cannot be cancelled.',
        });
      }
      return appointments.put({
        ...appointment,
        status: 'CANCELLED',
        updatedAt: platform.clock.iso(),
      });
    },
  };
}
