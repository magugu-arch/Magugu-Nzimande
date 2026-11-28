import { activities, packages } from '@/content/catalog';
import { site } from '@/content/site';

/**
 * Instant answers for the most common questions, built only from published
 * facts. Anything else waits for a person: the bot never guesses.
 */

const price = (id: string) => activities.find((a) => a.id === id)!;

export const quickTopics = [
  { id: 'prices', label: 'Prices' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'weight', label: 'Weight & age limits' },
  { id: 'groups', label: 'Group bookings' },
  { id: 'safety', label: 'Is it safe?' },
  { id: 'where', label: 'Getting here' },
] as const;

const answers: Record<(typeof quickTopics)[number]['id'], string> = {
  prices: [
    `Bungee jump R${price('bungee-jump').price} (R${price('bungee-jump').group!.price} each for groups of 6+).`,
    `${packages[1]!.name} R${packages[1]!.price} and ${packages[2]!.name} R${packages[2]!.price.toLocaleString('en-US')}.`,
    `SCAD freefall R${price('scad-freefall').price} with video, zipline R${price('zipline').price}, paintball R${price('paintball').price} per player, lift ride R${price('lift-ride').price}.`,
    `Entrance is R${site.entranceFee} at the gate, card only. Book timed slots at /book.`,
  ].join(' '),
  hours:
    'Thursday 12:00 till sunset, Friday to Sunday 10:00 till sunset. Closed Monday to Wednesday. The status strip at the top of the site shows today’s sunset and any weather hold.',
  weight:
    'Bungee and straightjacket: 35–110 kg. SCAD freefall: 35–100 kg. Nobody under 12 goes up the tower, and under-18s need signed parent or guardian consent. Paintball is 12+.',
  groups:
    'Groups of 6 or more get R50 off each bungee and R40 off each SCAD, applied automatically when you book. For 15+ people, team days or schools, use the Groups page and we’ll send a quote with invoicing.',
  safety:
    'Every jump is run by our jump masters. We check weight before you pay and again on the bridge, one jumper at a time (no tandem jumps). Activities pause when it rains, and lightning detectors clear the top if a storm comes near.',
  where: `${site.address.street}, ${site.address.suburb}, ${site.address.city}. Search “Soweto Towers” in Google Maps, or use the directions links on Plan your visit.`,
};

const keywords: [RegExp, keyof typeof answers][] = [
  [/\b(price|prices|cost|how much|rand|r\d+|expensive|cheap)\b/i, 'prices'],
  [/\b(open|opening|hours|close|closing|time|sunset|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, 'hours'],
  [/\b(weight|kg|heavy|age|old|kids?|child|children|minor|under 18|teen)\b/i, 'weight'],
  [/\b(group|team|corporate|school|birthday|party|friends|discount)\b/i, 'groups'],
  [/\b(safe|safety|scared|afraid|danger|dangerous|injur|harness|rain|weather|lightning)\b/i, 'safety'],
  [/\b(where|address|direction|location|map|parking|get there|uber)\b/i, 'where'],
];

export function topicAnswer(id: string): string | null {
  return (answers as Record<string, string>)[id] ?? null;
}

export function autoAnswer(text: string): string | null {
  const hits = keywords.filter(([re]) => re.test(text)).map(([, k]) => k);
  const unique = [...new Set(hits)].slice(0, 2);
  if (unique.length === 0) return null;
  return unique.map((k) => answers[k]).join('\n\n');
}
