/**
 * What still needs management before launch.
 *
 *   npm run content:audit             report (fails only if seed content is invalid)
 *   npm run content:audit -- --strict also fail while anything is unapproved
 *
 * Loading the content module validates every seed collection against its
 * schema, so a malformed edit fails here before it can fail a build.
 */
import { seedSource } from '../src/content/index';
import { allMedia, getMediaFile } from '../src/content/media';

const strict = process.argv.includes('--strict');

const [albums, videos, stories, pillars, kit, settings] = await Promise.all([
  seedSource.albums(),
  seedSource.videos(),
  seedSource.stories(),
  seedSource.pillars(),
  seedSource.pressKit(),
  seedSource.settings(),
]);

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
