import type { ImageSourcePropType } from 'react-native';

/**
 * The Pappas photography registry — brief §10 and §17.5.
 *
 * Every image in the app resolves through this module. Screens never
 * `require()` a file directly; they pass a `PappasAssetKey` and a surface,
 * and get back the derivative cut for that surface.
 *
 * ── Why the masters are not reachable from here ──────────────────────────
 *
 * §17.5's example registry maps each key straight at
 * `assets/pappas/food/03_mezedakia.png`. That is the right *shape* and the
 * wrong target: those masters are 1122×1402 PNGs of about 2.5MB each, and
 * §13 asks us to "avoid huge hero assets on first load" and to optimise
 * photography with responsive sizing. A menu screen showing eight category
 * cards would pull 20MB to render eight 400px tiles.
 *
 * So this map points at the derivatives produced by `npm run assets:pappas`,
 * and the masters are deliberately unreachable from application code. The
 * whole derived set is 6.7MB across 52 crops — less than three masters.
 *
 * ── Why three of the sixteen are missing ─────────────────────────────────
 *
 * 01, 02 and 15 are art-direction references: the photography master style,
 * the style guide, and the CI brand sheet. §10 gives each of them the
 * implementation rule "use as visual direction" or "treat as the visual
 * system reference" — they are instructions to the people building the app,
 * not content for it. They have no keys here and the derivative pipeline
 * refuses to cut them, so there is no way to put the CI sheet on a home
 * screen by accident. They remain in the repository, under
 * `assets/pappas/`, where a designer can find them.
 */

/** The thirteen assets that appear in the product. */
export const PAPPAS_ASSET_KEYS = [
  'mezedakia',
  'seafood',
  'salads',
  'signatureMains',
  'souvlaki',
  'steakOnRock',
  'fishMarket',
  'desserts',
  'breakfast',
  'cocktails',
  'diningRoom',
  'barDetail',
  'squareView',
] as const;

export type PappasAssetKey = (typeof PAPPAS_ASSET_KEYS)[number];

/**
 * Which crop a surface needs.
 *
 *   thumb   1:1    400px   menu rows, cart lines, reorder chips
 *   card    4:5    800px   category cards, editorial cards, dish cards
 *   hero    4:3   1400px   home hero, category hero, product detail
 *   banner  16:9  1600px   campaign banners, event cards
 */
export type PappasAssetVariant = 'thumb' | 'card' | 'hero' | 'banner';

const REGISTRY: Record<PappasAssetKey, Record<PappasAssetVariant, ImageSourcePropType>> = {
  mezedakia: {
    thumb: require('../../assets/pappas/derived/thumb/03_mezedakia.jpg'),
    card: require('../../assets/pappas/derived/card/03_mezedakia.jpg'),
    hero: require('../../assets/pappas/derived/hero/03_mezedakia.jpg'),
    banner: require('../../assets/pappas/derived/banner/03_mezedakia.jpg'),
  },
  seafood: {
    thumb: require('../../assets/pappas/derived/thumb/04_seafood.jpg'),
    card: require('../../assets/pappas/derived/card/04_seafood.jpg'),
    hero: require('../../assets/pappas/derived/hero/04_seafood.jpg'),
    banner: require('../../assets/pappas/derived/banner/04_seafood.jpg'),
  },
  salads: {
    thumb: require('../../assets/pappas/derived/thumb/05_salads.jpg'),
    card: require('../../assets/pappas/derived/card/05_salads.jpg'),
    hero: require('../../assets/pappas/derived/hero/05_salads.jpg'),
    banner: require('../../assets/pappas/derived/banner/05_salads.jpg'),
  },
  signatureMains: {
    thumb: require('../../assets/pappas/derived/thumb/06_signature_mains.jpg'),
    card: require('../../assets/pappas/derived/card/06_signature_mains.jpg'),
    hero: require('../../assets/pappas/derived/hero/06_signature_mains.jpg'),
    banner: require('../../assets/pappas/derived/banner/06_signature_mains.jpg'),
  },
  souvlaki: {
    thumb: require('../../assets/pappas/derived/thumb/07_souvlaki.jpg'),
    card: require('../../assets/pappas/derived/card/07_souvlaki.jpg'),
    hero: require('../../assets/pappas/derived/hero/07_souvlaki.jpg'),
    banner: require('../../assets/pappas/derived/banner/07_souvlaki.jpg'),
  },
  steakOnRock: {
    thumb: require('../../assets/pappas/derived/thumb/08_steak_on_the_rock.jpg'),
    card: require('../../assets/pappas/derived/card/08_steak_on_the_rock.jpg'),
    hero: require('../../assets/pappas/derived/hero/08_steak_on_the_rock.jpg'),
    banner: require('../../assets/pappas/derived/banner/08_steak_on_the_rock.jpg'),
  },
  fishMarket: {
    thumb: require('../../assets/pappas/derived/thumb/09_mediterranean_fish_market.jpg'),
    card: require('../../assets/pappas/derived/card/09_mediterranean_fish_market.jpg'),
    hero: require('../../assets/pappas/derived/hero/09_mediterranean_fish_market.jpg'),
    banner: require('../../assets/pappas/derived/banner/09_mediterranean_fish_market.jpg'),
  },
  desserts: {
    thumb: require('../../assets/pappas/derived/thumb/10_desserts.jpg'),
    card: require('../../assets/pappas/derived/card/10_desserts.jpg'),
    hero: require('../../assets/pappas/derived/hero/10_desserts.jpg'),
    banner: require('../../assets/pappas/derived/banner/10_desserts.jpg'),
  },
  breakfast: {
    thumb: require('../../assets/pappas/derived/thumb/11_breakfast.jpg'),
    card: require('../../assets/pappas/derived/card/11_breakfast.jpg'),
    hero: require('../../assets/pappas/derived/hero/11_breakfast.jpg'),
    banner: require('../../assets/pappas/derived/banner/11_breakfast.jpg'),
  },
  cocktails: {
    thumb: require('../../assets/pappas/derived/thumb/12_cocktails.jpg'),
    card: require('../../assets/pappas/derived/card/12_cocktails.jpg'),
    hero: require('../../assets/pappas/derived/hero/12_cocktails.jpg'),
    banner: require('../../assets/pappas/derived/banner/12_cocktails.jpg'),
  },
  diningRoom: {
    thumb: require('../../assets/pappas/derived/thumb/13_main_dining_room.jpg'),
    card: require('../../assets/pappas/derived/card/13_main_dining_room.jpg'),
    hero: require('../../assets/pappas/derived/hero/13_main_dining_room.jpg'),
    banner: require('../../assets/pappas/derived/banner/13_main_dining_room.jpg'),
  },
  barDetail: {
    thumb: require('../../assets/pappas/derived/thumb/14_bar_detail.jpg'),
    card: require('../../assets/pappas/derived/card/14_bar_detail.jpg'),
    hero: require('../../assets/pappas/derived/hero/14_bar_detail.jpg'),
    banner: require('../../assets/pappas/derived/banner/14_bar_detail.jpg'),
  },
  squareView: {
    thumb: require('../../assets/pappas/derived/thumb/16_window_square_view.jpg'),
    card: require('../../assets/pappas/derived/card/16_window_square_view.jpg'),
    hero: require('../../assets/pappas/derived/hero/16_window_square_view.jpg'),
    banner: require('../../assets/pappas/derived/banner/16_window_square_view.jpg'),
  },
};

export function pappasAsset(key: PappasAssetKey, variant: PappasAssetVariant): ImageSourcePropType {
  return REGISTRY[key][variant];
}

/**
 * What each asset is *of*, for the accessibility label.
 *
 * §13 asks for accessible labels on every icon-only action, and a
 * photographic card that navigates somewhere is exactly that: a control whose
 * only content is an image. These describe the photograph rather than
 * repeating the heading printed beside it — a screen reader that says
 * "Mezedakia. Mezedakia." has been given two labels and no information.
 */
const DESCRIPTIONS: Record<PappasAssetKey, string> = {
  mezedakia:
    'A spread of small plates — spanakopita, hummus, grilled halloumi, dolmades and warm pita',
  seafood: 'Grilled king prawns, mussels and oysters on a dark stone table',
  salads: 'Mediterranean salad bowls with feta, avocado and grilled chicken',
  signatureMains: 'Slow-cooked lamb shank, lamb chops and grilled fish, plated',
  souvlaki: 'Flame-grilled souvlaki skewers with pita, tzatziki and village salad',
  steakOnRock: 'A steak served searing on a hot volcanic stone with three sauces',
  fishMarket: 'The day’s catch — whole grilled fish, calamari, prawns and mussels',
  desserts: 'Pistachio baklava, chocolate fondant and Greek yoghurt cheesecake',
  breakfast: 'A Mediterranean breakfast in morning light — eggs, sourdough, fruit and coffee',
  cocktails: 'Cocktails on the terrace at golden hour',
  diningRoom: 'The Pappas dining room — olive trees, woven pendants and candlelit tables',
  barDetail: 'The lit stone bar counter at dusk',
  squareView: 'A window table looking out onto Nelson Mandela Square',
};

export function pappasAssetDescription(key: PappasAssetKey): string {
  return DESCRIPTIONS[key];
}
