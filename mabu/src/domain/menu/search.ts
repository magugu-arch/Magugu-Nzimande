import type { DietaryTag } from '../guests/types';
import type { Dish, WineItem } from './types';

/** Case- and accent-insensitive: "mabu" finds "Mábu", "creme" finds "crème". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface DishFilter {
  query?: string;
  category?: Dish['category'];
  dietary?: DietaryTag[];
  signatureOnly?: boolean;
  hideUnavailable?: boolean;
}

/**
 * §10: search by dish name or ingredient. Ingredients live in the
 * description, provenance and preparation copy, so all three are searched.
 * Dietary filters match only verified tags — a dish without the tag is
 * excluded, never assumed safe.
 */
export function filterDishes(dishes: Dish[], f: DishFilter): Dish[] {
  const terms = fold(f.query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  return dishes.filter((d) => {
    if (f.category && d.category !== f.category) return false;
    if (f.signatureOnly && !d.signature && !d.chefSelected) return false;
    if (f.hideUnavailable && !d.available) return false;
    if (f.dietary?.length && !f.dietary.every((t) => d.dietaryTags.includes(t))) return false;
    if (!terms.length) return true;
    const haystack = fold(
      [d.name, d.description, d.provenance ?? '', d.preparation ?? '', ...d.allergens].join(' '),
    );
    return terms.every((t) => haystack.includes(t));
  });
}

export function filterWines(
  wines: WineItem[],
  query: string,
  style?: WineItem['style'],
): WineItem[] {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  return wines.filter((w) => {
    if (style && w.style !== style) return false;
    if (!terms.length) return true;
    const haystack = fold(
      [w.name, w.producer, w.region, w.varietal, w.tastingNotes, ...w.pairingTags].join(' '),
    );
    return terms.every((t) => haystack.includes(t));
  });
}

/** Whether a dish is in season on a date (MM-DD bounds, may wrap the year end). */
export function inSeason(dish: Pick<Dish, 'seasonal'>, date: Date): boolean {
  if (!dish.seasonal) return true;
  const mmdd = date.toISOString().slice(5, 10);
  const { start, end } = dish.seasonal;
  return start <= end ? mmdd >= start && mmdd <= end : mmdd >= start || mmdd <= end;
}
