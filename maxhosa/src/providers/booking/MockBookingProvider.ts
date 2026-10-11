import catalogue from '@data/sample-catalogue.json';
import type { Appointment, AppointmentType, AvailableSlot } from '@/domain/types';
import type { AppointmentRequest, BookingProvider } from './BookingProvider';

/**
 * Sample availability for the concept build. Times are invented, Sundays and
 * one day a fortnight are closed, and some slots are taken — deterministically,
 * so a demo looks the same twice. A requested slot is held, so a second
 * request for it fails the way a real capacity check would.
 */

const TIMES = ['10:00', '11:30', '13:00', '14:30', '16:00'];

function hash(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 97;
  return n;
}

export class MockBookingProvider implements BookingProvider {
  readonly id = 'mock';
  readonly isMock = true;
  readonly timeZone = 'Africa/Johannesburg';
  private held = new Set<string>();
  private byKey = new Map<string, Appointment>();

  async listTypes(): Promise<AppointmentType[]> {
    return catalogue.appointmentTypes.map((t) => ({
      ...t,
      format: t.format as AppointmentType['format'],
    }));
  }

  async listSlots(typeId: string, fromDate: Date, days: number): Promise<AvailableSlot[]> {
    const slots: AvailableSlot[] = [];
    for (let i = 1; i <= days; i++) {
      const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const closed = d.getDay() === 0 || i === 6;
      for (const time of TIMES) {
        const id = `${typeId}:${iso}T${time}`;
        slots.push({
          id,
          // SAST is UTC+2 all year.
          startsAt: `${iso}T${time}:00+02:00`,
          timeZone: this.timeZone,
          available: !closed && hash(iso + time) % 4 !== 0 && !this.held.has(id),
        });
      }
    }
    return slots;
  }

  async requestAppointment(
    request: AppointmentRequest,
    idempotencyKey: string,
  ): Promise<Appointment> {
    const existing = this.byKey.get(idempotencyKey);
    if (existing) return existing;
    if (this.held.has(request.slotId))
      throw new Error('That time has just been taken. Please choose another.');
    this.held.add(request.slotId);
    const appointment: Appointment = {
      reference: `DEMO-APT-${String(1000 + ((hash(idempotencyKey) * 89) % 9000))}`,
      typeId: request.typeId,
      status: 'requested',
      slot: {
        id: request.slotId,
        startsAt: request.slotId.split(':').slice(1).join(':') + ':00+02:00',
        timeZone: this.timeZone,
        available: false,
      },
      createdAt: new Date().toISOString(),
    };
    this.byKey.set(idempotencyKey, appointment);
    return appointment;
  }
}
