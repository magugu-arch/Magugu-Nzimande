import sharp from 'sharp';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getAlbums, getSettings, getStories } from '@/content';
import { COLLECTION_SCHEMA, effectiveContent, keyOf, mergeList } from '@/content/overlay';
import { Album, SiteSettings, Story, Video } from '@/content/schema';
import { seed } from '@/content/seed';
import { imageSize } from '@/lib/cms/assets';
import { formErrors, fromFormValues, parseDuration, storyBodyFromText, storyBodyToText, toFormValues, youtubeId, type FormValues } from '@/lib/cms/forms';
import { CONTENT_COLLECTIONS, contentEntryId, type ContentCollection, type ContentEntry } from '@/lib/cms/types';
import { setStoreForTesting } from '@/lib/store';
import type { Store } from '@/lib/store/types';
import { storeHarnesses } from './stores';

const IMAGE = { id: 'a1b2c3', filename: 'release-i-cover.jpg', width: 3000, height: 3000 };
const ctx = (slug: string) => ({ slug, images: [IMAGE] });

function entry(collection: ContentCollection, slug: string, data: unknown, extra: Partial<ContentEntry> = {}): ContentEntry {
  return { id: contentEntryId(collection, slug), collection, slug, data, archived: false, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'Test', ...extra };
}

describe('content forms', () => {
  it('round-trips every seed entry through its form unchanged', () => {
    const cases: [ContentCollection, unknown, string][] = [
      ...seed.albums.map((a) => ['albums', a, a.slug] as [ContentCollection, unknown, string]),
      ...seed.videos.map((v) => ['videos', v, v.slug] as [ContentCollection, unknown, string]),
      ...seed.stories.map((s) => ['stories', s, s.slug] as [ContentCollection, unknown, string]),
      ...seed.pillars.map((p) => ['pillars', p, p.key] as [ContentCollection, unknown, string]),
      ['pressKit', seed.pressKit, 'default'],
      ['settings', seed.settings, 'default'],
    ];
    expect(cases.length).toBeGreaterThan(20);
    for (const [collection, item, slug] of cases) {
      const back = COLLECTION_SCHEMA[collection].parse(fromFormValues(collection, toFormValues(collection, item), ctx(slug)));
      expect(back, `${collection}/${slug}`).toEqual(item);
    }
  });

  it('reads a full release: artwork sized from the upload, tracks, credits and links', () => {
    const values: FormValues = {
      title: 'Release I',
      kind: 'album',
      year: '2026',
      mood: 'IMG_6848',
      description: 'Approved description.',
      artworkSrc: '/assets/a1b2c3/release-i-cover.jpg',
      artworkAlt: 'Cover of Release I',
      tracks: 'Opening | 4:05 | /assets/d4e5f6/opening.mp3 | Guest One, Guest Two | ZAAB12600001\nSecond\n',
      credits: 'Producer: A. Producer\nMix: B. Engineer',
      spotify: 'https://open.spotify.com/album/x',
      relatedVideos: ['official-video', 'live-film'],
      approval: 'approved',
    };
    const album = Album.parse(fromFormValues('albums', values, ctx('release-i')));
    expect(album.artwork).toEqual({ src: '/assets/a1b2c3/release-i-cover.jpg', alt: 'Cover of Release I', width: 3000, height: 3000 });
    expect(album.tracks).toEqual([
      { title: 'Opening', durationSeconds: 245, audioUrl: '/assets/d4e5f6/opening.mp3', featuring: ['Guest One', 'Guest Two'], isrc: 'ZAAB12600001' },
      { title: 'Second', featuring: [] },
    ]);
    expect(album.credits).toEqual([
      { role: 'Producer', name: 'A. Producer' },
      { role: 'Mix', name: 'B. Engineer' },
    ]);
    expect(album.links).toEqual({ spotify: 'https://open.spotify.com/album/x' });
    expect(album.relatedVideos).toEqual(['official-video', 'live-film']);
  });

  it('names the form field and line for each problem', () => {
    const values: FormValues = { title: '', kind: 'album', mood: 'IMG_6848', description: '', tracks: 'Fine | 3:00\nBroken | three minutes', credits: 'No colon here', approval: 'approved' };
    const result = Album.safeParse(fromFormValues('albums', values, ctx('x')));
    expect(result.success).toBe(false);
    const errors = formErrors(result.error!);
    expect(errors.title).toBeTruthy();
    expect(errors.tracks).toBe('Line 2: the length should look like 4:05');
    expect(errors.credits).toMatch(/^Line 1:/);
  });

  it('refuses script and data URLs anywhere a link is accepted', () => {
    const settings = toFormValues('settings', seed.settings);
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'ftp://example.com/x']) {
      const r = SiteSettings.safeParse(fromFormValues('settings', { ...settings, spotify: bad }, ctx('default')));
      expect(r.success, bad).toBe(false);
      expect(formErrors(r.error!).spotify).toBeTruthy();
    }
    const social = SiteSettings.safeParse(fromFormValues('settings', { ...settings, social: 'Instagram | javascript:alert(1)' }, ctx('default')));
    expect(formErrors(social.error!).social).toMatch(/^Line 1:/);
  });

  it('only accepts artwork that was uploaded', () => {
    const values = { ...toFormValues('albums', seed.albums[0]!), artworkSrc: 'https://elsewhere.example/cover.jpg', artworkAlt: 'Cover' };
    const r = Album.safeParse(fromFormValues('albums', values, ctx(seed.albums[0]!.slug)));
    expect(formErrors(r.error!).artworkSrc).toBe('Choose an uploaded image');
  });

  it('takes a YouTube video from any of the usual link shapes', () => {
    for (const link of ['dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ']) {
      expect(youtubeId(link), link).toBe('dQw4w9WgXcQ');
    }
    const v = Video.parse(fromFormValues('videos', { ...toFormValues('videos', seed.videos[0]!), sourceType: 'youtube', youtube: 'https://youtu.be/dQw4w9WgXcQ' }, ctx(seed.videos[0]!.slug)));
    expect(v.source).toEqual({ type: 'youtube', id: 'dQw4w9WgXcQ' });
  });

  it('reads the story body format, images and statements included', () => {
    const text = 'First paragraph\ncontinues here.\n\n## A heading\n\n> A statement.\n\n[image IMG_6866 | Rehearsal]\n\nLast.';
    const body = storyBodyFromText(text);
    expect(body).toEqual([
      { type: 'p', text: 'First paragraph continues here.' },
      { type: 'h2', text: 'A heading' },
      { type: 'statement', text: 'A statement.' },
      { type: 'image', media: 'IMG_6866', caption: 'Rehearsal' },
      { type: 'p', text: 'Last.' },
    ]);
    const story = Story.parse({ ...seed.stories[0]!, body });
    expect(storyBodyToText(story.body)).toBe(text.replace('paragraph\ncontinues', 'paragraph continues'));
    expect(Story.safeParse({ ...seed.stories[0]!, body: storyBodyFromText('[image NOT_AN_IMAGE]') }).success).toBe(false);
  });

  it('parses durations', () => {
    expect(parseDuration('4:05')).toBe(245);
    expect(parseDuration('1:02:03')).toBe(3723);
    expect(parseDuration('245')).toBe(245);
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('four')).toBeNaN();
  });
});

describe('content overlay', () => {
  const edited = { ...seed.albums[0]!, title: 'The Approved Title', approval: 'approved' as const };
  const added = { ...seed.albums[1]!, slug: 'new-release', title: 'New Release' };

  it('replaces seed entries in place and puts new entries first', () => {
    const merged = mergeList('albums', seed.albums, [entry('albums', edited.slug, edited), entry('albums', 'new-release', added, { createdAt: '2026-10-05T00:00:00.000Z' })]);
    expect(merged.map((m) => keyOf('albums', m.item))).toEqual(['new-release', ...seed.albums.map((a) => a.slug)]);
    expect(merged[1]).toMatchObject({ origin: 'edited', item: { title: 'The Approved Title' } });
    expect(merged[0]!.origin).toBe('new');
  });

  it('drops archived entries from the public view only', () => {
    const entries = [entry('albums', edited.slug, edited, { archived: true })];
    expect(mergeList('albums', seed.albums, entries)[0]!.archived).toBe(true);
    expect(effectiveContent(seed, entries).albums.map((a) => a.slug)).not.toContain(edited.slug);
  });

  it('ignores stored entries that no longer validate, or whose key does not match', () => {
    const entries = [entry('albums', seed.albums[0]!.slug, { ...edited, kind: 'mixtape' }), entry('albums', 'elsewhere', edited)];
    const content = effectiveContent(seed, entries);
    expect(content.albums).toEqual(seed.albums);
  });

  it('lays a stored singleton over the seed', () => {
    const settings = { ...seed.settings, bookingEmail: 'bookings@example.com' };
    expect(effectiveContent(seed, [entry('settings', 'default', settings)]).settings.bookingEmail).toBe('bookings@example.com');
  });
});

describe.each(storeHarnesses())('content from the store — $name', (harness) => {
  let store: Store;
  beforeEach(async () => {
    store = await harness.fresh();
    setStoreForTesting(store);
  });
  afterEach(() => setStoreForTesting(undefined));
  afterAll(() => harness.close());

  it('serves saved edits on the public getters', async () => {
    const story = { ...seed.stories[0]!, title: 'Edited headline', approval: 'approved' as const };
    await store.upsert('content_entries', entry('stories', story.slug, story));
    await store.upsert('content_entries', entry('settings', 'default', { ...seed.settings, pressEmail: 'press@example.com' }));
    const albums = { ...seed.albums[2]!, title: 'Hidden one' };
    await store.upsert('content_entries', entry('albums', albums.slug, albums, { archived: true }));

    expect((await getStories()).find((s) => s.slug === story.slug)?.title).toBe('Edited headline');
    expect((await getSettings()).pressEmail).toBe('press@example.com');
    expect((await getAlbums()).map((a) => a.slug)).not.toContain(albums.slug);
    const back = await store.get('content_entries', contentEntryId('stories', story.slug));
    expect(back?.data).toEqual(story);
  });

  it('records public assets with nullable dimensions', async () => {
    const asset = { id: 'f00', kind: 'document' as const, filename: 'rider.pdf', contentType: 'application/pdf', size: 1234, storageKey: 'site/f00.pdf', width: null, height: null, label: 'Rider', uploadedBy: 'Test', createdAt: '2026-10-06T08:00:00.000Z' };
    await store.insert('public_assets', asset);
    expect(await store.get('public_assets', 'f00')).toEqual(asset);
  });
});

it('every collection has a schema', () => {
  for (const c of CONTENT_COLLECTIONS) expect(COLLECTION_SCHEMA[c]).toBeTruthy();
});

describe('image size from headers', () => {
  it.each([
    ['image/png', () => sharp({ create: { width: 640, height: 427, channels: 3, background: '#000' } }).png().toBuffer()],
    ['image/jpeg', () => sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#123' } }).jpeg().toBuffer()],
    ['image/webp', () => sharp({ create: { width: 801, height: 333, channels: 3, background: '#456' } }).webp().toBuffer()],
    ['image/webp', () => sharp({ create: { width: 300, height: 200, channels: 4, background: '#4566' } }).webp({ lossless: true }).toBuffer()],
  ])('%s', async (type, make) => {
    const buf = await make();
    const meta = await sharp(buf).metadata();
    expect(imageSize(buf, type)).toEqual({ width: meta.width, height: meta.height });
  });
});
