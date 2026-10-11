import { buildIcs } from '@/domain/events';
import type { BrandEvent } from '@/domain/types';
import { toast } from '@/components/Toast';

/** On the web there is no system calendar form: hand the browser an .ics file to open. */
function download(events: BrandEvent[], filename: string) {
  const blob = new Blob([buildIcs(events, new Date())], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast({
    message:
      events.length === 1
        ? 'Calendar file saved — open it to add the event'
        : `${events.length} fixtures saved to a calendar file`,
    icon: 'calendar-outline',
  });
}

export async function addToCalendar(event: BrandEvent): Promise<void> {
  download([event], `${event.id}.ics`);
}

export async function addAllToCalendar(events: BrandEvent[]): Promise<void> {
  download(events, 'maxhosa-fixtures.ics');
}
