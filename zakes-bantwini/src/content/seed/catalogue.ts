import type { z } from 'zod';
import type { Album, Video } from '../schema';

/*
 * Catalogue and film slots. No release titles, years, tracklists, credits or
 * video sources have been supplied, and the brief forbids inventing them, so
 * each entry is a designed placeholder an editor fills in. Replace `title`,
 * `year`, `artwork`, `tracks` and `links` with management-approved metadata
 * and set `approval: 'approved'`.
 */

const SLOT_NOTE =
  'Placeholder slot. Replace with the approved title, year, cover artwork, credits, tracklist and streaming links.';

export const albums: z.input<typeof Album>[] = [
  {
    slug: 'release-i',
    title: 'Release I',
    kind: 'album',
    year: null,
    artwork: null,
    mood: 'IMG_6848',
    description:
      'The first room of the catalogue. Cover art, credits and the full tracklist publish here when management supplies the approved release record.',
    relatedVideos: ['official-video', 'studio-session'],
    relatedStories: ['what-an-archive-is-for', 'build-the-room'],
    approval: 'placeholder',
    editorNote: SLOT_NOTE,
  },
  {
    slug: 'release-ii',
    title: 'Release II',
    kind: 'album',
    year: null,
    artwork: null,
    mood: 'IMG_6879',
    description:
      'A second chapter of the catalogue, held for the approved release: artwork, year, collaborators and every track, each linked to listen.',
    relatedVideos: ['live-film'],
    relatedStories: ['the-room-before-the-stage'],
    approval: 'placeholder',
    editorNote: SLOT_NOTE,
  },
  {
    slug: 'release-iii',
    title: 'Release III',
    kind: 'ep',
    year: null,
    artwork: null,
    mood: 'IMG_6883',
    description:
      'Reserved for an approved EP. The sleeve is set in type until the original artwork arrives, so nothing generated stands in for the real thing.',
    relatedVideos: ['intimate-set'],
    relatedStories: ['sound-is-architecture'],
    approval: 'placeholder',
    editorNote: SLOT_NOTE,
  },
  {
    slug: 'release-iv',
    title: 'Release IV',
    kind: 'single',
    year: null,
    artwork: null,
    mood: 'IMG_6849',
    description:
      'Reserved for an approved single, with its official video and the story behind the record linked alongside.',
    relatedVideos: ['short-film'],
    relatedStories: ['directing-the-frame'],
    approval: 'placeholder',
    editorNote: SLOT_NOTE,
  },
];

const FILM_NOTE = 'Add the video file (with captions) or YouTube ID, the publish date and the running time in the CMS.';

export const videos: z.input<typeof Video>[] = [
  {
    slug: 'official-video',
    title: 'Official video',
    kind: 'official',
    poster: 'IMG_6851',
    source: null,
    publishedAt: null,
    description: `The lead official video. ${FILM_NOTE}`,
    relatedAlbum: 'release-i',
    approval: 'placeholder',
  },
  {
    slug: 'live-film',
    title: 'Live film',
    kind: 'live',
    poster: 'IMG_6865',
    source: null,
    publishedAt: null,
    description: `A full-scale live performance film. ${FILM_NOTE}`,
    relatedAlbum: 'release-ii',
    approval: 'placeholder',
  },
  {
    slug: 'short-film',
    title: 'Short film',
    kind: 'film',
    poster: 'IMG_6880',
    source: null,
    publishedAt: null,
    description: `A cinematic short from the production team. ${FILM_NOTE}`,
    relatedAlbum: 'release-iv',
    approval: 'placeholder',
  },
  {
    slug: 'studio-session',
    title: 'Studio session',
    kind: 'behind-the-scenes',
    poster: 'IMG_6881',
    source: null,
    publishedAt: null,
    description: `Inside a working session at the console. ${FILM_NOTE}`,
    approval: 'placeholder',
  },
  {
    slug: 'on-set',
    title: 'On set',
    kind: 'behind-the-scenes',
    poster: 'IMG_6859',
    source: null,
    publishedAt: null,
    description: `Behind the camera on a video shoot. ${FILM_NOTE}`,
    approval: 'placeholder',
  },
  {
    slug: 'intimate-set',
    title: 'Intimate set',
    kind: 'live',
    poster: 'IMG_6856',
    source: null,
    publishedAt: null,
    description: `A close-quarters performance for a small room. ${FILM_NOTE}`,
    relatedAlbum: 'release-iii',
    approval: 'placeholder',
  },
];
