/**
 * The approved Grateful photography (brief §19). Each entry carries its own alt
 * text and the crop that keeps the garment intact, so a component never has
 * to know which photo it is showing. Add future approved images here.
 */

export type BrandImage = {
  /** Base path without extension; `-640.webp`, `-1280.webp` and `.jpeg` exist. */
  src: string;
  alt: string;
  width: number;
  height: number;
  /** CSS object-position that keeps the garment in frame at any crop. */
  focus: string;
};

export const images = {
  whiteGarment: {
    src: '/images/IMG_2438',
    alt: 'A woman stands facing the camera in a white, oversized Grateful shirt with a dramatic high-low hem that flares out at the sides, worn over black leggings.',
    width: 1536,
    height: 2048,
    focus: '50% 30%',
  },
  styledLook: {
    src: '/images/IMG_2243',
    alt: 'A woman poses on a brick garden path between tall hedges, wearing a green off-the-shoulder ruffled top with wide-leg black and white geometric print trousers.',
    width: 1536,
    height: 2048,
    focus: '50% 45%',
  },
  burgundyDetail: {
    src: '/images/IMG_1411',
    alt: 'A burgundy Grateful dress on a dress form, with an oversized bow at the neck and full, gathered bell sleeves.',
    width: 1150,
    height: 2048,
    focus: '50% 25%',
  },
} satisfies Record<string, BrandImage>;

export type ImageKey = keyof typeof images;
