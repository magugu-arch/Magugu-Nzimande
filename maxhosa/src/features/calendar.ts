import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import type { BrandEvent } from '@/domain/types';
import { toast } from '@/components/Toast';

/**
 * Add a fixture through the phone's own "new event" screen, pre-filled.
 *
 * SDK 57 moved the calendar module to an object API (`calendar.addEventWithForm`)
 * that first needs a calendar — and on Android, calendar permission to list
 * them. The system-provided form needs no permission at all on either
 * platform, so it comes from `expo-calendar/legacy`, where SDK 57 keeps it.
 * The customer sees and confirms the event before anything is saved.
 */
export async function addToCalendar(event: BrandEvent): Promise<void> {
  try {
    await createEventInCalendarAsync(
      {
        title: event.sample ? `${event.title} (sample event)` : event.title,
        startDate: new Date(event.startsAt),
        endDate: new Date(event.endsAt),
        timeZone: event.timeZone,
        location:
          event.city === 'Online'
            ? 'Online — link sent to confirmed guests'
            : `${event.city} — details shared with confirmed guests`,
        notes: event.sample ? `Sample event — not a real booking. ${event.summary}` : event.summary,
      },
      { startNewActivityTask: false },
    );
  } catch {
    toast({ message: 'Couldn’t open your calendar. Try again.', icon: 'calendar-outline' });
  }
}

/**
 * Every upcoming fixture at once. On a phone that is a calendar subscription
 * (webcal) served by the events service, which keeps itself up to date — not
 * available until that service exists.
 */
export async function addAllToCalendar(_events: BrandEvent[]): Promise<void> {
  toast({
    message: 'In the live app this subscribes your calendar to MAXHOSA’s fixtures.',
    icon: 'calendar-outline',
  });
}
