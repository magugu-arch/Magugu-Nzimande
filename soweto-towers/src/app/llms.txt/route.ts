import { activities, packages } from '@/content/catalog';
import { site } from '@/content/site';
import { weeklyHoursSummary } from '@/lib/hours';

/**
 * /llms.txt: a plain-language summary for AI assistants and answer engines, so
 * questions like "how much is the Orlando Towers bungee?" get today's facts.
 */
export function GET() {
  const lines = [
    `# ${site.name} (also known as Orlando Towers)`,
    '',
    `> Adventure centre on the painted cooling towers of the former Orlando Power Station, ${site.address.suburb}, ${site.address.city}, ${site.address.metro}, South Africa. ${site.tagline}`,
    '',
    '## Adventures and prices (South African rand, per person)',
    ...activities.map(
      (a) =>
        `- ${a.name}: R${a.price}${a.group ? ` (R${a.group.price} each for ${a.group.min}+)` : ''}. ${a.short.replace(/\.$/, '')}.${a.rules.minWeightKg ? ` Weight ${a.rules.minWeightKg}–${a.rules.maxWeightKg} kg.` : ''} ${site.url}/adventures/${a.id}`,
    ),
    '',
    '## Packages',
    ...packages.map((p) => `- ${p.name}: R${p.price}. ${p.blurb}`),
    '',
    '## Opening hours (closes at sunset)',
    ...weeklyHoursSummary().map((h) => `- ${h.label}: ${h.value}`),
    '',
    '## Good to know',
    `- Book timed slots online: ${site.url}/book`,
    `- Entrance R${site.entranceFee} per person at the gate; the site is cash-free (card only).`,
    '- Nobody under 12 goes up the tower; under-18s need parent or guardian consent.',
    '- Activities pause in rain; lightning detectors clear the top.',
    `- Gift vouchers: ${site.url}/gift`,
    `- Groups, corporate team days and schools: ${site.url}/groups`,
    '',
    '## Contact',
    `- Phone: ${site.phone.display}`,
    `- WhatsApp: ${site.whatsapp.display}`,
    `- Email: ${site.email}`,
    `- Address: ${site.address.street}, ${site.address.suburb}, ${site.address.city}`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
