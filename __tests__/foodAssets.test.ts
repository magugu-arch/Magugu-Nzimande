import {
  FOOD_ASSET_FILENAMES,
  FOOD_ASSET_KEYS,
  FOOD_ASSET_LABELS,
  PENDING_ASSET_KEYS,
  foodAssets,
  hasFoodAsset,
  resolveFoodAsset,
  type ImageVariant,
} from '@/constants/foodAssets';
import { menuSnapshot } from '@/services/data/menuData';
import { promotions, rewards, vouchers } from '@/services/data/rewardsData';

const VARIANTS: ImageVariant[] = ['thumb', 'card', 'detail', 'banner'];

describe('food asset catalogue', () => {
  it('covers all 16 products the brief requires', () => {
    expect(FOOD_ASSET_KEYS).toHaveLength(16);
    expect(new Set(FOOD_ASSET_KEYS).size).toBe(16);
  });

  it('has a label and a filename for every key', () => {
    FOOD_ASSET_KEYS.forEach((key) => {
      expect(FOOD_ASSET_LABELS[key]).toBeTruthy();
      expect(FOOD_ASSET_FILENAMES[key]).toMatch(/^[a-z0-9-]+$/);
    });
  });

  it('uses a unique filename per key', () => {
    const filenames = Object.values(FOOD_ASSET_FILENAMES);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('supplies every variant for each asset that has landed', () => {
    Object.entries(foodAssets).forEach(([key, asset]) => {
      VARIANTS.forEach((variant) => {
        expect(asset?.[variant]).toBeDefined();
        expect(resolveFoodAsset(key as never, variant)).not.toBeNull();
      });
    });
  });

  it('lists exactly the keys with no artwork as pending', () => {
    const expected = FOOD_ASSET_KEYS.filter((key) => foodAssets[key] === undefined);
    expect([...PENDING_ASSET_KEYS]).toEqual(expected);
    PENDING_ASSET_KEYS.forEach((key) => {
      expect(hasFoodAsset(key)).toBe(false);
      expect(resolveFoodAsset(key, 'card')).toBeNull();
    });
  });
});

describe('menu data integrity', () => {
  it('gives every product an asset key from the catalogue', () => {
    menuSnapshot.products.forEach((product) => {
      expect(FOOD_ASSET_KEYS).toContain(product.assetKey);
    });
  });

  it('gives every category an asset key from the catalogue', () => {
    menuSnapshot.categories.forEach((category) => {
      expect(FOOD_ASSET_KEYS).toContain(category.assetKey);
    });
  });

  it('places every product in a declared category', () => {
    const categoryIds = new Set(menuSnapshot.categories.map((category) => category.id));
    menuSnapshot.products.forEach((product) => {
      expect(categoryIds.has(product.categoryId)).toBe(true);
    });
  });

  it('leaves no category empty', () => {
    menuSnapshot.categories.forEach((category) => {
      const count = menuSnapshot.products.filter(
        (product) => product.categoryId === category.id,
      ).length;
      expect(count).toBeGreaterThan(0);
    });
  });

  it('uses unique product ids and slugs', () => {
    const ids = menuSnapshot.products.map((product) => product.id);
    const slugs = menuSnapshot.products.map((product) => product.slug);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('points every recommendation at a real product', () => {
    const ids = new Set(menuSnapshot.products.map((product) => product.id));
    menuSnapshot.products.forEach((product) => {
      product.recommendedProductIds.forEach((id) => {
        expect(ids.has(id)).toBe(true);
      });
      // A product recommending itself would render a duplicate card.
      expect(product.recommendedProductIds).not.toContain(product.id);
    });
  });

  it('keeps option group ids unique within a product and defaults valid', () => {
    menuSnapshot.products.forEach((product) => {
      const groupIds = product.optionGroups.map((group) => group.id);
      expect(new Set(groupIds).size).toBe(groupIds.length);

      product.optionGroups.forEach((group) => {
        expect(group.maxSelect).toBeGreaterThanOrEqual(group.minSelect);
        expect(group.options.length).toBeGreaterThan(0);

        const optionIds = group.options.map((option) => option.id);
        expect(new Set(optionIds).size).toBe(optionIds.length);

        group.defaultOptionIds.forEach((id) => {
          expect(optionIds).toContain(id);
        });
        expect(group.defaultOptionIds.length).toBeLessThanOrEqual(group.maxSelect);
      });
    });
  });

  it('prices every product above zero', () => {
    menuSnapshot.products.forEach((product) => {
      expect(product.basePrice).toBeGreaterThan(0);
    });
  });
});

describe('promotions and rewards data', () => {
  it('gives every promotion a catalogue asset and a route', () => {
    promotions.forEach((promotion) => {
      expect(FOOD_ASSET_KEYS).toContain(promotion.assetKey);
      expect(promotion.ctaHref.startsWith('/')).toBe(true);
      expect(new Date(promotion.validUntil).getTime()).toBeGreaterThan(
        new Date(promotion.validFrom).getTime(),
      );
    });
  });

  it('only uses catalogue assets on rewards and vouchers', () => {
    rewards.forEach((reward) => {
      if (reward.assetKey) expect(FOOD_ASSET_KEYS).toContain(reward.assetKey);
    });
    vouchers.forEach((voucher) => {
      if (voucher.assetKey) expect(FOOD_ASSET_KEYS).toContain(voucher.assetKey);
    });
  });

  it('uses unique voucher codes', () => {
    const codes = vouchers.map((voucher) => voucher.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
