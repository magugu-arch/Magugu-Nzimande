#!/usr/bin/env node
/**
 * Food asset audit.
 *
 * The brief requires that every template food image be replaced by a supplied
 * bb.q master, with no generic or placeholder food imagery in the production UI.
 * This script is the gate: it reports which of the 16 catalogue products still
 * have no artwork, and exits non-zero while any are outstanding — so a release
 * build cannot quietly ship with branded placeholders in the menu.
 *
 * Run: node scripts/audit-food-assets.mjs
 * Add --warn to report without failing (useful during development).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mastersDir = path.join(root, 'assets', 'food', 'masters');
const VARIANTS = ['thumb', 'card', 'detail', 'banner'];

// Kept in step with FOOD_ASSET_FILENAMES in src/constants/foodAssets.ts.
/** Mirrors SUBSTITUTE_ASSET_KEYS in src/constants/foodAssets.ts. */
// Empty while every product has its own artwork; mirrors
// SUBSTITUTE_ASSET_KEYS in src/constants/foodAssets.ts.
const SUBSTITUTES = {};

const CATALOGUE = [
  ['goldenOriginal', 'golden-original', 'Golden Original Chicken'],
  ['honeyGarlic', 'honey-garlic', 'Honey Garlic Chicken'],
  ['soyGarlic', 'soy-garlic', 'Soy Garlic Chicken'],
  ['secretSauce', 'secret-sauce', 'Secret Sauce Chicken'],
  ['hotSpicy', 'hot-spicy', 'Hot Spicy Chicken'],
  ['cheesling', 'cheesling', 'Cheesling Chicken'],
  ['goldenOriginalWings', 'golden-original-wings', 'Golden Original Wings'],
  ['boneless', 'boneless', 'Boneless Chicken'],
  ['halfAndHalf', 'half-and-half', 'Half & Half Chicken'],
  ['chickenRiceMeal', 'chicken-rice-meal', 'Chicken & Rice Meal'],
  ['chickenBurger', 'chicken-burger', 'Chicken Burger'],
  ['koreanRiceBowl', 'korean-rice-bowl', 'Korean Rice Bowl'],
  ['frenchFries', 'french-fries', 'French Fries'],
  ['cheeslingFries', 'cheesling-fries', 'Cheesling Fries'],
  ['ddeokBokki', 'ddeok-bokki', 'Ddeok-Bokki'],
  ['roseDdeokBokki', 'rose-ddeok-bokki', 'Rose Ddeok-Bokki'],
];

const warnOnly = process.argv.includes('--warn');

const supplied = [];
const missingMaster = [];
const missingDerivatives = [];

for (const [key, filename, label] of CATALOGUE) {
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
  console.log('All 16 catalogue products have supplied artwork. Cleared for production.');
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
