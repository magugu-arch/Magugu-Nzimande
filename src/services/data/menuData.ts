import type { Category, MenuSnapshot, OptionGroup, Product } from '@/types';

/**
 * bb.q Chicken South Africa menu catalogue (brief §10).
 *
 * This is the seed dataset the mock service serves and the shape the real API
 * must return. It lives in data, not in screens — swapping in a live endpoint
 * means changing one service, not thirty components.
 *
 * Prices are ZAR, inclusive of VAT.
 */

const SIZE_GROUP = (base: string, prices: [number, number, number]): OptionGroup => ({
  id: `${base}-size`,
  name: 'Choose your size',
  kind: 'size',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: [`${base}-size-medium`],
  options: [
    {
      id: `${base}-size-small`,
      name: 'Small · 6 pieces',
      description: 'Serves 1 – 2',
      priceDelta: prices[0],
      available: true,
    },
    {
      id: `${base}-size-medium`,
      name: 'Medium · 9 pieces',
      description: 'Serves 2 – 3',
      priceDelta: prices[1],
      available: true,
    },
    {
      id: `${base}-size-large`,
      name: 'Large · 12 pieces',
      description: 'Serves 3 – 4',
      priceDelta: prices[2],
      available: true,
    },
  ],
});

/**
 * How many wings, which is a different question from what size box.
 *
 * Written inline on Golden Original Wings while it was the only product in the
 * category. Three sauced wings joined it, and a size axis copied four times is
 * four chances for 10 wings to cost a different amount depending on the sauce.
 * Called with `'wings'` it reproduces the original ids exactly, so no existing
 * option id moved to make room for this.
 */
const WINGS_SIZE_GROUP = (base: string): OptionGroup => ({
  id: `${base}-size`,
  name: 'How many wings?',
  kind: 'size',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: [`${base}-size-10`],
  options: [
    { id: `${base}-size-6`, name: '6 wings', priceDelta: 0, available: true },
    { id: `${base}-size-10`, name: '10 wings', priceDelta: 65, available: true },
    { id: `${base}-size-16`, name: '16 wings', priceDelta: 145, available: true },
  ],
});

/**
 * The drink that comes with a kids meal, and which one.
 *
 * Every kids meal in the brief is "a complete meal … and a cool drink", so the
 * drink is part of what was bought rather than an upsell. `DRINK_GROUP` prices
 * each one as an addition, which is right for a chicken box and wrong here —
 * a customer would be charged R22 for the drink the box is photographed with.
 * So this is the same list at zero, with `minSelect: 1`, because a meal with
 * no drink chosen is an order the kitchen cannot fill.
 *
 * Milkis is deliberately absent. It is the one premium drink in
 * `DRINK_GROUP` at R32, and whether a kids meal includes it at no charge is a
 * margin decision rather than a UI one. `audit:launch` asks for the included
 * set to be signed off along with the prices.
 */
const KIDS_DRINK_GROUP = (base: string): OptionGroup => ({
  id: `${base}-drink`,
  name: 'Which cool drink?',
  kind: 'drink',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: [`${base}-drink-coke`],
  options: [
    { id: `${base}-drink-coke`, name: 'Coca-Cola 330ml', priceDelta: 0, available: true },
    { id: `${base}-drink-coke-zero`, name: 'Coke Zero 330ml', priceDelta: 0, available: true },
    { id: `${base}-drink-sprite`, name: 'Sprite 330ml', priceDelta: 0, available: true },
    { id: `${base}-drink-water`, name: 'Still water 500ml', priceDelta: 0, available: true },
  ],
});

/**
 * The dip that comes in the box, for the two meals photographed with one.
 *
 * Same reasoning as the drink: `SAUCE_GROUP` sells an *extra* dip at R18, and
 * this is the one already included. The four sauces are the ones the kitchen
 * already makes for `SAUCE_GROUP`, minus the Secret Sauce, which is the
 * priciest and the only one that is not obviously a children's flavour.
 */
const KIDS_DIP_GROUP = (base: string): OptionGroup => ({
  id: `${base}-dip`,
  name: 'Which dipping sauce?',
  kind: 'addon',
  minSelect: 1,
  maxSelect: 1,
  defaultOptionIds: [`${base}-dip-honey`],
  options: [
    { id: `${base}-dip-honey`, name: 'Honey Garlic dip', priceDelta: 0, available: true },
    { id: `${base}-dip-soy`, name: 'Soy Garlic dip', priceDelta: 0, available: true },
    { id: `${base}-dip-ranch`, name: 'Creamy ranch', priceDelta: 0, available: true },
  ],
});

const SAUCE_GROUP = (base: string): OptionGroup => ({
  id: `${base}-sauce`,
  name: 'Extra dipping sauce',
  kind: 'addon',
  minSelect: 0,
  maxSelect: 3,
  defaultOptionIds: [],
  options: [
    { id: `${base}-sauce-honey`, name: 'Honey Garlic dip', priceDelta: 18, available: true },
    { id: `${base}-sauce-soy`, name: 'Soy Garlic dip', priceDelta: 18, available: true },
    { id: `${base}-sauce-hot`, name: 'Hot Spicy dip', priceDelta: 18, available: true },
    { id: `${base}-sauce-secret`, name: 'Secret Sauce dip', priceDelta: 20, available: true },
    { id: `${base}-sauce-ranch`, name: 'Creamy ranch', priceDelta: 16, available: true },
  ],
});

const SIDE_GROUP = (base: string): OptionGroup => ({
  id: `${base}-side`,
  name: 'Add a side',
  kind: 'side',
  minSelect: 0,
  maxSelect: 2,
  defaultOptionIds: [],
  options: [
    {
      id: `${base}-side-fries`,
      name: 'French Fries',
      priceDelta: 39,
      available: true,
      assetKey: 'frenchFries',
    },
    {
      id: `${base}-side-cheesling-fries`,
      name: 'Cheesling Fries',
      priceDelta: 55,
      available: true,
      assetKey: 'cheeslingFries',
    },
    {
      id: `${base}-side-ddeok`,
      name: 'Ddeok-Bokki',
      priceDelta: 62,
      available: true,
      assetKey: 'ddeokBokki',
    },
    {
      id: `${base}-side-slaw`,
      name: 'Korean coleslaw',
      priceDelta: 28,
      available: true,
    },
  ],
});

const DRINK_GROUP = (base: string): OptionGroup => ({
  id: `${base}-drink`,
  name: 'Add a drink',
  kind: 'drink',
  minSelect: 0,
  maxSelect: 2,
  defaultOptionIds: [],
  options: [
    { id: `${base}-drink-coke`, name: 'Coca-Cola 330ml', priceDelta: 22, available: true },
    { id: `${base}-drink-coke-zero`, name: 'Coke Zero 330ml', priceDelta: 22, available: true },
    { id: `${base}-drink-sprite`, name: 'Sprite 330ml', priceDelta: 22, available: true },
    { id: `${base}-drink-water`, name: 'Still water 500ml', priceDelta: 18, available: true },
    { id: `${base}-drink-milkis`, name: 'Milkis soda', priceDelta: 32, available: true },
  ],
});

const HALF_FLAVOUR_GROUP: OptionGroup = {
  id: 'half-and-half-flavours',
  name: 'Pick your two flavours',
  kind: 'flavour',
  minSelect: 2,
  maxSelect: 2,
  defaultOptionIds: ['half-flavour-golden', 'half-flavour-honey'],
  options: [
    {
      id: 'half-flavour-golden',
      name: 'Golden Original',
      priceDelta: 0,
      available: true,
      assetKey: 'goldenOriginal',
    },
    {
      id: 'half-flavour-honey',
      name: 'Honey Garlic',
      priceDelta: 0,
      available: true,
      assetKey: 'honeyGarlic',
    },
    {
      id: 'half-flavour-soy',
      name: 'Soy Garlic',
      priceDelta: 0,
      available: true,
      assetKey: 'soyGarlic',
    },
    {
      id: 'half-flavour-secret',
      name: 'Secret Sauce',
      priceDelta: 10,
      available: true,
      assetKey: 'secretSauce',
    },
    {
      id: 'half-flavour-hot',
      name: 'Hot Spicy',
      priceDelta: 0,
      available: true,
      assetKey: 'hotSpicy',
    },
    {
      id: 'half-flavour-cheesling',
      name: 'Cheesling',
      priceDelta: 15,
      available: true,
      assetKey: 'cheesling',
    },
  ],
};

/**
 * The seven categories that have supplied products, in the brief's own order.
 *
 * §8 and §17 name nine. Drinks and Sauces & Extras are typed in `CategoryId`
 * but deliberately absent here, and the reason is photography rather than
 * naming: both already exist as add-ons — `DRINK_GROUP` and `SAUCE_GROUP`
 * below carry the items and their prices — but a *browsable* category needs
 * product cards, and a card needs a photograph. None was supplied for a drink
 * or a sauce; the cups in the campaign masters are dressing on a chicken shot,
 * not product artwork. `npm run assets:audit` fails the build for a catalogue
 * product with no artwork of its own, which is exactly the guard that should
 * stop someone promoting these to products before the shoot lands.
 *
 * Five of the seven hold a single product today. That is the supplied menu
 * being sixteen items, not the taxonomy being wrong — §17 asks for this
 * structure precisely so "the wider menu supplied elsewhere in the project"
 * has somewhere to land without a refactor.
 */
export const categories: Category[] = [
  {
    id: 'chicken',
    name: 'Chicken',
    tagline: 'Double-fried, hand-glazed, unmistakably bb.q',
    assetKey: 'goldenOriginal',
    sortOrder: 1,
  },
  {
    id: 'wings',
    name: 'Wings',
    tagline: 'All the crunch, none of the cutlery',
    assetKey: 'goldenOriginalWings',
    sortOrder: 2,
  },
  {
    id: 'boneless',
    name: 'Boneless',
    tagline: 'Bite-sized, built for sharing',
    assetKey: 'boneless',
    sortOrder: 3,
  },
  {
    id: 'meals',
    name: 'Meals',
    tagline: 'A full plate, sorted',
    assetKey: 'chickenRiceMeal',
    sortOrder: 4,
  },
  {
    id: 'burgers',
    name: 'Burgers',
    tagline: 'Our crust, between two buns',
    assetKey: 'chickenBurger',
    sortOrder: 5,
  },
  {
    id: 'rice-bowls',
    name: 'Rice Bowls',
    tagline: 'Korean comfort in one bowl',
    assetKey: 'koreanRiceBowl',
    sortOrder: 6,
  },
  {
    id: 'sides',
    name: 'Sides',
    tagline: 'The supporting cast that steals the show',
    assetKey: 'cheeslingFries',
    sortOrder: 7,
  },
  /**
   * Last in the row, which is deliberate rather than dismissive.
   *
   * Every existing `sortOrder` is untouched, so no category a customer has
   * learned the position of has moved. And a parent looking for the kids menu
   * scans for the word rather than the position, while somebody ordering for
   * themselves scrolls past it — which is the wrong way round if it sits
   * between Chicken and Wings.
   */
  {
    id: 'kids',
    name: 'Kids Menu',
    tagline: 'Little meals, made fresh',
    assetKey: 'littleCrunchChickenMeal',
    sortOrder: 8,
  },
];

export const products: Product[] = [
  {
    id: 'golden-original',
    slug: 'golden-original-chicken',
    name: 'Golden Original Chicken',
    shortDescription: 'The one that started it all — twice-fried, seasoned, shatteringly crisp.',
    description:
      'Our signature bird, marinated for 12 hours, hand-battered and twice-fried in 100% olive oil blend until the crust turns golden and audibly crisp. Seasoned simply so the chicken does the talking.',
    basePrice: 149,
    categoryId: 'chicken',
    assetKey: 'goldenOriginal',
    spiceLevel: 0,
    tags: ['bestseller', 'popular'],
    optionGroups: [
      SIZE_GROUP('golden-original', [0, 60, 115]),
      SAUCE_GROUP('golden-original'),
      SIDE_GROUP('golden-original'),
      DRINK_GROUP('golden-original'),
    ],
    recommendedProductIds: ['french-fries', 'cheesling-fries', 'honey-garlic'],
    available: true,
    preparationMinutes: 18,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2480, protein: 44, carbs: 32, fat: 34 },
  },
  {
    id: 'honey-garlic',
    slug: 'honey-garlic-chicken',
    name: 'Honey Garlic Chicken',
    shortDescription: 'Sticky honey, toasted garlic, a glaze that clings to every ridge.',
    description:
      'Golden Original finished in a warm honey and roasted garlic glaze, then showered with sesame and spring onion. Sweet up front, savoury on the finish, sticky the whole way through.',
    basePrice: 165,
    categoryId: 'chicken',
    assetKey: 'honeyGarlic',
    spiceLevel: 0,
    tags: ['bestseller', 'popular'],
    optionGroups: [
      SIZE_GROUP('honey-garlic', [0, 60, 115]),
      SAUCE_GROUP('honey-garlic'),
      SIDE_GROUP('honey-garlic'),
      DRINK_GROUP('honey-garlic'),
    ],
    recommendedProductIds: ['cheesling-fries', 'golden-original', 'ddeok-bokki'],
    available: true,
    preparationMinutes: 20,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy', 'Sesame'],
    nutrition: { kilojoules: 2720, protein: 43, carbs: 48, fat: 33 },
  },
  {
    id: 'soy-garlic',
    slug: 'soy-garlic-chicken',
    name: 'Soy Garlic Chicken',
    shortDescription: 'Deep soy lacquer, roasted garlic, sesame on top.',
    description:
      'The Korean fried chicken benchmark. Our crisp bird lacquered in a slow-reduced soy and garlic sauce until it turns glossy and dark, then finished with toasted sesame seeds.',
    basePrice: 165,
    categoryId: 'chicken',
    assetKey: 'soyGarlic',
    spiceLevel: 0,
    tags: ['bestseller'],
    optionGroups: [
      SIZE_GROUP('soy-garlic', [0, 60, 115]),
      SAUCE_GROUP('soy-garlic'),
      SIDE_GROUP('soy-garlic'),
      DRINK_GROUP('soy-garlic'),
    ],
    recommendedProductIds: ['french-fries', 'korean-rice-bowl', 'hot-spicy'],
    available: true,
    preparationMinutes: 20,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy', 'Sesame'],
    nutrition: { kilojoules: 2650, protein: 45, carbs: 41, fat: 32 },
  },
  {
    id: 'secret-sauce',
    slug: 'secret-sauce-chicken',
    name: 'Secret Sauce Chicken',
    shortDescription: 'Our house sauce. We are not telling you what is in it.',
    description:
      'A closely guarded bb.q recipe: layered, faintly smoky, a little sweet, with a slow warmth that builds. Ask the kitchen and they will smile and say nothing.',
    basePrice: 175,
    categoryId: 'chicken',
    assetKey: 'secretSauce',
    spiceLevel: 1,
    tags: ['new'],
    optionGroups: [
      SIZE_GROUP('secret-sauce', [0, 60, 115]),
      SAUCE_GROUP('secret-sauce'),
      SIDE_GROUP('secret-sauce'),
      DRINK_GROUP('secret-sauce'),
    ],
    recommendedProductIds: ['cheesling-fries', 'rose-ddeok-bokki', 'golden-original'],
    available: true,
    preparationMinutes: 20,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2700, protein: 44, carbs: 45, fat: 33 },
  },
  {
    id: 'hot-spicy',
    slug: 'hot-spicy-chicken',
    name: 'Hot Spicy Chicken',
    shortDescription: 'Gochujang heat with a sweet edge. Bring a drink.',
    description:
      'Fermented Korean chilli paste, chilli flakes and a touch of sugar reduced into a fierce red glaze. Properly hot, properly moreish, and finished with fresh spring onion.',
    basePrice: 169,
    categoryId: 'chicken',
    assetKey: 'hotSpicy',
    spiceLevel: 3,
    tags: ['spicy', 'popular'],
    optionGroups: [
      SIZE_GROUP('hot-spicy', [0, 60, 115]),
      SAUCE_GROUP('hot-spicy'),
      SIDE_GROUP('hot-spicy'),
      DRINK_GROUP('hot-spicy'),
    ],
    recommendedProductIds: ['french-fries', 'golden-original', 'korean-rice-bowl'],
    available: true,
    preparationMinutes: 20,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy', 'Sesame'],
    nutrition: { kilojoules: 2610, protein: 44, carbs: 39, fat: 32 },
  },
  {
    id: 'cheesling',
    slug: 'cheesling-chicken',
    name: 'Cheesling Chicken',
    shortDescription: 'Crisp chicken under a snowfall of savoury cheese powder.',
    description:
      'Golden Original tossed while still hot in our signature cheese seasoning so it melts into the crust. Salty, umami-heavy and dangerously easy to keep eating.',
    basePrice: 175,
    categoryId: 'chicken',
    assetKey: 'cheesling',
    spiceLevel: 0,
    tags: ['popular'],
    optionGroups: [
      SIZE_GROUP('cheesling', [0, 60, 115]),
      SAUCE_GROUP('cheesling'),
      SIDE_GROUP('cheesling'),
      DRINK_GROUP('cheesling'),
    ],
    recommendedProductIds: ['cheesling-fries', 'hot-spicy', 'french-fries'],
    available: true,
    preparationMinutes: 18,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy', 'Milk'],
    nutrition: { kilojoules: 2760, protein: 46, carbs: 36, fat: 37 },
  },
  {
    id: 'golden-original-wings',
    slug: 'golden-original-wings',
    name: 'Golden Original Wings',
    shortDescription: 'All wings, all crunch, no compromises.',
    description:
      'Nothing but wings and drumettes, brined and twice-fried to the same golden standard as our whole-bird original. The pick for anyone who only ever wants the good bits.',
    basePrice: 155,
    categoryId: 'wings',
    assetKey: 'goldenOriginalWings',
    spiceLevel: 0,
    tags: ['sharing'],
    optionGroups: [
      WINGS_SIZE_GROUP('wings'),
      SAUCE_GROUP('wings'),
      SIDE_GROUP('wings'),
      DRINK_GROUP('wings'),
    ],
    recommendedProductIds: ['french-fries', 'hot-spicy', 'cheesling-fries'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2280, protein: 42, carbs: 28, fat: 31 },
  },
  /**
   * ── Sauced wings ──────────────────────────────────────────────────────────
   *
   * Wings held one product and a size picker, with no sauce axis at all, so
   * there was no way to order a glazed wing however far you drilled in. These
   * three follow the Chicken category's convention rather than Boneless's:
   * flavour as its own product, because that is how a customer looks for
   * "honey garlic wings" and how search has to find them.
   *
   * They carry the same size group as Golden Original Wings so a 6/10/16 means
   * the same thing across the category, and the same +R10 over plain that the
   * glazed birds carry over Golden Original.
   */
  {
    id: 'honey-garlic-wings',
    slug: 'honey-garlic-wings',
    name: 'Honey Garlic Wings',
    shortDescription: 'Crispy wings under a sweet, sticky honey garlic glaze.',
    description:
      'Crispy chicken wings coated in a rich, sweet and savoury honey garlic glaze, hand-tossed so every wing carries the sauce rather than sitting in it. Finished with sesame and spring onion.',
    basePrice: 165,
    categoryId: 'wings',
    assetKey: 'honeyGarlicWings',
    spiceLevel: 0,
    tags: ['new', 'popular'],
    optionGroups: [
      WINGS_SIZE_GROUP('honey-garlic-wings'),
      SAUCE_GROUP('honey-garlic-wings'),
      SIDE_GROUP('honey-garlic-wings'),
      DRINK_GROUP('honey-garlic-wings'),
    ],
    recommendedProductIds: ['french-fries', 'soy-garlic-wings', 'cheesling-fries'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2410, protein: 41, carbs: 36, fat: 31 },
  },
  {
    id: 'soy-garlic-wings',
    slug: 'soy-garlic-wings',
    name: 'Soy Garlic Wings',
    shortDescription: 'Crispy wings in a deep, savoury soy garlic sauce.',
    description:
      'Crispy chicken wings tossed in a deeply savoury soy garlic sauce — the glaze that made bb.q famous, reduced until it turns glossy and clings. Garlic-forward, not sweet.',
    basePrice: 165,
    categoryId: 'wings',
    assetKey: 'soyGarlicWings',
    spiceLevel: 0,
    tags: ['new', 'bestseller'],
    optionGroups: [
      WINGS_SIZE_GROUP('soy-garlic-wings'),
      SAUCE_GROUP('soy-garlic-wings'),
      SIDE_GROUP('soy-garlic-wings'),
      DRINK_GROUP('soy-garlic-wings'),
    ],
    recommendedProductIds: ['french-fries', 'honey-garlic-wings', 'ddeok-bokki'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2360, protein: 42, carbs: 31, fat: 31 },
  },
  {
    id: 'hot-spicy-wings',
    slug: 'hot-spicy-wings',
    name: 'Hot Spicy Wings',
    shortDescription: 'Crispy wings in a bold, fiery, flavour-packed sauce.',
    description:
      'Crispy chicken wings coated in a bold, fiery and flavour-packed spicy sauce built on gochujang. Heat that carries flavour with it rather than burning it off.',
    basePrice: 165,
    categoryId: 'wings',
    assetKey: 'hotSpicyWings',
    spiceLevel: 3,
    tags: ['new', 'spicy'],
    optionGroups: [
      WINGS_SIZE_GROUP('hot-spicy-wings'),
      SAUCE_GROUP('hot-spicy-wings'),
      SIDE_GROUP('hot-spicy-wings'),
      DRINK_GROUP('hot-spicy-wings'),
    ],
    recommendedProductIds: ['french-fries', 'cheesling-fries', 'soy-garlic-wings'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2340, protein: 42, carbs: 30, fat: 31 },
  },
  {
    id: 'boneless',
    slug: 'boneless-chicken',
    name: 'Boneless Chicken',
    shortDescription: 'Bite-sized, boneless, built for sharing (or not).',
    description:
      'Tender thigh pieces, boneless and battered, fried until crisp and finished in the flavour of your choice. No bones, no ceremony, no slowing down.',
    basePrice: 169,
    categoryId: 'boneless',
    assetKey: 'boneless',
    spiceLevel: 0,
    tags: ['boneless', 'popular'],
    optionGroups: [
      {
        id: 'boneless-flavour',
        name: 'Choose your flavour',
        kind: 'flavour',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['boneless-flavour-golden'],
        options: [
          {
            id: 'boneless-flavour-golden',
            name: 'Golden Original',
            priceDelta: 0,
            available: true,
            assetKey: 'goldenOriginal',
          },
          {
            id: 'boneless-flavour-honey',
            name: 'Honey Garlic',
            priceDelta: 16,
            available: true,
            assetKey: 'honeyGarlic',
          },
          {
            id: 'boneless-flavour-soy',
            name: 'Soy Garlic',
            priceDelta: 16,
            available: true,
            assetKey: 'soyGarlic',
          },
          {
            id: 'boneless-flavour-hot',
            name: 'Hot Spicy',
            priceDelta: 20,
            available: true,
            assetKey: 'hotSpicy',
          },
          {
            id: 'boneless-flavour-cheesling',
            name: 'Cheesling',
            priceDelta: 26,
            available: true,
            assetKey: 'cheesling',
          },
        ],
      },
      SIZE_GROUP('boneless', [0, 55, 105]),
      SIDE_GROUP('boneless'),
      DRINK_GROUP('boneless'),
    ],
    recommendedProductIds: ['french-fries', 'ddeok-bokki', 'korean-rice-bowl'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2400, protein: 47, carbs: 34, fat: 29 },
  },
  /**
   * The one flavour Boneless Chicken's picker does not offer.
   *
   * Boneless models flavour as an option group — Golden Original, Honey
   * Garlic, Soy Garlic, Hot Spicy, Cheesling — and Secret Sauce is not in it,
   * so this was not orderable by any route. It is a product rather than a
   * sixth option because the supplied brief names it as one and because Secret
   * Sauce already stands alone in the Chicken category; a customer searching
   * "secret sauce" should find both.
   */
  {
    id: 'secret-sauce-boneless',
    slug: 'secret-sauce-boneless',
    name: 'Secret Sauce Boneless',
    shortDescription: "Boneless bites in the sauce we won't talk about.",
    description:
      "Tender boneless chicken coated in bb.q Chicken's rich and flavourful signature sauce. What is in it stays in it — sweet, savoury, faintly smoky, and the reason people order it twice.",
    basePrice: 185,
    categoryId: 'boneless',
    assetKey: 'secretSauceBoneless',
    spiceLevel: 1,
    tags: ['new', 'boneless'],
    optionGroups: [
      SIZE_GROUP('secret-sauce-boneless', [0, 55, 105]),
      SAUCE_GROUP('secret-sauce-boneless'),
      SIDE_GROUP('secret-sauce-boneless'),
      DRINK_GROUP('secret-sauce-boneless'),
    ],
    recommendedProductIds: ['french-fries', 'cheesling-fries', 'secret-sauce'],
    available: true,
    preparationMinutes: 16,
    serves: 'Serves 2 – 3',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2520, protein: 46, carbs: 41, fat: 30 },
  },
  {
    id: 'half-and-half',
    slug: 'half-and-half-chicken',
    name: 'Half & Half Chicken',
    shortDescription: "Can't choose? Don't. Two flavours, one box.",
    description:
      'Half of one signature flavour, half of another, in a single box. The diplomatic solution to every table argument about what to order.',
    basePrice: 189,
    categoryId: 'chicken',
    assetKey: 'halfAndHalf',
    spiceLevel: 1,
    tags: ['sharing', 'value'],
    optionGroups: [
      HALF_FLAVOUR_GROUP,
      SIZE_GROUP('half-and-half', [0, 60, 115]),
      SIDE_GROUP('half-and-half'),
      DRINK_GROUP('half-and-half'),
    ],
    recommendedProductIds: ['cheesling-fries', 'french-fries', 'rose-ddeok-bokki'],
    available: true,
    preparationMinutes: 22,
    serves: 'Serves 3 – 4',
    allergens: ['Gluten', 'Soy', 'Sesame'],
    nutrition: { kilojoules: 2690, protein: 45, carbs: 42, fat: 33 },
  },
  {
    id: 'chicken-rice-meal',
    slug: 'chicken-rice-meal',
    name: 'Chicken & Rice Meal',
    shortDescription: 'Chicken, steamed rice, pickles, sorted lunch.',
    description:
      'Two pieces of our signature chicken over steamed rice with house pickled radish and a side of slaw. The everyday plate that eats like a treat.',
    basePrice: 119,
    categoryId: 'meals',
    assetKey: 'chickenRiceMeal',
    spiceLevel: 0,
    tags: ['value', 'popular'],
    optionGroups: [
      {
        id: 'rice-meal-flavour',
        name: 'Chicken flavour',
        kind: 'flavour',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['rice-meal-flavour-golden'],
        options: [
          {
            id: 'rice-meal-flavour-golden',
            name: 'Golden Original',
            priceDelta: 0,
            available: true,
            assetKey: 'goldenOriginal',
          },
          {
            id: 'rice-meal-flavour-honey',
            name: 'Honey Garlic',
            priceDelta: 12,
            available: true,
            assetKey: 'honeyGarlic',
          },
          {
            id: 'rice-meal-flavour-soy',
            name: 'Soy Garlic',
            priceDelta: 12,
            available: true,
            assetKey: 'soyGarlic',
          },
          {
            id: 'rice-meal-flavour-hot',
            name: 'Hot Spicy',
            priceDelta: 14,
            available: true,
            assetKey: 'hotSpicy',
          },
        ],
      },
      DRINK_GROUP('rice-meal'),
    ],
    recommendedProductIds: ['french-fries', 'ddeok-bokki', 'golden-original'],
    available: true,
    preparationMinutes: 14,
    serves: 'Serves 1',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 3120, protein: 38, carbs: 96, fat: 22 },
  },
  {
    id: 'wings-rice-meal',
    slug: 'wings-rice-meal',
    name: 'Wings Rice Meal',
    shortDescription: 'Wings, rice, kimchi, radish, slaw. One tray.',
    description:
      'Flavourful chicken wings served with steamed rice and Korean-inspired sides — kimchi, pickled radish and slaw, laid out in one tray. A full lunch that eats like a treat.',
    basePrice: 135,
    categoryId: 'meals',
    assetKey: 'wingsRiceMeal',
    spiceLevel: 2,
    tags: ['new', 'value'],
    optionGroups: [
      {
        id: 'wings-meal-flavour',
        name: 'Wing flavour',
        kind: 'flavour',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['wings-meal-flavour-hot'],
        options: [
          {
            id: 'wings-meal-flavour-hot',
            name: 'Hot Spicy',
            priceDelta: 0,
            available: true,
            assetKey: 'hotSpicyWings',
          },
          {
            id: 'wings-meal-flavour-honey',
            name: 'Honey Garlic',
            priceDelta: 0,
            available: true,
            assetKey: 'honeyGarlicWings',
          },
          {
            id: 'wings-meal-flavour-soy',
            name: 'Soy Garlic',
            priceDelta: 0,
            available: true,
            assetKey: 'soyGarlicWings',
          },
        ],
      },
      DRINK_GROUP('wings-meal'),
    ],
    recommendedProductIds: ['ddeok-bokki', 'sweet-potato-fries', 'hot-spicy-wings'],
    available: true,
    preparationMinutes: 15,
    serves: 'Serves 1',
    allergens: ['Gluten', 'Soy', 'Fish'],
    nutrition: { kilojoules: 3340, protein: 41, carbs: 102, fat: 24 },
  },
  {
    id: 'chicken-burger',
    slug: 'chicken-burger',
    name: 'Chicken Burger',
    shortDescription: 'Whole crispy fillet, slaw, brioche, done properly.',
    description:
      'A whole crispy chicken thigh fillet in a toasted brioche bun with Korean slaw, pickles and our signature sauce. Built to be eaten with two hands.',
    basePrice: 109,
    categoryId: 'burgers',
    assetKey: 'chickenBurger',
    spiceLevel: 1,
    tags: ['popular'],
    optionGroups: [
      {
        id: 'burger-heat',
        name: 'Heat level',
        kind: 'flavour',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['burger-heat-classic'],
        options: [
          { id: 'burger-heat-classic', name: 'Classic', priceDelta: 0, available: true },
          { id: 'burger-heat-spicy', name: 'Hot Spicy', priceDelta: 8, available: true },
          { id: 'burger-heat-honey', name: 'Honey Garlic', priceDelta: 8, available: true },
        ],
      },
      {
        id: 'burger-extras',
        name: 'Make it more',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 4,
        defaultOptionIds: [],
        options: [
          {
            id: 'burger-extra-cheese',
            name: 'Extra cheese slice',
            priceDelta: 14,
            available: true,
          },
          { id: 'burger-extra-patty', name: 'Double the fillet', priceDelta: 45, available: true },
          { id: 'burger-extra-bacon', name: 'Crispy bacon', priceDelta: 26, available: true },
          {
            id: 'burger-extra-jalapeno',
            name: 'Pickled jalapeño',
            priceDelta: 12,
            available: true,
          },
        ],
      },
      SIDE_GROUP('burger'),
      DRINK_GROUP('burger'),
    ],
    recommendedProductIds: ['french-fries', 'cheesling-fries', 'hot-spicy'],
    available: true,
    preparationMinutes: 12,
    serves: 'Serves 1',
    allergens: ['Gluten', 'Soy', 'Milk', 'Egg'],
    nutrition: { kilojoules: 2890, protein: 36, carbs: 62, fat: 34 },
  },
  /**
   * Cheesling is not in Chicken Burger's heat picker — that offers Classic,
   * Hot Spicy and Honey Garlic — so this adds a flavour to the category rather
   * than a second way to order one already there.
   */
  {
    id: 'cheesling-burger',
    slug: 'cheesling-burger',
    name: 'Cheesling Burger',
    shortDescription: 'Crispy fillet dusted in cheesling, stacked and sauced.',
    description:
      'Crispy chicken burger with creamy cheesling flavour, fresh vegetables and a soft toasted bun. The same cheese seasoning that made Cheesling Chicken famous, dusted over a whole fillet.',
    basePrice: 125,
    categoryId: 'burgers',
    assetKey: 'cheeslingBurger',
    spiceLevel: 1,
    tags: ['new', 'popular'],
    optionGroups: [
      {
        id: 'cheesling-burger-extras',
        name: 'Make it more',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 4,
        defaultOptionIds: [],
        options: [
          {
            id: 'cheesling-burger-extra-cheese',
            name: 'Extra cheese slice',
            priceDelta: 14,
            available: true,
          },
          {
            id: 'cheesling-burger-extra-dust',
            name: 'Double cheesling dust',
            priceDelta: 16,
            available: true,
          },
          {
            id: 'cheesling-burger-extra-patty',
            name: 'Double the fillet',
            priceDelta: 45,
            available: true,
          },
          {
            id: 'cheesling-burger-extra-jalapeno',
            name: 'Pickled jalapeño',
            priceDelta: 12,
            available: true,
          },
        ],
      },
      SIDE_GROUP('cheesling-burger'),
      DRINK_GROUP('cheesling-burger'),
    ],
    recommendedProductIds: ['sweet-potato-fries', 'cheesling-fries', 'cheesling'],
    available: true,
    preparationMinutes: 12,
    serves: 'Serves 1',
    allergens: ['Gluten', 'Soy', 'Milk', 'Egg'],
    nutrition: { kilojoules: 3040, protein: 37, carbs: 64, fat: 38 },
  },
  {
    id: 'korean-rice-bowl',
    slug: 'korean-rice-bowl',
    name: 'Korean Rice Bowl',
    shortDescription: 'Rice, glazed chicken, vegetables, egg on top.',
    description:
      'Steamed rice topped with glazed boneless chicken, seasoned vegetables, kimchi and a fried egg. Everything in one bowl, exactly as it should be.',
    basePrice: 129,
    categoryId: 'rice-bowls',
    assetKey: 'koreanRiceBowl',
    spiceLevel: 2,
    tags: ['new'],
    optionGroups: [
      {
        id: 'bowl-glaze',
        name: 'Glaze',
        kind: 'flavour',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['bowl-glaze-soy'],
        options: [
          {
            id: 'bowl-glaze-soy',
            name: 'Soy Garlic',
            priceDelta: 0,
            available: true,
            assetKey: 'soyGarlic',
          },
          {
            id: 'bowl-glaze-hot',
            name: 'Hot Spicy',
            priceDelta: 0,
            available: true,
            assetKey: 'hotSpicy',
          },
          {
            id: 'bowl-glaze-honey',
            name: 'Honey Garlic',
            priceDelta: 0,
            available: true,
            assetKey: 'honeyGarlic',
          },
        ],
      },
      {
        id: 'bowl-extras',
        name: 'Add to your bowl',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 3,
        defaultOptionIds: [],
        options: [
          { id: 'bowl-extra-egg', name: 'Extra fried egg', priceDelta: 15, available: true },
          { id: 'bowl-extra-kimchi', name: 'Extra kimchi', priceDelta: 18, available: true },
          { id: 'bowl-extra-chicken', name: 'Extra chicken', priceDelta: 42, available: true },
        ],
      },
      DRINK_GROUP('bowl'),
    ],
    recommendedProductIds: ['ddeok-bokki', 'soy-garlic', 'french-fries'],
    available: true,
    preparationMinutes: 14,
    serves: 'Serves 1',
    allergens: ['Gluten', 'Soy', 'Egg', 'Sesame'],
    nutrition: { kilojoules: 3040, protein: 39, carbs: 91, fat: 24 },
  },
  {
    id: 'french-fries',
    slug: 'french-fries',
    name: 'French Fries',
    shortDescription: 'Crisp outside, fluffy inside, salted while hot.',
    description:
      'Thick-cut fries fried to order and salted the moment they leave the oil. The default side, and there is a reason for that.',
    basePrice: 45,
    categoryId: 'sides',
    assetKey: 'frenchFries',
    spiceLevel: 0,
    tags: ['popular'],
    optionGroups: [
      {
        id: 'fries-size',
        name: 'Size',
        kind: 'size',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['fries-size-regular'],
        options: [
          { id: 'fries-size-regular', name: 'Regular', priceDelta: 0, available: true },
          { id: 'fries-size-large', name: 'Large', priceDelta: 22, available: true },
          // Sold out, and the only unavailable option in the catalogue.
          //
          // `OptionGroupPicker` has drawn a disabled option since it was
          // written — greyed label, a "Sold out" caption in §8 warning — and
          // every one of the 78 seeded options was available, so it had never
          // once rendered. The same fixture exercises `defaultSelection`,
          // which must skip a withdrawn option rather than preselect it, and
          // `reconcileCart`, which drops a saved line whose configuration can
          // no longer be made.
          { id: 'fries-size-sharing', name: 'Sharing bucket', priceDelta: 48, available: false },
        ],
      },
      {
        id: 'fries-seasoning',
        name: 'Seasoning',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 2,
        defaultOptionIds: [],
        options: [
          { id: 'fries-seasoning-cheese', name: 'Cheese dust', priceDelta: 14, available: true },
          { id: 'fries-seasoning-spicy', name: 'Hot Spicy dust', priceDelta: 14, available: true },
          { id: 'fries-seasoning-garlic', name: 'Garlic butter', priceDelta: 16, available: true },
        ],
      },
    ],
    recommendedProductIds: ['golden-original', 'chicken-burger', 'cheesling-fries'],
    available: true,
    preparationMinutes: 8,
    serves: 'Serves 1 – 2',
    allergens: ['Gluten'],
    nutrition: { kilojoules: 1520, protein: 5, carbs: 48, fat: 17 },
  },
  {
    id: 'cheesling-fries',
    slug: 'cheesling-fries',
    name: 'Cheesling Fries',
    shortDescription: 'Our fries, buried in signature cheese seasoning.',
    description:
      'Hot fries tossed in the same cheese seasoning that made Cheesling Chicken famous, then finished with spring onion. Order a large. You will want a large.',
    basePrice: 62,
    categoryId: 'sides',
    assetKey: 'cheeslingFries',
    spiceLevel: 0,
    tags: ['bestseller'],
    optionGroups: [
      {
        id: 'cheesling-fries-size',
        name: 'Size',
        kind: 'size',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['cheesling-fries-size-regular'],
        options: [
          { id: 'cheesling-fries-size-regular', name: 'Regular', priceDelta: 0, available: true },
          { id: 'cheesling-fries-size-large', name: 'Large', priceDelta: 24, available: true },
        ],
      },
    ],
    recommendedProductIds: ['cheesling', 'honey-garlic', 'golden-original'],
    available: true,
    preparationMinutes: 9,
    serves: 'Serves 1 – 2',
    allergens: ['Gluten', 'Milk'],
    nutrition: { kilojoules: 1840, protein: 9, carbs: 50, fat: 23 },
  },
  {
    id: 'sweet-potato-fries',
    slug: 'sweet-potato-fries',
    name: 'Sweet Potato Fries',
    shortDescription: 'Golden, crisp and naturally sweet.',
    description:
      'Crispy, golden sweet potato fries with a naturally sweet and satisfying flavour, salted while hot. Sweeter and softer inside than the thick-cut, and the better match for anything spicy.',
    basePrice: 52,
    categoryId: 'sides',
    assetKey: 'sweetPotatoFries',
    spiceLevel: 0,
    tags: ['new'],
    optionGroups: [
      {
        id: 'sweet-potato-fries-size',
        name: 'Size',
        kind: 'size',
        minSelect: 1,
        maxSelect: 1,
        defaultOptionIds: ['sweet-potato-fries-size-regular'],
        options: [
          {
            id: 'sweet-potato-fries-size-regular',
            name: 'Regular',
            priceDelta: 0,
            available: true,
          },
          { id: 'sweet-potato-fries-size-large', name: 'Large', priceDelta: 24, available: true },
        ],
      },
      {
        id: 'sweet-potato-fries-dip',
        name: 'Add a dip',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 2,
        defaultOptionIds: [],
        options: [
          {
            id: 'sweet-potato-fries-dip-spicy-mayo',
            name: 'Spicy mayo',
            priceDelta: 16,
            available: true,
          },
          {
            id: 'sweet-potato-fries-dip-honey',
            name: 'Honey Garlic dip',
            priceDelta: 18,
            available: true,
          },
        ],
      },
    ],
    recommendedProductIds: ['cheesling-burger', 'hot-spicy-wings', 'golden-original'],
    available: true,
    preparationMinutes: 9,
    serves: 'Serves 1 – 2',
    allergens: [],
    nutrition: { kilojoules: 1610, protein: 4, carbs: 55, fat: 16 },
  },
  {
    id: 'ddeok-bokki',
    slug: 'ddeok-bokki',
    name: 'Ddeok-Bokki',
    shortDescription: 'Chewy rice cakes in a sweet-hot gochujang sauce.',
    description:
      'Cylindrical Korean rice cakes simmered in gochujang until the sauce thickens and clings. Chewy, sweet, properly spicy — the Seoul street-food classic.',
    basePrice: 72,
    categoryId: 'sides',
    assetKey: 'ddeokBokki',
    spiceLevel: 3,
    tags: ['spicy'],
    optionGroups: [
      {
        id: 'ddeok-extras',
        name: 'Add to it',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 3,
        defaultOptionIds: [],
        options: [
          { id: 'ddeok-extra-egg', name: 'Boiled egg', priceDelta: 12, available: true },
          { id: 'ddeok-extra-fishcake', name: 'Extra fish cake', priceDelta: 20, available: true },
          { id: 'ddeok-extra-cheese', name: 'Melted cheese', priceDelta: 22, available: true },
        ],
      },
    ],
    recommendedProductIds: ['golden-original', 'korean-rice-bowl', 'rose-ddeok-bokki'],
    available: true,
    preparationMinutes: 12,
    serves: 'Serves 1 – 2',
    allergens: ['Gluten', 'Soy', 'Fish'],
    nutrition: { kilojoules: 1690, protein: 11, carbs: 71, fat: 9 },
  },
  {
    id: 'rose-ddeok-bokki',
    slug: 'rose-ddeok-bokki',
    name: 'Rose Ddeok-Bokki',
    shortDescription: 'Ddeok-bokki gone creamy. Rich, blush-pink, milder heat.',
    description:
      'The same chewy rice cakes in a rosé sauce — gochujang softened with cream until it turns blush pink. Rounder, richer and a gentler heat than the original.',
    basePrice: 82,
    categoryId: 'sides',
    assetKey: 'roseDdeokBokki',
    spiceLevel: 2,
    tags: ['new', 'popular'],
    optionGroups: [
      {
        id: 'rose-extras',
        name: 'Add to it',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 3,
        defaultOptionIds: [],
        options: [
          { id: 'rose-extra-egg', name: 'Boiled egg', priceDelta: 12, available: true },
          { id: 'rose-extra-cheese', name: 'Extra melted cheese', priceDelta: 22, available: true },
          { id: 'rose-extra-bacon', name: 'Crispy bacon', priceDelta: 28, available: true },
        ],
      },
    ],
    recommendedProductIds: ['cheesling', 'secret-sauce', 'ddeok-bokki'],
    available: true,
    preparationMinutes: 13,
    serves: 'Serves 1 – 2',
    allergens: ['Gluten', 'Soy', 'Milk', 'Fish'],
    nutrition: { kilojoules: 1980, protein: 13, carbs: 68, fat: 18 },
  },
  /**
   * The third ddeok-bokki, and the one case where the brief's "add it as a
   * product" and the app's own convention already agreed: Ddeok-Bokki and Rose
   * Ddeok-Bokki are separate products rather than a sauce option, so Cheese
   * joins them the same way. Sides, not Rice Bowls, so all three sit together.
   */
  {
    id: 'cheese-ddeok-bokki',
    slug: 'cheese-ddeok-bokki',
    name: 'Cheese Ddeok-Bokki',
    shortDescription: 'Rice cakes under a lid of melted mozzarella.',
    description:
      'Korean rice cakes in a rich spicy sauce topped with melted cheese, grilled until it blisters and pulls. The gochujang stays hot underneath; the cheese is what makes it bearable.',
    basePrice: 88,
    categoryId: 'sides',
    assetKey: 'cheeseDdeokBokki',
    spiceLevel: 2,
    tags: ['new', 'spicy'],
    optionGroups: [
      {
        id: 'cheese-ddeok-extras',
        name: 'Add to it',
        kind: 'addon',
        minSelect: 0,
        maxSelect: 3,
        defaultOptionIds: [],
        options: [
          { id: 'cheese-ddeok-extra-egg', name: 'Boiled egg', priceDelta: 12, available: true },
          {
            id: 'cheese-ddeok-extra-cheese',
            name: 'Even more cheese',
            priceDelta: 22,
            available: true,
          },
          {
            id: 'cheese-ddeok-extra-fishcake',
            name: 'Extra fish cake',
            priceDelta: 20,
            available: true,
          },
        ],
      },
    ],
    recommendedProductIds: ['soy-garlic-wings', 'golden-original', 'rose-ddeok-bokki'],
    available: true,
    preparationMinutes: 14,
    serves: 'Serves 1 – 2',
    allergens: ['Gluten', 'Soy', 'Milk', 'Fish'],
    nutrition: { kilojoules: 2140, protein: 18, carbs: 72, fat: 21 },
  },

  /**
   * ── Kids Menu ─────────────────────────────────────────────────────────────
   *
   * Four complete meals rather than four small portions: each is the food, a
   * side and a drink in one box, which is what the packaging says and what a
   * parent is buying. So the drink and the dip are `minSelect: 1` groups at
   * zero — included, and chosen — rather than the priced add-ons the grown-up
   * boxes carry.
   *
   * `serves` says "Serves 1 child" rather than the usual "Serves 1". The
   * portion is the whole point of the range, and a parent scanning the card
   * has no other way to tell this apart from an adult meal at two-thirds the
   * price.
   */
  {
    id: 'little-crunch-chicken-meal',
    slug: 'little-crunch-chicken-meal',
    name: 'Little Crunch Chicken Meal',
    shortDescription: 'Crispy chicken, golden fries, a dip and a cool drink.',
    description:
      'A kid-friendly serving of crispy, golden fried chicken pieces served as a complete meal with golden fries, a dipping sauce and a cool drink. Small hands, same crunch.',
    basePrice: 69,
    categoryId: 'kids',
    assetKey: 'littleCrunchChickenMeal',
    spiceLevel: 0,
    tags: ['new', 'value'],
    optionGroups: [KIDS_DIP_GROUP('little-crunch'), KIDS_DRINK_GROUP('little-crunch')],
    recommendedProductIds: ['little-chicken-strips-meal', 'french-fries', 'golden-original'],
    available: true,
    preparationMinutes: 12,
    serves: 'Serves 1 child',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 1980, protein: 22, carbs: 68, fat: 21 },
  },
  {
    id: 'little-chicken-strips-meal',
    slug: 'little-chicken-strips-meal',
    name: 'Little Chicken Strips Meal',
    shortDescription: 'Boneless strips, golden fries, a dip and a cool drink.',
    description:
      'Tender, crispy boneless chicken strips served as a complete kids meal with golden fries, a dipping sauce and a cool drink. No bones to work around.',
    basePrice: 69,
    categoryId: 'kids',
    assetKey: 'littleChickenStripsMeal',
    spiceLevel: 0,
    tags: ['new', 'boneless'],
    optionGroups: [KIDS_DIP_GROUP('little-strips'), KIDS_DRINK_GROUP('little-strips')],
    recommendedProductIds: ['little-crunch-chicken-meal', 'french-fries', 'boneless'],
    available: true,
    preparationMinutes: 12,
    serves: 'Serves 1 child',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 1920, protein: 24, carbs: 65, fat: 19 },
  },
  {
    id: 'little-cheesling-burger-meal',
    slug: 'little-cheesling-burger-meal',
    name: 'Little Cheesling Burger Meal',
    shortDescription: 'A small Cheesling burger, golden fries and a cool drink.',
    description:
      'A smaller, kid-sized Cheesling Burger served as a complete meal with golden fries and a cool drink. The same cheese seasoning, built to fit smaller hands.',
    basePrice: 75,
    categoryId: 'kids',
    assetKey: 'littleCheeslingBurgerMeal',
    spiceLevel: 0,
    tags: ['new'],
    optionGroups: [KIDS_DRINK_GROUP('little-cheesling')],
    recommendedProductIds: ['little-crunch-chicken-meal', 'cheesling-burger', 'sweet-potato-fries'],
    available: true,
    preparationMinutes: 11,
    serves: 'Serves 1 child',
    allergens: ['Gluten', 'Soy', 'Milk', 'Egg'],
    nutrition: { kilojoules: 2180, protein: 23, carbs: 71, fat: 25 },
  },
  {
    id: 'little-k-rice-chicken-meal',
    slug: 'little-k-rice-chicken-meal',
    name: 'Little K-Rice Chicken Meal',
    shortDescription: 'Korean chicken, steamed rice, a Korean side and a drink.',
    description:
      'A kid-friendly Korean-style chicken and rice meal — glazed crispy chicken with steamed rice, a small Korean side and a cool drink, in a portion sized for children.',
    basePrice: 79,
    categoryId: 'kids',
    assetKey: 'littleKRiceChickenMeal',
    spiceLevel: 1,
    tags: ['new'],
    optionGroups: [KIDS_DRINK_GROUP('little-k-rice')],
    recommendedProductIds: ['little-crunch-chicken-meal', 'korean-rice-bowl', 'wings-rice-meal'],
    available: true,
    preparationMinutes: 13,
    serves: 'Serves 1 child',
    allergens: ['Gluten', 'Soy'],
    nutrition: { kilojoules: 2060, protein: 25, carbs: 78, fat: 18 },
  },
];

export const menuSnapshot: MenuSnapshot = {
  categories,
  products,
  updatedAt: new Date('2026-01-01T08:00:00Z').toISOString(),
};
