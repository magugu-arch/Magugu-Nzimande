import type { z } from 'zod';
import type { Pillar, PressKit, SiteSettings } from '../schema';

/*
 * The five pillars come from the supplied strategy (Festival, Label,
 * Catalogue, Academy and the Fan Economy, presented here as Community). The
 * copy describes intent, not existing entities: nothing here claims a
 * festival date, a signed artist or an enrolled student. Management approves
 * the wording, then flips `approval`.
 */
export const pillars: z.input<typeof Pillar>[] = [
  {
    key: 'festival',
    title: 'Festival',
    kicker: 'The gathering',
    summary: 'A home for the culture to meet — curated with the care of an album and the scale of a landscape.',
    body: [
      'The Festival is where the music meets its people at full scale: open ground, a stage built for the place it stands in, and a line-up sequenced like a long-form record.',
      'It is designed as an institution rather than an event — something that returns, grows and gives other artists a stage worth playing.',
    ],
    media: 'IMG_6861',
    secondaryMedia: 'IMG_6865',
    approval: 'pending',
  },
  {
    key: 'label',
    title: 'Label',
    kicker: 'The platform',
    summary: 'A label that builds artists the way records are built: with structure, patience and space for them to be heard.',
    body: [
      'The Label turns a producer’s ear into a platform for others — finding voices, shaping records and protecting the people who make them.',
      'Its measure is the catalogue it helps other artists build, not only the one it releases under its own name.',
    ],
    media: 'IMG_6864',
    secondaryMedia: 'IMG_6870',
    approval: 'pending',
  },
  {
    key: 'catalogue',
    title: 'Catalogue',
    kicker: 'The archive',
    summary: 'The body of work, protected, findable and put to use — a working library rather than a shelf.',
    body: [
      'The Catalogue treats every release, session and photograph as part of one archive: documented, preserved and opened up to listeners, researchers and the next generation of producers.',
      'Kept this way, a catalogue keeps earning — culturally and commercially — long after release day.',
    ],
    media: 'IMG_6868',
    secondaryMedia: 'IMG_6879',
    approval: 'pending',
  },
  {
    key: 'academy',
    title: 'Academy',
    kicker: 'The handover of craft',
    summary: 'What took years to learn, taught deliberately — production, performance and the business of music.',
    body: [
      'The Academy passes on the unwritten parts of a career: how sessions run, how songs get finished, how contracts are read and how artists last.',
      'It is the pillar where the idea of The Handover becomes practical: knowledge given to the people who will carry it forward.',
    ],
    media: 'IMG_6867',
    secondaryMedia: 'IMG_6877',
    approval: 'pending',
  },
  {
    key: 'community',
    title: 'Community',
    kicker: 'The movement',
    summary: 'The people who carried the music this far, given a direct line in — early access, first word and a seat at the table.',
    body: [
      'Community is the fan relationship made direct: an email list and an optional WhatsApp line, early access to tickets and releases, and a membership pathway as the institution grows.',
      'It is built on explicit consent and a simple promise — only send what is worth receiving.',
    ],
    media: 'IMG_6877',
    secondaryMedia: 'IMG_6860',
    approval: 'pending',
  },
];

export const pressKit: z.input<typeof PressKit> = {
  shortBio:
    'Zakes Bantwini is a South African artist, producer, founder and curator — a cultural architect building a lasting institution around music: a festival, a label, a catalogue, an academy and a community.',
  longBio: [
    'Zakes Bantwini is a South African artist and producer whose work moves between the studio, the stage and the boardroom. Known first for the music, the next chapter is about what the music builds.',
    'As a producer, Zakes treats a record as architecture — foundations, structure and space — and brings the same thinking to performance, film and the rooms where other artists learn their craft.',
    'Under the banner of The Architect, that work is becoming an institution: a Festival to gather the culture, a Label to build artists, a Catalogue kept as a working archive, an Academy to pass on the craft, and a Community with a direct line in.',
  ],
  awards: [],
  quotes: [],
  performance: {
    formats: [
      { name: 'Headline performance', detail: 'Festival and concert headline sets with full production.' },
      { name: 'Live with band', detail: 'Performance with musicians for concerts, theatres and premium events.' },
      { name: 'Producer / DJ set', detail: 'A producer-led set for clubs, festivals and late slots.' },
      { name: 'Private and corporate', detail: 'Tailored performances for brand, corporate and private events.' },
    ],
    notes: 'Set lengths, line-ups and production requirements are confirmed per booking in the quote and technical rider.',
  },
  photos: ['IMG_6884', 'IMG_6882', 'IMG_6869', 'IMG_6875', 'IMG_6855', 'IMG_6853'],
  riderUrl: null,
  approval: 'pending',
};

const SEARCH = encodeURIComponent('Zakes Bantwini');

export const siteSettings: z.input<typeof SiteSettings> = {
  // Search links until management supplies the canonical artist profile URLs.
  streaming: {
    spotify: `https://open.spotify.com/search/${SEARCH}`,
    appleMusic: `https://music.apple.com/search?term=${SEARCH}`,
    youtube: `https://www.youtube.com/results?search_query=${SEARCH}`,
    deezer: `https://www.deezer.com/search/${SEARCH}`,
  },
  streamingApproval: 'pending',
  social: [],
  bookingEmail: null,
  pressEmail: null,
  featured: {
    albums: ['release-i', 'release-ii', 'release-iii', 'release-iv'],
    videos: ['official-video', 'live-film', 'short-film'],
    stories: ['what-an-archive-is-for', 'build-the-room', 'the-room-before-the-stage', 'a-festival-is-a-promise'],
  },
};
