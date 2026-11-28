import { imageFiles, type ImageSlug } from './images.generated';

export type { ImageSlug };

export type SiteImage = {
  slug: ImageSlug;
  src: string;
  width: number;
  height: number;
  blurDataURL: string;
  alt: string;
  /** CSS object-position: where the subject sits, so crops never cut it off. */
  focus: string;
  /**
   * Art direction for wide page heroes (desktop): where to aim the crop, and
   * which side the text panel goes on so it never sits on the subject.
   */
  wide?: { focus?: string; panel: 'left' | 'right' };
};

/**
 * Alt text describes what is in the frame, the way someone would explain it
 * out loud. Focal points keep the subject in view when a card crops the image.
 */
const meta: Record<ImageSlug, { alt: string; focus: string; wide?: SiteImage['wide'] }> = {
  'towers-mural-hero': {
    alt: 'The painted Soweto Towers at golden hour, a bungee jumper hanging from the bridge between the two cooling towers',
    focus: '72% 45%',
  },
  'bungee-between-towers': {
    alt: 'Looking up at a bungee jumper hanging upside down beneath the bridge between the towers',
    focus: '50% 55%',
    wide: { focus: '50% 64%', panel: 'left' },
  },
  'bungee-pov-edge': {
    alt: 'A jumper’s view from the edge of the platform: ankles strapped in, Soweto far below',
    focus: '50% 70%',
  },
  'before-the-drop': {
    alt: 'A jumper in an orange harness looks out over Soweto moments before the drop',
    focus: '62% 35%',
    wide: { focus: '62% 30%', panel: 'left' },
  },
  'harness-check': {
    alt: 'A jump master fastens a bungee ankle harness and screw-gate carabiner on the platform',
    focus: '55% 55%',
    wide: { focus: '60% 58%', panel: 'left' },
  },
  'scad-freefall': {
    alt: 'A SCAD freefall jumper drops through a shaft of light inside the cooling tower towards the catch net',
    focus: '55% 45%',
    wide: { focus: '45% 50%', panel: 'right' },
  },
  'zipline-orlando-dam': {
    alt: 'A rider shouts with joy on the zipline over the Orlando Dam, the painted towers behind',
    focus: '35% 45%',
    wide: { panel: 'right' },
  },
  'paintball-arena': {
    alt: 'Paintball players sprint through dust and light inside the base of a cooling tower',
    focus: '50% 50%',
    wide: { panel: 'right' },
  },
  'lift-ride-view': {
    alt: 'A couple in the lift cage on the outside of the tower point out the view over Soweto at sunset',
    focus: '68% 50%',
    wide: { panel: 'left' },
  },
  'scream-clip-phone': {
    alt: 'A visitor films a bungee jump between the painted towers on her phone',
    focus: '70% 45%',
  },
  'gift-a-jump': {
    alt: 'Two people exchange a Gift a Jump voucher tied with yellow ribbon, the towers glowing at sunset behind them',
    focus: '50% 60%',
  },
  'celebration-crowd': {
    alt: 'Friends cheer and point up at a jumper in front of the geometric mural on a tower',
    focus: '45% 55%',
  },
  'team-day': {
    alt: 'A corporate team laughs and celebrates together after a jump at the towers',
    focus: '50% 45%',
    wide: { focus: '55% 40%', panel: 'left' },
  },
  'shisanyama-platter': {
    alt: 'A shisanyama platter of boerewors, braaied chicken, pap, chakalaka and grilled mielies, the towers behind',
    focus: '50% 60%',
    wide: { panel: 'left' },
  },
  'soweto-street-tour': {
    alt: 'A local guide points out the painted towers to a group of visitors on a Soweto street',
    focus: '55% 45%',
    wide: { focus: '60% 40%', panel: 'left' },
  },
  'soweto-dusk-panorama': {
    alt: 'Soweto at dusk from the top of the towers, streetlights coming on across the township',
    focus: '50% 50%',
  },
  'towers-sunset-panorama': {
    alt: 'Panorama of the muralled towers above Soweto at sunset, a jumper on the bungee cord',
    focus: '30% 50%',
    wide: { panel: 'right' },
  },
  'towers-twilight-reflection': {
    alt: 'The two cooling towers at dusk, lit up and reflected in still water',
    focus: '50% 40%',
    wide: { panel: 'right' },
  },
};

export function image(slug: ImageSlug): SiteImage {
  return { slug, ...imageFiles[slug], ...meta[slug] };
}

export const allImages: SiteImage[] = (Object.keys(imageFiles) as ImageSlug[]).map(image);
