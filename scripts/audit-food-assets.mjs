#!/usr/bin/env node
/**
 * Food asset audit.
 *
 * The brief requires that every template food image be replaced by a supplied
 * bb.q master, with no generic or placeholder food imagery in the production UI.
 * This script is the gate: it reports which catalogue products still
 * have no artwork, and exits non-zero while any are outstanding — so a release
 * build cannot quietly ship with branded placeholders in the menu.
 *
 * Run: node scripts/audit-food-assets.mjs
 * Add --warn to report without failing (useful during development).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { foodCatalogue } from './lib/food-catalogue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mastersDir = path.join(root, 'assets', 'food', 'masters');
const VARIANTS = ['thumb', 'card', 'detail', 'banner'];

/** Mirrors SUBSTITUTE_ASSET_KEYS in src/constants/foodAssets.ts. */
// Empty while every product has its own artwork; mirrors
// SUBSTITUTE_ASSET_KEYS in src/constants/foodAssets.ts.
const SUBSTITUTES = {};

/**
 * Read off src/constants/foodAssets.ts. This was a third hand-written copy of
 * the catalogue, carrying key, filename and label, under a comment asking to
 * be kept in step with the record it duplicated — see lib/food-catalogue.mjs.
 *
 * An audit built on its own copy of the list is the worst place for one: a
 * product missing from it is reported as fully supplied, because the audit
 * never knew to look for it.
 */
const CATALOGUE = foodCatalogue();

const warnOnly = process.argv.includes('--warn');

const supplied = [];
const missingMaster = [];
const missingDerivatives = [];

for (const { key, filename, label } of CATALOGUE) {
  const master = path.join(mastersDir, `${filename}.jpg`);
  if (!fs.existsSync(master)) {
    missingMaster.push({ key, filename, label });
    continue;
  }

  const absentVariants = VARIANTS.filter(
    (variant) => !fs.existsSync(path.join(root, 'assets', 'food', variant, `${filename}.jpg`)),
  );

  if (absentVariants.length > 0) {
    missingDerivatives.push({ key, filename, label, absentVariants });
  } else {
    supplied.push({ key, filename, label });
  }
}

console.log('bb.q Chicken — food asset audit\n');
console.log(`  Supplied and derived : ${supplied.length}/${CATALOGUE.length}`);
console.log(`  Master missing       : ${missingMaster.length}`);
console.log(`  Derivatives missing  : ${missingDerivatives.length}\n`);

if (supplied.length > 0) {
  console.log('Ready:');
  supplied.forEach(({ label }) => console.log(`  ✓ ${label}`));
  console.log('');
}

if (missingDerivatives.length > 0) {
  console.log('Master present but derivatives missing — run `npm run assets:derive`:');
  missingDerivatives.forEach(({ label, absentVariants }) =>
    console.log(`  ! ${label} (missing ${absentVariants.join(', ')})`),
  );
  console.log('');
}

if (missingMaster.length > 0) {
  console.log('Awaiting supplied bb.q artwork — drop the master into assets/food/masters/:');
  missingMaster.forEach(({ key, filename, label }) => {
    const standIn = SUBSTITUTES[key];
    const note = standIn ? `borrowing ${standIn}` : 'branded placeholder';
    console.log(`  ✗ ${label.padEnd(26)} → ${filename.padEnd(22)} (${note})`);
  });
  console.log('');
}

/**
 * How much of the detail hero's target width the artwork can actually reach.
 *
 * The pipeline documents `detail 4:5 1200px (Retina @2x-3x)` and has never
 * produced it for a single product — not one of the original sixteen, and not
 * one added since. Every master is a landscape or near-square frame, so a 4:5
 * cover crop is limited by its height, and the promo compositions lose more
 * again to their `promo_safe` rects. The pipeline is right to cap rather than
 * upscale; nothing was ever wrong with the code. What was wrong is that the
 * number in the comment was a target nobody measured against, so heroes have
 * been shipping between 530px and 1122px wide into a 390pt box, and the ones
 * at the bottom of that range are visibly soft on a 3x phone.
 *
 * Reported rather than failed: every product is affected, so failing the build
 * would only teach people to pass --warn. What this can do is put a number on
 * the shoot list — the fix is taller masters, which is a request to whoever
 * supplies the photography, not a change anybody can make here.
 */
const DETAIL_TARGET = 1200;

function detailWidth(filename) {
  const file = path.join(root, 'assets', 'food', 'detail', `${filename}.jpg`);
  if (!fs.existsSync(file)) return null;
  // JPEG SOF marker: walk the segments rather than adding an image library to
  // a script whose whole job is to run without one.
  const buf = fs.readFileSync(file);
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return buf.readUInt16BE(offset + 7);
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

const soft = supplied
  .map(({ filename, label }) => ({ label, width: detailWidth(filename) }))
  .filter((entry) => entry.width !== null && entry.width < DETAIL_TARGET)
  .sort((a, b) => a.width - b.width);

if (soft.length > 0) {
  console.log(
    `Detail heroes below the ${DETAIL_TARGET}px target (${soft.length}/${supplied.length}) — ` +
      'the masters are not tall enough for a 4:5 crop at that width:',
  );
  for (const { label, width } of soft) {
    console.log(`  · ${label.padEnd(30)} ${String(width).padStart(4)}px`);
  }
  console.log('  Fix is taller masters, not a pipeline change: it caps rather than upscales.\n');
}

const outstanding = missingMaster.length + missingDerivatives.length;

if (outstanding === 0) {
  console.log(
    `All ${CATALOGUE.length} catalogue products have supplied artwork. Cleared for production.`,
  );
  process.exit(0);
}

const borrowing = missingMaster.filter(({ key }) => SUBSTITUTES[key]).length;
console.log(
  `${outstanding} product${outstanding === 1 ? '' : 's'} still owe a shoot ` +
    `(${borrowing} borrowing a related photo, ${outstanding - borrowing} on the branded placeholder).`,
);

if (warnOnly) {
  console.log('(--warn set: not failing the build.)');
  process.exit(0);
}

process.exit(1);
