import type { ActivityId, PackageId } from '@/content/catalog';
import type { CartItem, LiveActivity } from '@/lib/booking/engine';
import { itemsForPackage } from '@/lib/booking/engine';

export type ParticipantDraft = { name: string; weightKg: string; minor: boolean };

export type Draft = {
  activityId: ActivityId;
  packageId: PackageId | null;
  qty: number;
  video: number;
  photos: number;
  date: string | null;
  time: string | null;
  scadTime: string | null;
  participants: ParticipantDraft[];
  guardianName: string;
  allTwelvePlus: boolean;
  medicalOk: boolean;
  contact: { name: string; email: string; phone: string };
  consents: { whatsapp: boolean; marketing: boolean; clip: boolean; terms: boolean };
  voucherCode: string;
  lunch: { enabled: boolean; time: string; partySize: number };
};

export const STEPS = ['Adventure', 'People', 'Date & time', 'Safety', 'Your details', 'Pay'] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const initialDraft = (activityId: ActivityId = 'bungee-jump', packageId: PackageId | null = 'jump-film'): Draft => ({
  activityId,
  packageId: activityId === 'bungee-jump' ? packageId : null,
  qty: activityId === 'paintball' ? 2 : 1,
  video: 0,
  photos: 0,
  date: null,
  time: null,
  scadTime: null,
  participants: [],
  guardianName: '',
  allTwelvePlus: false,
  medicalOk: false,
  contact: { name: '', email: '', phone: '' },
  consents: { whatsapp: true, marketing: false, clip: false, terms: false },
  voucherCode: '',
  lunch: { enabled: false, time: '13:00', partySize: 2 },
});

/** The cart the engine prices, built from the draft. */
export function cartFor(d: Draft, catalog: LiveActivity[]): CartItem[] {
  const a = catalog.find((x) => x.id === d.activityId);
  if (!a) return [];
  if (d.activityId === 'bungee-jump' && d.packageId) {
    const items = itemsForPackage(d.packageId, d.qty, {
      'bungee-jump': d.time ?? '',
      'scad-freefall': d.scadTime ?? '',
    });
    return items.map((i) => (i.activityId === 'bungee-jump' ? { ...i, photos: Math.min(d.photos, d.qty) } : i));
  }
  return [
    {
      activityId: d.activityId,
      qty: d.qty,
      time: d.time ?? '',
      video: a.videoIncluded || !a.addons.includes('video') ? 0 : Math.min(d.video, d.qty),
      photos: a.addons.includes('photos') ? Math.min(d.photos, d.qty) : 0,
    },
  ];
}

/** Activities a draft books (for weight and age checks). */
export function bookedIds(d: Draft): ActivityId[] {
  if (d.activityId === 'bungee-jump' && d.packageId === 'full-tower') return ['bungee-jump', 'scad-freefall'];
  return [d.activityId];
}

export function syncParticipants(list: ParticipantDraft[], qty: number): ParticipantDraft[] {
  const next = list.slice(0, qty);
  while (next.length < qty) next.push({ name: '', weightKg: '', minor: false });
  return next;
}
