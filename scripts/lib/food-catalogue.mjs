/**
 * The food-asset catalogue, read out of the TypeScript that defines it.
 *
 * Two build scripts need the same three facts per product — the asset key, the
 * master's filename stem and the human label — and both used to carry their own
 * hand-written copy of all sixteen rows, each with a comment asking whoever
 * came next to keep it in step with `src/constants/foodAssets.ts`. Three lists,
 * no check, and the failure is silent in the worst direction: a key missing
 * from the registry script is not an error, it is a supplied photograph that
 * never reaches the app.
 *
 * Node cannot import the TypeScript, so this parses it. That is a real cost —
 * a regex over source is fragile in a way an import is not — and it is paid
 * deliberately: the parse fails loudly and stops the build, where a stale copy
 * of a list fails quietly and ships. Both failure modes exist; only one of them
 * is noticeable.
 *
 * `label` is genuine per-product data and is read from `FOOD_ASSET_LABELS`.
 * `filename` is not data at all — it is the key in kebab-case — so it is
 * derived here exactly as `FOOD_ASSET_FILENAMES` derives it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = path.join(root, 'src', 'constants', 'foodAssets.ts');

/** Must stay identical to `kebabCase` in src/constants/foodAssets.ts. */
const kebabCase = (key) =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

function fail(message) {
  console.error(`${message}\n  Source: ${SOURCE}`);
  process.exit(2);
}

/** Every catalogue product, in the order `FOOD_ASSET_KEYS` declares them. */
export function foodCatalogue() {
  const source = fs.readFileSync(SOURCE, 'utf8');

  const keyBlock = /export const FOOD_ASSET_KEYS = \[([\s\S]*?)\] as const;/.exec(source);
  if (!keyBlock) fail('Could not find FOOD_ASSET_KEYS.');
  const keys = [...keyBlock[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((match) => match[1]);
  if (keys.length === 0) fail('FOOD_ASSET_KEYS parsed as empty.');

  const labelBlock = /export const FOOD_ASSET_LABELS: Record<FoodAssetKey, string> = \{([\s\S]*?)\n\};/.exec(
    source,
  );
  if (!labelBlock) fail('Could not find FOOD_ASSET_LABELS.');

  const labels = new Map(
    [...labelBlock[1].matchAll(/^\s*([A-Za-z0-9]+):\s*'((?:[^'\\]|\\.)*)',/gm)].map((match) => [
      match[1],
      match[2].replace(/\\'/g, "'"),
    ]),
  );

  // A key with no label would otherwise reach a script as `undefined` and be
  // printed to somebody as the name of a missing photograph.
  const unlabelled = keys.filter((key) => !labels.has(key));
  if (unlabelled.length > 0) {
    fail(`FOOD_ASSET_LABELS is missing: ${unlabelled.join(', ')}.`);
  }

  return keys.map((key) => ({ key, filename: kebabCase(key), label: labels.get(key) }));
}
