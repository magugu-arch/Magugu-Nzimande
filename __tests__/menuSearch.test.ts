import { matchProducts, normaliseForSearch } from '@/features/menu/search';
import { products } from '@/services/data/menuData';

const names = (query: string) => matchProducts(products, query).map((product) => product.name);

/**
 * Search matches the way people type, not the way a menu is written.
 *
 * These run against the shipped Pappas catalogue rather than a fixture on
 * purpose: the interesting failures are all collisions between the two, and a
 * Greek menu has more of them than most. "Mezedakia" is a word almost nobody
 * can spell on the first try; "G&T" is punctuation a customer will type three
 * different ways; half the fish are known by a name the menu does not use.
 */
describe('a customer typing the name of a dish', () => {
  it('finds a dish typed without its hyphen', () => {
    expect(names('greek g t')).toContain('Greek G&T');
  });

  it('finds an ampersand dish typed with the word and', () => {
    expect(names('prawn and avocado')).toContain('Prawn & Avocado Salad');
    expect(names('salmon and scrambled eggs')).toContain('Salmon & Scrambled Eggs');
  });

  it('still finds it typed with the ampersand', () => {
    expect(names('prawn & avocado')).toContain('Prawn & Avocado Salad');
  });

  it('does not mind the order the words come in', () => {
    expect(names('souvlaki pork')).toContain('Pork Souvlaki');
    expect(names('salad greek')).toContain('Greek Salad');
  });

  it('finds a dish by a word that is only part of its name', () => {
    expect(names('prawns')).toContain('Grilled King Prawns');
  });

  it('narrows as more words are typed', () => {
    const one = names('grilled');
    const two = names('grilled halloumi');
    expect(one.length).toBeGreaterThan(two.length);
    expect(two).toEqual(['Grilled Halloumi']);
  });

  it('keeps the menu order among equally good matches', () => {
    const order = products.map((product) => product.name);
    const found = names('grilled');
    expect(found).toEqual(order.filter((name) => found.includes(name)));
  });
});

/**
 * When nothing matches every word, near misses beat an apology.
 *
 * "We couldn't find anything for that" on a sixteen-item menu is nearly always
 * the search's fault rather than the kitchen's.
 */
describe('when no dish matches every word', () => {
  it('offers what matched some of them, most first', () => {
    const found = names('grilled king calamari');
    // Both match two of the three words, so the tie falls to menu order: the
    // meze plate is listed before the seafood platter.
    expect(found.slice(0, 2)).toEqual(['Calamari', 'Grilled King Prawns']);
    expect(found).toContain('Grilled Calamari');
  });

  it('does not fall back so far that it offers the whole menu', () => {
    expect(names('grilled king calamari').length).toBeLessThan(products.length);
  });

  it('still finds nothing when there is nothing to find', () => {
    expect(names('xyzzy')).toEqual([]);
    expect(names('pepperoni pizza')).toEqual([]);
  });

  it('finds nothing for an empty or punctuation-only query', () => {
    expect(names('')).toEqual([]);
    expect(names('   ')).toEqual([]);
    expect(names('!!!')).toEqual([]);
  });
});

describe('normalising what was typed', () => {
  it('folds case, punctuation and accents', () => {
    expect(normaliseForSearch('Steak-on-the-Rock')).toBe('steak on the rock');
    // Greek menus are full of these, and a customer types the plain letter.
    expect(normaliseForSearch('  Mezedákia! ')).toBe('mezedakia');
  });

  it('turns an ampersand into the word rather than dropping it', () => {
    // Dropping it would make "prawn avocado", and leave "prawn and avocado"
    // unmatchable — one missed spelling traded for another.
    expect(normaliseForSearch('Prawn & Avocado')).toBe('prawn and avocado');
  });
});

/**
 * The four terms the menu screen offers as one-tap shortcuts. Each is a promise
 * that tapping it shows something.
 */
/**
 * A customer very often types the name of a section rather than a dish.
 *
 * "Mezedakia" is not the name of any single dish — it is the name of eight of
 * them together. Matching the section name is what stops a Greek menu telling
 * somebody it has no meze.
 */
describe('searching by the name of a section', () => {
  it('finds the meze when somebody types the section', () => {
    expect(names('mezedakia')).toContain('Grilled Halloumi');
  });

  it('finds the catch when somebody types the counter', () => {
    expect(names('fish market')).toContain('Kingklip');
  });
});

describe('the suggested searches all lead somewhere', () => {
  it.each(['Souvlaki', 'Prawns', 'Halloumi', 'Baklava', 'Line fish', 'Mezedakia'])(
    '%s finds at least one dish',
    (term) => {
      expect(names(term).length).toBeGreaterThan(0);
    },
  );
});
