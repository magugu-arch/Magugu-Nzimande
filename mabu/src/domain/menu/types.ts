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
}

/** §9, in the brief's order. */
export const MENU_CATEGORIES: MenuCategory[] = [
  { id: 'starters', label: 'Starters', section: 'food', order: 1 },
  { id: 'salads', label: 'Salads', section: 'food', order: 2 },
  { id: 'vegetarian', label: 'Vegetarian', section: 'food', order: 3 },
  { id: 'signature-cuts', label: 'Signature Cuts', section: 'food', order: 4 },
  { id: 'classic-steaks', label: 'Classic Steaks', section: 'food', order: 5 },
  { id: 'poultry-game', label: 'Poultry & Game', section: 'food', order: 6 },
  { id: 'fish', label: 'Fish', section: 'food', order: 7 },
  { id: 'pasta', label: 'Pasta', section: 'food', order: 8 },
  { id: 'slow-cooked', label: 'Slow Cooked', section: 'food', order: 9 },
  { id: 'sides', label: 'Sides', section: 'food', order: 10 },
  { id: 'sauces', label: 'Sauces', section: 'food', order: 11 },
  { id: 'desserts', label: 'Desserts', section: 'dessert', order: 12 },
  { id: 'wine', label: 'Wine', section: 'wine', order: 13 },
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
