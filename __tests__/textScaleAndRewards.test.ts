import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fetchOrders } from '@/services/orderService';
import { fetchMenu } from '@/services/menuService';
import { rewards } from '@/services/data/rewardsData';
import { menuSnapshot } from '@/services/data/menuData';
import { isSoldOut } from '@/features/menu/availability';
import { rewardIsOrderable, rewardUnavailableReason } from '@/features/rewards/rewardAvailability';
import { cappedFontScale } from '@/features/system/useFontScale';
import { CHROME_FONT_SCALE_CAP, fontScaleCapFor } from '@/theme';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * 1 — a reward for a dish the kitchen cannot make.
 *
 * The reward catalogue is a set of claims about the menu and nothing could
 * check them: `Reward` carried a photograph and a sentence and no product id.
 * The Offers screen solved exactly this for promotions with `promotedProductId`
 * a while ago; rewards had no equivalent because there was nothing to read.
 */
describe('a reward whose dish is sold out', () => {
  it('is in the catalogue, and it is Cheesling Fries', async () => {
    const menu = await fetchMenu();
    const reward = rewards.find((candidate) => candidate.id === 'reward-cheesling-fries');
    const product = menu.products.find((candidate) => candidate.id === reward?.productId);

    expect(reward?.productId).toBe('cheesling-fries');
    expect(product).toBeDefined();
    // Not withdrawn — on the menu with every option in a required group gone.
    expect(product?.available).toBe(true);
    expect(isSoldOut(product!)).toBe(true);
  });

  it('costs points somebody could have spent on it', () => {
    const reward = rewards.find((candidate) => candidate.id === 'reward-cheesling-fries');

    expect(reward?.redeemable).toBe(true);
    expect(reward?.pointsCost).toBe(650);
  });

  it('is reported unavailable, in the menu’s own words', async () => {
    const menu = await fetchMenu();
    const reward = rewards.find((candidate) => candidate.id === 'reward-cheesling-fries')!;

    expect(rewardIsOrderable(reward, menu.products)).toBe(false);
    expect(rewardUnavailableReason(reward, menu.products)).toMatch(
      /Every choice under "Size" is sold out/,
    );
  });

  it('stops the reward screen offering the redemption', () => {
    const screen = code('src/app/rewards/[id].tsx');

    expect(screen).toMatch(/rewardUnavailableReason\(data, menu\.data\?\.products\)/);
    expect(screen).toMatch(/'Sold out right now'/);
    expect(screen).toMatch(/disabled=\{!data\.redeemable \|\| Boolean\(unavailable\)\}/);
  });
});

/**
 * 2 — the control. A guard that fires on everything is a guard nobody keeps.
 */
describe('a reward whose dish is fine', () => {
  it('says nothing at all', async () => {
    const menu = await fetchMenu();
    const fries = rewards.find((candidate) => candidate.id === 'reward-fries')!;

    expect(fries.productId).toBe('french-fries');
    expect(rewardUnavailableReason(fries, menu.products)).toBeNull();
  });

  it('leaves every reward that is not about a dish alone', async () => {
    const menu = await fetchMenu();
    const notFood = rewards.filter((reward) => reward.category !== 'food');

    expect(notFood.length).toBeGreaterThan(0);
    for (const reward of notFood) {
      expect(reward.productId).toBeUndefined();
      expect(rewardUnavailableReason(reward, menu.products)).toBeNull();
    }
  });

  it('is silent while the menu has not loaded, rather than guessing', () => {
    const cheesling = rewards.find((candidate) => candidate.id === 'reward-cheesling-fries')!;

    expect(rewardUnavailableReason(cheesling, undefined)).toBeNull();
  });

  it('is silent about a product the menu has never heard of', async () => {
    const menu = await fetchMenu();

    expect(rewardUnavailableReason({ productId: 'not-a-dish' }, menu.products)).toBeNull();
  });
});

/**
 * 3 and 4 — a rating already given, reopened.
 *
 * `useState(0)` never read the order. Fourteen seeded orders carry a rating,
 * `rateOrder` stores it and the receipt shows it back — and this screen drew
 * five empty stars and a disabled button over it.
 */
describe('the rating screen for an order already rated', () => {
  it('has seeded orders to reopen', async () => {
    const orders = await fetchOrders();
    const rated = orders.filter((order) => order.rating);

    expect(rated.length).toBeGreaterThanOrEqual(10);
    // Four stars and words to match — the case this screen used to draw empty.
    const reopened = orders.find((order) => order.reference === 'BBQ-4610');
    expect(reopened?.rating).toBe(4);
    expect(reopened?.ratingComment).toMatch(/Crispy as always/);
  });

  /**
   * Derived during render rather than copied in by an effect. The first draft
   * used a ref and a guarded effect, and the React Compiler refused it —
   * "calling setState synchronously within an effect can trigger cascading
   * renders" — which was the better design pointing at itself.
   */
  it('shows the record until the customer changes it, without an effect', () => {
    const screen = code('src/app/order/[id]/rate.tsx');

    expect(screen).toMatch(/const rating = ratingEdit \?\? order\.data\?\.rating \?\? 0;/);
    expect(screen).toMatch(
      /const comment = commentEdit \?\? order\.data\?\.ratingComment \?\? '';/,
    );
    expect(screen).not.toMatch(/useEffect/);
  });

  /** Seen in Chromium on BBQ-4610: five stars filled, the tags shown, "UPDATE RATING". */
  it('asks to update rather than to submit', () => {
    expect(code('src/app/order/[id]/rate.tsx')).toMatch(
      /label=\{order\.data\.rating \? 'Update rating' : 'Submit rating'\}/,
    );
  });
});

/**
 * 5 — a reader who has turned their browser's text size up.
 *
 * React Native Web hard-codes `fontScale: 1` and emits every size in absolute
 * pixels, so the web build ignored the setting outright: WCAG 1.4.4 requires
 * text to scale to 200% and the web build did not move at all. The native
 * builds always passed, which is why it went unnoticed.
 */
describe('the browser’s own text-size setting', () => {
  it('is read from the root font size, the way a browser expresses it', () => {
    const source = code('src/features/system/useFontScale.ts');

    expect(source).toMatch(/const WEB_BASE_FONT_SIZE = 16;/);
    expect(source).toMatch(/return size \/ WEB_BASE_FONT_SIZE;/);
  });

  it('is applied by Text, under the caps the type scale already sets', () => {
    const source = code('src/components/ui/Text.tsx');

    expect(source).toMatch(/if \(Platform\.OS !== 'web'\) return null;/);
    expect(source).toMatch(/cappedFontScale\(fontScale, cap\)/);
    // Leading travels with the size, or enlarged text overlaps the line above.
    expect(source).toMatch(/lineHeight: base\.lineHeight === undefined/);
  });

  /** 6 — content follows the reader all the way; chrome stops at 200%. */
  it('caps chrome and lets content run', () => {
    expect(cappedFontScale(3, fontScaleCapFor('buttonLg'))).toBe(CHROME_FONT_SCALE_CAP);
    expect(cappedFontScale(3, fontScaleCapFor('body'))).toBe(3);
    expect(cappedFontScale(1.3, fontScaleCapFor('buttonLg'))).toBe(1.3);
  });

  /**
   * 7 — a browser set *smaller* than the default.
   *
   * The one direction this must refuse. Touch targets are sized in points and
   * a label that shrank with the setting would push controls under the 44×44
   * floor `audit:screens` enforces — so a reader asking for smaller text gets
   * the design's own size rather than a smaller one.
   */
  it('never shrinks below the design size', () => {
    expect(cappedFontScale(0.75, undefined)).toBe(1);
    expect(cappedFontScale(0.5, CHROME_FONT_SCALE_CAP)).toBe(1);
  });

  it('survives a document that refuses to be measured', () => {
    // A hostile or sandboxed document can throw from `getComputedStyle`.
    expect(cappedFontScale(Number.NaN, undefined)).toBe(1);
    expect(cappedFontScale(0, undefined)).toBe(1);
  });
});

/**
 * 8 — the Button's second line, which had never once rendered in a browser.
 *
 * The component takes a second line and a taller box past 1× rather than
 * truncating, and it decided that from `useWindowDimensions().fontScale` —
 * which is 1 on web whatever the browser is set to. So the cap in the type
 * scale was doing its half of the job and the wrapping that absorbs the growth
 * was doing none of it.
 */
describe('a button at enlarged text', () => {
  it('reads the scale from the hook that works on all three platforms', () => {
    const source = code('src/components/ui/Button.tsx');

    expect(source).toMatch(/const fontScale = useFontScale\(\);/);
    expect(source).not.toMatch(/useWindowDimensions/);
  });
});

/**
 * 9 — the category tiles on Home, which clipped every tagline at 2×.
 *
 * Found by `audit:text-scale` on its first clean run: a 3:2 image defined the
 * tile's height and an absolutely-filled label floated over it inside
 * `overflow: hidden`, so the text had nowhere to grow. 32px of "Double-fried,
 * hand-glazed, unmistakably bb.q" was simply cut off.
 */
describe('a category tile with room to grow', () => {
  it('lets the label set the height and puts the picture behind it', () => {
    const screen = code('src/app/(tabs)/home.tsx');

    expect(screen).toMatch(/categoryImage: absoluteFill/);
    expect(screen).toMatch(/minHeight: 108/);
    // The aspect ratio no longer decides the box, so it is gone from the image.
    const tile = screen.slice(screen.indexOf('categoryGrid'), screen.indexOf('Your favourites'));
    expect(tile).not.toMatch(/aspectRatio=\{3 \/ 2\}/);
  });

  it('no longer truncates the tagline to one line', () => {
    const screen = code('src/app/(tabs)/home.tsx');
    const tile = screen.slice(screen.indexOf('categoryGrid'), screen.indexOf('Your favourites'));

    expect(tile).toMatch(/\{category\.tagline\}/);
    expect(tile).not.toMatch(/numberOfLines=\{1\}[\s\S]{0,80}category\.tagline/);
  });

  it('has taglines long enough for this to matter', () => {
    const longest = menuSnapshot.categories
      .map((category) => category.tagline)
      .sort((a, b) => b.length - a.length)[0];

    expect((longest ?? '').length).toBeGreaterThan(24);
  });
});

/**
 * 10 — the audit that can now see all of it.
 *
 * `audit:launch` used to say enlarged text could only be checked on a handset,
 * because the browser sweep was blind to font scale. That is no longer true,
 * and the note has to stop saying it — a launch list that asks for work already
 * done is a list people stop reading.
 */
describe('the enlarged-text sweep', () => {
  it('exists, and drives the two scales that matter', () => {
    const script = code('scripts/audit-text-scale.mjs');

    expect(script).toMatch(/label: '1\.3x', rootPx: 20\.8/);
    expect(script).toMatch(/label: '2\.0x', rootPx: 32/);
    expect(script).toMatch(/const WIDTH = 320;/);
  });

  /**
   * The check that caught this script's own first version, which set a root
   * size the app never read and passed every route for the wrong reason.
   */
  it('refuses to pass when the app did not actually scale', () => {
    expect(code('scripts/audit-text-scale.mjs')).toMatch(/the app did not scale at all/);
  });

  it('excludes overlays, which are meant to sit over the page', () => {
    const script = code('scripts/audit-text-scale.mjs');

    expect(script).toMatch(/position === 'fixed' \|\| position === 'sticky'/);
  });

  it('is registered as a script somebody can run', () => {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['audit:text-scale']).toBe('node scripts/audit-text-scale.mjs');
  });

  it('is what the launch note now points at, instead of asking for a handset', () => {
    const audit = code('scripts/audit-launch-readiness.mjs');

    expect(audit).toMatch(/npm run audit:text-scale/);
    expect(audit).not.toMatch(/the browser\s+sweep is blind to it/);
  });
});
