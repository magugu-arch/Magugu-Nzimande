#!/usr/bin/env node
/**
 * Builds the single-file review build of the website.
 *
 * The hosted page has no server, so it cannot load anything over the network:
 * every supplied master is embedded as a data URI, straight from
 * assets/…/masters, which stay untouched as always.
 *
 * Reads apps/web/static-demo/index.template.html and replaces one placeholder
 * with the generated assets. Output goes to apps/web/static-demo/bbq-chicken-website.html,
 * which is generated and not committed.
 */

import { readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import tokens from '../../packages/ui/src/tokens.json' with { type: 'json' };
/**
 * The seed modules are imported by file rather than through ../seed/index.ts,
 * and directly as TypeScript. Both are deliberate: Node's type stripping
 * erases the type-only imports these files carry, so no compile step is
 * needed, while index.ts re-exports with extensionless specifiers that ESM
 * cannot resolve.
 */
import { CATEGORIES, FAQS, SAUCES, optionGroupsFor } from '../seed/catalogue.ts';
import { FEES, REWARDS_RULES } from '../seed/demo-values.ts';
import { PRODUCTS } from '../seed/products.ts';
import { PROMOTIONS, REWARDS, STORES } from '../seed/stores.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const FOOD = path.join(REPO, 'assets/food/masters');
const BRAND = path.join(REPO, 'assets/brand/masters');
const OUT_DIR = path.join(REPO, 'apps/web/static-demo');

/**
 * Every master, by the image key the catalogue uses.
 *
 * Read off disk rather than listed here. The list was a second place to
 * remember a photograph: a master could be added, wired to a product, and
 * still be missing from the build because nobody edited this array. The
 * derivative script has always worked this way.
 */
const KEYS = readdirSync(FOOD)
  .filter((name) => name.endsWith('.jpg'))
  .map((name) => name.replace(/\.jpg$/, ''))
  .sort();

/** Only these are ever shown in a 16:9 crop, so only these need one. */
const WIDE = [
  'golden-original',
  'honey-garlic',
  'half-and-half',
  'chicken-rice-meal',
  'french-fries',
  'golden-original-wings',
];

const PORTRAIT_WIDTH = 640;
const WIDE_WIDTH = 1000;

function rgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

const RED = rgb(tokens.brand.red);
const BLACK = rgb(tokens.brand.black);

function squaredDistance(r, g, b, target) {
  const dr = r - target[0];
  const dg = g - target[1];
  const db = b - target[2];
  return dr * dr + dg * dg + db * db;
}

/** The guidelines' dark-ground lock-up: black ink to white, wordmark still red. */
async function reverse(source) {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Buffer.from(data);
  for (let i = 0; i < pixels.length; i += info.channels) {
    if (
      squaredDistance(pixels[i], pixels[i + 1], pixels[i + 2], BLACK) <=
      squaredDistance(pixels[i], pixels[i + 1], pixels[i + 2], RED)
    ) {
      pixels[i] = 0xff;
      pixels[i + 1] = 0xff;
      pixels[i + 2] = 0xff;
    }
  }

  return sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();
}

async function crop(source, width, ratio) {
  return sharp(source)
    .resize(width, Math.round(width / ratio), {
      fit: 'cover',
      position: sharp.strategy.attention,
    })
    .webp({ quality: 76 })
    .toBuffer();
}

const uri = (buffer, type) => `data:${type};base64,${buffer.toString('base64')}`;

/**
 * The approved palette as CSS custom properties, so the single-file build
 * carries no colour of its own. tokens.json stays the one source.
 */
function paletteCss() {
  const lines = [
    ...Object.entries(tokens.brand).map(([name, hex]) => `--${name}:${hex};`),
    `--red-deep:${tokens.redDeep};`,
    ...[80, 60, 40, 20, 10].map((step) => `--red-${step}:${tokens.redTints[step]};`),
    ...[80, 60, 40, 20, 10].map((step) => `--black-${step}:${tokens.blackTints[step]};`),
    `--paper:${tokens.neutralTints[10]};`,
    `--line:${tokens.neutralTints[20]};`,
    `--line-strong:${tokens.lineStrong};`,
    `--muted:${tokens.neutralTints[100]};`,
  ];
  return lines.join(' ');
}

/**
 * The demo's catalogue, generated from infra/seed rather than kept as a second
 * copy in the template.
 *
 * It was a hand-maintained duplicate: seven datasets written out twice, with
 * nothing checking they agreed. Adding one product meant editing both, and a
 * demo quietly showing a different menu from the app is worse than one showing
 * no menu at all, because nobody looks twice at it.
 *
 * The field names differ because the demo's are terser (img, desc, kj); that
 * mapping lives here, in one place, instead of in a reviewer's memory.
 */
function catalogueScript() {
  const products = PRODUCTS.map((product) => ({
    slug: product.slug,
    name: product.name,
    category: product.category,
    priceCents: product.priceCents,
    heat: product.heat,
    sauce: product.sauce,
    ...(product.tag ? { tag: product.tag } : {}),
    img: product.imageKey,
    desc: product.description,
    allergens: product.nutrition.allergens,
    kj: product.nutrition.kilojoules,
  }));

  const stores = STORES.map((store) => ({
    id: store.id,
    name: store.name,
    address: store.address,
    tel: store.telephone,
    opens: store.hours.opensMinute,
    closes: store.hours.closesMinute,
    hours: store.hours.label,
    km: store.distanceKm,
    services: store.services,
    zones: store.zones,
    halaal: store.halaal,
  }));

  const promotions = PROMOTIONS.map((promotion) => ({
    id: promotion.id,
    title: promotion.title,
    slug: promotion.productSlug,
    code: promotion.code,
    rate: promotion.discountRate,
    valid: promotion.validity,
    copy: promotion.copy,
  }));

  /**
   * A category's tile image is the first product filed under it.
   *
   * The seed's Category carries a key, a label and a note — no image, because
   * the Next.js site has always derived one this way rather than storing a
   * second reference to a photograph. The demo's own copy of this data used to
   * hardcode an `img`, and when the copy went away so did the field: every
   * category tile rendered a broken image. Derived here so both surfaces pick
   * the same picture for the same reason.
   */
  const categories = CATEGORIES.map((category) => {
    const example = PRODUCTS.find((product) => product.category === category.key);
    if (!example) throw new Error(`No product is filed under the ${category.key} category`);
    return { ...category, img: example.imageKey };
  });

  /**
   * The option groups each product offers, by slug.
   *
   * The template used to carry its own copy of `optionGroupsFor` — a second
   * branch-per-category function with no test on it. It was missed when the
   * datasets were injected because it is a function rather than a `const`, and
   * it went stale the moment a category was added: kids meals rendered with no
   * drink to choose while the seed had one all along. Injected now, so the demo
   * asks for exactly what the app asks for.
   */
  const optionGroups = Object.fromEntries(
    PRODUCTS.map((product) => [
      product.slug,
      optionGroupsFor(product).map((group) => ({
        key: group.key,
        label: group.label,
        multi: group.multi,
        def: group.defaultIndex,
        choices: group.choices.map((choice) => ({
          label: choice.label,
          delta: choice.deltaCents,
        })),
      })),
    ]),
  );

  const faqs = FAQS.map((faq) => ({ q: faq.question, a: faq.answer }));

  const fees = {
    deliveryCents: FEES.deliveryCents,
    freeOverCents: FEES.freeDeliveryOverCents,
    etaMin: FEES.deliveryEtaMinutes.min,
    etaMax: FEES.deliveryEtaMinutes.max,
    collectEta: FEES.collectionEtaMinutes,
  };

  const declare = (name, value) => `const ${name} = ${JSON.stringify(value)};`;

  return [
    declare('PRODUCTS', products),
    declare('CATEGORIES', categories),
    declare('SAUCES', SAUCES),
    declare('STORES', stores),
    declare('PROMOTIONS', promotions),
    declare('REWARDS', REWARDS),
    declare('TIERS', REWARDS_RULES.tiers),
    declare('FAQS', faqs),
    declare('OPTION_GROUPS', optionGroups),
    declare('FEES', fees),
  ].join('\n');
}

async function main() {
  const portrait = {};
  const wide = {};

  for (const key of KEYS) {
    const source = path.join(FOOD, `${key}.jpg`);
    portrait[key] = uri(await crop(source, PORTRAIT_WIDTH, 4 / 5), 'image/webp');
    if (WIDE.includes(key)) {
      wide[key] = uri(await crop(source, WIDE_WIDTH, 16 / 9), 'image/webp');
    }
  }

  const lockupSource = path.join(BRAND, 'bbq-lockup.png');
  const lockup = uri(
    await sharp(lockupSource).resize({ width: 560 }).png({ compressionLevel: 9 }).toBuffer(),
    'image/png',
  );
  const lockupReversed = uri(
    await sharp(await reverse(lockupSource))
      .resize({ width: 560 })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    'image/png',
  );

  const catalogue = catalogueScript();

  const assets =
    `const IMG = ${JSON.stringify(portrait)};\n` +
    `const IMG_WIDE = ${JSON.stringify(wide)};\n` +
    `const LOCKUP = ${JSON.stringify(lockup)};\n` +
    `const LOCKUP_REVERSED = ${JSON.stringify(lockupReversed)};`;

  const template = await readFile(path.join(OUT_DIR, 'index.template.html'), 'utf8');
  for (const placeholder of ['/*__ASSETS__*/', '/*__TOKENS__*/', '/*__CATALOGUE__*/']) {
    if (!template.includes(placeholder)) {
      throw new Error(`The template has lost its ${placeholder} placeholder`);
    }
  }

  // Every product must have a master, or the page renders a gap. Checked here
  // rather than discovered by a reviewer opening the menu.
  const missing = PRODUCTS.filter((product) => !KEYS.includes(product.imageKey));
  if (missing.length > 0) {
    throw new Error(
      `No master for: ${missing.map((product) => `${product.slug} (${product.imageKey})`).join(', ')}`,
    );
  }

  await mkdir(OUT_DIR, { recursive: true });
  const html = template
    .replace('/*__TOKENS__*/', paletteCss())
    .replace('/*__CATALOGUE__*/', catalogue)
    .replace('/*__ASSETS__*/', assets);
  const target = path.join(OUT_DIR, 'bbq-chicken-website.html');
  await writeFile(target, html, 'utf8');

  const mb = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
  console.log(`Wrote ${path.relative(REPO, target)} — ${mb} MB, ${KEYS.length} masters embedded`);
  if (Number(mb) > 15) {
    throw new Error('Over the 16 MB artifact ceiling; drop the derivative widths');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
