/**
 * What still needs management before launch.
 *
 *   npm run content:audit             report (fails only if seed content is invalid)
 *   npm run content:audit -- --strict also fail while anything is unapproved
 *
 * Loading the seed validates every collection against its schema, so a
 * malformed edit fails here before it can fail a build. With DATABASE_URL set
 * (or a local .data/store.json) the audit covers the content as published:
 * the seed with management's admin edits laid over it.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { effectiveContent } from '../src/content/overlay';
import { seed } from '../src/content/seed';
import { allMedia, getMediaFile } from '../src/content/media';
import { FileStore } from '../src/lib/store/file-store';
import { PostgresStore } from '../src/lib/store/postgres-store';
import type { ContentEntry } from '../src/lib/cms/types';

const strict = process.argv.includes('--strict');

async function storedEntries(): Promise<{ entries: ContentEntry[]; from: string }> {
  if (process.env.DATABASE_URL) {
    const store = new PostgresStore(process.env.DATABASE_URL);
    try {
      return { entries: await store.list('content_entries'), from: 'seed + database edits' };
    } finally {
      await store.end();
    }
  }
  const file = process.env.FILE_STORE_PATH ?? path.join(process.cwd(), '.data', 'store.json');
  if (existsSync(file)) return { entries: await new FileStore(file).list('content_entries'), from: `seed + edits in ${path.relative(process.cwd(), file)}` };
  return { entries: [], from: 'seed only (no database configured)' };
}

const { entries: stored, from } = await storedEntries();
const { albums, videos, stories, pillars, pressKit: kit, settings } = effectiveContent(seed, stored);
console.log(`Source: ${from}`);

const entries = [
  ...albums.map((a) => ({ kind: 'release', id: a.slug, approval: a.approval })),
  ...videos.map((v) => ({ kind: 'video', id: v.slug, approval: v.approval, note: v.source ? '' : 'no video source' })),
  ...stories.map((s) => ({ kind: 'story', id: s.slug, approval: s.approval })),
  ...pillars.map((p) => ({ kind: 'pillar', id: p.key, approval: p.approval })),
  { kind: 'press kit', id: 'press', approval: kit.approval, note: kit.riderUrl ? '' : 'no technical rider' },
  { kind: 'settings', id: 'streaming links', approval: settings.streamingApproval },
];

const open = entries.filter((e) => e.approval !== 'approved');
console.log(`Content: ${entries.length} entries, ${entries.length - open.length} approved, ${open.length} awaiting management.\n`);
for (const e of open) console.log(`  ${e.approval.padEnd(11)} ${e.kind.padEnd(9)} ${e.id}${'note' in e && e.note ? `  (${e.note})` : ''}`);

const missing = [
  kit.awards.length === 0 && 'press kit: awards list (from management records)',
  kit.quotes.length === 0 && 'press kit: approved press quotes',
  !settings.bookingEmail && 'settings: public booking email',
  !settings.pressEmail && 'settings: public press email',
  settings.social.length === 0 && 'settings: official social profile links',
  albums.every((a) => !a.artwork) && 'releases: approved cover artwork',
].filter(Boolean);
if (missing.length) {
  console.log('\nNot yet supplied:');
  for (const m of missing) console.log(`  · ${m}`);
}

const media = allMedia();
const flagged = media.filter((m) => m.briefNote || m.caution);
const lowRes = media.filter((m) => getMediaFile(m.id).width < 1600);
console.log(`\nImages: ${media.length} supplied; ${lowRes.length} masters under 1600px wide (request originals for full-bleed use).`);
for (const m of flagged) console.log(`  ${String(m.index).padStart(2, '0')} ${getMediaFile(m.id).file}: ${m.briefNote ? 'brief text differs from file' : ''}${m.briefNote && m.caution ? '; ' : ''}${m.caution ? 'generated text in frame' : ''}`);

if (strict && open.length) {
  console.error(`\n--strict: ${open.length} entries are not approved. Launch with CONTENT_PUBLISH_APPROVED_ONLY=true or approve them.`);
  process.exit(1);
}
