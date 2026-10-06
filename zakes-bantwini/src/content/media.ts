/**
 * The media library: all 41 supplied images, in the sequence they were
 * received (IMG_6848 … IMG_6888 = brief §08 rows 01 … 41).
 *
 * This is CMS seed data, not design-layer markup. Alt text, focal points and
 * default crops live here so an editor can change them without touching a
 * component; components ask for an image by id and may override the crop for
 * a specific placement.
 *
 * Verified against the brief's own contact sheet (§09): every file sits at
 * the position the brief gives it. Four rows of the §08 *text* matrix describe
 * a different picture from the file at that position (23, 29, 38, 39) — see
 * `briefNote` on those entries. Placement follows what each picture actually
 * shows, so the role the brief intended still gets the right image.
 */
import manifest from './media.manifest.json';

export type Ratio = '21/9' | '16/9' | '3/2' | '4/3' | '1/1' | '4/5' | '3/4' | '2/3' | '9/16' | '7/3';
export type Focal = { x: number; y: number };
export type Overlay = 'none' | 'bottom' | 'left' | 'right' | 'full' | 'vignette';
export type Hover = 'none' | 'zoom';

export type Section =
  | 'hero'
  | 'music'
  | 'catalogue'
  | 'videos'
  | 'live'
  | 'book'
  | 'story'
  | 'architect'
  | 'pillars'
  | 'handover'
  | 'journal'
  | 'press'
  | 'collaborate'
  | 'community'
  | 'legacy'
  | 'transition'
  | 'footer';

export type MediaAsset = {
  id: keyof typeof manifest;
  /** Row number in the brief's placement matrix (01–41). */
  index: number;
  title: string;
  alt: string;
  /** What the image does on the site, from the brief's treatment column. */
  role: string;
  sections: Section[];
  /** object-position on wide viewports, in percent. */
  focal: Focal;
  /** object-position on narrow viewports, when the subject sits elsewhere in a tall crop. */
  mobileFocal?: Focal;
  desktopRatio: Ratio;
  mobileRatio: Ratio;
  /** Preload and fetch at high priority. Only the hero should set this. */
  priority?: boolean;
  overlay?: Overlay;
  hover?: Hover;
  /** Where the brief's text matrix and the supplied file disagree. */
  briefNote?: string;
  /** Things an editor should know before cropping or replacing this image. */
  caution?: string;
};

const media = [
  {
    id: 'IMG_6848',
    index: 1,
    title: 'Catalogue still life',
    alt: 'A turntable, headphones, record sleeves and handwritten notebooks on a dark wooden desk, lit by a single lamp.',
    role: 'Primary visual for the catalogue; slow parallax, subtle hover zoom.',
    sections: ['music', 'catalogue'],
    focal: { x: 62, y: 45 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6849',
    index: 2,
    title: 'Needle drop',
    alt: 'Close-up of a hand lowering a brass tonearm onto a spinning vinyl record.',
    role: 'Macro transition between catalogue and album storytelling.',
    sections: ['music', 'catalogue', 'transition'],
    focal: { x: 70, y: 45 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6850',
    index: 3,
    title: 'Profile in bokeh',
    alt: 'Zakes Bantwini in profile against a dark background with warm out-of-focus stage lights.',
    role: 'Cinematic hero alternate or opening transition frame.',
    sections: ['hero', 'transition'],
    focal: { x: 60, y: 40 },
    mobileFocal: { x: 64, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    overlay: 'left',
  },
  {
    id: 'IMG_6851',
    index: 4,
    title: 'Live, arms open',
    alt: 'Zakes Bantwini on stage with a microphone, arms outstretched, a packed audience lit behind.',
    role: 'Primary live-performance card / video poster.',
    sections: ['live', 'videos'],
    focal: { x: 68, y: 36 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6852',
    index: 5,
    title: 'In monumental architecture',
    alt: 'Zakes Bantwini in a black suit standing among raw concrete stairs and columns, lit from the side.',
    role: 'Primary architect portrait; carries the positioning statement.',
    sections: ['architect'],
    focal: { x: 64, y: 40 },
    mobileFocal: { x: 66, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '3/4',
  },
  {
    id: 'IMG_6853',
    index: 6,
    title: 'The Architect — hero',
    alt: 'Zakes Bantwini in a black suit standing in a dark space with haze and two soft lights behind; the left of the frame falls away to black.',
    role: 'Homepage hero. Left side stays clean for the HTML headline and calls to action.',
    sections: ['hero', 'book'],
    focal: { x: 70, y: 28 },
    mobileFocal: { x: 71, y: 30 },
    desktopRatio: '16/9',
    mobileRatio: '9/16',
    priority: true,
    overlay: 'left',
  },
  {
    id: 'IMG_6854',
    index: 7,
    title: 'Corridor of light',
    alt: 'Zakes Bantwini walking through a long concrete corridor striped with late sunlight.',
    role: 'Handover scroll transition — movement into the next chapter.',
    sections: ['handover', 'transition'],
    focal: { x: 52, y: 42 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6855',
    index: 8,
    title: 'Seated signature portrait',
    alt: 'Zakes Bantwini seated in a curved wooden chair in a black suit, forearms resting on the knees, warm lamps behind.',
    role: 'Primary editorial portrait and biography visual.',
    sections: ['story', 'press'],
    focal: { x: 50, y: 30 },
    desktopRatio: '4/5',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6856',
    index: 9,
    title: 'Intimate room',
    alt: 'Zakes Bantwini singing with eyes closed and one hand raised, to a seated audience in a wood-panelled room.',
    role: 'Secondary live image; event listings and showreel.',
    sections: ['live'],
    focal: { x: 76, y: 30 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6857',
    index: 10,
    title: 'Listening room',
    alt: 'Zakes Bantwini seated in a dim listening room, chin on hand, facing a pair of tall speakers.',
    role: 'Music-maker portrait beside the catalogue introduction.',
    sections: ['music', 'story'],
    focal: { x: 76, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6858',
    index: 11,
    title: 'At the console',
    alt: 'Zakes Bantwini working at an analogue mixing console with synthesisers and patch cables behind.',
    role: 'Creative process — producer and creator positioning.',
    sections: ['architect', 'journal'],
    focal: { x: 78, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6859',
    index: 12,
    title: 'Directing the crew',
    alt: 'Zakes Bantwini directing a film crew beside a cinema camera and a field monitor on set.',
    role: 'Behind-the-scenes production story.',
    sections: ['videos', 'journal'],
    focal: { x: 65, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6860',
    index: 13,
    title: 'The gathering',
    alt: 'A crowd of young people talking and laughing at an evening gathering under string lights.',
    role: 'Fan and community visual; warm editorial card.',
    sections: ['community'],
    focal: { x: 66, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6861',
    index: 14,
    title: 'Festival at sunset',
    alt: 'A large festival crowd in an open landscape at sunset, facing a stage dressed in timber and rust-coloured drapes.',
    role: 'Primary festival hero banner.',
    sections: ['pillars', 'live', 'hero'],
    focal: { x: 62, y: 55 },
    mobileFocal: { x: 74, y: 55 },
    desktopRatio: '21/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6862',
    index: 15,
    title: 'Private event',
    alt: 'Zakes Bantwini performing on a low stage in an elegant ballroom to a seated audience in evening wear.',
    role: 'Commercial proof for corporate and private bookings.',
    sections: ['book', 'live'],
    focal: { x: 76, y: 35 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6863',
    index: 16,
    title: 'Small in the monument',
    alt: 'Zakes Bantwini standing small at the foot of towering concrete and black stone forms, a shaft of light falling from above.',
    role: 'Hero architecture metaphor; full bleed with live type.',
    sections: ['architect', 'handover', 'hero'],
    focal: { x: 50, y: 62 },
    desktopRatio: '4/5',
    mobileRatio: '9/16',
  },
  {
    id: 'IMG_6864',
    index: 17,
    title: 'Mentoring at the desk',
    alt: 'Zakes Bantwini beside a young producer in headphones working the faders of a mixing desk.',
    role: 'Mentorship and the next-generation story — Label and Academy.',
    sections: ['pillars'],
    focal: { x: 62, y: 40 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6865',
    index: 18,
    title: 'Hands up',
    alt: 'A vast crowd with hands raised towards a performer on a hazy, spot-lit stage.',
    role: 'Large-scale live proof and social energy.',
    sections: ['live'],
    focal: { x: 66, y: 34 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    hover: 'zoom',
  },
  {
    id: 'IMG_6866',
    index: 19,
    title: 'Before the band',
    alt: 'Zakes Bantwini in a navy suit in the foreground of a stage while a band rehearses behind.',
    role: 'Performance preparation and musicianship.',
    sections: ['music', 'live'],
    focal: { x: 78, y: 34 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6867',
    index: 20,
    title: 'Teaching',
    alt: 'Zakes Bantwini talking with a group of young creatives taking notes in a sunlit music studio.',
    role: 'Primary Academy image.',
    sections: ['pillars'],
    focal: { x: 44, y: 40 },
    mobileFocal: { x: 30, y: 40 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6868',
    index: 21,
    title: 'The archive',
    alt: 'Dark shelves of archive boxes, tape reels, framed photographs and records in a narrow room lit by a shaft of light.',
    role: 'Primary archive visual with dark overlay and text.',
    sections: ['catalogue', 'legacy', 'pillars'],
    focal: { x: 66, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    overlay: 'left',
    caution:
      'Generated image: the record sleeve at right carries garbled lettering. Avoid tight crops on it; replace with documentary archive photography when management supplies it.',
  },
  {
    id: 'IMG_6869',
    index: 22,
    title: 'Formal portrait',
    alt: 'Zakes Bantwini in a black suit and open-collared black shirt, standing beside a stone column.',
    role: 'Primary booking and EPK portrait.',
    sections: ['book', 'press'],
    focal: { x: 48, y: 26 },
    desktopRatio: '4/5',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6870',
    index: 23,
    title: 'Session at the console',
    alt: 'Zakes Bantwini pointing to a channel on a large mixing console while two collaborators work the faders.',
    role: 'Producer at work with collaborators — the studio as a room for other people.',
    sections: ['story', 'pillars'],
    focal: { x: 62, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
    briefNote:
      'Brief §08 describes row 23 as “Zakes reviewing physical archive”. The supplied IMG_6870 is a console session with two collaborators, so it is placed with the Label and studio story rather than the catalogue archive.',
  },
  {
    id: 'IMG_6871',
    index: 24,
    title: 'The archive table',
    alt: 'Zakes Bantwini leaning over a table of black-and-white prints and a mixer in a working studio.',
    role: 'Creative process; editorial transition.',
    sections: ['architect', 'journal', 'catalogue'],
    focal: { x: 70, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6872',
    index: 25,
    title: 'Johannesburg at dusk',
    alt: 'The Johannesburg skyline at dusk, highways curving into the city beneath glass towers.',
    role: 'South African origin and city context; wide editorial transition.',
    sections: ['story', 'journal', 'transition'],
    focal: { x: 62, y: 55 },
    desktopRatio: '21/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6873',
    index: 26,
    title: 'Before the show',
    alt: 'A black suit jacket on a hanger in a dressing room, beside in-ear monitors, cables and a backstage pass on a wooden table.',
    role: 'Performance preparation still life near booking and live.',
    sections: ['book', 'live'],
    focal: { x: 66, y: 45 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    overlay: 'left',
  },
  {
    id: 'IMG_6874',
    index: 27,
    title: 'Corridor of records',
    alt: 'Zakes Bantwini, seen from behind, walking down a hallway hung with framed black-and-white photographs of jazz musicians and concert posters.',
    role: 'Cinematic archive transition for legacy storytelling.',
    sections: ['legacy', 'journal', 'handover'],
    focal: { x: 58, y: 45 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    caution:
      'Generated image: the posters on the right carry invented names. Keep them soft or out of frame; never caption them as real artefacts.',
  },
  {
    id: 'IMG_6875',
    index: 28,
    title: 'Studio full length',
    alt: 'Full-length studio portrait of Zakes Bantwini in a black suit and black shirt against a warm grey wall.',
    role: 'High-confidence portrait for booking, press and profile components.',
    sections: ['press', 'book'],
    focal: { x: 48, y: 30 },
    desktopRatio: '4/5',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6876',
    index: 29,
    title: 'The material board',
    alt: 'Zakes Bantwini presenting a board of fabric and material swatches to a collaborator across a workshop table.',
    role: 'Brand partnership and creative collaboration.',
    sections: ['collaborate', 'architect'],
    focal: { x: 62, y: 36 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    briefNote:
      'Brief §08 describes row 29 as “Zakes in modern creative environment” and row 39 as “Creative collaboration / mood board”. The supplied IMG_6876 is the mood-board image, so it leads the Collaborate page.',
  },
  {
    id: 'IMG_6877',
    index: 30,
    title: 'With young fans',
    alt: 'Zakes Bantwini leaning in, smiling, as a group of young fans laughs together backstage.',
    role: 'Human connection and the next-generation relationship.',
    sections: ['community', 'legacy', 'handover', 'pillars'],
    focal: { x: 58, y: 36 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6878',
    index: 31,
    title: 'Around the table',
    alt: 'Zakes Bantwini seated on a bench in conversation with a small group in a warmly lit room with guitars on the wall.',
    role: 'Humanising editorial image; warm story opener.',
    sections: ['story', 'journal'],
    focal: { x: 56, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6879',
    index: 32,
    title: 'Vinyl and photographs',
    alt: 'Weathered hands holding a vinyl record over old black-and-white photographs on a wooden table.',
    role: 'Tactile archive detail for catalogue and heritage.',
    sections: ['catalogue', 'legacy'],
    focal: { x: 60, y: 55 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6880',
    index: 33,
    title: 'Walking to camera',
    alt: 'Zakes Bantwini walking towards camera down a backstage corridor while a film crew works on either side.',
    role: 'High-end production and filmmaking.',
    sections: ['videos', 'story'],
    focal: { x: 52, y: 32 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6881',
    index: 34,
    title: 'Mixing at night',
    alt: 'Zakes Bantwini at a large mixing console in a dark studio, a waveform glowing on the screen beside the desk.',
    role: 'Music-production hero for the sound and studio chapters.',
    sections: ['music', 'journal'],
    focal: { x: 62, y: 36 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6882',
    index: 35,
    title: 'Monochrome portrait',
    alt: 'Black-and-white close portrait of Zakes Bantwini looking back over one shoulder.',
    role: 'Signature monochrome portrait for editorial and EPK use.',
    sections: ['press', 'legacy'],
    focal: { x: 42, y: 34 },
    desktopRatio: '4/5',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6883',
    index: 36,
    title: 'Empty studio',
    alt: 'An empty recording studio at night: a mixer, a modular synthesiser, headphones and a turntable on a long table.',
    role: 'Quiet visual reset between music and story chapters.',
    sections: ['music', 'transition'],
    focal: { x: 50, y: 55 },
    desktopRatio: '7/3',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6884',
    index: 37,
    title: 'Studio portrait',
    alt: 'Head-and-shoulders studio portrait of Zakes Bantwini in a black suit against charcoal grey.',
    role: 'Secondary official press portrait.',
    sections: ['press'],
    focal: { x: 52, y: 30 },
    desktopRatio: '4/5',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6885',
    index: 38,
    title: 'The new room',
    alt: 'Zakes Bantwini standing in a modern lounge of concrete, steel and walnut beside a large wall of light.',
    role: 'Professional, business-facing creative environment.',
    sections: ['architect', 'collaborate'],
    focal: { x: 70, y: 40 },
    desktopRatio: '16/9',
    mobileRatio: '4/5',
    briefNote:
      'Brief §08 describes row 38 as “Zakes walking away in architecture” (Handover / footer). The supplied IMG_6885 is the modern-environment image the brief gives to row 29, so it sits with The Architect; the walking-away image is IMG_6886.',
  },
  {
    id: 'IMG_6886',
    index: 39,
    title: 'Walking into the light',
    alt: 'Zakes Bantwini, seen from behind, walking through a concrete colonnade towards a bright opening at dusk.',
    role: 'Final cinematic transition for the next-chapter story.',
    sections: ['handover', 'footer'],
    focal: { x: 66, y: 50 },
    mobileFocal: { x: 72, y: 50 },
    desktopRatio: '7/3',
    mobileRatio: '4/5',
    briefNote:
      'Brief §08 describes row 39 as “Creative collaboration / mood board”. The supplied IMG_6886 is the walking-away image the brief places at the Handover and footer, so that is where it goes.',
  },
  {
    id: 'IMG_6887',
    index: 40,
    title: 'Candid',
    alt: 'Zakes Bantwini laughing in conversation in a sunlit artist’s studio full of brushes and easels.',
    role: 'Warm creative partnership; humanises the commercial ecosystem.',
    sections: ['collaborate', 'story', 'journal'],
    focal: { x: 66, y: 34 },
    desktopRatio: '3/2',
    mobileRatio: '4/5',
  },
  {
    id: 'IMG_6888',
    index: 41,
    title: 'Monumental staircase',
    alt: 'A monumental stone and black granite staircase rising through a sunlit atrium, a lone figure crossing a landing.',
    role: 'Wide architectural transition for section breaks and pacing.',
    sections: ['architect', 'pillars', 'transition'],
    focal: { x: 50, y: 50 },
    desktopRatio: '7/3',
    mobileRatio: '4/5',
  },
] as const satisfies readonly MediaAsset[];

export type MediaId = (typeof media)[number]['id'];

const byId = new Map<string, MediaAsset>(media.map((m) => [m.id, m]));

export function getMedia(id: MediaId): MediaAsset {
  const asset = byId.get(id);
  if (!asset) throw new Error(`Unknown media id: ${id}`);
  return asset;
}

export function allMedia(): readonly MediaAsset[] {
  return media;
}

export type MediaFile = (typeof manifest)[keyof typeof manifest];

export function getMediaFile(id: MediaId): MediaFile {
  return manifest[id];
}

/** Public URL of one derivative. */
export function mediaUrl(id: MediaId, width: number, format: 'avif' | 'webp'): string {
  return `/media/${id}-${width}.${format}`;
}

export function mediaSrcSet(id: MediaId, format: 'avif' | 'webp'): string {
  return getMediaFile(id)
    .widths.map((w) => `${mediaUrl(id, w, format)} ${w}w`)
    .join(', ');
}

/** 1200×630 share card for Open Graph and X. */
export function mediaOgUrl(id: MediaId): string {
  return `/media/${id}-og.jpg`;
}

/** The original master, for press downloads. */
export function mediaMasterUrl(id: MediaId): string {
  return `/press/photos/${getMediaFile(id).file}`;
}
