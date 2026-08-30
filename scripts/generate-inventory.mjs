#!/usr/bin/env node
/**
 * Write INVENTORY.md — the route map, component inventory and asset manifest.
 *
 * These are three of the brief's named outputs (§"OUTPUTS" 4 and 5). They are
 * generated rather than written by hand for the same reason the asset registry
 * is: a hand-kept inventory is accurate on the day it is written and quietly
 * wrong a fortnight later, and an inventory nobody trusts is worse than none.
 *
 * `__tests__/inventory.test.ts` re-runs this and fails if the checked-in file
 * differs, so the document cannot drift from the repository it describes.
 *
 * Run: npm run docs:inventory        (or `--check` to verify without writing)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'INVENTORY.md');

/** Every file under `dir` matching `pattern`, depth first, sorted. */
function walk(dir, pattern) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full, pattern);
      return pattern.test(entry.name) ? [full] : [];
    });
}

const posix = (p) => p.split(path.sep).join('/');

// ── Route map ──────────────────────────────────────────────────────────────
// Expo Router file conventions: (groups) are organisational and never appear
// in a URL, `index` collapses into its parent, `[param]` is dynamic.
const appDir = path.join(root, 'src', 'app');
const stripGroups = (route) => route.replace(/\((?:[^)]+)\)\//g, '').replace(/\/\([^)]+\)/g, '');

const routes = walk(appDir, /\.tsx$/)
  .filter((file) => !path.basename(file).startsWith('_layout'))
  .map((file) => {
    const rel = posix(path.relative(appDir, file)).replace(/\.tsx$/, '');
    const url = '/' + stripGroups(rel).replace(/\/?index$/, '');
    return {
      url: url === '/' ? '/' : url.replace(/\/$/, ''),
      file: posix(path.relative(root, file)),
      dynamic: /\[[^\]]+\]/.test(rel),
    };
  })
  .sort((a, b) => a.url.localeCompare(b.url));

// ── Component inventory ────────────────────────────────────────────────────
// Grouped by the directory that gives each component its job: `ui` is the
// design-system layer, `features/*` are domain components, the rest are
// app-shell pieces.
const componentDirs = [
  ['Design system', path.join(root, 'src', 'components', 'ui')],
  ['Brand', path.join(root, 'src', 'components', 'brand')],
  ['Food imagery', path.join(root, 'src', 'components', 'food')],
  ['System', path.join(root, 'src', 'components', 'system')],
  ['Feature components', path.join(root, 'src', 'features')],
];

/** The exported component names in a file, in declaration order. */
function exportedComponents(file) {
  const source = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of source.matchAll(/export\s+(?:const|function)\s+([A-Z]\w*)/g)) names.add(m[1]);
  for (const m of source.matchAll(/export\s+const\s+([A-Z]\w*)\s*=\s*memo\(/g)) names.add(m[1]);
  return [...names];
}

const components = componentDirs
  .map(([group, dir]) => [
    group,
    walk(dir, /\.tsx$/)
      .map((file) => ({
        file: posix(path.relative(root, file)),
        exports: exportedComponents(file),
      }))
      .filter((entry) => entry.exports.length > 0),
  ])
  .filter(([, entries]) => entries.length > 0);

// ── Asset manifest ─────────────────────────────────────────────────────────
// Every supplied photograph, against the product it belongs to. Read from the
// menu data and the generated registry rather than restated, so a renamed
// product or a dropped master shows up here as a change.
const menuSource = readFileSync(path.join(root, 'src', 'services', 'data', 'menuData.ts'), 'utf8');
const productsStart = menuSource.indexOf('export const products');

/** `{ assetKey -> { name, category } }` for every catalogue product. */
const productsByAsset = new Map();
{
  const body = menuSource.slice(productsStart);
  const re =
    /\n {4}id: '([^']+)',[\s\S]*?\n {4}name: '((?:[^'\\]|\\.)*)',[\s\S]*?\n {4}categoryId: '([^']+)',\n {4}assetKey: '([^']+)',/g;
  for (const m of body.matchAll(re)) {
    productsByAsset.set(m[4], { id: m[1], name: m[2].replace(/\\'/g, "'"), category: m[3] });
  }
}

const registrySource = readFileSync(
  path.join(root, 'src', 'constants', 'foodAssetRegistry.ts'),
  'utf8',
);
const suppliedKeys = [...registrySource.matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);

const masters = walk(path.join(root, 'assets', 'food', 'masters'), /\.(jpg|jpeg|png)$/i).map((f) =>
  path.basename(f),
);

const VARIANTS = [
  ['thumb', '1:1', '400px', 'menu rows, cart lines, reorder chips'],
  ['card', '4:5', '800px', 'catalogue cards, best sellers, category tiles'],
  ['detail', '4:5', '1200px', 'product detail hero'],
  ['banner', '16:9', '1600px', 'home promotions, offer banners'],
];

// ── Render ─────────────────────────────────────────────────────────────────
const lines = [];
const add = (...l) => lines.push(...l);

add(
  '<!-- GENERATED FILE — do not edit. Run `npm run docs:inventory`. -->',
  '',
  '# Inventory',
  '',
  'The route map, component inventory and asset manifest the brief asks for as',
  'outputs. Generated from the repository by `scripts/generate-inventory.mjs`,',
  'and held to it by `__tests__/inventory.test.ts` — if this file and the code',
  'disagree, the test fails rather than the document quietly going stale.',
  '',
  '---',
  '',
  '## Route map',
  '',
  `${routes.length} routes. Paths are what Expo Router resolves: \`(groups)\` are`,
  'organisational and never appear in a URL, and `index` collapses into its parent.',
  '',
  '| Route | Screen | |',
  '|---|---|---|',
);
for (const r of routes) {
  add(`| \`${r.url}\` | \`${r.file}\` | ${r.dynamic ? 'dynamic' : ''} |`);
}

add('', '---', '', '## Component inventory', '');
const componentCount = components.reduce(
  (sum, [, entries]) => sum + entries.reduce((n, e) => n + e.exports.length, 0),
  0,
);
add(
  `${componentCount} exported components. Screens compose these; none of them`,
  'reaches for a raw colour or type value — everything resolves through `src/theme`.',
  '',
);
for (const [group, entries] of components) {
  add(`### ${group}`, '', '| Component | File |', '|---|---|');
  for (const entry of entries) {
    add(`| ${entry.exports.map((n) => `\`${n}\``).join(', ')} | \`${entry.file}\` |`);
  }
  add('');
}

add('---', '', '## Asset manifest', '');
add(
  `${suppliedKeys.length} supplied photographs, one per catalogue product, each`,
  'derived into four responsive variants by `npm run assets:derive`.',
  '',
  '| Variant | Ratio | Width | Used on |',
  '|---|---|---|---|',
);
for (const [name, ratio, width, use] of VARIANTS) {
  add(`| \`${name}\` | ${ratio} | ${width} | ${use} |`);
}
add('', '| Product | Category | Asset key | Master |', '|---|---|---|---|');
for (const key of suppliedKeys) {
  const product = productsByAsset.get(key);
  const master = masters.find((m) => m.replace(/\.[^.]+$/, '') === toKebab(key));
  add(
    `| ${product ? product.name : '_unused_'} | ${product ? `\`${product.category}\`` : '—'} | \`${key}\` | \`${master ?? '—'}\` |`,
  );
}

add(
  '',
  'Masters live in `assets/food/masters/` and are never shipped to a list screen.',
  'Eight of them are campaign compositions carrying their own headline typography;',
  'the derivative pipeline crops catalogue surfaces inside a `promo_safe` region so',
  'a card never slices a headline, while the banner keeps the full artwork.',
  '',
);

/** `goldenOriginalWings` -> `golden-original-wings`. */
function toKebab(key) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

const rendered = lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== rendered) {
    console.error('INVENTORY.md is out of date. Run `npm run docs:inventory`.');
    process.exit(1);
  }
  console.log('INVENTORY.md is current.');
} else {
  writeFileSync(OUT, rendered);
  console.log(
    `Wrote INVENTORY.md — ${routes.length} routes, ${componentCount} components, ${suppliedKeys.length} photographs.`,
  );
}
