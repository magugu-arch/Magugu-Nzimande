import type { ServiceContext } from '../context';
import { audit, nowIso, requireRole } from '../context';
import type { Actor } from '../guests/types';
import { DomainError } from '../shared/errors';
import type { HomeContent, VenueContent } from '../../content/types';
import { inSeason } from './search';
import { MENU_CATEGORIES, type Dish, type MenuCollection, type WineItem } from './types';

/**
 * Content reads and the Menu / Wine CMS (§18, §28 CMS). Price and copy
 * changes land here and reach the app without a store release.
 */
export class ContentService {
  constructor(private readonly ctx: ServiceContext) {}

  categories() {
    return MENU_CATEGORIES;
  }

  /** Seasonal items out of season are hidden; sold-out items stay, marked (§10). */
  dishes(): Dish[] {
    const now = this.ctx.clock.now();
    return this.ctx.db.dishes.filter((d) => inSeason(d, now));
  }

  dish(id: string): Dish {
    return this.ctx.db.dishes.require(id, 'dish');
  }

  wines(): WineItem[] {
    return this.ctx.db.wines.list();
  }

  wine(id: string): WineItem {
    return this.ctx.db.wines.require(id, 'wine');
  }

  collections(): MenuCollection[] {
    const today = this.ctx.clock.now().toISOString().slice(0, 10);
    return this.ctx.db.collections.filter(
      (c) =>
        (!c.seasonalStart || c.seasonalStart <= today) &&
        (!c.seasonalEnd || c.seasonalEnd >= today),
    );
  }

  /** Wines that pair with a dish, and dishes that pair with a wine. */
  pairingsForDish(dishId: string): WineItem[] {
    const d = this.dish(dishId);
    return (d.pairingIds ?? [])
      .map((id) => this.ctx.db.wines.get(id))
      .filter((w): w is WineItem => !!w);
  }

  pairingsForWine(wineId: string): Dish[] {
    return this.dishes().filter((d) => d.pairingIds?.includes(wineId));
  }

  venue(): VenueContent {
    return this.ctx.db.venue.require('venue', 'venue');
  }

  home(): HomeContent {
    return this.ctx.db.home.require('home', 'home content');
  }

  /* ── CMS ────────────────────────────────────────────────────────────── */

  saveDish(dish: Dish, actor: Actor): Dish {
    requireRole(actor, 'admin');
    if (!dish.name.trim()) throw new DomainError('VALIDATION', 'A dish needs a name.', 'name');
    if (!Number.isInteger(dish.priceCents) || dish.priceCents < 0) {
      throw new DomainError('VALIDATION', 'Enter a valid price.', 'price');
    }
    const previous = this.ctx.db.dishes.get(dish.id);
    const saved = this.ctx.db.dishes.upsert({ ...dish, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'menu_item.saved', 'menu_item', dish.id, {
      priceFrom: previous?.priceCents,
      priceTo: dish.priceCents,
      available: dish.available,
    });
    return saved;
  }

  saveWine(wine: WineItem, actor: Actor): WineItem {
    requireRole(actor, 'admin');
    if (!wine.name.trim()) throw new DomainError('VALIDATION', 'A wine needs a name.', 'name');
    if (!Number.isInteger(wine.bottlePriceCents) || wine.bottlePriceCents < 0) {
      throw new DomainError('VALIDATION', 'Enter a valid bottle price.', 'price');
    }
    const saved = this.ctx.db.wines.upsert({ ...wine, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'wine_item.saved', 'wine_item', wine.id, { available: wine.available });
    return saved;
  }

  saveVenue(venue: VenueContent, actor: Actor): VenueContent {
    requireRole(actor, 'admin');
    const saved = this.ctx.db.venue.upsert({ ...venue, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'venue.saved', 'venue', 'venue');
    return saved;
  }

  saveHome(home: HomeContent, actor: Actor): HomeContent {
    requireRole(actor, 'admin');
    const saved = this.ctx.db.home.upsert({ ...home, updatedAt: nowIso(this.ctx) });
    audit(this.ctx, actor, 'home.saved', 'home_content', 'home');
    return saved;
  }
}
