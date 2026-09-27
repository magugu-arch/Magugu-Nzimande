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
  /** Never shown in monochrome: the colour is the point of the photograph. */
  alwaysColour?: boolean;
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
  greenGown: {
    src: `${base}images/green-gown`,
    alt: 'At sunset, a woman in sunglasses stands on a sandstone wall in an emerald satin gown with ruffled shoulders and tiered, ruffled hems that sweep out behind her, with palms and a mountain beyond.',
    width: 1060,
    height: 1484,
    focus: '62% 35%',
    alwaysColour: true,
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
