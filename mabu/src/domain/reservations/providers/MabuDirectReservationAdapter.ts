import type { ServiceContext } from '../../context';
import { notConfigured } from '../../shared/errors';
import type { BookingPolicy } from '../policy';
import { candidateTimes, parseSlotId, slotIdOf } from '../slots';
import type {
  AvailabilityQuery,
  ReservationCreateRequest,
  ReservationProvider,
  ReservationSlot,
} from '../types';
import { ACTIVE_STATUSES } from '../status';

/**
 * Mábu's own booking inventory.
 *
 * Mábu runs no first-party booking system today (the public site hands off to
 * Dineplan), so in `mock` mode this adapter *is* the inventory: pacing is
 * `coversPerSlot` guests starting per seating, minus the bookings in the
 * database, minus a deterministic fixture standing in for bookings taken on
 * other channels (phone, walk-in, Dineplan). The fixture keeps Friday and
 * Saturday prime time genuinely full so the waitlist and "no availability"
 * paths are reachable in a demo and in tests.
 *
 * In `live` mode it must call Mábu's reservation back end, which does not
 * exist yet — so it refuses with NOT_CONFIGURED rather than inventing one.
 */
export class MabuDirectReservationAdapter implements ReservationProvider {
  readonly id = 'mabu-direct' as const;

  constructor(
    private readonly ctx: ServiceContext,
    private readonly policy: () => BookingPolicy,
    private readonly mode: 'mock' | 'live',
  ) {}

  async search(query: AvailabilityQuery): Promise<ReservationSlot[]> {
    if (this.mode === 'live') throw notConfigured(this.id);
    const policy = this.policy();
    const leadCutoff = this.ctx.clock.now().getTime() + policy.leadTimeMinutes * 60_000;
    return candidateTimes(policy, query.date, query.partySize, query.servicePeriod)
      .filter((c) => new Date(c.startsAt).getTime() >= leadCutoff)
      .map((c) => {
        const taken =
          this.coversTaken(query.date, c.time) + otherChannelDemand(policy, query.date, c.time);
        const available = taken + query.partySize <= policy.coversPerSlot;
        return {
          slotId: slotIdOf(query.venueId, query.date, c.time),
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          available,
          provider: this.id,
          servicePeriod: c.servicePeriod,
          seatingAreas: available ? policy.seatingAreas.map((a) => a.id) : [],
        };
      });
  }

  async create(
    request: ReservationCreateRequest,
    slot: ReservationSlot,
  ): Promise<{ externalReservationId: string; status: 'confirmed' | 'requested' }> {
    if (this.mode === 'live') throw notConfigured(this.id);
    void request;
    return {
      externalReservationId: `md_${slot.slotId.replace(/\W/g, '')}_${this.ctx.ids.code(6)}`,
      status: 'confirmed',
    };
  }

  async reschedule(): Promise<void> {
    if (this.mode === 'live') throw notConfigured(this.id);
  }

  async cancel(): Promise<void> {
    if (this.mode === 'live') throw notConfigured(this.id);
  }

  private coversTaken(date: string, time: string): number {
    let covers = 0;
    for (const r of this.ctx.db.reservations.list()) {
      if (!ACTIVE_STATUSES.includes(r.status)) continue;
      const slot = parseSlotId(r.slotId);
      if (slot.date === date && slot.time === time) covers += r.partySize;
    }
    return covers;
  }
}

/**
 * Mock fixture: covers already committed through other channels. Pure and
 * deterministic in (date, time) so tests can rely on it. Friday and Saturday
 * 19:00–20:00 are fully committed; everything else carries a light, varying
 * load.
 */
export function otherChannelDemand(policy: BookingPolicy, date: string, time: string): number {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const prime = (weekday === 5 || weekday === 6) && time >= '19:00' && time <= '20:00';
  if (prime) return policy.coversPerSlot;
  let hash = 0;
  for (const ch of `${date}${time}`) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.floor(((hash % 1000) / 1000) * policy.coversPerSlot * 0.6);
}
