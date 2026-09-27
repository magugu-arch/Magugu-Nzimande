/**
 * The approved Grateful photography (brief §19). Each entry carries its own alt
 * text and the crop that keeps the garment intact, so a component never has
 * to know which photo it is showing. Add future approved images here.
 */

export type BrandImage = {
  /** Base path without extension; `-640.webp`, `-1280.webp` (the large size, up to 1280 wide) and `.jpeg` exist. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS object-position that keeps the garment in frame at any crop. */
  focus: string;
};

const base = import.meta.env.BASE_URL;

export const images = {
  burgundyGown: {
    src: `${base}images/burgundy-gown`,
    alt: 'A model in a flowing burgundy satin gown with an oversized bow at the neck, full gathered sleeves, a high slit and a sweeping train, against a pale studio backdrop.',
    width: 1084,
    height: 1451,
    focus: '50% 20%',
  },
  styledLook: {
    src: `${base}images/IMG_2243`,
    alt: 'A woman poses on a brick garden path between tall hedges, wearing a green off-the-shoulder ruffled top with wide-leg black and white geometric print trousers.',
    width: 1536,
    height: 2048,
    focus: '50% 45%',
  },
  burgundyDetail: {
    src: `${base}images/IMG_1411`,
    alt: 'A burgundy Grateful dress on a dress form, with an oversized bow at the neck and full, gathered bell sleeves.',
    width: 1150,
    height: 2048,
    focus: '50% 25%',
  },
  whiteShirtLook: {
    src: `${base}images/white-shirt-look`,
    alt: 'A woman stands in soft sunlight wearing an oversized white shirt with a gathered yoke and a sweeping high-low hem, over wide black pleated trousers.',
    width: 941,
    height: 1672,
    focus: '50% 6%',
  },
} satisfies Record<string, BrandImage>;

export type ImageKey = keyof typeof images;
