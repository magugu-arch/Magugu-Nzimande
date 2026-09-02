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
