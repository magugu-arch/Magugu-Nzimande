import type { ReservationRecord, ReservationStatus } from './types';

/** Statuses that hold a table. 'rescheduled' is a confirmed booking at a new time. */
export const ACTIVE_STATUSES: ReservationStatus[] = ['requested', 'confirmed', 'rescheduled'];

export function isActive(r: Pick<ReservationRecord, 'status'>): boolean {
  return ACTIVE_STATUSES.includes(r.status);
}

export function isUpcoming(r: Pick<ReservationRecord, 'status' | 'startsAt'>, now: Date): boolean {
  return isActive(r) && new Date(r.startsAt).getTime() > now.getTime() - 3 * 60 * 60 * 1000;
}

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  waitlisted: 'Waitlisted',
  rescheduled: 'Confirmed',
  cancelled: 'Cancelled',
  completed: 'Visited',
  'no-show': 'Missed',
  failed: 'Not completed',
};
