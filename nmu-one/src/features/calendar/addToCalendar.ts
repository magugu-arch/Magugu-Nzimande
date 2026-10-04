import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

/**
 * Device calendar integration (brief §7, §12). On a phone this writes to the
 * person's default calendar after asking permission; on the web it downloads
 * an .ics file the browser hands to the calendar app.
 */
export interface CalendarItem {
  title: string;
  start: string;
  end: string;
  location: string;
  notes?: string;
}

export type CalendarResult = 'added' | 'downloaded' | 'denied' | 'failed';

function ics(item: CalendarItem): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NMU ONE//EN',
    'BEGIN:VEVENT',
    `UID:${stamp(item.start)}-${Math.random().toString(36).slice(2)}@nmu-one`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(item.start)}`,
    `DTEND:${stamp(item.end)}`,
    `SUMMARY:${esc(item.title)}`,
    `LOCATION:${esc(item.location)}`,
    item.notes ? `DESCRIPTION:${esc(item.notes)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

export async function addToCalendar(item: CalendarItem): Promise<CalendarResult> {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([ics(item)], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return 'downloaded';
    } catch {
      return 'failed';
    }
  }
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') return 'denied';
    const calendar =
      Platform.OS === 'ios'
        ? await Calendar.getDefaultCalendarAsync()
        : (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)).find((c) => c.allowsModifications);
    if (!calendar) return 'failed';
    await Calendar.createEventAsync(calendar.id, {
      title: item.title,
      startDate: new Date(item.start),
      endDate: new Date(item.end),
      location: item.location,
      notes: item.notes,
    });
    return 'added';
  } catch {
    return 'failed';
  }
}

export const calendarMessage: Record<CalendarResult, string> = {
  added: 'Added to your calendar',
  downloaded: 'Calendar file downloaded — open it to add the event',
  denied: 'NMU ONE needs calendar access to add this. You can allow it in Settings.',
  failed: 'Couldn’t add this to your calendar',
};
