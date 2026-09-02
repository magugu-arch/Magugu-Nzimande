import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES, FAQS, PRODUCTS, PROMOTIONS, REWARDS, SAUCES, STORES } from '@bbq/seed';
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
    const masters = new Set(
      readFileSync(path.resolve(__dirname, '../../../infra/scripts/build-static-demo.mjs'), 'utf8')
        .match(/const KEYS = \[([\s\S]*?)\];/)?.[1]
        ?.match(/'([^']+)'/g)
        ?.map((quoted) => quoted.slice(1, -1)) ?? [],
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
