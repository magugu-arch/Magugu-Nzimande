import type { SessionKind, TimetableEntry } from '@/core/domain/models';
import { knownRooms } from '@/core/fixtures/campus';

/** The class a student should think about next: on now, or the next to start. */
export function nextClass(entries: TimetableEntry[], now: Date): TimetableEntry | null {
  return (
    entries
      .filter((e) => e.status !== 'cancelled' && new Date(e.end) > now)
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  );
}

export function isOnNow(e: TimetableEntry, now: Date): boolean {
  return new Date(e.start) <= now && new Date(e.end) > now;
}

export const KIND_LABEL: Record<SessionKind, string> = {
  lecture: 'Lecture',
  tutorial: 'Tutorial',
  practical: 'Practical',
  seminar: 'Seminar',
  consultation: 'Consultation',
};

/** "Business & Economics Building, level 2" — from the building register. */
export function roomDescription(code: string, buildingName?: string, floor?: number): string {
  const level = floor === undefined ? '' : floor === 0 ? 'ground floor' : `level ${floor}`;
  return [buildingName, level].filter(Boolean).join(', ') || knownRooms[code] || code;
}
