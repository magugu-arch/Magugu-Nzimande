import { notConfigured } from '../../shared/errors';
import type { ReservationProvider, ReservationSlot } from '../types';

/**
 * Dineplan — Mábu's current public booking channel
 * (https://www.dineplan.com/restaurant/mabu-restaurant).
 *
 * No Dineplan API contract, credentials or webhook schema has been supplied,
 * and the brief (§15, §28) forbids inventing one. Every method therefore
 * answers NOT_CONFIGURED, which the app turns into the Call / Email / Book
 * request fallback. When Mábu supplies the integration documentation,
 * implement these four methods; nothing in the service or UI changes.
 */
export class DineplanReservationAdapter implements ReservationProvider {
  readonly id = 'dineplan' as const;

  async search(): Promise<ReservationSlot[]> {
    throw notConfigured(this.id);
  }

  async create(): Promise<{ externalReservationId: string; status: 'confirmed' | 'requested' }> {
    throw notConfigured(this.id);
  }

  async reschedule(): Promise<void> {
    throw notConfigured(this.id);
  }

  async cancel(): Promise<void> {
    throw notConfigured(this.id);
  }
}
