import { absoluteUrl, site } from '@/content/site';
import { ticketFor } from '@/lib/data/bookings';
import { hmToMinutes, minutesToHm } from '@/lib/time';

/** An .ics file for the booking: works with Apple Calendar, Google Calendar and Outlook. */
export async function GET(request: Request, ctx: RouteContext<'/api/ics/[ref]'>) {
  const { ref } = await ctx.params;
  const token = new URL(request.url).searchParams.get('t') ?? '';
  const d = await ticketFor(ref, token);
  const visitDate = d?.booking.visitDate;
  if (!d || !visitDate) return new Response('Not found', { status: 404 });
  const b = d.booking;
  const times = d.items
    .filter((i) => i.slotTime)
    .map((i) => i.slotTime!)
    .sort();
  const start = times[0] ?? '10:00';
  const end = minutesToHm(hmToMinutes(times.at(-1) ?? start) + 60);
  const stamp = (date: string, hm: string) => `${date.replace(/-/g, '')}T${hm.replace(':', '')}00`;
  const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  const summary = (b.meta as { summary?: string }).summary ?? 'Soweto Towers';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Soweto Towers//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Africa/Johannesburg',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0200',
    'TZNAME:SAST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${b.ref}@${new URL(site.url).hostname}`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')}`,
    `DTSTART;TZID=Africa/Johannesburg:${stamp(visitDate, start)}`,
    `DTEND;TZID=Africa/Johannesburg:${stamp(visitDate, end)}`,
    `SUMMARY:${esc(`${summary} · Soweto Towers`)}`,
    `DESCRIPTION:${esc(`Booking ${b.ref}. Arrive 20 minutes early. Ticket: ${absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`)}`)}`,
    `LOCATION:${esc(`Soweto Towers, ${site.address.street}, ${site.address.suburb}, ${site.address.city}`)}`,
    `GEO:${site.geo.lat};${site.geo.lng}`,
    `URL:${absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Soweto Towers in two hours',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="soweto-towers-${b.ref}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
