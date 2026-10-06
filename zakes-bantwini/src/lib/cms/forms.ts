/**
 * The admin's content forms, both ways: an entry becomes plain form values
 * (lists as one line per item, cells separated by "|"), and submitted values
 * become a candidate entry for the collection's Zod schema to judge. Pure, so
 * it is tested directly.
 */
import type { z } from 'zod';
import type { Album, Pillar, PressKit, SiteSettings, Story, StoryBlock, Video } from '@/content/schema';
import type { ContentCollection, PublicAsset } from './types';

export type FormValues = Record<string, string | string[]>;

export function formValues(form: FormData): FormValues {
  const out: FormValues = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== 'string' || k.startsWith('$')) continue;
    const prev = out[k];
    out[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return out;
}

const str = (v: FormValues, k: string): string => {
  const x = v[k];
  return (Array.isArray(x) ? (x[0] ?? '') : (x ?? '')).trim();
};
const all = (v: FormValues, k: string): string[] => {
  const x = v[k];
  return (x === undefined ? [] : Array.isArray(x) ? x : [x]).map((s) => s.trim()).filter(Boolean);
};
const opt = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);
const nul = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

/** Non-empty lines, each split into trimmed "|" cells. */
export function lines(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split('|').map((c) => c.trim()));
}

/** Paragraphs separated by blank lines; single line breaks inside one are joined. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.replace(/\s*\r?\n\s*/g, ' ').trim())
    .filter(Boolean);
}

const csv = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** "3:45" or "225" → seconds. Blank → undefined; nonsense → NaN for the schema to reject. */
export function parseDuration(s: string | undefined): number | undefined {
  const t = (s ?? '').trim();
  if (!t) return undefined;
  const m = /^(?:(\d+):)?(\d+):(\d{2})$/.exec(t);
  if (m) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A YouTube video id from a pasted id or any of the usual link shapes. */
export function youtubeId(input: string): string {
  const t = input.trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1, 12);
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = /^\/(?:embed|shorts|live|v)\/([\w-]{11})/.exec(u.pathname);
      if (m) return m[1]!;
    }
  } catch {
    // Not a URL: the schema reports it.
  }
  return t;
}

const VIDEO_MIME: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

const links = (v: FormValues) =>
  Object.fromEntries(
    (['spotify', 'appleMusic', 'youtube', 'deezer'] as const).flatMap((k) => {
      const value = opt(str(v, k));
      return value ? [[k, value]] : [];
    }),
  );

// ── Story body: a small plain-text format editors can type ──
//   blank line           → new block
//   ## Heading           → heading
//   > Statement          → pull statement
//   [image IMG_6866 | Caption]  → one of the supplied images

export function storyBodyToText(blocks: StoryBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h2':
          return `## ${b.text}`;
        case 'statement':
          return `> ${b.text}`;
        case 'image':
          return `[image ${b.media}${b.caption ? ` | ${b.caption}` : ''}]`;
        default:
          return b.text;
      }
    })
    .join('\n\n');
}

export function storyBodyFromText(text: string): unknown[] {
  return paragraphs(text).map((p) => {
    const image = /^\[image\s+([\w-]+)\s*(?:\|\s*(.*?))?\s*\]$/i.exec(p);
    if (image) return { type: 'image', media: image[1], ...(image[2] ? { caption: image[2] } : {}) };
    if (p.startsWith('## ')) return { type: 'h2', text: p.slice(3).trim() };
    if (p.startsWith('> ')) return { type: 'statement', text: p.slice(2).trim() };
    return { type: 'p', text: p };
  });
}

// ── Entry → form values ──

export function toFormValues(collection: ContentCollection, entry: unknown): FormValues {
  switch (collection) {
    case 'albums': {
      const a = entry as Album;
      return {
        slug: a.slug,
        title: a.title,
        kind: a.kind,
        year: a.year ? String(a.year) : '',
        mood: a.mood,
        description: a.description,
        artworkSrc: a.artwork?.src ?? '',
        artworkAlt: a.artwork?.alt ?? '',
        credits: a.credits.map((c) => `${c.role}: ${c.name}`).join('\n'),
        tracks: a.tracks
          .map((t) => [t.title, formatDuration(t.durationSeconds), t.audioUrl ?? '', t.featuring.join(', '), t.isrc ?? ''].join(' | ').replace(/( \| )+$/, ''))
          .join('\n'),
        spotify: a.links.spotify ?? '',
        appleMusic: a.links.appleMusic ?? '',
        youtube: a.links.youtube ?? '',
        deezer: a.links.deezer ?? '',
        relatedVideos: a.relatedVideos,
        relatedStories: a.relatedStories,
        approval: a.approval,
        editorNote: a.editorNote ?? '',
      };
    }
    case 'videos': {
      const v = entry as Video;
      return {
        slug: v.slug,
        title: v.title,
        kind: v.kind,
        poster: v.poster,
        sourceType: v.source?.type ?? 'none',
        youtube: v.source?.type === 'youtube' ? `https://www.youtube.com/watch?v=${v.source.id}` : '',
        fileSrc: v.source?.type === 'file' ? v.source.src : '',
        captions: v.source?.type === 'file' ? v.source.captions.map((c) => `${c.label} | ${c.lang} | ${c.src}`).join('\n') : '',
        duration: formatDuration(v.durationSeconds),
        publishedAt: v.publishedAt ?? '',
        description: v.description,
        relatedAlbum: v.relatedAlbum ?? '',
        approval: v.approval,
      };
    }
    case 'stories': {
      const s = entry as Story;
      return {
        slug: s.slug,
        title: s.title,
        category: s.category,
        standfirst: s.standfirst,
        hero: s.hero,
        body: storyBodyToText(s.body),
        publishedAt: s.publishedAt ?? '',
        approval: s.approval,
      };
    }
    case 'pillars': {
      const p = entry as Pillar;
      return {
        slug: p.key,
        title: p.title,
        kicker: p.kicker,
        summary: p.summary,
        body: p.body.join('\n\n'),
        media: p.media,
        secondaryMedia: p.secondaryMedia ?? '',
        approval: p.approval,
      };
    }
    case 'pressKit': {
      const k = entry as PressKit;
      return {
        shortBio: k.shortBio,
        longBio: k.longBio.join('\n\n'),
        awards: k.awards.map((a) => [String(a.year), a.title, a.detail ?? ''].join(' | ').replace(/ \| $/, '')).join('\n'),
        quotes: k.quotes.map((q) => [q.quote, q.source, q.url ?? ''].join(' | ').replace(/ \| $/, '')).join('\n'),
        formats: k.performance.formats.map((f) => `${f.name} | ${f.detail}`).join('\n'),
        performanceNotes: k.performance.notes,
        photos: k.photos,
        riderUrl: k.riderUrl ?? '',
        approval: k.approval,
      };
    }
    case 'settings': {
      const s = entry as SiteSettings;
      return {
        spotify: s.streaming.spotify ?? '',
        appleMusic: s.streaming.appleMusic ?? '',
        youtube: s.streaming.youtube ?? '',
        deezer: s.streaming.deezer ?? '',
        streamingApproval: s.streamingApproval,
        social: s.social.map((l) => `${l.label} | ${l.url}`).join('\n'),
        bookingEmail: s.bookingEmail ?? '',
        pressEmail: s.pressEmail ?? '',
        featuredAlbums: s.featured.albums.join(', '),
        featuredVideos: s.featured.videos.join(', '),
        featuredStories: s.featured.stories.join(', '),
      };
    }
  }
}

// ── Form values → candidate entry ──

export type ParseContext = {
  /** The entry's key. Fixed for an existing entry; from the form for a new one. */
  slug: string;
  /** Uploaded images, to size the cover art. */
  images: Pick<PublicAsset, 'id' | 'filename' | 'width' | 'height'>[];
};

export function fromFormValues(collection: ContentCollection, v: FormValues, ctx: ParseContext): unknown {
  switch (collection) {
    case 'albums': {
      const artworkSrc = str(v, 'artworkSrc');
      const image = ctx.images.find((i) => `/assets/${i.id}/${i.filename}` === artworkSrc);
      return {
        slug: ctx.slug,
        title: str(v, 'title'),
        kind: str(v, 'kind'),
        year: str(v, 'year') ? Number(str(v, 'year')) : null,
        artwork: artworkSrc ? { src: artworkSrc, alt: str(v, 'artworkAlt'), width: image?.width ?? 0, height: image?.height ?? 0 } : null,
        mood: str(v, 'mood'),
        description: str(v, 'description'),
        credits: lines(str(v, 'credits')).map((cells) => {
          const line = cells.join(' | ');
          const i = line.indexOf(':');
          return i > 0 ? { role: line.slice(0, i).trim(), name: line.slice(i + 1).trim() } : { role: '', name: line };
        }),
        tracks: lines(str(v, 'tracks')).map(([title = '', duration, audioUrl, featuring, isrc]) => ({
          title,
          durationSeconds: parseDuration(duration),
          audioUrl: opt(audioUrl),
          featuring: csv(featuring ?? ''),
          isrc: opt(isrc),
        })),
        links: links(v),
        relatedVideos: all(v, 'relatedVideos'),
        relatedStories: all(v, 'relatedStories'),
        approval: str(v, 'approval'),
        editorNote: opt(str(v, 'editorNote')),
      };
    }
    case 'videos': {
      const type = str(v, 'sourceType');
      const fileSrc = str(v, 'fileSrc');
      const ext = fileSrc.split('?')[0]!.split('.').pop()?.toLowerCase() ?? '';
      return {
        slug: ctx.slug,
        title: str(v, 'title'),
        kind: str(v, 'kind'),
        poster: str(v, 'poster'),
        source:
          type === 'youtube'
            ? { type: 'youtube', id: youtubeId(str(v, 'youtube')) }
            : type === 'file'
              ? {
                  type: 'file',
                  src: fileSrc,
                  mime: VIDEO_MIME[ext] ?? 'video/mp4',
                  captions: lines(str(v, 'captions')).map(([label = '', lang = '', src = '']) => ({ label, lang, src })),
                }
              : null,
        durationSeconds: parseDuration(str(v, 'duration')),
        publishedAt: nul(str(v, 'publishedAt')),
        description: str(v, 'description'),
        relatedAlbum: opt(str(v, 'relatedAlbum')),
        approval: str(v, 'approval'),
      };
    }
    case 'stories':
      return {
        slug: ctx.slug,
        title: str(v, 'title'),
        category: str(v, 'category'),
        standfirst: str(v, 'standfirst'),
        hero: str(v, 'hero'),
        body: storyBodyFromText(str(v, 'body')),
        publishedAt: nul(str(v, 'publishedAt')),
        approval: str(v, 'approval'),
      };
    case 'pillars':
      return {
        key: ctx.slug,
        title: str(v, 'title'),
        kicker: str(v, 'kicker'),
        summary: str(v, 'summary'),
        body: paragraphs(str(v, 'body')),
        media: str(v, 'media'),
        secondaryMedia: opt(str(v, 'secondaryMedia')),
        approval: str(v, 'approval'),
      };
    case 'pressKit':
      return {
        shortBio: str(v, 'shortBio'),
        longBio: paragraphs(str(v, 'longBio')),
        awards: lines(str(v, 'awards')).map(([year = '', title = '', detail]) => ({ year: /^\d{4}$/.test(year) ? Number(year) : NaN, title, detail: opt(detail) })),
        quotes: lines(str(v, 'quotes')).map(([quote = '', source = '', url]) => ({ quote, source, url: opt(url) })),
        performance: {
          formats: lines(str(v, 'formats')).map(([name = '', ...detail]) => ({ name, detail: detail.join(' | ') })),
          notes: str(v, 'performanceNotes'),
        },
        photos: all(v, 'photos'),
        riderUrl: nul(str(v, 'riderUrl')),
        approval: str(v, 'approval'),
      };
    case 'settings':
      return {
        streaming: links(v),
        streamingApproval: str(v, 'streamingApproval'),
        social: lines(str(v, 'social')).map(([label = '', url = '']) => ({ label, url })),
        bookingEmail: nul(str(v, 'bookingEmail')),
        pressEmail: nul(str(v, 'pressEmail')),
        featured: { albums: csv(str(v, 'featuredAlbums')), videos: csv(str(v, 'featuredVideos')), stories: csv(str(v, 'featuredStories')) },
      };
  }
}

/** Form fields that hold one item per line, so errors can name the line. */
const LINE_FIELDS = new Set(['credits', 'tracks', 'captions', 'awards', 'quotes', 'formats', 'social', 'body', 'longBio']);

/** Where a schema path shows up in the form. */
const FIELD_FOR_PATH: Record<string, string> = {
  'links.spotify': 'spotify',
  'links.appleMusic': 'appleMusic',
  'links.youtube': 'youtube',
  'links.deezer': 'deezer',
  'streaming.spotify': 'spotify',
  'streaming.appleMusic': 'appleMusic',
  'streaming.youtube': 'youtube',
  'streaming.deezer': 'deezer',
  'artwork.src': 'artworkSrc',
  'artwork.alt': 'artworkAlt',
  'artwork.width': 'artworkSrc',
  'artwork.height': 'artworkSrc',
  'source.id': 'youtube',
  'source.src': 'fileSrc',
  'source.captions': 'captions',
  'performance.formats': 'formats',
  'performance.notes': 'performanceNotes',
  'featured.albums': 'featuredAlbums',
  'featured.videos': 'featuredVideos',
  'featured.stories': 'featuredStories',
  durationSeconds: 'duration',
  key: 'slug',
};

const FRIENDLY: Record<string, string> = {
  youtube: 'Paste a YouTube link or the 11-character video id',
  artworkSrc: 'Choose an uploaded image',
  artworkAlt: 'Describe the cover for people who cannot see it',
  slug: 'Use lower-case words separated by hyphens',
  duration: 'Use minutes:seconds, e.g. 4:05',
  bookingEmail: 'Enter a valid email address',
  pressEmail: 'Enter a valid email address',
};

/** Schema issues → { formField: message }, first issue per field. */
export function formErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String);
    const two = path.slice(0, 2).join('.');
    let field = FIELD_FOR_PATH[two] ?? FIELD_FOR_PATH[path[0] ?? ''] ?? path[0] ?? 'form';
    let lineIndex: number | undefined;
    if (field === 'source.captions' || two === 'source.captions') field = 'captions';
    const indexAt = path.findIndex((p) => /^\d+$/.test(p));
    if (indexAt >= 0 && LINE_FIELDS.has(field)) lineIndex = Number(path[indexAt]);
    if (out[field]) continue;
    const base = FRIENDLY[field] ?? issue.message.replace(/^Invalid input: /, '');
    out[field] = lineIndex !== undefined ? `Line ${lineIndex + 1}: ${field === 'tracks' ? trackHint(path) : base}` : base;
  }
  return out;
}

function trackHint(path: string[]): string {
  switch (path[2]) {
    case 'title':
      return 'every track needs a title';
    case 'durationSeconds':
      return 'the length should look like 4:05';
    case 'audioUrl':
      return 'the audio must be an uploaded file (/assets/…) or an https link';
    default:
      return 'check this line';
  }
}
