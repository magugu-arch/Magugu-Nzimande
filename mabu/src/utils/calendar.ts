import { Linking, Platform } from 'react-native';

export interface CalendarEntry {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes?: string;
}

function compact(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function googleCalendarUrl(e: CalendarEntry): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(e.startsAt)}/${compact(e.endsAt)}`,
    location: e.location,
    details: e.notes ?? '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function icsFile(e: CalendarEntry, uid: string): string {
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mabu Restaurant//App//EN',
    'BEGIN:VEVENT',
    `UID:${uid}@maburestaurant.com`,
    `DTSTAMP:${compact(new Date().toISOString())}`,
    `DTSTART:${compact(e.startsAt)}`,
    `DTEND:${compact(e.endsAt)}`,
    `SUMMARY:${esc(e.title)}`,
    `LOCATION:${esc(e.location)}`,
    `DESCRIPTION:${esc(e.notes ?? '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Adds a booking to the guest's calendar through the OS's own add-event
 * form, so the guest sees and confirms it.
 *
 * SDK 57: `createEventInCalendarAsync` now throws at runtime. iOS uses the
 * default calendar's `addEventWithForm()` under write-only access (iOS 17+);
 * Android keeps the intent-based dialog, which Expo moved to
 * `expo-calendar/legacy`. The web, and anything that fails, falls back to a
 * Google Calendar link.
 */
export async function addToCalendar(
  entry: CalendarEntry,
): Promise<'added' | 'opened-link' | 'cancelled'> {
  if (Platform.OS === 'ios') {
    try {
      const Calendar = await import('expo-calendar');
      const permission = await Calendar.requestCalendarPermissions(true);
      if (permission.granted) {
        const result = await Calendar.getDefaultCalendarSync().addEventWithForm({
          title: entry.title,
          startDate: new Date(entry.startsAt),
          endDate: new Date(entry.endsAt),
          location: entry.location,
          notes: entry.notes,
        });
        return result.action === 'canceled' ? 'cancelled' : 'added';
      }
    } catch {
      // fall through to the link
    }
  } else if (Platform.OS === 'android') {
    try {
      const Legacy = await import('expo-calendar/legacy');
      const result = await Legacy.createEventInCalendarAsync({
        title: entry.title,
        startDate: new Date(entry.startsAt),
        endDate: new Date(entry.endsAt),
        location: entry.location,
        notes: entry.notes,
      });
      return result.action === 'canceled' ? 'cancelled' : 'added';
    } catch {
      // fall through to the link
    }
  }
  await Linking.openURL(googleCalendarUrl(entry));
  return 'opened-link';
}
