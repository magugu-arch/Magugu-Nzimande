#!/usr/bin/env node
/**
 * Generate src/constants/foodAssetRegistry.ts from whatever masters exist.
 *
 * Metro resolves `require()` at build time by static analysis, so the asset map
 * cannot be built from a loop at runtime — every path has to be a literal. This
 * script writes those literals for exactly the products whose derivatives are
 * on disk, which makes adding a batch of artwork a one-command job:
 *
 *   cp new-photo.jpg assets/food/masters/secret-sauce.jpg
 *   npm run assets:derive        # derives crops, then regenerates this file
 *
 * Never edit the generated file by hand — it is overwritten on every run.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIANTS = ['thumb', 'card', 'detail', 'banner'];

/** Catalogue order matches FOOD_ASSET_KEYS in src/constants/foodAssets.ts. */
const CATALOGUE = [
  ['goldenOriginal', 'golden-original'],
  ['honeyGarlic', 'honey-garlic'],
  ['soyGarlic', 'soy-garlic'],
  ['secretSauce', 'secret-sauce'],
  ['hotSpicy', 'hot-spicy'],
  ['cheesling', 'cheesling'],
  ['goldenOriginalWings', 'golden-original-wings'],
  ['boneless', 'boneless'],
  ['halfAndHalf', 'half-and-half'],
  ['chickenRiceMeal', 'chicken-rice-meal'],
  ['chickenBurger', 'chicken-burger'],
  ['koreanRiceBowl', 'korean-rice-bowl'],
  ['frenchFries', 'french-fries'],
  ['cheeslingFries', 'cheesling-fries'],
  ['ddeokBokki', 'ddeok-bokki'],
  ['roseDdeokBokki', 'rose-ddeok-bokki'],
];

const present = CATALOGUE.filter(([, filename]) =>
  VARIANTS.every((variant) =>
    fs.existsSync(path.join(root, 'assets', 'food', variant, `${filename}.jpg`)),
  ),
);

const entries = present
  .map(([key, filename]) => {
    const lines = VARIANTS.map(
      (variant) => `    ${variant}: require('@assets/food/${variant}/${filename}.jpg'),`,
    ).join('\n');
    return `  ${key}: {\n${lines}\n  },`;
  })
  .join('\n');

const file = `/**
 * GENERATED FILE — do not edit.
 *
 * Written by scripts/generate-asset-registry.mjs from the masters present in
 * assets/food/masters/. Run \`npm run assets:derive\` after adding artwork.
 *
 * Metro needs static \`require()\` literals, which is why this is generated
 * rather than built from a loop at runtime.
 */
import type { FoodAsset, FoodAssetKey } from './foodAssets';

/** Products with their own supplied bb.q photography. */
export const suppliedFoodAssets: Partial<Record<FoodAssetKey, FoodAsset>> = {
${entries}
};
`;

const outPath = path.join(root, 'src', 'constants', 'foodAssetRegistry.ts');
fs.writeFileSync(outPath, file, 'utf8');

console.log(
  `Asset registry: ${present.length}/${CATALOGUE.length} products wired ` +
    `(${present.map(([key]) => key).join(', ') || 'none'}).`,
);
