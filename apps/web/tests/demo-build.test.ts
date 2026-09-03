import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  CATEGORIES,
  FAQS,
  PRODUCTS,
  PROMOTIONS,
  REWARDS,
  SAUCES,
  STORES,
  optionGroupsFor,
} from '@bbq/seed';
import { describe, expect, it } from 'vitest';

/**
 * The single-file review build, against the seed it is generated from.
 *
 * The template used to carry its own copy of the catalogue — nine datasets
 * written out a second time with nothing checking they agreed. A demo quietly
 * showing a different menu from the app is worse than one showing no menu,
 * because nobody looks twice at it.
 *
 * The build now injects them, so these hold the thing that makes that safe:
 * the placeholder is still there, and nobody has pasted the data back in.
 */

const TEMPLATE = readFileSync(
  path.resolve(__dirname, '../static-demo/index.template.html'),
  'utf8',
);

describe('the demo template', () => {
  it('still has the placeholders the build fills', () => {
    for (const placeholder of ['/*__CATALOGUE__*/', '/*__ASSETS__*/', '/*__TOKENS__*/']) {
      expect(TEMPLATE, placeholder).toContain(placeholder);
    }
  });

  /**
   * The regression this file exists for. A `const PRODUCTS = [` in the
   * template means somebody has started a second catalogue again.
   */
  it('declares none of the injected datasets itself', () => {
    for (const name of [
      'PRODUCTS',
      'CATEGORIES',
      'SAUCES',
      'STORES',
      'PROMOTIONS',
      'REWARDS',
      'TIERS',
      'FAQS',
      'FEES',
      'OPTION_GROUPS',
    ]) {
      expect(TEMPLATE, `${name} is declared in the template`).not.toMatch(
        new RegExp(`const\\s+${name}\\s*=`),
      );
    }
  });

  it('carries no raw hex of its own, because the palette is injected', () => {
    // The build writes the approved palette in from tokens.json; a literal in
    // the template would be a colour that cannot be traced to the guidelines.
    expect(TEMPLATE).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe('what the build will inject', () => {
  /**
   * Every product needs a master or the page renders a gap. The build throws
   * on this too; this fails first, and says which product.
   */
  it('has a master for every product', () => {
    // Read off disk, the same way the build discovers them. This used to parse
    // a hardcoded KEYS array out of the build script, which meant the test
    // asserted against a list rather than against the photographs.
    const masters = new Set(
      readdirSync(path.resolve(__dirname, '../../../assets/food/masters'))
        .filter((name) => name.endsWith('.jpg'))
        .map((name) => name.replace(/\.jpg$/, '')),
    );

    expect(masters.size).toBeGreaterThan(0);
    for (const product of PRODUCTS) {
      expect(masters.has(product.imageKey), `${product.slug} → ${product.imageKey}`).toBe(true);
    }
  });

  it('points every promotion at a product that is on the menu', () => {
    const slugs = new Set(PRODUCTS.map((product) => product.slug));
    for (const promotion of PROMOTIONS) {
      expect(slugs.has(promotion.productSlug), promotion.code).toBe(true);
    }
  });

  it('gives every store at least one delivery suburb', () => {
    for (const store of STORES) {
      if (store.services.Delivery) {
        expect(store.zones.length, store.name).toBeGreaterThan(0);
      }
    }
  });

  /**
   * Read out of the built page rather than recomputed here.
   *
   * A test that re-derives what the build should have injected passes whether
   * or not the build injected it — which is how this got out. The template
   * reads a category's image as `c.img`; the seed's Category has no image
   * field, because the Next.js site derives one from the first product in the
   * category. Injecting the seed's shape unchanged left `c.img` undefined and
   * every category tile rendered a broken image, while every dataset was
   * present, non-empty and correct.
   *
   * The `src` is concatenated in the browser, so the built file never contains
   * the string `src="undefined"` — the only way to catch this statically is to
   * read the data the page will build it from.
   */
  it('injects a resolvable image for every category', () => {
    const built = path.resolve(__dirname, '../static-demo/bbq-chicken-website.html');
    if (!existsSync(built)) return; // generated, not committed; skipped when absent

    const declared = readFileSync(built, 'utf8').match(/const CATEGORIES = (\[.*?\]);/s);
    expect(declared, 'the built page declares no CATEGORIES').not.toBeNull();

    const injected = JSON.parse(declared?.[1] ?? '[]') as { key: string; img?: string }[];
    expect(injected).toHaveLength(CATEGORIES.length);

    const masters = new Set(
      readdirSync(path.resolve(__dirname, '../../../assets/food/masters'))
        .filter((name) => name.endsWith('.jpg'))
        .map((name) => name.replace(/\.jpg$/, '')),
    );

    for (const category of injected) {
      expect(masters.has(category.img ?? ''), `${category.key} → ${category.img}`).toBe(true);
    }
  });

  /**
   * The second copy that hid the longest.
   *
   * The template carried its own `optionGroups(p)` — a branch-per-category
   * function duplicating the seed's `optionGroupsFor`. It survived the sweep
   * that removed the duplicated datasets because it is a function, not a
   * `const`, and nothing compared the two. It went stale the moment a category
   * was added: kids meals rendered with no drink to choose while the seed had
   * offered one all along.
   */
  it('injects the seed’s own option groups, not a second copy', () => {
    const built = path.resolve(__dirname, '../static-demo/bbq-chicken-website.html');
    if (!existsSync(built)) return; // generated, not committed; skipped when absent

    const declared = readFileSync(built, 'utf8').match(/const OPTION_GROUPS = (\{.*?\});\n/s);
    expect(declared, 'the built page declares no OPTION_GROUPS').not.toBeNull();

    const injected = JSON.parse(declared?.[1] ?? '{}') as Record<
      string,
      { key: string; choices: { label: string; delta: number }[] }[]
    >;

    for (const product of PRODUCTS) {
      const expected = optionGroupsFor(product).map((group) => ({
        key: group.key,
        choices: group.choices.map((choice) => ({
          label: choice.label,
          delta: choice.deltaCents,
        })),
      }));
      const actual = (injected[product.slug] ?? []).map((group) => ({
        key: group.key,
        choices: group.choices,
      }));

      expect(actual, product.slug).toEqual(expected);
    }
  });

  it('keeps every dataset non-empty, so no screen renders blank', () => {
    for (const [name, data] of [
      ['products', PRODUCTS],
      ['categories', CATEGORIES],
      ['sauces', SAUCES],
      ['stores', STORES],
      ['promotions', PROMOTIONS],
      ['rewards', REWARDS],
      ['faqs', FAQS],
    ] as const) {
      expect(data.length, name).toBeGreaterThan(0);
    }
  });
});
