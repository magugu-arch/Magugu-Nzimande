#!/usr/bin/env node
/**
 * The asset gate for the 24 verified MAXHOSA images (and any approved additions).
 *
 * The brief allows exactly these 24 files unless the brand approves another,
 * so this fails the build rather than warning. In check mode (the default) it
 * confirms:
 *
 *   - the manifest lists the 24 verified entries, ids mx-asset-01…24, then any
 *     additions in sequence — each of which must record who supplied it, when,
 *     why and its approval status; no duplicates
 *   - every file exists, is a regular file inside assets/maxhosa/, and decodes
 *     as a complete JPEG (SOI, a frame header, a scan, EOI)
 *   - no two files are the same image (by SHA-256)
 *   - hashes, byte counts and pixel sizes match what the manifest recorded
 *   - nothing else is in the folder, and no excluded source has crept in
 *   - the typed registry the app imports is in step with the manifest
 *
 * `--write` recomputes the hashes and sizes, rewrites the Markdown manifest and
 * regenerates src/assets/registry.generated.ts. Run it after replacing the
 * preview files with the full-resolution masters.
 *
 * The pixel-level decode is done by Chromium in `npm run demo:test`; this
 * script is the structural half that runs in a second with no browser.
 *
 * Run: node scripts/assets.mjs [--write]
 */
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { lstatSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_DIR = path.join(root, 'assets', 'maxhosa');
const MANIFEST_JSON = path.join(ASSET_DIR, 'MAXHOSA_AFRICA_24_Image_Asset_Manifest.json');
const MANIFEST_MD = path.join(ASSET_DIR, 'MAXHOSA_AFRICA_24_Image_Asset_Manifest.md');
const REGISTRY = path.join(root, 'src', 'assets', 'registry.generated.ts');
const VERIFIED = 24;
const ADDITION_FIELDS = ['suppliedBy', 'date', 'purpose', 'approval'];
const ALLOWED_EXTRA = new Set([path.basename(MANIFEST_JSON), path.basename(MANIFEST_MD)]);
const FORBIDDEN = [/contact[_-]?sheet/i, /home[_-]?affairs/i, /\bdha\b/i];

const write = process.argv.includes('--write');
const failures = [];
const fail = (message) => failures.push(message);

/**
 * Walk a JPEG's marker segments far enough to prove it is whole, and read its
 * size from the frame header. Returns null when the structure is broken.
 */
export function readJpeg(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  if (buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) return null;
  let offset = 2;
  let size = null;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      size = { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xda) {
      // Start of scan: the entropy-coded data runs to EOI, already checked.
      return size && size.width > 0 && size.height > 0 ? size : null;
    }
    offset += 2 + length;
  }
  return null;
}

const manifest = JSON.parse(readFileSync(MANIFEST_JSON, 'utf8'));
const assets = manifest.assets ?? [];

if (assets.length < VERIFIED) fail(`manifest lists ${assets.length} assets, expected at least the ${VERIFIED} verified`);

const seenIds = new Set();
const seenFiles = new Set();
const seenHashes = new Map();

assets.forEach((asset, index) => {
  const expectedId = `mx-asset-${String(index + 1).padStart(2, '0')}`;
  if (asset.id !== expectedId) fail(`entry ${index + 1} has id ${asset.id}, expected ${expectedId}`);
  if (seenIds.has(asset.id)) fail(`duplicate id ${asset.id}`);
  seenIds.add(asset.id);
  if (seenFiles.has(asset.file)) fail(`duplicate file ${asset.file}`);
  seenFiles.add(asset.file);
  if (!asset.alt || asset.alt.length < 20) fail(`${asset.id} needs meaningful alt text`);
  if (asset.conceptAsset !== true) fail(`${asset.id} must stay flagged conceptAsset until approved`);
  if (index < VERIFIED && asset.addition) fail(`${asset.id} is one of the verified 24 and cannot be an addition`);
  if (index >= VERIFIED) {
    const missing = ADDITION_FIELDS.filter((f) => !asset.addition?.[f]);
    if (missing.length) fail(`${asset.id} is an addition and must record ${missing.join(', ')}`);
  }
  if (FORBIDDEN.some((re) => re.test(asset.file) || re.test(asset.sourceFilename ?? ''))) {
    fail(`${asset.id} names an excluded source`);
  }

  const full = path.resolve(ASSET_DIR, asset.file);
  if (path.dirname(full) !== ASSET_DIR) {
    fail(`${asset.id} resolves outside the asset folder: ${asset.file}`);
    return;
  }
  if (!existsSync(full)) {
    fail(`${asset.id} is missing: ${asset.file}`);
    return;
  }
  if (!lstatSync(full).isFile()) {
    fail(`${asset.id} is not a regular file (symlinks are not allowed): ${asset.file}`);
    return;
  }

  const buffer = readFileSync(full);
  const size = readJpeg(buffer);
  if (!size) {
    fail(`${asset.id} does not decode as a complete JPEG`);
    return;
  }
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const twin = seenHashes.get(sha256);
  if (twin) fail(`${asset.id} is the same image as ${twin}`);
  seenHashes.set(sha256, asset.id);

  if (write) {
    asset.bytes = buffer.length;
    asset.sha256 = sha256;
    asset.packagedSize = size;
  } else {
    if (asset.sha256 !== sha256) fail(`${asset.id} hash does not match the manifest`);
    if (asset.bytes !== buffer.length) fail(`${asset.id} byte count does not match the manifest`);
    const recorded = asset.packagedSize ?? {};
    if (recorded.width !== size.width || recorded.height !== size.height) {
      fail(`${asset.id} is ${size.width}×${size.height}, manifest says ${recorded.width}×${recorded.height}`);
    }
  }
});

for (const name of readdirSync(ASSET_DIR)) {
  if (!seenFiles.has(name) && !ALLOWED_EXTRA.has(name)) {
    fail(`unlisted file in the asset folder: ${name}`);
  }
}

function renderRegistry() {
  const entries = assets
    .map(
      (a) => `  '${a.id}': {
    id: '${a.id}',
    source: require('../../assets/maxhosa/${a.file}'),
    title: ${JSON.stringify(a.title)},
    alt: ${JSON.stringify(a.alt)},
    category: '${a.category}',
    placement: ${JSON.stringify(a.placement)},
    width: ${a.packagedSize?.width ?? 0},
    height: ${a.packagedSize?.height ?? 0},
    conceptAsset: true,${a.addition ? `\n    addition: ${JSON.stringify(a.addition)},` : ''}
  },`,
    )
    .join('\n');
  return `/**
 * GENERATED by \`npm run assets:manifest\` from
 * assets/maxhosa/MAXHOSA_AFRICA_24_Image_Asset_Manifest.json. Do not edit.
 */
import type { AssetRecord } from './types';

export const ASSET_IDS = ${JSON.stringify(assets.map((a) => a.id))} as const;

/** The 24 images in the verified manifest. */
export const VERIFIED_ASSET_IDS = ${JSON.stringify(assets.filter((a) => !a.addition).map((a) => a.id))} as const;

/** Images added later, each recording who supplied it, when, why and its approval. */
export const ADDITION_ASSET_IDS = ${JSON.stringify(assets.filter((a) => a.addition).map((a) => a.id))} as const;

export type AssetId = (typeof ASSET_IDS)[number];

export const assetRegistry: Record<AssetId, AssetRecord> = {
${entries}
};
`;
}

function renderMarkdown() {
  const rows = assets
    .map(
      (a) =>
        `| ${a.id} | ${a.title} | \`${a.sourceFilename}\` | ${a.masterSize.width}×${a.masterSize.height} | ${a.packagedSize.width}×${a.packagedSize.height} | ${a.placement.join(', ')} | \`${a.sha256.slice(0, 16)}…\` |`,
    )
    .join('\n');
  return `# ${manifest.name}

Source: ${manifest.source}

**Status: concept.** ${manifest.note}

Excluded and never to be used: ${manifest.excluded.join('; ')}.

| ID | Title | Original filename | Master size | Packaged size | Placement | SHA-256 |
|---|---|---|---|---|---|---|
${rows}

${
    assets.length > VERIFIED
      ? `\n## Additions outside the verified 24\n\n${manifest.additionsPolicy ?? ''}\n\n| ID | Supplied by | Date | Purpose | Approval |\n|---|---|---|---|---|\n${assets
          .slice(VERIFIED)
          .map((a) => `| ${a.id} | ${a.addition.suppliedBy} | ${a.addition.date} | ${a.addition.purpose} | ${a.addition.approval} |`)
          .join('\n')}\n`
      : ''
  }
Full hashes, byte counts and alt text are in the JSON manifest beside this file.
Run \`npm run assets:verify\` to check the folder against it.
`;
}

if (write && failures.length === 0) {
  writeFileSync(MANIFEST_JSON, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(MANIFEST_MD, renderMarkdown());
  writeFileSync(REGISTRY, renderRegistry());
} else if (!write) {
  if (!existsSync(REGISTRY) || readFileSync(REGISTRY, 'utf8') !== renderRegistry()) {
    fail('src/assets/registry.generated.ts is out of step with the manifest — run npm run assets:manifest');
  }
  if (!existsSync(MANIFEST_MD) || readFileSync(MANIFEST_MD, 'utf8') !== renderMarkdown()) {
    fail('the Markdown manifest is out of step with the JSON — run npm run assets:manifest');
  }
}

if (failures.length) {
  console.error(`Asset gate FAILED (${failures.length}):`);
  for (const message of failures) console.error(`  ✗ ${message}`);
  process.exit(1);
}
console.log(
  write
    ? `Wrote manifest, Markdown and registry for ${assets.length} assets.`
    : `Asset gate passed: ${VERIFIED} verified + ${assets.length - VERIFIED} approved addition(s), all unique, present, whole and in step.`,
);
