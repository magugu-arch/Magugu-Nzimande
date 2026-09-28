/** Menu & discovery content model — brief §8 and §9. All of it is CMS data. */
import type { DietaryTag } from '../guests/types';

export type MenuCategoryId =
  | 'starters'
  | 'salads'
  | 'vegetarian'
  | 'signature-cuts'
  | 'classic-steaks'
  | 'poultry-game'
  | 'fish'
  | 'pasta'
  | 'slow-cooked'
  | 'sides'
  | 'sauces'
  | 'desserts'
  | 'wine';

export interface MenuCategory {
  id: MenuCategoryId;
  label: string;
  section: 'food' | 'dessert' | 'wine';
  order: number;
  /** Tracked capitals under the category title on the menu screen. */
  tagline: string;
  /** Photo registry key for the category hero. */
  heroPhoto: string;
}

/** §9, in the brief's order. */
export const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'starters',
    label: 'Starters',
    section: 'food',
    order: 1,
    tagline: 'Small plates, big impressions',
    heroPhoto: 'hero-starters',
  },
  {
    id: 'salads',
    label: 'Salads',
    section: 'food',
    order: 2,
    tagline: 'Fresh, bright and seasonal',
    heroPhoto: 'menu-burrata',
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    section: 'food',
    order: 3,
    tagline: 'Fresh ingredients, bold flavours',
    heroPhoto: 'hero-vegetarian',
  },
  {
    id: 'signature-cuts',
    label: 'Signature Cuts',
    section: 'food',
    order: 4,
    tagline: 'Exceptional meats, unforgettable flavours',
    heroPhoto: 'hero-signature',
  },
  {
    id: 'classic-steaks',
    label: 'Classic Steaks',
    section: 'food',
    order: 5,
    tagline: 'Aged, seasoned, over the flame',
    heroPhoto: 'dish-signature-mains',
  },
  {
    id: 'poultry-game',
    label: 'Poultry & Game',
    section: 'food',
    order: 6,
    tagline: 'From the Karoo and beyond',
    heroPhoto: 'signature-steak',
  },
  {
    id: 'fish',
    label: 'Fish & Seafood',
    section: 'food',
    order: 7,
    tagline: 'From the ocean, refined',
    heroPhoto: 'hero-seafood',
  },
  {
    id: 'pasta',
    label: 'Pasta',
    section: 'food',
    order: 8,
    tagline: 'Hand-rolled, generously dressed',
    heroPhoto: 'seafood-linguine',
  },
  {
    id: 'slow-cooked',
    label: 'Slow Cooked',
    section: 'food',
    order: 9,
    tagline: 'Patience, heritage and depth',
    heroPhoto: 'chef-plating',
  },
  {
    id: 'sides',
    label: 'Sides',
    section: 'food',
    order: 10,
    tagline: 'To share around the table',
    heroPhoto: 'menu-roast-vegetables',
  },
  {
    id: 'sauces',
    label: 'Sauces',
    section: 'food',
    order: 11,
    tagline: 'The finishing touch',
    heroPhoto: 'fillet-closeup',
  },
  {
    id: 'desserts',
    label: 'Desserts',
    section: 'dessert',
    order: 12,
    tagline: 'A sweet taste of the extraordinary',
    heroPhoto: 'chocolate-fondant',
  },
  {
    id: 'wine',
    label: 'Wine',
    section: 'wine',
    order: 13,
    tagline: 'Curated selection, perfect pairings',
    heroPhoto: 'dish-wines',
  },
];

export interface ModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
}

/** §8 Modifier: id, name, price delta, required/optional, max selections. */
export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  options: ModifierOption[];
}

/** §8 Dish. */
export interface Dish {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: 'ZAR';
  category: Exclude<MenuCategoryId, 'wine'>;
  photo?: string;
  gallery?: string[];
  available: boolean;
  seasonal?: { start: string; end: string };
  allergens: string[];
  /**
   * Only claims Mábu has verified (§10). An empty list means "not verified",
   * never "contains everything" — the UI says so.
   */
  dietaryTags: DietaryTag[];
  spiceLevel: 0 | 1 | 2 | 3;
  provenance?: string;
  preparation?: string;
  signature?: boolean;
  chefSelected?: boolean;
  /** Three or four key ingredients, shown in tracked capitals: CHILLI | GARLIC | LEMON BUTTER. */
  highlights?: string[];
  pairingIds?: string[];
  modifiers?: ModifierGroup[];
  isSample: boolean;
  updatedAt: string;
}

export type WineStyle = 'sparkling' | 'white' | 'rose' | 'red' | 'dessert-fortified';

/** §8 Wine. */
export interface WineItem {
  id: string;
  name: string;
  producer: string;
  vintage?: number;
  region: string;
  varietal: string;
  style: WineStyle;
  glassPriceCents?: number;
  bottlePriceCents: number;
  tastingNotes: string;
  pairingTags: string[];
  available: boolean;
  isSample: boolean;
  updatedAt: string;
}

/** §8 Collection. */
export interface MenuCollection {
  id: string;
  name: string;
  description: string;
  photo: string;
  itemIds: string[];
  seasonalStart?: string;
  seasonalEnd?: string;
}

export const WINE_STYLE_LABEL: Record<WineStyle, string> = {
  sparkling: 'Méthode Cap Classique & Sparkling',
  white: 'White',
  rose: 'Rosé',
  red: 'Red',
  'dessert-fortified': 'Dessert & Fortified',
};
