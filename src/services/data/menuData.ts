import type { Category, MenuSnapshot, OptionGroup, Product } from '@/types';

/**
 * The Pappas catalogue.
 *
 * This is the seed dataset the mock service serves and the shape the real API
 * must return. It lives in data, not in screens — swapping in a live endpoint
 * means changing one service, not thirty components.
 *
 * ── Where every dish here comes from ─────────────────────────────────────
 *
 * §1 and §15 both forbid inventing dishes, and §17.15 says to use a clearly
 * marked business-input placeholder when source data is missing. The brief's
 * primary source is the Pappas website (§2), which this build environment
 * cannot reach — the network egress policy blocks it. So the catalogue is
 * built from the one Pappas source that *is* available: the sixteen supplied
 * photographs, which are Pappas' own artwork and therefore Pappas' own menu.
 *
 * Each dish below is legible in a supplied composition, and `sourcedFrom`
 * records which one and what is visible in it. Two assets go further and
 * print their contents as text, which is supplied content rather than
 * interpretation:
 *
 *   - 09_mediterranean_fish_market carries a chalkboard reading "Fresh Fish ·
 *     Line Fish · Kingklip · Sea Bass · Dorado · Calamari · Prawns · Mussels".
 *   - 12_cocktails prints seven cocktails with their ingredients beneath
 *     each glass.
 *
 * Nothing else has been added. There is no lamb kleftiko here, no moussaka,
 * no saganaki — all of them plausible at a Greek restaurant in Sandton, none
 * of them visible in anything Pappas supplied.
 *
 * ── Why every price is zero ──────────────────────────────────────────────
 *
 * Because no price has been supplied, and a photograph does not carry one.
 *
 * Every dish is `priceStatus: 'awaiting-business-input'` with
 * `available: false`, which means the menu renders it with "Price on request"
 * and the add-to-order control disabled. The zero is never arithmetic: an
 * unavailable dish cannot enter a cart, so no total is ever computed from it.
 * That pairing is deliberate and `__tests__/pappasCatalogue.test.ts` holds it.
 *
 * This is the state §17.15 asks for, and it is not a placeholder in the
 * dismissive sense — it is the single most valuable output of this build for
 * the Pappas team, because `npm run audit:placeholders` prints the exact list
 * of what has to be supplied before the app can take an order. Filling it in
 * is a data change: set `basePrice`, set `priceStatus: 'confirmed'`, set
 * `available: true`. No code moves.
 */

/**
 * The dietary and character tags a photograph can honestly support.
 *
 * §6 permits a dietary tag "when verified". Vegetarian is verifiable by
 * looking — a plate of dolmades and halloumi has no meat on it. A gluten-free
 * or allergen claim is not, and none is made anywhere in this file: §15's
 * "do not invent … customer promises" covers allergens, and an allergen claim
 * is the one kind of invented content that can put somebody in hospital.
 */

/**
 * Standard preparation estimate.
 *
 * §15 forbids inventing customer promises, and a per-dish cook time is one.
 * Every dish therefore carries the restaurant's single preparation figure
 * from `businessRules` rather than a number chosen per plate; the kitchen can
 * refine it per dish when it wants to.
 */
const PREP_MINUTES = 25;

/** Every dish is awaiting its price. The pairing that makes that safe. */
const UNPRICED = {
  basePrice: 0,
  priceStatus: 'awaiting-business-input',
  available: false,
} as const;

/**
 * Where a dish was read from, kept on the record rather than in a comment.
 *
 * Not part of the `Product` type — it would travel to the client for no
 * reason — but held beside the catalogue so `audit:placeholders` can print
 * "Pork Souvlaki, read from 07_souvlaki" and a reviewer can check it against
 * the artwork.
 */
export const DISH_SOURCES: Record<string, string> = {};

interface DishSpec {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  categoryId: Product['categoryId'];
  assetKey: Product['assetKey'];
  /** Which supplied asset this dish is legible in. */
  sourcedFrom: string;
  tags?: Product['tags'];
  serves?: string;
  optionGroups?: OptionGroup[];
  recommendedProductIds?: string[];
}

function dish(spec: DishSpec): Product {
  DISH_SOURCES[spec.id] = spec.sourcedFrom;
  return {
    id: spec.id,
    slug: spec.id,
    name: spec.name,
    shortDescription: spec.shortDescription,
    description: spec.description,
    categoryId: spec.categoryId,
    assetKey: spec.assetKey,
    spiceLevel: 0,
    tags: spec.tags ?? [],
    optionGroups: spec.optionGroups ?? [],
    recommendedProductIds: spec.recommendedProductIds ?? [],
    preparationMinutes: PREP_MINUTES,
    serves: spec.serves ?? '1',
    // Empty, deliberately. See the note on dietary tags above: an allergen
    // list nobody supplied is the one invented claim that can hurt somebody.
    allergens: [],
    ...UNPRICED,
  };
}

/**
 * The ten categories, in menu order.
 *
 * Order follows a Greek table rather than a delivery app's: small plates and
 * salads first, then the grill and the sea, then sweet. Breakfast and Drinks
 * sit at the ends because they are separate occasions. §6 asks for a menu
 * that "feels like a premium digital menu, not a catalogue grid", and the
 * sequence a kitchen would serve in is part of that.
 */
export const categories: Category[] = [
  {
    id: 'mezedakia',
    name: 'Mezedakia',
    tagline: 'Small plates. Big moments.',
    assetKey: 'mezedakia',
    sortOrder: 1,
  },
  {
    id: 'salads',
    name: 'Salads',
    tagline: 'Fresh. Vibrant. Mediterranean.',
    assetKey: 'salads',
    sortOrder: 2,
  },
  {
    id: 'souvlaki',
    name: 'Souvlaki',
    tagline: 'A taste of Greece.',
    assetKey: 'souvlaki',
    sortOrder: 3,
  },
  {
    id: 'seafood',
    name: 'Seafood',
    tagline: 'Fresh from the Mediterranean.',
    assetKey: 'seafood',
    sortOrder: 4,
  },
  {
    id: 'fish-market',
    name: 'Fish Market',
    tagline: 'Ocean to our table.',
    assetKey: 'fishMarket',
    sortOrder: 5,
  },
  {
    id: 'signature-mains',
    name: 'Signature Mains',
    tagline: 'Timeless classics.',
    assetKey: 'signatureMains',
    sortOrder: 6,
  },
  {
    id: 'steak-on-the-rock',
    name: 'Steak on the Rock',
    tagline: 'Sear. Slice. Savour.',
    assetKey: 'steakOnRock',
    sortOrder: 7,
  },
  {
    id: 'desserts',
    name: 'Desserts',
    tagline: 'Always a perfect ending.',
    assetKey: 'desserts',
    sortOrder: 8,
  },
  {
    id: 'breakfast',
    name: 'Breakfast',
    tagline: 'Good food, brighter mornings.',
    assetKey: 'breakfast',
    sortOrder: 9,
  },
  {
    id: 'drinks',
    name: 'Drinks',
    tagline: 'Bold flavours. Golden moments.',
    assetKey: 'cocktails',
    sortOrder: 10,
  },
];

/**
 * Category taglines above are the sub-lines the supplied posters themselves
 * carry — "Small plates. Big moments." is printed on 03, "Sear. Slice.
 * Savour." on 08. They are Pappas' own words, used as live type rather than
 * left baked in the image, which is exactly the swap §6 and §14 ask for.
 */

const MEZEDAKIA: Product[] = [
  dish({
    id: 'spanakopita',
    name: 'Spanakopita',
    shortDescription: 'Spinach and feta in crisp filo',
    description:
      'Spinach and feta folded into filo and baked until the pastry shatters. Served with ' +
      'micro herbs.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — filo triangles, front left',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'hummus',
    name: 'Hummus',
    shortDescription: 'Chickpea, olive oil, paprika',
    description:
      'Whipped chickpea, finished with olive oil, whole chickpeas and a dusting of paprika. ' +
      'Served with warm pita.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — centre bowl',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'tzatziki',
    name: 'Tzatziki',
    shortDescription: 'Yoghurt, cucumber, dill',
    description: 'Thick yoghurt with cucumber and dill, finished with olive oil.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — left bowl',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'grilled-halloumi',
    name: 'Grilled Halloumi',
    shortDescription: 'Chargrilled, lemon, oregano',
    description: 'Halloumi grilled over flame until it takes the bars, with lemon and oregano.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — centre plate',
    tags: ['vegetarian'],
  }),
  /**
   * Calamari appears on both the Mezedakia and the Seafood poster, which is
   * how a Greek menu works — the same thing, in a sharing size and a main
   * size. Both are kept, because a customer browsing Mezedakia should find
   * what is in the photograph.
   *
   * The two are named differently on purpose. Listing "Grilled Calamari"
   * twice returns two identical rows from a search with nothing to choose
   * between them, which reads as a duplicate record rather than as two
   * portions.
   */
  dish({
    id: 'calamari-meze',
    name: 'Calamari',
    shortDescription: 'Flame-grilled, herbs, lemon — a plate to share',
    description: 'Calamari rings and tentacles grilled hot and fast, with herbs and lemon.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — right plate',
    tags: ['sharing'],
  }),
  dish({
    id: 'dolmades',
    name: 'Dolmades',
    shortDescription: 'Stuffed vine leaves',
    description: 'Vine leaves rolled around rice and herbs, served cool with lemon.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — bottom right bowl',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'marinated-olives',
    name: 'Marinated Olives',
    shortDescription: 'Green and kalamata',
    description: 'Green and kalamata olives, marinated, with lemon.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — top right bowl',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'pita-and-oil',
    name: 'Warm Pita & Olive Oil',
    shortDescription: 'Grilled flatbread, olive oil',
    description: 'Flatbread grilled to order, with olive oil and herbs for dipping.',
    categoryId: 'mezedakia',
    assetKey: 'mezedakia',
    sourcedFrom: '03_mezedakia — bottom left basket',
    tags: ['vegetarian', 'sharing'],
  }),
];

const SALADS: Product[] = [
  dish({
    id: 'greek-salad',
    name: 'Greek Salad',
    shortDescription: 'Feta, cucumber, tomato, kalamata',
    description:
      'Cucumber, tomato, red onion and kalamata olives under a slab of feta, dressed with ' +
      'olive oil and oregano.',
    categoryId: 'salads',
    assetKey: 'salads',
    sourcedFrom: '05_salads — left bowl',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'grilled-chicken-avocado-salad',
    name: 'Grilled Chicken & Avocado Salad',
    shortDescription: 'Chargrilled chicken, avocado, feta',
    description:
      'Chargrilled chicken over leaves with avocado, tomato and red onion, finished with ' +
      'micro herbs.',
    categoryId: 'salads',
    assetKey: 'salads',
    sourcedFrom: '05_salads — front bowl',
  }),
  dish({
    id: 'prawn-avocado-salad',
    name: 'Prawn & Avocado Salad',
    shortDescription: 'Grilled prawns, avocado, feta',
    description: 'Grilled prawns with avocado, feta and olives over dressed leaves.',
    categoryId: 'salads',
    assetKey: 'salads',
    sourcedFrom: '05_salads — right bowl',
  }),
  dish({
    id: 'calamari-salad',
    name: 'Calamari Salad',
    shortDescription: 'Crisp calamari, avocado, leaves',
    description: 'Crisp calamari over leaves with avocado, tomato and olives.',
    categoryId: 'salads',
    assetKey: 'salads',
    sourcedFrom: '05_salads — top bowl',
  }),
];

const SOUVLAKI: Product[] = [
  dish({
    id: 'pork-souvlaki',
    name: 'Pork Souvlaki',
    shortDescription: 'Flame-grilled skewers, pita, tzatziki',
    description:
      'Pork grilled over flame on the skewer, with warm pita, tzatziki and a village salad ' +
      'of tomato, cucumber and red onion.',
    categoryId: 'souvlaki',
    assetKey: 'souvlaki',
    sourcedFrom: '07_souvlaki — front plate',
    tags: ['signature'],
  }),
  dish({
    id: 'chicken-souvlaki',
    name: 'Chicken Souvlaki',
    shortDescription: 'Flame-grilled skewers, pita, tzatziki',
    description: 'Chicken grilled on the skewer, with warm pita, tzatziki and village salad.',
    categoryId: 'souvlaki',
    assetKey: 'souvlaki',
    sourcedFrom: '07_souvlaki — rear plate',
  }),
];

const SEAFOOD: Product[] = [
  dish({
    id: 'grilled-king-prawns',
    name: 'Grilled King Prawns',
    shortDescription: 'Whole prawns, herbs, grilled lemon',
    description:
      'King prawns grilled in the shell with herbs and olive oil, served with grilled lemon.',
    categoryId: 'seafood',
    assetKey: 'seafood',
    sourcedFrom: '04_seafood — centre platter',
    tags: ['signature'],
  }),
  dish({
    id: 'mussels',
    name: 'Mussels',
    shortDescription: 'Black mussels, white wine, grilled bread',
    description: 'Black mussels in a white wine broth, with grilled bread.',
    categoryId: 'seafood',
    assetKey: 'seafood',
    sourcedFrom: '04_seafood — left bowl',
  }),
  dish({
    id: 'oysters',
    name: 'Oysters',
    shortDescription: 'On ice, mignonette, lemon',
    description: 'Oysters served on ice with mignonette and lemon.',
    categoryId: 'seafood',
    assetKey: 'seafood',
    sourcedFrom: '04_seafood — iced platter',
  }),
  dish({
    id: 'kataifi-prawns',
    name: 'Kataifi Prawns',
    shortDescription: 'Prawns wrapped in kataifi pastry',
    description: 'Prawns wrapped in kataifi pastry and fried crisp, with a dipping sauce.',
    categoryId: 'seafood',
    assetKey: 'seafood',
    sourcedFrom: '04_seafood — right plate',
  }),
  dish({
    id: 'grilled-calamari',
    name: 'Grilled Calamari',
    shortDescription: 'Flame-grilled, tzatziki, lemon',
    description: 'Calamari grilled hot and fast, with tzatziki and lemon.',
    categoryId: 'seafood',
    assetKey: 'seafood',
    sourcedFrom: '04_seafood — bottom left plate',
  }),
];

/**
 * The Fish Market.
 *
 * The one category whose contents are *printed* in the supplied artwork:
 * 09's chalkboard reads "Fresh Fish · Line Fish · Kingklip · Sea Bass ·
 * Dorado · Calamari · Prawns · Mussels". That is a supplied menu, not an
 * interpretation of a photograph, so these seven are as well-sourced as
 * anything in this file.
 *
 * Calamari, prawns and mussels already appear under Seafood, which is how the
 * artwork has it — the fish market is a counter, and the same catch is
 * cooked both ways. They are not duplicated here.
 */
const FISH_MARKET: Product[] = [
  dish({
    id: 'line-fish',
    name: 'Line Fish',
    shortDescription: 'The day’s catch, grilled whole',
    description:
      'The day’s line fish, grilled whole with herbs, olive oil and lemon. Ask your host ' +
      'what came in this morning.',
    categoryId: 'fish-market',
    assetKey: 'fishMarket',
    sourcedFrom: '09_mediterranean_fish_market — chalkboard, "Line Fish"',
    tags: ['seasonal'],
  }),
  dish({
    id: 'kingklip',
    name: 'Kingklip',
    shortDescription: 'Grilled, herbs, lemon',
    description: 'Kingklip grilled with herbs and olive oil, finished with lemon.',
    categoryId: 'fish-market',
    assetKey: 'fishMarket',
    sourcedFrom: '09_mediterranean_fish_market — chalkboard, "Kingklip"',
  }),
  dish({
    id: 'sea-bass',
    name: 'Sea Bass',
    shortDescription: 'Grilled whole, herbs, lemon',
    description: 'Whole sea bass grilled with herbs, tomato and grilled lemon.',
    categoryId: 'fish-market',
    assetKey: 'fishMarket',
    sourcedFrom: '09_mediterranean_fish_market — chalkboard, "Sea Bass"',
  }),
  dish({
    id: 'dorado',
    name: 'Dorado',
    shortDescription: 'Grilled whole, herbs, lemon',
    description: 'Whole dorado grilled with herbs and olive oil.',
    categoryId: 'fish-market',
    assetKey: 'fishMarket',
    sourcedFrom: '09_mediterranean_fish_market — chalkboard, "Dorado"',
  }),
];

const SIGNATURE_MAINS: Product[] = [
  dish({
    id: 'lamb-shank',
    name: 'Lamb Shank',
    shortDescription: 'Slow-cooked, mash, rosemary',
    description:
      'Lamb shank cooked slowly until it gives, served on mash with roasted vegetables and ' +
      'its own sauce.',
    categoryId: 'signature-mains',
    assetKey: 'signatureMains',
    sourcedFrom: '06_signature_mains — rear left plate',
    tags: ['signature'],
  }),
  dish({
    id: 'lamb-chops',
    name: 'Lamb Chops',
    shortDescription: 'Grilled, herbs, grilled lemon',
    description: 'Lamb chops grilled over flame with herbs, served with tzatziki and lemon.',
    categoryId: 'signature-mains',
    assetKey: 'signatureMains',
    sourcedFrom: '06_signature_mains — left plate',
  }),
  dish({
    id: 'pork-ribs',
    name: 'Pork Ribs',
    shortDescription: 'Glazed, slaw',
    description: 'A rack of ribs, glazed and grilled, with slaw.',
    categoryId: 'signature-mains',
    assetKey: 'signatureMains',
    sourcedFrom: '06_signature_mains — right plate',
  }),
  dish({
    id: 'grilled-chicken',
    name: 'Grilled Chicken',
    shortDescription: 'Half chicken, lemon, herbs',
    description: 'Chicken grilled with herbs and lemon, served with chips.',
    categoryId: 'signature-mains',
    assetKey: 'signatureMains',
    sourcedFrom: '06_signature_mains — top right plate',
  }),
  dish({
    id: 'chicken-breast-cream-sauce',
    name: 'Chicken Breast',
    shortDescription: 'Cream sauce, spinach, baby potatoes',
    description:
      'Chargrilled chicken breast in a cream sauce over spinach, with baby potatoes and ' +
      'blistered tomato.',
    categoryId: 'signature-mains',
    assetKey: 'signatureMains',
    sourcedFrom: '06_signature_mains — front plate',
  }),
];

const STEAK_ON_THE_ROCK: Product[] = [
  dish({
    id: 'steak-on-the-rock',
    name: 'Steak on the Rock',
    shortDescription: 'Served searing on volcanic stone',
    description:
      'A steak brought to the table still searing on a volcanic stone, so you finish it ' +
      'exactly as you like it. Served with three sauces and chips.',
    categoryId: 'steak-on-the-rock',
    assetKey: 'steakOnRock',
    sourcedFrom: '08_steak_on_the_rock — the whole composition',
    tags: ['signature'],
    serves: '1',
  }),
];

const DESSERTS: Product[] = [
  dish({
    id: 'baklava',
    name: 'Baklava',
    shortDescription: 'Filo, pistachio, honey, ice cream',
    description: 'Layered filo with pistachio and honey, served warm with a scoop of ice cream.',
    categoryId: 'desserts',
    assetKey: 'desserts',
    sourcedFrom: '10_desserts — front plate',
    tags: ['signature', 'vegetarian'],
  }),
  dish({
    id: 'chocolate-fondant',
    name: 'Chocolate Fondant',
    shortDescription: 'Molten centre, vanilla ice cream',
    description: 'Chocolate fondant with a molten centre, vanilla ice cream and berries.',
    categoryId: 'desserts',
    assetKey: 'desserts',
    sourcedFrom: '10_desserts — right plate',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'berry-cheesecake',
    name: 'Berry Cheesecake',
    shortDescription: 'Baked cheesecake, berry compote',
    description: 'Baked cheesecake under a berry compote, with fresh berries and mint.',
    categoryId: 'desserts',
    assetKey: 'desserts',
    sourcedFrom: '10_desserts — left plate',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'tiramisu',
    name: 'Tiramisu',
    shortDescription: 'Layered, cocoa',
    description: 'Tiramisu layered in the glass and dusted with cocoa.',
    categoryId: 'desserts',
    assetKey: 'desserts',
    sourcedFrom: '10_desserts — rear glass',
    tags: ['vegetarian'],
  }),
];

const BREAKFAST: Product[] = [
  dish({
    id: 'classic-breakfast',
    name: 'Classic Breakfast',
    shortDescription: 'Eggs, sourdough, tomato, mushroom, feta',
    description:
      'Fried eggs with grilled sourdough, blistered tomato, mushrooms, wilted spinach and feta.',
    categoryId: 'breakfast',
    assetKey: 'breakfast',
    sourcedFrom: '11_breakfast — centre plate, tile "CLASSIC"',
  }),
  dish({
    id: 'healthy-start',
    name: 'Healthy Start',
    shortDescription: 'Yoghurt, granola, berries, honey',
    description: 'Greek yoghurt layered with granola, berries and honey.',
    categoryId: 'breakfast',
    assetKey: 'breakfast',
    sourcedFrom: '11_breakfast — tile "HEALTHY START"',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'sweet-mornings',
    name: 'Pancakes',
    shortDescription: 'Stacked, berries, syrup',
    description: 'A stack of pancakes with berries and syrup.',
    categoryId: 'breakfast',
    assetKey: 'breakfast',
    sourcedFrom: '11_breakfast — tile "SWEET MORNINGS"',
    tags: ['vegetarian'],
  }),
  dish({
    id: 'mediterranean-breakfast',
    name: 'Mediterranean Breakfast',
    shortDescription: 'Feta, olives, tomato, cucumber, pita',
    description:
      'Feta, olives, tomato, cucumber and dips with warm pita — breakfast the Mediterranean way.',
    categoryId: 'breakfast',
    assetKey: 'breakfast',
    sourcedFrom: '11_breakfast — tile "MEDITERRANEAN STYLE"',
    tags: ['vegetarian', 'sharing'],
  }),
  dish({
    id: 'salmon-scrambled-eggs',
    name: 'Salmon & Scrambled Eggs',
    shortDescription: 'Smoked salmon, scrambled eggs, sourdough',
    description: 'Scrambled eggs and smoked salmon on grilled sourdough.',
    categoryId: 'breakfast',
    assetKey: 'breakfast',
    sourcedFrom: '11_breakfast — first tile',
  }),
];

/**
 * Drinks.
 *
 * The best-sourced category in the file. 12_cocktails prints seven cocktails
 * with their ingredients set beneath each glass, which is supplied copy — so
 * the descriptions below are Pappas' own words, transcribed, not written.
 */
const DRINKS: Product[] = [
  dish({
    id: 'aperol-spritz',
    name: 'Aperol Spritz',
    shortDescription: 'Aperol, Prosecco, soda, orange',
    description: 'Aperol, Prosecco, soda, orange. Light. Bubbly. Iconic.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "APEROL SPRITZ", ingredients printed',
  }),
  dish({
    id: 'mojito',
    name: 'Mojito',
    shortDescription: 'White rum, fresh mint, lime, soda',
    description: 'White rum, fresh mint, lime, soda. Fresh. Zesty. Timeless.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "MOJITO", ingredients printed',
  }),
  dish({
    id: 'strawberry-daiquiri',
    name: 'Strawberry Daiquiri',
    shortDescription: 'Rum, strawberry, lime',
    description: 'Rum, strawberry, lime, natural sweetness. Fruity. Smooth. Irresistible.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "STRAWBERRY DAIQUIRI", ingredients printed',
  }),
  dish({
    id: 'classic-margarita',
    name: 'Classic Margarita',
    shortDescription: 'Tequila, triple sec, lime',
    description: 'Tequila, triple sec, lime. Crisp. Bold. Refreshing.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "CLASSIC MARGARITA", ingredients printed',
  }),
  dish({
    id: 'greek-gin-tonic',
    name: 'Greek G&T',
    shortDescription: 'Premium gin, Mediterranean botanicals, tonic',
    description: 'Premium gin, Mediterranean botanicals, tonic. Elegant. Herbal. Refined.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "GREEK G&T", ingredients printed',
    tags: ['signature'],
  }),
  dish({
    id: 'old-fashioned',
    name: 'Old Fashioned',
    shortDescription: 'Whisky, bitters, orange',
    description: 'Whisky, bitters, orange. Classic. Strong. Sophisticated.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "OLD FASHIONED", ingredients printed',
  }),
  dish({
    id: 'moscow-mule',
    name: 'Moscow Mule',
    shortDescription: 'Vodka, ginger beer, lime',
    description: 'Vodka, ginger beer, lime. Bold. Refreshing. Different.',
    categoryId: 'drinks',
    assetKey: 'cocktails',
    sourcedFrom: '12_cocktails — tile "MOSCOW MULE", ingredients printed',
  }),
];

export const products: Product[] = [
  ...MEZEDAKIA,
  ...SALADS,
  ...SOUVLAKI,
  ...SEAFOOD,
  ...FISH_MARKET,
  ...SIGNATURE_MAINS,
  ...STEAK_ON_THE_ROCK,
  ...DESSERTS,
  ...BREAKFAST,
  ...DRINKS,
];

export const menuSnapshot: MenuSnapshot = {
  categories,
  products,
  updatedAt: new Date('2026-09-19T00:00:00Z').toISOString(),
};
