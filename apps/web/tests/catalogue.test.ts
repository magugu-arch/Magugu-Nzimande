import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES, PRODUCTS, PROMOTIONS, REWARDS, STORES, optionGroupsFor } from '@bbq/seed';
import { OptionGroupSchema, ProductSchema, PromotionSchema, RewardSchema, StoreSchema } from '@bbq/types';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '../../..');

/** The supplied masters, read off disk rather than listed a second time. */
const MASTERS = readdirSync(path.join(REPO, 'assets/food/masters'))
  .filter((file) => file.endsWith('.jpg'))
  .map((file) => file.replace(/\.jpg$/, ''));

describe('catalogue', () => {
  it('carries the products the handover documents', () => {
    expect(PRODUCTS).toHaveLength(24);
  });

  it('parses every product through its schema', () => {
    for (const product of PRODUCTS) {
      expect(() => ProductSchema.parse(product)).not.toThrow();
    }
  });

  it('gives every product a unique slug and id', () => {
    expect(new Set(PRODUCTS.map((p) => p.slug)).size).toBe(PRODUCTS.length);
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
  });

  it('maps every product to a supplied master that exists on disk', () => {
    for (const product of PRODUCTS) {
      const master = path.join(REPO, 'assets/food/masters', `${product.imageKey}.jpg`);
      expect(existsSync(master), `missing master for ${product.slug}`).toBe(true);
    }
  });

  /**
   * No master goes unused — an unused one means a supplied photograph is being
   * wasted, or a product was renamed and its image left behind.
   */
  it('uses every supplied master', () => {
    const used = new Set(PRODUCTS.map((product) => product.imageKey));
    for (const master of MASTERS) {
      expect(used.has(master), `nothing uses the ${master} master`).toBe(true);
    }
  });

  /**
   * Every product has its own photograph.
   *
   * For a while it did not: the catalogue outgrew the sixteen supplied masters
   * and eight items borrowed the one that most honestly depicted them. Now that
   * each has been shot, two products sharing an image means a new item was
   * added without one — which reads to a customer as the wrong picture rather
   * than a missing one, and is the harder mistake to notice.
   */
  it('gives every product an image of its own', () => {
    const byKey = new Map<string, string[]>();
    for (const product of PRODUCTS) {
      byKey.set(product.imageKey, [...(byKey.get(product.imageKey) ?? []), product.slug]);
    }

    const shared = [...byKey.entries()].filter(([, slugs]) => slugs.length > 1);
    expect(shared.map(([key, slugs]) => `${key}: ${slugs.join(', ')}`)).toEqual([]);
  });

  it('puts every product in a declared category', () => {
    const declared = new Set(CATEGORIES.map((category) => category.key));
    for (const product of PRODUCTS) {
      expect(declared.has(product.category)).toBe(true);
    }
  });

  it('prices everything above zero, in whole cents', () => {
    for (const product of PRODUCTS) {
      expect(product.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(product.priceCents)).toBe(true);
    }
  });

  it('declares allergens and energy for every product', () => {
    for (const product of PRODUCTS) {
      expect(product.nutrition.allergens.length).toBeGreaterThan(0);
      expect(product.nutrition.kilojoules).toBeGreaterThan(0);
    }
  });
});

describe('option groups', () => {
  it('parse through the schema for every product', () => {
    for (const product of PRODUCTS) {
      for (const group of optionGroupsFor(product)) {
        expect(() => OptionGroupSchema.parse(group)).not.toThrow();
      }
    }
  });

  it('give every product somewhere to add extras', () => {
    for (const product of PRODUCTS) {
      const keys = optionGroupsFor(product).map((group) => group.key);
      expect(keys).toContain('extras');
    }
  });

  it('never take a price below zero at its smallest selection', () => {
    for (const product of PRODUCTS) {
      const worst = optionGroupsFor(product)
        .filter((group) => !group.multi)
        .reduce(
          (total, group) => total + Math.min(...group.choices.map((choice) => choice.deltaCents)),
          product.priceCents,
        );
      expect(worst).toBeGreaterThan(0);
    }
  });

  it('point every default index at a real choice', () => {
    for (const product of PRODUCTS) {
      for (const group of optionGroupsFor(product)) {
        expect(group.choices[group.defaultIndex]).toBeDefined();
      }
    }
  });
});

describe('stores', () => {
  it('parse through the schema', () => {
    for (const store of STORES) {
      expect(() => StoreSchema.parse(store)).not.toThrow();
    }
  });

  it('keep Waterfall Ridge without dine-in, as the brief requires', () => {
    const waterfall = STORES.find((store) => store.id === 'ST-WAT');
    expect(waterfall?.services['Dine-in']).toBe(false);
    expect(waterfall?.services.Collection).toBe(true);
  });

  it('give every delivering store at least one suburb', () => {
    for (const store of STORES) {
      if (store.services.Delivery) expect(store.zones.length).toBeGreaterThan(0);
    }
  });

  it('do not claim the same suburb at two stores', () => {
    const all = STORES.flatMap((store) => store.zones.map((zone) => zone.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('promotions and rewards', () => {
  it('parse through their schemas', () => {
    for (const promotion of PROMOTIONS) {
      expect(() => PromotionSchema.parse(promotion)).not.toThrow();
    }
    for (const reward of REWARDS) {
      expect(() => RewardSchema.parse(reward)).not.toThrow();
    }
  });

  it('point every campaign at a product that exists', () => {
    const slugs = new Set(PRODUCTS.map((product) => product.slug));
    for (const promotion of PROMOTIONS) {
      expect(slugs.has(promotion.productSlug), promotion.id).toBe(true);
    }
  });

  it('use a unique, uppercase code per campaign', () => {
    const codes = PROMOTIONS.map((promotion) => promotion.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toBe(code.toUpperCase());
  });

  it('order the reward ladder from cheapest to dearest', () => {
    const points = REWARDS.map((reward) => reward.points);
    expect([...points].sort((a, b) => a - b)).toEqual(points);
  });
});
