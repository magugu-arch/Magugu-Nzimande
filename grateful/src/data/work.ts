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
  /** Show the photo in its original colour (Work page) rather than monochrome. */
  colour: boolean;
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
    colour: true,
    details: ['Burgundy satin gown', 'Oversized neck bow', 'Full gathered sleeves', 'High slit and sweeping train'],
  },
  {
    slug: 'garment-study-02',
    title: 'Garment Study 02',
    category: 'Styled Look',
    year: null,
    summary: 'A full look with movement: an off-the-shoulder ruffle in green, paired with wide-leg trousers in a bold monochrome geometric print.',
    image: 'styledLook',
    colour: true,
    details: ['Off-the-shoulder ruffled top', 'Wide-leg printed trousers', 'Styled outdoors'],
  },
  {
    slug: 'garment-study-03',
    title: 'Garment Study 03',
    category: 'Construction Detail',
    year: null,
    summary: 'Burgundy, cut close. An oversized neck bow and full gathered sleeves, seen on the form where construction reads most clearly.',
    image: 'burgundyDetail',
    colour: true,
    details: ['Oversized bow at the neck', 'Gathered bell sleeves', 'Fitted bodice'],
  },
];

export const workCategories = ['All', ...new Set(work.map((w) => w.category))];
