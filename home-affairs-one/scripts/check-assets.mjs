#!/usr/bin/env node
/**
 * Acceptance check for the visual asset library (brief, Appendix F §4):
 *   - all 60 masters are present and byte-identical to when they were registered
 *   - every asset has alt text, a focal point, a placement and a review status
 *   - every asset is actually used: named in a screen, or in the sample content
 *     (catalogue, service points) that screens render
 *   - with --derived: every responsive derivative exists
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const wantDerived = process.argv.includes('--derived');
const source = JSON.parse(readFileSync(path.join(root, 'assets', 'manifest.json'), 'utf8')).assets;
const generatedPath = path.join(root, 'apps', 'web', 'src', 'generated', 'asset-manifest.json');
const generated = existsSync(generatedPath)
  ? JSON.parse(readFileSync(generatedPath, 'utf8')).assets
  : [];
const byId = new Map(generated.map((a) => [a.id, a]));
const problems = [];

if (source.length !== 60) problems.push(`expected 60 assets, found ${source.length}`);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}
// Screens name most photographs directly; service pages and service points take
// theirs from the sample content, so that is searched too.
const appSource = [
  path.join(root, 'apps', 'web', 'src'),
  path.join(root, 'services', 'service-catalogue', 'src'),
  path.join(root, 'services', 'appointments', 'src'),
]
  .flatMap(walk)
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

for (const asset of source) {
  const master = path.join(root, 'assets', 'masters', asset.source);
  if (!existsSync(master)) {
    problems.push(`${asset.id}: master ${asset.source} is missing`);
    continue;
  }
  const record = byId.get(asset.id);
  if (!record) {
    problems.push(`${asset.id}: not in the generated manifest — run npm run assets:derive`);
  } else {
    const sha = createHash('sha256').update(readFileSync(master)).digest('hex');
    if (sha !== record.sha256)
      problems.push(`${asset.id}: master has changed since it was registered`);
    if (wantDerived) {
      for (const width of record.widths) {
        const file = path.join(
          root,
          'apps/web/public/assets/home-affairs-one',
          `${asset.id}-${width}.webp`,
        );
        if (!existsSync(file)) problems.push(`${asset.id}: derivative ${width}w is missing`);
      }
    }
  }
  if (!asset.alt || asset.alt.length < 20)
    problems.push(`${asset.id}: alt text is missing or too short`);
  if (!Array.isArray(asset.focal) || asset.focal.length !== 2)
    problems.push(`${asset.id}: no focal point`);
  if (!asset.placements?.length) problems.push(`${asset.id}: no placement`);
  if (!['ok', 'check'].includes(asset.review)) problems.push(`${asset.id}: no review status`);
  if (asset.review === 'check' && !asset.reviewNote)
    problems.push(`${asset.id}: flagged without a note`);
  if (!new RegExp(`['"\`]${asset.id}['"\`]`).test(appSource)) {
    problems.push(`${asset.id}: not used by any screen or sample content`);
  }
}

if (problems.length) {
  console.error(`asset check failed (${problems.length}):\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(
  `asset check passed: ${source.length} masters present, unchanged, described and in use`,
);
