import type { ImageKey } from './images';

/**
 * The portfolio. The three supplied photographs are the first entries, under
 * the neutral labels the brief suggests until official names are approved.
 * Year, client and credits are null because none were supplied — the UI hides
 * a null rather than printing a guess.
 *
 * To add work: append an entry and its image in images.ts. No component needs
 * to change. Swap this array for a CMS/database query when one exists.
 */

export type WorkItem = {
  slug: string;
  title: string;
  category: string;
  year: number | null;
  summary: string;
  image: ImageKey;
  details: string[];
};

export const work: WorkItem[] = [
  {
    slug: 'garment-study-01',
    title: 'Garment Study 01',
    category: 'Evening',
    year: null,
    summary: 'Burgundy satin in full movement: an oversized bow at the neck, gathered sleeves and a skirt that sweeps out into a train, opened by a high slit.',
    image: 'burgundyGown',
    details: ['Burgundy satin gown', 'Oversized neck bow', 'Full gathered sleeves', 'High slit and sweeping train'],
  },
  {
    slug: 'garment-study-02',
    title: 'Garment Study 02',
    category: 'Occasion',
    year: null,
    summary: 'Emerald satin caught in the evening wind: ruffled shoulders and a full skirt that falls in tiers of ruffles, each hem sweeping out behind.',
    image: 'greenGown',
    details: ['Emerald satin gown', 'Ruffled cap shoulders', 'Tiered ruffle hems', 'Full, sweeping skirt'],
  },
  {
    slug: 'garment-study-03',
    title: 'Garment Study 03',
    category: 'Construction Detail',
    year: null,
    summary: 'Navy, cut close. A sculpted neck bow, a darted bodice and full sleeves gathered at the wrist, seen on the form where the construction reads most clearly.',
    image: 'navyDress',
    details: ['Sculpted bow at the neck', 'Full sleeves gathered at the wrist', 'Darted, fitted bodice', 'Flared skirt'],
  },
];

export const workCategories = ['All', ...new Set(work.map((w) => w.category))];
